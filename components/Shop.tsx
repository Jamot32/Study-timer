import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, Coins } from 'lucide-react-native';
import { Button, Card, RADIUS, T, Tap } from '@/components/nova';
import { applyLedger, countOf, debugSet, useInventory } from '@/lib/inventory';
import { ARENAS, arenaById, STARTING_ELO } from '@/lib/arena';
import { DEFAULT_INVENTORY } from '@/lib/inventory';
import { SHOP, SHOP_SECTIONS, shopById, type ShopEntry } from '@/lib/shop';

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
      <Coins size={15} color={T.primaryDeep} strokeWidth={2} />
      <Text style={styles.priceText}>{price.toLocaleString()}</Text>
    </View>
  );
}

function ShopRow({
  entry,
  owned,
  coins,
  onBuy,
}: {
  entry: ShopEntry;
  owned: number;
  coins: number;
  onBuy: () => void;
}) {
  const soldOut = entry.unique && owned > 0;
  const tooPoor = coins < entry.price;

  return (
    <Card level={1} boxStyle={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.rowName} numberOfLines={1}>
          {entry.name}
        </Text>
        {soldOut ? (
          <View style={styles.ownedTag}>
            <Check size={14} color={T.accentDeep} strokeWidth={2.5} />
            <Text style={styles.ownedText}>Owned</Text>
          </View>
        ) : (
          <PriceTag price={entry.price} />
        )}
      </View>

      <Text style={styles.rowBlurb}>{entry.blurb}</Text>

      <View style={styles.rowFoot}>
        {!entry.unique && owned > 0 ? (
          <Text style={styles.ownedCount}>You hold {owned}</Text>
        ) : (
          <View />
        )}
        <Button
          size="sm"
          variant={soldOut || tooPoor ? 'outline' : 'primary'}
          disabled={soldOut || tooPoor}
          onPress={onBuy}
          accessibilityLabel={`Buy ${entry.name} for ${entry.price} coins`}
        >
          {soldOut ? 'Owned' : tooPoor ? 'Not enough' : 'Buy'}
        </Button>
      </View>
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

export default function Shop() {
  const [pane, setPane] = useState<Pane>('shop');
  const { inv, buy, refresh } = useInventory();

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
            {pane === 'shop' ? 'Spend what your focus earned.' : 'What you are carrying.'}
          </Text>
        </View>
        <View style={styles.wallet}>
          <Coins size={17} color={T.primaryDeep} strokeWidth={2} />
          <Text style={styles.walletText}>{inv.coins.toLocaleString()}</Text>
        </View>
      </View>

      <PaneSwitch pane={pane} onChange={setPane} />

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {/* ⚠️ 임시 */}
        <TestBench elo={inv.elo} arenaName={arenaById(inv.arenaId).name} onChange={refresh} />

        {pane === 'shop'
          ? SHOP_SECTIONS.map((section) => {
              const entries = SHOP.filter((e) => e.kind === section.kind);
              if (!entries.length) return null;
              return (
                <View key={section.kind} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionHint}>{section.hint}</Text>
                  {entries.map((entry) => (
                    <ShopRow
                      key={entry.id}
                      entry={entry}
                      owned={countOf(inv, entry.id)}
                      coins={inv.coins}
                      onBuy={() => buy(entry.id, entry.price, entry.unique)}
                    />
                  ))}
                </View>
              );
            })
          : bag.length === 0
            ? (
              <Card level={0} tone="alt" boxStyle={styles.empty}>
                <Text style={styles.emptyTitle}>Your bag is empty</Text>
                <Text style={styles.emptyBody}>
                  Roll a book for a coupon, or buy one in the shop. Everything you own shows up here.
                </Text>
              </Card>
            )
            : bag.map(({ entry, count }) => (
                <Card key={entry.id} level={1} boxStyle={styles.row}>
                  <View style={styles.rowHead}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {entry.name}
                    </Text>
                    <View style={styles.countTag}>
                      <Text style={styles.countText}>{entry.unique ? 'Owned' : `x${count}`}</Text>
                    </View>
                  </View>
                  <Text style={styles.rowBlurb}>{entry.blurb}</Text>
                </Card>
              ))}
      </ScrollView>
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
    backgroundColor: T.primarySoft,
  },
  walletText: { fontFamily: T.fontBold, fontSize: 16, color: T.primaryDeep },

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
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowName: { flex: 1, fontFamily: T.fontMedium, fontSize: 17, color: T.ink },
  rowBlurb: { fontFamily: T.font, fontSize: 14, lineHeight: 21, color: T.muted },
  rowFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  ownedCount: { fontFamily: T.fontMedium, fontSize: 14, color: T.accentDeep },

  price: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  priceText: { fontFamily: T.fontBold, fontSize: 16, color: T.primaryDeep },

  ownedTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ownedText: { fontFamily: T.fontMedium, fontSize: 14, color: T.accentDeep },
  countTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: T.accentSoft },
  countText: { fontFamily: T.fontMedium, fontSize: 14, color: T.accentDeep },

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

  empty: { padding: 20 },
  emptyTitle: { fontFamily: T.fontMedium, fontSize: 17, color: T.ink },
  emptyBody: { fontFamily: T.font, fontSize: 15, lineHeight: 22, color: T.muted, marginTop: 6 },
});
