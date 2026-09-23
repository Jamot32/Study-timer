import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, RADIUS, T } from '@/components/nova';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { AuthError, googleSheetAuth, type AuthSession } from '@/lib/auth';
import { saveProfile, type Profile } from '@/lib/profile';

type LoginProps = {
  onLoggedIn: (profile: Profile, session: AuthSession | null) => void;
};

export default function Login({ onLoggedIn }: LoginProps) {
  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  const submit = async () => {
    if (!trimmed) return;
    onLoggedIn(await saveProfile({ name: trimmed }), null);
  };

  const showError = (cause: unknown) =>
    setError(cause instanceof AuthError ? cause.message : 'Google login failed. Please try again.');

  const signInWithIdToken = async (idToken: string) => {
    if (checking) return;
    setChecking(true);
    setError(null);
    try {
      const session = await googleSheetAuth.signInWithIdToken(idToken);
      const profile = await saveProfile({
        name: session.user.displayName,
        avatar: session.user.avatar,
      });
      onLoggedIn(profile, session);
    } catch (cause) {
      showError(cause);
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Card level={2} radius={RADIUS.xl} style={styles.card} boxStyle={styles.cardBox}>
        <Text style={styles.title}>Study Timer</Text>
        <Text style={styles.subtitle}>A quiet garden for your focus.</Text>

        <GoogleSignInButton busy={checking} onIdToken={signInWithIdToken} onError={showError} />
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <View style={styles.divider}>
          <View style={styles.rule} />
          <Text style={styles.or}>or</Text>
          <View style={styles.rule} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Who's studying?</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            onSubmitEditing={submit}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Your name"
            placeholderTextColor={T.muted}
            maxLength={20}
            returnKeyType="go"
            accessibilityLabel="Your name"
            style={[styles.input, focused && styles.inputFocused]}
          />
        </View>

        <Button block size="lg" variant="outline" disabled={!trimmed} onPress={submit}>
          Start
        </Button>
        {/* PRD P0-1 is guest-first: never wall the timer behind an account. */}
        <Button
          block
          size="md"
          variant="ghost"
          onPress={async () => onLoggedIn(await saveProfile({ name: 'Guest' }), null)}
        >
          Continue as guest
        </Button>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: T.bg },
  card: { width: '100%', maxWidth: 380 },
  cardBox: { padding: 26, gap: 14 },
  title: { fontFamily: T.fontDisplay, fontSize: 30, color: T.ink, textAlign: 'center', letterSpacing: -0.4 },
  subtitle: { fontFamily: T.font, fontSize: 14, color: T.muted, textAlign: 'center', marginBottom: 6 },
  field: { gap: 7, marginBottom: 4 },
  label: { fontFamily: T.fontMedium, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', color: T.muted },
  input: {
    fontFamily: T.font,
    fontSize: 16,
    color: T.ink,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: RADIUS.md,
    backgroundColor: T.cardAlt,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  error: { fontFamily: T.font, fontSize: 13, lineHeight: 19, color: T.danger, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  rule: { flex: 1, height: 1, backgroundColor: T.border },
  or: { fontFamily: T.fontMedium, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', color: T.muted },
  inputFocused: { borderColor: T.primary, backgroundColor: T.card },
});
