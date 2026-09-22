import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import {
  clearSecureSession,
  readSecureSession,
  writeSecureSession,
} from './secure-session-store';
import { AuthError, type AuthErrorCode, type AuthGateway, type AuthSession } from './types';

const EXPIRY_SKEW_MS = 60_000;
let configuredFor: string | null = null;

type LoginResponse =
  | { ok: true; session: AuthSession }
  | { ok: false; code?: AuthErrorCode; error?: string };

function configuration() {
  const endpoint = process.env.EXPO_PUBLIC_AUTH_ENDPOINT?.trim();
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();

  if (!endpoint || !webClientId) {
    throw new AuthError(
      'not-configured',
      'Google login has not been configured for this build.'
    );
  }

  if (configuredFor !== `${webClientId}:${iosClientId ?? ''}`) {
    GoogleSignin.configure({
      webClientId,
      ...(iosClientId ? { iosClientId } : {}),
    });
    configuredFor = `${webClientId}:${iosClientId ?? ''}`;
  }

  return { endpoint, webClientId };
}

async function authorize(idToken: string): Promise<AuthSession> {
  const { endpoint } = configuration();
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'login', idToken }),
    });
  } catch {
    throw new AuthError('network', 'Could not reach the login server.');
  }

  let payload: LoginResponse;
  try {
    payload = (await response.json()) as LoginResponse;
  } catch {
    throw new AuthError('invalid-response', 'The login server returned an invalid response.');
  }

  if (!response.ok || !payload.ok) {
    const code = payload.ok ? 'invalid-response' : (payload.code ?? 'provider-error');
    const message = payload.ok ? 'Login failed.' : (payload.error ?? 'Login failed.');
    throw new AuthError(code, message);
  }

  await writeSecureSession(payload.session);
  return payload.session;
}

async function tokenFromInteractiveSignIn(): Promise<string | null> {
  configuration();
  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }
  const result = await GoogleSignin.signIn();
  if (result.type === 'cancelled') return null;
  if (!result.data.idToken) {
    throw new AuthError('provider-error', 'Google did not return an identity token.');
  }
  return result.data.idToken;
}

export const googleSheetAuth: AuthGateway = {
  async restoreSession() {
    const cached = await readSecureSession();
    if (!cached) return null;
    if (Date.parse(cached.expiresAt) - EXPIRY_SKEW_MS > Date.now()) return cached;

    try {
      configuration();
      const result = await GoogleSignin.signInSilently();
      if (result.type !== 'success' || !result.data.idToken) {
        await clearSecureSession();
        return null;
      }
      return await authorize(result.data.idToken);
    } catch {
      await clearSecureSession();
      return null;
    }
  },

  async signInWithGoogle() {
    try {
      const idToken = await tokenFromInteractiveSignIn();
      return idToken ? await authorize(idToken) : null;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError(
        'provider-error',
        error instanceof Error ? error.message : 'Google login failed.'
      );
    }
  },

  async signOut() {
    await clearSecureSession();
    try {
      configuration();
      await GoogleSignin.signOut();
    } catch {
      // Local sign-out must still succeed if Google or build configuration is unavailable.
    }
  },
};
