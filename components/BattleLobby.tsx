import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Clock, Coins, Lock, Settings as SettingsIcon, Sprout, Swords, Trophy, X } from 'lucide-react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { Button, Card, RADIUS, T, Tap, elevation } from './nova';
import { type Profile } from '../lib/auth';
import { createCpuOpponent, type CpuOpponent } from '../lib/cpuOpponent';
import { formatMatchLength, highestUnlocked, isUnlocked, RANKS, type Rank } from '../lib/ranks';
import { PLAYER_TROPHIES } from '../lib/wallet';
import { useInventory } from '../lib/inventory';

type BattlePhase = 'lobby' | 'searching' | 'matchFound';

type BattleLobbyProps = {
  /** 매치가 잡혔다. 카운트다운부터는 App 이 타이머 화면 위에서 이어 간다. */
  onMatchStart: (opponent: CpuOpponent, rank: Rank) => void;
  /** 매칭을 걸었는지(=탭을 잠가야 하는지) 알린다. */
  onMatchmakingChange?: (searching: boolean) => void;
  /** 프로필(아바타·이름)을 누르면 편집으로. */
  onOpenProfile?: () => void;
  /** 헤더 톱니를 누르면 설정으로. 하단 탭에서 내려온 자리다. */
  onOpenSettings?: () => void;
  /** 앱이 들고 있는 프로필. 편집하면 여기까지 바로 따라온다. */
  profile?: Profile;
};

const TIPS = [
  'A focused mind earns the biggest combo.',
  'Short sessions still move your crown forward.',
  'Protect your streak. One page at a time.',
  'Your opponent is studying too. Stay sharp.',
];

// ---------- 매칭 규칙 ----------
// 이 초까지는 사람 상대만 찾는다.
const CPU_FALLBACK_SECONDS = 18;
// 그 뒤로는 매초 CPU 상대를 부른다. 18, 19, 20, 21, 22… 어디서든 잡힐 수 있다.
const CPU_MATCH_CHANCE = 0.4;
// 아무리 운이 없어도 이 초에는 반드시 붙는다. 무한 대기 방지.
const CPU_MATCH_DEADLINE = 30;

/**
 * 사람 상대를 찾아본다. 서버가 붙기 전까지는 늘 빈손이라 실제로는
 * 항상 18초 뒤 CPU 로 넘어간다. 서버가 생기면 이 함수만 바꿔 끼우면 된다.
 */
const findRealOpponent = (): CpuOpponent | null => null;

function StatPill({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  tone: 'amber' | 'olive';
}) {
  const fg = tone === 'amber' ? T.primaryDeep : T.accentDeep;
  const bg = tone === 'amber' ? T.primarySoft : T.accentSoft;
  // 라벨 글자는 빼고 아이콘과 숫자만. 이름·칭호가 헤더에서 밀리지 않게.
  // 무엇을 세는 값인지는 읽어 주는 이름으로 남긴다.
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.statPill, { backgroundColor: bg }]}
    >
      <Icon size={16} color={fg} strokeWidth={2.2} />
      <Text style={[styles.statValue, { color: fg }]}>{value}</Text>
    </View>
  );
}

function ProfileStrip({
  profile,
  tone = 'card',
}: {
  profile: { name: string; trophies: number; title: string; avatar: string };
  tone?: 'card' | 'primary' | 'accent';
}) {
  return (
    <Card level={2} tone={tone} radius={RADIUS.lg} style={styles.stripFrame} boxStyle={styles.profileStrip}>
      <View style={styles.avatarRing}>
        <Text style={styles.avatar}>{profile.avatar}</Text>
      </View>
      <View style={styles.profileCopy}>
        <Text style={styles.profileTitle}>{profile.title}</Text>
        <Text style={styles.profileName} numberOfLines={1}>
          {profile.name}
        </Text>
      </View>
      <View style={styles.trophyMini}>
        <Trophy size={14} color={T.primary} strokeWidth={2} />
        <Text style={styles.trophyText}>{profile.trophies.toLocaleString()}</Text>
      </View>
    </Card>
  );
}

