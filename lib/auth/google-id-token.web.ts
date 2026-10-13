// Web build: @react-native-google-signin's web entry is a stub that always throws
// ("web support is only available to sponsors"), so the browser uses Google
// Identity Services directly. Its ID token is issued for the Web client ID —
// the same audience the Apps Script checks — so no extra OAuth client is needed.
// Add the dev/prod origins (e.g. http://localhost:8081) to that Web client's
// "Authorized JavaScript origins" in Google Cloud.

const GIS_SRC = 'https://accounts.google.com/gsi/client';

export type GoogleIdentity = {
  initialize(options: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    use_fedcm_for_button?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  disableAutoSelect(): void;
};

let loading: Promise<GoogleIdentity> | null = null;

export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  const w = window as unknown as { google?: { accounts?: { id?: GoogleIdentity } } };
  if (w.google?.accounts?.id) return Promise.resolve(w.google.accounts.id);
  loading ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () =>
      w.google?.accounts?.id ? resolve(w.google.accounts.id) : reject(new Error('GIS missing'));
    script.onerror = () => {
      loading = null;
      reject(new Error('Could not load Google sign-in.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Interactive sign-in on web goes through the rendered GIS button instead. */
export async function getGoogleIdToken(): Promise<string | null> {
  return null;
}

/** GIS has no silent refresh; an expired web session signs in again from the button. */
export async function getSilentGoogleIdToken(): Promise<string | null> {
  return null;
}

export async function signOutOfGoogle(): Promise<void> {
  try {
    const w = window as unknown as { google?: { accounts?: { id?: GoogleIdentity } } };
    w.google?.accounts?.id?.disableAutoSelect();
  } catch {
    // Nothing to sign out of.
  }
}
