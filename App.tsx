import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BarChart3, BookOpen, Settings as SettingsIcon, Timer, type LucideIcon } from 'lucide-react-native';
import Svg, { Line, Polygon } from 'react-native-svg';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Dashboard from './components/Dashboard';
import PageRoll from './components/PageRoll';
import StudyTimer from './components/StudyTimer';
import Settings from './components/Settings';
import { Tabs, TabsContent } from './components/ui/tabs';
import { BORDER, PixelBox, T } from './components/pixel';

type Tab = 'timer' | 'roll' | 'dashboard' | 'settings';

const TABS: { value: Tab; label: string; Icon: LucideIcon }[] = [
  { value: 'timer', label: 'TIMER', Icon: Timer },
  { value: 'roll', label: 'ROLL', Icon: BookOpen },
  { value: 'dashboard', label: 'STATS', Icon: BarChart3 },
  { value: 'settings', label: 'CONFIG', Icon: SettingsIcon },
];

/** 가운데 책이 차지하는 칸 폭 */
const EMBLEM_SLOT = 60;
/** 독 최대 폭, 그리고 폭에서 빠지는 고정치: 바깥 여백 12*2 + 그림자 4 + 테두리 4*2 + 안쪽 패딩 14*2 */
const DOCK_MAX_W = 420;
const DOCK_CHROME_W = 24 + 4 + 8 + 28;
/** 하이라이트 박스 양옆에 남기는 틈 */
const PILL_GAP = 2;

/** 독 한가운데 올라앉은 펼친 책. ROLL 의 책과 같은 픽셀 문법(잉크 테두리, 종이색 쪽). */
function OpenBookEmblem({ lit }: { lit: boolean }) {
  const paper = lit ? T.primary : T.bg;
  const rule = lit ? T.primaryFg : T.ink;
  return (
    <Svg width={44} height={30} viewBox="0 0 44 30">
      {/* 왼쪽 쪽 / 오른쪽 쪽 — 책등 쪽이 살짝 낮게 눕는다 */}
      <Polygon points="2,6 22,10 22,28 2,24" fill={paper} stroke={T.ink} strokeWidth={3} strokeLinejoin="round" />
      <Polygon points="42,6 22,10 22,28 42,24" fill={paper} stroke={T.ink} strokeWidth={3} strokeLinejoin="round" />
      {/* 글줄 */}
      <Line x1={6} y1={12} x2={18} y2={14.5} stroke={rule} strokeWidth={2} />
      <Line x1={6} y1={17} x2={18} y2={19.5} stroke={rule} strokeWidth={2} />
      <Line x1={26} y1={14.5} x2={38} y2={12} stroke={rule} strokeWidth={2} />
      <Line x1={26} y1={19.5} x2={38} y2={17} stroke={rule} strokeWidth={2} />
      {/* 책등 */}
      <Line x1={22} y1={10} x2={22} y2={28} stroke={T.ink} strokeWidth={3} />
    </Svg>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ PressStart2P_400Regular });
  const [activeTab, setActiveTab] = useState<Tab>('timer');
  const [refreshKey, setRefreshKey] = useState(0);
  // ROLL 이 책을 펼치면 탭 바까지 치운다. 책만 보이게.
  const [rollFocused, setRollFocused] = useState(false);
  const onRollFocus = useCallback((f: boolean) => setRollFocused(f), []);
  // 독 안쪽 폭을 화면 폭에서 직접 계산해 탭 4칸과 하이라이트 박스를 같은 픽셀 폭으로 못 박는다.
  // flex 에 맡기면 라벨 글자 수에 따라 폭이 달라진다.
  const { width: winW } = useWindowDimensions();
  const dockInner = Math.min(winW, DOCK_MAX_W) - DOCK_CHROME_W;
  const slotW = Math.floor((dockInner - EMBLEM_SLOT) / TABS.length);
  const pillW = slotW - PILL_GAP * 2;

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

        </Tabs>

        {/* 떠 있는 픽셀 독. 고른 탭만 주황 알약으로 채운다 (pill highlight). */}
        {!(rollFocused && activeTab === 'roll') && (
          <View style={styles.dockWrap}>
            <PixelBox shadow={4} style={styles.dockBox} boxStyle={styles.dock}>
              <View style={styles.dockRow}>
              {TABS.map(({ value, label, Icon }, idx) => {
                const selected = activeTab === value;
                // 가운데(둘째와 셋째 사이)에 펼친 책을 올린다. 누르면 ROLL 로.
                const emblem = idx === 2 && (
                  <Pressable
                    key="emblem"
                    onPress={() => setActiveTab('roll')}
                    accessibilityRole="button"
                    accessibilityLabel="ROLL"
                    style={({ pressed }) => [styles.emblemSlot, pressed && styles.dockItemPressed]}
                  >
                    <View style={[styles.emblem, activeTab === 'roll' && styles.emblemActive]}>
                      <OpenBookEmblem lit={activeTab === 'roll'} />
                    </View>
                  </Pressable>
                );
                return [emblem,
                  <Pressable
                    key={value}
                    onPress={() => setActiveTab(value)}
                    accessibilityRole="tab"
                    accessibilityLabel={label}
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [styles.dockItem, { width: slotW }, pressed && styles.dockItemPressed]}
                  >
                    <View style={[styles.pill, { width: pillW }, selected && styles.pillActive]}>
                      <Icon size={18} color={selected ? T.primaryFg : T.muted} strokeWidth={2.5} />
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.dockLabel, { color: selected ? T.primaryFg : T.muted }]}>
                        {label}
                      </Text>
                    </View>
                  </Pressable>,
                ];
              })}
              </View>
            </PixelBox>
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
  timerScroll: { flexGrow: 1, justifyContent: 'center', paddingBottom: 16 },
  dockWrap: {
    width: '100%',
    maxWidth: 420,
    marginHorizontal: 'auto',
    paddingHorizontal: 12,
    paddingTop: 30, // 가운데 책이 독 위로 튀어나오는 만큼 비워 둔다
    paddingBottom: 8,
  },
  dockBox: { alignSelf: 'stretch', overflow: 'visible' },
  dock: {
    alignSelf: 'stretch',
    overflow: 'visible',
    paddingVertical: 4,
    paddingHorizontal: 14, // 양 끝 탭(TIMER/CONFIG)이 독 테두리에 붙지 않게
    backgroundColor: T.bg,
  },
  dockRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  // 폭은 렌더 시 계산한 slotW 로 준다. flex 없음 — 글자 길이가 폭에 영향 주지 못하게.
  dockItem: { flexGrow: 0, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  emblemSlot: { width: EMBLEM_SLOT, alignItems: 'center', justifyContent: 'center' },
  emblem: {
    width: 60,
    height: 60,
    marginTop: -28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.secondary,
    borderWidth: BORDER,
    borderColor: T.ink,
    borderRadius: 30,
  },
  emblemActive: { backgroundColor: T.primaryFg },
  dockItemPressed: { opacity: 0.6 },
  pill: {
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 0,
    height: 60,
    overflow: 'hidden',
    // 테두리는 항상 그려 두고 색만 바꾼다. 고를 때 폭이 늘어 옆 탭이 밀리지 않게.
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pillActive: {
    backgroundColor: T.primary,
    borderColor: T.ink,
  },
  dockLabel: { fontFamily: T.fontPixel, fontSize: 7 },
});
