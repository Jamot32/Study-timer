import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import StudyGraph from '@/components/StudyGraph';
import {
  formatDuration,
  getWeekStart,
  loadSessions,
  sessionsForDay,
  totals,
  type StudySession,
  type WeekStart,
} from '@/lib/sessions';
import { DEFAULT_SETTINGS, loadSettings, type Settings } from '@/lib/settings';

export interface DashboardProps {
  isActive?: boolean;
  refreshKey?: number;
}

function formatStartTime(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getBestDayOfWeek(
  sessions: StudySession[],
  weekStartsOn: WeekStart,
  now = new Date()
): number {
  const start = getWeekStart(now, weekStartsOn);

  let maxMs = 0;
  for (let i = 0; i < 7; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const daySessions = sessionsForDay(sessions, day);
    const { todayMs: dayTotalMs } = totals(daySessions, day, weekStartsOn);
    if (dayTotalMs > maxMs) {
      maxMs = dayTotalMs;
    }
  }
  return maxMs;
}

export default function Dashboard({ isActive = true, refreshKey = 0 }: DashboardProps) {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const [data, prefs] = await Promise.all([loadSessions(), loadSettings()]);
      setSessions(data);
      setSettings(prefs);
    } catch (error) {
      console.error('Failed to load study sessions:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (isActive) {
      fetchSessions();
    }
  }, [isActive, refreshKey, fetchSessions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSessions();
  }, [fetchSessions]);

  const { todayMs, weekMs, monthMs } = useMemo(
    () => totals(sessions, undefined, settings.weekStartsOn),
    [sessions, settings.weekStartsOn]
  );
  const todaySessions = useMemo(() => sessionsForDay(sessions), [sessions]);
  const bestDayMs = useMemo(
    () => getBestDayOfWeek(sessions, settings.weekStartsOn),
    [sessions, settings.weekStartsOn]
  );
  const progressPercent = bestDayMs > 0 ? Math.min(100, Math.round((todayMs / bestDayMs) * 100)) : 0;

  const hasAnySessions = sessions.length > 0;

  const renderItem = useCallback(({ item }: { item: StudySession }) => {
    const subjectLabel = item.subject && item.subject.trim() ? item.subject : 'Unlabeled';
    const startTimeLabel = formatStartTime(item.startedAt);

    return (
      <Card className="py-3 px-4 flex-row items-center justify-between border-border/60 bg-zinc-900/50">
        <View className="flex-1 mr-3">
          <Text className="font-medium text-base text-zinc-100">{subjectLabel}</Text>
          {startTimeLabel ? (
            <Text className="text-xs text-zinc-500 mt-0.5">
              Started at {startTimeLabel}
            </Text>
          ) : null}
        </View>
        <Text className="text-base font-semibold text-zinc-100">
          {formatDuration(item.durationMs)}
        </Text>
      </Card>
    );
  }, []);

  const renderItemSeparator = useCallback(() => <Separator className="my-1.5" />, []);

  const listHeader = (
    <View className="gap-5 pb-4">
      <View className="pt-2">
        <Text className="text-2xl font-semibold tracking-tight text-zinc-100">Study Stats</Text>
        <Text className="text-xs text-zinc-500 mt-0.5">
          Overview of your focused study time
        </Text>
      </View>

      {/* Totals Section */}
      <View className="flex-row gap-2.5">
        <Card className="flex-1 py-4 px-2.5 items-center justify-center border-border/60 bg-zinc-900/50">
          <Text className="text-[11px] font-medium uppercase tracking-widest text-zinc-500 mb-1">
            Today
          </Text>
          <Text className="text-lg font-semibold text-zinc-100 text-center">
            {formatDuration(todayMs)}
          </Text>
        </Card>

        <Card className="flex-1 py-4 px-2.5 items-center justify-center border-border/60 bg-zinc-900/50">
          <Text className="text-[11px] font-medium uppercase tracking-widest text-zinc-500 mb-1">
            This Week
          </Text>
          <Text className="text-lg font-semibold text-zinc-100 text-center">
            {formatDuration(weekMs)}
          </Text>
        </Card>

        <Card className="flex-1 py-4 px-2.5 items-center justify-center border-border/60 bg-zinc-900/50">
          <Text className="text-[11px] font-medium uppercase tracking-widest text-zinc-500 mb-1">
            This Month
          </Text>
          <Text className="text-lg font-semibold text-zinc-100 text-center">
            {formatDuration(monthMs)}
          </Text>
        </Card>
      </View>

      {/* Contribution-style heatmap of daily study time */}
      <StudyGraph sessions={sessions} weekStartsOn={settings.weekStartsOn} />

      {/* Progress against best day this week */}
      {bestDayMs > 0 ? (
        <View className="gap-1.5">
          <Progress value={progressPercent} className="bg-zinc-800" indicatorClassName="bg-zinc-100" />
          <Text className="text-xs text-zinc-500">
            vs. your best day this week — {formatDuration(bestDayMs)}
          </Text>
        </View>
      ) : null}

      {/* Separator between totals block and session list */}
      <Separator />

      {/* Sessions Section Header */}
      <View className="flex-row items-center justify-between pt-1">
        <Text className="text-base font-medium text-zinc-200">Today's Sessions</Text>
        {todaySessions.length > 0 ? (
          <Text className="text-xs text-zinc-500">
            {todaySessions.length} {todaySessions.length === 1 ? 'session' : 'sessions'}
          </Text>
        ) : null}
      </View>

      {/* Global empty state when zero sessions have ever been recorded */}
      {!hasAnySessions && (
        <Card className="p-6 items-center border-dashed border-border/60 bg-zinc-900/20">
          <CardHeader className="p-0 items-center">
            <CardTitle className="text-base text-center text-zinc-200">No study sessions yet</CardTitle>
            <CardDescription className="text-center text-xs mt-1.5 leading-5 text-zinc-500">
              When you complete a study session (at least 1 minute) and tap Finish, your recorded time
              and daily, weekly, and monthly totals will appear here.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </View>
  );

  const listEmptyComponent = hasAnySessions ? (
    <Card className="p-5 items-center justify-center border-dashed border-border/60 bg-zinc-900/20">
      <Text className="text-xs text-zinc-500 text-center">
        No sessions logged today yet. Start a session to track today's progress!
      </Text>
    </Card>
  ) : null;

  return (
    <View className="flex-1 w-full px-4">
      <FlatList
        data={todaySessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={renderItemSeparator}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmptyComponent}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#a1a1aa"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
