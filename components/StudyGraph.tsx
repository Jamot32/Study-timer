import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import {
  dailyTotals,
  dayKey,
  formatDuration,
  getWeekStart,
  type StudySession,
  type WeekStart,
} from '@/lib/sessions';

const WEEKS = 12;

/** zinc-800 → zinc-100. Monochrome to match the rest of the app. */
const LEVEL_CLASS = ['bg-zinc-800/70', 'bg-zinc-700', 'bg-zinc-500', 'bg-zinc-300', 'bg-zinc-100'];

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
    <View className="gap-2.5">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-base font-medium text-zinc-200">Last 12 Weeks</Text>
        <Text className="text-xs text-zinc-500">
          {formatDuration(totalMs)} over {activeDays} {activeDays === 1 ? 'day' : 'days'}
        </Text>
      </View>

      <View className="flex-row gap-1.5">
        {columns.map((week, w) => (
          <View key={w} className="flex-1 gap-1">
            {week.map((day) => (
              <View
                key={day.key}
                accessibilityLabel={`${day.key}: ${formatDuration(day.ms)} studied`}
                className={`aspect-square rounded-[2px] ${
                  day.future ? 'bg-transparent' : LEVEL_CLASS[level(day.ms, maxMs)]
                }`}
              />
            ))}
          </View>
        ))}
      </View>

      <View className="flex-row items-center justify-end gap-1">
        <Text className="text-[10px] text-zinc-600 mr-0.5">Less</Text>
        {LEVEL_CLASS.map((cls) => (
          <View key={cls} className={`w-2.5 h-2.5 rounded-[2px] ${cls}`} />
        ))}
        <Text className="text-[10px] text-zinc-600 ml-0.5">More</Text>
      </View>
    </View>
  );
}
