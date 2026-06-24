/**
 * DamFish AI Engine
 * A chess-like AI for the DAM board game using minimax with alpha-beta pruning
 * Now with proper rule enforcement and calling logic
 */

import { Piece } from '../hooks/useGameLogic';

type Board = (Piece | null)[][];
interface Cell { row: number; col: number }
interface Move {
    from: Cell;
    to: Cell;
    isCapture: boolean;
}

export type AIDifficulty = 'easy' | 'normal' | 'hard';

// Adjusted weights for DAM game mechanics
const EVAL_WEIGHTS = {
    pieceValue: 100,
    kingValue: 200,          // Kings are very powerful in DAM
    advancement: 8,          // Getting close to promotion is important
    centerControl: 5,        // Center is somewhat important
    mobility: 10,            // Having more moves is good
    captureOpportunity: 25,  // Having capture opportunities is valuable
    backRowDefense: 15,      // Protecting back row helps prevent king formations
    kingMobility: 12,        // Kings with more moves are better
};

/**
 * Main AI entry point - returns the best move for the given difficulty
 */
export function getAIMove(
    board: Board,
    player: number,
    difficulty: AIDifficulty,
    chainKillFrom?: Cell
): Move | null {
    const size = board.length;

    // Get all valid moves for the AI player
    const moves = chainKillFrom
        ? getCaptureMovesFrom(board, chainKillFrom, player, size)
        : getAllValidMoves(board, player, size);

    if (moves.length === 0) return null;

    switch (difficulty) {
        case 'easy':
            return getEasyMove(board, moves, player, size);
        case 'normal':
            return getNormalMove(board, moves, player, size);
        case 'hard':
            return getHardMove(board, moves, player, size);
        default:
            return moves[Math.floor(Math.random() * moves.length)];
    }
}

/**
 * Check if AI should call opponent's offenders
 */
export function shouldAICall(
    board: Board,
    offenders: Cell[],
    aiPlayer: number,
    difficulty: AIDifficulty
): boolean {
    if (offenders.length === 0) return false;

    // Calculate the value of pieces that would be removed
    let offenderValue = 0;
    for (const offender of offenders) {
        const piece = board[offender.row][offender.col];
        if (piece) {
            offenderValue += piece.isKing ? EVAL_WEIGHTS.kingValue : EVAL_WEIGHTS.pieceValue;
        }
    }

    // Difficulty-based calling probabilities
    switch (difficulty) {
        case 'easy':
            // Easy: 40% chance to call, prefers calling when multiple pieces or kings
            if (offenders.length >= 2) return Math.random() < 0.6;
            if (offenderValue >= EVAL_WEIGHTS.kingValue) return Math.random() < 0.5;
            return Math.random() < 0.4;

        case 'normal':
            // Normal: 70% chance to call, almost always calls kings
            if (offenderValue >= EVAL_WEIGHTS.kingValue) return Math.random() < 0.85;
            if (offenders.length >= 2) return Math.random() < 0.75;
            return Math.random() < 0.7;

        case 'hard':
            // Hard: Always calls, it's strategically optimal
            return true;

        default:
            return Math.random() < 0.5;
    }
}

/**
 * Easy AI: Random moves with slight preference for captures
 */
function getEasyMove(board: Board, moves: Move[], player: number, size: number): Move {
    // 60% chance to pick a capture if available
    const captures = moves.filter(m => m.isCapture);
    if (captures.length > 0 && Math.random() < 0.6) {
        return captures[Math.floor(Math.random() * captures.length)];
    }

    // Otherwise random move
    return moves[Math.floor(Math.random() * moves.length)];
}

/**
 * Normal AI: Minimax with depth 3
 */
function getNormalMove(board: Board, moves: Move[], player: number, size: number): Move {
    const depth = 3;
    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
        const newBoard = applyMove(board, move, player, size);
        const score = minimax(newBoard, depth - 1, -Infinity, Infinity, false, player, size);

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove;
}

/**
 * Hard AI: Minimax with depth 5 and move ordering
 */
