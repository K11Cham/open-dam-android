import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAIMove, shouldAICall, AIDifficulty } from '../services/aiService';

export interface Piece { player: number; isKing: boolean }
interface Cell { row: number; col: number }
interface GameState {
    board: (Piece | null)[][];
    turn: number;
    selected: Cell | null;
    offenders: Cell[];
    placementPhase: boolean;
    winner: number;
    draw: boolean;
    chainKill: boolean;
}

export type BoardSize = 5 | 6 | 7 | 8 | 9;

// Generate initial board based on size
function createInitialBoard(size: BoardSize): (Piece | null)[][] {
    const board: (Piece | null)[][] = Array(size).fill(null).map(() => Array(size).fill(null));
    const center = Math.floor(size / 2);
    if (size === 5 || size === 7 || size === 9) {
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (r === center && c === center) {
                    board[r][c] = null;
                } else if (r < center) {
                    board[r][c] = { player: 2, isKing: false };
                } else if (r > center) {
                    board[r][c] = { player: 1, isKing: false };
                } else {
                    board[r][c] = { player: c < center ? 2 : 1, isKing: false };
                }
            }
        }
    } else if (size === 6) {
        for (let c = 0; c < 6; c++) {
            board[0][c] = { player: 2, isKing: false };
            board[1][c] = { player: 2, isKing: false };
            board[4][c] = { player: 1, isKing: false };
            board[5][c] = { player: 1, isKing: false };
        }
    } else if (size === 8) {
        for (let c = 0; c < 8; c++) {
            board[0][c] = { player: 2, isKing: false };
            board[1][c] = { player: 2, isKing: false };
            board[2][c] = { player: 2, isKing: false };
            board[5][c] = { player: 1, isKing: false };
            board[6][c] = { player: 1, isKing: false };
            board[7][c] = { player: 1, isKing: false };
        }
    }
    return board;
}

function getCenterPosition(size: BoardSize): { row: number; col: number } {
    const center = Math.floor(size / 2);
    return { row: center, col: center };
}

function getPromotionRow(size: BoardSize, player: number): number {
    return player === 1 ? 0 : size - 1;
}

