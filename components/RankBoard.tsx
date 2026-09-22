import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Crown, Trophy } from 'lucide-react-native';
import { PixelBox, T } from './pixel';
import { loadProfile, type Profile } from '../lib/auth';

const RIVALS = [
  { name: 'NOVA_MINT', trophies: 2480, avatar: '🦊' },
  { name: 'PAGE_WITCH', trophies: 2301, avatar: '🐈' },
  { name: 'DESK_GOBLIN', trophies: 2044, avatar: '🐸' },
  { name: 'LATE_OWL', trophies: 1876, avatar: '🦇' },
];

export default function RankBoard() {
  const [profile, setProfile] = useState<Profile>({ name: 'FOCUS KNIGHT', avatar: '🦉' });

  useEffect(() => {
    loadProfile().then((saved) => {
      if (saved) setProfile(saved);
    });
  }, []);

  const rows = [...RIVALS, { name: profile.name || 'FOCUS KNIGHT', trophies: 2137, avatar: profile.avatar || '🦉', me: true }]
    .sort((a, b) => b.trophies - a.trophies);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heading}>
        <Crown size={20} color={T.primary} strokeWidth={2.5} />
        <Text style={styles.title}>SEASON RANK</Text>
      </View>
      {rows.map((row, index) => (
        <PixelBox key={row.name} shadow={4} style={styles.rowFrame} boxStyle={[styles.row, 'me' in row && styles.rowMe]}>
          <Text style={styles.place}>{index + 1}</Text>
          <Text style={styles.avatar}>{row.avatar}</Text>
          <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
          <View style={styles.trophy}>
            <Trophy size={13} color={T.primary} />
            <Text style={styles.trophyText}>{row.trophies}</Text>
          </View>
        </PixelBox>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  content: { padding: 16, gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { fontFamily: T.fontPixel, color: T.ink, fontSize: 11 },
  rowFrame: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: T.bg, borderColor: T.ink },
  rowMe: { backgroundColor: T.secondary },
  place: { fontFamily: T.fontPixel, color: T.muted, fontSize: 9, width: 20 },
  avatar: { fontSize: 22 },
  name: { flex: 1, fontFamily: T.fontPixel, color: T.ink, fontSize: 8 },
  trophy: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trophyText: { fontFamily: T.fontPixel, color: T.primary, fontSize: 8 },
});
