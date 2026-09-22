import * as SecureStore from 'expo-secure-store';
import type { AuthSession } from './types';

const AUTH_SESSION_KEY = 'study-timer.auth-session.v1';

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<AuthSession>;
  const user = session.user as Partial<AuthSession['user']> | undefined;
  return Boolean(
    user &&
      typeof user.id === 'string' &&
      typeof user.email === 'string' &&
      typeof user.displayName === 'string' &&
      typeof user.role === 'string' &&
      typeof session.expiresAt === 'string' &&
      Number.isFinite(Date.parse(session.expiresAt))
  );
}

export async function readSecureSession(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isAuthSession(parsed)) return parsed;
  } catch {
    // Corrupt or unavailable secure storage is equivalent to being signed out.
  }
  await clearSecureSession();
  return null;
}

export async function writeSecureSession(session: AuthSession): Promise<void> {
  await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearSecureSession(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
}
