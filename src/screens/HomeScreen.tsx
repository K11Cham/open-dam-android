import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    ScrollView,
    SafeAreaView,
    Platform,
    UIManager,
    Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import AnimatedButton from '../components/ui/AnimatedButton';
import { getAllSlotsInfo, clearSlot } from '../hooks/useGameLogic';
import { AIDifficulty } from '../services/aiService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Types ─────────────────────────────────────────────────────────────────────
export type BoardSize = 5 | 6 | 7 | 8 | 9;

function formatTimeControl(seconds: number | null): string {
    if (seconds === null) return 'No Timer';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
}

interface SlotInfo {
    hasSave: boolean;
    savedAt?: number;
    turn?: number;
}

export interface GameSettings {
    slot: number;
    boardSize: BoardSize;
    vsAI: boolean;
    aiDifficulty: AIDifficulty;
    playerSide: 1 | 2;
    undoAllowed: boolean;
    timeControl: number | null; // seconds per player, null = no timer
}

interface Props {
    onNewGame: (s: GameSettings) => void;
    onLoadGame: (slot: number) => void;
    onSettings: () => void;
    onHelp: () => void;
}

// ─── Pulse Ring ────────────────────────────────────────────────────────────────
const PulseRing = ({ color, size }: { color: string; size: number }) => {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(anim, {
                toValue: 1,
                duration: 2200,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
    const opacity = anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.5, 0.2, 0] });

    return (
        <Animated.View
            pointerEvents="none"
            style={{
                position: 'absolute',
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: 2,
                borderColor: color,
                transform: [{ scale }],
                opacity,
            }}
        />
    );
};

// ─── Mini Board Preview ────────────────────────────────────────────────────────
const BoardPreview = ({ size, theme }: { size: BoardSize; theme: any }) => {
    const setup = useMemo(() => {
        const grid: ('p1' | 'p2' | null)[][] = [];
        const center = Math.floor(size / 2);
        const isYY = size === 5 || size === 7 || size === 9;
        const fillRows = size === 8 ? 3 : 2;
        for (let r = 0; r < size; r++) {
            const row: ('p1' | 'p2' | null)[] = [];
            for (let c = 0; c < size; c++) {
                if (isYY) {
                    if (r === center && c === center) row.push(null);
                    else if (r < center) row.push('p2');
                    else if (r > center) row.push('p1');
                    else row.push(c < center ? 'p2' : 'p1');
                } else {
                    if (r < fillRows) row.push('p2');
                    else if (r >= size - fillRows) row.push('p1');
                    else row.push(null);
                }
            }
            grid.push(row);
        }
        return grid;
    }, [size]);

    const cellSize = size <= 6 ? 34 : size === 7 ? 30 : size === 8 ? 26 : 22;

    return (
        <View style={[styles.previewBoard, { borderColor: theme.boardBorder }]}>
            {setup.map((row, ri) => (
                <View key={ri} style={{ flexDirection: 'row' }}>
                    {row.map((cell, ci) => (
                        <View
                            key={ci}
                            style={{
                                width: cellSize,
                                height: cellSize,
                                backgroundColor: (ri + ci) % 2 === 0 ? theme.cell : theme.highlight,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {cell && (
                                <View
                                    style={{
                                        width: cellSize - 6,
                                        height: cellSize - 6,
                                        borderRadius: (cellSize - 6) / 2,
                                        backgroundColor: cell === 'p1' ? theme.p1 : theme.p2,
                                    }}
                                />
                            )}
                        </View>
                    ))}
                </View>
            ))}
        </View>
    );
};

// ─── PressScale ────────────────────────────────────────────────────────────────
// Only animates transform (scale) — useNativeDriver: true safe.
// Never puts flex/layout props on the Animated.View.
const PressScale = ({
    onPress,
    onLongPress,
    onPressOut,
    delayLongPress,
    children,
    activeScale = 0.95,
}: {
    onPress?: () => void;
    onLongPress?: () => void;
    onPressOut?: () => void;
    delayLongPress?: number;
    children: React.ReactNode;
    activeScale?: number;
}) => {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scale, {
            toValue: activeScale,
            tension: 200,
            friction: 10,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            tension: 200,
            friction: 8,
            useNativeDriver: true,
        }).start();
        onPressOut?.();
    };

    return (
        <TouchableOpacity
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={delayLongPress}
            activeOpacity={1}
        >
            <Animated.View style={{ transform: [{ scale }] }}>
                {children}
            </Animated.View>
        </TouchableOpacity>
    );
};

