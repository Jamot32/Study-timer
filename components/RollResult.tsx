import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Coffee, Coins } from 'lucide-react-native';
import { Button, RADIUS, SEMANTIC, T, elevation } from '@/components/nova';
import { groupInfo, itemGroupOf, itemIcon } from '@/components/itemMeta';
import { shopById } from '@/lib/shop';
import type { Coupon } from '@/lib/coupons';

// ============================================================
// ROLL RESULT — 책을 펼친 순간
// 3D 책이 평평하게 눕고 나면 이 화면으로 바꿔 끼운다. 두 쪽은 같은 크기로 대칭이다
// (3D 장면은 양쪽 종이 더미 두께가 달라 페이지 높이가 어긋나 보였다).
//
// 오른쪽 쪽이 주인공이다 — 큰 아이콘, 이름, 한 줄 요약.
// 왼쪽 명언은 조연이다 — 작은 이탤릭, 연한 색. 분위기를 위한 장치지 정보가 아니다.
// ============================================================

export type RollDraw =
  | { kind: 'time'; label: string; minutes: number }
  | { kind: 'coupon'; coupon: Coupon; coins: number };

/** 'THE DIE IS CAST.' → 'The die is cast.' 대문자 문장은 단어 모양이 비슷해져 읽기가 느리다. */
export function sentenceCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/(^\s*[a-z]|[.!?]\s+[a-z])/g, (c) => c.toUpperCase())
    .replace(/\bi\b/g, 'I');
}

/** 'JULIUS CAESAR' → 'Julius Caesar'. */
const titleCase = (name: string) => name.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** 0 에서 목표까지 올라가는 숫자. 주사위 코인이 지갑으로 들어가는 순간. */
function useCountUp(target: number, run: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run || target <= 0) return;
    const start = Date.now();
    const DURATION = 900;
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [run, target]);
  return value;
}

