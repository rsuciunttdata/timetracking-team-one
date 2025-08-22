/**
 * Common API interfaces and types
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  errors?: ApiError[];
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
}

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

export interface PaginationRequest {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface LoadingState {
  isLoading: boolean;
  error?: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface LoginResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'user';
  };
  expiresIn?: number; // seconds
  errorCode?: 'invalid_email' | 'invalid_password';
}

export interface RefreshTokenResponse {
  success: boolean;
  accessToken: string;
  expiresIn: number;
  errorCode?: 'invalid_token' | 'token_expired';
}

export interface TokenPayload {
  sub: string; // User ID
  email: string;
  role: 'admin' | 'user';
  iat: number; // Issued at
  exp: number; // Expires at
}

export interface SessionConfig {
  sessionTimeoutMinutes: number;
  refreshThresholdMinutes: number;
  warningMinutes: number;
}
