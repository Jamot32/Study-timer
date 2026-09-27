import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BarChart3, BookOpen, Store, Swords, Trophy, type LucideIcon } from 'lucide-react-native';
import { Card, RADIUS, T, Tap } from './nova';

/** 모든 화면이 함께 쓰는 하단 탭. */
export type AppTab = 'roll' | 'stats' | 'battle' | 'rank' | 'shop';

export const APP_TABS: { key: AppTab; label: string; Icon: LucideIcon }[] = [
  { key: 'roll', label: 'Roll', Icon: BookOpen },
  { key: 'stats', label: 'Stats', Icon: BarChart3 },
  { key: 'battle', label: 'Battle', Icon: Swords },
  { key: 'rank', label: 'Rank', Icon: Trophy },
  { key: 'shop', label: 'Shop', Icon: Store },
];

export default function BottomTabs({
  activeTab,
  onSelect,
  locked = false,
}: {
  activeTab: AppTab;
  onSelect: (tab: AppTab) => void;
  /** 매치가 걸린 동안은 탭을 잠근다. 배틀 도중에 다른 화면으로 못 빠져나가게. */
  locked?: boolean;
}) {
  return (
    <Card level={3} radius={RADIUS.xl} style={styles.frame} boxStyle={styles.bar}>
      {APP_TABS.map(({ key, label, Icon }) => {
        const selected = key === activeTab;
        return (
          <Tap
            key={key}
            onPress={() => onSelect(key)}
            disabled={locked}
            style={[styles.slot, locked && !selected ? styles.slotLocked : null]}
            pressedStyle={styles.slotPressed}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected, disabled: locked }}
          >
            {/* 고른 탭만 옅은 앰버 알약. 알약은 늘 자리를 차지해 전환해도 아이콘이 안 밀린다. */}
            <View style={[styles.pill, selected && styles.pillActive]}>
              <Icon
                size={21}
                color={selected ? T.primaryDeep : T.muted}
                strokeWidth={selected ? 2.4 : 1.9}
              />
            </View>
            <Text numberOfLines={1} style={[styles.label, selected && styles.labelActive]}>
              {label}
            </Text>
          </Tap>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  // 폭은 부모(App 의 tabBar)가 잡고, 여기서는 마진만 준다.
  frame: { alignSelf: 'stretch', marginHorizontal: 16, marginBottom: 10 },
  bar: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    // ROLL 은 왼쪽 끝, SETTINGS 는 오른쪽 끝에 붙이고 남는 폭을 사이에 고르게 나눈다.
    // 칸을 flex 로 늘리면 양 끝에도 빈 폭이 절반씩 생겨 가장자리가 비어 보인다.
    justifyContent: 'space-between',
    // 둥근 모서리에 글자가 닿지 않을 만큼만.
    paddingHorizontal: 12,
  },
  // 칸은 내용에 맞춘 고정 폭. 라벨 길이가 폭에 영향을 주지 않는다.
  slot: { width: 64, alignItems: 'center', justifyContent: 'center', gap: 5 },
  slotPressed: { opacity: 0.55 },
  slotLocked: { opacity: 0.3 },
  pill: {
    width: 50,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  pillActive: { backgroundColor: T.primarySoft },
  label: {
    // 글꼴 두께는 고르든 말든 그대로 둔다. Bold 로 바꾸면 글자 폭이 늘어
    // 라벨 가장자리가 밀리고 탭 사이 간격이 들쭉날쭉해 보인다. 색만 바꾼다.
    fontFamily: T.fontMedium,
    fontSize: 13,
    letterSpacing: 0.1,
    color: T.muted,
    includeFontPadding: false,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  labelActive: { color: T.primaryDeep },
});
