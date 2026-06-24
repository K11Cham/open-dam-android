import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Animated,
    Easing,
    Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
    visible: boolean;
    winner: number;
    draw?: boolean;
    onNewGame: () => void;
    onMenu: () => void;
    theme: any;
    fontBold: string;
    fontRegular?: string;
}

// Floating particle component
function Particle({ delay, color, size, startX }: { delay: number; color: string; size: number; startX: number }) {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const run = () => {
            anim.setValue(0);
            Animated.timing(anim, {
                toValue: 1,
                duration: 2200 + Math.random() * 1000,
                delay,
                easing: Easing.linear,
                useNativeDriver: true,
            }).start(() => run());
        };
        run();
    }, []);

    const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [60, -320] });
    const opacity = anim.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 0.6, 0] });
    const scale = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1, 0.4] });
    const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
        <Animated.View
            style={{
                position: 'absolute',
                bottom: 0,
                left: startX,
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: color,
                opacity,
                transform: [{ translateY }, { scale }, { rotate }],
            }}
        />
    );
}

export default function WinnerModal({ visible, winner, draw, onNewGame, onMenu, theme, fontBold, fontRegular }: Props) {
    const backdropAnim = useRef(new Animated.Value(0)).current;
    const cardAnim = useRef(new Animated.Value(0)).current;
    const iconAnim = useRef(new Animated.Value(0)).current;
    const iconRotate = useRef(new Animated.Value(0)).current;
    const titleAnim = useRef(new Animated.Value(0)).current;
    const subtitleAnim = useRef(new Animated.Value(0)).current;
    const btn1Anim = useRef(new Animated.Value(0)).current;
    const btn2Anim = useRef(new Animated.Value(0)).current;
    const shimmerAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const isDraw = draw === true;
    const accentColor = isDraw ? theme.accent : winner === 1 ? theme.p1 : theme.p2;

    useEffect(() => {
        if (!visible) {
            [backdropAnim, cardAnim, iconAnim, iconRotate, titleAnim, subtitleAnim, btn1Anim, btn2Anim].forEach(a => a.setValue(0));
            return;
        }

        // Entrance sequence
        Animated.sequence([
            Animated.timing(backdropAnim, {
                toValue: 1, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true,
            }),
            Animated.spring(cardAnim, {
                toValue: 1, tension: 65, friction: 9, useNativeDriver: true,
            }),
        ]).start();

        Animated.sequence([
            Animated.delay(200),
            Animated.spring(iconAnim, {
                toValue: 1, tension: 80, friction: 6, useNativeDriver: true,
            }),
        ]).start();

        // Icon spin-in
        Animated.sequence([
            Animated.delay(200),
            Animated.timing(iconRotate, {
                toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true,
            }),
        ]).start();

        Animated.sequence([
            Animated.delay(380),
            Animated.spring(titleAnim, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
        ]).start();

        Animated.sequence([
            Animated.delay(480),
            Animated.spring(subtitleAnim, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
        ]).start();

        Animated.sequence([
            Animated.delay(560),
            Animated.spring(btn1Anim, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
        ]).start();

        Animated.sequence([
            Animated.delay(630),
            Animated.spring(btn2Anim, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
        ]).start();

        // Shimmer loop
        const shimmerLoop = Animated.loop(
            Animated.timing(shimmerAnim, {
                toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true,
            })
        );
        shimmerLoop.start();

        // Pulse loop on icon
        const pulseLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ])
        );
        const pulseTimer = setTimeout(() => pulseLoop.start(), 800);

        return () => {
            shimmerLoop.stop();
            pulseLoop.stop();
            clearTimeout(pulseTimer);
        };
    }, [visible]);

    if (!visible) return null;

    const cardScale = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
    const cardTranslateY = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });
    const iconScale = iconAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
    const iconSpin = iconRotate.interpolate({ inputRange: [0, 1], outputRange: ['-180deg', '0deg'] });
    const shimmerX = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-200, 200] });

    const particleColors = isDraw
        ? [theme.accent, '#ffffff', theme.accent, '#ffffff']
        : winner === 1
            ? [theme.p1, '#FFD700', theme.p1, '#FFF']
            : [theme.p2, '#FF69B4', theme.p2, '#FFF'];

    const particles = Array.from({ length: 12 }, (_, i) => ({
        delay: i * 180,
        color: particleColors[i % particleColors.length],
        size: 6 + (i % 3) * 4,
        startX: (i / 12) * 300 - 20,
    }));

    return (
        <Modal visible={visible} transparent animationType="none">
            <Animated.View style={[styles.overlay, { opacity: backdropAnim }]}>

                {/* Particles */}
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    {particles.map((p, i) => (
                        <Particle key={i} {...p} />
                    ))}
                </View>

                <Animated.View
                    style={[
                        styles.card,
                        {
                            backgroundColor: theme.board,
                            transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
                        },
                    ]}
                >
                    {/* Top accent bar */}
                    <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

                    {/* Shimmer overlay on card */}
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.shimmer,
                            { transform: [{ translateX: shimmerX }] },
                        ]}
                    />

                    {/* Icon */}
                    <Animated.View
                        style={[
                            styles.iconRing,
                            {
                                borderColor: accentColor,
                                transform: [
                                    { scale: Animated.multiply(iconScale, pulseAnim) },
                                    { rotate: iconSpin },
                                ],
                            },
                        ]}
                    >
                        <View style={[styles.iconInner, { backgroundColor: accentColor }]}>
                            <MaterialIcons
                                name={isDraw ? 'balance' : 'emoji-events'}
                                size={44}
                                color="#FFFFFF"
                            />
                        </View>
                    </Animated.View>

                    {/* Title */}
                    <Animated.Text
                        style={[
                            styles.title,
                            {
                                color: theme.text,
                                fontFamily: fontBold,
                                opacity: titleAnim,
                                transform: [{
                                    translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
                                }],
                            },
                        ]}
                    >
                        {isDraw ? 'DRAW!' : `PLAYER ${winner} WINS!`}
                    </Animated.Text>

                    {/* Accent underline */}
                    <Animated.View
                        style={[
                            styles.titleUnderline,
                            {
                                backgroundColor: accentColor,
                                opacity: titleAnim,
                                transform: [{
                                    scaleX: titleAnim,
                                }],
                            },
                        ]}
                    />

                    {/* Subtitle */}
                    <Animated.Text
                        style={[
                            styles.subtitle,
                            {
                                color: theme.text,
                                fontFamily: fontRegular || 'System',
                                opacity: subtitleAnim,
                                transform: [{
                                    translateY: subtitleAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
                                }],
                            },
                        ]}
                    >
                        {isDraw ? 'Both pieces remain standing' : 'Well played!'}
                    </Animated.Text>

                    {/* Buttons */}
                    <View style={styles.buttons}>
                        <Animated.View
                            style={{
                                flex: 1,
                                opacity: btn1Anim,
                                transform: [{
                                    translateY: btn1Anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }),
                                }],
                            }}
                        >
                            <TouchableOpacity
                                style={[styles.btnPrimary, { backgroundColor: accentColor }]}
                                onPress={onNewGame}
                                activeOpacity={0.75}
                            >
                                <MaterialIcons name="replay" size={18} color="#FFF" />
                                <Text style={[styles.btnTextPrimary, { fontFamily: fontBold }]}>Play Again</Text>
                            </TouchableOpacity>
                        </Animated.View>

                        <Animated.View
                            style={{
                                flex: 1,
                                opacity: btn2Anim,
                                transform: [{
                                    translateY: btn2Anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }),
                                }],
                            }}
                        >
                            <TouchableOpacity
                                style={[styles.btnSecondary, { borderColor: accentColor }]}
                                onPress={onMenu}
                                activeOpacity={0.75}
                            >
                                <MaterialIcons name="home" size={18} color={theme.text} />
                                <Text style={[styles.btnTextSecondary, { color: theme.text, fontFamily: fontBold }]}>Menu</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        width: Math.min(SCREEN_WIDTH * 0.88, 360),
        borderRadius: 28,
        paddingTop: 0,
        paddingBottom: 32,
        paddingHorizontal: 28,
        alignItems: 'center',
        overflow: 'hidden',
        // Depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 24 },
        shadowOpacity: 0.45,
        shadowRadius: 40,
        elevation: 20,
    },
    accentBar: {
        width: '100%',
        height: 5,
        marginBottom: 32,
        borderRadius: 0,
    },
    shimmer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 80,
        backgroundColor: 'rgba(255,255,255,0.06)',
        transform: [{ skewX: '-20deg' }],
    },
    iconRing: {
        width: 104,
        height: 104,
        borderRadius: 52,
        borderWidth: 3,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    iconInner: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 26,
        letterSpacing: 2,
        marginBottom: 8,
        textAlign: 'center',
    },
    titleUnderline: {
        height: 3,
        width: 60,
        borderRadius: 2,
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 14,
        opacity: 0.55,
        marginBottom: 32,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    buttons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    btnPrimary: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
        borderRadius: 16,
        gap: 8,
    },
    btnTextPrimary: {
        fontSize: 15,
        color: '#FFF',
        letterSpacing: 0.5,
    },
    btnSecondary: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 2,
        gap: 8,
    },
    btnTextSecondary: {
        fontSize: 15,
        letterSpacing: 0.5,
    },
});