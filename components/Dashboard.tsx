import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import StudyGraph from '@/components/StudyGraph';
import { PixelBox, PixelProgress, T } from '@/components/pixel';
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
    const subjectLabel = item.subject && item.subject.trim() ? item.subject : 'UNLABELED';
    const startTimeLabel = formatStartTime(item.startedAt);

    return (
      <PixelBox shadow={3} style={styles.sessionGap} boxStyle={styles.sessionRow}>
        <View style={styles.sessionText}>
          <Text style={styles.sessionSubject}>{subjectLabel.toUpperCase()}</Text>
          {startTimeLabel ? (
            <Text style={styles.sessionTime}>STARTED {startTimeLabel.toUpperCase()}</Text>
          ) : null}
        </View>
        <Text style={styles.sessionDuration}>{formatDuration(item.durationMs).toUpperCase()}</Text>
      </PixelBox>
    );
  }, []);

  const stat = (label: string, ms: number) => (
    <PixelBox shadow={4} style={styles.statWrap} boxStyle={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{formatDuration(ms).toUpperCase()}</Text>
    </PixelBox>
  );

  const listHeader = (
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>STUDY STATS</Text>
        <Text style={styles.subtitle}>OVERVIEW OF YOUR FOCUSED TIME</Text>
      </View>

      <View style={styles.statRow}>
        {stat('TODAY', todayMs)}
        {stat('WEEK', weekMs)}
        {stat('MONTH', monthMs)}
      </View>

      <StudyGraph sessions={sessions} weekStartsOn={settings.weekStartsOn} />

      {bestDayMs > 0 ? (
        <View style={styles.progressBlock}>
          <PixelProgress value={progressPercent / 100} />
          <Text style={styles.caption}>
            {progressPercent}% OF YOUR BEST DAY — {formatDuration(bestDayMs).toUpperCase()}
          </Text>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>TODAY'S SESSIONS</Text>
        {todaySessions.length > 0 ? (
          <Text style={styles.caption}>
            {todaySessions.length} {todaySessions.length === 1 ? 'SESSION' : 'SESSIONS'}
          </Text>
        ) : null}
      </View>

      {!hasAnySessions && (
        <PixelBox shadow={0} boxStyle={styles.emptyBox}>
          <Text style={styles.emptyTitle}>NO STUDY SESSIONS YET</Text>
          <Text style={styles.emptyBody}>
            Finish a session of at least 1 minute and your totals will show up here.
          </Text>
        </PixelBox>
      )}
    </View>
  );

  const listEmptyComponent = hasAnySessions ? (
    <PixelBox shadow={0} boxStyle={styles.emptyBox}>
      <Text style={styles.emptyBody}>
        No sessions logged today yet. Start one to track today's progress.
      </Text>
    </PixelBox>
  ) : null;

  return (
    <View style={styles.screen}>
      <FlatList
        data={todaySessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmptyComponent}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.ink} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', backgroundColor: T.bg, paddingHorizontal: 16, paddingTop: 12 },
  header: { gap: 22, paddingBottom: 18 },
  title: { fontFamily: T.fontPixel, fontSize: 14, color: T.ink },
  subtitle: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted, marginTop: 10 },

  statRow: { flexDirection: 'row', gap: 8 },
  statWrap: { flex: 1 },
  statBox: { paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center' },
  statLabel: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted },
  statValue: { fontFamily: T.fontPixel, fontSize: 11, color: T.ink, marginTop: 10 },

  progressBlock: { gap: 8 },
  caption: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: T.fontPixel, fontSize: 10, color: T.ink },

  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: T.secondary,
  },
  sessionGap: { marginBottom: 10 },
  sessionText: { flex: 1, marginRight: 12 },
  sessionSubject: { fontFamily: T.fontPixel, fontSize: 9, color: T.ink },
  sessionTime: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted, marginTop: 8 },
  sessionDuration: { fontFamily: T.fontPixel, fontSize: 9, color: T.primary },

  emptyBox: { padding: 16, backgroundColor: T.secondary },
  emptyTitle: { fontFamily: T.fontPixel, fontSize: 9, color: T.ink },
  emptyBody: { fontFamily: T.fontPixel, fontSize: 8, lineHeight: 14, color: T.muted, marginTop: 8 },
});
