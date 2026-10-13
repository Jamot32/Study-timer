import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, Coins } from 'lucide-react-native';
import { Button, Card, RADIUS, SEMANTIC, T, Tap } from '@/components/nova';
import {
  applyLedger,
  bagUseBlocked,
  countOf,
  debugSet,
  equipCoupon,
  settleDailyCoupons,
  spendBagCoupon,
  useInventory,
  type Inventory,
} from '@/lib/inventory';
import { ARENAS, arenaById, STARTING_ELO } from '@/lib/arena';
import { DEFAULT_INVENTORY } from '@/lib/inventory';
import { priceOf, shopById, shopShelf, type ShopEntry } from '@/lib/shop';
import { groupInfo, itemGroupOf, itemIcon, ITEM_GROUPS } from '@/components/itemMeta';
import {
  daysBetween,
  CAPSULE_DAILY_MINUTES,
  CAPSULE_DAYS,
  COMPOUND_MIN_MINUTES,
  COMPOUND_NIGHTS,
  COUPON_USE,
} from '@/lib/couponEffects';
import { dayKey } from '@/lib/sessions';

type Pane = 'shop' | 'bag';

/** 위쪽 [SHOP | BAG] 스위치. 세팅 화면의 세그먼트와 같은 문법. */
function PaneSwitch({ pane, onChange }: { pane: Pane; onChange: (p: Pane) => void }) {
  return (
    <View style={styles.segmented}>
      {(['shop', 'bag'] as Pane[]).map((value) => {
        const selected = value === pane;
        return (
          <Tap
            key={value}
            accessibilityState={{ selected }}
            onPress={() => onChange(value)}
            style={[styles.segment, selected ? styles.segmentSelected : null]}
          >
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
              {value === 'shop' ? 'Shop' : 'Bag'}
            </Text>
          </Tap>
        );
      })}
    </View>
  );
}

function PriceTag({ price }: { price: number }) {
  return (
    <View style={styles.price}>
      <Coins size={15} color={SEMANTIC.coin.fg} strokeWidth={2} />
      <Text style={styles.priceText}>{price.toLocaleString()}</Text>
    </View>
  );
}

/** 물건 아이콘 칸. 이름을 다 읽지 않아도 훑을 수 있게. */
function ItemIcon({ entry, size = 40 }: { entry: ShopEntry; size?: number }) {
  const Icon = itemIcon(entry);
  return (
    <View style={[styles.icon, { width: size, height: size, borderRadius: size * 0.3 }]}>
      <Icon size={size * 0.5} color={T.inkSoft} strokeWidth={2} />
    </View>
  );
}

/**
 * 물건 한 줄: 아이콘 · 이름 · 짧은 요약 · 오른쪽 행동.
 * 요약은 자른 문장이 아니라 따로 쓴 tagline 이라 핵심이 잘리지 않는다.
 * 줄을 누르면 바텀 시트로 전체 설명이 뜬다.
 */
function ItemRow({
  entry,
  right,
  onOpen,
}: {
  entry: ShopEntry;
  right: React.ReactNode;
  onOpen: () => void;
}) {
  return (
    <Card level={1} boxStyle={styles.item}>
      <Tap onPress={onOpen} accessibilityLabel={`${entry.name}, ${entry.tagline}. Show details`} style={styles.itemTap}>
        <ItemIcon entry={entry} />
        <View style={styles.itemCopy}>
          <Text style={styles.rowName} numberOfLines={1}>
            {entry.name}
          </Text>
          <Text style={styles.itemShort} numberOfLines={1}>
            {entry.tagline}
          </Text>
        </View>
      </Tap>
      {right}
    </Card>
  );
}

/** 상점 쪽 오른쪽 끝: 값 + Buy, 이미 가진 꾸밈새면 Owned. */
function BuyRight({
  entry,
  price,
  owned,
  coins,
  onBuy,
}: {
  entry: ShopEntry;
  price: number;
  owned: number;
  coins: number;
  onBuy: () => void;
}) {
  if (entry.unique && owned > 0) {
    return (
      <View style={styles.ownedTag}>
        <Check size={14} color={SEMANTIC.selected.fg} strokeWidth={2.5} />
        <Text style={styles.ownedText}>Owned</Text>
      </View>
    );
  }
  return (
    <View style={styles.buyBox}>
      <PriceTag price={price} />
      {/* 사는 버튼은 앰버를 쓰지 않는다 — 목록 전체가 앰버로 번진다. */}
      <Button
        size="sm"
        variant="outline"
        disabled={coins < price}
        onPress={onBuy}
        accessibilityLabel={`Buy ${entry.name} for ${price} coins`}
      >
        Buy
      </Button>
    </View>
  );
}

