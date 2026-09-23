export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  avatar?: string;
};

export type AuthSession = {
  user: AuthUser;
  expiresAt: string;
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
