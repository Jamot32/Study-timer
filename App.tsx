import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Dashboard from './components/Dashboard';
import BattleLobby from './components/BattleLobby';
import PageRoll from './components/PageRoll';
import RankBoard from './components/RankBoard';
import StudyTimer from './components/StudyTimer';
import Settings from './components/Settings';
import Shop from './components/Shop';
import BottomTabs, { type AppTab } from './components/BottomTabs';
import CountdownOverlay from './components/CountdownOverlay';
import Loading from './components/Loading';
import Login from './components/Login';
import ProfileEdit from './components/ProfileEdit';
import { clearProfile, loadProfile, saveProfile, type Profile } from './lib/profile';
import { googleSheetAuth, type AuthSession } from './lib/auth';
import { resetSyncState, subscribeSyncStatus, syncSessions } from './lib/sync';
import { Tabs, TabsContent } from './components/ui/tabs';
import { T } from './components/nova';
import { type CpuOpponent } from './lib/cpuOpponent';
import { arenaById, eloAfter, type Arena } from './lib/arena';
import { outcomeOf, settleMatch, type MatchOutcome } from './lib/match';
import { SOLO_MIN_MINUTES } from './lib/economy';
import {
  applyLedger,
  loadInventory,
  recordDuel,
  settleDailyCoupons,
  studyStreakNow,
} from './lib/inventory';
import { COUPONS, type CouponId } from './lib/coupons';
import { duelCouponEffects } from './lib/couponEffects';
import { studiedMinutesToday } from './lib/today';
import MatchResult, { type CouponNote, type MatchResultData } from './components/MatchResult';
import { type MatchSummary } from './components/StudyTimer';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    Fraunces_600SemiBold,
    PressStart2P_400Regular,
  });
  const [activeTab, setActiveTab] = useState<AppTab>('battle');
  const [battleActive, setBattleActive] = useState(false);
  // 이번 판의 상대. 매칭이 잡히는 순간 지어져서 타이머 화면까지 따라간다.
  const [opponent, setOpponent] = useState<CpuOpponent | null>(null);
  // 이번 판의 방. 판 길이와 참가비를 타이머가 이걸로 읽는다.
  const [arena, setArena] = useState<Arena | null>(null);
  // 매치 시작 카운트다운. 타이머 화면을 먼저 깔고 그 위에서 3-2-1 을 센다.
  const [countdown, setCountdown] = useState<number | null>(null);
  // 매칭을 건 순간부터 매치가 끝날 때까지 탭을 잠근다.
  const [matchLocked, setMatchLocked] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // ROLL 이 책을 펼치면 탭 바까지 치운다. 책만 보이게.
  const [rollFocused, setRollFocused] = useState(false);
  const onRollFocus = useCallback((f: boolean) => setRollFocused(f), []);
  // 설정과 프로필 편집은 탭이 아니라 배틀 화면 위에 얹힌다.
  const [battlePane, setBattlePane] = useState<'lobby' | 'settings' | 'profile'>('lobby');
  // 판이 끝나면 정산 결과가 여기 담기고, 로비 대신 결과 화면이 뜬다.
  const [result, setResult] = useState<MatchResultData | null>(null);
  // ROLL 결과에서 '가방에서 보기'를 누르면 올라간다. 상점 탭이 이걸 보고 가방을 연다.
  const [bagSignal, setBagSignal] = useState(0);
  // 이번 판이 솔로인지. 솔로는 정산도 ELO 변동도 없고, 끝내면 방 등급만큼 코인이 들어온다.
  const [solo, setSolo] = useState(false);
  // 이번 판에 들고 들어간 쿠폰과 실제로 낸 참가비. 입장할 때 이미 지갑에서 빠졌다.
  const [matchCoupons, setMatchCoupons] = useState<CouponId[]>([]);
  const [entryPaid, setEntryPaid] = useState(0);
  // undefined = still checking storage, null = no local profile yet (show Login)
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  // present only when Google + the sheet allowlist approved this user
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [storedProfile, restoredSession] = await Promise.all([
        loadProfile(),
        googleSheetAuth.restoreSession().catch(() => null),
      ]);
      let next = storedProfile;
      if (!next && restoredSession) {
        next = await saveProfile({
          name: restoredSession.user.displayName,
          avatar: restoredSession.user.avatar,
        });
      }
      if (cancelled) return;
      setAuthSession(restoredSession);
      setProfile(next);
      // fire and forget — the timer and first render never wait on the sheet
      if (restoredSession) void syncSessions(restoredSession);
    })().catch(() => {
      if (!cancelled) setProfile(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // 앱을 비운 사이 지나간 자정들 — 타임캡슐·복리·끊길 뻔한 연속 — 을 먼저 정산한다.
    void settleDailyCoupons().then((events) => {
      if (events.length) setRefreshKey((k) => k + 1);
    });
  }, []);

  /**
   * 참가비도 못 내는 상태로 앱을 열면 대전 탭 대신 기록 탭을 먼저 보여 준다.
   * 처음 뜰 때 한 번만. 유저가 탭을 한 번이라도 누른 뒤에는 건드리지 않는다.
   */
  const startTabDecided = useRef(false);
  useEffect(() => {
    let cancelled = false;
    loadInventory().then((inv) => {
      if (cancelled || startTabDecided.current) return;
      startTabDecided.current = true;
      if (inv.coins < arenaById(inv.arenaId).entryFee) setActiveTab('stats');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Coming back to the app (native) or to the tab (web — react-native-web maps
  // visibilitychange onto AppState) pulls whatever other devices saved meanwhile.
  useEffect(() => {
    if (!authSession) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncSessions(authSession);
    });
    return () => subscription.remove();
  }, [authSession]);

  // A sync that lands new data re-reads every screen keyed on refreshKey. Pulled
  // sessions can close out capsule/compound days, so settle those first.
  useEffect(
    () =>
      subscribeSyncStatus((status) => {
        if (status.state !== 'ok') return;
        void settleDailyCoupons()
          .catch(() => [])
          .then(() => setRefreshKey((k) => k + 1));
      }),
    []
  );

  const signOut = useCallback(async () => {
    await Promise.all([googleSheetAuth.signOut(), resetSyncState()]);
    await clearProfile();
    setAuthSession(null);
    setBattlePane('lobby');
    setResult(null);
    setActiveTab('battle');
    setProfile(null);
  }, []);

  const selectTab = useCallback((tab: AppTab) => {
    startTabDecided.current = true;
    setActiveTab(tab);
  }, []);

  /**
   * 한 판을 닫는다. 판정 → 정산 → ELO 순으로, 전부 lib 의 규칙을 그대로 쓴다.
   * 공부 시간은 이미 저장된 뒤라 여기서 건드릴 것이 없다 — 움직이는 건 코인과 ELO 뿐이다.
   */
  const closeMatch = useCallback(
    async (summary: MatchSummary) => {
      const room = arena;
      const wasSolo = solo;
      const coupons = matchCoupons;
      const paid = entryPaid;
      setSolo(false);
      setMatchCoupons([]);
      setEntryPaid(0);
      setCountdown(null);
      setMatchLocked(false);
      setBattleActive(false);
      setOpponent(null);
      setRefreshKey((k) => k + 1);
      if (!room) {
        setArena(null);
        return;
      }

      // 항복은 FP 와 무관하게 패배로 친다.
      const outcome: MatchOutcome = summary.resigned
        ? 'loss'
        : outcomeOf(summary.myFp, summary.theirFp);
      const settlement = settleMatch({
        arena: room,
        outcome,
        mySeconds: summary.mySeconds,
        theirSeconds: summary.theirSeconds,
      });

      const inv = await loadInventory();
      const before = inv.elo;
      const nameOf = (id: CouponId) => COUPONS.find((c) => c.id === id)?.name ?? id;
      const golden = summary.goldenBonus ?? 0;
      const goldenNote = (): CouponNote[] =>
        coupons.includes('goldenHour')
          ? [
              golden > 0
                ? { name: nameOf('goldenHour'), text: 'Your session paid double', coins: golden }
                : { name: nameOf('goldenHour'), text: 'No paid session to double' },
            ]
          : [];

      if (wasSolo) {
        // 솔로는 잃을 것이 없다 — 참가비도 ELO 도 걸지 않았다.
        // 방 등급만큼 코인을 주되, 최소 시간은 앉아야 한다.
        const earned =
          summary.mySeconds >= SOLO_MIN_MINUTES * 60 ? room.soloReward : 0;
        if (earned > 0) await applyLedger({ coins: earned });
        setResult({
          arena: room,
          outcome: 'draw',
          solo: true,
          resigned: summary.resigned,
          mySeconds: summary.mySeconds,
          theirSeconds: 0,
          myFp: summary.myFp,
          theirFp: 0,
          settlement: { ...settlement, myRefund: 0, winnerTake: earned, burn: 0, myNet: earned },
          entryPaid: 0,
          net: earned,
          couponNotes: goldenNote(),
          eloBefore: before,
          eloAfter: before,
          winStreak: null,
          studyStreak: await studyStreakNow(),
          studiedTodayMinutes: await studiedMinutesToday(),
        });
        setArena(null);
        return;
      }

      const after = eloAfter(before, room, outcome);
      // 참가비는 입장할 때 이미 빠졌다. 여기서는 돌아오는 몫과 쿠폰이 얹는 몫만 더한다.
      const perks = duelCouponEffects({
        coupons,
        outcome,
        entryFee: room.entryFee,
        myRefund: settlement.myRefund,
        theirRefund: settlement.theirRefund,
      });
      const back =
        (outcome === 'win' ? settlement.winnerTake : settlement.myRefund) +
        perks.shieldRefund +
        perks.plunder;
      await applyLedger({ coins: back, elo: after });
      const streakBefore = inv.winStreak;
      const { inv: afterDuel, anchored } = await recordDuel(outcome);

      const notes: CouponNote[] = [];
      if (coupons.includes('freeEntry'))
        notes.push({ name: nameOf('freeEntry'), text: 'Your entry was on the house', coins: room.entryFee });
      if (coupons.includes('timeShield'))
        notes.push(
          outcome === 'loss'
            ? { name: nameOf('timeShield'), text: 'Your stake came back in full', coins: perks.shieldRefund, inNet: true }
            : { name: nameOf('timeShield'), text: 'Not needed — you did not lose' }
        );
      if (coupons.includes('plunderSeal'))
        notes.push(
          outcome === 'win'
            ? { name: nameOf('plunderSeal'), text: 'Took half again of what your rival lost', coins: perks.plunder, inNet: true }
            : { name: nameOf('plunderSeal'), text: 'No win, nothing taken' }
        );
      notes.push(...goldenNote());
      if (anchored)
        notes.push({ name: nameOf('streakAnchor'), text: `Kept your ${streakBefore}-win run alive` });

      setResult({
        arena: room,
        outcome,
        solo: false,
        resigned: summary.resigned,
        mySeconds: summary.mySeconds,
        theirSeconds: summary.theirSeconds,
        myFp: summary.myFp,
        theirFp: summary.theirFp,
        settlement,
        entryPaid: paid,
        net: back - paid,
        couponNotes: notes,
        eloBefore: before,
        eloAfter: after,
        winStreak: afterDuel.winStreak,
        studyStreak: await studyStreakNow(),
        studiedTodayMinutes: await studiedMinutesToday(),
      });
      setArena(null);
    },
    [arena, solo, matchCoupons, entryPaid]
  );

  useEffect(() => {
    if (countdown === null) return;
    const timer = setTimeout(() => setCountdown(countdown > 1 ? countdown - 1 : null), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // after every hook — an early return above them breaks hook order on load.
  // fontError falls through to the system font rather than hanging on a blank screen.
  if (!fontsLoaded && !fontError) return null;
  if (profile === undefined) return <Loading />;
  if (profile === null) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <Login
            onLoggedIn={(nextProfile, session) => {
              setAuthSession(session);
              setProfile(nextProfile);
              if (session) void syncSessions(session);
            }}
          />
          <StatusBar style="dark" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // 매치 중(타이머)과 책을 펼친 ROLL 에서만 탭 바를 감춘다.
  const showTabs = !(activeTab === 'battle' && battleActive) && !(activeTab === 'roll' && rollFocused);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <Tabs
          value={activeTab}
          onValueChange={(val) => selectTab(val as AppTab)}
          className="w-full flex-1 flex flex-col"
        >

          <TabsContent value="roll" className="flex-1 w-full max-w-lg mx-auto">
            <PageRoll
              onFocusChange={onRollFocus}
              refreshKey={refreshKey}
              onOpenBag={() => {
                selectTab('shop');
                setBagSignal((n) => n + 1);
              }}
            />
          </TabsContent>

          <TabsContent value="stats" className="flex-1 w-full max-w-lg mx-auto">
            <Dashboard
              isActive={activeTab === 'stats'}
              refreshKey={refreshKey}
              authSession={authSession}
            />
          </TabsContent>

          <TabsContent value="battle" className="flex-1">
            {result ? (
              <MatchResult data={result} onDone={() => setResult(null)} />
            ) : battlePane === 'settings' ? (
              <Settings
                onBack={() => setBattlePane('lobby')}
                onChanged={() => setRefreshKey((k) => k + 1)}
                profile={profile}
                authSession={authSession}
                onEditProfile={() => setBattlePane('profile')}
                onSignOut={signOut}
              />
            ) : battlePane === 'profile' ? (
              <ProfileEdit
                refreshKey={refreshKey}
                profile={profile}
                onProfileChanged={setProfile}
                onBack={() => setBattlePane('lobby')}
              />
            ) : battleActive ? (
              <ScrollView
                contentContainerStyle={styles.timerScroll}
                showsVerticalScrollIndicator={false}
              >
                <StudyTimer
                  profile={profile}
                  refreshKey={refreshKey}
                  matchStarting={countdown !== null}
                  opponent={opponent}
                  solo={solo}
                  arena={arena}
                  coupons={matchCoupons}
                  onFinished={(summary) => {
                    // onFinished only fires once the session is saved
                    if (authSession) void syncSessions(authSession);
                    if (summary) {
                      void closeMatch(summary);
                      return;
                    }
                    setCountdown(null);
                    setMatchLocked(false);
                    setBattleActive(false);
                    setOpponent(null);
                    setArena(null);
                    setMatchCoupons([]);
                    setEntryPaid(0);
                    setRefreshKey((k) => k + 1);
                  }}
                  onResign={(summary) => void closeMatch(summary)}
                />
              </ScrollView>
            ) : (
              <BattleLobby
                refreshKey={refreshKey}
                onMatchStart={(rival, matchRank, isSolo, coupons, paid) => {
                  setOpponent(rival);
                  setArena(matchRank);
                  setSolo(isSolo);
                  setMatchCoupons(coupons);
                  setEntryPaid(paid);
                  setBattleActive(true);
                  setCountdown(isSolo ? null : 3);
                }}
                onMatchmakingChange={setMatchLocked}
                profile={profile}
                onOpenProfile={() => setBattlePane('profile')}
                onOpenSettings={() => setBattlePane('settings')}
              />
            )}
          </TabsContent>

          <TabsContent value="rank" className="flex-1 w-full max-w-lg mx-auto">
            <RankBoard profile={profile} />
          </TabsContent>

          <TabsContent value="shop" className="flex-1 w-full max-w-lg mx-auto">
            <Shop bagSignal={bagSignal} refreshKey={refreshKey} />
          </TabsContent>

        </Tabs>

        {/* 모든 화면이 같은 하단 탭 바를 쓴다 — ROLL / STATS / BATTLE / RANK / SHOP.
            설정과 프로필은 배틀 화면 헤더에서 연다. */}
        {showTabs && (
          <View style={styles.tabBar}>
            <BottomTabs activeTab={activeTab} onSelect={selectTab} locked={matchLocked} />
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
  // marginHorizontal:'auto' 는 RN 네이티브에서 먹지 않아 바가 왼쪽에 붙고 오른쪽이 비었다.
  // alignSelf 로 가운데 세우고, 넓은 화면에서도 허전하지 않도록 상한을 넉넉히 둔다.
  tabBar: { alignSelf: 'center', width: '100%', maxWidth: 560 },
});
