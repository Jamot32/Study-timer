import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatElapsed, useStudyTimer, type TimerState } from './lib/useStudyTimer';

const STATUS_LABEL: Record<TimerState, string> = {
  ready: 'Ready',
  running: 'Studying',
  paused: 'Paused',
};

const STATUS_COLOR: Record<TimerState, string> = {
  ready: '#6b6b76',
  running: '#4ade80',
  paused: '#fbbf24',
};

const PRIMARY_LABEL: Record<TimerState, string> = {
  ready: 'Start',
  running: 'Pause',
  paused: 'Resume',
};

export default function App() {
  const { state, elapsedMs, toggle, reset } = useStudyTimer();
  const primaryRunning = state === 'running';
  const resetDisabled = elapsedMs === 0 && !primaryRunning;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.display}>{formatElapsed(elapsedMs)}</Text>
        <Text style={[styles.status, { color: STATUS_COLOR[state] }]}>{STATUS_LABEL[state]}</Text>
        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            onPress={toggle}
            style={({ pressed }) => [
              styles.button,
              primaryRunning ? styles.primaryRunning : styles.primaryIdle,
              pressed && styles.pressed,
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
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={reset}
            disabled={resetDisabled}
            style={({ pressed }) => [
              styles.button,
              styles.resetButton,
              resetDisabled && styles.disabled,
              pressed && !resetDisabled && styles.pressed,
            ]}
          >
            <Text style={[styles.buttonLabel, styles.resetLabel]}>Reset</Text>
          </Pressable>
        </View>
      </View>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  display: {
    fontSize: 64,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
    color: '#eaeaf0',
    marginBottom: 8,
  },
  status: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 40,
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'stretch',
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryIdle: {
    backgroundColor: '#22c55e',
  },
  primaryRunning: {
    backgroundColor: '#fbbf24',
  },
  resetButton: {
    backgroundColor: '#26262e',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.35,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryLabelIdle: {
    color: '#052e13',
  },
  primaryLabelRunning: {
    color: '#451a03',
  },
  resetLabel: {
    color: '#9a9aa5',
  },
});
