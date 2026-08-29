import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { confirmDestructive } from '@/lib/confirm';
import { clearSessions } from '@/lib/sessions';
import {
  loadSettings,
  MIN_SESSION_CHOICES,
  saveSettings,
  type Settings as SettingsValue,
} from '@/lib/settings';
import { cn } from '@/lib/utils';

const WEEK_START_CHOICES = [
  { label: 'Monday', value: 1 as const },
  { label: 'Sunday', value: 0 as const },
];

// ponytail: no shadow-* on the selected segment — NativeWind 4.2.6 wedges the
// iOS JS thread when a shadow class is toggled at runtime. See components/ui/tabs.tsx.
function Segmented<T>({
  choices,
  value,
  onChange,
}: {
  choices: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row bg-zinc-900 border border-zinc-800/80 rounded-xl p-1 gap-1">
      {choices.map((choice) => {
        const selected = choice.value === value;
        return (
          <Pressable
            key={String(choice.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(choice.value)}
            className={cn(
              'flex-1 items-center justify-center rounded-lg py-2',
              selected && 'bg-zinc-800'
            )}
          >
            <Text
              className={cn(
                'text-sm font-medium',
                selected ? 'text-zinc-100' : 'text-zinc-500'
              )}
            >
              {choice.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface SettingsProps {
  /** Called after a change that the dashboard's numbers depend on. */
  onChanged?: () => void;
}

export default function Settings({ onChanged }: SettingsProps) {
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

  if (!settings) return null;

  return (
    <ScrollView
      className="flex-1 w-full px-4"
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-5 pt-2">
        <View>
          <Text className="text-2xl font-semibold tracking-tight text-zinc-100">Settings</Text>
          <Text className="text-xs text-zinc-500 mt-0.5">
            Applies to how your study time is counted
          </Text>
        </View>

        <Card className="py-4 gap-3 border-border/60 bg-zinc-900/50">
          <CardHeader className="p-0 px-4">
            <CardTitle className="text-base text-zinc-200">Week starts on</CardTitle>
            <CardDescription className="text-xs mt-1 text-zinc-500">
              Sets the boundary for the "This Week" total.
            </CardDescription>
          </CardHeader>
          <View className="px-4">
            <Segmented
              choices={WEEK_START_CHOICES}
              value={settings.weekStartsOn}
              onChange={(weekStartsOn) => update({ weekStartsOn })}
            />
          </View>
        </Card>

        <Card className="py-4 gap-3 border-border/60 bg-zinc-900/50">
          <CardHeader className="p-0 px-4">
            <CardTitle className="text-base text-zinc-200">Minimum session</CardTitle>
            <CardDescription className="text-xs mt-1 text-zinc-500">
              Sessions shorter than this are discarded instead of saved.
            </CardDescription>
          </CardHeader>
          <View className="px-4">
            <Segmented
              choices={MIN_SESSION_CHOICES}
              value={settings.minSessionMs}
              onChange={(minSessionMs) => update({ minSessionMs })}
            />
          </View>
        </Card>

        <Separator />

        <Card className="py-4 gap-3 border-dashed border-border/60 bg-zinc-900/20">
          <CardHeader className="p-0 px-4">
            <CardTitle className="text-base text-zinc-200">Study history</CardTitle>
            <CardDescription className="text-xs mt-1 text-zinc-500">
              Sessions are stored on this device only.
            </CardDescription>
          </CardHeader>
          <View className="px-4">
            <Pressable
              accessibilityRole="button"
              onPress={handleClear}
              className="items-center justify-center rounded-xl py-3 bg-zinc-900 border border-zinc-800 active:bg-zinc-800"
            >
              <Text className="text-sm font-medium text-zinc-300">Clear all history</Text>
            </Pressable>
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