/**
 * 상세 바텀 시트. 전체 설명 · 어떻게 쓰는지 · 보유 개수 · 행동을 한곳에.
 * 카드를 펼치는 대신 시트로 띄워 목록은 늘 깔끔하게 둔다.
 */
function ItemSheet({
  entry,
  owned,
  action,
  onClose,
}: {
  entry: ShopEntry | null;
  owned: number;
  action: React.ReactNode;
  onClose: () => void;
}) {
  if (!entry) return null;
  const group = groupInfo(itemGroupOf(entry));
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Tap onPress={onClose} style={styles.sheetBackdrop} accessibilityLabel="Close details">
        <View />
      </Tap>
      <View style={styles.sheet}>
        <View style={styles.sheetGrip} />
        <View style={styles.sheetHead}>
          <ItemIcon entry={entry} size={52} />
          <View style={styles.sheetTitleBox}>
            <Text style={styles.sheetTitle}>{entry.name}</Text>
            <Text style={styles.sheetGroup}>{group.title}</Text>
          </View>
        </View>
        <Text style={styles.sheetBody}>{entry.blurb}</Text>
        <View style={styles.sheetHow}>
          <Text style={styles.sheetHowLabel}>How to use</Text>
          <Text style={styles.sheetHowText}>{group.howTo}</Text>
        </View>
        <View style={styles.sheetFoot}>
          <Text style={styles.sheetOwned}>
            {entry.unique ? (owned > 0 ? 'Owned' : 'Not owned') : `You hold ${owned}`}
          </Text>
          {action}
        </View>
      </View>
    </Modal>
  );
}

/** 가방의 쿠폰 한 장이 어떻게 쓰이는지. 판 쿠폰·지킴이는 안내만, 가방 쿠폰은 USE 버튼. */
function BagAction({
  inv,
  entry,
  onUsed,
}: {
  inv: Inventory;
  entry: ShopEntry;
  /** 주사위면 나온 코인, 아니면 0. */
  onUsed: (coins: number) => void;
}) {
  const coupon = entry.coupon;
  if (!coupon) return null;
  const use = COUPON_USE[coupon.id];

  if (use === 'slot') {
    // 가방에서 바로 배틀 슬롯에 끼운다. 비어 있는 첫 칸으로.
    const equipped = inv.equipped.includes(coupon.id);
    const free = inv.equipped.findIndex((slot) => !slot);
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={equipped || free < 0}
        onPress={() => void equipCoupon(free as 0 | 1, coupon.id).then(() => onUsed(0))}
        accessibilityLabel={`Equip ${entry.name} in a battle slot`}
      >
        {equipped ? 'Equipped' : free < 0 ? 'Slots full' : 'Equip'}
      </Button>
    );
  }
  if (use === 'passive') return <Text style={styles.bagNote}>Automatic</Text>;
  if (use !== 'use' && use !== 'instant') return null;
  const blocked = bagUseBlocked(inv, coupon.id);
  const dice = use === 'instant';
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={!!blocked}
      onPress={() => void spendBagCoupon(coupon.id).then(({ coins }) => onUsed(coins))}
      accessibilityLabel={`${dice ? 'Roll' : 'Use'} ${entry.name}${blocked ? `, ${blocked}` : ''}`}
    >
      {dice ? 'Roll' : 'Use'}
    </Button>
  );
}

/** 지금 돌고 있는 쿠폰들. 며칠에 걸친 효과는 여기서 진행을 읽는다. */
function ActiveEffects({ inv, today }: { inv: Inventory; today: string }) {
  const lines: { title: string; body: string }[] = [];
  if (inv.capsule) {
    const day = Math.min(CAPSULE_DAYS, daysBetween(inv.capsule.startDay, today) + 1);
    lines.push({
      title: 'Time Capsule — sealed',
      body: `Day ${day} of ${CAPSULE_DAYS}. Study ${CAPSULE_DAILY_MINUTES} minutes every day to open it.`,
    });
  }
  if (inv.compound) {
    const left = COMPOUND_NIGHTS - daysBetween(inv.compound.startDay, today);
    lines.push({
      title: 'Compound Scroll — working',
      body: `${Math.max(1, left)} of ${COMPOUND_NIGHTS} nights left. Study ${COMPOUND_MIN_MINUTES} minutes today to grow at midnight.`,
    });
  }
  if (inv.secretShopDay === today) {
    lines.push({ title: 'Black market — open today', body: 'Hidden titles and skins, all at half price.' });
  }
  if (!lines.length) return null;
  return (
    <Card level={0} tone="accent" boxStyle={styles.active}>
      {lines.map((line) => (
        <View key={line.title}>
          <Text style={styles.activeTitle}>{line.title}</Text>
          <Text style={styles.activeBody}>{line.body}</Text>
        </View>
      ))}
    </Card>
  );
}

