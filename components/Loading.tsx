import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { T } from '@/components/pixel';

/** Shown before the pixel font is ready — must not use T.fontPixel. */
export default function Loading() {
  return (
    <View style={styles.screen}>
      <ActivityIndicator size="large" color={T.primary} />
      <Text style={styles.label}>LOADING…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: T.bg },
  label: { fontSize: 12, letterSpacing: 2, color: T.muted, fontWeight: '700' },
});