export default function RollResult({
  draw,
  quote,
  who,
  ticketsLeft,
  equippedIds,
  onEquip,
  onOpenBag,
  onRollAgain,
  onClose,
}: {
  draw: RollDraw;
  quote: string;
  who: string;
  ticketsLeft: number;
  /** 지금 배틀 슬롯에 끼워진 것들. 이미 끼웠으면 '장착'을 다시 보이지 않는다. */
  equippedIds: (string | null)[];
  /** 비어 있는 첫 슬롯에 끼운다. 둘 다 찼으면 false 를 돌려준다. */
  onEquip: (id: string) => Promise<boolean>;
  onOpenBag: () => void;
  onRollAgain: () => void;
  onClose: () => void;
}) {
  const coupon = draw.kind === 'coupon' ? draw.coupon : null;
  const entry = coupon ? shopById(coupon.id) : undefined;
  const group = entry ? itemGroupOf(entry) : null;
  const dice = coupon?.id === 'luckyGamble';
  const Icon = entry ? itemIcon(entry) : draw.kind === 'time' ? Coffee : Coins;

  const [details, setDetails] = useState(false);
  const [equipped, setEquipped] = useState(!!coupon && equippedIds.includes(coupon.id));
  const [slotsFull, setSlotsFull] = useState(false);

  // ---------- 등장 연출 ----------
  // 1) 책이 화면 가득 커지며 나타난다
  const book = useRef(new Animated.Value(0)).current;
  // 2) 오른쪽 쪽에서 쿠폰이 살짝 떠오른다
  const rise = useRef(new Animated.Value(0)).current;
  // 3) 그 뒤로 은은하게 빛이 숨 쉰다
  const glow = useRef(new Animated.Value(0)).current;
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(book, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(rise, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start(() => {
      setRevealed(true);
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 1100, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 1100, useNativeDriver: true }),
        ])
      ).start();
    });
    // 쿠폰은 또렷한 성공 진동, 휴식은 가벼운 한 번.
    const t = setTimeout(() => {
      void (draw.kind === 'coupon'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      ).catch(() => {});
    }, 320);
    return () => clearTimeout(t);
  }, [book, rise, glow, draw.kind]);

  const coins = useCountUp(draw.kind === 'coupon' ? draw.coins : 0, revealed && dice);

  // ---------- 오른쪽 쪽 내용 ----------
  const title = draw.kind === 'time' ? `${draw.minutes} min rest` : coupon!.name;
  const tagline =
    draw.kind === 'time'
      ? draw.label.charAt(0).toUpperCase() + draw.label.slice(1)
      : dice
        ? 'Added to your wallet'
        : coupon!.tagline;
  const fullText =
    draw.kind === 'time'
      ? `${draw.minutes} minutes of rest, saved to the break chip on your timer. Spend it whenever you need — it stays between matches.`
      : coupon!.effect;
  const howTo = group ? groupInfo(group).howTo : null;

  // ---------- 다음 행동 ----------
  // 주 버튼은 쿠폰 종류를 따른다: 슬롯 쿠폰이면 지금 장착, 가방에서 쓰는 것이면 가방에서 보기.
  // 휴식·주사위는 이미 들어왔으니 닫기가 주 행동이 된다.
  let primary: { label: string; onPress: () => void; disabled?: boolean };
  if (coupon && group === 'slot') {
    primary = equipped
      ? { label: 'Equipped', onPress: () => {}, disabled: true }
      : slotsFull
        ? { label: 'Slots full — see in bag', onPress: onOpenBag }
        : {
            label: 'Equip now',
            onPress: () =>
              void onEquip(coupon.id).then((ok) => (ok ? setEquipped(true) : setSlotsFull(true))),
          };
  } else if (coupon && !dice) {
    primary = { label: 'See in bag', onPress: onOpenBag };
  } else {
    primary = { label: 'Done', onPress: onClose };
  }

  const bookStyle = {
    opacity: book,
    transform: [{ scale: book.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
  };
  const heroStyle = {
    opacity: rise,
    transform: [
      { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
      { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
    ],
  };
  const glowStyle = {
    opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] }),
    transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bookArea}>
      <Animated.View style={[styles.book, bookStyle]}>
        {/* 왼쪽 — 조연: 펼쳤더니 이런 구절이 있었다 */}
        <View style={[styles.page, styles.pageLeft]}>
          <Text style={styles.quote}>“{sentenceCase(quote)}”</Text>
          {who ? <Text style={styles.who}>— {titleCase(who)}</Text> : null}
        </View>
        <View style={styles.spine} />
        {/* 오른쪽 — 주인공: 무엇을 뽑았나 */}
        <View style={[styles.page, styles.pageRight]}>
          <Animated.View style={[styles.hero, heroStyle]}>
            <View style={styles.iconWrap}>
              <Animated.View style={[styles.iconGlow, glowStyle]} />
              <View style={styles.iconTile}>
                <Icon size={30} color={T.primaryDeep} strokeWidth={2} />
              </View>
            </View>
            {dice ? (
              <Text style={styles.coinsBig}>+{coins}</Text>
            ) : null}
            <Text style={styles.heroTitle} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.heroTagline} numberOfLines={2}>
              {tagline}
            </Text>
            <Pressable
              onPress={() => setDetails(true)}
              accessibilityRole="button"
              accessibilityLabel="See details"
              hitSlop={8}
            >
              <Text style={styles.detailsLink}>See details ›</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
      </View>

      {/* 다음 행동 — 주 버튼 · 한 번 더 · 닫기(가장 약하게) */}
      <View style={styles.actions}>
        <Button block size="lg" onPress={primary.onPress} disabled={primary.disabled}>
          {primary.label}
        </Button>
        {ticketsLeft > 0 ? (
          <Button block variant="outline" onPress={onRollAgain}>
            {`Roll again · ${ticketsLeft} ticket${ticketsLeft === 1 ? '' : 's'}`}
          </Button>
        ) : null}
        {primary.label !== 'Done' ? (
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8} style={styles.close}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        ) : null}
      </View>

      {/* 자세히 — 전체 설명과 쓰는 법 */}
      <Modal visible={details} transparent animationType="slide" onRequestClose={() => setDetails(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setDetails(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetGrip} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <Text style={styles.sheetBody}>{fullText}</Text>
          {howTo ? (
            <View style={styles.sheetHow}>
              <Text style={styles.sheetHowLabel}>How to use</Text>
              <Text style={styles.sheetHowText}>{howTo}</Text>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 12 },
  // 책은 남는 세로 공간 한가운데에 — 위아래가 텅 빈 '정지된 페이지'로 보이지 않게.
  bookArea: { flex: 1, justifyContent: 'center' },

  // 펼친 책 — 두 쪽은 같은 크기, 실제 펼친 책 비율(한 쪽이 세로로 조금 긴)
  book: {
    width: '100%',
    aspectRatio: 1.3,
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    backgroundColor: T.primaryDeep,
    padding: 6,
    ...elevation(3),
  },
  page: { flex: 1, backgroundColor: T.card, paddingHorizontal: 16, paddingVertical: 22 },
  pageLeft: { borderTopLeftRadius: RADIUS.md, borderBottomLeftRadius: RADIUS.md, justifyContent: 'center' },
  pageRight: { borderTopRightRadius: RADIUS.md, borderBottomRightRadius: RADIUS.md, justifyContent: 'center' },
  spine: { width: 2, backgroundColor: T.border },

  quote: {
    fontFamily: 'Fraunces_400Regular_Italic',
    fontSize: 15,
    lineHeight: 22,
    color: T.muted,
  },
  who: { fontFamily: T.font, fontSize: 12, color: T.muted, marginTop: 10, opacity: 0.85 },

  hero: { alignItems: 'center', gap: 8 },
  iconWrap: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  iconGlow: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: T.primarySoft,
  },
  iconTile: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.primarySoft,
  },
  coinsBig: { fontFamily: T.fontDisplay, fontSize: 34, color: SEMANTIC.coin.fg, letterSpacing: -0.5 },
  heroTitle: { fontFamily: T.fontDisplay, fontSize: 22, lineHeight: 27, color: T.ink, textAlign: 'center' },
  heroTagline: { fontFamily: T.font, fontSize: 14, lineHeight: 20, color: T.inkSoft, textAlign: 'center' },
  detailsLink: { fontFamily: T.fontMedium, fontSize: 13, color: T.muted, marginTop: 4 },

  actions: { gap: 10, paddingTop: 16 },
  close: { alignSelf: 'center', paddingVertical: 6 },
  closeText: { fontFamily: T.fontMedium, fontSize: 14, color: T.muted },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(34,38,28,0.4)' },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    gap: 12,
  },
  sheetGrip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: T.border },
  sheetTitle: { fontFamily: T.fontDisplay, fontSize: 22, color: T.ink },
  sheetBody: { fontFamily: T.font, fontSize: 16, lineHeight: 24, color: T.ink },
  sheetHow: { padding: 14, borderRadius: RADIUS.md, backgroundColor: T.cardAlt, gap: 4 },
  sheetHowLabel: {
    fontFamily: T.fontMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: T.muted,
  },
  sheetHowText: { fontFamily: T.font, fontSize: 14, lineHeight: 21, color: T.inkSoft },
});
