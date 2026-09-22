import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import StudyGraph from '@/components/StudyGraph';
import { Card, ProgressBar, RADIUS, T } from '@/components/nova';
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
  /** Back to the timer. */
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
      <Card level={1} style={styles.sessionGap} boxStyle={styles.sessionRow}>
        <View style={styles.sessionDot} />
        <View style={styles.sessionText}>
          <Text style={styles.sessionSubject} numberOfLines={1}>
            {subjectLabel}
          </Text>
          {startTimeLabel ? (
            <Text style={styles.sessionTime}>Started {startTimeLabel}</Text>
          ) : null}
        </View>
        <Text style={styles.sessionDuration} numberOfLines={1}>
          {formatDuration(item.durationMs)}
        </Text>
      </Card>
    );
  }, []);

  const stat = (label: string, ms: number, highlight = false) => (
    <Card
      level={0}
      tone={highlight ? 'primary' : 'alt'}
      radius={RADIUS.lg}
      style={styles.statWrap}
      boxStyle={styles.statBox}
    >
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[styles.statValue, highlight && styles.statValueHighlight]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatDuration(ms)}
      </Text>
    </Card>
  );

  const listHeader = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            Study stats
          </Text>
          <Text style={styles.subtitle}>An overview of your focused time.</Text>
        </View>
      </View>

      <View style={styles.statRow}>
        {stat('Today', todayMs, true)}
        {stat('Week', weekMs)}
        {stat('Month', monthMs)}
      </View>

      <StudyGraph sessions={sessions} weekStartsOn={settings.weekStartsOn} />

      {bestDayMs > 0 ? (
        <Card level={1} boxStyle={styles.progressBox}>
          <View style={styles.progressHeader}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Versus your best day
            </Text>
            <Text style={styles.progressValue}>{progressPercent}%</Text>
          </View>
          <View style={styles.progressBlock}>
            <ProgressBar value={progressPercent / 100} />
          </View>
          <Text style={styles.caption}>Best this week — {formatDuration(bestDayMs)}</Text>
        </Card>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Today's sessions
        </Text>
        {todaySessions.length > 0 ? (
          <Text style={styles.caption}>
            {todaySessions.length} {todaySessions.length === 1 ? 'session' : 'sessions'}
          </Text>
        ) : null}
      </View>

      {!hasAnySessions && (
        <Card level={0} tone="alt" boxStyle={styles.emptyBox}>
          <Text style={styles.emptyTitle} accessibilityRole="header">
            No study sessions yet
          </Text>
          <Text style={styles.emptyBody}>
            Finish a session of at least 1 minute and your totals will show up here.
          </Text>
        </Card>
      )}
    </View>
  );

  const listEmptyComponent = hasAnySessions ? (
    <Card level={0} tone="alt" boxStyle={styles.emptyBox}>
      <Text style={styles.emptyBody}>
        No sessions logged today yet. Start one to track today's progress.
      </Text>
    </Card>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', backgroundColor: T.bg, paddingHorizontal: 16, paddingTop: 8 },
  header: { gap: 22, paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1 },
  title: { fontFamily: T.fontDisplay, fontSize: 28, color: T.ink, letterSpacing: -0.4 },
  subtitle: { fontFamily: T.font, fontSize: 14, color: T.muted, marginTop: 4 },

  statRow: { flexDirection: 'row', gap: 10 },
  statWrap: { flex: 1 },
  statBox: { paddingVertical: 16, paddingHorizontal: 10, alignItems: 'flex-start' },
  statLabel: {
    fontFamily: T.fontMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: T.muted,
  },
  statValue: { fontFamily: T.fontDisplay, fontSize: 20, color: T.ink, marginTop: 8 },
  statValueHighlight: { color: T.primaryDeep },

  progressBox: { padding: 16 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressValue: { fontFamily: T.fontDisplay, fontSize: 20, color: T.primaryDeep },
  progressBlock: { marginVertical: 14 },
  caption: { fontFamily: T.font, fontSize: 12, color: T.muted },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: T.fontMedium, fontSize: 16, color: T.ink },

  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  sessionGap: { marginBottom: 10 },
  sessionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.accent },
  sessionText: { flex: 1 },
  sessionSubject: { fontFamily: T.fontMedium, fontSize: 15, color: T.ink },
  sessionTime: { fontFamily: T.font, fontSize: 12, color: T.muted, marginTop: 3 },
  sessionDuration: { fontFamily: T.fontDisplay, fontSize: 16, color: T.primaryDeep },

  emptyBox: { padding: 18 },
  emptyTitle: { fontFamily: T.fontMedium, fontSize: 15, color: T.ink },
  emptyBody: { fontFamily: T.font, fontSize: 13, lineHeight: 20, color: T.muted, marginTop: 6 },
});
