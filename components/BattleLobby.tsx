import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronRight,
  Coins,
  Plus,
  Settings as SettingsIcon,
  Dumbbell,
  Swords,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { Button, Card, RADIUS, T, Tap, elevation } from './nova';
import { type Profile } from '../lib/auth';
import { createCpuOpponent, type CpuOpponent } from '../lib/cpuOpponent';
import {
  arenaById,
  canPromote,
  eloToNext,
  formatMatchLength,
  nextArena,
  type Arena,
} from '../lib/arena';
import { PROMOTION_GIFT_MULTIPLIER } from '../lib/economy';
import { applyLedger, countOf, equipCoupon, useInventory, type Inventory } from '../lib/inventory';
import { COUPONS, type Coupon } from '../lib/coupons';

type BattlePhase = 'lobby' | 'searching' | 'matchFound';

type BattleLobbyProps = {
  /** 매치가 잡혔다. 카운트다운부터는 App 이 타이머 화면 위에서 이어 간다. */
  onMatchStart: (opponent: CpuOpponent | null, arena: Arena, solo: boolean) => void;
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
function ArenaArt({ rank, overlay }: { rank: Arena; overlay?: React.ReactNode }) {
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

        {/* 그림 안 좌측 상단에 얹힌다. 정원 문을 가리지 않는 자리다. */}
        {overlay ? <View style={styles.artOverlay}>{overlay}</View> : null}
      </LinearGradient>
    </Card>

    {/* 고른 티어는 그림 아래에 적는다. 예전엔 그림 위에 얹혀 정원 문을 가렸다. */}
    <View style={styles.arenaCaption}>
      <View style={styles.arenaTierRow}>
        <View style={[styles.arenaTierDot, { backgroundColor: rank.color }]} />
        <Text style={[styles.arenaBadgeText, { color: rank.color }]}>{rank.name}</Text>
        <Text style={styles.arenaBadgeMeta}>
          {formatMatchLength(rank.matchSeconds)} · {rank.entryFee} coins
        </Text>
      </View>
    </View>
    </View>
  );
}

/**
 * 판에 들고 들어갈 쿠폰 두 자리.
 * 아직 효과가 붙지는 않았다 — 무엇을 챙겼는지 보이고 고르는 데까지다.
 */
function CouponSlots({
  inv,
  onPick,
}: {
  inv: Inventory;
  onPick: (slot: 0 | 1) => void;
}) {
  return (
    <View style={styles.slots}>
      {([0, 1] as const).map((slot) => {
        const id = inv.equipped[slot] ?? null;
        const coupon = id ? COUPONS.find((c) => c.id === id) : undefined;
        return (
          <Tap
            key={slot}
            onPress={() => onPick(slot)}
            accessibilityLabel={
              coupon ? `Coupon slot ${slot + 1}: ${coupon.name}` : `Coupon slot ${slot + 1}, empty`
            }
            style={[styles.slot, coupon && styles.slotFilled]}
          >
            {coupon ? (
              <Text style={styles.slotName} numberOfLines={2}>
                {coupon.name}
              </Text>
            ) : (
              <Plus size={18} color={T.muted} strokeWidth={2.2} />
            )}
          </Tap>
        );
      })}
    </View>
  );
}

