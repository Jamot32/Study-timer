import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { Card, RADIUS, SEMANTIC, T } from './nova';
import { type Profile } from '../lib/profile';
import { useInventory } from '../lib/inventory';
import { Avatar } from './Avatar';
import { AvatarMark } from './AvatarMark';

// 순위는 ELO 로 매긴다 — 배틀 화면의 트로피 숫자와 같은 값, 같은 아이콘, 같은 색.
// 상대들은 아직 서버가 없어 고정값이다.
const RIVALS = [
  { name: 'Nova Mint', elo: 1520, avatar: '🦊' },
  { name: 'Page Witch', elo: 1340, avatar: '🐈' },
  { name: 'Desk Goblin', elo: 1180, avatar: '🐸' },
  { name: 'Late Owl', elo: 960, avatar: '🦇' },
];

/** 이름은 App 이 들고 있는 프로필에서 — 배틀 화면과 같은 이름이 나온다. */
export default function RankBoard({ profile }: { profile?: Profile }) {
  const { inv } = useInventory();
  const myName = profile?.name?.trim() || 'Guest';

  const rows = [
    ...RIVALS,
    { name: myName, elo: inv.elo, avatar: profile?.avatar || '🦉', me: true },
  ].sort((a, b) => b.elo - a.elo);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heading}>
        <Text style={styles.title}>Season rank</Text>
        <Text style={styles.subtitle}>Ranked by ELO from your battles.</Text>
      </View>

      {rows.map((row, index) => {
        const me = 'me' in row;
        return (
          <Card
            key={row.name + (me ? '-me' : '')}
            level={me ? 2 : 1}
            // 내 줄은 '고른 상태'라 앰버가 아니라 옅은 올리브.
            tone={me ? 'accent' : 'card'}
            radius={RADIUS.lg}
            style={styles.rowFrame}
            boxStyle={styles.row}
          >
            <View style={styles.place}>
              <Text style={styles.placeText}>{index + 1}</Text>
            </View>
            {me ? (
              <Avatar profile={profile} size={40} shadow={0} background={T.bgSunk} />
            ) : (
              <AvatarMark avatar={row.avatar} size={36} />
            )}
            <Text style={[styles.name, me && styles.nameMe]} numberOfLines={1}>
              {row.name}
            </Text>
            <View style={styles.elo}>
              <Trophy size={14} color={SEMANTIC.elo.fg} strokeWidth={2.2} />
              <Text style={styles.eloText}>{row.elo.toLocaleString()}</Text>
              <Text style={styles.eloUnit}>ELO</Text>
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  content: { padding: 16, gap: 10, paddingBottom: 28 },
  heading: { gap: 4, marginBottom: 6, paddingHorizontal: 2 },
  title: { fontFamily: T.fontDisplay, color: T.ink, fontSize: 29, letterSpacing: -0.3 },
  subtitle: { fontFamily: T.font, color: T.muted, fontSize: 16 },
  rowFrame: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  place: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.bgSunk,
  },
  placeText: { fontFamily: T.fontMedium, color: T.muted, fontSize: 14 },
  name: { flex: 1, fontFamily: T.fontMedium, color: T.ink, fontSize: 17 },
  nameMe: { fontFamily: T.fontBold, color: SEMANTIC.selected.fg },
  elo: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  eloText: { fontFamily: T.fontMedium, color: SEMANTIC.elo.fg, fontSize: 16 },
  eloUnit: { fontFamily: T.font, color: T.muted, fontSize: 12 },
});
