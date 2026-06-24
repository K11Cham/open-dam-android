import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface Props {
  player: 1 | 2;
  turn: number;
  winner: number;
  offenders: any[];
  onCall: () => void;
  onResign: () => void;
  onRequestUndo: () => void;
  onAcceptUndo: () => void;
  onDeclineUndo: () => void;
  onRequestDraw: () => void;
  onAcceptDraw: () => void;
  onDeclineDraw: () => void;
  undoRequest: { requester: number } | null;
  drawRequest: { requester: number } | null;
  undoAllowed?: boolean;
  undoUsedThisTurn?: boolean;
  canUndo?: boolean;
  // Seconds remaining — null means no timer
  timeRemaining: number | null;
  isTop?: boolean;
  shouldRotate?: boolean;
  isAI?: boolean;
  theme: any;
  fontBold: string;
  fontMono?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerBar({
  player, turn, winner, offenders,
  onCall, onResign, onRequestUndo, onAcceptUndo, onDeclineUndo,
  onRequestDraw, onAcceptDraw, onDeclineDraw,
  undoRequest, drawRequest,
  undoAllowed = true, undoUsedThisTurn = false, canUndo = false,
  timeRemaining,
  isTop = false, shouldRotate = false,
  isAI = false,
  theme, fontBold, fontMono,
}: Props) {
  const playerName = isAI ? 'AI' : player === 1 ? 'Red' : 'Blue';
  const playerColor = player === 1 ? theme.p1 : theme.p2;
  const isCurrentTurn = turn === player && winner === 0;
  const isWinner = winner === player;

  const isUndoRequester = undoRequest?.requester === player;
  const isUndoOpponent = undoRequest && undoRequest.requester !== player;
  const canRequestUndoForPlayer = !isAI && !undoRequest && !undoUsedThisTurn && canUndo && undoAllowed;
  const canCall = !isAI && isCurrentTurn && offenders.length > 0 && !undoRequest && !drawRequest;
  const isDrawRequester = drawRequest?.requester === player;
  const isDrawOpponent = drawRequest && drawRequest.requester !== player;

  // Timer turns red under 30s
  const isLowTime = timeRemaining !== null && timeRemaining <= 30;

  const inner = (
    <View style={styles.inner}>
      {/* LEFT — indicator + name + status */}
      <View style={styles.leftSide}>
        <View style={[styles.indicator, { backgroundColor: playerColor }]}>
          {isAI && <MaterialIcons name="smart-toy" size={8} color="#fff" />}
        </View>
        <View style={styles.nameContainer}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.text, fontFamily: fontBold }]}>
              {playerName}
            </Text>
            {isAI && isCurrentTurn ? (
              <Text style={[styles.subText, { color: theme.accent, fontFamily: fontBold }]}>
                {' '}Thinking...
              </Text>
            ) : !isAI && isCurrentTurn ? (
              <Text style={[styles.subText, { color: theme.accent, fontFamily: fontBold }]}>
                {' '}· turn
              </Text>
            ) : (
              // Always reserve the space so height never shifts
              <Text style={[styles.subText, { color: 'transparent', fontFamily: fontBold }]}>
                {' '}· turn
              </Text>
            )}
          </View>
          {/* Status row — fixed height via minHeight */}
          <View style={styles.statusRow}>
            {isUndoRequester ? (
              <Text style={[styles.statusText, { color: theme.text }]}>Undo Requested...</Text>
            ) : isDrawRequester ? (
              <Text style={[styles.statusText, { color: theme.text }]}>Draw Requested...</Text>
            ) : (
              <Text style={[styles.statusText, { color: 'transparent' }]}>placeholder</Text>
            )}
          </View>
        </View>
      </View>

      {/* CENTER — Timer (always rendered, hidden when no timer) */}
      <View style={styles.centerSection}>
        {timeRemaining !== null ? (
          <View style={[
            styles.timerPill,
            {
              borderColor: isLowTime ? '#EF4444' : playerColor,
              backgroundColor: isLowTime ? '#EF4444' : playerColor,
              borderWidth: 1.5,
            }
          ]}>
            <MaterialIcons
              name="schedule"
              size={14}
              color={isLowTime ? '#FFFFFF' : '#000'}
            />
            <Text style={[
              styles.timerText,
              {
                color: isLowTime ? '#FFFFFF' : '#000',
                fontFamily: fontMono ?? fontBold,
              }
            ]}>
              {formatTime(timeRemaining)}
            </Text>
          </View>
        ) : (
          // Reserve space even when no timer
          <View style={styles.timerPill} />
        )}
      </View>

      {/* RIGHT — Actions */}
      <View style={styles.actions}>
        {/* Always render a fixed-size actions area to prevent layout shift */}
        {winner === 0 && !isAI && (
          <>
            {isUndoOpponent ? (
              <View style={styles.actionGroup}>
                <TouchableOpacity onPress={onAcceptUndo} activeOpacity={0.7} style={[styles.actionButton, styles.acceptButton]}>
                  <MaterialIcons name="check" size={16} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onDeclineUndo} activeOpacity={0.7} style={[styles.actionButton, styles.declineButton]}>
                  <MaterialIcons name="close" size={16} color="white" />
                </TouchableOpacity>
              </View>
            ) : isDrawOpponent ? (
              <View style={styles.actionGroup}>
                <TouchableOpacity onPress={onAcceptDraw} activeOpacity={0.7} style={[styles.actionButton, styles.acceptButton]}>
                  <MaterialIcons name="check" size={16} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onDeclineDraw} activeOpacity={0.7} style={[styles.actionButton, styles.declineButton]}>
                  <MaterialIcons name="close" size={16} color="white" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.actionGroup}>
                <TouchableOpacity
                  onPress={onCall}
                  disabled={!canCall}
                  activeOpacity={0.7}
                  style={[styles.actionButton, styles.callButton, !canCall && styles.disabledButton, { backgroundColor: canCall ? theme.text : '#D1D5DB' }]}
                >
                  <MaterialIcons name="record-voice-over" size={16} color={canCall ? 'white' : '#9CA3AF'} />
                  <Text style={[styles.buttonText, { fontFamily: fontBold, color: canCall ? 'white' : '#9CA3AF' }]}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onRequestUndo}
                  disabled={!canRequestUndoForPlayer}
                  activeOpacity={0.7}
                  style={[styles.actionButton, styles.undoButton, !canRequestUndoForPlayer && styles.disabledButton, { backgroundColor: canRequestUndoForPlayer ? '#F59E0B' : '#D1D5DB' }]}
                >
                  <MaterialIcons name="undo" size={16} color={canRequestUndoForPlayer ? 'white' : '#9CA3AF'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onRequestDraw} activeOpacity={0.7} style={[styles.actionButton, styles.drawButton]}>
                  <MaterialIcons name="handshake" size={16} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onResign} activeOpacity={0.7} style={[styles.actionButton, styles.resignButton]}>
                  <MaterialIcons name="flag" size={16} color="white" />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );

  return (
    <View style={[
      styles.outer,
      isTop
        ? { borderTopLeftRadius: 10, borderTopRightRadius: 10 }
        : { borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
      isWinner && styles.winnerBar,
      {
        backgroundColor: isWinner ? '#FFFDF5' : theme.board,
        borderWidth: 3,
        borderColor: isWinner ? '#FFD700' : playerColor,
      },
    ]}>
      {shouldRotate ? <View style={styles.rotated}>{inner}</View> : inner}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    overflow: 'hidden',
  },
  rotated: {
    transform: [{ rotate: '180deg' }],
  },
  inner: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  winnerBar: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 10,
  },
  leftSide: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameContainer: {},
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 17,
  },
  subText: {
    fontSize: 12,
  },
  statusRow: {
    minHeight: 16,
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 11,
    marginTop: 1,
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    minWidth: 80,
    justifyContent: 'center',
    minHeight: 30,
  },
  timerText: {
    fontSize: 13,
  },
  actions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  actionGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButton: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 38,
  },
  buttonText: {
    fontSize: 13,
    color: 'white',
  },
  callButton: { backgroundColor: '#000' },
  undoButton: { backgroundColor: '#F59E0B', paddingHorizontal: 12 },
  drawButton: { backgroundColor: '#3B82F6', paddingHorizontal: 12 },
  resignButton: { backgroundColor: '#EF4444', paddingHorizontal: 12 },
  acceptButton: { backgroundColor: '#10B981', paddingHorizontal: 12 },
  declineButton: { backgroundColor: '#EF4444', paddingHorizontal: 12 },
  disabledButton: { opacity: 0.5 },
});