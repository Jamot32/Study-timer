import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { T } from '@/components/pixel';
import { dayKey, formatDuration, sessionsForDay, type StudySession } from '@/lib/sessions';

// ============================================================
// THE SHELF — 공부한 기록을 책으로 꽂는다.
// 한 단이 하루다. 한 권이 한 판이고, 오래 앉았을수록 두껍고 키가 크다.
// 아무것도 안 한 날은 빈 단으로 남는다. 그 빈자리가 곧 기록이다.
// ============================================================

const DAYS = 7;

const W = 300;                 // viewBox 너비. 화면 폭에 맞춰 늘어난다.
const ROW_H = 46;              // 한 단 높이
const BOARD = 5;               // 선반 두께
const LABEL_W = 30;            // 왼쪽 날짜 칸
const PAD = 6;
const GAP = 2;                 // 책 사이

const MIN_W = 5;               // 아주 짧은 판도 한 권으로 보이게
const W_PER_HOUR = 26;         // 한 시간에 이만큼 두꺼워진다
const MAX_W = 40;
const MIN_H = 13;
const MAX_H = ROW_H - BOARD - 6;
const H_PER_HOUR = 11;

const HOUR_MS = 60 * 60 * 1000;

/** 과목이 같으면 색도 같다. 이름 없는 판은 가장 옅은 색. */
const SPINE_COLORS = [T.primary, '#4a6b8a', '#6f7d6a', '#8b5e83', '#a9781a', '#7a4a3a'];

/**
 * 색은 이름을 해시해서 고르지 않는다. 해시는 과목 서너 개가 같은 색으로
 * 겹쳐 버린다. 대신 기록에 처음 나온 차례대로 나눠 주어, 자주 쓰는 과목끼리는
 * 반드시 다른 색이 된다.
 */
function subjectOrder(sessions: StudySession[]): Map<string, number> {
  const order = new Map<string, number>();
  // 오래된 것부터 봐야 과목 차례가 날마다 뒤바뀌지 않는다
  for (let i = sessions.length - 1; i >= 0; i--) {
    const name = sessions[i].subject?.trim().toUpperCase();
    if (name && !order.has(name)) order.set(name, order.size);
  }
  return order;
}

function spineColor(subject: string | null, order: Map<string, number>): string {
  const name = subject?.trim().toUpperCase();
  if (!name) return T.secondary;
  return SPINE_COLORS[(order.get(name) ?? order.size) % SPINE_COLORS.length];
}

type Spine = { x: number; w: number; h: number; color: string; light: boolean };

/**
 * 하루치 책을 눕히지 않고 왼쪽부터 세운다. 다 합쳐 단보다 넓으면
 * 비율을 그대로 둔 채 통째로 줄여 넣는다. 그래야 긴 날이 짧아 보이지 않는다.
 */
function shelveDay(sessions: StudySession[], available: number, order: Map<string, number>): Spine[] {
  const raw = sessions.map((session) => {
    const hours = Math.max(0, session.durationMs) / HOUR_MS;
    return {
      w: Math.min(MAX_W, MIN_W + hours * W_PER_HOUR),
      h: Math.min(MAX_H, MIN_H + hours * H_PER_HOUR),
      color: spineColor(session.subject, order),
      light: session.subject === null,
    };
  });

  const total = raw.reduce((sum, book) => sum + book.w, 0) + GAP * Math.max(0, raw.length - 1);
  const scale = total > available && total > 0 ? available / total : 1;

  let x = 0;
  return raw.map((book) => {
    const w = Math.max(2, book.w * scale);
    const spine = { ...book, w, x };
    x += w + GAP * scale;
    return spine;
  });
}

export interface HistoryShelfProps {
  sessions: StudySession[];
}

export default function HistoryShelf({ sessions }: HistoryShelfProps) {
  const rows = useMemo(() => {
    const today = new Date();
    const available = W - LABEL_W - PAD * 2;
    const order = subjectOrder(sessions);
    return Array.from({ length: DAYS }, (_, i) => {
      const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      // 꽂힌 차례는 그날 앉은 차례. 이른 판이 왼쪽이다.
      const daySessions = sessionsForDay(sessions, day).slice().reverse();
      const totalMs = daySessions.reduce((sum, s) => sum + s.durationMs, 0);
      return {
        key: dayKey(day),
        label: i === 0 ? 'TODAY' : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][day.getDay()],
        books: shelveDay(daySessions, available, order),
        totalMs,
      };
    });
  }, [sessions]);

  const height = DAYS * ROW_H + BOARD;
  const shelved = rows.reduce((sum, row) => sum + row.books.length, 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">THE SHELF</Text>
        <Text style={styles.caption}>
          {shelved} {shelved === 1 ? 'BOOK' : 'BOOKS'} THIS WEEK
        </Text>
      </View>

      <View
        style={styles.stage}
        accessibilityRole="image"
        accessibilityLabel={`A shelf of the last ${DAYS} days. ${rows
          .map((row) => `${row.label}: ${row.books.length} sessions, ${formatDuration(row.totalMs)}`)
          .join('. ')}`}
      >
        <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`}>
          {rows.map((row, i) => {
            const top = i * ROW_H;
            const boardY = top + ROW_H - BOARD;
            const left = LABEL_W + PAD;
            return (
              <G key={row.key}>
                <SvgText
                  x={PAD}
                  y={boardY - 3}
                  fill={row.totalMs > 0 ? T.ink : T.muted}
                  fontSize={6}
                  fontFamily={T.fontPixel}
                >
                  {row.label}
                </SvgText>

                {row.books.map((book, k) => (
                  <G key={k}>
                    <Rect
                      x={left + book.x}
                      y={boardY - book.h}
                      width={book.w}
                      height={book.h}
                      fill={book.color}
                      stroke={T.ink}
                      strokeWidth={1}
                    />
                    {/* 책등 띠. 좁은 책엔 넣지 않는다. 선이 책을 덮어 버린다. */}
                    {book.w >= 9 ? (
                      <Line
                        x1={left + book.x + 2}
                        y1={boardY - book.h + 5}
                        x2={left + book.x + book.w - 2}
                        y2={boardY - book.h + 5}
                        stroke={book.light ? T.muted : T.primaryFg}
                        strokeWidth={1}
                        opacity={0.8}
                      />
                    ) : null}
                  </G>
                ))}

                <Rect x={0} y={boardY} width={W} height={BOARD} fill={T.ink} />
              </G>
            );
          })}
        </Svg>
      </View>

      <Text style={styles.legend}>EACH BOOK IS ONE SESSION. LONGER SESSIONS ARE THICKER.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontFamily: T.fontPixel, fontSize: 10, color: T.ink },
  caption: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted },
  stage: { borderWidth: 4, borderColor: T.ink, backgroundColor: T.bg, padding: 4 },
  legend: { fontFamily: T.fontPixel, fontSize: 7, lineHeight: 12, color: T.muted, marginTop: 8 },
});
