import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { T } from '@/components/pixel';
import {
  dailyTotals,
  dayKey,
  formatDuration,
  getWeekStart,
  type StudySession,
  type WeekStart,
} from '@/lib/sessions';

const WEEKS = 12;

/** Empty → busiest, on the pixel palette (cream → burnt orange). */
const LEVEL_COLOR = ['#e3dcc9', '#f2b98f', '#eb9463', '#d95b2e', '#a93d17'];

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
        <Text style={styles.title}>LAST 12 WEEKS</Text>
        <Text style={styles.caption}>
          {formatDuration(totalMs).toUpperCase()} / {activeDays} {activeDays === 1 ? 'DAY' : 'DAYS'}
        </Text>
      </View>

      <View style={styles.grid}>
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
      </View>

      <View style={styles.legend}>
        <Text style={styles.caption}>LESS</Text>
        {LEVEL_COLOR.map((color) => (
          <View key={color} style={[styles.legendCell, { backgroundColor: color }]} />
        ))}
        <Text style={styles.caption}>MORE</Text>
      </View>
    </View>
  );

}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: T.fontPixel, fontSize: 10, color: T.ink },
  caption: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted },
  grid: { flexDirection: 'row', gap: 3, borderWidth: 2, borderColor: T.ink, padding: 4 },
  week: { flex: 1, gap: 3 },
  cell: { aspectRatio: 1, borderWidth: 1, borderColor: T.ink },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  legendCell: { width: 10, height: 10, borderWidth: 1, borderColor: T.ink },
});
