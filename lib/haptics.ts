import * as Haptics from 'expo-haptics';

// Native: thin pass-through so callers never import expo-haptics directly.
// lib/haptics.web.ts replaces this file in the web bundle with no-ops.

/** A crisp "it worked" buzz (coupon drawn). */
export function success(): Promise<void> {
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** One light tap (rest time drawn). */
export function lightTap(): Promise<void> {
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
