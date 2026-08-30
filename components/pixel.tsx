import React, { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

// Pixel design tokens + primitives, copied verbatim from the timer screen
// (components/StudyTimer.tsx on feat/procedural-sky) so both screens match.
export const T = {
  bg: '#f4f0e6',
  ink: '#2e2218',
  primary: '#d95b2e',
  primaryFg: '#faf6ee',
  secondary: '#e3dcc9',
  muted: '#6e6152',
  fontPixel: 'PressStart2P_400Regular',
};

export const ABS_FILL = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
} as const;

type PixelBoxProps = {
  shadow?: number;
  style?: StyleProp<ViewStyle>;
  boxStyle?: StyleProp<ViewStyle>;
  shadowStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function PixelBox({ shadow = 4, style, boxStyle, shadowStyle, children }: PixelBoxProps) {
  return (
    <View style={[{ paddingRight: shadow, paddingBottom: shadow }, style]}>
      {shadow > 0 && (
        <View
          pointerEvents="none"
          style={[ABS_FILL, { backgroundColor: T.ink, left: shadow, top: shadow }, shadowStyle]}
        />
      )}
      <View style={[styles.pixelBorder, boxStyle]}>{children}</View>
    </View>
  );
}

type PixelButtonProps = {
  onPress?: () => void;
  disabled?: boolean;
  shadow?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  boxStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  children?: React.ReactNode;
};

export function PixelButton({
  onPress,
  disabled,
  shadow = 4,
  color = T.primary,
  style,
  boxStyle,
  accessibilityLabel,
  accessibilityState,
  children,
}: PixelButtonProps) {
  const [pressed, setPressed] = useState(false);
  const shift = pressed && !disabled ? shadow : 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      style={[{ paddingRight: shadow, paddingBottom: shadow, opacity: disabled ? 0.4 : 1 }, style]}
    >
      {shadow > 0 && (
        <View
          pointerEvents="none"
          style={[ABS_FILL, { backgroundColor: T.ink, left: shadow, top: shadow }]}
        />
      )}
      <View
        style={[
          styles.pixelBorder,
          { backgroundColor: color, transform: [{ translateX: shift }, { translateY: shift }] },
          boxStyle,
        ]}
      >
        {children}
      </View>
    </Pressable>
  );
}

export function PixelProgress({ value }: { value: number }) {
  const stepped = Math.floor(value * 60) / 60;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={styles.progressTrack}
    >
      <View style={[styles.progressFill, { width: `${stepped * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  pixelBorder: {
    borderWidth: 4,
    borderColor: T.ink,
    backgroundColor: T.bg,
  },
  progressTrack: {
    height: 12,
    borderWidth: 2,
    borderColor: T.ink,
    backgroundColor: T.secondary,
  },
  progressFill: { height: '100%', backgroundColor: T.primary },
});
