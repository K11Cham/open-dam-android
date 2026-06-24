import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import AnimatedButton from '../components/ui/AnimatedButton';
import Board, { Highlight, Piece } from '../components/game/Board';

interface Props { onBack: () => void; }
interface Frame { board: (Piece | null)[][]; highlights: Highlight[]; caption?: string; }
interface SubSection { title: string; content: string[]; frames: Frame[]; }
interface Section { id: string; title: string; icon: string; subSections: SubSection[]; }

const { width: SCREEN_W } = Dimensions.get('window');

export default function HelpScreen({ onBack }: Props) {
    const { theme, fontBold, fontRegular } = useTheme();
    const insets = useSafeAreaInsets();
    const [activeSection, setActiveSection] = useState(0);
    const [activeSubSection, setActiveSubSection] = useState(0);
    const [step, setStep] = useState(0);
    const scrollViewRef = useRef<ScrollView>(null);
    const slideAnim = useRef(new Animated.Value(0)).current;

    const sections: Section[] = [
        {
            id: 'intro', title: 'Introduction', icon: 'info',
            subSections: [
                {
                    title: 'Welcome to DAM',
                    content: [
                        'DAM is an elegant two-player strategy board game combining orthogonal movement with unique capture mechanics. Played on a compact grid, DAM offers deep strategic depth despite its simple rules.',
                        'Unlike traditional checkers which uses diagonal movement, DAM uses orthogonal (straight-line) movement — up, down, left, right — creating entirely different tactical possibilities.',
                        'The game features "The Call" mechanic for punishing missed captures, and automatic king promotion when you\'re reduced to your last piece, keeping things exciting until the very end.',
                        'The board size can vary (5×5 up to 9×9), but the rules remain the same across all sizes. Larger boards add more pieces and more complexity.',
                    ],
                    frames: generateWelcomeFrames(),
                },
                {
                    title: 'The Game Board',
                    content: [
                        'DAM is played on a square grid. All squares are playable — there are no dark/light restrictions like in traditional checkers.',
                        'Player 1 starts at the bottom of the board, Player 2 at the top. The center square holds special significance: it is the mandatory destination for Player 1\'s opening placement move.',
                        'The opponent\'s home row is the promotion row. For Player 1 that is row 0 (the top). For Player 2 it is the bottom row. Reaching it with a regular piece promotes it to king.',
                    ],
                    frames: generateBoardFrames(),
                },
                {
                    title: 'The Pieces',
                    content: [
                        'Both players start with equal numbers of pieces arranged in their starting zones, with the center square empty.',
                        'Pieces come in two types: regular pieces and kings. Kings are distinguished by a crown symbol and golden border.',
                        'Regular pieces have restricted movement based on their owner. Player 1\'s pieces move upward (toward row 0); Player 2\'s move downward. Neither can move backward.',
                        'Kings can move in all four orthogonal directions and travel multiple squares in a single move — like a rook in chess.',
                    ],
                    frames: generatePiecesFrames(),
                },
            ],
        },
        {
            id: 'setup', title: 'Getting Started', icon: 'play-arrow',
            subSections: [
                {
                    title: 'Initial Board Setup',
                    content: [
                        'The game begins with a predetermined starting position. Both players\' pieces fill their respective starting zones with the center square left empty.',
                        'On a 5×5 board: Player 1 occupies row 4 (all 5), row 3 (all 5), and row 2 (columns 3 and 4). Player 2 occupies row 0 (all 5), row 1 (all 5), and row 2 (columns 0 and 1). Each player has 12 pieces.',
                        'The center square (row 2, column 2) is deliberately empty — it is the target for Player 1\'s mandatory opening placement.',
                    ],
                    frames: generateSetupFrames(),
                },
                {
                    title: 'The Placement Phase',
                    content: [
                        'Before regular play begins, Player 1 must make a mandatory "placement move": selecting one of their pieces and moving it to the center square.',
                        'This is the only legal action during the placement phase. The game will reject any placement that would leave Player 2 with no legal moves.',
                        'Once the placement is complete, the placement phase ends and Player 2 takes their first regular turn. Normal game rules apply from this point onward.',
                    ],
                    frames: generatePlacementFrames(),
                },
                {
                    title: 'Turn Order & Flow',
                    content: [
                        'Player 1 always goes first (including the placement phase). Turns then alternate throughout the game.',
                        'Tap a piece to select it — valid destinations highlight on the board. Tap a highlighted square to execute the move.',
                        'A turn consists of either one slide move, or one or more captures (if a chain is available). Your turn ends when no further captures are possible from your current piece\'s position.',
                        'If you have no pieces with any legal moves at all, you lose the game.',
                    ],
                    frames: generateTurnFlowFrames(),
                },
            ],
        },
        {
            id: 'movement', title: 'Movement', icon: 'swap-horiz',
            subSections: [
                {
                    title: 'Regular Piece Movement',
                    content: [
                        'Regular pieces can move exactly one square in three directions: forward and sideways (left or right). They cannot move backward.',
                        'For Player 1, "forward" means upward toward row 0. For Player 2, "forward" means downward toward the last row.',
                        'Movement is only allowed to empty squares. If all three potential destinations are occupied or off-board, that piece cannot move at all.',
                    ],
                    frames: generateRegularMovementFrames(),
                },
                {
                    title: 'King Movement',
                    content: [
                        'Kings can move in all four orthogonal directions — forward, backward, left, and right — with no restrictions.',
                        'A king can travel any number of squares in one direction per move, as long as the path is clear. It stops before any piece it encounters.',
                        'This combination of omnidirectional movement and long-range sliding makes kings extremely powerful, especially in open endgame positions.',
                    ],
                    frames: generateKingMovementFrames(),
                },
                {
                    title: 'Slide vs Capture',
                    content: [
                        'On your turn you may either slide a piece (move to an adjacent empty square) or capture an enemy piece by jumping over it.',
                        'You are never forced to capture — but if you slide when a capture was available, your opponent may "Call" the piece that moved and remove it from the board.',
                        'Once you begin a capture and your piece can immediately capture again from its new position, you must continue capturing. You cannot stop a chain mid-way.',
                    ],
                    frames: generateMovementVsCaptureFrames(),
                },
            ],
        },
        {
            id: 'capturing', title: 'Capturing', icon: 'gps-fixed',
            subSections: [
                {
                    title: 'How Captures Work',
                    content: [
                        'To capture, your piece jumps over an adjacent enemy piece in a straight orthogonal line and lands on the empty square immediately beyond it. The captured piece is removed from the board.',
                        'The destination square must be empty for the capture to be legal. You cannot capture if the square beyond the enemy is occupied or off the board.',
                        'Both regular pieces and kings use the same jump mechanic, but movement restrictions apply: regular pieces can only capture in their allowed directions; kings can capture in all four.',
                    ],
                    frames: generateHowCapturesFrames(),
                },
                {
                    title: 'King Capture Mechanics',
                    content: [
                        'A king can capture from any distance — it slides toward an enemy piece from as far away as it likes, as long as the path to the enemy is clear.',
                        'After the jump, a king can land on any empty square beyond the captured piece in the same direction, at any distance.',
                        'This long-range capture ability makes kings devastating in open positions where they can sweep across the board.',
                    ],
                    frames: generateKingCaptureFrames(),
                },
                {
                    title: 'Chain Captures',
                    content: [
                        'After your piece captures, if it can immediately capture again from its new position, you must continue — this is called a chain capture.',
                        'Chain captures are mandatory once started. You cannot stop mid-chain. Your turn continues until no further captures are possible from your piece\'s current position.',
                        'A single piece can potentially capture multiple enemies in one turn. Planning chains ahead of time is one of DAM\'s core tactical skills.',
                    ],
                    frames: generateMultiCaptureFrames(),
                },
            ],
        },
        {
            id: 'promotion', title: 'Kings & Promotion', icon: 'stars',
            subSections: [
                {
                    title: 'Promotion to King',
                    content: [
                        'When a regular piece reaches the opponent\'s home row, it is immediately promoted to a king. This is automatic and cannot be declined.',
                        'Important: if a piece reaches the promotion row during a capture, it promotes immediately and the turn ends. It does not continue capturing as a king — promotion always ends the chain.',
                        'A newly promoted king can exercise its full powers from the next turn onward.',
                    ],
                    frames: generatePromotionFrames(),
                },
                {
                    title: 'Auto-King: Last Piece Standing',
                    content: [
                        'When a player is reduced to exactly one piece, that piece automatically becomes a king regardless of its position on the board.',
                        'This happens immediately when the piece count drops to one — even mid-sequence after a capture removes the second-to-last piece.',
                        'A lone king can still pose a real threat and even mount a comeback. The auto-king rule ensures the game is never completely over until that final piece is captured.',
                    ],
                    frames: generateAutoKingFrames(),
                },
                {
                    title: 'King Strategy',
                    content: [
                        'Kings are your most valuable pieces. Use their superior mobility to control multiple lines of the board simultaneously.',
                        'A king in the center is especially powerful — it threatens all four directions at once. Controlling the center with a king is often a winning strategy.',
                        'Against multiple regular pieces, a careless king can be trapped by coordinated blocking. Keep escape routes in mind when advancing your king.',
                    ],
                    frames: generateKingStrategyFrames(),
                },
            ],
        },
        {
            id: 'call', title: 'The Call', icon: 'record-voice-over',
            subSections: [
                {
                    title: 'Understanding The Call',
                    content: [
                        '"The Call" is DAM\'s enforcement mechanic for missed captures. If your opponent slides a piece when any of their pieces had a capture available, you may call the piece that moved — removing it from the board.',
                        'The Call is not automatic. You choose whether to use it. Sometimes it is strategically better to skip the call and let the position develop.',
                        'Only the specific piece that moved is removed — not every piece that could have captured. Other pieces are unaffected.',
                    ],
                    frames: generateCallUnderstandingFrames(),
                },
                {
                    title: 'When The Call Applies',
                    content: [
                        'A call can be made immediately after your opponent makes a slide move when they had at least one capture available — with any of their pieces, not just the one that moved.',
                        'All pieces that could have captured are highlighted as "offenders." You call the one that actually moved.',
                        'You must call before making your own move. Once you take your turn, the opportunity to call is gone.',
                    ],
                    frames: generateWhenToCallFrames(),
                },
                {
                    title: 'Call Tactics',
                    content: [
                        'The threat of a call is sometimes more valuable than the call itself. Knowing you can call keeps your opponent from freely ignoring captures.',
                        'Consider whether removing the offending piece actually helps your position. If it is badly placed or opens useful lines for your opponent, you may choose not to call.',
                        'Advanced players set up "trap calls" — positions where any capture leads to a worse outcome, forcing the opponent to choose between losing material to a capture or losing it to a call.',
                    ],
                    frames: generateCallTacticsFrames(),
                },
            ],
        },
        {
            id: 'softlock', title: 'Softlock Rule', icon: 'block',
            subSections: [
                {
                    title: 'What is a Softlock?',
                    content: [
                        'A "softlock" is when a player makes a move that leaves their opponent with absolutely no legal moves. In DAM, creating a softlock is forbidden.',
                        'This rule exists because being unable to move while still having pieces is not a legal win condition in DAM. You must capture all enemy pieces to win — you cannot simply block them.',
                        'The game engine validates every move and automatically prevents any move that would softlock the opponent.',
                    ],
                    frames: generateSoftlockFrames(),
                },
            ],
        },
        {
            id: 'winning', title: 'Winning', icon: 'emoji-events',
            subSections: [
                {
                    title: 'Victory & Draw Conditions',
                    content: [
                        'You win by capturing all of your opponent\'s pieces. There is no other win condition — you cannot win simply by blocking an opponent who still has pieces.',
                        'A draw occurs when both players are reduced to a single piece and neither piece has a capture available and no call is pending. In that state, neither player can eliminate the other.',
                        'If a call removes a player\'s last piece, or a capture does, the other player wins immediately — even from a drawn-looking position.',
                    ],
                    frames: generateVictoryFrames(),
                },
                {
                    title: 'Endgame Strategy',
                    content: [
                        'In endgames with few pieces, kings dominate. A king\'s mobility advantage is maximized when there are fewer obstacles blocking long-distance moves.',
                        'When ahead in material, simplify: trade pieces, reduce the board, and convert your advantage. Fewer pieces means fewer opportunities for your opponent to find tactics.',
                        'When behind, complicate: avoid trades, keep pieces on the board, and look for a call opportunity or a chain capture that can swing the game.',
                        'The auto-king rule means you are never completely out of the game until your very last piece is taken. A lone king has won many games.',
                    ],
                    frames: generateEndgameFrames(),
                },
            ],
        },
        {
            id: 'ui', title: 'Interface', icon: 'touch-app',
            subSections: [
                {
                    title: 'Selecting & Moving',
                    content: [
                        'Tap a piece to select it. Valid slide destinations appear highlighted in yellow. Valid capture destinations appear in red/coral. Tap a highlighted square to move.',
                        'To change your selection, tap a different piece. To deselect, tap an empty non-highlighted square.',
                        'During a chain capture, your piece stays selected automatically. Keep tapping highlighted capture squares until the chain ends and your turn completes.',
                    ],
                    frames: generateSelectMoveFrames(),
                },
                {
                    title: 'Visual Indicators',
                    content: [
                        'A golden border and crown on a piece means it is a king.',
                        'After your opponent slides when a capture was available, the offending piece is highlighted in red. This signals you may call it.',
                        'The current turn is always shown. Your pieces are interactive only on your turn — the opponent\'s pieces cannot be tapped while waiting.',
                    ],
                    frames: generateVisualIndicatorsFrames(),
                },
                {
                    title: 'Undo & Saving',
                    content: [
                        'You can request an undo during your turn. In a two-player game, the opponent must accept. Against the AI, undo is accepted automatically.',
                        'Only one undo is available per turn. You cannot undo during a chain capture.',
                        'Games are saved automatically after every move. Close and reopen the app to continue from exactly where you left off.',
                    ],
                    frames: generateGameManagementFrames(),
                },
            ],
        },
    ];

    const currentSection = sections[activeSection];
    const currentSubSection = currentSection.subSections[activeSubSection];
    const currentFrame = currentSubSection.frames[step] ?? currentSubSection.frames[0];

    // Reset step when subsection changes
    useEffect(() => {
        setStep(0);
    }, [activeSection, activeSubSection]);

    // Plain interval — no animation on board, just swap state
    useEffect(() => {
        if (currentSubSection.frames.length <= 1) return;
        const id = setInterval(() => {
            setStep(prev => (prev + 1) % currentSubSection.frames.length);
        }, 2000);
        return () => clearInterval(id);
    }, [activeSection, activeSubSection, currentSubSection.frames.length]);

    // Directional slide for section/subsection transitions
    const animateToSection = (s: number, ss: number, dir: 'forward' | 'back') => {
        const outX = dir === 'forward' ? -SCREEN_W : SCREEN_W;
        const inX  = dir === 'forward' ?  SCREEN_W : -SCREEN_W;
        Animated.timing(slideAnim, { toValue: outX, duration: 200, useNativeDriver: true }).start(() => {
            slideAnim.setValue(inX);
            setActiveSection(s);
            setActiveSubSection(ss);
            scrollViewRef.current?.scrollTo({ y: 0, animated: false });
            Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start();
        });
    };

    const navigateSection = (dir: 'prev' | 'next') => {
        if (dir === 'prev') {
            if (activeSubSection > 0) animateToSection(activeSection, activeSubSection - 1, 'back');
            else if (activeSection > 0) animateToSection(activeSection - 1, sections[activeSection - 1].subSections.length - 1, 'back');
        } else {
            if (activeSubSection < currentSection.subSections.length - 1) animateToSection(activeSection, activeSubSection + 1, 'forward');
            else if (activeSection < sections.length - 1) animateToSection(activeSection + 1, 0, 'forward');
        }
    };

    const isFirst = activeSection === 0 && activeSubSection === 0;
    const isLast  = activeSection === sections.length - 1 && activeSubSection === currentSection.subSections.length - 1;

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <View style={{ height: insets.top, backgroundColor: theme.bg }} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.highlight + '40' }]}>
                <AnimatedButton onPress={onBack} style={styles.iconBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={theme.text} />
                </AnimatedButton>
                <View style={styles.headerCenter}>
                    <Text style={[styles.headerTitle, { color: theme.text, fontFamily: fontBold }]}>
                        {currentSection.title}
                    </Text>
                    <Text style={[styles.headerSub, { color: theme.text, opacity: 0.55, fontFamily: fontRegular }]}>
                        {currentSubSection.title}
                    </Text>
                </View>
                <View style={[styles.progressBadge, { backgroundColor: theme.highlight + '22' }]}>
                    <Text style={[styles.progressText, { color: theme.highlight, fontFamily: fontBold }]}>
                        {activeSection + 1}/{sections.length}
                    </Text>
                </View>
            </View>

            {/* Sliding content */}
            <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
                <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* Section banner */}
                    <View style={[styles.sectionBanner, { backgroundColor: theme.p1 }]}>
                        <View style={styles.bannerIconWrap}>
                            <MaterialIcons name={currentSection.icon as any} size={20} color="rgba(255,255,255,0.85)" />
                        </View>
                        <View style={styles.bannerText}>
                            <Text style={[styles.bannerLabel, { fontFamily: fontBold }]}>
                                {currentSection.title.toUpperCase()}
                            </Text>
                            <Text style={[styles.bannerSub, { fontFamily: fontBold }]}>
                                {currentSubSection.title}
                            </Text>
                        </View>
                        <View style={styles.bannerBadge}>
                            <Text style={[styles.bannerCount, { fontFamily: fontBold }]}>
                                {activeSubSection + 1}/{currentSection.subSections.length}
                            </Text>
                        </View>
                    </View>

                    {/* Content paragraphs */}
                    <View style={styles.contentContainer}>
                        {currentSubSection.content.map((para, i) => (
                            <View key={i} style={styles.paragraphRow}>
                                <View style={[styles.paragraphDot, { backgroundColor: theme.highlight }]} />
                                <Text style={[styles.paragraph, { color: theme.text, fontFamily: fontRegular }]}>
                                    {para}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Demo board — plain swap, no animation */}
                    {currentSubSection.frames.length > 0 && (
                        <View style={styles.demoOuter}>
                            <View style={[styles.demoCard, { backgroundColor: theme.board + 'cc', borderColor: theme.highlight + '30' }]}>
                                <Board
                                    board={currentFrame.board}
                                    selected={null}
                                    offenders={[]}
                                    highlights={currentFrame.highlights}
                                    onPress={() => {}}
                                    theme={theme}
                                    fontBold={fontBold}
                                />
                                {currentFrame.caption && (
                                    <View style={[styles.captionRow, { borderTopColor: theme.highlight + '25' }]}>
                                        <MaterialIcons name="info-outline" size={13} color={theme.highlight} style={{ marginTop: 1 }} />
                                        <Text style={[styles.caption, { color: theme.text, fontFamily: fontRegular }]}>
                                            {currentFrame.caption}
                                        </Text>
                                    </View>
                                )}
                                {currentSubSection.frames.length > 1 && (
                                    <View style={styles.stepIndicator}>
                                        {currentSubSection.frames.map((_, i) => (
                                            <View key={i} style={[styles.stepDot, {
                                                backgroundColor: i === step ? theme.highlight : theme.highlight + '30',
                                                width: i === step ? 16 : 6,
                                            }]} />
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>
                    )}
                </ScrollView>
            </Animated.View>

            {/* Bottom nav */}
            <View style={[styles.bottomBar, { backgroundColor: theme.board, borderTopColor: theme.highlight + '30' }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContainer}>
                    {sections.map((section, sIndex) => {
                        const active = activeSection === sIndex;
                        return (
                            <TouchableOpacity
                                key={section.id}
                                onPress={() => {
                                    if (sIndex === activeSection) return;
                                    animateToSection(sIndex, 0, sIndex > activeSection ? 'forward' : 'back');
                                }}
                                style={[styles.pill, { backgroundColor: active ? theme.p1 : theme.cell, borderColor: active ? theme.p1 : 'transparent' }]}
                                activeOpacity={0.7}
                            >
                                <MaterialIcons name={section.icon as any} size={14} color={active ? '#fff' : theme.text} />
                                {active && <Text style={[styles.pillText, { color: '#fff', fontFamily: fontBold }]}>{section.title}</Text>}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <View style={[styles.navRow, { paddingBottom: insets.bottom || 12 }]}>
                    <TouchableOpacity onPress={() => navigateSection('prev')} disabled={isFirst}
                        style={[styles.navBtn, { backgroundColor: theme.highlight + '18', opacity: isFirst ? 0.3 : 1 }]} activeOpacity={0.7}>
                        <MaterialIcons name="chevron-left" size={22} color={theme.text} />
                        <Text style={[styles.navBtnText, { color: theme.text, fontFamily: fontBold }]}>Prev</Text>
                    </TouchableOpacity>

                    <View style={styles.subDots}>
                        {currentSection.subSections.map((_, i) => (
                            <TouchableOpacity
                                key={i}
                                onPress={() => animateToSection(activeSection, i, i > activeSubSection ? 'forward' : 'back')}
                                style={[styles.subDot, {
                                    backgroundColor: i === activeSubSection ? theme.highlight : theme.highlight + '30',
                                    width: i === activeSubSection ? 20 : 7,
                                }]}
                            />
                        ))}
                    </View>

                    <TouchableOpacity onPress={() => navigateSection('next')} disabled={isLast}
                        style={[styles.navBtn, { backgroundColor: theme.highlight + '18', opacity: isLast ? 0.3 : 1 }]} activeOpacity={0.7}>
                        <Text style={[styles.navBtnText, { color: theme.text, fontFamily: fontBold }]}>Next</Text>
                        <MaterialIcons name="chevron-right" size={22} color={theme.text} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

// ─── FRAME GENERATORS ────────────────────────────────────────────────────────

const createBoard = () => Array(5).fill(null).map(() => Array(5).fill(null)) as (Piece | null)[][];

function fullStart(): (Piece | null)[][] {
    const b = createBoard();
    for (let c = 0; c < 5; c++) {
        b[0][c] = { player: 2, isKing: false };
        b[1][c] = { player: 2, isKing: false };
        b[4][c] = { player: 1, isKing: false };
        b[3][c] = { player: 1, isKing: false };
    }
    b[2][0] = { player: 2, isKing: false };
    b[2][1] = { player: 2, isKing: false };
    b[2][3] = { player: 1, isKing: false };
    b[2][4] = { player: 1, isKing: false };
    return b;
}

function generateWelcomeFrames(): Frame[] {
    return [{ board: fullStart(), highlights: [], caption: 'Starting position on a 5×5 board' }];
}

function generateBoardFrames(): Frame[] {
    return [{
        board: createBoard(),
        highlights: [
            { row: 2, col: 2, type: 'promote' },
            ...[0,1,2,3,4].map(c => ({ row: 0, col: c, type: 'danger' as const })),
            ...[0,1,2,3,4].map(c => ({ row: 4, col: c, type: 'valid' as const })),
        ],
        caption: 'Green = P1\'s promotion row | Red = P2\'s | Gold = center (placement target)',
    }];
}

function generatePiecesFrames(): Frame[] {
    const b1 = createBoard();
    b1[2][1] = { player: 1, isKing: false };
    b1[2][3] = { player: 2, isKing: false };

    const b2 = createBoard();
    b2[2][1] = { player: 1, isKing: true };
    b2[2][3] = { player: 2, isKing: true };

    return [
        { board: b1, highlights: [], caption: 'Regular pieces — restricted forward movement' },
        { board: b2, highlights: [], caption: 'Kings — crown icon, move any direction any distance' },
    ];
}

function generateSetupFrames(): Frame[] {
    return [{ board: fullStart(), highlights: [{ row: 2, col: 2, type: 'promote' }], caption: 'Center square empty — awaiting Player 1\'s placement move' }];
}

function generatePlacementFrames(): Frame[] {
    const b1 = fullStart();

    const b2 = fullStart();
    b2[2][2] = { player: 1, isKing: false };
    b2[2][3] = null;

    const b3 = fullStart();
    b3[2][2] = { player: 1, isKing: false };
    b3[2][4] = null;

    return [
        { board: b1, highlights: [{ row: 2, col: 3, type: 'selected' }, { row: 2, col: 2, type: 'valid' }], caption: 'Step 1 — select any P1 piece, tap the center square' },
        { board: b2, highlights: [{ row: 2, col: 2, type: 'selected' }], caption: 'Step 2 — piece now at center, placement phase ends' },
        { board: b3, highlights: [{ row: 2, col: 2, type: 'selected' }], caption: 'Any P1 piece may fill the center — your choice is strategic' },
    ];
}

function generateTurnFlowFrames(): Frame[] {
    const b1 = createBoard();
    b1[3][2] = { player: 1, isKing: false };
    b1[1][2] = { player: 2, isKing: false };
    b1[3][0] = { player: 1, isKing: false };

    const b2 = createBoard();
    b2[2][2] = { player: 1, isKing: false };
    b2[1][2] = { player: 2, isKing: false };
    b2[3][0] = { player: 1, isKing: false };

    const b3 = createBoard();
    b3[2][2] = { player: 1, isKing: false };
    b3[0][2] = { player: 2, isKing: false };
    b3[3][0] = { player: 1, isKing: false };

    return [
        { board: b1, highlights: [{ row: 3, col: 2, type: 'selected' }, { row: 2, col: 2, type: 'valid' }, { row: 3, col: 1, type: 'valid' }, { row: 3, col: 3, type: 'valid' }], caption: 'P1\'s turn — select a piece, valid moves highlight' },
        { board: b2, highlights: [{ row: 2, col: 2, type: 'selected' }], caption: 'P1 moves up — turn ends, now P2\'s turn' },
        { board: b3, highlights: [{ row: 0, col: 2, type: 'selected' }], caption: 'P2 responds — turns alternate until the game ends' },
    ];
}

function generateRegularMovementFrames(): Frame[] {
    const b1 = createBoard();
    b1[3][2] = { player: 1, isKing: false };

    const b2 = createBoard();
    b2[1][2] = { player: 2, isKing: false };

    const b3 = createBoard();
    b3[3][2] = { player: 1, isKing: false };
    b3[2][2] = { player: 2, isKing: false };
    b3[3][1] = { player: 1, isKing: false };

    const b4 = createBoard();
    b4[3][2] = { player: 1, isKing: false };
    b4[2][2] = { player: 2, isKing: false };
    b4[3][1] = { player: 1, isKing: false };
    b4[3][3] = { player: 1, isKing: false };

    return [
        { board: b1, highlights: [{ row: 3, col: 2, type: 'selected' }, { row: 2, col: 2, type: 'valid' }, { row: 3, col: 1, type: 'valid' }, { row: 3, col: 3, type: 'valid' }], caption: 'P1 regular piece: UP, LEFT, or RIGHT — three possible directions' },
        { board: b2, highlights: [{ row: 1, col: 2, type: 'selected' }, { row: 2, col: 2, type: 'valid' }, { row: 1, col: 1, type: 'valid' }, { row: 1, col: 3, type: 'valid' }], caption: 'P2 regular piece: DOWN, LEFT, or RIGHT' },
        { board: b3, highlights: [{ row: 3, col: 2, type: 'selected' }, { row: 3, col: 3, type: 'valid' }], caption: 'Blocked above and left — only one move available' },
        { board: b4, highlights: [{ row: 3, col: 2, type: 'selected' }], caption: 'Fully surrounded — this piece cannot move at all this turn' },
    ];
}

function generateKingMovementFrames(): Frame[] {
    const b1 = createBoard();
    b1[2][2] = { player: 1, isKing: true };

    const b2 = createBoard();
    b2[2][2] = { player: 1, isKing: true };
    b2[0][2] = { player: 2, isKing: false };
    b2[2][4] = { player: 1, isKing: false };

    const b3 = createBoard();
    b3[4][0] = { player: 1, isKing: true };

    const b4 = createBoard();
    b4[0][4] = { player: 1, isKing: true };

    return [
        {
            board: b1,
            highlights: [
                { row: 2, col: 2, type: 'selected' },
                { row: 1, col: 2, type: 'valid' }, { row: 0, col: 2, type: 'valid' },
                { row: 3, col: 2, type: 'valid' }, { row: 4, col: 2, type: 'valid' },
                { row: 2, col: 1, type: 'valid' }, { row: 2, col: 0, type: 'valid' },
                { row: 2, col: 3, type: 'valid' }, { row: 2, col: 4, type: 'valid' },
            ],
            caption: 'King in center: all 4 directions, any distance — full cross of squares reachable',
        },
        {
            board: b2,
            highlights: [
                { row: 2, col: 2, type: 'selected' },
                { row: 3, col: 2, type: 'valid' }, { row: 4, col: 2, type: 'valid' },
                { row: 2, col: 1, type: 'valid' }, { row: 2, col: 0, type: 'valid' },
                { row: 2, col: 3, type: 'valid' },
            ],
            caption: 'Blocked UP by an enemy, blocked RIGHT by own piece — path cuts off before them',
        },
        {
            board: b3,
            highlights: [
                { row: 4, col: 0, type: 'selected' },
                { row: 3, col: 0, type: 'valid' }, { row: 2, col: 0, type: 'valid' }, { row: 1, col: 0, type: 'valid' }, { row: 0, col: 0, type: 'valid' },
                { row: 4, col: 1, type: 'valid' }, { row: 4, col: 2, type: 'valid' }, { row: 4, col: 3, type: 'valid' }, { row: 4, col: 4, type: 'valid' },
            ],
            caption: 'King in corner: still controls the entire column and row from here',
        },
        {
            board: b4,
            highlights: [{ row: 0, col: 4, type: 'selected' }],
            caption: 'Same king moved to the opposite corner in one move — long-range is the key advantage',
        },
    ];
}

function generateMovementVsCaptureFrames(): Frame[] {
    const b1 = createBoard();
    b1[3][2] = { player: 1, isKing: false };

    const b2 = createBoard();
    b2[3][2] = { player: 1, isKing: false };
    b2[2][2] = { player: 2, isKing: false };

    const b3 = createBoard();
    b3[3][3] = { player: 1, isKing: false };
    b3[2][2] = { player: 2, isKing: false };

    return [
        { board: b1, highlights: [{ row: 3, col: 2, type: 'selected' }, { row: 2, col: 2, type: 'valid' }, { row: 3, col: 1, type: 'valid' }, { row: 3, col: 3, type: 'valid' }], caption: 'No enemy nearby — only slide moves available' },
        { board: b2, highlights: [{ row: 3, col: 2, type: 'selected' }, { row: 1, col: 2, type: 'capture' }, { row: 3, col: 1, type: 'valid' }, { row: 3, col: 3, type: 'valid' }], caption: 'Enemy in range — capture (red) AND slide (yellow) both available. Sliding risks a Call!' },
        { board: b3, highlights: [{ row: 3, col: 3, type: 'danger' }], caption: 'P1 slid right instead of capturing — piece highlighted as offender. P2 may Call.' },
    ];
}

function generateHowCapturesFrames(): Frame[] {
    const b1 = createBoard();
    b1[3][2] = { player: 1, isKing: false };
    b1[2][2] = { player: 2, isKing: false };

    const b2 = createBoard();
    b2[1][2] = { player: 1, isKing: false };

    const b3 = createBoard();
    b3[2][1] = { player: 1, isKing: false };
    b3[2][2] = { player: 2, isKing: false };

    const b4 = createBoard();
    b4[2][3] = { player: 1, isKing: false };

    const b5 = createBoard();
    b5[3][2] = { player: 1, isKing: false };
    b5[2][2] = { player: 2, isKing: false };
    b5[2][3] = { player: 1, isKing: false };

    return [
        { board: b1, highlights: [{ row: 3, col: 2, type: 'selected' }, { row: 2, col: 2, type: 'danger' }, { row: 1, col: 2, type: 'capture' }], caption: 'Jump over the enemy — must land on the empty square directly beyond' },
        { board: b2, highlights: [{ row: 1, col: 2, type: 'selected' }], caption: 'Enemy removed from board, capturing piece now at (1,2)' },
        { board: b3, highlights: [{ row: 2, col: 1, type: 'selected' }, { row: 2, col: 2, type: 'danger' }, { row: 2, col: 3, type: 'capture' }], caption: 'Horizontal capture — same jump mechanic left or right' },
        { board: b4, highlights: [{ row: 2, col: 3, type: 'selected' }], caption: 'Enemy removed, piece lands at (2,3)' },
        { board: b5, highlights: [{ row: 3, col: 2, type: 'selected' }, { row: 2, col: 2, type: 'danger' }], caption: 'Cannot capture — landing square (1,2) is blocked by own piece at (2,3)' },
    ];
}

function generateKingCaptureFrames(): Frame[] {
    const b1 = createBoard();
    b1[4][2] = { player: 1, isKing: true };
    b1[2][2] = { player: 2, isKing: false };

    const b2 = createBoard();
    b2[0][2] = { player: 1, isKing: true };

    const b3 = createBoard();
    b3[2][0] = { player: 1, isKing: true };
    b3[2][2] = { player: 2, isKing: false };

    const b4 = createBoard();
    b4[2][4] = { player: 1, isKing: true };

    const b5 = createBoard();
    b5[4][2] = { player: 1, isKing: true };
    b5[2][2] = { player: 2, isKing: false };
    b5[1][2] = { player: 2, isKing: false };

    return [
        { board: b1, highlights: [{ row: 4, col: 2, type: 'selected' }, { row: 2, col: 2, type: 'danger' }, { row: 1, col: 2, type: 'capture' }, { row: 0, col: 2, type: 'capture' }], caption: 'King at (4,2) jumps the enemy and can land at (1,2) or (0,2) — choice is yours' },
        { board: b2, highlights: [{ row: 0, col: 2, type: 'selected' }], caption: 'Chose (0,2) — king crossed the whole board, lands on promotion row' },
        { board: b3, highlights: [{ row: 2, col: 0, type: 'selected' }, { row: 2, col: 2, type: 'danger' }, { row: 2, col: 3, type: 'capture' }, { row: 2, col: 4, type: 'capture' }], caption: 'Horizontal king capture — any empty square beyond the jumped piece' },
        { board: b4, highlights: [{ row: 2, col: 4, type: 'selected' }], caption: 'Chose edge square (2,4) — good for controlling that side' },
        { board: b5, highlights: [{ row: 4, col: 2, type: 'selected' }, { row: 2, col: 2, type: 'danger' }], caption: 'King cannot jump two enemies in one direction — second enemy blocks the landing squares' },
    ];
}

function generateMultiCaptureFrames(): Frame[] {
    const b1 = createBoard();
    b1[3][2] = { player: 1, isKing: false };
    b1[2][2] = { player: 2, isKing: false };
    b1[0][2] = { player: 2, isKing: false };

    const b2 = createBoard();
    b2[1][2] = { player: 1, isKing: false };
    b2[0][2] = { player: 2, isKing: false };

    const b3 = createBoard();
    b3[1][2] = { player: 1, isKing: false };

    const b4 = createBoard();
    b4[3][2] = { player: 1, isKing: false };
    b4[2][2] = { player: 2, isKing: false };
    b4[1][1] = { player: 2, isKing: false };

    const b5 = createBoard();
    b5[1][2] = { player: 1, isKing: false };
    b5[1][1] = { player: 2, isKing: false };

    const b6 = createBoard();
    b6[1][0] = { player: 1, isKing: false };

    return [
        { board: b1, highlights: [{ row: 3, col: 2, type: 'selected' }, { row: 2, col: 2, type: 'danger' }, { row: 1, col: 2, type: 'capture' }], caption: 'First jump available — but another enemy waits beyond' },
        { board: b2, highlights: [{ row: 1, col: 2, type: 'selected' }, { row: 0, col: 2, type: 'danger' }], caption: 'First capture done — must continue! Another enemy is in range' },
        { board: b3, highlights: [{ row: 1, col: 2, type: 'selected' }], caption: 'No more captures — turn ends. Two pieces taken in one turn!' },
        { board: b4, highlights: [{ row: 3, col: 2, type: 'selected' }, { row: 2, col: 2, type: 'danger' }, { row: 1, col: 2, type: 'capture' }], caption: 'L-shaped chain — first capture goes upward' },
        { board: b5, highlights: [{ row: 1, col: 2, type: 'selected' }, { row: 1, col: 1, type: 'danger' }, { row: 1, col: 0, type: 'capture' }], caption: 'Now capture turns left — chains can change direction mid-sequence' },
        { board: b6, highlights: [{ row: 1, col: 0, type: 'selected' }], caption: 'Chain complete at (1,0) — two pieces captured, two directions, one turn' },
    ];
}

function generatePromotionFrames(): Frame[] {
    const b1 = createBoard();
    b1[1][2] = { player: 1, isKing: false };
    b1[2][0] = { player: 2, isKing: false };

    const b2 = createBoard();
    b2[0][2] = { player: 1, isKing: true };
    b2[2][0] = { player: 2, isKing: false };

    const b3 = createBoard();
    b3[1][3] = { player: 1, isKing: false };
    b3[0][3] = { player: 2, isKing: false };

    const b4 = createBoard();
    b4[0][3] = { player: 1, isKing: true };

    return [
        { board: b1, highlights: [{ row: 1, col: 2, type: 'selected' }, { row: 0, col: 2, type: 'promote' }], caption: 'One step from row 0 — next move promotes this piece' },
        { board: b2, highlights: [{ row: 0, col: 2, type: 'selected' }], caption: 'KING! Crown appears immediately — full power from next turn' },
        { board: b3, highlights: [{ row: 1, col: 3, type: 'selected' }, { row: 0, col: 3, type: 'capture' }], caption: 'Capturing onto the promotion row also crowns the piece...' },
        { board: b4, highlights: [{ row: 0, col: 3, type: 'selected' }], caption: '...but the turn ends immediately. No chain continues as king this turn.' },
    ];
}

function generateAutoKingFrames(): Frame[] {
    const b1 = createBoard();
    b1[2][2] = { player: 1, isKing: false };
    b1[1][2] = { player: 2, isKing: false };
    b1[3][3] = { player: 2, isKing: false };

    const b2 = createBoard();
    b2[0][2] = { player: 1, isKing: false };
    b2[3][3] = { player: 2, isKing: true };

    const b3 = createBoard();
    b3[0][2] = { player: 1, isKing: false };
    b3[3][3] = { player: 2, isKing: true };

    return [
        { board: b1, highlights: [{ row: 2, col: 2, type: 'selected' }, { row: 1, col: 2, type: 'danger' }, { row: 0, col: 2, type: 'capture' }], caption: 'P1 captures — this removes P2\'s second-to-last piece' },
        { board: b2, highlights: [{ row: 3, col: 3, type: 'promote' }], caption: 'Immediately: P2\'s lone piece auto-crowns wherever it stands — no move needed' },
        {
            board: b3,
            highlights: [
                { row: 3, col: 3, type: 'selected' },
                { row: 2, col: 3, type: 'valid' }, { row: 1, col: 3, type: 'valid' }, { row: 0, col: 3, type: 'valid' },
                { row: 4, col: 3, type: 'valid' },
                { row: 3, col: 2, type: 'valid' }, { row: 3, col: 1, type: 'valid' }, { row: 3, col: 0, type: 'valid' },
                { row: 3, col: 4, type: 'valid' },
            ],
            caption: 'P2\'s auto-king now commands 8 squares — the comeback is real',
        },
    ];
}

function generateKingStrategyFrames(): Frame[] {
    const b1 = createBoard();
    b1[2][2] = { player: 1, isKing: true };
    b1[4][0] = { player: 2, isKing: false };
    b1[4][4] = { player: 2, isKing: false };
    b1[0][1] = { player: 2, isKing: false };

    const b2 = createBoard();
    b2[2][0] = { player: 1, isKing: true };
    b2[2][4] = { player: 1, isKing: true };
    b2[4][2] = { player: 2, isKing: false };
    b2[0][2] = { player: 2, isKing: false };

    const b3 = createBoard();
    b3[0][0] = { player: 2, isKing: false };
    b3[0][4] = { player: 2, isKing: false };
    b3[4][4] = { player: 2, isKing: false };
    b3[2][2] = { player: 1, isKing: true };

    return [
        { board: b1, highlights: [{ row: 2, col: 2, type: 'selected' }, { row: 0, col: 2, type: 'valid' }, { row: 4, col: 2, type: 'valid' }, { row: 2, col: 0, type: 'valid' }, { row: 2, col: 4, type: 'valid' }], caption: 'King in center — threatens every direction simultaneously' },
        { board: b2, highlights: [{ row: 2, col: 0, type: 'selected' }, { row: 2, col: 1, type: 'valid' }, { row: 2, col: 2, type: 'valid' }, { row: 2, col: 3, type: 'valid' }], caption: 'Two kings on same row create a wall — P2 cannot safely cross' },
        { board: b3, highlights: [{ row: 2, col: 2, type: 'selected' }, { row: 4, col: 4, type: 'capture' }], caption: '1 king vs 3 pieces — use long-range to pick them off one by one' },
    ];
}

function generateCallUnderstandingFrames(): Frame[] {
    const b1 = createBoard();
    b1[3][2] = { player: 1, isKing: false };
    b1[2][2] = { player: 2, isKing: false };
    b1[1][0] = { player: 2, isKing: false };

    const b2 = createBoard();
    b2[3][3] = { player: 1, isKing: false };
    b2[2][2] = { player: 2, isKing: false };
    b2[1][0] = { player: 2, isKing: false };

    const b3 = createBoard();
    b3[2][2] = { player: 2, isKing: false };
    b3[1][0] = { player: 2, isKing: false };

    return [
        { board: b1, highlights: [{ row: 3, col: 2, type: 'selected' }, { row: 2, col: 2, type: 'danger' }, { row: 1, col: 2, type: 'capture' }], caption: 'P1 has a legal capture available with this piece...' },
        { board: b2, highlights: [{ row: 3, col: 3, type: 'danger' }], caption: 'P1 slides right instead — offending piece highlighted red. P2 may now Call.' },
        { board: b3, highlights: [], caption: 'P2 calls! P1\'s offending piece is removed. P2\'s pieces are untouched.' },
    ];
}

function generateWhenToCallFrames(): Frame[] {
    const b1 = createBoard();
    b1[3][2] = { player: 1, isKing: false };
    b1[3][0] = { player: 1, isKing: false };
    b1[2][2] = { player: 2, isKing: false };
    b1[2][0] = { player: 2, isKing: false };

    const b2 = createBoard();
    b2[3][4] = { player: 1, isKing: false };
    b2[3][0] = { player: 1, isKing: false };
    b2[2][2] = { player: 2, isKing: false };
    b2[2][0] = { player: 2, isKing: false };

    const b3 = createBoard();
    b3[3][4] = { player: 1, isKing: false };
    b3[2][2] = { player: 2, isKing: false };

    return [
        { board: b1, highlights: [{ row: 3, col: 2, type: 'danger' }, { row: 3, col: 0, type: 'danger' }], caption: 'Both P1 pieces have captures available — both become offenders if P1 slides' },
        { board: b2, highlights: [{ row: 3, col: 4, type: 'danger' }, { row: 3, col: 0, type: 'danger' }], caption: 'P1 slid to the right — both pieces are still highlighted as offenders' },
        { board: b3, highlights: [], caption: 'P2 calls the piece that moved — only that one is removed, the other stays' },
    ];
}

function generateCallTacticsFrames(): Frame[] {
    const b1 = createBoard();
    b1[3][2] = { player: 1, isKing: false };
    b1[2][2] = { player: 2, isKing: false };
    b1[0][2] = { player: 2, isKing: true };

    const b2 = createBoard();
    b2[3][3] = { player: 1, isKing: false };
    b2[2][2] = { player: 2, isKing: false };
    b2[0][2] = { player: 2, isKing: true };

    const b3 = createBoard();
    b3[1][2] = { player: 1, isKing: false };
    b3[0][2] = { player: 2, isKing: true };

    return [
        { board: b1, highlights: [{ row: 3, col: 2, type: 'selected' }, { row: 2, col: 2, type: 'danger' }, { row: 1, col: 2, type: 'capture' }], caption: 'P1 can capture — but lands adjacent to a dangerous king' },
        { board: b2, highlights: [{ row: 3, col: 3, type: 'danger' }], caption: 'P1 slides instead — risks a call, but avoids walking into the king\'s range' },
        { board: b3, highlights: [{ row: 0, col: 2, type: 'selected' }, { row: 1, col: 2, type: 'danger' }], caption: 'If P1 had captured, the king recaptures immediately. Sometimes NOT capturing is correct.' },
    ];
}

function generateSoftlockFrames(): Frame[] {
    const b1 = createBoard();
    b1[1][1] = { player: 1, isKing: false };
    b1[1][3] = { player: 1, isKing: false };
    b1[0][2] = { player: 2, isKing: false };

    const b2 = createBoard();
    b2[0][1] = { player: 1, isKing: false };
    b2[0][3] = { player: 1, isKing: false };
    b2[1][2] = { player: 1, isKing: false };
    b2[0][2] = { player: 2, isKing: false };

    const b3 = createBoard();
    b3[0][1] = { player: 1, isKing: false };
    b3[0][3] = { player: 1, isKing: false };
    b3[2][2] = { player: 1, isKing: false };
    b3[0][2] = { player: 2, isKing: false };

    return [
        { board: b1, highlights: [{ row: 1, col: 1, type: 'selected' }, { row: 0, col: 1, type: 'valid' }], caption: 'P1 considers moving up and surrounding P2\'s piece...' },
        { board: b2, highlights: [{ row: 0, col: 2, type: 'danger' }], caption: 'Illegal! P2\'s piece now has zero legal moves — this is a softlock, the game blocks it' },
        { board: b3, highlights: [{ row: 0, col: 2, type: 'selected' }, { row: 0, col: 1, type: 'valid' }, { row: 0, col: 3, type: 'valid' }], caption: 'Legal position — P2 can still move left or right. Block is fine, total freeze is not.' },
    ];
}

function generateVictoryFrames(): Frame[] {
    const b1 = createBoard();
    b1[2][2] = { player: 1, isKing: true };
    b1[4][0] = { player: 2, isKing: false };

    const b2 = createBoard();
    b2[2][2] = { player: 1, isKing: true };

    const b3 = createBoard();
    b3[0][0] = { player: 1, isKing: true };
    b3[4][4] = { player: 2, isKing: true };

    return [
        { board: b1, highlights: [{ row: 2, col: 2, type: 'selected' }, { row: 4, col: 0, type: 'danger' }], caption: 'P1 king about to capture P2\'s last piece' },
        { board: b2, highlights: [{ row: 2, col: 2, type: 'promote' }], caption: 'VICTORY — all enemy pieces captured!' },
        { board: b3, highlights: [{ row: 0, col: 0, type: 'valid' }, { row: 4, col: 4, type: 'valid' }], caption: 'DRAW — both have one piece, no capture is possible for either side' },
    ];
}

function generateEndgameFrames(): Frame[] {
    const b1 = createBoard();
    b1[2][2] = { player: 1, isKing: true };
    b1[0][0] = { player: 2, isKing: false };
    b1[0][4] = { player: 2, isKing: false };
    b1[4][2] = { player: 2, isKing: false };

    const b2 = createBoard();
    b2[0][0] = { player: 1, isKing: true };
    b2[0][4] = { player: 2, isKing: false };
    b2[4][2] = { player: 2, isKing: false };

    const b3 = createBoard();
    b3[0][4] = { player: 2, isKing: false };
    b3[4][2] = { player: 2, isKing: false };
    b3[0][0] = { player: 1, isKing: true };

    return [
        { board: b1, highlights: [{ row: 2, col: 2, type: 'selected' }, { row: 4, col: 2, type: 'capture' }, { row: 0, col: 2, type: 'valid' }], caption: 'King vs 3 — pick the right target. Capture the bottom piece to simplify.' },
        { board: b2, highlights: [{ row: 0, col: 0, type: 'selected' }, { row: 0, col: 1, type: 'valid' }, { row: 0, col: 2, type: 'valid' }, { row: 0, col: 3, type: 'valid' }, { row: 0, col: 4, type: 'capture' }], caption: 'One down — slide along row 0 to threaten the next enemy' },
        { board: b3, highlights: [{ row: 0, col: 0, type: 'selected' }], caption: 'King closed in — methodical play with 1 king can beat 2+ regular pieces' },
    ];
}

function generateSelectMoveFrames(): Frame[] {
    const b1 = createBoard();
    b1[3][2] = { player: 1, isKing: false };
    b1[2][2] = { player: 2, isKing: false };

    const b2 = createBoard();
    b2[3][1] = { player: 1, isKing: false };
    b2[2][2] = { player: 2, isKing: false };

    return [
        { board: b1, highlights: [{ row: 3, col: 2, type: 'selected' }, { row: 1, col: 2, type: 'capture' }, { row: 3, col: 1, type: 'valid' }, { row: 3, col: 3, type: 'valid' }], caption: 'Gold border = selected | Yellow = slide | Red = capture' },
        { board: b2, highlights: [{ row: 3, col: 1, type: 'selected' }, { row: 2, col: 1, type: 'valid' }, { row: 3, col: 0, type: 'valid' }, { row: 3, col: 2, type: 'valid' }], caption: 'Tap a different piece to switch selection — highlights update instantly' },
    ];
}

function generateVisualIndicatorsFrames(): Frame[] {
    const b1 = createBoard();
    b1[0][2] = { player: 1, isKing: true };
    b1[2][1] = { player: 2, isKing: false };
    b1[4][2] = { player: 1, isKing: false };
    b1[4][4] = { player: 1, isKing: false };

    const b2 = createBoard();
    b2[0][2] = { player: 1, isKing: true };
    b2[2][1] = { player: 2, isKing: false };
    b2[4][4] = { player: 1, isKing: false };

    return [
        { board: b1, highlights: [{ row: 4, col: 2, type: 'danger' }, { row: 4, col: 4, type: 'danger' }], caption: 'Red pieces = offenders — P1 slid when these pieces had captures available' },
        { board: b2, highlights: [{ row: 0, col: 2, type: 'promote' }], caption: 'Gold crown = king. The crown and golden border identify kings at a glance.' },
    ];
}

function generateGameManagementFrames(): Frame[] {
    const b = createBoard();
    b[2][2] = { player: 1, isKing: true };
    b[4][0] = { player: 2, isKing: false };
    return [{ board: b, highlights: [], caption: 'Game saves automatically after every move — always safe to close the app' }];
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, overflow: 'hidden' },

    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 16, lineHeight: 20 },
    headerSub: { fontSize: 12, marginTop: 1 },
    iconBtn: { padding: 6, borderRadius: 10 },
    progressBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    progressText: { fontSize: 12 },

    scrollContent: { flexGrow: 1, paddingBottom: 160 },

    sectionBanner: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 16, marginTop: 16, marginBottom: 20,
        borderRadius: 16, padding: 16, gap: 12,
    },
    bannerIconWrap: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center', justifyContent: 'center',
    },
    bannerText: { flex: 1, gap: 2 },
    bannerLabel: { fontSize: 10, letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)' },
    bannerSub: { fontSize: 16, color: '#ffffff' },
    bannerBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
    bannerCount: { fontSize: 12, color: '#ffffff' },

    contentContainer: { paddingHorizontal: 16, gap: 14 },
    paragraphRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    paragraphDot: { width: 4, height: 4, borderRadius: 2, marginTop: 9, flexShrink: 0, opacity: 0.6 },
    paragraph: { flex: 1, fontSize: 14, lineHeight: 22, opacity: 0.88 },

    demoOuter: { paddingHorizontal: 16, marginTop: 24 },
    demoCard: { borderRadius: 18, padding: 16, borderWidth: 1, alignItems: 'center', gap: 14 },
    captionRow: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 6,
        borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, width: '100%',
    },
    caption: { flex: 1, fontSize: 12, lineHeight: 18, opacity: 0.7 },
    stepIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    stepDot: { height: 6, borderRadius: 3 },

    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    pillsContainer: { paddingHorizontal: 12, paddingVertical: 10, gap: 6, flexDirection: 'row', alignItems: 'center' },
    pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 5, borderWidth: 1 },
    pillText: { fontSize: 12 },

    navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4 },
    navBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
    navBtnText: { fontSize: 13 },
    subDots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    subDot: { height: 6, borderRadius: 3 },
});