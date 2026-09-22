import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Dashboard from './components/Dashboard';
import BattleLobby from './components/BattleLobby';
import PageRoll from './components/PageRoll';
import RankBoard from './components/RankBoard';
import StudyTimer from './components/StudyTimer';
import Settings from './components/Settings';
import BottomTabs, { type AppTab } from './components/BottomTabs';
import CountdownOverlay from './components/CountdownOverlay';
import { Tabs, TabsContent } from './components/ui/tabs';
import { T } from './components/pixel';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ PressStart2P_400Regular });
  const [activeTab, setActiveTab] = useState<AppTab>('battle');
  const [battleActive, setBattleActive] = useState(false);
  // 매치 시작 카운트다운. 타이머 화면을 먼저 깔고 그 위에서 3-2-1 을 센다.
  const [countdown, setCountdown] = useState<number | null>(null);
  // 매칭을 건 순간부터 매치가 끝날 때까지 탭을 잠근다.
  const [matchLocked, setMatchLocked] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // ROLL 이 책을 펼치면 탭 바까지 치운다. 책만 보이게.
  const [rollFocused, setRollFocused] = useState(false);
  const onRollFocus = useCallback((f: boolean) => setRollFocused(f), []);

  useEffect(() => {
    if (countdown === null) return;
    const timer = setTimeout(() => setCountdown(countdown > 1 ? countdown - 1 : null), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // after every hook — an early return above them breaks hook order on load.
  // fontError falls through to the system font rather than hanging on a blank screen.
  if (!fontsLoaded && !fontError) return null;

  // 매치 중(타이머)과 책을 펼친 ROLL 에서만 탭 바를 감춘다.
  const showTabs = !(activeTab === 'battle' && battleActive) && !(activeTab === 'roll' && rollFocused);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as AppTab)}
          className="w-full flex-1 flex flex-col"
        >

          <TabsContent value="roll" className="flex-1 w-full max-w-lg mx-auto">
            <PageRoll onFocusChange={onRollFocus} />
          </TabsContent>

          <TabsContent value="stats" className="flex-1 w-full max-w-lg mx-auto">
            <Dashboard isActive={activeTab === 'stats'} refreshKey={refreshKey} />
          </TabsContent>

          <TabsContent value="battle" className="flex-1">
            {battleActive ? (
              <ScrollView
                contentContainerStyle={styles.timerScroll}
                showsVerticalScrollIndicator={false}
              >
                <StudyTimer
                  onFinished={() => {
                    setCountdown(null);
                    setMatchLocked(false);
                    setBattleActive(false);
                    setRefreshKey((k) => k + 1);
                  }}
                  onResign={() => {
                    setCountdown(null);
                    setMatchLocked(false);
                    setBattleActive(false);
                  }}
                />
              </ScrollView>
            ) : (
              <BattleLobby
                onMatchStart={() => {
                  setBattleActive(true);
                  setCountdown(3);
                }}
                onMatchmakingChange={setMatchLocked}
              />
            )}
          </TabsContent>

          <TabsContent value="rank" className="flex-1 w-full max-w-lg mx-auto">
            <RankBoard />
          </TabsContent>

          <TabsContent value="settings" className="flex-1 w-full max-w-lg mx-auto">
            <Settings onChanged={() => setRefreshKey((k) => k + 1)} />
          </TabsContent>

        </Tabs>

        {/* 모든 화면이 같은 하단 탭 바를 쓴다 — ROLL / STAT / BATTLE / RANK / SETTING. */}
        {showTabs && (
          <View style={styles.tabBar}>
            <BottomTabs activeTab={activeTab} onSelect={setActiveTab} locked={matchLocked} />
          </View>
        )}

        {countdown !== null && <CountdownOverlay value={countdown} />}

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
  timerScroll: { flexGrow: 1, justifyContent: 'center', paddingBottom: 16 },
  tabBar: { alignSelf: 'stretch', maxWidth: 420, width: '100%', marginHorizontal: 'auto' },
});