/** 대결이 열리는 장소. 배지에는 지금 고른 티어가 뜬다. */
function ArenaArt({ rank }: { rank: Rank }) {
  return (
    <View style={styles.arenaWrap}>
    <Card level={2} radius={RADIUS.xl} style={styles.arenaFrame} boxStyle={styles.arenaBorder}>
      <LinearGradient colors={['#F7EFD9', '#FBF8F0', '#EDF0E2']} style={styles.arena}>
        <Svg width="100%" height="100%" viewBox="0 0 300 220" preserveAspectRatio="xMidYMid slice">
          {/* 해 */}
          <Circle cx={232} cy={52} r={26} fill={T.primarySoft} />
          <Circle cx={232} cy={52} r={15} fill="#E9C87E" />
          {/* 먼 언덕 */}
          <Path d="M0 150 Q 70 108 150 142 Q 226 176 300 132 L300 220 L0 220 Z" fill="#DCE3CB" />
          {/* 가까운 언덕 */}
          <Path d="M0 178 Q 84 142 168 176 Q 240 204 300 172 L300 220 L0 220 Z" fill={T.accentSoft} />
          {/* 아치 문 */}
          <Path
            d="M110 186 L110 116 Q150 78 190 116 L190 186 Z"
            fill={T.card}
            stroke={T.accent}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path d="M150 186 L150 96" stroke={T.accentSoft} strokeWidth={3} />
          {/* 덤불 */}
          <Ellipse cx={62} cy={188} rx={34} ry={20} fill="#C7D3AC" />
          <Ellipse cx={244} cy={192} rx={30} ry={17} fill="#C7D3AC" />
        </Svg>

      </LinearGradient>
    </Card>

    {/* 고른 티어는 그림 아래에 적는다. 예전엔 그림 위에 얹혀 정원 문을 가렸다. */}
    <View style={styles.arenaCaption}>
      <View style={styles.arenaTierRow}>
        <View style={[styles.arenaTierDot, { backgroundColor: rank.color }]} />
        <Text style={[styles.arenaBadgeText, { color: rank.color }]}>{rank.name}</Text>
        <Text style={styles.arenaBadgeMeta}>
          {formatMatchLength(rank.matchSeconds)} · {rank.bet} coins
        </Text>
      </View>
      <Text style={styles.arenaName} numberOfLines={1}>{rank.blurb}</Text>
    </View>
    </View>
  );
}

/**
 * 티어 고르기. 판당 시간과 판돈이 곧 등급이고, 들어가려면 지갑에
 * minCoins 이상을 들고 있어야 한다 — 판돈만 있으면 되는 게 아니다.
 */
