import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { confirmDestructive } from './lib/confirm';
import { loadSettings, minSessionLabel } from './lib/settings';
import { formatElapsed, useStudyTimer, type TimerState } from './lib/useStudyTimer';
import { cn } from './lib/utils';

const STATUS_LABEL: Record<TimerState, string> = {
  ready: 'Ready',
  running: 'Studying',
  paused: 'Paused',
};

const STATUS_COLOR: Record<TimerState, string> = {
  ready: '#71717a',
  running: '#ffffff',
  paused: '#a1a1aa',
};

const PRIMARY_LABEL: Record<TimerState, string> = {
  ready: 'Start',
  running: 'Pause',
  paused: 'Resume',
};

type Tab = 'timer' | 'dashboard' | 'settings';

export default function App() {
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

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as Tab)}
          className="w-full flex-1 flex flex-col"
        >
          <View className="px-6 pt-3 pb-2 items-center w-full max-w-sm mx-auto">
            <TabsList className="w-full grid grid-cols-3 bg-zinc-900 border border-zinc-800/80 h-10 p-1 rounded-xl">
              <TabsTrigger value="timer" className="rounded-lg">
                <Text
                  className={cn(
                    'text-sm font-medium',
                    activeTab === 'timer' ? 'text-zinc-100' : 'text-zinc-500'
                  )}
                >
                  Timer
                </Text>
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="rounded-lg">
                <Text
                  className={cn(
                    'text-sm font-medium',
                    activeTab === 'dashboard' ? 'text-zinc-100' : 'text-zinc-500'
                  )}
                >
                  Dashboard
                </Text>
              </TabsTrigger>
              <TabsTrigger value="settings" className="rounded-lg">
                <Text
                  className={cn(
                    'text-sm font-medium',
                    activeTab === 'settings' ? 'text-zinc-100' : 'text-zinc-500'
                  )}
                >
                  Settings
                </Text>
              </TabsTrigger>
            </TabsList>
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
                    <Text style={[styles.buttonLabel, styles.finishLabel]}>Finish</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    onPress={handleReset}
                    disabled={resetDisabled}
                    style={[styles.button, styles.resetButton, resetDisabled && styles.disabled]}
                  >
                    <Text style={[styles.buttonLabel, styles.resetLabel]}>Reset</Text>
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
        <StatusBar style="light" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#09090b',
  },
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
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginTop: 12,
    marginBottom: 44,
  },
  display: {
    fontSize: 60,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    color: '#fafafa',
  },
  controls: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryIdle: {
    backgroundColor: '#ffffff',
  },
  primaryRunning: {
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  finishButton: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  resetButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  disabled: {
    opacity: 0.3,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryLabelIdle: {
    color: '#09090b',
  },
  primaryLabelRunning: {
    color: '#ffffff',
  },
  finishLabel: {
    color: '#f4f4f5',
  },
  resetLabel: {
    color: '#71717a',
  },
});
