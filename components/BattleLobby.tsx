import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Castle,
  ChevronRight,
  Coins,
  Crown,
  Swords,
  Trophy,
  X,
} from 'lucide-react-native';
import { PixelBox, PixelButton, T } from './pixel';
import { loadProfile, type Profile } from '../lib/auth';

type BattlePhase = 'lobby' | 'searching' | 'matchFound';

type BattleLobbyProps = {
  /** 매치가 잡혔다. 카운트다운부터는 App 이 타이머 화면 위에서 이어 간다. */
  onMatchStart: () => void;
  /** 매칭을 걸었는지(=탭을 잠가야 하는지) 알린다. */
  onMatchmakingChange?: (searching: boolean) => void;
};

const TIPS = [
  'A focused mind earns the biggest combo.',
  'Short sessions still move your crown forward.',
  'Protect your streak. One page at a time.',
  'Your opponent is studying too. Stay sharp.',
];

export const OPPONENT = {
  name: 'NOVA_MINT',
  trophies: 1842,
  title: 'FOCUS RANGER',
  avatar: '🦊',
};

function StatPill({ icon: Icon, label, value, color }: {
  icon: typeof Trophy;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.statPill}>
      <Icon size={14} color={color} strokeWidth={2.8} />
      <View>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
      </View>
    </View>
  );
}

function ProfileStrip({ profile, opponent = false }: { profile: { name: string; trophies: number; title: string; avatar: string }; opponent?: boolean }) {
  return (
    <View style={[styles.profileStrip, opponent ? styles.opponentStrip : styles.playerStrip]}>
      <View style={styles.avatarRing}>
        <Text style={styles.avatar}>{profile.avatar}</Text>
      </View>
      <View style={styles.profileCopy}>
        <Text style={styles.profileTitle}>{profile.title}</Text>
        <Text style={styles.profileName} numberOfLines={1}>{profile.name}</Text>
      </View>
      <View style={styles.trophyMini}>
        <Trophy size={13} color={T.primary} fill={opponent ? T.primary : T.secondary} />
        <Text style={styles.trophyText}>{profile.trophies}</Text>
      </View>
    </View>
  );
}

function ArenaArt() {
  return (
    <PixelBox shadow={4} style={styles.arenaFrame} boxStyle={styles.arenaBorder}>
      <LinearGradient colors={[T.secondary, T.bg, T.primaryFg]} style={styles.arena}>
      <View style={[styles.cloud, styles.cloudOne]} />
      <View style={[styles.cloud, styles.cloudTwo]} />
      <View style={styles.arenaCrown}>
        <Crown size={46} color={T.ink} fill={T.primary} strokeWidth={2.5} />
      </View>
      <View style={styles.arenaIsland}>
        <View style={[styles.tower, styles.towerLeft]}><Castle size={24} color={T.primaryFg} fill={T.ink} /></View>
        <View style={styles.arenaGate}><Swords size={34} color={T.primary} strokeWidth={2.5} /></View>
        <View style={[styles.tower, styles.towerRight]}><Castle size={24} color={T.primaryFg} fill={T.ink} /></View>
      </View>
      <View style={styles.arenaBadge}>
        <Text style={styles.arenaBadgeText}>ARENA 04</Text>
        <Text style={styles.arenaName}>STUDY CAFE</Text>
      </View>
      </LinearGradient>
    </PixelBox>
  );
}

function SearchOverlay({ elapsed, tip, onCancel }: { elapsed: number; tip: string; onCancel: () => void }) {
  return (
    <View style={styles.overlay}>
      <View style={styles.searchCard}>
        <ActivityIndicator size="large" color={T.primary} />
        <Text style={styles.searchEyebrow}>SEARCHING THE ARENA</Text>
        <Text style={styles.searchTime}>00:{elapsed.toString().padStart(2, '0')}</Text>
        <Text style={styles.searchCopy}>Finding a worthy study rival...</Text>
        <PixelButton onPress={onCancel} color="#6b3f42" shadow={3} accessibilityLabel="Cancel matchmaking" style={styles.cancelButton} boxStyle={styles.cancelBox}>
          <View style={styles.cancelContent}><X size={15} color="#fff1e6" /><Text style={styles.cancelText}>CANCEL</Text></View>
        </PixelButton>
      </View>
      <View style={styles.tipBox}>
        <Text style={styles.tipLabel}>STUDY TIP</Text>
        <Text style={styles.tipText}>{tip}</Text>
      </View>
    </View>
  );
}

