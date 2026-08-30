import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Dashboard from './components/Dashboard';
import StudyTimer from './components/StudyTimer';
import Settings from './components/Settings';
import { Tabs, TabsContent } from './components/ui/tabs';
import { PixelButton, T } from './components/pixel';

type Tab = 'timer' | 'dashboard' | 'settings';

const TABS: { value: Tab; label: string }[] = [
  { value: 'timer', label: 'TIMER' },
  { value: 'dashboard', label: 'STATS' },
  { value: 'settings', label: 'CONFIG' },
];

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ PressStart2P_400Regular });
  const [activeTab, setActiveTab] = useState<Tab>('timer');
  const [refreshKey, setRefreshKey] = useState(0);

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
            {/* the timer frame is taller than the viewport once the tab bar is above it */}
            <ScrollView
              contentContainerStyle={styles.timerScroll}
              showsVerticalScrollIndicator={false}
            >
              <StudyTimer onFinished={() => setRefreshKey((k) => k + 1)} />
            </ScrollView>
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
  timerScroll: { flexGrow: 1, justifyContent: 'center', paddingBottom: 16 },
  tabItem: { flex: 1 },
  tabBox: { height: 40, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontFamily: T.fontPixel, fontSize: 9 },
});