function RankPicker({
  selected,
  coins,
  onSelect,
}: {
  selected: Rank;
  /** 지금 가진 코인. */
  coins: number;
  onSelect: (rank: Rank) => void;
}) {
  return (
    <View>
      <View style={styles.rankHeader}>
        <Text style={styles.rankHeaderLabel}>Tier</Text>
        <Text style={styles.rankHeaderHint}>
          {coins.toLocaleString()} coins held · pick a match length
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rankRow}
      >
        {RANKS.map((rank) => {
          const active = rank.id === selected.id;
          const open = isUnlocked(rank, coins);
          return (
            <Pressable
              key={rank.id}
              onPress={() => open && onSelect(rank)}
              disabled={!open}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: !open }}
              accessibilityLabel={
                open
                  ? `${rank.name}, ${formatMatchLength(rank.matchSeconds)} match, ${rank.bet} coin stake`
                  : `${rank.name}, locked, needs ${rank.minCoins} coins`
              }
              style={[
                styles.rankCard,
                active && { borderColor: rank.color, borderWidth: 2, backgroundColor: T.cardAlt },
                !open && styles.rankCardLocked,
              ]}
            >
              <View style={styles.rankTop}>
                <View style={[styles.rankDot, { backgroundColor: rank.color }]} />
                <Text style={[styles.rankName, active && { color: rank.color }]} numberOfLines={1}>
                  {rank.name}
                </Text>
              </View>
              <View style={styles.rankMeta}>
                <Clock size={11} color={T.muted} strokeWidth={2.2} />
                <Text style={styles.rankMetaText}>{formatMatchLength(rank.matchSeconds)}</Text>
              </View>
              <View style={styles.rankMeta}>
                <Coins size={11} color={T.muted} strokeWidth={2.2} />
                <Text style={styles.rankMetaText}>{rank.bet}</Text>
              </View>
              {open ? (
                <Text style={styles.rankEntry}>
                  {rank.minCoins === 0 ? 'open to all' : `${rank.minCoins.toLocaleString()}+`}
                </Text>
              ) : (
                <View style={styles.rankMeta}>
                  <Lock size={10} color={T.danger} strokeWidth={2.4} />
                  <Text style={styles.rankLocked}>{rank.minCoins.toLocaleString()}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function SearchOverlay({
  elapsed,
  tip,
  fallback,
  onCancel,
}: {
  elapsed: number;
  tip: string;
  /** 18초를 넘겨 CPU 상대를 찾는 중인지. */
  fallback: boolean;
  onCancel: () => void;
}) {
  return (
    <View style={styles.overlay}>
      <Card level={3} radius={RADIUS.xl} style={styles.searchFrame} boxStyle={styles.searchCard}>
        <ActivityIndicator size="large" color={T.primary} />
        <Text style={styles.searchEyebrow}>Searching the garden</Text>
        <Text style={styles.searchTime}>00:{elapsed.toString().padStart(2, '0')}</Text>
        <Text style={styles.searchCopy}>
          {fallback ? 'No rival nearby — calling in a CPU sparring partner…' : 'Finding a worthy study rival…'}
        </Text>
        <Button
          variant="outline"
          onPress={onCancel}
          accessibilityLabel="Cancel matchmaking"
          style={styles.cancelButton}
        >
          <X size={16} color={T.inkSoft} />
          <Text style={styles.cancelText}>Cancel</Text>
        </Button>
      </Card>

      <View style={styles.tipBox}>
        <Text style={styles.tipLabel}>Study tip</Text>
        <Text style={styles.tipText}>{tip}</Text>
      </View>
    </View>
  );
}

function MatchFoundOverlay({
  player,
  opponent,
  cpu,
  onCountdown,
}: {
  player: { name: string; trophies: number; title: string; avatar: string };
  /** 이번 판의 상대. 매칭 순간에 지어진다. */
  opponent: { name: string; trophies: number; title: string; avatar: string };
  /** CPU 상대로 잡힌 판인지. */
  cpu: boolean;
  onCountdown: () => void;
}) {
  const topY = useRef(new Animated.Value(-220)).current;
  const bottomY = useRef(new Animated.Value(220)).current;
  const badgeScale = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(topY, { toValue: 0, duration: 520, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
      Animated.timing(bottomY, { toValue: 0, duration: 520, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
      Animated.spring(badgeScale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(onCountdown, 1500);
    return () => clearTimeout(timer);
  }, [badgeScale, bottomY, onCountdown, topY]);

  return (
    <View style={styles.vsOverlay}>
      <Animated.View style={[styles.vsHalf, styles.vsTop, { transform: [{ translateY: topY }] }]}>
        <Text style={styles.vsCaption}>{cpu ? 'Opponent · CPU' : 'Opponent'}</Text>
        <ProfileStrip profile={opponent} />
      </Animated.View>
      <Animated.View style={[styles.vsHalf, styles.vsBottom, { transform: [{ translateY: bottomY }] }]}>
        <Text style={styles.vsCaption}>You</Text>
        <ProfileStrip profile={player} />
      </Animated.View>
      <Animated.View style={[styles.vsBadge, { transform: [{ scale: badgeScale }] }]}>
        <Text style={styles.vsText}>VS</Text>
      </Animated.View>
    </View>
  );
}

export default function BattleLobby({
  onMatchStart,
  onMatchmakingChange,
  onOpenProfile,
  onOpenSettings,
  profile,
}: BattleLobbyProps) {
  const [phase, setPhase] = useState<BattlePhase>('lobby');
  const [elapsed, setElapsed] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [vsCpu, setVsCpu] = useState(false);
  const [rival, setRival] = useState<CpuOpponent | null>(null);
  // 지갑이 감당하는 가장 높은 티어에서 시작한다.
  // 지갑은 상점과 같은 저장소를 본다 — 산 만큼 줄고, 그만큼 설 수 있는 티어도 달라진다.
  const { inv } = useInventory();
  const coins = inv.coins;
  const [rank, setRank] = useState<Rank>(highestUnlocked(coins));


  useEffect(() => {
    if (phase !== 'searching') return;
    // 초를 지역 변수로 센다. 매 초 상대를 한 번 찾아보고, 잡히면 그 자리에서 끝난다.
    let seconds = 0;
    const interval = setInterval(() => {
      seconds += 1;
      setElapsed(seconds);

      const human = findRealOpponent();
      if (human !== null) {
        setRival(human);
        setVsCpu(false);
        setPhase('matchFound');
        return;
      }

      if (seconds < CPU_FALLBACK_SECONDS) return;
      if (seconds >= CPU_MATCH_DEADLINE || Math.random() < CPU_MATCH_CHANCE) {
        // 상대는 여기서 한 명 지어진다 — 외형도 공부 습관도 이 순간 정해진다.
        setRival(
          createCpuOpponent({ userTrophies: PLAYER_TROPHIES, matchSeconds: rank.matchSeconds })
        );
        setVsCpu(true);
        setPhase('matchFound');
      }
    }, 1000);
    const tip = setInterval(() => setTipIndex((value) => (value + 1) % TIPS.length), 3500);
    return () => {
      clearInterval(interval);
      clearInterval(tip);
    };
  }, [phase, rank]);

  const startSearching = () => {
    setElapsed(0);
    setVsCpu(false);
    setRival(null);
    setPhase('searching');
    onMatchmakingChange?.(true);
  };

  const cancelSearching = () => {
    setElapsed(0);
    setPhase('lobby');
    onMatchmakingChange?.(false);
  };

  // 오버레이의 1.5초 타이머가 리렌더마다 다시 걸리지 않게 고정해 둔다.
  const handleCountdown = useCallback(() => {
    if (rival) onMatchStart(rival, rank);
  }, [onMatchStart, rank, rival]);

  const player = {
    name: profile?.name?.trim() || 'Focus Knight',
    avatar: profile?.avatar || '🦉',
    trophies: PLAYER_TROPHIES,
    title: profile?.title?.trim() || 'Night Scholar',
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Tap
          onPress={onOpenProfile}
          accessibilityLabel="Edit your profile"
          style={styles.playerIdentity}
        >
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{player.avatar}</Text>
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.levelLabel} numberOfLines={1}>
              {player.title}
            </Text>
            <Text style={styles.headerName} numberOfLines={1}>
              {player.name}
            </Text>
          </View>
        </Tap>
        <View style={styles.headerStats}>
          <StatPill icon={Trophy} label="Trophies" value={PLAYER_TROPHIES.toLocaleString()} tone="amber" />
          <StatPill icon={Coins} label="Coins" value={coins.toLocaleString()} tone="olive" />
          <Tap
            onPress={onOpenSettings}
            accessibilityLabel="Settings"
            hitSlop={8}
            style={styles.gear}
          >
            <SettingsIcon size={21} color={T.muted} strokeWidth={2} />
          </Tap>
        </View>
      </View>

      <View style={styles.content}>
        <ArenaArt rank={rank} />

        <RankPicker selected={rank} coins={coins} onSelect={setRank} />

        <Button
          block
          size="lg"
          onPress={startSearching}
          accessibilityLabel="Start battle"
          style={styles.battleButton}
        >
          <View style={styles.battleButtonContent}>
            <View style={styles.battleIcon}>
              <Swords size={22} color={T.primaryFg} strokeWidth={2.2} />
            </View>
            <View style={styles.battleCopy}>
              <Text style={styles.battleText}>Battle</Text>
              <Text style={styles.battleSubtext}>
                {rank.name} · {formatMatchLength(rank.matchSeconds)} match · {rank.bet} coins
              </Text>
            </View>
            <ChevronRight size={22} color={T.primaryFg} strokeWidth={2.4} />
          </View>
        </Button>

        <View style={styles.footnote}>
          <Sprout size={14} color={T.accent} strokeWidth={2} />
          <Text style={styles.footnoteText}>Every minute you focus grows the garden.</Text>
        </View>
      </View>

      {phase === 'searching' && (
        <SearchOverlay
          elapsed={elapsed}
          tip={TIPS[tipIndex]}
          fallback={elapsed >= CPU_FALLBACK_SECONDS}
          onCancel={cancelSearching}
        />
      )}
      {phase === 'matchFound' && rival && (
        <MatchFoundOverlay
          player={player}
          opponent={rival}
          cpu={vsCpu}
          onCountdown={handleCountdown}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  playerIdentity: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  headerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: T.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerAvatarText: { fontSize: 27 },
  headerCopy: { flex: 1 },
  levelLabel: {
    flexShrink: 1,
    fontFamily: T.fontMedium,
    color: T.muted,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  headerName: { fontFamily: T.fontDisplay, color: T.ink, fontSize: 20, marginTop: 1 },
  headerStats: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  gear: { padding: 4, marginLeft: 2 },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  statValue: { fontFamily: T.fontBold, fontSize: 15 },

  content: { flex: 1, paddingHorizontal: 16, justifyContent: 'space-between', paddingBottom: 10, gap: 16 },
  arenaWrap: { flex: 1, minHeight: 250, maxHeight: 400, gap: 10 },
  arenaFrame: { flex: 1 },
  arenaBorder: { flex: 1, padding: 0 },
  arena: { flex: 1, justifyContent: 'flex-end' },
  arenaCaption: { alignItems: 'center', gap: 2 },
  arenaTierRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  arenaTierDot: { width: 9, height: 9, borderRadius: 5 },
  arenaBadgeMeta: { fontFamily: T.fontMedium, fontSize: 13, color: T.muted },
  arenaBadgeText: {
    fontFamily: T.fontMedium,
    color: T.accentDeep,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  arenaName: { fontFamily: T.fontDisplay, color: T.ink, fontSize: 15, marginTop: 2, textAlign: 'center' },

  rankHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rankHeaderLabel: {
    fontFamily: T.fontMedium,
    fontSize: 13,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: T.muted,
  },
  rankHeaderHint: { fontFamily: T.font, fontSize: 13, color: T.muted },
  rankRow: { gap: 8, paddingRight: 4 },
  rankCard: {
    width: 104,
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 11,
    gap: 3,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
  },
  rankCardLocked: { opacity: 0.5, backgroundColor: T.bgSunk },
  rankTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rankDot: { width: 8, height: 8, borderRadius: 4 },
  rankName: { fontFamily: T.fontDisplay, fontSize: 16, color: T.ink },
  rankMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rankMetaText: { fontFamily: T.fontMedium, fontSize: 14, color: T.inkSoft },
  rankEntry: { fontFamily: T.font, fontSize: 12, color: T.muted, marginTop: 1 },
  rankLocked: { fontFamily: T.fontMedium, fontSize: 13, color: T.danger },

  battleButton: { height: 70, paddingHorizontal: 0 },
  battleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 18,
    gap: 14,
  },
  battleIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  battleCopy: { flex: 1 },
  battleText: { fontFamily: T.fontDisplay, fontSize: 25, color: T.primaryFg },
  battleSubtext: { fontFamily: T.font, fontSize: 14, color: 'rgba(255,252,244,0.82)', marginTop: 1 },

  footnote: { flexDirection: 'row', alignItems: 'center', gap: 7, justifyContent: 'center' },
  footnoteText: { fontFamily: T.font, fontSize: 14, color: T.muted },

  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(250,248,242,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  searchFrame: { width: '100%', maxWidth: 350 },
  searchCard: { alignItems: 'center', padding: 30 },
  searchEyebrow: {
    fontFamily: T.fontMedium,
    color: T.muted,
    fontSize: 14,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginTop: 22,
  },
  searchTime: { fontFamily: T.fontDisplay, color: T.primaryDeep, fontSize: 42, marginTop: 10 },
  searchCopy: { fontFamily: T.font, color: T.muted, fontSize: 15, marginTop: 8 },
  cancelButton: { marginTop: 24, alignSelf: 'center' },
  cancelText: { fontFamily: T.fontMedium, fontSize: 17, color: T.inkSoft },
  tipBox: { position: 'absolute', bottom: 28, left: 24, right: 24, alignItems: 'center' },
  tipLabel: {
    fontFamily: T.fontMedium,
    fontSize: 12,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: T.accent,
  },
  tipText: { fontFamily: T.font, fontSize: 15, color: T.muted, marginTop: 7, textAlign: 'center' },

  vsOverlay: { ...StyleSheet.absoluteFill, backgroundColor: T.bg, overflow: 'hidden' },
  vsHalf: { position: 'absolute', left: 0, right: 0, height: '50%', paddingHorizontal: 20, justifyContent: 'center' },
  vsTop: { top: 0, backgroundColor: T.primarySoft, alignItems: 'flex-start' },
  vsBottom: { bottom: 0, backgroundColor: T.accentSoft, alignItems: 'flex-end' },
  vsCaption: {
    fontFamily: T.fontMedium,
    color: T.muted,
    fontSize: 13,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  stripFrame: { width: '100%', maxWidth: 320 },
  profileStrip: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: T.bgSunk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { fontSize: 29 },
  profileCopy: { flex: 1, marginLeft: 12 },
  profileTitle: {
    fontFamily: T.fontMedium,
    color: T.muted,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  profileName: { fontFamily: T.fontDisplay, color: T.ink, fontSize: 19, marginTop: 2 },
  trophyMini: { alignItems: 'center', gap: 3 },
  trophyText: { fontFamily: T.fontMedium, color: T.primaryDeep, fontSize: 15 },
  vsBadge: {
    position: 'absolute',
    top: '44%',
    left: '50%',
    marginLeft: -44,
    width: 88,
    height: 60,
    borderRadius: RADIUS.lg,
    backgroundColor: T.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation(3),
  },
  vsText: { fontFamily: T.fontDisplay, color: T.primaryDeep, fontSize: 31, letterSpacing: 1 },
});
