import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ABS_FILL, T } from './pixel';

/** 매치 시작 카운트다운. 뒤에 깔린 타이머 화면이 비치도록 반투명이다. */
export default function CountdownOverlay({ value }: { value: number }) {
  return (
    <View style={styles.overlay} pointerEvents="none">
      <Text style={styles.caption}>MATCH STARTING</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...ABS_FILL, backgroundColor: 'rgba(244,240,230,0.78)', alignItems: 'center', justifyContent: 'center' },
  caption: { fontFamily: T.fontPixel, color: T.ink, fontSize: 9, marginBottom: 20 },
  value: { fontFamily: T.fontPixel, color: T.primary, fontSize: 72, textShadowColor: T.ink, textShadowOffset: { width: 5, height: 5 }, textShadowRadius: 0 },
});
