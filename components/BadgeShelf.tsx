import { Lock } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PixelBox, T } from '@/components/pixel';
import { countEarned, evaluateBadges, type StudyStats } from '@/lib/progress';
import type { StudySession } from '@/lib/sessions';

export interface BadgeShelfProps {
  sessions: StudySession[];
  stats: StudyStats;
}

/**
 * The achievement list. Earned badges come first so the shelf doubles as a
 * to-do list: what is left, and exactly what it takes.
 */
export default function BadgeShelf({ sessions, stats }: BadgeShelfProps) {
  const badges = useMemo(() => {
    // sort is stable, so the catalog order survives inside each group
    const evaluated = evaluateBadges(sessions, stats);
    return [...evaluated].sort((a, b) => Number(b.earned) - Number(a.earned));
  }, [sessions, stats]);
  const earned = countEarned(badges);

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.title} accessibilityRole="header">
          BADGES
        </Text>
        <Text style={styles.count}>
          {earned}/{badges.length}
        </Text>
      </View>

      <View style={styles.list}>
        {badges.map((badge) => (
          <PixelBox
            key={badge.id}
            shadow={2}
            boxStyle={[styles.row, !badge.earned && styles.lockedRow]}
          >
            <View
              style={styles.content}
              accessibilityLabel={`${badge.label} — ${
                badge.earned ? 'earned' : `locked, ${badge.requirement}`
              }`}
            >
              <Text style={[styles.glyph, !badge.earned && styles.lockedGlyph]}>{badge.glyph}</Text>
              <View style={styles.text}>
                <Text
                  style={[styles.label, !badge.earned && styles.lockedText]}
                  numberOfLines={1}
                >
                  {badge.label}
                </Text>
                <Text style={styles.requirement} numberOfLines={1}>
                  {badge.requirement}
                </Text>
              </View>
              {badge.earned ? null : <Lock size={14} color={T.muted} />}
            </View>
          </PixelBox>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: T.fontPixel, fontSize: 10, color: T.ink },
  count: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted },

  list: { gap: 8, marginTop: 12 },
  // earned badges sit on the secondary panel; locked ones recede to the page
  row: { backgroundColor: T.secondary },
  lockedRow: { backgroundColor: T.bg },
  content: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  glyph: { fontSize: 20 },
  lockedGlyph: { opacity: 0.35 },
  text: { flex: 1 },
  label: { fontFamily: T.fontPixel, fontSize: 8, color: T.ink },
  lockedText: { color: T.muted },
  requirement: { fontFamily: T.fontPixel, fontSize: 7, lineHeight: 12, color: T.muted, marginTop: 6 },
});
