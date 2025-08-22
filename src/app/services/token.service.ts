import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, timer } from 'rxjs';
import { TokenPayload, SessionConfig, RefreshTokenResponse } from '../interfaces/api.interface';
import { TokenStorage } from '../interfaces/user.interface';

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private readonly TOKEN_KEY = 'auth_tokens';
  private readonly ACTIVITY_KEY = 'last_activity';
  
  private sessionConfig: SessionConfig = {
    // sessionTimeoutMinutes: 30, // 30 minutes
    // refreshThresholdMinutes: 5, // 5 minutes before expiry
    // warningMinutes: 2 // 2 minutes warning
    sessionTimeoutMinutes: 1, // 1 minute
    refreshThresholdMinutes: 0.5, // 30 seconds before expiry
    warningMinutes: 0.3 // 18 seconds warning
  };

  private tokenExpiredSubject = new BehaviorSubject<boolean>(false);
  private sessionWarningSubject = new BehaviorSubject<{ show: boolean; timeRemaining: number }>({ show: false, timeRemaining: 0 });
  
  public tokenExpired$ = this.tokenExpiredSubject.asObservable();
  public sessionWarning$ = this.sessionWarningSubject.asObservable();

  constructor() {
    this.initializeActivityTracking();
    this.startSessionMonitoring();
  }

  /**
   * Store JWT tokens securely
   */
  storeTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    const now = Date.now();
    const tokenStorage: TokenStorage = {
      accessToken,
      refreshToken,
      expiresAt: now + (expiresIn * 1000),
      issuedAt: now
    };

    localStorage.setItem(this.TOKEN_KEY, btoa(JSON.stringify(tokenStorage)));
    this.updateLastActivity();
    
    console.log('Tokens stored successfully');
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    const tokenStorage = this.getTokenStorage();
    if (!tokenStorage || this.isTokenExpired(tokenStorage.accessToken)) {
      return null;
    }
    return tokenStorage.accessToken;
  }

  /**
   * Get refresh token
   */
  getRefreshToken(): string | null {
    const tokenStorage = this.getTokenStorage();
    return tokenStorage?.refreshToken || null;
  }

  /**
   * Clear all tokens (logout)
   */
  clearTokens(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.ACTIVITY_KEY);
    this.tokenExpiredSubject.next(false);
    this.sessionWarningSubject.next({ show: false, timeRemaining: 0 });
    console.log('Tokens cleared');
  }

  /**
   * Decode JWT token payload
   */
  decodeToken(token: string): TokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      return payload as TokenPayload;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  /**
   * Check if token is valid
   */
  isTokenValid(token: string): boolean {
    if (!token) return false;
    
    const payload = this.decodeToken(token);
    if (!payload) return false;

    return !this.isTokenExpired(token);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  }

  /**
   * Get time until token expires
   */
  getTimeUntilExpiry(token: string): number {
    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) return 0;

    const currentTime = Math.floor(Date.now() / 1000);
    return Math.max(0, payload.exp - currentTime);
  }

  /**
   * Get user ID from token
   */
  getUserIdFromToken(): string | null {
    const token = this.getAccessToken();
    if (!token) return null;

    const payload = this.decodeToken(token);
    return payload?.sub || null;
  }

  /**
   * Get user role from token
   */
  getRoleFromToken(): 'admin' | 'user' | null {
    const token = this.getAccessToken();
    if (!token) return null;

    const payload = this.decodeToken(token);
    return payload?.role || null;
  }

  /**
   * Get user email from token
   */
  getEmailFromToken(): string | null {
    const token = this.getAccessToken();
    if (!token) return null;

    const payload = this.decodeToken(token);
    return payload?.email || null;
  }

  /**
   * Check if token should be refreshed
   */
  shouldRefreshToken(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;

    const timeUntilExpiry = this.getTimeUntilExpiry(token);
    const refreshThreshold = this.sessionConfig.refreshThresholdMinutes * 60;
    
    return timeUntilExpiry > 0 && timeUntilExpiry <= refreshThreshold;
  }

  /**
   * Schedule automatic token refresh
   */
  scheduleTokenRefresh(refreshCallback: () => Observable<RefreshTokenResponse>): void {
    const token = this.getAccessToken();
    if (!token) return;

    const timeUntilRefresh = Math.max(0, this.getTimeUntilExpiry(token) - (this.sessionConfig.refreshThresholdMinutes * 60));
    
    timer(timeUntilRefresh * 1000).subscribe(() => {
      if (this.shouldRefreshToken()) {
        console.log('Auto-refreshing token...');
        refreshCallback().subscribe({
          next: (response) => {
            if (response.success) {
              const refreshToken = this.getRefreshToken();
              if (refreshToken) {
                this.storeTokens(response.accessToken, refreshToken, response.expiresIn);
              }
            }
          },
          error: (error) => {
            console.error('Auto-refresh failed:', error);
            this.handleTokenExpiry();
          }
        });
      }
    });
  }

  /**
   * Update last activity timestamp
   */
  updateLastActivity(): void {
    localStorage.setItem(this.ACTIVITY_KEY, Date.now().toString());
  }

  /**
   * Get last activity timestamp
   */
  getLastActivity(): Date | null {
    const timestamp = localStorage.getItem(this.ACTIVITY_KEY);
    return timestamp ? new Date(parseInt(timestamp)) : null;
  }

  /**
   * Check if session has timed out due to inactivity
   */
  isSessionTimedOut(): boolean {
    const lastActivity = this.getLastActivity();
    if (!lastActivity) return true;

    const timeoutMs = this.sessionConfig.sessionTimeoutMinutes * 60 * 1000;
    return (Date.now() - lastActivity.getTime()) > timeoutMs;
  }

  /**
   * Get current session configuration (read-only)
   */
  getSessionConfig(): Readonly<SessionConfig> {
    return { ...this.sessionConfig };
  }

  /**
   * Get token expiration time in seconds
   */
  getTokenExpirationSeconds(): number {
    return this.sessionConfig.sessionTimeoutMinutes * 60;
  }

  // ===== PRIVATE HELPER METHODS =====

  private getTokenStorage(): TokenStorage | null {
    try {
      const encrypted = localStorage.getItem(this.TOKEN_KEY);
      if (!encrypted) return null;

      return JSON.parse(atob(encrypted)) as TokenStorage;
    } catch (error) {
      console.error('Error retrieving token storage:', error);
      return null;
    }
  }

  private initializeActivityTracking(): void {
    const events = ['click', 'keypress', 'scroll', 'mousemove'];
    
    events.forEach(event => {
      document.addEventListener(event, () => {
        this.updateLastActivity();
      }, { passive: true });
    });
  }

  private startSessionMonitoring(): void {
    timer(0, 30000).subscribe(() => {
      this.checkSessionStatus();
    });
  }

  private checkSessionStatus(): void {
    const token = this.getAccessToken();
    
    if (!token) {
      console.log('No token found in checkSessionStatus');
      return;
    }

    console.log('Checking session status...', {
      hasToken: !!token,
      isSessionTimedOut: this.isSessionTimedOut(),
      timeUntilExpiry: this.getTimeUntilExpiry(token),
      lastActivity: this.getLastActivity()
    });

    if (this.isSessionTimedOut()) {
      console.log('Session timed out due to inactivity');
      this.handleSessionTimeout();
      return;
    }

    const timeUntilExpiry = this.getTimeUntilExpiry(token);
    const warningThreshold = this.sessionConfig.warningMinutes * 60;

    console.log('Session check:', {
      timeUntilExpiry,
      warningThreshold,
      shouldShowWarning: timeUntilExpiry > 0 && timeUntilExpiry <= warningThreshold
    });

    if (timeUntilExpiry > 0 && timeUntilExpiry <= warningThreshold) {
      console.log('Showing session warning:', timeUntilExpiry, 'seconds remaining');
      this.sessionWarningSubject.next({ 
        show: true, 
        timeRemaining: timeUntilExpiry 
      });
    } else if (timeUntilExpiry <= 0) {
      console.log('Token expired, handling expiry');
      this.handleTokenExpiry();
    } else {
      this.sessionWarningSubject.next({ show: false, timeRemaining: 0 });
    }
  }

  private handleTokenExpiry(): void {
    console.log('🔴 Token expired - triggering auth error');
    this.tokenExpiredSubject.next(true);
    this.clearTokens();
  }

  private handleSessionTimeout(): void {
    console.log('🔴 Session timeout - triggering auth error');
    this.tokenExpiredSubject.next(true);
    this.clearTokens();
  }
}
