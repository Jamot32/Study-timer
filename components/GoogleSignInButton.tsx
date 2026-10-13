import React from 'react';
import { Button } from '@/components/nova';
import { getGoogleIdToken } from '@/lib/auth/google-id-token';

export type GoogleSignInButtonProps = {
  busy: boolean;
  onIdToken: (idToken: string) => void;
  onError: (error: unknown) => void;
};

/** Native: opens the Google account sheet from the platform SDK. */
export default function GoogleSignInButton({ busy, onIdToken, onError }: GoogleSignInButtonProps) {
  const press = async () => {
    try {
      const idToken = await getGoogleIdToken();
      if (idToken) onIdToken(idToken);
    } catch (error) {
      onError(error);
    }
  };

  return (
    <Button block size="lg" disabled={busy} onPress={press}>
      {busy ? 'Checking…' : 'Sign in with Google'}
    </Button>
  );
}
