import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import { Tabs, TabsContent } from './components/ui/tabs';
import { PixelButton, T } from './components/pixel';
import { confirmDestructive } from './lib/confirm';
import { loadSettings, minSessionLabel } from './lib/settings';
import { formatElapsed, useStudyTimer, type TimerState } from './lib/useStudyTimer';

const STATUS_LABEL: Record<TimerState, string> = {
  ready: 'READY',
  running: 'STUDYING',
  paused: 'PAUSED',
};

const STATUS_COLOR: Record<TimerState, string> = {
  ready: T.muted,
  running: T.ink,
  paused: T.muted,
};

const TABS: { value: Tab; label: string }[] = [
  { value: 'timer', label: 'TIMER' },
  { value: 'dashboard', label: 'STATS' },
  { value: 'settings', label: 'CONFIG' },
];

const PRIMARY_LABEL: Record<TimerState, string> = {
  ready: 'START',
  running: 'PAUSE',
  paused: 'RESUME',
};

type Tab = 'timer' | 'dashboard' | 'settings';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ PressStart2P_400Regular });
  const [activeTab, setActiveTab] = useState<Tab>('timer');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  const { state, elapsedMs, toggle, reset, finish } = useStudyTimer();
  const primaryRunning = state === 'running';
  const resetDisabled = elapsedMs === 0 && !primaryRunning;
  const finishDisabled = elapsedMs === 0 || isFinishing;

  const handleFinish = useCallback(async () => {
    if (finishDisabled) return;
    setIsFinishing(true);
    try {
      const session = await finish();
      if (session === null) {
        const { minSessionMs } = await loadSettings();
        Alert.alert(
          'Session Discarded',
          `Sessions shorter than ${minSessionLabel(minSessionMs)} are not saved to history.`
        );
      } else {
        setRefreshKey((k) => k + 1);
      }
    } catch (error) {
      console.error('Failed to finish session:', error);
      Alert.alert('Error', 'Failed to save session.');
    } finally {
      setIsFinishing(false);
    }
  }, [finish, finishDisabled]);

  const handleReset = useCallback(() => {
    if (resetDisabled) return;
    if (elapsedMs > 0) {
      confirmDestructive(
        'Discard Session?',
        'This will reset the timer without saving your study time.',
        'Discard',
        reset
      );
    } else {
      reset();
    }
  }, [reset, resetDisabled, elapsedMs]);

  // after every hook — an early return above them breaks hook order on load.
  // fontError falls through to the system font rather than hanging on a blank screen.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as Tab)}
          className="w-full flex-1 flex flex-col"
        >
          <View style={styles.tabBar}>
            {TABS.map((tab) => {
              const selected = activeTab === tab.value;
              return (
                <PixelButton
                  key={tab.value}
                  shadow={4}
                  color={selected ? T.primary : T.secondary}
                  onPress={() => setActiveTab(tab.value)}
                  accessibilityState={{ selected }}
                  style={styles.tabItem}
                  boxStyle={styles.tabBox}
                >
                  <Text style={[styles.tabLabel, { color: selected ? T.primaryFg : T.muted }]}>
                    {tab.label}
                  </Text>
                </PixelButton>
              );
            })}
          </View>

          <TabsContent value="timer" className="flex-1">
            <View style={styles.timerScreen}>
              <View style={styles.card}>
                <Text style={styles.display} numberOfLines={1} adjustsFontSizeToFit>
                  {formatElapsed(elapsedMs)}
                </Text>
                <Text style={[styles.status, { color: STATUS_COLOR[state] }]}>
                  {STATUS_LABEL[state]}
                </Text>

                <View style={styles.controls}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    onPress={toggle}
                    style={[
                      styles.button,
                      primaryRunning ? styles.primaryRunning : styles.primaryIdle,
                    ]}
                  >
                    <Text
                      style={[
                        styles.buttonLabel,
                        primaryRunning ? styles.primaryLabelRunning : styles.primaryLabelIdle,
                      ]}
                    >
                      {PRIMARY_LABEL[state]}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    onPress={handleFinish}
                    disabled={finishDisabled}
                    style={[styles.button, styles.finishButton, finishDisabled && styles.disabled]}
                  >
                    <Text style={[styles.buttonLabel, styles.finishLabel]}>FINISH</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    onPress={handleReset}
                    disabled={resetDisabled}
                    style={[styles.button, styles.resetButton, resetDisabled && styles.disabled]}
                  >
                    <Text style={[styles.buttonLabel, styles.resetLabel]}>RESET</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TabsContent>

          <TabsContent value="dashboard" className="flex-1 w-full max-w-lg mx-auto">
            <Dashboard isActive={activeTab === 'dashboard'} refreshKey={refreshKey} />
          </TabsContent>

          <TabsContent value="settings" className="flex-1 w-full max-w-lg mx-auto">
            <Settings onChanged={() => setRefreshKey((k) => k + 1)} />
          </TabsContent>
        </Tabs>
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: T.bg,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    maxWidth: 420,
    marginHorizontal: 'auto',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  tabItem: { flex: 1 },
  tabBox: { height: 40, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontFamily: T.fontPixel, fontSize: 9 },
  timerScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  status: {
    fontFamily: T.fontPixel,
    fontSize: 9,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 44,
  },
  display: {
    fontFamily: T.fontPixel,
    fontSize: 32,
    letterSpacing: -2,
    color: T.ink,
  },
  controls: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderWidth: 4,
    borderColor: T.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryIdle: {
    backgroundColor: T.primary,
  },
  primaryRunning: {
    backgroundColor: T.secondary,
  },
  finishButton: {
    backgroundColor: T.secondary,
  },
  resetButton: {
    backgroundColor: T.bg,
  },
  disabled: {
    opacity: 0.3,
  },
  buttonLabel: {
    fontFamily: T.fontPixel,
    fontSize: 9,
  },
  primaryLabelIdle: {
    color: T.primaryFg,
  },
  primaryLabelRunning: {
    color: T.ink,
  },
  finishLabel: {
    color: T.ink,
  },
  resetLabel: {
    color: T.muted,
  },
});
