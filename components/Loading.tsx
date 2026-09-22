import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { T } from '@/components/nova';

/** 글꼴이 준비되기 전에도 뜨는 화면 — T.font* 를 쓰면 안 된다. */
export default function Loading() {
  return (
    <View style={styles.screen}>
      <ActivityIndicator size="large" color={T.primary} />
      <Text style={styles.label}>Loading…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: T.bg },
  label: { fontSize: 14, letterSpacing: 0.4, color: T.muted, fontWeight: '500' },
});
