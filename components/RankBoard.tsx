import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { Card, RADIUS, T } from './nova';
import { loadProfile, type Profile } from '../lib/profile';

const RIVALS = [
  { name: 'Nova Mint', trophies: 2480, avatar: '🦊' },
  { name: 'Page Witch', trophies: 2301, avatar: '🐈' },
  { name: 'Desk Goblin', trophies: 2044, avatar: '🐸' },
  { name: 'Late Owl', trophies: 1876, avatar: '🦇' },
];

export default function RankBoard() {
  const [profile, setProfile] = useState<Profile>({ name: 'Focus Knight', avatar: '🦉' });

  useEffect(() => {
    loadProfile().then((saved) => {
      if (saved) setProfile(saved);
    });
  }, []);

  const rows = [
    ...RIVALS,
    { name: profile.name || 'Focus Knight', trophies: 2137, avatar: profile.avatar || '🦉', me: true },
  ].sort((a, b) => b.trophies - a.trophies);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heading}>
        <Text style={styles.title}>Season rank</Text>
        <Text style={styles.subtitle}>Quiet hours add up. Yours are counted here.</Text>
      </View>

      {rows.map((row, index) => {
        const me = 'me' in row;
        const podium = index < 3;
        return (
          <Card
            key={row.name}
            level={me ? 2 : 1}
            tone={me ? 'primary' : 'card'}
            radius={RADIUS.lg}
            style={styles.rowFrame}
            boxStyle={styles.row}
          >
            <View style={[styles.place, podium && styles.placePodium]}>
              <Text style={[styles.placeText, podium && styles.placeTextPodium]}>{index + 1}</Text>
            </View>
            <Text style={styles.avatar}>{row.avatar}</Text>
            <Text style={[styles.name, me && styles.nameMe]} numberOfLines={1}>
              {row.name}
            </Text>
            <View style={styles.trophy}>
              <Trophy size={14} color={T.primary} strokeWidth={2} />
              <Text style={styles.trophyText}>{row.trophies.toLocaleString()}</Text>
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
  title: { fontFamily: T.fontDisplay, color: T.ink, fontSize: 26, letterSpacing: -0.3 },
  subtitle: { fontFamily: T.font, color: T.muted, fontSize: 14 },
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
  placePodium: { backgroundColor: T.accentSoft },
  placeText: { fontFamily: T.fontMedium, color: T.muted, fontSize: 12 },
  placeTextPodium: { color: T.accentDeep },
  avatar: { fontSize: 24 },
  name: { flex: 1, fontFamily: T.fontMedium, color: T.ink, fontSize: 15 },
  nameMe: { fontFamily: T.fontBold, color: T.primaryDeep },
  trophy: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trophyText: { fontFamily: T.fontMedium, color: T.primaryDeep, fontSize: 14 },
});
