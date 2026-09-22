import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, RADIUS, T } from '@/components/nova';
import { saveProfile, type Profile } from '@/lib/auth';

export default function Login({ onLoggedIn }: { onLoggedIn: (profile: Profile) => void }) {
  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);
  const trimmed = name.trim();

  const submit = async () => {
    if (!trimmed) return;
    onLoggedIn(await saveProfile({ name: trimmed }));
  };

  return (
    <View style={styles.screen}>
      <Card level={2} radius={RADIUS.xl} style={styles.card} boxStyle={styles.cardBox}>
        <Text style={styles.title}>Study Timer</Text>
        <Text style={styles.subtitle}>A quiet garden for your focus.</Text>

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
            autoFocus
            maxLength={20}
            returnKeyType="go"
            accessibilityLabel="Your name"
            style={[styles.input, focused && styles.inputFocused]}
          />
        </View>

        <Button block size="lg" disabled={!trimmed} onPress={submit}>
          Start
        </Button>
        {/* PRD P0-1 is guest-first: never wall the timer behind an account. */}
        <Button
          block
          size="md"
          variant="ghost"
          onPress={async () => onLoggedIn(await saveProfile({ name: 'Guest' }))}
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
  inputFocused: { borderColor: T.primary, backgroundColor: T.card },
});
