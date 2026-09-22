import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, RADIUS, T } from '@/components/nova';
import {
  dailyTotals,
  dayKey,
  formatDuration,
  getWeekStart,
  type StudySession,
  type WeekStart,
} from '@/lib/sessions';

const WEEKS = 12;

/** 빈 날 → 가장 바쁜 날. 옅은 잎사귀에서 시작해 깊은 앰버로 익는 램프. */
const LEVEL_COLOR = [T.bgSunk, T.accentSoft, '#C9D4B4', '#DCC078', T.primary];

export interface StudyGraphProps {
  sessions: StudySession[];
  weekStartsOn: WeekStart;
}

/** 0 for no study, else 1–4 bucketed against the busiest day in range. */
function level(ms: number, maxMs: number): number {
  if (ms <= 0 || maxMs <= 0) return 0;
  return Math.min(4, Math.ceil((ms / maxMs) * 4));
}

export default function StudyGraph({ sessions, weekStartsOn }: StudyGraphProps) {
  const { columns, maxMs, totalMs, activeDays } = useMemo(() => {
    const byDay = dailyTotals(sessions);
    const thisWeek = getWeekStart(new Date(), weekStartsOn);
    const gridStart = new Date(
      thisWeek.getFullYear(),
      thisWeek.getMonth(),
      thisWeek.getDate() - (WEEKS - 1) * 7
    );
    const today = dayKey(new Date());

    const columns: { key: string; ms: number; future: boolean }[][] = [];
    let maxMs = 0;
    let totalMs = 0;
    let activeDays = 0;

    for (let w = 0; w < WEEKS; w++) {
      const week: { key: string; ms: number; future: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(
          gridStart.getFullYear(),
          gridStart.getMonth(),
          gridStart.getDate() + w * 7 + d
        );
        const key = dayKey(date);
        const ms = byDay.get(key) ?? 0;
        if (ms > maxMs) maxMs = ms;
        if (ms > 0) {
          totalMs += ms;
          activeDays++;
        }
        week.push({ key, ms, future: key > today });
      }
      columns.push(week);
    }
    return { columns, maxMs, totalMs, activeDays };
  }, [sessions, weekStartsOn]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Last 12 weeks</Text>
        <Text style={styles.caption}>
          {formatDuration(totalMs)} · {activeDays} {activeDays === 1 ? 'day' : 'days'}
        </Text>
      </View>

      <Card level={0} tone="alt" radius={RADIUS.md} boxStyle={styles.grid}>
        {columns.map((week, w) => (
          <View key={w} style={styles.week}>
            {week.map((day) => (
              <View
                key={day.key}
                accessibilityLabel={`${day.key}: ${formatDuration(day.ms)} studied`}
                style={[
                  styles.cell,
                  day.future
                    ? { backgroundColor: 'transparent', borderColor: 'transparent' }
                    : { backgroundColor: LEVEL_COLOR[level(day.ms, maxMs)] },
                ]}
              />
            ))}
          </View>
        ))}
      </Card>

      <View style={styles.legend}>
        <Text style={styles.caption}>Less</Text>
        {LEVEL_COLOR.map((color) => (
          <View key={color} style={[styles.legendCell, { backgroundColor: color }]} />
        ))}
        <Text style={styles.caption}>More</Text>
      </View>
    </View>
  );

}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: T.fontMedium, fontSize: 15, color: T.ink },
  caption: { fontFamily: T.font, fontSize: 12, color: T.muted },
  grid: { flexDirection: 'row', gap: 3, padding: 8 },
  week: { flex: 1, gap: 3 },
  cell: { aspectRatio: 1, borderRadius: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  legendCell: { width: 11, height: 11, borderRadius: 3 },
});
