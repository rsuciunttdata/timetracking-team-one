/**
 * User and authentication interfaces
 */

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
}

export interface AuthUser extends Omit<User, 'password'> {}

// Authentication state management
export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  sessionExpiry: Date | null;
  lastActivity: Date | null;
}

export interface SessionWarning {
  show: boolean;
  timeRemaining: number; // in seconds
  type: 'timeout' | 'expiry';
}

export interface TokenStorage {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  issuedAt: number;
}

export type AuthError = 
  | 'invalid_credentials'
  | 'token_expired'
  | 'session_timeout'
  | 'refresh_failed'
  | 'network_error'
  | 'unauthorized';