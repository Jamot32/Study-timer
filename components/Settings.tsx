import { ArrowLeft } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PixelBox, PixelButton, T } from '@/components/pixel';
import { confirmDestructive } from '@/lib/confirm';
import { clearProfile } from '@/lib/auth';
import { clearSessions } from '@/lib/sessions';
import { loadSettings, saveSettings, type Settings as SettingsValue } from '@/lib/settings';

const WEEK_START_CHOICES = [
  { label: 'MONDAY', value: 1 as const },
  { label: 'SUNDAY', value: 0 as const },
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
          <PixelButton
            key={String(choice.value)}
            shadow={2}
            color={selected ? T.primary : T.bg}
            accessibilityState={{ selected }}
            onPress={() => onChange(choice.value)}
            style={styles.segment}
            boxStyle={styles.segmentBox}
          >
            <Text
              style={[styles.segmentLabel, { color: selected ? T.primaryFg : T.muted }]}
              numberOfLines={1}
            >
              {choice.label.toUpperCase()}
            </Text>
          </PixelButton>
        );
      })}
    </View>
  );
}

export interface SettingsProps {
  /** Called after a change that the dashboard's numbers depend on. */
  onChanged?: () => void;
  /** Back to the timer. */
  onBack?: () => void;
  /** Name of the signed-in (local) profile. */
  profileName?: string;
  /** Called after the profile is cleared. */
  onSignOut?: () => void;
}

export default function Settings({ onChanged, onBack, profileName, onSignOut }: SettingsProps) {
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
      <PixelBox shadow={6} boxStyle={styles.frame}>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title} accessibilityRole="header">
              CONFIG
            </Text>
            <Text style={styles.subtitle}>WEEK BOUNDARY AND STORED HISTORY</Text>
          </View>
          <PixelButton
            shadow={0}
            color={T.secondary}
            onPress={onBack}
            accessibilityLabel="Back to timer"
            boxStyle={styles.backBox}
          >
            <ArrowLeft size={20} color={T.ink} />
          </PixelButton>
        </View>

        <PixelBox shadow={0} boxStyle={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            WEEK STARTS ON
          </Text>
          <Text style={styles.cardDesc}>Sets the boundary for the WEEK total.</Text>
          <Segmented
            choices={WEEK_START_CHOICES}
            value={settings.weekStartsOn}
            onChange={(weekStartsOn) => update({ weekStartsOn })}
          />
        </PixelBox>

        {profileName ? (
          <PixelBox shadow={0} boxStyle={styles.card}>
            <Text style={styles.cardTitle} accessibilityRole="header">
              ACCOUNT
            </Text>
            <Text style={styles.cardDesc}>
              SIGNED IN AS {profileName.toUpperCase()}. THIS DEVICE ONLY — NOTHING IS SYNCED YET.
            </Text>
            <PixelButton
              shadow={2}
              color={T.bg}
              onPress={handleSignOut}
              style={styles.clearWrap}
              boxStyle={styles.clearBox}
            >
              <Text style={styles.clearLabel}>SIGN OUT</Text>
            </PixelButton>
          </PixelBox>
        ) : null}

        <PixelBox shadow={0} boxStyle={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            STUDY HISTORY
          </Text>
          <Text style={styles.cardDesc}>Sessions are stored on this device only.</Text>
          <PixelButton
            shadow={2}
            color={T.bg}
            onPress={handleClear}
            style={styles.clearWrap}
            boxStyle={styles.clearBox}
          >
            <Text style={styles.clearLabel}>CLEAR ALL HISTORY</Text>
          </PixelButton>
        </PixelBox>
      </View>
      </PixelBox>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', backgroundColor: T.bg, paddingHorizontal: 16, paddingTop: 4 },
  frame: { padding: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1 },
  backBox: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { gap: 18 },
  title: { fontFamily: T.fontPixel, fontSize: 13, color: T.ink },
  subtitle: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted, marginTop: 10 },

  card: { padding: 14, backgroundColor: T.secondary },
  // cards are flat panels inside the frame, matching the timer's break-bank card
  cardTitle: { fontFamily: T.fontPixel, fontSize: 9, color: T.ink },
  cardDesc: { fontFamily: T.fontPixel, fontSize: 8, lineHeight: 14, color: T.muted, marginTop: 8 },

  segmented: { flexDirection: 'row', gap: 8, marginTop: 14 },
  segment: { flex: 1 },
  segmentBox: { height: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  segmentLabel: { fontFamily: T.fontPixel, fontSize: 8 },

  clearWrap: { marginTop: 14 },
  clearBox: { height: 40, alignItems: 'center', justifyContent: 'center' },
  clearLabel: { fontFamily: T.fontPixel, fontSize: 8, color: T.ink },
});
