import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Dashboard from './components/Dashboard';
import PageRoll from './components/PageRoll';
import StudyTimer from './components/StudyTimer';
import Settings from './components/Settings';
import { Tabs, TabsContent } from './components/ui/tabs';
import { PixelButton, T } from './components/pixel';

type Tab = 'timer' | 'roll' | 'dashboard' | 'settings';

const TABS: { value: Tab; label: string }[] = [
  { value: 'timer', label: 'TIMER' },
  { value: 'roll', label: 'ROLL' },
  { value: 'dashboard', label: 'STATS' },
  { value: 'settings', label: 'CONFIG' },
];

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ PressStart2P_400Regular });
  const [activeTab, setActiveTab] = useState<Tab>('timer');
  const [refreshKey, setRefreshKey] = useState(0);
  // ROLL 이 책을 펼치면 탭 바까지 치운다. 책만 보이게.
  const [rollFocused, setRollFocused] = useState(false);
  const onRollFocus = useCallback((f: boolean) => setRollFocused(f), []);
  // 하단 셀렉터 버튼을 누르면 탭 목록 메뉴가 열린다.
  const [menuOpen, setMenuOpen] = useState(false);
  const activeLabel = TABS.find((t) => t.value === activeTab)?.label ?? '';

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

          <TabsContent value="timer" className="flex-1">
            {/* the timer frame is taller than the viewport once the tab bar is above it */}
            <ScrollView
              contentContainerStyle={styles.timerScroll}
              showsVerticalScrollIndicator={false}
            >
              <StudyTimer onFinished={() => setRefreshKey((k) => k + 1)} />
            </ScrollView>
          </TabsContent>

          <TabsContent value="roll" className="flex-1 w-full max-w-lg mx-auto">
            <PageRoll onFocusChange={onRollFocus} />
          </TabsContent>

          <TabsContent value="dashboard" className="flex-1 w-full max-w-lg mx-auto">
            <Dashboard isActive={activeTab === 'dashboard'} refreshKey={refreshKey} />
          </TabsContent>

          <TabsContent value="settings" className="flex-1 w-full max-w-lg mx-auto">
            <Settings onChanged={() => setRefreshKey((k) => k + 1)} />
          </TabsContent>

          {!(rollFocused && activeTab === 'roll') && (
            <View style={styles.tabBar}>
              <PixelButton
                shadow={4}
                color={T.primary}
                onPress={() => setMenuOpen(true)}
                accessibilityLabel="Select tab"
                style={styles.tabItem}
                boxStyle={styles.tabBox}
              >
                <Text style={[styles.tabLabel, { color: T.primaryFg }]}>{activeLabel}</Text>
                <Text style={[styles.tabLabel, { color: T.primaryFg }]}>{menuOpen ? '▼' : '▲'}</Text>
              </PixelButton>
            </View>
          )}
        </Tabs>

        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
            <View style={styles.menu}>
              {TABS.map((tab) => {
                const selected = activeTab === tab.value;
                return (
                  <PixelButton
                    key={tab.value}
                    shadow={4}
                    color={selected ? T.primary : T.secondary}
                    onPress={() => {
                      setActiveTab(tab.value);
                      setMenuOpen(false);
                    }}
                    accessibilityState={{ selected }}
                    boxStyle={styles.tabBox}
                  >
                    <Text style={[styles.tabLabel, { color: selected ? T.primaryFg : T.muted }]}>
                      {tab.label}
                    </Text>
                  </PixelButton>
                );
              })}
            </View>
          </Pressable>
        </Modal>
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
    width: '100%',
    maxWidth: 420,
    marginHorizontal: 'auto',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
  },
  menuBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(46, 34, 24, 0.45)',
  },
  menu: {
    width: '100%',
    maxWidth: 420,
    marginHorizontal: 'auto',
    paddingHorizontal: 16,
    paddingBottom: 72,
    gap: 8,
  },
  timerScroll: { flexGrow: 1, justifyContent: 'center', paddingBottom: 16 },
  tabItem: { flex: 1 },
  tabBox: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  tabLabel: { fontFamily: T.fontPixel, fontSize: 8 },
});