export const useGameLogic = (
    mode: 'new' | 'load',
    slot: number = 1,
    boardSize: BoardSize = 5,
    vsAI: boolean = false,
    aiDifficulty: AIDifficulty = 'normal',
    playerSide: 1 | 2 = 1,
    undoAllowed: boolean = true
) => {
    const size = boardSize;
    const aiPlayer = playerSide === 1 ? 2 : 1;
    const initialBoard = createInitialBoard(size);
    const centerPos = getCenterPosition(size);
    const SAVE_KEY = `dam_save_slot_${slot}`;

    // State
    const [board, setBoard] = useState<(Piece | null)[][]>(() =>
        initialBoard.map(row => row.map(c => c ? { ...c } : null))
    );
    const [turn, setTurn] = useState<number>(1);
    const [selected, setSelected] = useState<Cell | null>(null);
    const [offenders, setOffenders] = useState<Cell[]>([]);
    const [winner, setWinner] = useState<number>(0);
    const [draw, setDraw] = useState<boolean>(false);
    const [placementPhase, setPlacementPhase] = useState<boolean>(true);
    const [history, setHistory] = useState<GameState[]>([]);
    const [undoRequest, setUndoRequest] = useState<{ requester: number } | null>(null);
    const [undoUsedThisTurn, setUndoUsedThisTurn] = useState<boolean>(false);
    const [chainKill, setChainKill] = useState<boolean>(false);
    const [aiThinking, setAiThinking] = useState<boolean>(false);

    // Refs to always have current state in AI callback
    const boardRef = useRef(board);
    const turnRef = useRef(turn);
    const selectedRef = useRef(selected);
    const chainKillRef = useRef(chainKill);
    const placementPhaseRef = useRef(placementPhase);
    const winnerRef = useRef(winner);
    const drawRef = useRef(draw);
    const aiThinkingRef = useRef(aiThinking);
    const undoRequestRef = useRef(undoRequest);

    // Keep refs in sync
    useEffect(() => {
        boardRef.current = board;
        turnRef.current = turn;
        selectedRef.current = selected;
        chainKillRef.current = chainKill;
        placementPhaseRef.current = placementPhase;
        winnerRef.current = winner;
        drawRef.current = draw;
        aiThinkingRef.current = aiThinking;
        undoRequestRef.current = undoRequest;
    });

    // Save game
    useEffect(() => {
        if (board.length > 0) saveGame();
    }, [board, turn, winner, draw, offenders, placementPhase, undoRequest, history, chainKill]);

    // Load game on mount
    useEffect(() => {
        if (mode === 'load') loadGame();
    }, [mode, slot]);

    // Reset undo-used when turn changes
    useEffect(() => {
        setUndoUsedThisTurn(false);
    }, [turn]);

    // Auto-accept undo if AI is the opponent
    useEffect(() => {
        if (undoRequest && vsAI && undoAllowed) {
            // AI auto-accepts undo requests
            setTimeout(() => {
                handleAcceptUndo();
            }, 500);
        }
    }, [undoRequest, vsAI, undoAllowed]);

    // Move helper functions
    const getValidSlides = useCallback((row: number, col: number, _board: (Piece | null)[][]) => {
        const ts = _board[row][col];
        if (!ts) return [];
        const validMoves: Cell[] = [];
        const directions = ts.isKing
            ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
            : ts.player === 1
                ? [[-1, 0], [0, -1], [0, 1]]
                : [[1, 0], [0, -1], [0, 1]];

        for (const [dr, dc] of directions) {
            if (ts.isKing) {
                let dist = 1;
                while (true) {
                    const checkRow = row + dr * dist;
                    const checkCol = col + dc * dist;
                    if (checkRow >= size || checkRow < 0 || checkCol >= size || checkCol < 0) break;
                    if (_board[checkRow][checkCol] !== null) break;
                    validMoves.push({ row: checkRow, col: checkCol });
                    dist++;
                }
            } else {
                const checkRow = row + dr;
                const checkCol = col + dc;
                if (checkRow >= size || checkRow < 0 || checkCol >= size || checkCol < 0) continue;
                if (_board[checkRow][checkCol] !== null) continue;
                validMoves.push({ row: checkRow, col: checkCol });
            }
        }
        return validMoves;
    }, [size]);

    const getValidCaptures = useCallback((row: number, col: number, _board: (Piece | null)[][]) => {
        const ts = _board[row][col];
        if (!ts) return [];
        const validMoves: Cell[] = [];
        const directions = ts.isKing
            ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
            : ts.player === 1
                ? [[-1, 0], [0, -1], [0, 1]]
                : [[1, 0], [0, -1], [0, 1]];

        for (const [dr, dc] of directions) {
            let dist = 1;
            let foundEnemy = false;
            while (true) {
                const checkRow = row + dr * dist;
                const checkCol = col + dc * dist;
                if (checkRow >= size || checkRow < 0 || checkCol >= size || checkCol < 0) break;
                const piece = _board[checkRow][checkCol];
                if (!foundEnemy) {
                    if (piece === null) {
                        // FIX 1: Kings can slide over empty squares searching for an enemy,
                        // but non-kings must find an adjacent enemy — stop scanning.
                        if (ts.isKing) {
                            dist++;
                            continue; // <-- was missing; fell through to the else below
                        } else {
                            break;
                        }
                    } else {
                        if (piece.player === ts.player) break;
                        foundEnemy = true;
                        dist++;
                        continue;
                    }
                } else {
                    if (piece === null) {
                        validMoves.push({ row: checkRow, col: checkCol });
                        if (ts.isKing) {
                            dist++;
                            continue; // king can land on multiple squares beyond the jumped piece
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        return validMoves;
    }, [size]);

    const hasLegalMoves = useCallback((player: number, _board: (Piece | null)[][]) => {
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const p = _board[r][c];
                if (p && p.player === player) {
                    if (getValidSlides(r, c, _board).length > 0) return true;
                    if (getValidCaptures(r, c, _board).length > 0) return true;
                }
            }
        }
        return false;
    }, [size, getValidSlides, getValidCaptures]);

    const removeEnemyBetween = useCallback((start: Cell, end: Cell, _board: (Piece | null)[][]) => {
        const diffRow = end.row - start.row;
        const diffCol = end.col - start.col;
        const distance = Math.max(Math.abs(diffRow), Math.abs(diffCol));
        const directionRow = Math.sign(diffRow);
        const directionCol = Math.sign(diffCol);
        for (let i = 1; i < distance; i++) {
            const checkRow = start.row + (directionRow * i);
            const checkCol = start.col + (directionCol * i);
            if (_board[checkRow][checkCol] !== null) {
                _board[checkRow][checkCol] = null;
                break;
            }
        }
    }, []);

    const checkWinner = useCallback((_board: (Piece | null)[][]): number => {
        let p1 = 0, p2 = 0;
        _board.forEach(row => row.forEach(cell => {
            if (cell?.player === 1) p1++;
            else if (cell) p2++;
        }));
        if (p1 === 0) return 2;
        if (p2 === 0) return 1;
        return 0;
    }, []);

    // FIX 2: Draw only applies when both players have exactly 1 piece AND
    // neither has a capture available AND no call is pending (no offenders).
    const checkDraw = useCallback((_board: (Piece | null)[][], pendingOffenders: Cell[] = []): boolean => {
        let p1 = 0, p2 = 0;
        let p1Pos: Cell | null = null;
        let p2Pos: Cell | null = null;
        _board.forEach((row, r) => row.forEach((cell, c) => {
            if (cell?.player === 1) { p1++; p1Pos = { row: r, col: c }; }
            else if (cell) { p2++; p2Pos = { row: r, col: c }; }
        }));

        if (p1 !== 1 || p2 !== 1) return false;

        // If there are pending offenders a call is still possible — not a draw yet.
        if (pendingOffenders.length > 0) return false;

        // If either lone piece still has a capture available — not a draw.
        if (p1Pos && getValidCaptures((p1Pos as Cell).row, (p1Pos as Cell).col, _board).length > 0) return false;
        if (p2Pos && getValidCaptures((p2Pos as Cell).row, (p2Pos as Cell).col, _board).length > 0) return false;

        return true;
    }, [getValidCaptures]);

    const checkAutoKing = useCallback((currentBoard: (Piece | null)[][]) => {
        let p1Count = 0, p2Count = 0;
        let p1Pos: Cell | null = null, p2Pos: Cell | null = null;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const p = currentBoard[r][c];
                if (p) {
                    if (p.player === 1) { p1Count++; p1Pos = { row: r, col: c }; }
                    if (p.player === 2) { p2Count++; p2Pos = { row: r, col: c }; }
                }
            }
        }
        let autoKinged = false;
        if (p1Count === 1 && p1Pos && !currentBoard[p1Pos.row][p1Pos.col]!.isKing) {
            currentBoard[p1Pos.row][p1Pos.col]!.isKing = true;
            autoKinged = true;
        }
        if (p2Count === 1 && p2Pos && !currentBoard[p2Pos.row][p2Pos.col]!.isKing) {
            currentBoard[p2Pos.row][p2Pos.col]!.isKing = true;
            autoKinged = true;
        }
        return autoKinged;
    }, [size]);

    // Check if a specific move from->to is a capture
    const isMoveCapture = useCallback((from: Cell, to: Cell, _board: (Piece | null)[][]): boolean => {
        const captures = getValidCaptures(from.row, from.col, _board);
        return captures.some(c => c.row === to.row && c.col === to.col);
    }, [getValidCaptures]);

    // Find all pieces that had available captures BEFORE a move was made
    const findOffendersFromPreviousBoard = useCallback((
        previousBoard: (Piece | null)[][],
        playerWhoJustMoved: number,
        moveWasCapture: boolean
    ): Cell[] => {
        // If the move was a capture, no call can be made
        if (moveWasCapture) return [];

        // Find all pieces of the player who just moved that had captures available
        const offenderList: Cell[] = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const piece = previousBoard[r][c];
                if (piece && piece.player === playerWhoJustMoved) {
                    if (getValidCaptures(r, c, previousBoard).length > 0) {
                        offenderList.push({ row: r, col: c });
                    }
                }
            }
        }
        return offenderList;
    }, [size, getValidCaptures]);

    // Direct move execution (used by AI and human)
    const executeMove = useCallback((from: Cell, to: Cell) => {
        const currentBoard = boardRef.current;
        const currentTurn = turnRef.current;
        const currentChainKill = chainKillRef.current;
        const piece = currentBoard[from.row][from.col];
        if (!piece || piece.player !== currentTurn) return false;

        const slides = getValidSlides(from.row, from.col, currentBoard);
        const captures = getValidCaptures(from.row, from.col, currentBoard);
        const isCapture = captures.some(c => c.row === to.row && c.col === to.col);
        const isSlide = slides.some(s => s.row === to.row && s.col === to.col);

        if (!isCapture && !isSlide) return false;

        // Save history before move
        if (!currentChainKill) {
            const currentState: GameState = {
                board: currentBoard.map(r => r.map(c => c ? { ...c } : null)),
                turn: currentTurn,
                selected: null,
                offenders: offenders.slice(),
                placementPhase: placementPhaseRef.current,
                winner: winnerRef.current,
                draw: drawRef.current,
                chainKill: false
            };
            setHistory(prev => [...prev.slice(-10), currentState]);
        }

        // Execute the move
        const newBoard: (Piece | null)[][] = currentBoard.map(r => [...r]);
        newBoard[to.row][to.col] = piece;
        newBoard[from.row][from.col] = null;

        const promotionRow = getPromotionRow(size, currentTurn);
        let promoted = false;
        if (to.row === promotionRow && !piece.isKing) {
            newBoard[to.row][to.col]!.isKing = true;
            promoted = true;
        }

        if (isCapture) {
            removeEnemyBetween(from, to, newBoard);

            // Check for auto-king IMMEDIATELY after capture
            checkAutoKing(newBoard);

            // Check for draw after capture — pass empty offenders since we're mid-capture
            // Only draw if no further chain captures exist either
            const furtherCaptures = getValidCaptures(to.row, to.col, newBoard);
            const canChain = !promoted && furtherCaptures.length > 0;

            if (!canChain && checkDraw(newBoard, [])) {
                setBoard(newBoard);
                setChainKill(false);
                setDraw(true);
                return true;
            }

            if (promoted) {
                setBoard(newBoard);
                setChainKill(false);
                const win = checkWinner(newBoard);
                if (win > 0) setWinner(win);
                else {
                    setTurn(currentTurn === 1 ? 2 : 1);
                    setSelected(null);
                    setOffenders([]);
                }
            } else if (canChain) {
                setBoard(newBoard);
                setSelected(to);
                setChainKill(true);
            } else {
                setBoard(newBoard);
                setChainKill(false);
                const win = checkWinner(newBoard);
                if (win > 0) setWinner(win);
                else {
                    setTurn(currentTurn === 1 ? 2 : 1);
                    setSelected(null);
                    setOffenders([]);
                }
            }
        } else {
            // Slide move — find offenders from previous board
            let newOffenders: Cell[] = [];

            // Detect positions that will be auto-kinged in the new board
            const autoKingedPositions: Cell[] = [];
            let p1Count = 0, p2Count = 0;
            let p1Pos: Cell | null = null, p2Pos: Cell | null = null;

            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const p = newBoard[r][c];
                    if (p) {
                        if (p.player === 1) { p1Count++; p1Pos = { row: r, col: c }; }
                        if (p.player === 2) { p2Count++; p2Pos = { row: r, col: c }; }
                    }
                }
            }

            if (p1Count === 1 && p1Pos) autoKingedPositions.push(p1Pos);
            if (p2Count === 1 && p2Pos) autoKingedPositions.push(p2Pos);

            // Find offenders from previous board, excluding:
            //   1. Pieces that will be auto-kinged (their capture set changes)
            //   2. The moving piece itself if it just got promoted (its capture set as a
            //      non-king on the previous board is no longer meaningful — it's now a king
            //      and should only be judged by what it can do from its new position forward)
            const tempOffenders = findOffendersFromPreviousBoard(currentBoard, currentTurn, false);
            newOffenders = tempOffenders
                .filter(offender => {
                    // Exclude auto-kinged positions
                    if (autoKingedPositions.some(pos =>
                        pos.row === offender.row && pos.col === offender.col
                    )) return false;
                    // Exclude the moving piece if it just got promoted
                    if (promoted && offender.row === from.row && offender.col === from.col) {
                        return false;
                    }
                    return true;
                })
                .map(offender => {
                    // Remap the moving piece (if not excluded above) to its new position
                    if (offender.row === from.row && offender.col === from.col) {
                        return { row: to.row, col: to.col };
                    }
                    return offender;
                })
                // Sanity check: piece must still exist on the new board for this player
                .filter(offender => {
                    const p = newBoard[offender.row][offender.col];
                    return p !== null && p.player === currentTurn;
                });

            // Apply auto-king to the new board
            checkAutoKing(newBoard);

            setBoard(newBoard);
            const win = checkWinner(newBoard);
            if (win > 0) {
                setWinner(win);
            } else {
                // FIX 2 (slide path): pass newOffenders so draw check knows a call may still happen
                if (checkDraw(newBoard, newOffenders)) {
                    setDraw(true);
                } else {
                    setTurn(currentTurn === 1 ? 2 : 1);
                    setSelected(null);
                    setOffenders(newOffenders);
                }
            }
        }

        return true;
    }, [size, getValidSlides, getValidCaptures, removeEnemyBetween, checkWinner, checkDraw,
        checkAutoKing, offenders, findOffendersFromPreviousBoard]);

    // AI move execution - uses refs for current state
    const aiMoveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const doAIMove = useCallback(() => {
        const currentBoard = boardRef.current;
        const currentTurn = turnRef.current;
        const currentPlacementPhase = placementPhaseRef.current;
        const currentChainKill = chainKillRef.current;
        const currentSelected = selectedRef.current;

        // Verify it's still AI's turn
        if (currentTurn !== aiPlayer) {
            setAiThinking(false);
            return;
        }

        // Handle placement phase for AI (when AI is P1)
        if (currentPlacementPhase && aiPlayer === 1) {
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (currentBoard[r][c]?.player === 1) {
                        const testBoard = currentBoard.map(row => [...row]);
                        testBoard[centerPos.row][centerPos.col] = testBoard[r][c];
                        testBoard[r][c] = null;
                        if (hasLegalMoves(2, testBoard)) {
                            setBoard(testBoard);
                            setPlacementPhase(false);
                            setTurn(2);
                            setSelected(null);
                            setOffenders([]);
                            setAiThinking(false);
                            return;
                        }
                    }
                }
            }
            setAiThinking(false);
            return;
        }

        if (currentPlacementPhase) {
            setAiThinking(false);
            return;
        }

        const chainKillFrom = currentChainKill && currentSelected ? currentSelected : undefined;
        const move = getAIMove(currentBoard, aiPlayer, aiDifficulty, chainKillFrom);
        if (move) {
            executeMove(move.from, move.to);
        }

        setTimeout(() => {
            setAiThinking(false);
        }, 100);
    }, [aiPlayer, aiDifficulty, size, centerPos, hasLegalMoves, executeMove]);

    // Trigger AI move when it's AI's turn
    useEffect(() => {
        if (aiMoveTimeoutRef.current) {
            clearTimeout(aiMoveTimeoutRef.current);
            aiMoveTimeoutRef.current = null;
        }

        if (!vsAI) return;
        if (winnerRef.current !== 0 || drawRef.current) return;
        if (undoRequestRef.current) return;
        if (turnRef.current !== aiPlayer) return;

        setAiThinking(true);

        aiMoveTimeoutRef.current = setTimeout(() => {
            doAIMove();
        }, 500);

        return () => {
            if (aiMoveTimeoutRef.current) {
                clearTimeout(aiMoveTimeoutRef.current);
                aiMoveTimeoutRef.current = null;
            }
        };
    }, [turn, chainKill, selected, vsAI, aiPlayer, doAIMove, aiThinking, undoRequest]);

    // AI calling logic
    useEffect(() => {
        if (!vsAI) return;
        if (winnerRef.current !== 0 || drawRef.current) return;
        if (chainKillRef.current) return;
        if (turnRef.current !== playerSide) return;
        if (offenders.length === 0) return;

        const shouldCall = shouldAICall(boardRef.current, offenders, aiPlayer, aiDifficulty);

        if (shouldCall) {
            setTimeout(() => {
                if (offenders.length > 0 && !chainKillRef.current && !undoRequestRef.current) {
                    handleCall();
                }
            }, 800);
        }
    }, [turn, offenders, vsAI, aiPlayer, playerSide, aiDifficulty]);

    const saveGame = async () => {
        try {
            const gameState = {
                board, turn, winner, draw, offenders, placementPhase,
                undoRequest, history, savedAt: Date.now(),
                boardSize: size, chainKill, undoAllowed
            };
            await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
        } catch (e) { console.log("Failed to save", e); }
    };

    const loadGame = async () => {
        try {
            const savedData = await AsyncStorage.getItem(SAVE_KEY);
            if (savedData) {
                const parsed = JSON.parse(savedData);
                if (parsed.boardSize && parsed.boardSize !== size) {
                    resetGame();
                    return;
                }
                setBoard(parsed.board);
                setTurn(parsed.turn);
                setWinner(parsed.winner);
                setDraw(parsed.draw || false);
                setOffenders(parsed.offenders || []);
                setPlacementPhase(parsed.placementPhase || false);
                setUndoRequest(parsed.undoRequest || null);
                setHistory(parsed.history || []);
                setChainKill(parsed.chainKill || false);
                setSelected(null);
            }
        } catch (e) { console.log("Failed to load", e); }
    };

    const resetGame = useCallback(() => {
        setWinner(0);
        setDraw(false);
        setTurn(1);
        setSelected(null);
        setOffenders([]);
        setHistory([]);
        setUndoRequest(null);
        setUndoUsedThisTurn(false);
        setChainKill(false);
        setBoard(initialBoard.map(row => row.map(c => c ? { ...c } : null)));
        setPlacementPhase(true);
        setAiThinking(false);
    }, [initialBoard]);

    const handleRequestUndo = (requesterId: number) => {
        if (!undoAllowed) return;
        if (undoUsedThisTurn) return;
        if (history.length === 0) return;
        if (winner !== 0 || draw) return;
        if (chainKill) return;
        if (vsAI && turn === aiPlayer) return;

        setUndoRequest({ requester: requesterId });
        setUndoUsedThisTurn(true);
    };

    const handleAcceptUndo = () => {
        if (history.length === 0) return;

        if (vsAI && history.length >= 2) {
            let undoCount = 2;

            for (let i = history.length - 1; i >= 0 && i >= history.length - 10; i--) {
                if (history[i].chainKill) {
                    undoCount = history.length - i;
                } else {
                    break;
                }
            }

            undoCount = Math.min(undoCount, history.length);

            const targetIndex = history.length - undoCount;
            if (targetIndex >= 0) {
                const previousState = history[targetIndex];
                setBoard(previousState.board);
                setTurn(previousState.turn);
                setOffenders(previousState.offenders);
                setPlacementPhase(previousState.placementPhase);
                setWinner(previousState.winner);
                setDraw(previousState.draw || false);
                setChainKill(previousState.chainKill || false);
                setSelected(null);
                setHistory(prev => prev.slice(0, targetIndex));
            }
        } else {
            const previousState = history[history.length - 1];
            setBoard(previousState.board);
            setTurn(previousState.turn);
            setOffenders(previousState.offenders);
            setPlacementPhase(previousState.placementPhase);
            setWinner(previousState.winner);
            setDraw(previousState.draw || false);
            setChainKill(previousState.chainKill || false);
            setSelected(null);
            setHistory(prev => prev.slice(0, -1));
        }

        setUndoRequest(null);
    };

    const handleDeclineUndo = () => setUndoRequest(null);

    const handleResign = useCallback((resigningPlayer: number) => {
        if (winner !== 0 || draw) return;
        setWinner(resigningPlayer === 1 ? 2 : 1);
    }, [winner, draw]);

    const handleCellPress = (row: number, col: number) => {
        if (winner !== 0 || draw || undoRequest) return;
        if (vsAI && turn === aiPlayer) return;

        // Placement Phase
        if (placementPhase && turn === 1) {
            if (board[row][col]?.player === 1) {
                setSelected({ row, col });
                return;
            }
            if (selected && row === centerPos.row && col === centerPos.col) {
                const testBoard = board.map(r => [...r]);
                testBoard[centerPos.row][centerPos.col] = testBoard[selected.row][selected.col];
                testBoard[selected.row][selected.col] = null;
                if (hasLegalMoves(2, testBoard)) {
                    const currentState: GameState = {
                        board: board.map(r => r.map(c => c ? { ...c } : null)),
                        turn: turn,
                        selected: null,
                        offenders: offenders.slice(),
                        placementPhase: placementPhase,
                        winner: winner,
                        draw: draw,
                        chainKill: chainKill
                    };
                    setHistory(prev => [...prev.slice(-10), currentState]);
                    setBoard(testBoard);
                    setPlacementPhase(false);
                    setTurn(2);
                    setSelected(null);
                    setOffenders([]);
                }
                return;
            }
        }

        // Standard Gameplay
        const cell = board[row][col];
        if (chainKill) {
            if (selected && !cell) {
                const captures = getValidCaptures(selected.row, selected.col, board);
                const isCapture = captures.some(c => c.row === row && c.col === col);
                if (!isCapture) return;
            } else {
                return;
            }
        } else {
            if (cell && cell.player === turn) {
                setSelected({ row, col });
                return;
            }
        }

        if (selected && !cell) {
            executeMove(selected, { row, col });
        }
    };

    const handleCall = () => {
        if (undoRequest || chainKill) return;
        const newBoard = board.map(row => [...row]);
        offenders.forEach(o => { newBoard[o.row][o.col] = null; });

        checkAutoKing(newBoard);

        setBoard(newBoard);
        setOffenders([]);

        // FIX 2 (call path): after removing offenders there are no more pending offenders,
        // so pass [] — draw can only trigger now if captures are also gone.
        if (checkDraw(newBoard, [])) {
            setDraw(true);
            return;
        }
        const win = checkWinner(newBoard);
        if (win > 0) setWinner(win);
    };

    const handleAcceptDraw = () => {
        setDraw(true);
    };

    return {
        board, turn, winner, draw, selected, offenders, placementPhase,
        undoRequest, history, boardSize: size, chainKill,
        handleCellPress, handleCall, resetGame,
        handleRequestUndo, handleAcceptUndo, handleDeclineUndo,
        handleResign, handleAcceptDraw,
        vsAI, aiDifficulty, aiPlayer, playerSide,
        aiThinking, undoAllowed, undoUsedThisTurn,
    };
};

export const getSlotInfo = async (slot: number): Promise<{ hasSave: boolean; savedAt?: number; turn?: number }> => {
    try {
        const savedData = await AsyncStorage.getItem(`dam_save_slot_${slot}`);
        if (savedData) {
            const parsed = JSON.parse(savedData);
            return { hasSave: true, savedAt: parsed.savedAt, turn: parsed.turn };
        }
    } catch (e) { console.log("Failed to get slot info", e); }
    return { hasSave: false };
};

export const clearSlot = async (slot: number): Promise<void> => {
    try {
        await AsyncStorage.removeItem(`dam_save_slot_${slot}`);
    } catch (e) { console.log("Failed to clear slot", e); }
};

export const getAllSlotsInfo = async (): Promise<Array<{ hasSave: boolean; savedAt?: number; turn?: number }>> => {
    const slots = [];
    for (let i = 1; i <= 3; i++) {
        slots.push(await getSlotInfo(i));
    }
    return slots;
};