// ⚠️ 임시 — 테스트용 판. 규칙을 건너뛰고 재화를 만들어 낸다.
// 출시 전에 이 컴포넌트와 아래 호출부, lib/inventory 의 debugSet 을 함께 지운다.
function TestBench({ elo, arenaName, onChange }: { elo: number; arenaName: string; onChange: () => void }) {
  const give = async (patch: Parameters<typeof applyLedger>[0]) => {
    await applyLedger(patch);
    onChange();
  };
  const set = async (patch: Parameters<typeof debugSet>[0]) => {
    await debugSet(patch);
    onChange();
  };

  return (
    <Card level={0} tone="sunk" boxStyle={styles.bench}>
      <Text style={styles.benchTitle}>Test bench · temporary</Text>
      <Text style={styles.benchHint}>
        Free coins and rating for testing. ELO {elo} · {arenaName}. This panel ships nowhere.
      </Text>

      <View style={styles.benchRow}>
        <Button size="sm" variant="outline" onPress={() => give({ coins: 100 })}>
          +100 coins
        </Button>
        <Button size="sm" variant="outline" onPress={() => give({ coins: 1000 })}>
          +1,000 coins
        </Button>
      </View>

      <View style={styles.benchRow}>
        <Button size="sm" variant="outline" onPress={() => give({ elo: elo + 50 })}>
          +50 ELO
        </Button>
        <Button size="sm" variant="outline" onPress={() => give({ elo: Math.max(0, elo - 50) })}>
          −50 ELO
        </Button>
        <Button size="sm" variant="outline" onPress={() => give({ elo: elo + 200 })}>
          +200 ELO
        </Button>
      </View>

      {/* 방을 바로 옮겨 각 티어의 판 길이·참가비를 확인할 때. */}
      <View style={styles.benchRow}>
        {ARENAS.map((a) => (
          <Button
            key={a.id}
            size="sm"
            variant="ghost"
            onPress={() => set({ arenaId: a.id, elo: Math.max(a.eloFloor, 0) })}
          >
            {a.name}
          </Button>
        ))}
      </View>

      <View style={styles.benchRow}>
        <Button
          size="sm"
          variant="outline"
          onPress={() => set({ ...DEFAULT_INVENTORY, elo: STARTING_ELO })}
        >
          Reset everything
        </Button>
      </View>
    </Card>
  );
}

