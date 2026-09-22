import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BarChart3, BookOpen, Settings as SettingsIcon, Swords, Trophy, type LucideIcon } from 'lucide-react-native';
import { PixelBox, T } from './pixel';

/** 모든 화면이 함께 쓰는 하단 탭. 배틀 로비에 있던 바를 그대로 끌어올린 것. */
export type AppTab = 'roll' | 'stats' | 'battle' | 'rank' | 'settings';

export const APP_TABS: { key: AppTab; label: string; Icon: LucideIcon }[] = [
  { key: 'roll', label: 'ROLL', Icon: BookOpen },
  { key: 'stats', label: 'STAT', Icon: BarChart3 },
  { key: 'battle', label: 'BATTLE', Icon: Swords },
  { key: 'rank', label: 'RANK', Icon: Trophy },
  { key: 'settings', label: 'SETTING', Icon: SettingsIcon },
];

/** 박스 안에서 글자 좌우로 남기는 여백. */
const LABEL_PAD = 8;

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
  // 가장 긴 라벨(SETTING)의 실제 폭을 재서 모든 박스에 같은 폭으로 물린다.
  // 글자 길이대로 두면 탭마다 박스가 들쭉날쭉해진다.
  const [labelWidth, setLabelWidth] = useState(0);
  const boxWidth = labelWidth > 0 ? Math.ceil(labelWidth) + LABEL_PAD * 2 : undefined;

  return (
    <PixelBox shadow={4} style={styles.tabsFrame} boxStyle={styles.bottomTabs}>
      {APP_TABS.map(({ key, label, Icon }) => {
        const selected = key === activeTab;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            disabled={locked}
            style={({ pressed }) => [
              styles.bottomTab,
              locked && !selected && styles.bottomTabLocked,
              pressed && styles.bottomTabPressed,
            ]}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected, disabled: locked }}
          >
            <View style={[styles.tabBox, boxWidth !== undefined && { width: boxWidth }, selected && styles.tabBoxActive]}>
              <Icon size={20} color={selected ? T.primaryFg : T.muted} strokeWidth={selected ? 3 : 2} />
              <Text
                numberOfLines={1}
                onLayout={(event) => {
                  const { width } = event.nativeEvent.layout;
                  setLabelWidth((current) => (width > current ? width : current));
                }}
                style={[styles.bottomLabel, selected && styles.bottomLabelActive]}
              >
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </PixelBox>
  );
}

const styles = StyleSheet.create({
  // width:'100%' 와 좌우 마진을 함께 주면 바가 화면보다 32px 넓어져 전체 레이아웃이 오른쪽으로 밀린다.
  // 폭은 부모(App 의 tabBar)가 잡고, 여기서는 마진만 준다.
  tabsFrame: { alignSelf: 'stretch', marginHorizontal: 16, marginBottom: 8 },
  bottomTabs: { height: 72, backgroundColor: T.bg, borderColor: T.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 5 },
  // 아이콘과 라벨을 같은 세로축에 세운다. 칸은 flexBasis 0 으로 다섯 개가 정확히 같은 폭.
  // 좌우 패딩을 주면 그만큼 안쪽 박스가 좁아져 글자가 한쪽으로 밀리므로 패딩은 두지 않는다.
  bottomTab: { flex: 1, flexBasis: 0, minWidth: 0, height: 58, alignItems: 'stretch', justifyContent: 'center' },
  bottomTabPressed: { opacity: 0.6 },
  bottomTabLocked: { opacity: 0.35 },
  // 아이콘과 글자를 함께 담는 박스. 고르면 주황으로 채우고 잉크 테두리를 두른다.
  // 테두리는 평소에도 그려 두고 색만 바꾼다 — 고를 때 안쪽이 밀리지 않게.
  // 폭은 렌더 중에 잰 가장 긴 라벨 + 좌우 여백으로 못 박는다(위 boxWidth). 탭마다 같은 폭.
  tabBox: { alignSelf: 'center', height: 52, alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 2, borderColor: 'transparent' },
  tabBoxActive: { backgroundColor: T.primary, borderColor: T.ink },
  // 아이콘/라벨 각각을 칸 폭 전체를 쓰는 줄에 담고 그 안에서 가운데로 모은다.
  // (width: '100%' 를 Text 에 직접 주면 부모 패딩만큼 오른쪽으로 밀렸다.)
  iconSlot: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  // 아이콘만 감싸는 박스. 고르면 주황으로 채우고 잉크 테두리를 두른다.
  // 테두리는 항상 그려 두고 색만 바꾼다 — 고를 때 아이콘이 밀리지 않게.
  iconBox: { width: 32, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  iconBoxActive: { backgroundColor: T.primary, borderColor: T.ink },
  labelSlot: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  bottomLabel: { fontFamily: T.fontPixel, color: T.muted, fontSize: 6, textAlign: 'center', includeFontPadding: false },
  bottomLabelActive: { color: T.primaryFg },
});
