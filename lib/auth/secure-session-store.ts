import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { storage } from '../sessions';
import type { AuthSession } from './types';

const AUTH_SESSION_KEY = 'study-timer.auth-session.v1';

// expo-secure-store has no web implementation — every call throws there, which
// used to reject restoreSession and leave the web build on the loading screen.
// Web falls back to the same AsyncStorage/localStorage the rest of the app uses.
// The session's syncToken is a bearer token there, as readable as any other
// first-party web credential; revoke all of them by rotating SYNC_SECRET.
const store =
  Platform.OS === 'web'
    ? {
        get: (key: string) => storage.getItem(key) as Promise<string | null>,
        set: (key: string, value: string) => storage.setItem(key, value) as Promise<void>,
        remove: (key: string) => storage.removeItem(key) as Promise<void>,
      }
    : {
        get: (key: string) => SecureStore.getItemAsync(key),
        set: (key: string, value: string) =>
          SecureStore.setItemAsync(key, value, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          }),
        remove: (key: string) => SecureStore.deleteItemAsync(key),
      };

export function isAuthSession(value: unknown): value is AuthSession {
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
      Number.isFinite(Date.parse(session.expiresAt)) &&
      (session.syncToken === undefined || typeof session.syncToken === 'string')
  );
}

export async function readSecureSession(): Promise<AuthSession | null> {
  try {
    const raw = await store.get(AUTH_SESSION_KEY);
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
  try {
    await store.set(AUTH_SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    // The login itself succeeded; it just won't survive a restart.
    console.error('Failed to persist auth session:', error);
  }
}

export async function clearSecureSession(): Promise<void> {
  try {
    await store.remove(AUTH_SESSION_KEY);
  } catch {
    // Nothing stored is the same as signed out.
  }
}
