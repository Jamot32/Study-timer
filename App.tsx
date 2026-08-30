import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Dashboard from './components/Dashboard';
import StudyTimer from './components/StudyTimer';
import Settings from './components/Settings';
import { T } from './components/pixel';

type Screen = 'timer' | 'dashboard' | 'settings';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ PressStart2P_400Regular });
  const [screen, setScreen] = useState<Screen>('timer');
  const [refreshKey, setRefreshKey] = useState(0);

  // after every hook — an early return above them breaks hook order on load.
  // fontError falls through to the system font rather than hanging on a blank screen.
  if (!fontsLoaded && !fontError) return null;

  const backToTimer = () => setScreen('timer');

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {screen === 'timer' && (
          // the timer frame is taller than the viewport on short devices
          <ScrollView contentContainerStyle={styles.timerScroll} showsVerticalScrollIndicator={false}>
            <StudyTimer
              onFinished={() => setRefreshKey((k) => k + 1)}
              onOpenStats={() => setScreen('dashboard')}
              onOpenSettings={() => setScreen('settings')}
            />
          </ScrollView>
        )}

        {screen === 'dashboard' && (
          <View style={styles.page}>
            <Dashboard refreshKey={refreshKey} onBack={backToTimer} />
          </View>
        )}

        {screen === 'settings' && (
          <View style={styles.page}>
            <Settings onChanged={() => setRefreshKey((k) => k + 1)} onBack={backToTimer} />
          </View>
        )}
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
  page: { flex: 1, width: '100%', maxWidth: 512, marginHorizontal: 'auto' },
  timerScroll: { flexGrow: 1, justifyContent: 'center', paddingBottom: 16 },
});