function getHardMove(board: Board, moves: Move[], player: number, size: number): Move {
    const depth = 5;
    let bestMove = moves[0];
    let bestScore = -Infinity;

    // Sort moves by quick evaluation for better alpha-beta pruning
    const scoredMoves = moves.map(move => {
        const newBoard = applyMove(board, move, player, size);
        const quickScore = evaluateBoard(newBoard, player, size, false);
        return { move, score: quickScore };
    }).sort((a, b) => b.score - a.score);

    for (const { move } of scoredMoves) {
        const newBoard = applyMove(board, move, player, size);
        const score = minimax(newBoard, depth - 1, -Infinity, Infinity, false, player, size);

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove;
}

/**
 * Minimax algorithm with alpha-beta pruning
 */
function minimax(
    board: Board,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    aiPlayer: number,
    size: number
): number {
    const currentPlayer = isMaximizing ? aiPlayer : (aiPlayer === 1 ? 2 : 1);

    // Check for terminal state
    const winner = checkWinner(board);
    if (winner === aiPlayer) return 10000 + depth;
    if (winner !== 0) return -10000 - depth;

    // Check for draw (both players have 1 piece)
    if (checkDraw(board)) return 0;

    if (depth === 0) {
        return evaluateBoard(board, aiPlayer, size, true);
    }

    const moves = getAllValidMoves(board, currentPlayer, size);
    if (moves.length === 0) {
        // No moves = lose for current player
        return isMaximizing ? -9999 : 9999;
    }

    if (isMaximizing) {
        let maxScore = -Infinity;
        for (const move of moves) {
            const newBoard = applyMove(board, move, currentPlayer, size);
            const score = minimax(newBoard, depth - 1, alpha, beta, false, aiPlayer, size);
            maxScore = Math.max(maxScore, score);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break; // Beta cutoff
        }
        return maxScore;
    } else {
        let minScore = Infinity;
        for (const move of moves) {
            const newBoard = applyMove(board, move, currentPlayer, size);
            const score = minimax(newBoard, depth - 1, alpha, beta, true, aiPlayer, size);
            minScore = Math.min(minScore, score);
            beta = Math.min(beta, score);
            if (beta <= alpha) break; // Alpha cutoff
        }
        return minScore;
    }
}

/**
 * Evaluate board position
 */
function evaluateBoard(board: Board, player: number, size: number, detailed: boolean): number {
    let score = 0;
    const opponent = player === 1 ? 2 : 1;

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const piece = board[r][c];
            if (!piece) continue;

            const multiplier = piece.player === player ? 1 : -1;

            // Base piece value
            const baseValue = piece.isKing ? EVAL_WEIGHTS.kingValue : EVAL_WEIGHTS.pieceValue;
            score += baseValue * multiplier;

            if (piece.player === player && detailed) {
                // Advancement bonus for non-kings
                if (!piece.isKing) {
                    const promotionRow = piece.player === 1 ? 0 : size - 1;
                    const distanceToPromotion = Math.abs(r - promotionRow);
                    const advancement = size - distanceToPromotion;
                    score += advancement * EVAL_WEIGHTS.advancement;

                    // Back row defense
                    const backRow = piece.player === 1 ? size - 1 : 0;
                    if (r === backRow) {
                        score += EVAL_WEIGHTS.backRowDefense;
                    }
                }

                // King mobility bonus
                if (piece.isKing) {
                    const moves = getValidSlides(r, c, board, piece, size).length;
                    score += moves * EVAL_WEIGHTS.kingMobility;
                }

                // Capture opportunities
                const captures = getValidCaptures(r, c, board, piece, size);
                if (captures.length > 0) {
                    score += captures.length * EVAL_WEIGHTS.captureOpportunity;
                }
            }
        }
    }

    // Mobility comparison
    if (detailed) {
        const playerMoves = getAllValidMoves(board, player, size).length;
        const opponentMoves = getAllValidMoves(board, opponent, size).length;
        score += (playerMoves - opponentMoves) * EVAL_WEIGHTS.mobility;
    }

    return score;
}

/**
 * Get all valid moves for a player - ENFORCES CAPTURE PRIORITY
 */
export function getAllValidMoves(board: Board, player: number, size: number): Move[] {
    const captures: Move[] = [];
    const slides: Move[] = [];

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const piece = board[r][c];
            if (piece && piece.player === player) {
                // Check for captures
                const pieceCaptures = getValidCaptures(r, c, board, piece, size);
                for (const cap of pieceCaptures) {
                    captures.push({
                        from: { row: r, col: c },
                        to: cap,
                        isCapture: true,
                    });
                }

                // Get slides (only used if no captures available anywhere)
                const pieceSlides = getValidSlides(r, c, board, piece, size);
                for (const slide of pieceSlides) {
                    slides.push({
                        from: { row: r, col: c },
                        to: slide,
                        isCapture: false,
                    });
                }
            }
        }
    }

    // FORCED CAPTURE RULE: If any captures available, MUST capture
    return captures.length > 0 ? captures : slides;
}

/**
 * Get capture moves from a specific cell (for chain kills)
 */
function getCaptureMovesFrom(board: Board, from: Cell, player: number, size: number): Move[] {
    const piece = board[from.row][from.col];
    if (!piece || piece.player !== player) return [];

    const captures = getValidCaptures(from.row, from.col, board, piece, size);
    return captures.map(cap => ({
        from,
        to: cap,
        isCapture: true,
    }));
}

/**
 * Get valid slides for a piece
 */
