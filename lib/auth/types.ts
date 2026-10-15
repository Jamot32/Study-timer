export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  avatar?: string;
};

export type AuthSession = {
  user: AuthUser;
  /** Google ID-token expiry: gates native cached restore, not web page lifetime or sync-token validity. */
  expiresAt: string;
  /** Server-signed bearer token for session sync. Missing on sessions stored before sync existed. */
  syncToken?: string;
};

export interface AuthGateway {
  restoreSession(): Promise<AuthSession | null>;
  /** Checks a Google ID token against the sheet allowlist. */
  signInWithIdToken(idToken: string): Promise<AuthSession>;
  signOut(): Promise<void>;
}

export type AuthErrorCode =
  | 'not-configured'
  | 'not-approved'
  | 'disabled'
  | 'network'
  | 'invalid-response'
  | 'provider-error';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
