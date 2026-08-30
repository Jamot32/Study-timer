import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PixelBox, PixelButton, T } from '@/components/pixel';
import { saveProfile, type Profile } from '@/lib/auth';

export default function Login({ onLoggedIn }: { onLoggedIn: (profile: Profile) => void }) {
  const [name, setName] = useState('');
  const trimmed = name.trim();

  const submit = async () => {
    if (!trimmed) return;
    onLoggedIn(await saveProfile(trimmed));
  };

  return (
    <View style={styles.screen}>
      <PixelBox shadow={6} style={styles.card} boxStyle={styles.cardBox}>
        <Text style={styles.title}>STUDY{'\n'}TIMER</Text>
        <Text style={styles.label}>WHO'S STUDYING?</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          onSubmitEditing={submit}
          placeholder="NAME"
          placeholderTextColor={T.muted}
          autoFocus
          maxLength={20}
          returnKeyType="go"
          accessibilityLabel="Your name"
          style={styles.input}
        />
        <PixelButton disabled={!trimmed} onPress={submit} style={styles.cta} boxStyle={styles.ctaBox}>
          <Text style={styles.ctaLabel}>START</Text>
        </PixelButton>
        {/* PRD P0-1 is guest-first: never wall the timer behind an account. */}
        <PixelButton
          shadow={2}
          color={T.bg}
          onPress={async () => onLoggedIn(await saveProfile('Guest'))}
          style={styles.cta}
          boxStyle={styles.guestBox}
        >
          <Text style={styles.guestLabel}>CONTINUE AS GUEST</Text>
        </PixelButton>
      </PixelBox>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360 },
  cardBox: { padding: 20, gap: 16 },
  title: {
    fontFamily: T.fontPixel,
    fontSize: 20,
    lineHeight: 30,
    color: T.ink,
    textAlign: 'center',
  },
  label: { fontFamily: T.fontPixel, fontSize: 9, color: T.muted, textAlign: 'center' },
  input: {
    fontFamily: T.fontPixel,
    fontSize: 11,
    color: T.ink,
    borderWidth: 4,
    borderColor: T.ink,
    backgroundColor: T.secondary,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  cta: { alignSelf: 'center' },
  ctaBox: { paddingHorizontal: 24, paddingVertical: 12 },
  ctaLabel: { fontFamily: T.fontPixel, fontSize: 12, color: T.primaryFg },
  guestBox: { paddingHorizontal: 16, paddingVertical: 10 },
  guestLabel: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted },
});
