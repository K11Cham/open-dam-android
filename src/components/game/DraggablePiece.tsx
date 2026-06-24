import React, { useRef, useState } from 'react';
import { Animated, PanResponder, View, StyleSheet, Pressable } from 'react-native';
import { Piece } from './Board';

interface Props {
    row: number;
    col: number;
    piece: Piece;
    cellSize: number;
    boardOffset: { x: number; y: number };
    onPress: () => void;
    onDragStart: (row: number, col: number) => void;
    onDragEnd: (row: number, col: number, endRow: number, endCol: number) => void;
    onDragCancel: () => void;
    theme: any;
    children: React.ReactNode;
}

export default function DraggablePiece({
    row,
    col,
    piece,
    cellSize,
    boardOffset,
    onPress,
    onDragStart,
    onDragEnd,
    onDragCancel,
    theme,
    children,
}: Props) {
    const panAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const [isDragging, setIsDragging] = useState(false);
    const dragMovedRef = useRef(false);
    const currentPosRef = useRef({ row, col });

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (evt, { dx, dy }) => {
                // Only activate drag if moved more than 15 points
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance > 15) {
                    dragMovedRef.current = true;
                    setIsDragging(true);
                    onDragStart(row, col);
                    return true;
                }
                return false;
            },
            onPanResponderMove: (evt, { dx, dy }) => {
                if (!dragMovedRef.current) return;
                
                panAnim.x.setValue(dx);
                panAnim.y.setValue(dy);

                // Calculate which cell the piece is over
                const centerX = boardOffset.x + col * cellSize + cellSize / 2 + dx;
                const centerY = boardOffset.y + row * cellSize + cellSize / 2 + dy;

                const newCol = Math.floor((centerX - boardOffset.x) / cellSize);
                const newRow = Math.floor((centerY - boardOffset.y) / cellSize);

                currentPosRef.current = { row: newRow, col: newCol };
            },
            onPanResponderRelease: () => {
                if (!dragMovedRef.current) {
                    // Tap detected
                    dragMovedRef.current = false;
                    setIsDragging(false);
                    onPress();
                    return;
                }

                const endRow = currentPosRef.current.row;
                const endCol = currentPosRef.current.col;

                // Reset position with animation
                Animated.spring(panAnim, {
                    toValue: { x: 0, y: 0 },
                    useNativeDriver: false,
                    tension: 70,
                    friction: 12,
                }).start(() => {
                    dragMovedRef.current = false;
                    setIsDragging(false);
                });

                if (endRow !== row || endCol !== col) {
                    onDragEnd(row, col, endRow, endCol);
                } else {
                    onDragCancel();
                }
            },
            onPanResponderTerminate: () => {
                // Reset position with animation
                Animated.spring(panAnim, {
                    toValue: { x: 0, y: 0 },
                    useNativeDriver: false,
                }).start(() => {
                    dragMovedRef.current = false;
                    setIsDragging(false);
                });
                onDragCancel();
            },
        })
    ).current;

    return (
        <Animated.View
            {...panResponder.panHandlers}
            style={[
                styles.draggableContainer,
                {
                    transform: [
                        { translateX: panAnim.x },
                        { translateY: panAnim.y },
                    ],
                    zIndex: isDragging ? 1000 : 0,
                    opacity: isDragging ? 0.9 : 1,
                },
            ]}
        >
            {children}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    draggableContainer: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
