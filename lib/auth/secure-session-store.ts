import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { storage } from '../sessions';
import type { AuthSession } from './types';

const AUTH_SESSION_KEY = 'study-timer.auth-session.v1';

// Web credentials live only for this page lifetime; reloading requires sign-in.
// Never persist the session blob: it contains the bearer syncToken.
let webSession: string | null = null;

const store =
  Platform.OS === 'web'
    ? {
        get: async (_key: string) => webSession,
        set: async (_key: string, value: string) => {
          webSession = value;
        },
        remove: async (key: string) => {
          webSession = null;
          await storage.removeItem(key);
        },
      }
    : {
        get: (key: string) => SecureStore.getItemAsync(key),
        set: (key: string, value: string) =>
          SecureStore.setItemAsync(key, value, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          }),
        remove: (key: string) => SecureStore.deleteItemAsync(key),
      };

if (Platform.OS === 'web') {
  // Migrate old builds at startup without ever reading their persisted token.
  void clearSecureSession();
}

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