function getValidSlides(row: number, col: number, board: Board, piece: Piece, size: number): Cell[] {
    const validMoves: Cell[] = [];
    const directions = piece.isKing
        ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
        : piece.player === 1
            ? [[-1, 0], [0, -1], [0, 1]]  // P1 moves up and sideways
            : [[1, 0], [0, -1], [0, 1]];   // P2 moves down and sideways

    for (const [dr, dc] of directions) {
        if (piece.isKing) {
            // Kings can slide multiple spaces
            let dist = 1;
            while (true) {
                const checkRow = row + dr * dist;
                const checkCol = col + dc * dist;
                if (checkRow >= size || checkRow < 0 || checkCol >= size || checkCol < 0) break;
                if (board[checkRow][checkCol] !== null) break;
                validMoves.push({ row: checkRow, col: checkCol });
                dist++;
            }
        } else {
            // Regular pieces move one space
            const checkRow = row + dr;
            const checkCol = col + dc;
            if (checkRow >= size || checkRow < 0 || checkCol >= size || checkCol < 0) continue;
            if (board[checkRow][checkCol] !== null) continue;
            validMoves.push({ row: checkRow, col: checkCol });
        }
    }

    return validMoves;
}

/**
 * Get valid captures for a piece
 */
function getValidCaptures(row: number, col: number, board: Board, piece: Piece, size: number): Cell[] {
    const validMoves: Cell[] = [];
    const directions = piece.isKing
        ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
        : piece.player === 1
            ? [[-1, 0], [0, -1], [0, 1]]
            : [[1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of directions) {
        let dist = 1;
        let foundEnemy = false;

        while (true) {
            const checkRow = row + dr * dist;
            const checkCol = col + dc * dist;
            if (checkRow >= size || checkRow < 0 || checkCol >= size || checkCol < 0) break;

            const targetPiece = board[checkRow][checkCol];

            if (!foundEnemy) {
                if (targetPiece === null) {
                    if (piece.isKing) dist++;
                    else break;
                } else if (targetPiece.player === piece.player) {
                    break;
                } else {
                    foundEnemy = true;
                    dist++;
                }
            } else {
                if (targetPiece === null) {
                    validMoves.push({ row: checkRow, col: checkCol });
                    if (piece.isKing) dist++;
                    else break;
                } else {
                    break;
                }
            }
        }
    }

    return validMoves;
}

/**
 * Apply a move to the board and return a new board state
 */
function applyMove(board: Board, move: Move, player: number, size: number): Board {
    const newBoard: Board = board.map(row => row.map(cell => cell ? { ...cell } : null));
    const piece = newBoard[move.from.row][move.from.col];

    if (!piece) return newBoard;

    // Move the piece
    newBoard[move.to.row][move.to.col] = piece;
    newBoard[move.from.row][move.from.col] = null;

    // Handle capture
    if (move.isCapture) {
        removeEnemyBetween(move.from, move.to, newBoard);
    }

    // Handle promotion
    const promotionRow = player === 1 ? 0 : size - 1;
    if (move.to.row === promotionRow && !piece.isKing) {
        newBoard[move.to.row][move.to.col]!.isKing = true;
    }

    // Check for auto-king (last piece becomes king)
    checkAutoKing(newBoard, size);

    return newBoard;
}

/**
 * Auto-king if a player has only one piece left
 */
function checkAutoKing(board: Board, size: number): void {
    let p1Count = 0, p2Count = 0;
    let p1Pos: Cell | null = null, p2Pos: Cell | null = null;

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const piece = board[r][c];
            if (piece) {
                if (piece.player === 1) { p1Count++; p1Pos = { row: r, col: c }; }
                if (piece.player === 2) { p2Count++; p2Pos = { row: r, col: c }; }
            }
        }
    }

    if (p1Count === 1 && p1Pos && !board[p1Pos.row][p1Pos.col]!.isKing) {
        board[p1Pos.row][p1Pos.col]!.isKing = true;
    }
    if (p2Count === 1 && p2Pos && !board[p2Pos.row][p2Pos.col]!.isKing) {
        board[p2Pos.row][p2Pos.col]!.isKing = true;
    }
}

/**
 * Remove enemy piece between two cells (for captures)
 */
function removeEnemyBetween(start: Cell, end: Cell, board: Board): void {
    const diffRow = end.row - start.row;
    const diffCol = end.col - start.col;
    const distance = Math.max(Math.abs(diffRow), Math.abs(diffCol));
    const directionRow = Math.sign(diffRow);
    const directionCol = Math.sign(diffCol);

    for (let i = 1; i < distance; i++) {
        const checkRow = start.row + (directionRow * i);
        const checkCol = start.col + (directionCol * i);
        if (board[checkRow][checkCol] !== null) {
            board[checkRow][checkCol] = null;
            break;
        }
    }
}

/**
 * Check for winner
 */
function checkWinner(board: Board): number {
    let p1 = 0, p2 = 0;

    for (const row of board) {
        for (const cell of row) {
            if (cell?.player === 1) p1++;
            else if (cell?.player === 2) p2++;
        }
    }

    if (p1 === 0) return 2;
    if (p2 === 0) return 1;
    return 0;
}

/**
 * Check for draw (both players have exactly 1 piece)
 */
function checkDraw(board: Board): boolean {
    let p1 = 0, p2 = 0;

    for (const row of board) {
        for (const cell of row) {
            if (cell?.player === 1) p1++;
            else if (cell?.player === 2) p2++;
        }
    }

    return p1 === 1 && p2 === 1;
}