/** 가진 쿠폰 중에서 한 장 고르는 창. 없으면 어디서 구하는지 알려 준다. */
function CouponPicker({
  slot,
  inv,
  onClose,
  onChoose,
}: {
  slot: 0 | 1 | null;
  inv: Inventory;
  onClose: () => void;
  onChoose: (id: string | null) => void;
}) {
  const owned = COUPONS.filter((c) => countOf(inv, c.id) > 0);
  return (
    <Modal visible={slot !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Tap onPress={onClose} style={styles.pickerBackdrop}>
        <Card level={3} radius={RADIUS.xl} style={styles.pickerFrame} boxStyle={styles.picker}>
          <Text style={styles.pickerTitle}>Slot {(slot ?? 0) + 1}</Text>
          {owned.length === 0 ? (
            <Text style={styles.pickerEmpty}>
              No coupons yet. Roll a book or buy one in the shop.
            </Text>
          ) : (
            owned.map((c: Coupon) => (
              <Tap key={c.id} onPress={() => onChoose(c.id)} style={styles.pickerRow}>
                <View style={styles.pickerCopy}>
                  <Text style={styles.pickerName}>{c.name}</Text>
                  <Text style={styles.pickerEffect} numberOfLines={2}>
                    {c.effect}
                  </Text>
                </View>
                <Text style={styles.pickerCount}>x{countOf(inv, c.id)}</Text>
              </Tap>
            ))
          )}
          <Button block variant="outline" onPress={() => onChoose(null)} style={styles.pickerClear}>
            Leave empty
          </Button>
        </Card>
      </Tap>
    </Modal>
  );
}

/**
 * 지금 선 방과, 다음 방까지 남은 점수.
 * 들어갈 수 있는 방은 이 하나뿐이라 고를 것이 없다 — 목록 대신 진행만 보여 준다.
 */
function ArenaStanding({ current, elo }: { current: Arena; elo: number }) {
  const remaining = eloToNext(elo, current.id);
  const next = nextArena(current.id);
  const span = next ? next.eloFloor - current.eloFloor : 0;
  const progress = span > 0 ? Math.max(0, Math.min(1, (elo - current.eloFloor) / span)) : 1;

  return (
    <View style={styles.standing}>
      <View style={styles.rankHeader}>
        <View style={styles.standingLeft}>
          <View style={[styles.rankDot, { backgroundColor: current.color }]} />
          <Text style={[styles.standingName, { color: current.color }]}>{current.name}</Text>
          <Text style={styles.standingElo}>{elo} ELO</Text>
        </View>
        <Text style={styles.rankHeaderHint}>
          {remaining === null || !next
            ? 'Top arena'
            : `${remaining} ELO to ${next.name}`}
        </Text>
      </View>

      {next ? (
        <View style={styles.eloTrack}>
          <View style={[styles.eloFill, { width: `${progress * 100}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * 승급 제안. ELO 가 닿아도 자동으로 올리지 않는다 —
 * 다음 방의 유효 시간과 참가비를 보여 주고 직접 고르게 한다. 올라가면 이전 방은 닫힌다.
 */
function PromotionCard({ to, onAccept }: { to: Arena; onAccept: () => void }) {
  return (
    <Card level={2} tone="primary" boxStyle={styles.promo}>
      <View style={styles.promoHead}>
        <TrendingUp size={18} color={T.primaryDeep} strokeWidth={2.2} />
        <Text style={styles.promoTitle}>{to.name} is open to you</Text>
      </View>
      <Text style={styles.promoBody}>
        {formatMatchLength(to.matchSeconds)} matches, {to.entryFee} coins to enter. Moving up closes
        your current arena for good.
      </Text>
      <Button size="sm" onPress={onAccept} style={styles.promoButton}>
        Move up
      </Button>
    </Card>
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
  // 이번 판이 솔로인지. 솔로는 참가비도 ELO 도 걸지 않는다.
  const [solo, setSolo] = useState(false);
  const [rival, setRival] = useState<CpuOpponent | null>(null);
  // 지갑·ELO·지금 선 방은 모두 같은 저장소에서 온다.
  const { inv, refresh } = useInventory();
  const coins = inv.coins;
  const arena = arenaById(inv.arenaId);
  // 쿠폰 자리를 누르면 열리는 고르기 창.
  const [pickingSlot, setPickingSlot] = useState<0 | 1 | null>(null);
  // 랭크전에 필요한 건 참가비뿐이다.
  const canEnter = coins >= arena.entryFee;
  const promotable = canPromote(inv.elo, inv.arenaId);
  const promoteTo = nextArena(inv.arenaId);


  const promote = useCallback(async () => {
    if (!promoteTo) return;
    // 새 방 첫 입장 축하금 — 첫 참가비를 스스로 마련하지 않아도 되게.
    const gift = inv.giftedArenas.includes(promoteTo.id)
      ? 0
      : promoteTo.entryFee * PROMOTION_GIFT_MULTIPLIER;
    await applyLedger({ arenaId: promoteTo.id, coins: gift, giftArena: promoteTo.id });
    refresh();
  }, [inv.giftedArenas, promoteTo, refresh]);


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
          createCpuOpponent({
            userTrophies: inv.elo,
            // 무제한 방은 CPU 의 목표를 잡을 자가 없으니 6시간을 기준으로 둔다.
            matchSeconds: arena.matchSeconds ?? 6 * 3600,
          })
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
  }, [phase, arena, inv.elo]);

  const startSearching = () => {
    if (!canEnter) return;
    // 입장 = 경기 시작. 참가비는 이 순간 지갑에서 빠진다.
    setSolo(false);
    void applyLedger({ coins: -arena.entryFee }).then(() => refresh());
    setElapsed(0);
    setVsCpu(false);
    setRival(null);
    setPhase('searching');
    onMatchmakingChange?.(true);
  };

  /**
   * 솔로 매치. 참가비 0, ELO 무변동, 당일 공부 게이트도 없다 — 여기가 돌아오는 길이다.
   * 상대를 찾을 것이 없으니 매칭을 건너뛰고 바로 판으로 들어간다.
   */
  const startSolo = () => {
    setSolo(true);
    setRival(null);
    setPhase('lobby');
    onMatchStart(null, arena, true);
  };

  const cancelSearching = () => {
    setElapsed(0);
    setPhase('lobby');
    onMatchmakingChange?.(false);
  };

  // 오버레이의 1.5초 타이머가 리렌더마다 다시 걸리지 않게 고정해 둔다.
  const handleCountdown = useCallback(() => {
    if (rival) onMatchStart(rival, arena, solo);
  }, [onMatchStart, arena, solo, rival]);

  const player = {
    name: profile?.name?.trim() || 'Focus Knight',
    avatar: profile?.avatar || '🦉',
    trophies: inv.elo,
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
          <StatPill icon={Trophy} label="ELO" value={inv.elo.toLocaleString()} tone="amber" />
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
        <ArenaArt rank={arena} overlay={<CouponSlots inv={inv} onPick={setPickingSlot} />} />

        {promotable && promoteTo ? (
          <PromotionCard to={promoteTo} onAccept={promote} />
        ) : (
          <ArenaStanding current={arena} elo={inv.elo} />
        )}

        <Button
          block
          size="lg"
          variant={canEnter ? 'primary' : 'outline'}
          disabled={!canEnter}
          onPress={startSearching}
          accessibilityLabel="Start battle"
          style={styles.battleButton}
        >
          <View style={styles.battleButtonContent}>
            <View style={[styles.battleIcon, !canEnter && styles.battleIconOff]}>
              <Swords size={22} color={canEnter ? T.primaryFg : T.muted} strokeWidth={2.2} />
            </View>
            <View style={styles.battleCopy}>
              <Text style={[styles.battleText, !canEnter && styles.battleTextOff]}>Battle</Text>
              <Text style={[styles.battleSubtext, !canEnter && styles.battleSubtextOff]}>
                {arena.name} · {formatMatchLength(arena.matchSeconds)} match · {arena.entryFee} coins
              </Text>
            </View>
            <ChevronRight size={22} color={canEnter ? T.primaryFg : T.muted} strokeWidth={2.4} />
          </View>
        </Button>

        {/* 참가비도 상대도 없는 판. 지갑이 비어도, 몇 번이든 들어올 수 있다. */}
        <Tap
          onPress={startSolo}
          accessibilityLabel={`Solo match, free, earns ${arena.soloReward} coins`}
          style={styles.solo}
        >
          <Dumbbell size={17} color={T.accentDeep} strokeWidth={2.2} />
          <Text style={styles.soloText}>Solo · free, no rating</Text>
          <Text style={styles.soloReward}>+{arena.soloReward} coins</Text>
        </Tap>

        {!canEnter ? (
          <View style={styles.gate}>
            <Coins size={15} color={T.danger} strokeWidth={2} />
            <Text style={styles.gateText}>
              {arena.entryFee - coins} more coins needed to enter {arena.name}
            </Text>
          </View>
        ) : null}
      </View>

      <CouponPicker
        slot={pickingSlot}
        inv={inv}
        onClose={() => setPickingSlot(null)}
        onChoose={(id) => {
          if (pickingSlot !== null) void equipCoupon(pickingSlot, id).then(() => refresh());
          setPickingSlot(null);
        }}
      />

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

  artOverlay: { position: 'absolute', top: 12, left: 12 },
  slots: { flexDirection: 'row', gap: 8 },
  slot: {
    // 정사각형. 그림 위에 얹히므로 바탕을 반투명 흰색으로 깔아 글자가 읽히게.
    width: 58,
    height: 58,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: T.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  slotFilled: {
    borderStyle: 'solid',
    borderColor: T.primary,
    backgroundColor: 'rgba(247,233,203,0.94)',
  },
  slotName: {
    fontFamily: T.fontMedium,
    fontSize: 10,
    lineHeight: 13,
    color: T.primaryDeep,
    textAlign: 'center',
  },

  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(34,38,28,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  pickerFrame: { width: '100%', maxWidth: 360 },
  picker: { padding: 18, gap: 10 },
  pickerTitle: {
    fontFamily: T.fontMedium,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: T.muted,
  },
  pickerEmpty: { fontFamily: T.font, fontSize: 14, lineHeight: 21, color: T.muted },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    backgroundColor: T.cardAlt,
  },
  pickerCopy: { flex: 1 },
  pickerName: { fontFamily: T.fontMedium, fontSize: 15, color: T.ink },
  pickerEffect: { fontFamily: T.font, fontSize: 12, lineHeight: 17, color: T.muted, marginTop: 2 },
  pickerCount: { fontFamily: T.fontMedium, fontSize: 14, color: T.accentDeep },
  pickerClear: { marginTop: 2 },

  standing: { gap: 2 },
  standingLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  standingName: { fontFamily: T.fontMedium, fontSize: 16 },
  standingElo: { fontFamily: T.font, fontSize: 13, color: T.muted },

  eloTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: T.bgSunk,
    overflow: 'hidden',
    marginBottom: 10,
  },
  eloFill: { height: '100%', borderRadius: 3, backgroundColor: T.primary },

  promo: { padding: 16, gap: 8 },
  promoHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promoTitle: { fontFamily: T.fontMedium, fontSize: 17, color: T.primaryDeep },
  promoBody: { fontFamily: T.font, fontSize: 14, lineHeight: 21, color: T.inkSoft },
  promoButton: { alignSelf: 'flex-start', marginTop: 4 },

  solo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: T.accentSoft,
  },
  soloText: { flex: 1, fontFamily: T.fontMedium, fontSize: 15, color: T.accentDeep },
  soloReward: { fontFamily: T.font, fontSize: 13, color: T.accentDeep, opacity: 0.8 },

  gate: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  gateText: { fontFamily: T.fontMedium, fontSize: 14, color: T.inkSoft, textAlign: 'center' },

  battleIconOff: { backgroundColor: T.bgSunk },
  battleTextOff: { color: T.muted },
  battleSubtextOff: { color: T.muted },

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
  rankDot: { width: 8, height: 8, borderRadius: 4 },

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