function MatchFoundOverlay({ player, onCountdown }: { player: { name: string; trophies: number; title: string; avatar: string }; onCountdown: () => void }) {
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
      <Animated.View style={[styles.vsHalf, styles.vsRed, { transform: [{ translateY: topY }] }]}>
        <Text style={styles.vsCaption}>OPPONENT</Text>
        <ProfileStrip profile={OPPONENT} opponent />
      </Animated.View>
      <Animated.View style={[styles.vsHalf, styles.vsBlue, { transform: [{ translateY: bottomY }] }]}>
        <Text style={styles.vsCaption}>YOUR DECK</Text>
        <ProfileStrip profile={player} />
      </Animated.View>
      <Animated.View style={[styles.vsBadge, { transform: [{ scale: badgeScale }] }]}>
        <Text style={styles.vsText}>VS</Text>
      </Animated.View>
    </View>
  );
}

export default function BattleLobby({ onMatchStart, onMatchmakingChange }: BattleLobbyProps) {
  const [phase, setPhase] = useState<BattlePhase>('lobby');
  const [elapsed, setElapsed] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [profile, setProfile] = useState<Profile>({ name: 'FOCUS KNIGHT', avatar: '🦉' });

  useEffect(() => {
    loadProfile().then((saved) => {
      if (saved) setProfile(saved);
    });
  }, []);

  useEffect(() => {
    if (phase !== 'searching') return;
    const interval = setInterval(() => setElapsed((value) => value + 1), 1000);
    const found = setTimeout(() => setPhase('matchFound'), 3200);
    const tip = setInterval(() => setTipIndex((value) => (value + 1) % TIPS.length), 3500);
    return () => {
      clearInterval(interval);
      clearTimeout(found);
      clearInterval(tip);
    };
  }, [phase]);

  const startSearching = () => {
    setElapsed(0);
    setPhase('searching');
    onMatchmakingChange?.(true);
  };

  const cancelSearching = () => {
    setElapsed(0);
    setPhase('lobby');
    onMatchmakingChange?.(false);
  };

  const player = {
    name: profile.name || 'FOCUS KNIGHT',
    avatar: profile.avatar || '🦉',
    trophies: 2137,
    title: profile.title || 'NIGHT SCHOLAR',
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={[T.bg, T.bg, T.secondary]} style={styles.background}>
        <View style={styles.header}>
          <View style={styles.playerIdentity}>
            <View style={styles.headerAvatar}><Text style={styles.headerAvatarText}>{player.avatar}</Text></View>
            <View>
              <Text style={styles.levelLabel}>LEVEL 18</Text>
              <Text style={styles.headerName} numberOfLines={1}>{player.name}</Text>
            </View>
          </View>
          <View style={styles.headerStats}>
            <StatPill icon={Trophy} label="TROPHIES" value="2,137" color="#ffe39a" />
            <StatPill icon={Coins} label="H-COIN" value="480" color="#7fe1ce" />
          </View>
        </View>

        <View style={styles.content}>
          <ArenaArt />
          <PixelButton onPress={startSearching} color="#e9a72f" shadow={7} accessibilityLabel="Start battle" boxStyle={styles.battleButton}>
            <View style={styles.battleButtonContent}>
              <Swords size={28} color={T.primaryFg} fill={T.ink} strokeWidth={2.5} />
              <View>
                <Text style={styles.battleText}>BATTLE</Text>
                <Text style={styles.battleSubtext}>START MATCH</Text>
              </View>
              <ChevronRight size={24} color={T.primaryFg} strokeWidth={3} />
            </View>
          </PixelButton>
        </View>

        {phase === 'searching' && <SearchOverlay elapsed={elapsed} tip={TIPS[tipIndex]} onCancel={cancelSearching} />}
        {phase === 'matchFound' && <MatchFoundOverlay player={player} onCountdown={onMatchStart} />}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  background: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: T.ink, backgroundColor: T.bg },
  playerIdentity: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  headerAvatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 3, borderColor: T.ink, backgroundColor: T.secondary, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  headerAvatarText: { fontSize: 24 },
  levelLabel: { fontFamily: T.fontPixel, color: T.muted, fontSize: 7, marginBottom: 5 },
  headerName: { fontFamily: T.fontPixel, color: T.ink, fontSize: 9, maxWidth: 126 },
  headerStats: { flexDirection: 'row', gap: 8 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 66 },
  statLabel: { color: T.muted, fontFamily: T.fontPixel, fontSize: 5, marginBottom: 3 },
  statValue: { fontFamily: T.fontPixel, fontSize: 8 },
  content: { flex: 1, paddingHorizontal: 16, justifyContent: 'space-between', paddingTop: 12, paddingBottom: 8 },
  arenaFrame: { flex: 1, minHeight: 260, maxHeight: 360 },
  arenaBorder: { flex: 1, borderColor: T.ink, padding: 0, overflow: 'hidden' },
  arena: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  cloud: { position: 'absolute', width: 104, height: 30, borderRadius: 20, backgroundColor: 'rgba(46,34,24,0.08)' },
  cloudOne: { top: 32, left: 14 },
  cloudTwo: { top: 72, right: 12, width: 76 },
  arenaCrown: { position: 'absolute', top: 30, alignItems: 'center', justifyContent: 'center', width: 92, height: 76, borderWidth: 3, borderColor: T.ink, backgroundColor: 'rgba(244,240,230,0.58)' },
  arenaIsland: { width: '78%', height: '43%', backgroundColor: T.secondary, borderTopWidth: 4, borderColor: T.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 20 },
  tower: { width: 48, height: 62, borderWidth: 3, borderColor: T.ink, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
  towerLeft: { transform: [{ rotate: '-4deg' }] },
  towerRight: { transform: [{ rotate: '4deg' }] },
  arenaGate: { width: 74, height: 74, borderRadius: 38, borderWidth: 5, borderColor: T.ink, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },
  arenaBadge: { position: 'absolute', bottom: 8, backgroundColor: T.ink, borderWidth: 3, borderColor: T.primary, paddingHorizontal: 13, paddingVertical: 7, alignItems: 'center' },
  arenaBadgeText: { fontFamily: T.fontPixel, color: T.primaryFg, fontSize: 7 },
  arenaName: { fontFamily: T.fontPixel, color: T.primaryFg, fontSize: 9, marginTop: 4 },
  battleButton: { borderColor: T.ink, borderWidth: 3, minHeight: 70, alignItems: 'center', justifyContent: 'center' },
  battleButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 16 },
  battleText: { fontFamily: T.fontPixel, fontSize: 19, color: T.primaryFg, textShadowColor: T.ink, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  battleSubtext: { fontFamily: T.fontPixel, fontSize: 6, color: T.ink, marginTop: 5 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(244,240,230,0.96)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  searchCard: { width: '100%', maxWidth: 350, alignItems: 'center', backgroundColor: T.bg, borderWidth: 4, borderColor: T.ink, padding: 28 },
  searchEyebrow: { fontFamily: T.fontPixel, color: T.ink, fontSize: 9, marginTop: 22 },
  searchTime: { fontFamily: T.fontPixel, color: T.primary, fontSize: 28, marginTop: 17 },
  searchCopy: { fontFamily: T.fontPixel, color: T.muted, fontSize: 7, marginTop: 12 },
  // 여백은 바깥(Pressable)에 준다. boxStyle 에 margin 을 주면 그림자 사각형이 그 여백까지 덮어
  // 버튼 위로 삐져나오고, 글자가 눌린 것처럼 보인다.
  cancelButton: { marginTop: 28 },
  cancelBox: { borderColor: T.ink, minWidth: 150, alignItems: 'center', justifyContent: 'center' },
  cancelContent: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: 20 },
  cancelText: { fontFamily: T.fontPixel, fontSize: 8, color: T.primaryFg },
  tipBox: { position: 'absolute', bottom: 26, left: 22, right: 22, borderTopWidth: 2, borderTopColor: T.ink, paddingTop: 12, alignItems: 'center' },
  tipLabel: { fontFamily: T.fontPixel, fontSize: 6, color: T.primary },
  tipText: { fontFamily: T.fontPixel, fontSize: 7, color: T.muted, marginTop: 8, textAlign: 'center' },
  vsOverlay: { ...StyleSheet.absoluteFill, backgroundColor: T.bg, overflow: 'hidden' },
  vsHalf: { position: 'absolute', left: 0, right: 0, height: '50%', paddingHorizontal: 18, justifyContent: 'center' },
  vsRed: { top: 0, backgroundColor: T.primary, alignItems: 'flex-start' },
  vsBlue: { bottom: 0, backgroundColor: T.secondary, alignItems: 'flex-end' },
  vsCaption: { fontFamily: T.fontPixel, color: T.ink, fontSize: 7, marginBottom: 10 },
  profileStrip: { flexDirection: 'row', alignItems: 'center', width: '100%', maxWidth: 310, borderWidth: 3, padding: 10, backgroundColor: T.bg },
  opponentStrip: { borderColor: T.ink },
  playerStrip: { borderColor: T.ink },
  avatarRing: { width: 48, height: 48, borderRadius: 24, backgroundColor: T.secondary, borderWidth: 3, borderColor: T.ink, alignItems: 'center', justifyContent: 'center' },
  avatar: { fontSize: 26 },
  profileCopy: { flex: 1, marginLeft: 10 },
  profileTitle: { fontFamily: T.fontPixel, color: T.muted, fontSize: 6, marginBottom: 6 },
  profileName: { fontFamily: T.fontPixel, color: T.ink, fontSize: 9 },
  trophyMini: { alignItems: 'center', gap: 4 },
  trophyText: { fontFamily: T.fontPixel, color: T.primary, fontSize: 8 },
  vsBadge: { position: 'absolute', top: '42%', left: '50%', marginLeft: -48, width: 96, height: 62, borderWidth: 5, borderColor: T.ink, backgroundColor: T.bg, transform: [{ rotate: '-5deg' }], alignItems: 'center', justifyContent: 'center' },
  vsText: { fontFamily: T.fontPixel, color: T.ink, fontSize: 29, textShadowColor: T.primary, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
});