// ─── Accordion ─────────────────────────────────────────────────────────────────
// Two separate Animated.Values:
//   heightVal → useNativeDriver: false  (animates height, px value not 0-1)
//   rotateVal → useNativeDriver: true   (animates rotation)
//
// The ghost View always renders children off-screen and reports its height via
// onLayout on every render cycle. This means if children change size (e.g. the
// AI difficulty section appearing), measuredH updates and the next open/close
// animates to the correct height.
const AccordionSection = ({
    title,
    icon,
    value,
    valueColor,
    expanded,
    onToggle,
    children,
    theme,
    fontBold,
}: {
    title: string;
    icon: string;
    value: string;
    valueColor: string;
    expanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    theme: any;
    fontBold: string;
}) => {
    // heightVal stores actual px, not 0-1, so we can update the target directly
    const heightVal = useRef(new Animated.Value(0)).current;
    const rotateVal = useRef(new Animated.Value(0)).current;
    const measuredH = useRef(0);
    const isExpanded = useRef(expanded);

    // Called every time the ghost layout changes — keeps measuredH fresh
    const onGhostLayout = (h: number) => {
        if (h <= 0) return;
        const changed = Math.abs(measuredH.current - h) > 1;
        measuredH.current = h;
        // If accordion is open and content grew/shrank, snap to new height immediately
        if (isExpanded.current && changed) {
            heightVal.setValue(h);
        }
    };

    useEffect(() => {
        isExpanded.current = expanded;
        Animated.timing(heightVal, {
            toValue: expanded ? measuredH.current : 0,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
        Animated.timing(rotateVal, {
            toValue: expanded ? 1 : 0,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [expanded]);

    const rotate = rotateVal.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    return (
        <View style={[styles.accordion, { backgroundColor: theme.highlight }]}>
            {/* Header */}
            <PressScale onPress={onToggle} activeScale={0.98}>
                <View style={styles.accordionHeader}>
                    <View style={[styles.accordionIconBox, { backgroundColor: valueColor + '22' }]}>
                        <MaterialIcons name={icon as any} size={17} color={valueColor} />
                    </View>
                    <Text style={[styles.accordionTitle, { color: theme.text, fontFamily: fontBold, flex: 1 }]}>
                        {title}
                    </Text>
                    <View style={[styles.accordionPill, { backgroundColor: valueColor + '22' }]}>
                        <Text style={[styles.accordionPillTxt, { color: valueColor, fontFamily: fontBold }]}>
                            {value}
                        </Text>
                    </View>
                    <Animated.View style={{ transform: [{ rotate }], marginLeft: 4 }}>
                        <MaterialIcons name="expand-more" size={21} color={theme.text + '77'} />
                    </Animated.View>
                </View>
            </PressScale>

            {/* Ghost: always rendered off-screen, measures true content height on every render */}
            <View
                pointerEvents="none"
                style={{ position: 'absolute', opacity: 0, left: 0, right: 0, top: 10000 }}
            >
                <View
                    style={[styles.accordionBody, { borderTopColor: 'transparent' }]}
                    onLayout={(e) => onGhostLayout(e.nativeEvent.layout.height)}
                >
                    {children}
                </View>
            </View>

            {/* Animated body — height driven by heightVal in px */}
            <Animated.View style={{ height: heightVal, overflow: 'hidden' }}>
                <View style={[styles.accordionBody, { borderTopColor: theme.board + 'aa' }]}>
                    {children}
                </View>
            </Animated.View>
        </View>
    );
};

// ─── Home Screen ───────────────────────────────────────────────────────────────
export default function HomeScreen({ onNewGame, onLoadGame, onSettings, onHelp }: Props) {
    const { theme, fontBold, fontRegular } = useTheme();
    const insets = useSafeAreaInsets();

    // Entrance animations — only transform + opacity, useNativeDriver: true
    const logoY = useRef(new Animated.Value(36)).current;
    const logoO = useRef(new Animated.Value(0)).current;
    const menuY = useRef(new Animated.Value(28)).current;
    const menuO = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.stagger(110, [
            Animated.parallel([
                Animated.spring(logoY, { toValue: 0, tension: 55, friction: 11, useNativeDriver: true }),
                Animated.timing(logoO, { toValue: 1, duration: 380, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.spring(menuY, { toValue: 0, tension: 55, friction: 11, useNativeDriver: true }),
                Animated.timing(menuO, { toValue: 1, duration: 380, useNativeDriver: true }),
            ]),
        ]).start();
    }, []);

    // State
    const [showNewGame, setShowNewGame] = useState(false);
    const [showLoad, setShowLoad] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(1);
    const [boardSize, setBoardSize] = useState<BoardSize>(5);
    const [previewSize, setPreviewSize] = useState<BoardSize | null>(null);
    const [vsAI, setVsAI] = useState(false);
    const [aiDiff, setAiDiff] = useState<AIDifficulty>('normal');
    const [playerSide, setPlayerSide] = useState<1 | 2>(1);
    const [undoAllowed, setUndoAllowed] = useState(true);
    const [timeControl, setTimeControl] = useState<number | null>(null);
    const [slotsInfo, setSlotsInfo] = useState<SlotInfo[]>([
        { hasSave: false },
        { hasSave: false },
        { hasSave: false },
    ]);
    const [expBoard, setExpBoard] = useState(false);
    const [expAI, setExpAI] = useState(false);
    const [expRules, setExpRules] = useState(false);
    const [expTime, setExpTime] = useState(false);

    // Toggle animation — useNativeDriver: false because it interpolates backgroundColor + left
    const toggleAnim = useRef(new Animated.Value(1)).current; // starts as undoAllowed=true → 1

    const handleToggle = () => {
        const next = !undoAllowed;
        setUndoAllowed(next);
        Animated.timing(toggleAnim, {
            toValue: next ? 1 : 0,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    };

    const thumbLeft = toggleAnim.interpolate({ inputRange: [0, 1], outputRange: [3, 23] });
    const trackBg = toggleAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [theme.board, theme.accent],
    });

    // Slot loading
    const loadSlots = useCallback(async () => {
        const info = await getAllSlotsInfo();
        setSlotsInfo(info);
    }, []);

    useEffect(() => {
        loadSlots();
    }, [loadSlots]);

    useEffect(() => {
        if (showLoad || showNewGame) loadSlots();
    }, [showLoad, showNewGame]);

    const handleClearSlot = async (slot: number) => {
        await clearSlot(slot);
        loadSlots();
    };

    const fmtDate = (ts?: number) => {
        if (!ts) return '';
        const d = new Date(ts);
        return (
            d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
            ' · ' +
            d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        );
    };

    const startGame = () => {
        setShowNewGame(false);
        onNewGame({
            slot: selectedSlot,
            boardSize,
            vsAI,
            aiDifficulty: aiDiff,
            playerSide,
            undoAllowed,
            timeControl,
        });
    };

    const slotColor = (s: number) =>
        s === 1 ? theme.p1 : s === 2 ? theme.p2 : theme.accent;

    const boardSizes: { size: BoardSize; label: string; sub: string }[] = [
        { size: 5, label: '5×5', sub: 'YY' },
        { size: 6, label: '6×6', sub: 'Full' },
        { size: 7, label: '7×7', sub: 'YY' },
        { size: 8, label: '8×8', sub: 'Full' },
        { size: 9, label: '9×9', sub: 'YY' },
    ];

    const diffs: { value: AIDifficulty; label: string; emoji: string; desc: string }[] = [
        { value: 'easy', label: 'Easy', emoji: '🌱', desc: 'Casual' },
        { value: 'normal', label: 'Normal', emoji: '⚔️', desc: 'Balanced' },
        { value: 'hard', label: 'Hard', emoji: '👑', desc: 'Challenge' },
    ];

    // ── Render ──────────────────────────────────────────────────────────────────
    return (
        <View style={[styles.root, { backgroundColor: theme.bg }]}>
            <View style={{ height: insets.top }} />

            {/* ── Home content ── */}
            <View style={styles.homeContent}>
                <Animated.View
                    style={[styles.logoArea, { opacity: logoO, transform: [{ translateY: logoY }] }]}
                >
                    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                        <PulseRing color={theme.p1} size={118} />
                        <View style={[styles.logoCircle, { backgroundColor: theme.p1 }]}>
                            <MaterialIcons name="grid-on" size={48} color="#FFF" />
                        </View>
                    </View>
                    <Text style={[styles.homeTitle, { color: theme.p1, fontFamily: fontBold }]}>DAM</Text>
                    <Text style={[styles.homeSub, { color: theme.text, fontFamily: fontRegular }]}>
                        Strategic Board Game
                    </Text>
                </Animated.View>

                <Animated.View
                    style={[styles.menuStack, { opacity: menuO, transform: [{ translateY: menuY }] }]}
                >
                    <AnimatedButton
                        onPress={() => {
                            setSelectedSlot(1);
                            setExpBoard(false);
                            setExpAI(false);
                            setExpRules(false);
                            setShowNewGame(true);
                        }}
                        style={[styles.mainBtn, { backgroundColor: theme.p1 }]}
                    >
                        <MaterialIcons name="play-arrow" size={25} color="#FFF" />
                        <Text style={[styles.mainBtnTxt, { fontFamily: fontBold }]}>New Game</Text>
                    </AnimatedButton>

                    <AnimatedButton
                        onPress={() => setShowLoad(true)}
                        style={[styles.mainBtn, { backgroundColor: theme.p2 }]}
                    >
                        <MaterialIcons name="folder-open" size={23} color="#FFF" />
                        <Text style={[styles.mainBtnTxt, { fontFamily: fontBold }]}>Load Game</Text>
                    </AnimatedButton>

                    <View style={styles.iconRow}>
                        <AnimatedButton
                            onPress={onSettings}
                            style={[styles.iconBtn, { backgroundColor: theme.accent }]}
                        >
                            <MaterialIcons name="settings" size={21} color="#FFF" />
                        </AnimatedButton>
                        <AnimatedButton
                            onPress={onHelp}
                            style={[styles.iconBtn, { backgroundColor: theme.highlight }]}
                        >
                            <MaterialIcons name="help-outline" size={21} color={theme.text} />
                        </AnimatedButton>
                    </View>
                </Animated.View>
            </View>

            <View style={{ height: insets.bottom }} />

            {/* ══════════════════ NEW GAME MODAL ══════════════════════════════════ */}
            <Modal
                visible={showNewGame}
                transparent={false}
                animationType="slide"
                onRequestClose={() => setShowNewGame(false)}
            >
                <SafeAreaView style={[styles.modalRoot, { backgroundColor: theme.board }]}>
                    {/* Header */}
                    <View style={[styles.modalHeader, { borderBottomColor: theme.highlight }]}>
                        <PressScale onPress={() => { setShowNewGame(false); setPreviewSize(null); }}>
                            <View style={[styles.headerBtn, { backgroundColor: theme.highlight }]}>
                                <MaterialIcons name="close" size={20} color={theme.text} />
                            </View>
                        </PressScale>
                        <Text style={[styles.modalHeading, { color: theme.text, fontFamily: fontBold }]}>
                            New Game
                        </Text>
                        <View style={{ width: 38 }} />
                    </View>

                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={[styles.scrollPad, { paddingBottom: 20 }]}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        bounces
                    >
                        {/* ── Save Slot ── */}
                        <Text style={[styles.secLabel, { color: theme.text + '66', fontFamily: fontBold }]}>
                            SAVE SLOT
                        </Text>

                        <View style={styles.slotList}>
                            {[1, 2, 3].map((s) => {
                                const sel = selectedSlot === s;
                                const col = slotColor(s);
                                const info = slotsInfo[s - 1];
                                return (
                                    <PressScale key={s} onPress={() => setSelectedSlot(s)}>
                                        <View
                                            style={[
                                                styles.slotCard,
                                                { backgroundColor: sel ? col : theme.highlight },
                                            ]}
                                        >
                                            <View
                                                style={[
                                                    styles.slotStrip,
                                                    { backgroundColor: sel ? 'rgba(255,255,255,0.25)' : col },
                                                ]}
                                            />
                                            <View
                                                style={[
                                                    styles.slotNumRing,
                                                    { backgroundColor: sel ? 'rgba(255,255,255,0.2)' : col + '22' },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.slotNumTxt,
                                                        { color: sel ? '#FFF' : col, fontFamily: fontBold },
                                                    ]}
                                                >
                                                    {s}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text
                                                    style={[
                                                        styles.slotName,
                                                        { color: sel ? '#FFF' : theme.text, fontFamily: fontBold },
                                                    ]}
                                                >
                                                    Slot {s}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.slotMeta,
                                                        {
                                                            color: sel
                                                                ? 'rgba(255,255,255,0.7)'
                                                                : theme.text + '55',
                                                            fontFamily: fontRegular,
                                                        },
                                                    ]}
                                                >
                                                    {info.hasSave
                                                        ? `Turn ${info.turn} · ${fmtDate(info.savedAt)}`
                                                        : 'Empty'}
                                                </Text>
                                            </View>
                                            {sel ? (
                                                <View
                                                    style={[
                                                        styles.slotCheck,
                                                        { backgroundColor: 'rgba(255,255,255,0.25)' },
                                                    ]}
                                                >
                                                    <MaterialIcons name="check" size={16} color="#FFF" />
                                                </View>
                                            ) : info.hasSave ? (
                                                <View style={[styles.saveDot, { backgroundColor: col }]} />
                                            ) : (
                                                <MaterialIcons
                                                    name="chevron-right"
                                                    size={20}
                                                    color={theme.text + '33'}
                                                />
                                            )}
                                        </View>
                                    </PressScale>
                                );
                            })}
                        </View>

                        <View
                            style={[styles.warnBanner, { backgroundColor: theme.p1 + '18', opacity: slotsInfo[selectedSlot - 1]?.hasSave ? 1 : 0 }]}
                        >
                            <MaterialIcons name="info-outline" size={13} color={theme.p1} />
                            <Text
                                style={[
                                    styles.warnTxt,
                                    { color: theme.p1, fontFamily: fontRegular },
                                ]}
                            >
                                Starting here will overwrite the existing save
                            </Text>
                        </View>

                        {/* ── Board Size ── */}
                        <View style={{ height: 20 }} />
                        <AccordionSection
                            title="Board Size"
                            icon="grid-on"
                            value={`${boardSize}×${boardSize}`}
                            valueColor={theme.p1}
                            expanded={expBoard}
                            onToggle={() => setExpBoard(!expBoard)}
                            theme={theme}
                            fontBold={fontBold}
                        >
                            {/*
                             * Layout fix: flexDirection row + equal paddingVertical on each chip.
                             * No flex:1 on PressScale — chips get their size from padding alone.
                             * The row fills width naturally because each chip has equal padding
                             * and there are only 5 options.
                             */}
                            <View style={styles.chipRow}>
                                {boardSizes.map((opt) => {
                                    const sel = boardSize === opt.size;
                                    return (
                                        <PressScale
                                            key={opt.size}
                                            onPress={() => setBoardSize(opt.size)}
                                            onLongPress={() => setPreviewSize(opt.size)}
                                            onPressOut={() => setPreviewSize(null)}
                                            delayLongPress={300}
                                        >
                                            <View
                                                style={[
                                                    styles.sizeChip,
                                                    {
                                                        backgroundColor: sel ? theme.p1 : theme.board,
                                                    },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.chipMain,
                                                        {
                                                            color: sel ? '#FFF' : theme.text,
                                                            fontFamily: fontBold,
                                                        },
                                                    ]}
                                                >
                                                    {opt.label}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.chipSub,
                                                        {
                                                            color: sel
                                                                ? 'rgba(255,255,255,0.6)'
                                                                : theme.text + '55',
                                                            fontFamily: fontRegular,
                                                        },
                                                    ]}
                                                >
                                                    {opt.sub}
                                                </Text>
                                            </View>
                                        </PressScale>
                                    );
                                })}
                            </View>
                        </AccordionSection>

                        {/* ── Game Mode ── */}
                        <View style={{ height: 8 }} />
                        <AccordionSection
                            title="Game Mode"
                            icon={vsAI ? 'smart-toy' : 'people'}
                            value={vsAI ? 'vs AI' : 'vs Human'}
                            valueColor={vsAI ? theme.accent : theme.p2}
                            expanded={expAI}
                            onToggle={() => setExpAI(!expAI)}
                            theme={theme}
                            fontBold={fontBold}
                        >
                            {/*
                             * Segmented control: each button is a TouchableOpacity with fixed
                             * paddingVertical. No flex on PressScale wrapper.
                             */}
                            <View style={[styles.segTrack, { backgroundColor: theme.board }]}>
                                {[
                                    {
                                        label: 'Human',
                                        icon: 'people' as const,
                                        active: !vsAI,
                                        col: theme.p2,
                                        fn: () => setVsAI(false),
                                    },
                                    {
                                        label: 'DamFish AI',
                                        icon: 'smart-toy' as const,
                                        active: vsAI,
                                        col: theme.p1,
                                        fn: () => setVsAI(true),
                                    },
                                ].map((o) => (
                                    <TouchableOpacity
                                        key={o.label}
                                        onPress={o.fn}
                                        activeOpacity={0.8}
                                        style={[
                                            styles.segBtn,
                                            { backgroundColor: o.active ? o.col : 'transparent' },
                                        ]}
                                    >
                                        <MaterialIcons
                                            name={o.icon}
                                            size={16}
                                            color={o.active ? '#FFF' : theme.text + '66'}
                                        />
                                        <Text
                                            style={[
                                                styles.segTxt,
                                                {
                                                    color: o.active ? '#FFF' : theme.text + '66',
                                                    fontFamily: fontBold,
                                                },
                                            ]}
                                        >
                                            {o.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={{ marginTop: 16, gap: 14, opacity: vsAI ? 1 : 0, pointerEvents: vsAI ? 'auto' : 'none' }}>
                                <Text
                                    style={[
                                        styles.subLabel,
                                        { color: theme.text + '66', fontFamily: fontBold },
                                    ]}
                                >
                                    DIFFICULTY
                                </Text>
                                {/*
                                 * Difficulty cards: flexDirection row, each card has
                                 * flex:1 on the View (not PressScale) so the TouchableOpacity
                                 * wrapper doesn't need flex — the inner View expands.
                                 */}
                                <View style={styles.diffRow}>
                                    {diffs.map((d) => {
                                        const sel = aiDiff === d.value;
                                        return (
                                            <TouchableOpacity
                                                key={d.value}
                                                onPress={() => setAiDiff(d.value)}
                                                activeOpacity={0.8}
                                                style={styles.diffTouch}
                                            >
                                                <View
                                                    style={[
                                                        styles.diffCard,
                                                        {
                                                            backgroundColor: sel
                                                                ? theme.accent
                                                                : theme.board,
                                                        },
                                                    ]}
                                                >
                                                    <Text style={{ fontSize: 22 }}>{d.emoji}</Text>
                                                    <Text
                                                        style={[
                                                            styles.diffName,
                                                            {
                                                                color: sel ? '#FFF' : theme.text,
                                                                fontFamily: fontBold,
                                                            },
                                                        ]}
                                                    >
                                                        {d.label}
                                                    </Text>
                                                    <Text
                                                        style={[
                                                            styles.diffDesc,
                                                            {
                                                                color: sel
                                                                    ? 'rgba(255,255,255,0.65)'
                                                                    : theme.text + '55',
                                                                fontFamily: fontRegular,
                                                            },
                                                        ]}
                                                    >
                                                        {d.desc}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <Text
                                    style={[
                                        styles.subLabel,
                                        { color: theme.text + '66', fontFamily: fontBold },
                                    ]}
                                >
                                    PLAY AS
                                </Text>
                                <View style={[styles.segTrack, { backgroundColor: theme.board }]}>
                                    {[
                                        { side: 1 as const, label: 'First', col: theme.p1 },
                                        { side: 2 as const, label: 'Second', col: theme.p2 },
                                    ].map((o) => {
                                        const sel = playerSide === o.side;
                                        return (
                                            <TouchableOpacity
                                                key={o.side}
                                                onPress={() => setPlayerSide(o.side)}
                                                activeOpacity={0.8}
                                                style={[
                                                    styles.segBtn,
                                                    { backgroundColor: sel ? o.col : 'transparent' },
                                                ]}
                                            >
                                                <View
                                                    style={[
                                                        styles.sideDot,
                                                        { backgroundColor: sel ? '#FFF' : o.col },
                                                    ]}
                                                />
                                                <Text
                                                    style={[
                                                        styles.segTxt,
                                                        {
                                                            color: sel ? '#FFF' : theme.text + '66',
                                                            fontFamily: fontBold,
                                                        },
                                                    ]}
                                                >
                                                    {o.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        </AccordionSection>

                        {/* ── Rules ── */}
                        <View style={{ height: 8 }} />
                        <AccordionSection
                            title="Rules"
                            icon="rule"
                            value={undoAllowed ? 'Undo On' : 'Undo Off'}
                            valueColor={undoAllowed ? theme.accent : theme.text + '55'}
                            expanded={expRules}
                            onToggle={() => setExpRules(!expRules)}
                            theme={theme}
                            fontBold={fontBold}
                        >
                            <View style={styles.ruleRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                    <MaterialIcons name="undo" size={17} color={theme.text + '88'} />
                                    <View>
                                        <Text style={[styles.ruleName, { color: theme.text, fontFamily: fontBold }]}>
                                            Allow Undo
                                        </Text>
                                        <Text
                                            style={[
                                                styles.ruleHint,
                                                { color: theme.text + '55', fontFamily: fontRegular },
                                            ]}
                                        >
                                            One request per turn · AI auto-accepts
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={handleToggle} activeOpacity={0.85}>
                                    <Animated.View
                                        style={[styles.toggleTrack, { backgroundColor: trackBg }]}
                                    >
                                        <Animated.View
                                            style={[styles.toggleThumb, { left: thumbLeft }]}
                                        />
                                    </Animated.View>
                                </TouchableOpacity>
                            </View>
                        </AccordionSection>

                        {/* ── Time Control ── */}
                        <View style={{ height: 8 }} />
                        <AccordionSection
                            title="Time Control"
                            icon="schedule"
                            value={timeControl ? formatTimeControl(timeControl) : 'No Timer'}
                            valueColor={timeControl ? theme.accent : theme.text + '55'}
                            expanded={expTime}
                            onToggle={() => setExpTime(!expTime)}
                            theme={theme}
                            fontBold={fontBold}
                        >
                            <View style={styles.timeOptions}>
                                {[
                                    { label: 'No Timer', value: null },
                                    { label: '1 min', value: 60 },
                                    { label: '3 min', value: 180 },
                                    { label: '5 min', value: 300 },
                                    { label: '10 min', value: 600 },
                                    { label: '15 min', value: 900 },
                                    { label: '30 min', value: 1800 },
                                ].map((option) => (
                                    <TouchableOpacity
                                        key={option.label}
                                        onPress={() => setTimeControl(option.value)}
                                        activeOpacity={0.7}
                                        style={[
                                            styles.timeOption,
                                            {
                                                backgroundColor: timeControl === option.value ? theme.accent : theme.board,
                                                borderColor: timeControl === option.value ? theme.accent : theme.highlight,
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.timeOptionText,
                                                {
                                                    color: timeControl === option.value ? '#FFFFFF' : theme.text,
                                                    fontFamily: fontBold,
                                                },
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </AccordionSection>

                        <View style={{ height: 16 }} />
                    </ScrollView>

                    {/* Fixed Start Button */}
                    <View
                        style={[
                            styles.bottomBar,
                            {
                                paddingBottom: insets.bottom + 12,
                                borderTopColor: theme.highlight,
                            },
                        ]}
                    >
                        <PressScale onPress={startGame} activeScale={0.97}>
                            <View style={[styles.startBtn, { backgroundColor: theme.p1 }]}>
                                <MaterialIcons name="play-arrow" size={23} color="#FFF" />
                                <Text style={[styles.startBtnTxt, { fontFamily: fontBold }]}>
                                    Start Game
                                </Text>
                            </View>
                        </PressScale>
                    </View>

                    {/* Board Preview overlay (long-press) */}
                    {previewSize !== null && (
                        <View style={styles.previewOverlay} pointerEvents="none">
                            <View style={[styles.previewCard, { backgroundColor: theme.board }]}>
                                <Text
                                    style={[styles.previewTitle, { color: theme.text, fontFamily: fontBold }]}
                                >
                                    {previewSize}×{previewSize}
                                </Text>
                                <BoardPreview size={previewSize} theme={theme} />
                                <Text
                                    style={[
                                        styles.previewHint,
                                        { color: theme.text + '66', fontFamily: fontRegular },
                                    ]}
                                >
                                    Release to dismiss
                                </Text>
                            </View>
                        </View>
                    )}
                </SafeAreaView>
            </Modal>

            {/* ══════════════════ LOAD GAME MODAL ═════════════════════════════════ */}
            <Modal
                visible={showLoad}
                transparent={false}
                animationType="slide"
                onRequestClose={() => setShowLoad(false)}
            >
                <SafeAreaView style={[styles.modalRoot, { backgroundColor: theme.board }]}>
                    <View style={[styles.modalHeader, { borderBottomColor: theme.highlight }]}>
                        <PressScale onPress={() => setShowLoad(false)}>
                            <View style={[styles.headerBtn, { backgroundColor: theme.highlight }]}>
                                <MaterialIcons name="close" size={20} color={theme.text} />
                            </View>
                        </PressScale>
                        <Text style={[styles.modalHeading, { color: theme.text, fontFamily: fontBold }]}>
                            Load Game
                        </Text>
                        <View style={{ width: 38 }} />
                    </View>

                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={[styles.scrollPad, { paddingBottom: 40 }]}
                        showsVerticalScrollIndicator={false}
                        bounces
                    >
                        <Text
                            style={[
                                styles.loadSubtitle,
                                { color: theme.text + '66', fontFamily: fontRegular },
                            ]}
                        >
                            Continue where you left off
                        </Text>

                        <View style={{ gap: 12 }}>
                            {[1, 2, 3].map((s) => {
                                const info = slotsInfo[s - 1];
                                const col = slotColor(s);
                                const has = info.hasSave;
                                return (
                                    <View
                                        key={s}
                                        style={[
                                            styles.loadCard,
                                            {
                                                backgroundColor: theme.highlight,
                                                opacity: has ? 1 : 0.45,
                                            },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.loadStrip,
                                                { backgroundColor: has ? col : theme.text + '33' },
                                            ]}
                                        />
                                        <View style={styles.loadBody}>
                                            <View style={styles.loadTop}>
                                                <Text
                                                    style={[
                                                        styles.loadSlotName,
                                                        { color: theme.text, fontFamily: fontBold },
                                                    ]}
                                                >
                                                    Slot {s}
                                                </Text>
                                                {has && (
                                                    <View
                                                        style={[
                                                            styles.turnChip,
                                                            { backgroundColor: col + '22' },
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.turnChipTxt,
                                                                { color: col, fontFamily: fontBold },
                                                            ]}
                                                        >
                                                            Turn {info.turn}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text
                                                style={[
                                                    styles.loadMeta,
                                                    { color: theme.text + '55', fontFamily: fontRegular },
                                                ]}
                                            >
                                                {has ? fmtDate(info.savedAt) : 'No saved game'}
                                            </Text>
                                        </View>
                                        <View style={styles.loadActions}>
                                            {has ? (
                                                <>
                                                    <PressScale
                                                        onPress={() => {
                                                            setShowLoad(false);
                                                            onLoadGame(s);
                                                        }}
                                                    >
                                                        <View
                                                            style={[
                                                                styles.resumeBtn,
                                                                { backgroundColor: col },
                                                            ]}
                                                        >
                                                            <MaterialIcons
                                                                name="play-arrow"
                                                                size={18}
                                                                color="#FFF"
                                                            />
                                                            <Text
                                                                style={[
                                                                    styles.resumeTxt,
                                                                    { fontFamily: fontBold },
                                                                ]}
                                                            >
                                                                Resume
                                                            </Text>
                                                        </View>
                                                    </PressScale>
                                                    <PressScale
                                                        onPress={() => handleClearSlot(s)}
                                                    >
                                                        <View
                                                            style={[
                                                                styles.delBtn,
                                                                { backgroundColor: theme.bg },
                                                            ]}
                                                        >
                                                            <MaterialIcons
                                                                name="delete-outline"
                                                                size={17}
                                                                color={theme.text + '55'}
                                                            />
                                                        </View>
                                                    </PressScale>
                                                </>
                                            ) : (
                                                <View
                                                    style={[
                                                        styles.lockIcon,
                                                        { backgroundColor: theme.bg },
                                                    ]}
                                                >
                                                    <MaterialIcons
                                                        name="lock-outline"
                                                        size={17}
                                                        color={theme.text + '33'}
                                                    />
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>

                        {slotsInfo.every((s) => !s.hasSave) && (
                            <View style={styles.emptyState}>
                                <MaterialIcons name="folder-open" size={50} color={theme.text + '33'} />
                                <Text
                                    style={[
                                        styles.emptyTitle,
                                        { color: theme.text + '66', fontFamily: fontBold },
                                    ]}
                                >
                                    No Saved Games
                                </Text>
                                <Text
                                    style={[
                                        styles.emptySub,
                                        { color: theme.text + '44', fontFamily: fontRegular },
                                    ]}
                                >
                                    Start a new game to create your first save
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </View>
    );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1 },
    homeContent: { flex: 1, paddingHorizontal: 28, justifyContent: 'center' },

    // Home screen
    logoArea: { alignItems: 'center', marginBottom: 52 },
    logoCircle: {
        width: 108,
        height: 108,
        borderRadius: 54,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 10,
    },
    homeTitle: { fontSize: 50, letterSpacing: 5, marginTop: 20 },
    homeSub: { fontSize: 13, opacity: 0.55, marginTop: 6, letterSpacing: 1.5 },
    menuStack: { gap: 12 },
    mainBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 17,
        borderRadius: 18,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 8,
        elevation: 4,
    },
    mainBtnTxt: { fontSize: 17, color: '#FFF' },
    iconRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 4 },
    iconBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 3,
    },

    // Modal shell
    modalRoot: { flex: 1 },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalHeading: { fontSize: 18 },
    scrollPad: { paddingHorizontal: 16, paddingTop: 20 },

    // Labels
    secLabel: { fontSize: 10, letterSpacing: 1.8, marginBottom: 10 },
    subLabel: { fontSize: 10, letterSpacing: 1.5 },
    loadSubtitle: { fontSize: 13, marginBottom: 20 },

    // Save slot cards (full width)
    slotList: { gap: 8 },
    slotCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        overflow: 'hidden',
        paddingVertical: 16,
        paddingRight: 16,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
        elevation: 2,
    },
    slotStrip: { width: 5, alignSelf: 'stretch' },
    slotNumRing: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    slotNumTxt: { fontSize: 20 },
    slotName: { fontSize: 15 },
    slotMeta: { fontSize: 12, marginTop: 2 },
    slotCheck: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveDot: { width: 10, height: 10, borderRadius: 5 },
    warnBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        marginTop: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 10,
    },
    warnTxt: { fontSize: 12, flex: 1, lineHeight: 17 },

    // Accordion
    accordion: { borderRadius: 16, overflow: 'hidden' },
    accordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 14,
        gap: 10,
    },
    accordionIconBox: {
        width: 30,
        height: 30,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    accordionTitle: { fontSize: 14 },
    accordionPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
    accordionPillTxt: { fontSize: 12 },
    accordionBody: {
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 14,
        borderTopWidth: 1,
    },

    // Board size chips
    // Each chip is sized by its own padding. The row uses justifyContent:'space-between'
    // so 5 chips fill the row without any flex on the TouchableOpacity/PressScale.
    chipRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    sizeChip: {
        paddingVertical: 14,
        paddingHorizontal: 10,
        borderRadius: 12,
        alignItems: 'center',
        gap: 3,
        minWidth: 52,
    },
    chipMain: { fontSize: 13 },
    chipSub: { fontSize: 10 },

    // Segmented control
    // segBtn uses flex:1 directly on the TouchableOpacity (not a wrapper),
    // which works because TouchableOpacity participates in flex layout.
    segTrack: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 4,
        gap: 4,
    },
    segBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        borderRadius: 9,
        gap: 6,
    },
    segTxt: { fontSize: 13 },
    sideDot: { width: 11, height: 11, borderRadius: 5.5 },

    // Difficulty cards
    // diffTouch is the TouchableOpacity with flex:1 — works because TouchableOpacity
    // participates in flex layout. diffCard fills it.
    diffRow: { flexDirection: 'row', gap: 8 },
    diffTouch: { flex: 1 },
    diffCard: {
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        gap: 4,
    },
    diffName: { fontSize: 13 },
    diffDesc: { fontSize: 10 },

    // Rules toggle
    ruleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    ruleName: { fontSize: 14 },
    ruleHint: { fontSize: 11, marginTop: 1 },
    toggleTrack: { width: 50, height: 28, borderRadius: 14, justifyContent: 'center' },
    toggleThumb: {
        position: 'absolute',
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },

    // Time control options
    timeOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    timeOption: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1.5,
        minWidth: 80,
        alignItems: 'center',
    },
    timeOptionText: { fontSize: 13 },

    // Bottom bar
    bottomBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
    startBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 17,
        borderRadius: 18,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 5,
    },
    startBtnTxt: { fontSize: 17, color: '#FFF' },

    // Board preview overlay
    previewOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewCard: {
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 20,
    },
    previewTitle: { fontSize: 20, marginBottom: 16 },
    previewHint: { fontSize: 11, marginTop: 14 },
    previewBoard: { borderWidth: 2, borderRadius: 8, overflow: 'hidden' },

    // Load modal cards
    loadCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 5,
        elevation: 2,
    },
    loadStrip: { width: 5, alignSelf: 'stretch' },
    loadBody: { flex: 1, paddingVertical: 14, paddingLeft: 14, paddingRight: 8, gap: 4 },
    loadTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    loadSlotName: { fontSize: 16 },
    turnChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
    turnChipTxt: { fontSize: 11 },
    loadMeta: { fontSize: 12 },
    loadActions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12 },
    resumeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
    },
    resumeTxt: { fontSize: 13, color: '#FFF' },
    delBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    lockIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

    // Empty state
    emptyState: { alignItems: 'center', marginTop: 60, gap: 10 },
    emptyTitle: { fontSize: 17 },
    emptySub: { fontSize: 13, textAlign: 'center' },
});