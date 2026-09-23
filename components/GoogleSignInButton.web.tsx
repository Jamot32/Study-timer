import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { T } from '@/components/nova';
import { AuthError } from '@/lib/auth';
import { loadGoogleIdentity } from '@/lib/auth/google-id-token.web';
import type { GoogleSignInButtonProps } from './GoogleSignInButton';

/** Web: Google's own button, rendered by Google Identity Services into this View's div. */
export default function GoogleSignInButton({ busy, onIdToken, onError }: GoogleSignInButtonProps) {
  const host = useRef<View>(null);
  // GIS keeps the first callback it is given; route through refs so it never goes stale.
  const handlers = useRef({ onIdToken, onError });
  handlers.current = { onIdToken, onError };

  useEffect(() => {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
    if (!clientId) {
      handlers.current.onError(
        new AuthError('not-configured', 'Google login has not been configured for this build.')
      );
      return;
    }
    let cancelled = false;
    loadGoogleIdentity()
      .then((gis) => {
        if (cancelled || !host.current) return;
        gis.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          callback: ({ credential }) => {
            if (credential) handlers.current.onIdToken(credential);
          },
        });
        gis.renderButton(host.current as unknown as HTMLElement, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          width: 300,
        });
      })
      .catch(() =>
        handlers.current.onError(new AuthError('network', 'Could not load Google sign-in.'))
      );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.wrap}>
      <View ref={host} style={[styles.host, busy && styles.busy]} pointerEvents={busy ? 'none' : 'auto'} />
      {busy ? <Text style={styles.checking}>Checking…</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6 },
  host: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  busy: { opacity: 0.5 },
  checking: { fontFamily: T.font, fontSize: 13, color: T.muted },
});
