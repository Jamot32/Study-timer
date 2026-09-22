import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Trophy, X } from 'lucide-react-native';
import { PixelBox, PixelButton, T } from './pixel';
import { OPPONENT } from './BattleLobby';

const formatTime = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

type OpponentViewProps = {
  visible: boolean;
  /** 상대가 이번 매치에서 쌓은 초. */
  elapsed: number;
  /** 내가 쌓은 초. 둘을 나란히 놓고 누가 앞서는지 보여 준다. */
  yourElapsed: number;
  onClose: () => void;
};

/** 1대1 배틀 중 상대 타이머를 들여다보는 창. */
export default function OpponentView({ visible, elapsed, yourElapsed, onClose }: OpponentViewProps) {
  const lead = elapsed - yourElapsed;
  const verdict =
    lead > 0 ? `THEY LEAD BY ${formatTime(lead)}` : lead < 0 ? `YOU LEAD BY ${formatTime(-lead)}` : 'DEAD EVEN';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <PixelBox shadow={6} style={styles.cardFrame} boxStyle={styles.card}>
          <Text style={styles.eyebrow}>OPPONENT SCREEN</Text>

          <View style={styles.identity}>
            <View style={styles.avatarRing}>
              <Text style={styles.avatar}>{OPPONENT.avatar}</Text>
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.title}>{OPPONENT.title}</Text>
              <Text style={styles.name} numberOfLines={1}>{OPPONENT.name}</Text>
            </View>
            <View style={styles.trophy}>
              <Trophy size={13} color={T.primary} />
              <Text style={styles.trophyText}>{OPPONENT.trophies}</Text>
            </View>
          </View>

          <PixelBox shadow={0} boxStyle={styles.timerBox}>
            <Text style={styles.timerLabel}>THEIR FOCUS</Text>
            <Text style={styles.timerValue} accessibilityLiveRegion="polite">{formatTime(elapsed)}</Text>
            <Text style={styles.timerStatus}>IN SESSION</Text>
          </PixelBox>

          <View style={styles.compareRow}>
            <Text style={styles.compareLabel}>YOURS</Text>
            <Text style={styles.compareValue}>{formatTime(yourElapsed)}</Text>
          </View>
          <Text style={[styles.verdict, lead < 0 && { color: T.primary }]}>{verdict}</Text>

          <PixelButton
            onPress={onClose}
            color={T.secondary}
            shadow={3}
            accessibilityLabel="Close opponent screen"
            style={styles.closeButton}
            boxStyle={styles.closeBox}
          >
            <X size={15} color={T.ink} />
            <Text style={styles.closeText}>BACK TO MY TIMER</Text>
          </PixelButton>
        </PixelBox>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(46,34,24,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  cardFrame: { width: '100%', maxWidth: 340 },
  card: { backgroundColor: T.bg, borderColor: T.ink, padding: 20 },
  eyebrow: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted },
  identity: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  avatarRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: T.ink, backgroundColor: T.secondary, alignItems: 'center', justifyContent: 'center' },
  avatar: { fontSize: 24 },
  identityCopy: { flex: 1, marginLeft: 10 },
  title: { fontFamily: T.fontPixel, fontSize: 6, color: T.muted, marginBottom: 6 },
  name: { fontFamily: T.fontPixel, fontSize: 9, color: T.ink },
  trophy: { alignItems: 'center', gap: 4 },
  trophyText: { fontFamily: T.fontPixel, fontSize: 8, color: T.primary },
  timerBox: { marginTop: 16, paddingVertical: 16, alignItems: 'center', backgroundColor: T.secondary, borderColor: T.ink },
  timerLabel: { fontFamily: T.fontPixel, fontSize: 7, color: T.muted },
  timerValue: { fontFamily: T.fontPixel, fontSize: 22, color: T.ink, marginTop: 12 },
  timerStatus: { fontFamily: T.fontPixel, fontSize: 6, color: T.primary, marginTop: 10 },
  compareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  compareLabel: { fontFamily: T.fontPixel, fontSize: 7, color: T.muted },
  compareValue: { fontFamily: T.fontPixel, fontSize: 10, color: T.ink },
  verdict: { fontFamily: T.fontPixel, fontSize: 7, color: T.muted, marginTop: 10 },
  // 여백은 바깥에, 모양은 안쪽 박스에 — 그림자가 여백까지 덮지 않도록.
  closeButton: { marginTop: 20 },
  closeBox: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  closeText: { fontFamily: T.fontPixel, fontSize: 8, color: T.ink },
});
