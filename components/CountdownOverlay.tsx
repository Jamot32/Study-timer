import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ABS_FILL, T } from './nova';

/** 매치 시작 카운트다운. 뒤에 깔린 타이머 화면이 비치도록 반투명이다. */
export default function CountdownOverlay({ value }: { value: number }) {
  return (
    <View style={styles.overlay} pointerEvents="none">
      <Text style={styles.caption}>Match starting</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...ABS_FILL,
    backgroundColor: 'rgba(250,248,242,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    fontFamily: T.fontMedium,
    color: T.muted,
    fontSize: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  value: { fontFamily: T.fontDisplay, color: T.primary, fontSize: 96, letterSpacing: -2 },
});