export default function Shop({ bagSignal = 0, refreshKey = 0 }: { bagSignal?: number; refreshKey?: number } = {}) {
  const [pane, setPane] = useState<Pane>('shop');
  // 다른 화면이 '가방에서 보기'를 요청하면 가방을 연다.
  useEffect(() => {
    if (bagSignal > 0) setPane('bag');
  }, [bagSignal]);
  const { inv, buy, refresh } = useInventory(refreshKey);
  const today = dayKey(new Date());
  const secretOpen = inv.secretShopDay === today;
  // 가방에서 방금 굴린 주사위. 다른 걸 쓰거나 탭을 옮기면 지운다.
  const [diceResult, setDiceResult] = useState<number | null>(null);
  // 열려 있는 상세 시트. 상점에서 열었는지 가방에서 열었는지에 따라 행동 버튼이 다르다.
  const [sheet, setSheet] = useState<{ entry: ShopEntry; mode: Pane } | null>(null);

  const onBagUsed = (coins: number) => {
    setDiceResult(coins > 0 ? coins : null);
    setSheet(null);
    refresh();
  };

  // 며칠에 걸친 쿠폰(타임캡슐·복리)은 지나간 날을 여기서도 한 번 정산한다.
  useEffect(() => {
    void settleDailyCoupons().then(refresh);
  }, [refresh]);

  const bag = useMemo(
    () =>
      Object.entries(inv.items)
        .filter(([, count]) => count > 0)
        .map(([id, count]) => ({ entry: shopById(id), count }))
        .filter((row): row is { entry: ShopEntry; count: number } => !!row.entry),
    [inv.items]
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            {pane === 'shop' ? 'Shop' : 'Bag'}
          </Text>
          <Text style={styles.subtitle}>
            {pane === 'shop'
              ? secretOpen
                ? 'The black market is open. Today only.'
                : 'Spend what your focus earned.'
              : 'What you are carrying.'}
          </Text>
        </View>
        <View style={styles.wallet}>
          <Coins size={17} color={SEMANTIC.coin.fg} strokeWidth={2} />
          <Text style={styles.walletText}>{inv.coins.toLocaleString()}</Text>
        </View>
      </View>

      <PaneSwitch
        pane={pane}
        onChange={(next) => {
          setDiceResult(null);
          setPane(next);
        }}
      />

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {/* ⚠️ 임시 */}
        <TestBench elo={inv.elo} arenaName={arenaById(inv.arenaId).name} onChange={refresh} />

        {pane === 'shop'
          ? // 상점도 가방처럼 쓰는 방식으로 묶는다 — 아홉 가지가 한눈에 갈린다.
            ITEM_GROUPS.map((group) => {
              const entries = shopShelf(secretOpen).filter((e) => itemGroupOf(e) === group.key);
              if (!entries.length) return null;
              return (
                <View key={group.key} style={styles.section}>
                  <Text style={styles.sectionTitle}>{group.title}</Text>
                  <Text style={styles.sectionHint}>{group.hint}</Text>
                  {entries.map((entry) => (
                    <ItemRow
                      key={entry.id}
                      entry={entry}
                      onOpen={() => setSheet({ entry, mode: 'shop' })}
                      right={
                        <BuyRight
                          entry={entry}
                          price={priceOf(entry, secretOpen)}
                          owned={countOf(inv, entry.id)}
                          coins={inv.coins}
                          onBuy={() => buy(entry.id, priceOf(entry, secretOpen), entry.unique)}
                        />
                      }
                    />
                  ))}
                </View>
              );
            })
          : bag.length === 0 && !inv.capsule && !inv.compound
            ? (
              <Card level={0} tone="alt" boxStyle={styles.empty}>
                <Text style={styles.emptyTitle}>Your bag is empty</Text>
                <Text style={styles.emptyBody}>
                  Roll a book for a coupon, or buy one in the shop. Everything you own shows up here.
                </Text>
              </Card>
            )
            : [
                diceResult !== null ? (
                  <Card key="dice" level={0} tone="accent" boxStyle={styles.active}>
                    <Text style={styles.activeTitle}>The dice say +{diceResult} coins</Text>
                  </Card>
                ) : null,
                <ActiveEffects key="active" inv={inv} today={today} />,
                ...ITEM_GROUPS.map((group) => {
                  const rows = bag.filter(({ entry }) => itemGroupOf(entry) === group.key);
                  if (!rows.length) return null;
                  return (
                    <View key={group.key} style={styles.section}>
                      <Text style={styles.sectionTitle}>{group.title}</Text>
                      <Text style={styles.sectionHint}>{group.hint}</Text>
                      {rows.map(({ entry, count }) => (
                        <ItemRow
                          key={entry.id}
                          entry={entry}
                          onOpen={() => setSheet({ entry, mode: 'bag' })}
                          right={
                            <View style={styles.buyBox}>
                              <View style={styles.countTag}>
                                <Text style={styles.countText}>
                                  {entry.unique ? 'Owned' : `x${count}`}
                                </Text>
                              </View>
                              <BagAction inv={inv} entry={entry} onUsed={onBagUsed} />
                            </View>
                          }
                        />
                      ))}
                    </View>
                  );
                })]}
      </ScrollView>

      <ItemSheet
        entry={sheet?.entry ?? null}
        owned={sheet ? countOf(inv, sheet.entry.id) : 0}
        onClose={() => setSheet(null)}
        action={
          !sheet ? null : sheet.mode === 'shop' ? (
            <BuyRight
              entry={sheet.entry}
              price={priceOf(sheet.entry, secretOpen)}
              owned={countOf(inv, sheet.entry.id)}
              coins={inv.coins}
              onBuy={() =>
                void buy(sheet.entry.id, priceOf(sheet.entry, secretOpen), sheet.entry.unique)
              }
            />
          ) : (
            <View style={styles.buyBox}>
              {sheet.entry.coupon &&
              (itemGroupOf(sheet.entry) === 'use' || itemGroupOf(sheet.entry) === 'instant') &&
              bagUseBlocked(inv, sheet.entry.coupon.id) ? (
                <Text style={styles.bagNote}>{bagUseBlocked(inv, sheet.entry.coupon.id)}</Text>
              ) : null}
              <BagAction inv={inv} entry={sheet.entry} onUsed={onBagUsed} />
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', backgroundColor: T.bg, paddingHorizontal: 16, paddingTop: 8 },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1 },
  title: { fontFamily: T.fontDisplay, fontSize: 31, color: T.ink, letterSpacing: -0.4 },
  subtitle: { fontFamily: T.font, fontSize: 16, color: T.muted, marginTop: 4 },
  wallet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    backgroundColor: SEMANTIC.coin.bg,
  },
  walletText: { fontFamily: T.fontBold, fontSize: 16, color: SEMANTIC.coin.fg },

  segmented: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 16,
    padding: 4,
    borderRadius: RADIUS.md,
    backgroundColor: T.bgSunk,
  },
  segment: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm },
  segmentSelected: { backgroundColor: T.card },
  segmentLabel: { fontFamily: T.fontMedium, fontSize: 16, color: T.muted },
  segmentLabelSelected: { color: T.ink },

  list: { paddingTop: 16, paddingBottom: 28, gap: 10 },
  section: { gap: 10 },
  sectionTitle: { fontFamily: T.fontMedium, fontSize: 18, color: T.ink, marginTop: 6 },
  sectionHint: { fontFamily: T.font, fontSize: 14, color: T.muted, marginTop: -6, marginBottom: 2 },

  row: { padding: 16, gap: 8 },
  // 한 줄 — 아이콘 · 이름 · 짧은 요약 · 오른쪽 행동
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12 },
  itemTap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemCopy: { flex: 1, minWidth: 0 },
  itemShort: { fontFamily: T.font, fontSize: 13, color: T.muted, marginTop: 2 },
  icon: { alignItems: 'center', justifyContent: 'center', backgroundColor: T.bgSunk },

  // 상세 바텀 시트
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(34,38,28,0.4)' },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    gap: 14,
  },
  sheetGrip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: T.border },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sheetTitleBox: { flex: 1 },
  sheetTitle: { fontFamily: T.fontDisplay, fontSize: 22, color: T.ink },
  sheetGroup: {
    fontFamily: T.fontMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: T.muted,
    marginTop: 3,
  },
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
  sheetFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sheetOwned: { fontFamily: T.fontMedium, fontSize: 14, color: T.muted },
  buyBox: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowName: { flex: 1, fontFamily: T.fontMedium, fontSize: 17, color: T.ink },
  rowBlurb: { fontFamily: T.font, fontSize: 14, lineHeight: 21, color: T.muted },
  rowFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  ownedCount: { fontFamily: T.fontMedium, fontSize: 14, color: T.accentDeep },

  price: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  priceText: { fontFamily: T.fontBold, fontSize: 16, color: SEMANTIC.coin.fg },

  ownedTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ownedText: { fontFamily: T.fontMedium, fontSize: 14, color: T.accentDeep },
  countTag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: RADIUS.full, backgroundColor: T.bgSunk },
  countText: { fontFamily: T.fontMedium, fontSize: 13, color: T.inkSoft },

  // ⚠️ 임시 — 테스트 판 스타일
  bench: { padding: 14, gap: 8, borderStyle: 'dashed', borderWidth: 1, borderColor: T.borderStrong },
  benchTitle: {
    fontFamily: T.fontMedium,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: T.danger,
  },
  benchHint: { fontFamily: T.font, fontSize: 13, lineHeight: 19, color: T.muted },
  benchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  bagNote: { fontFamily: T.font, fontSize: 13, color: T.muted },
  active: { padding: 16, gap: 10 },
  activeTitle: { fontFamily: T.fontMedium, fontSize: 16, color: T.accentDeep },
  activeBody: { fontFamily: T.font, fontSize: 14, lineHeight: 20, color: T.accentDeep, opacity: 0.85 },

  empty: { padding: 20 },
  emptyTitle: { fontFamily: T.fontMedium, fontSize: 17, color: T.ink },
  emptyBody: { fontFamily: T.font, fontSize: 15, lineHeight: 22, color: T.muted, marginTop: 6 },
});
