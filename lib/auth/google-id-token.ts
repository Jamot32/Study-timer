import { Platform } from 'react-native';
import { AuthError } from './types';

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

let cachedModule: GoogleSigninModule | null | undefined;
let configuredFor: string | null = null;

/**
 * The package calls TurboModuleRegistry.getEnforcing at import time, so a static
 * import crashes the whole app (guest mode included) in Expo Go or any build made
 * before the native module was added. Load it on first use instead.
 */
function nativeModule(): GoogleSigninModule {
  if (cachedModule === undefined) {
    try {
      cachedModule = require('@react-native-google-signin/google-signin') as GoogleSigninModule;
    } catch {
      cachedModule = null;
    }
  }
  if (!cachedModule) {
    throw new AuthError(
      'not-configured',
      'Google login needs a development build (npm run ios / npm run android). It does not run in Expo Go.'
    );
  }
  return cachedModule;
}

function configure(): GoogleSigninModule {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (!webClientId) {
    throw new AuthError('not-configured', 'Google login has not been configured for this build.');
  }
  // iOS cannot sign in with only a Web client: it needs its own OAuth client and URL scheme.
  if (Platform.OS === 'ios' && !iosClientId) {
    throw new AuthError(
      'not-configured',
      'Google login on iOS needs EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID and GOOGLE_IOS_URL_SCHEME.'
    );
  }

  const mod = nativeModule();
  const key = `${webClientId}:${iosClientId ?? ''}`;
  if (configuredFor !== key) {
    mod.GoogleSignin.configure({ webClientId, ...(iosClientId ? { iosClientId } : {}) });
    configuredFor = key;
  }
  return mod;
}

function translate(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : '';
  // Android DEVELOPER_ERROR: no Android OAuth client matches this package + signing SHA-1.
  if (String(code) === '10' || message.includes('DEVELOPER_ERROR')) {
    return new AuthError(
      'not-configured',
      'Google rejected this build. Register an Android OAuth client for this package and SHA-1.'
    );
  }
  return new AuthError('provider-error', message || 'Google login failed.');
}

/** Interactive sign-in. Resolves null when the user cancels. */
export async function getGoogleIdToken(): Promise<string | null> {
  try {
    const { GoogleSignin } = configure();
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const result = await GoogleSignin.signIn();
    if (result.type === 'cancelled') return null;
    if (!result.data.idToken) {
      throw new AuthError('provider-error', 'Google did not return an identity token.');
    }
    return result.data.idToken;
  } catch (error) {
    throw translate(error);
  }
}

/** Fresh ID token without UI, or null if the user has to sign in again. */
export async function getSilentGoogleIdToken(): Promise<string | null> {
  try {
    const { GoogleSignin } = configure();
    const result = await GoogleSignin.signInSilently();
    return result.type === 'success' ? result.data.idToken : null;
  } catch {
    return null;
  }
}

export async function signOutOfGoogle(): Promise<void> {
  try {
    await configure().GoogleSignin.signOut();
  } catch {
    // Local sign-out must still succeed if Google or build configuration is unavailable.
  }
}
