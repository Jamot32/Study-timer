import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { Button, Card, RADIUS, T, Tap } from '@/components/nova';
import { confirmDestructive } from '@/lib/confirm';
import { clearProfile, type Profile } from '@/lib/auth';
import { Avatar } from '@/components/Avatar';
import { clearSessions } from '@/lib/sessions';
import { loadSettings, saveSettings, type Settings as SettingsValue } from '@/lib/settings';

const WEEK_START_CHOICES = [
  { label: 'Monday', value: 1 as const },
  { label: 'Sunday', value: 0 as const },
];

function Segmented<T_ extends string | number>({
  choices,
  value,
  onChange,
}: {
  choices: { label: string; value: T_ }[];
  value: T_;
  onChange: (value: T_) => void;
}) {
  return (
    <View style={styles.segmented}>
      {choices.map((choice) => {
        const selected = choice.value === value;
        return (
          <Tap
            key={String(choice.value)}
            accessibilityState={{ selected }}
            onPress={() => onChange(choice.value)}
            style={[styles.segment, selected ? styles.segmentSelected : null]}
          >
            <Text
              style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}
              numberOfLines={1}
            >
              {choice.label}
            </Text>
          </Tap>
        );
      })}
    </View>
  );
}

export interface SettingsProps {
  /** Called after a change that the dashboard's numbers depend on. */
  onChanged?: () => void;
  /** 배틀 화면에서 열렸을 때 돌아가는 길. */
  onBack?: () => void;
  /** Back to the timer. */
  /** The signed-in (local) profile. */
  profile?: Profile;
  /** Opens the profile editor. */
  onEditProfile?: () => void;
  /** Called after the profile is cleared. */
  onSignOut?: () => void;
}

export default function Settings({
  onChanged,
  onBack,
  profile,
  onEditProfile,
  onSignOut,
}: SettingsProps) {
  const [settings, setSettings] = useState<SettingsValue | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const update = useCallback(
    async (patch: Partial<SettingsValue>) => {
      setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
      await saveSettings(patch);
      onChanged?.();
    },
    [onChanged]
  );

  const handleClear = useCallback(() => {
    confirmDestructive(
      'Clear all history?',
      'Every saved study session will be deleted. This cannot be undone.',
      'Delete All',
      async () => {
        await clearSessions();
        onChanged?.();
      }
    );
  }, [onChanged]);

  const handleSignOut = useCallback(async () => {
    await clearProfile();
    onSignOut?.();
  }, [onSignOut]);

  if (!settings) return null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.body}>
        <View style={styles.headerRow}>
          {onBack ? (
            <Button
              size="icon"
              variant="ghost"
              onPress={onBack}
              accessibilityLabel="Back"
              style={styles.backBtn}
            >
              <ArrowLeft size={21} color={T.inkSoft} />
            </Button>
          ) : null}
          <View style={styles.headerText}>
            <Text style={styles.title} accessibilityRole="header">
              Settings
            </Text>
            <Text style={styles.subtitle}>Week boundary, profile and stored history.</Text>
          </View>
        </View>

        <Card level={1} boxStyle={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            Week starts on
          </Text>
          <Text style={styles.cardDesc}>Sets the boundary for your weekly total.</Text>
          <Segmented
            choices={WEEK_START_CHOICES}
            value={settings.weekStartsOn}
            onChange={(weekStartsOn) => update({ weekStartsOn })}
          />
        </Card>

        {profile ? (
          <Card level={1} boxStyle={styles.card}>
            <Text style={styles.cardTitle} accessibilityRole="header">
              Profile
            </Text>
            <Text style={styles.cardDesc}>
              Signed in as {profile.name}. This device only — nothing is synced yet.
            </Text>

            <View style={styles.previewRow}>
              <Avatar profile={profile} size={56} />
              <View style={styles.previewText}>
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {profile.title || 'Username'}
                </Text>
                <Text style={styles.previewName} numberOfLines={1}>
                  {profile.name}
                </Text>
              </View>
            </View>

            <Button block variant="primary" onPress={onEditProfile} style={styles.actionGap}>
              Edit profile
            </Button>
            <Button block variant="outline" onPress={handleSignOut} style={styles.actionGap}>
              Sign out
            </Button>
          </Card>
        ) : null}

        <Card level={1} boxStyle={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            Study history
          </Text>
          <Text style={styles.cardDesc}>Sessions are stored on this device only.</Text>
          <Button block variant="outline" onPress={handleClear} style={styles.actionGap}>
            Clear all history
          </Button>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', backgroundColor: T.bg, paddingHorizontal: 16, paddingTop: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerText: { flex: 1 },
  backBtn: { marginLeft: -10 },
  body: { gap: 16 },
  title: { fontFamily: T.fontDisplay, fontSize: 31, color: T.ink, letterSpacing: -0.4 },
  subtitle: { fontFamily: T.font, fontSize: 16, color: T.muted, marginTop: 4 },

  card: { padding: 18 },
  cardTitle: { fontFamily: T.fontMedium, fontSize: 18, color: T.ink },
  cardDesc: { fontFamily: T.font, fontSize: 15, lineHeight: 20, color: T.muted, marginTop: 6 },

  // 트랙 안에서 알약이 미끄러지는 세그먼트. 테두리 대신 면으로 선택을 보인다.
  segmented: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 16,
    padding: 4,
    borderRadius: RADIUS.md,
    backgroundColor: T.bgSunk,
  },
  segment: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  segmentSelected: { backgroundColor: T.card },
  segmentLabel: { fontFamily: T.fontMedium, fontSize: 16, color: T.muted },
  segmentLabelSelected: { color: T.ink },

  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 },
  previewText: { flex: 1 },
  previewTitle: {
    fontFamily: T.fontMedium,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: T.muted,
  },
  previewName: { fontFamily: T.fontDisplay, fontSize: 21, color: T.ink, marginTop: 4 },

  actionGap: { marginTop: 12 },
});
