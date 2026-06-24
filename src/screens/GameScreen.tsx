import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Modal, TouchableOpacity, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import Board, { Highlight, Piece } from '../components/game/Board';
import PlayerBar from '../components/game/PlayerBar';
import WinnerModal from '../components/game/WinnerModal';
import AnimatedButton from '../components/ui/AnimatedButton';
import { useGameLogic } from '../hooks/useGameLogic';
import { GameSettings } from './HomeScreen';

interface Props {
    onMenu: () => void;
    settings: GameSettings;
    mode: 'new' | 'load';
}

export default function GameScreen({ onMenu, settings: gameSettings, mode }: Props) {
    const { theme, fontBold, fontRegular } = useTheme();
    const { settings } = useSettings();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();

    // ── Per-player timers ────────────────────────────────────────────────────
    // timeControl is seconds per player (null = no timer)
    const initialTime = gameSettings.timeControl ?? null;
    const [p1Time, setP1Time] = useState<number | null>(initialTime);
    const [p2Time, setP2Time] = useState<number | null>(initialTime);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // ── Draw request state ───────────────────────────────────────────────────
    const [drawRequest, setDrawRequest] = useState<{ requester: number } | null>(null);

    // ── Confirm move modal ───────────────────────────────────────────────────
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [pendingMove, setPendingMove] = useState<{ row: number; col: number } | null>(null);

    // ── Resign animation ─────────────────────────────────────────────────────
    const [resigningPlayer, setResigningPlayer] = useState<number | null>(null);
    const resignFadeAnim = useRef(new Animated.Value(0)).current;

    const {
        board, turn, winner, draw, selected, offenders, placementPhase,
        undoRequest, history, boardSize: size, chainKill,
        handleCellPress, handleCall, resetGame,
        handleRequestUndo, handleAcceptUndo, handleDeclineUndo, handleResign, handleAcceptDraw,
        vsAI, aiPlayer, playerSide, aiThinking,
        undoAllowed, undoUsedThisTurn,
    } = useGameLogic(
        mode,
        gameSettings.slot,
        gameSettings.boardSize,
        gameSettings.vsAI,
        gameSettings.aiDifficulty,
        gameSettings.playerSide,
        gameSettings.undoAllowed
    );

    // ── Timer tick ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        // No timer, game over, or placement phase — don't tick
        if (initialTime === null || winner !== 0 || draw) return;

        timerRef.current = setInterval(() => {
            if (turn === 1) {
                setP1Time(prev => {
                    if (prev === null) return null;
                    if (prev <= 0) {
                        clearInterval(timerRef.current!);
                        handleResign(1); // out of time
                        return 0;
                    }
                    return prev - 1;
                });
            } else {
                setP2Time(prev => {
                    if (prev === null) return null;
                    if (prev <= 0) {
                        clearInterval(timerRef.current!);
                        handleResign(2);
                        return 0;
                    }
                    return prev - 1;
                });
            }
        }, 1000);

        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [turn, winner, draw, initialTime]);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
        if (!settings.hapticFeedback) return;
        switch (type) {
            case 'light':  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); break;
            case 'medium': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
            case 'heavy':  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); break;
        }
    };

    const playSound = (soundType: 'move' | 'capture' | 'call' | 'win') => {
        if (!settings.soundEffects) return;
        if (settings.hapticFeedback) {
            switch (soundType) {
                case 'capture': case 'call': triggerHaptic('heavy'); break;
                case 'win': triggerHaptic('medium'); break;
                default: triggerHaptic('light');
            }
        }
    };

    const handleResetGame = () => {
        setP1Time(initialTime);
        setP2Time(initialTime);
        setDrawRequest(null);
        resetGame();
        triggerHaptic('medium');
    };

    const flipBoard = vsAI && playerSide === 2;
    const isPvP = !vsAI;

    // ── Cell press ────────────────────────────────────────────────────────────
    const onCellPress = (row: number, col: number) => {
        const actualRow = flipBoard ? size - 1 - row : row;
        const actualCol = flipBoard ? size - 1 - col : col;
        if (settings.confirmMoves && selected && !board[actualRow][actualCol]) {
            setPendingMove({ row, col });
            setConfirmModalVisible(true);
            triggerHaptic('light');
        } else {
            handleCellPress(actualRow, actualCol);
            triggerHaptic('light');
            if (selected) {
                const piece = board[selected.row][selected.col];
                if (piece) {
                    const captures = getValidCaptures(selected.row, selected.col, board, piece);
                    playSound(captures.some(c => c.row === actualRow && c.col === actualCol) ? 'capture' : 'move');
                }
            }
        }
    };

    const confirmMove = () => {
        if (pendingMove) {
            const actualRow = flipBoard ? size - 1 - pendingMove.row : pendingMove.row;
            const actualCol = flipBoard ? size - 1 - pendingMove.col : pendingMove.col;
            handleCellPress(actualRow, actualCol);
        }
        setConfirmModalVisible(false);
        setPendingMove(null);
        triggerHaptic('medium');
    };

    const cancelMove = () => {
        setConfirmModalVisible(false);
        setPendingMove(null);
        triggerHaptic('light');
    };

    // ── Move helpers ──────────────────────────────────────────────────────────
    const getPromotionRow = (player: number) => player === 1 ? 0 : size - 1;

    const getValidSlides = (row: number, col: number, boardState: (Piece | null)[][], piece: Piece) => {
        const moves: { row: number; col: number }[] = [];
        const dirs = piece.isKing ? [[-1,0],[1,0],[0,-1],[0,1]] : piece.player === 1 ? [[-1,0],[0,-1],[0,1]] : [[1,0],[0,-1],[0,1]];
        for (const [dr, dc] of dirs) {
            if (piece.isKing) {
                let d = 1;
                while (true) {
                    const r = row + dr * d, c = col + dc * d;
                    if (r < 0 || r >= size || c < 0 || c >= size || boardState[r][c]) break;
                    moves.push({ row: r, col: c }); d++;
                }
            } else {
                const r = row + dr, c = col + dc;
                if (r >= 0 && r < size && c >= 0 && c < size && !boardState[r][c]) moves.push({ row: r, col: c });
            }
        }
        return moves;
    };

    const getValidCaptures = (row: number, col: number, boardState: (Piece | null)[][], piece: Piece) => {
        const moves: { row: number; col: number }[] = [];
        const dirs = piece.isKing ? [[-1,0],[1,0],[0,-1],[0,1]] : piece.player === 1 ? [[-1,0],[0,-1],[0,1]] : [[1,0],[0,-1],[0,1]];
        for (const [dr, dc] of dirs) {
            let d = 1, foundEnemy = false;
            while (true) {
                const r = row + dr * d, c = col + dc * d;
                if (r < 0 || r >= size || c < 0 || c >= size) break;
                const cell = boardState[r][c];
                if (!foundEnemy) {
                    if (!cell) { if (piece.isKing) d++; else break; }
                    else if (cell.player === piece.player) break;
                    else { foundEnemy = true; d++; }
                } else {
                    if (!cell) { moves.push({ row: r, col: c }); if (piece.isKing) d++; else break; }
                    else break;
                }
            }
        }
        return moves;
    };

    // ── Highlights ────────────────────────────────────────────────────────────
    const highlights = useMemo(() => {
        if (!settings.showMoveHints || !selected || winner !== 0 || draw || !board.length) return [];
        const piece = board[selected.row][selected.col];
        if (!piece) return [];
        const hl: Highlight[] = [];
        if (!chainKill) {
            getValidSlides(selected.row, selected.col, board, piece).forEach(m => {
                hl.push({ row: m.row, col: m.col, type: m.row === getPromotionRow(piece.player) && !piece.isKing ? 'promote' : 'valid' });
            });
        }
        getValidCaptures(selected.row, selected.col, board, piece).forEach(m => hl.push({ row: m.row, col: m.col, type: 'capture' }));
        if (flipBoard) return hl.map(h => ({ row: size - 1 - h.row, col: size - 1 - h.col, type: h.type }));
        return hl;
    }, [selected, board, winner, draw, size, chainKill, flipBoard, settings.showMoveHints]);

    const displayBoard = useMemo(() => {
        if (!flipBoard || !board.length) return board;
        return [...board].reverse().map(row => [...row].reverse());
    }, [board, flipBoard]);

    const displaySelected = useMemo(() => {
        if (!selected || !flipBoard) return selected;
        return { row: size - 1 - selected.row, col: size - 1 - selected.col };
    }, [selected, flipBoard, size]);

    const displayOffenders = useMemo(() => {
        if (!flipBoard || !offenders.length) return offenders;
        return offenders.map(o => ({ row: size - 1 - o.row, col: size - 1 - o.col }));
    }, [offenders, flipBoard, size]);

    // ── Layout sizing ─────────────────────────────────────────────────────────
    const availableHeight = height - insets.top - insets.bottom - 80 - 60 * 2 - 40;
    const availableWidth = width - 40;
    const boardDisplaySize = Math.min(availableWidth, availableHeight);

    const topPlayer = flipBoard ? 1 : 2;
    const bottomPlayer = flipBoard ? 2 : 1;
    const displayTurn = flipBoard ? (turn === 1 ? 2 : 1) : turn;

    const currentPlayerLabel = vsAI
        ? (turn === playerSide ? 'Your Turn' : 'AI Thinking...')
        : `Player ${turn}'s Turn`;

    // Which time to show on each bar
    // In PvP: top bar = player 2 (or 1 if flipped), bottom = player 1
    // In AI: bottom is human, top is AI
    const topTime = topPlayer === 1 ? p1Time : p2Time;
    const bottomTime = bottomPlayer === 1 ? p1Time : p2Time;

    const canUndoTop = !vsAI
        ? (displayTurn !== topPlayer && history.length > 0)
        : (playerSide === topPlayer && turn === topPlayer && history.length > 0);
    const canUndoBottom = !vsAI
        ? (displayTurn !== bottomPlayer && history.length > 0)
        : (playerSide === bottomPlayer && turn === bottomPlayer && history.length > 0);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleCallWithFeedback = () => { handleCall(); playSound('call'); triggerHaptic('heavy'); };
    const handleUndoRequest = (player: number) => { handleRequestUndo(player); triggerHaptic('medium'); };
    const handleAcceptUndoFb = () => { handleAcceptUndo(); triggerHaptic('medium'); };
    const handleDeclineUndoFb = () => { handleDeclineUndo(); triggerHaptic('light'); };

    const handleResignWithFeedback = (player: number) => {
        setResigningPlayer(player);
        resignFadeAnim.setValue(0);
        Animated.timing(resignFadeAnim, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        triggerHaptic('medium');
    };
    const confirmResign = () => {
        if (resigningPlayer !== null) {
            Animated.timing(resignFadeAnim, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true })
                .start(() => { handleResign(resigningPlayer); setResigningPlayer(null); });
        }
    };
    const cancelResign = () => {
        Animated.timing(resignFadeAnim, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true })
            .start(() => setResigningPlayer(null));
        triggerHaptic('light');
    };

    const handleRequestDraw = (player: number) => { setDrawRequest({ requester: player }); triggerHaptic('medium'); };
    const handleAcceptDrawLocal = () => { handleAcceptDraw(); setDrawRequest(null); triggerHaptic('medium'); };
    const handleDeclineDraw = () => { setDrawRequest(null); triggerHaptic('light'); };

    useEffect(() => {
        if (winner !== 0 || draw) { playSound('win'); setDrawRequest(null); }
    }, [winner, draw]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <View style={{ height: insets.top, backgroundColor: theme.bg }} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.highlight }]}>
                <AnimatedButton onPress={onMenu} style={[styles.homeBtn, { backgroundColor: theme.highlight }]}>
                    <MaterialIcons name="home" size={26} color={theme.text} />
                </AnimatedButton>
                <View style={styles.headerCenter}>
                    <Text style={[styles.gameTitle, { color: theme.p1, fontFamily: fontBold }]}>DAM</Text>
                    <View style={styles.headerSubRow}>
                        {placementPhase ? (
                            <View style={[styles.phaseBadge, { backgroundColor: theme.p2 }]}>
                                <Text style={[styles.phaseText, { fontFamily: fontBold }]}>PLACEMENT</Text>
                            </View>
                        ) : chainKill ? (
                            <View style={[styles.phaseBadge, { backgroundColor: theme.p1 }]}>
                                <MaterialIcons name="flash-on" size={12} color="#FFF" />
                                <Text style={[styles.phaseText, { fontFamily: fontBold, marginLeft: 4 }]}>CHAIN KILL</Text>
                            </View>
                        ) : winner === 0 && !draw ? (
                            <Text style={[styles.turnText, { color: vsAI && turn === playerSide ? theme.p1 : theme.text, fontFamily: fontRegular }]}>
                                {currentPlayerLabel}
                            </Text>
                        ) : null}
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <View style={[styles.sizeIndicator, { backgroundColor: theme.p2 }]}>
                        <Text style={[styles.sizeText, { fontFamily: fontBold }]}>{size}×{size}</Text>
                    </View>
                </View>
            </View>

            {/* Game area — bars + board perfectly flush, centered */}
            <View style={styles.gameArea}>
                <View style={{ width: boardDisplaySize }}>
                    <PlayerBar
                        player={topPlayer}
                        turn={displayTurn}
                        winner={winner}
                        offenders={displayOffenders}
                        onCall={handleCallWithFeedback}
                        onResign={() => handleResignWithFeedback(topPlayer)}
                        onRequestUndo={() => handleUndoRequest(topPlayer)}
                        onAcceptUndo={handleAcceptUndoFb}
                        onDeclineUndo={handleDeclineUndoFb}
                        onRequestDraw={() => handleRequestDraw(topPlayer)}
                        onAcceptDraw={handleAcceptDrawLocal}
                        onDeclineDraw={handleDeclineDraw}
                        undoRequest={undoRequest}
                        drawRequest={drawRequest}
                        undoAllowed={undoAllowed}
                        undoUsedThisTurn={undoUsedThisTurn}
                        canUndo={canUndoTop}
                        timeRemaining={topTime}
                        isTop={true}
                        shouldRotate={isPvP}
                        isAI={vsAI && aiPlayer === topPlayer}
                        theme={theme}
                        fontBold={fontBold}
                    />

                    {/* Mixed-color side borders on the board */}
                    <View style={styles.boardWrapper}>
                        <Board
                            board={displayBoard}
                            selected={displaySelected}
                            offenders={displayOffenders}
                            highlights={highlights}
                            onPress={onCellPress}
                            theme={theme}
                            fontBold={fontBold}
                        />
                        {/* Left gradient border: p2 on top → p1 on bottom */}
                        <LinearGradient
                            style={styles.sideBorderLeft}
                            colors={[theme.p2, theme.p1]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                        />
                        {/* Right gradient border */}
                        <LinearGradient
                            style={styles.sideBorderRight}
                            colors={[theme.p2, theme.p1]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                        />
                    </View>

                    <PlayerBar
                        player={bottomPlayer}
                        turn={displayTurn}
                        winner={winner}
                        offenders={displayOffenders}
                        onCall={handleCallWithFeedback}
                        onResign={() => handleResignWithFeedback(bottomPlayer)}
                        onRequestUndo={() => handleUndoRequest(bottomPlayer)}
                        onAcceptUndo={handleAcceptUndoFb}
                        onDeclineUndo={handleDeclineUndoFb}
                        onRequestDraw={() => handleRequestDraw(bottomPlayer)}
                        onAcceptDraw={handleAcceptDrawLocal}
                        onDeclineDraw={handleDeclineDraw}
                        undoRequest={undoRequest}
                        drawRequest={drawRequest}
                        undoAllowed={undoAllowed}
                        undoUsedThisTurn={undoUsedThisTurn}
                        canUndo={canUndoBottom}
                        timeRemaining={bottomTime}
                        isTop={false}
                        shouldRotate={false}
                        isAI={vsAI && aiPlayer === bottomPlayer}
                        theme={theme}
                        fontBold={fontBold}
                    />
                </View>
            </View>

            <View style={{ height: insets.bottom }} />

            <WinnerModal
                visible={winner !== 0 || draw}
                winner={winner}
                draw={draw}
                onNewGame={handleResetGame}
                onMenu={onMenu}
                theme={theme}
                fontBold={fontBold}
                fontRegular={fontRegular}
            />

            <Modal visible={confirmModalVisible} transparent animationType="fade" onRequestClose={cancelMove}>
                <View style={styles.confirmOverlay}>
                    <View style={[styles.confirmModal, { backgroundColor: theme.board }]}>
                        <MaterialIcons name="help-outline" size={48} color={theme.p1} />
                        <Text style={[styles.confirmTitle, { color: theme.text, fontFamily: fontBold }]}>Confirm Move?</Text>
                        <Text style={[styles.confirmText, { color: theme.text, fontFamily: fontRegular }]}>Do you want to make this move?</Text>
                        <View style={styles.confirmButtons}>
                            <TouchableOpacity style={[styles.confirmButton, { backgroundColor: theme.highlight }]} onPress={cancelMove}>
                                <Text style={[styles.confirmButtonText, { color: theme.text, fontFamily: fontBold }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.confirmButton, { backgroundColor: theme.p1 }]} onPress={confirmMove}>
                                <Text style={[styles.confirmButtonText, { color: '#FFF', fontFamily: fontBold }]}>Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const BOARD_BORDER = 3; // matches player bar border thickness

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    homeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { alignItems: 'center' },
    gameTitle: { fontSize: 32 },
    headerSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6, minHeight: 24 },
    turnText: { fontSize: 14, opacity: 0.8 },
    phaseBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
    phaseText: { fontSize: 11, color: '#FFF' },
    headerRight: { width: 44, alignItems: 'center', justifyContent: 'center' },
    sizeIndicator: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    sizeText: { fontSize: 11, color: '#FFF' },
    gameArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    boardWrapper: {
        position: 'relative',
    },
    sideBorderLeft: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: BOARD_BORDER,
        flexDirection: 'column',
        overflow: 'hidden',
    },
    sideBorderRight: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: BOARD_BORDER,
        flexDirection: 'column',
        overflow: 'hidden',
    },
    sideBorderHalf: {
        flex: 1,
    },
    confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    confirmModal: { width: '100%', maxWidth: 320, borderRadius: 24, padding: 24, alignItems: 'center' },
    confirmTitle: { fontSize: 22, marginTop: 16, marginBottom: 8 },
    confirmText: { fontSize: 14, opacity: 0.7, textAlign: 'center', marginBottom: 24 },
    confirmButtons: { flexDirection: 'row', gap: 12, width: '100%' },
    confirmButton: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
    confirmButtonText: { fontSize: 16 },
});