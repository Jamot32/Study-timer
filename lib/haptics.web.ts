// Web: no haptics. Browsers either lack vibration (iOS Safari) or only offer a
// coarse navigator.vibrate buzz that feels nothing like the native feedback, so
// these stay silent and expo-haptics is kept out of the web bundle.

export function success(): Promise<void> {
  return Promise.resolve();
}

export function lightTap(): Promise<void> {
  return Promise.resolve();
}
