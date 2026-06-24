import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, View, StyleSheet, Animated, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { HighlightType } from './Board';

interface Props {
    row: number;
    col: number;
    piece: { player: number; isKing: boolean } | null;
    removedPiece: { player: number; isKing: boolean } | null;
    onPress: () => void;
    isSelected: boolean;
    isOffender: boolean;
    isRemoved: boolean;
    isMovingTo: boolean;
    highlight?: { type: HighlightType };
    theme: any;
    fontBold: string;
}

function getHighlightColors(type: HighlightType): { bg: string; border?: string; indicator?: string } {
    switch (type) {
        case 'valid':
            return { bg: '#FFF9C4', border: '#FFD54F', indicator: '#FFD54F' };
        case 'capture':
            return { bg: '#FFEBEE', border: '#EF5350', indicator: '#EF5350' };
        case 'selected':
            return { bg: '#FFF8E1', border: '#FFD700' };
        case 'danger':
            return { bg: '#FFEBEE', border: '#F44336' };
        case 'promote':
            return { bg: '#E8F5E9', border: '#4CAF50', indicator: '#4CAF50' };
        case 'path':
            return { bg: '#F3E5F5', border: '#9C27B0' };
        default:
            return { bg: 'transparent' };
    }
}

export default function Cell({
    row,
    col,
    piece,
    removedPiece,
    onPress,
    isSelected,
    isOffender,
    isRemoved,
    isMovingTo,
    highlight,
    theme
}: Props) {
    let bgColor = theme.cell;
    let borderColor = 'transparent';
    let showIndicator = false;
    let indicatorColor = 'transparent';

    if (highlight) {
        const colors = getHighlightColors(highlight.type);
        bgColor = colors.bg;
        if (colors.border) borderColor = colors.border;
        if (colors.indicator) { showIndicator = true; indicatorColor = colors.indicator; }
    } else if (isOffender) {
        const colors = getHighlightColors('danger');
        bgColor = colors.bg;
        borderColor = colors.border || 'transparent';
    } else if (isSelected) {
        const colors = getHighlightColors('selected');
        bgColor = colors.bg;
        borderColor = colors.border || 'transparent';
    }

    // --- Highlight fade ---
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const shouldHighlight = highlight || isOffender || isSelected;
    
    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: shouldHighlight ? 1 : 0,
            duration: shouldHighlight ? 180 : 120,
            easing: shouldHighlight ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [highlight?.type, isOffender, isSelected, shouldHighlight]);

    // --- Press scale ---
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const handlePressIn = () => {
        // Only animate if piece is actually visible and not moving
        if (piece && !isMovingTo) {
            Animated.spring(scaleAnim, { toValue: 0.82, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
        }
    };
    const handlePressOut = () => {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
    };

    // --- Removal animation ---
    const removeAnim = useRef(new Animated.Value(0)).current;
    const [ghostPiece, setGhostPiece] = useState<{ player: number; isKing: boolean } | null>(null);
    const [shouldAnimateRef, setShouldAnimate] = useState(false);

    // Reset animation value synchronously BEFORE setting ghost piece
    useLayoutEffect(() => {
        if (isRemoved && removedPiece && !ghostPiece) {
            removeAnim.setValue(1);
            setGhostPiece(removedPiece);
            setShouldAnimate(true);
        }
    }, [isRemoved, removedPiece]);

    // Start the animation in a separate effect
    useEffect(() => {
        if (shouldAnimateRef && ghostPiece) {
            Animated.timing(removeAnim, {
                toValue: 0,
                duration: 200,
                easing: Easing.bezier(0.4, 0, 0.2, 1),
                useNativeDriver: true,
            }).start(() => {
                setGhostPiece(null);
                setShouldAnimate(false);
            });
        }
    }, [shouldAnimateRef, ghostPiece]);

    const removeScale = removeAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.25, 1],
    });

    // isMovingTo: dest cell hidden while overlay flies in — show nothing
    // ghost: piece was captured/called — show shrink-fade ghost
    // otherwise: show real piece
    const ghost = ghostPiece;
    const displayPiece = isMovingTo ? null : (piece ?? ghost ?? null);
    const isGhost = !isMovingTo && !piece && !!ghost;

    // Show dot only on genuinely empty cells with no real piece
    const showDot = showIndicator && !piece && !isMovingTo;

    const pieceContent = (
        <Animated.View style={[
            styles.pieceWrapper,
            displayPiece?.isKing && styles.kingWrapper,
            {
                transform: [{ scale: isGhost ? removeScale : scaleAnim }],
                opacity: isGhost ? removeAnim : 1,
            }
        ]}>
            <View style={[
                styles.pieceToken,
                displayPiece?.player === 1
                    ? { backgroundColor: theme.p1 }
                    : { backgroundColor: theme.p2 },
                displayPiece?.isKing && styles.kingToken,
            ]}>
                {displayPiece?.isKing && (
                    <MaterialIcons name="stars" size={24} color="#FFD700" style={styles.crownIcon} />
                )}
            </View>
        </Animated.View>
    );

    return (
        <Pressable
            onPress={onPress}
            onPressIn={piece && !isMovingTo ? handlePressIn : undefined}
            onPressOut={piece && !isMovingTo ? handlePressOut : undefined}
            style={[styles.cellContainer, { backgroundColor: theme.cell }]}
        >
            {/* Highlight background */}
            <Animated.View
                style={[styles.highlightFill, { backgroundColor: bgColor, opacity: fadeAnim }]}
                pointerEvents="none"
            />

            {/* Border overlay */}
            {borderColor !== 'transparent' && (
                <Animated.View
                    style={[styles.borderOverlay, { borderColor, opacity: fadeAnim }]}
                    pointerEvents="none"
                />
            )}

            {/*
             * Move indicator dot.
             *
             * FIX: Previously the dot was a direct flex child of the cellContainer,
             * so its position was subject to whatever flex sizing happened to be in
             * effect on that render — causing it to shift off-centre on some cells.
             *
             * The fix is to give it an absolute-fill parent that is always perfectly
             * centred regardless of flex layout.  The opacity animation is hoisted
             * onto the outer Animated.View so the inner View can be a plain View with
             * no animated props (avoiding the static-opacity / Animated-opacity conflict
             * that was noted in the original comment).
             */}
            {showDot && (
                <Animated.View
                    pointerEvents="none"
                    style={[styles.dotContainer, { opacity: fadeAnim }]}
                >
                    <View style={[styles.moveIndicator, { backgroundColor: indicatorColor }]} />
                </Animated.View>
            )}

            {/* Piece - with optional drag support */}
            {displayPiece && (
                <View style={styles.pieceContainer}>
                    {pieceContent}
                </View>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    cellContainer: {
        flex: 1,
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 2,
    },
    highlightFill: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: 2,
    },
    borderOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        borderWidth: 2,
        borderRadius: 2,
    },
    // Absolute-fill wrapper that centres the dot independently of the parent
    // flex container.  This prevents the dot from shifting when the flex
    // layout happens to size the child differently on different cells.
    dotContainer: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    moveIndicator: {
        width: 16,
        height: 16,
        borderRadius: 8,
        // No opacity here — the parent Animated.View carries fadeAnim.
        // Keeping opacity off this View avoids the static-opacity /
        // Animated-opacity conflict that caused dot misalignment.
    },
    pieceContainer: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pieceWrapper: {
        width: '70%',
        height: '70%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    kingWrapper: {
        width: '80%',
        height: '80%',
    },
    pieceToken: {
        width: '100%',
        height: '100%',
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    kingToken: {
        borderWidth: 3,
        borderColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 8,
    },
    crownIcon: {
        textShadowColor: 'rgba(255, 215, 0, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 4,
    },
});
