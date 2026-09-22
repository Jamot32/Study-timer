import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PixelBox, PixelButton, T } from '@/components/pixel';
import { AuthError, googleSheetAuth, type AuthSession } from '@/lib/auth';
import { saveProfile, type Profile } from '@/lib/profile';

type LoginProps = {
  onLoggedIn: (profile: Profile, session: AuthSession | null) => void;
};

export default function Login({ onLoggedIn }: LoginProps) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setError(null);
    try {
      const session = await googleSheetAuth.signInWithGoogle();
      if (!session) return;
      const profile = await saveProfile({
        name: session.user.displayName,
        avatar: session.user.avatar,
      });
      onLoggedIn(profile, session);
    } catch (cause) {
      setError(
        cause instanceof AuthError ? cause.message : 'Google login failed. Please try again.'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const continueAsGuest = async () => {
    onLoggedIn(await saveProfile({ name: 'Guest' }), null);
  };

  return (
    <View style={styles.screen}>
      <PixelBox shadow={6} style={styles.card} boxStyle={styles.cardBox}>
        <Text style={styles.title}>STUDY{'\n'}TIMER</Text>
        <Text style={styles.label}>WHO'S STUDYING?</Text>
        <Text style={styles.description}>
          SIGN IN WITH AN APPROVED GOOGLE ACCOUNT, OR KEEP STUDYING AS A GUEST.
        </Text>
        <PixelButton
          disabled={isSigningIn}
          onPress={signInWithGoogle}
          style={styles.cta}
          boxStyle={styles.ctaBox}
        >
          <Text style={styles.ctaLabel}>
            {isSigningIn ? 'CHECKING...' : 'SIGN IN WITH GOOGLE'}
          </Text>
        </PixelButton>
        {error ? <Text style={styles.error}>{error.toUpperCase()}</Text> : null}
        <PixelButton
          shadow={2}
          color={T.bg}
          onPress={continueAsGuest}
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
  description: {
    fontFamily: T.fontPixel,
    fontSize: 7,
    lineHeight: 13,
    color: T.muted,
    textAlign: 'center',
  },
  error: {
    fontFamily: T.fontPixel,
    fontSize: 7,
    lineHeight: 13,
    color: T.primary,
    textAlign: 'center',
  },
  cta: { alignSelf: 'center' },
  ctaBox: { paddingHorizontal: 24, paddingVertical: 12 },
  ctaLabel: { fontFamily: T.fontPixel, fontSize: 12, color: T.primaryFg },
  guestBox: { paddingHorizontal: 16, paddingVertical: 10 },
  guestLabel: { fontFamily: T.fontPixel, fontSize: 8, color: T.muted },
});
