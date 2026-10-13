import { getSilentGoogleIdToken, signOutOfGoogle } from './google-id-token';
import {
  clearSecureSession,
  readSecureSession,
  writeSecureSession,
} from './secure-session-store';
import { AuthError, type AuthErrorCode, type AuthGateway, type AuthSession } from './types';

const EXPIRY_SKEW_MS = 60_000;

type LoginResponse =
  | { ok: true; session: AuthSession }
  | { ok: false; code?: AuthErrorCode; error?: string };

function endpoint(): string {
  const url = process.env.EXPO_PUBLIC_AUTH_ENDPOINT?.trim();
  if (!url) {
    throw new AuthError('not-configured', 'Google login has not been configured for this build.');
  }
  return url;
}

async function authorize(idToken: string): Promise<AuthSession> {
  let response: Response;
  try {
    // text/plain keeps this a CORS "simple request": Apps Script cannot answer a
    // preflight, and the web build would otherwise fail before the POST is sent.
    // No -X POST equivalent is needed — fetch follows Apps Script's 302 as a GET.
    response = await fetch(endpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'login', idToken }),
    });
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError('network', 'Could not reach the login server.');
  }

  let payload: LoginResponse;
  try {
    payload = (await response.json()) as LoginResponse;
  } catch {
    // An HTML page here usually means the /exec URL is wrong or the deployment
    // is not shared with "Anyone".
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

export const googleSheetAuth: AuthGateway = {
  async restoreSession() {
    try {
      const cached = await readSecureSession();
      if (!cached) return null;
      if (Date.parse(cached.expiresAt) - EXPIRY_SKEW_MS > Date.now()) return cached;

      const idToken = await getSilentGoogleIdToken();
      if (idToken) return await authorize(idToken);
    } catch {
      // Any failure here means "signed out", never a stuck loading screen.
    }
    await clearSecureSession();
    return null;
  },

  async signInWithIdToken(idToken) {
    try {
      return await authorize(idToken);
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
    await signOutOfGoogle();
  },
};
