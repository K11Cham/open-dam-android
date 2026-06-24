import React, { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Cell from './Cell';

export type HighlightType = 'valid' | 'capture' | 'selected' | 'danger' | 'promote' | 'path';
export interface Highlight {
    row: number;
    col: number;
    type: HighlightType;
}

interface Props {
    board: (Piece | null)[][];
    selected: { row: number; col: number } | null;
    offenders: { row: number; col: number }[];
    highlights?: Highlight[];
    onPress: (row: number, col: number) => void;
    theme: any;
    fontBold: string;
}

export interface Piece {
    player: number;
    isKing: boolean;
}

const BORDER = 10;
const GAP    = 1;

function diffBoard(prev: (Piece | null)[][], curr: (Piece | null)[][]) {
    const n = curr.length;
    const removedCells  = new Set<string>();
    const removedPieces = new Map<string, Piece>();

    const prevCount: Record<number, number> = {};
    const currCount: Record<number, number> = {};
    for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
            const p = prev[r]?.[c], cur = curr[r][c];
            if (p)   prevCount[p.player]   = (prevCount[p.player]   || 0) + 1;
            if (cur) currCount[cur.player] = (currCount[cur.player] || 0) + 1;
        }

    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const pv = prev[r]?.[c];
            const cu = curr[r][c];
            if (pv && !cu) {
                if ((prevCount[pv.player] || 0) > (currCount[pv.player] || 0)) {
                    removedCells.add(`${r}-${c}`);
                    removedPieces.set(`${r}-${c}`, { ...pv });
                }
            }
        }
    }

    return { removedCells, removedPieces };
}

export default function Board({ board, selected, offenders, highlights = [], onPress, theme, fontBold }: Props) {
    const boardWidthRef = useRef(0);
    const [boardWidth, setBoardWidth] = useState(0);

    const prevBoardRef     = useRef<(Piece | null)[][]>(board);
    const removedCellsRef  = useRef(new Set<string>());
    const removedPiecesRef = useRef(new Map<string, Piece>());

    if (prevBoardRef.current !== board) {
        const { removedCells, removedPieces } = diffBoard(prevBoardRef.current, board);
        removedCellsRef.current  = removedCells;
        removedPiecesRef.current = removedPieces;
        prevBoardRef.current     = board;
    }

    const n        = board.length;
    const cellSize = boardWidth > 0 ? (boardWidth - BORDER * 2 - (n - 1) * GAP) / n : 0;

    return (
        <View
            style={[styles.board, { backgroundColor: theme.highlight, borderColor: theme.boardBorder }]}
            onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                boardWidthRef.current = w;
                setBoardWidth(w);
            }}
        >
            {board.map((row, i) => (
                <View style={styles.row} key={i}>
                    {row.map((cell, j) => {
                        const key = `${i}-${j}`;
                        return (
                            <Cell
                                key={key}
                                row={i}
                                col={j}
                                piece={cell}
                                removedPiece={removedPiecesRef.current.get(key) ?? null}
                                isSelected={selected?.row === i && selected?.col === j}
                                isOffender={offenders.some(o => o.row === i && o.col === j)}
                                highlight={highlights.find(h => h.row === i && h.col === j)}
                                isRemoved={removedCellsRef.current.has(key)}
                                isMovingTo={false}
                                onPress={() => onPress(i, j)}
                                theme={theme}
                                fontBold={fontBold}
                            />
                        );
                    })}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    board: {
        width: '100%',
        aspectRatio: 1,
        borderWidth: BORDER,
        gap: GAP,
        // No borderRadius — flush with player bars
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
    },
    row: { flexDirection: 'row', gap: GAP },
});