import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of, BehaviorSubject, throwError } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';

import { AuthState, AuthUser, AuthError } from '../interfaces/user.interface';
import { RefreshTokenResponse } from '../interfaces/api.interface';
import { TokenService } from './token.service';
import { BackendApiService } from './backend-api.service';
import { SessionExpiredComponent } from '../components/session-expired/session-expired.component';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private tokenService = inject(TokenService);
  private backendApi = inject(BackendApiService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  // Reactive authentication state
  private authStateSubject = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    user: null,
    sessionExpiry: null,
    lastActivity: null
  });

  // Public signals and observables
  public authState$ = this.authStateSubject.asObservable();
  public isLoggedIn = signal(false);
  public username = signal<string | null>(null);
  public userRole = signal<'admin' | 'user' | null>(null);

  constructor() {
    this.initializeAuthState();
    this.setupTokenMonitoring();
  }

  /**
   * Login with email and password
   */
  login(email: string, password: string): Observable<'admin' | 'user' | 'invalid_email' | 'invalid_password'> {
    console.log('🚀 AuthService: Making login request to backend API');
    
    return this.backendApi.login(email, password).pipe(
      switchMap(response => {
        console.log('📥 AuthService: Received login response:', { success: response.success, hasToken: !!response.accessToken });
        
        if (!response.success) {
          return of(response.errorCode || 'invalid_email' as const);
        }

        if (response.accessToken && response.refreshToken && response.user) {
          // Store tokens using TokenService
          this.tokenService.storeTokens(
            response.accessToken,
            response.refreshToken,
            response.expiresIn || this.tokenService.getTokenExpirationSeconds()
          );

          const authUser: AuthUser = {
            id: response.user.id,
            name: response.user.name,
            email: response.user.email,
            role: response.user.role
          };
          
          const expirationSeconds = response.expiresIn || this.tokenService.getTokenExpirationSeconds();
          this.updateAuthState(authUser, new Date(Date.now() + (expirationSeconds * 1000)));
          
          // Schedule automatic token refresh
          // this.tokenService.scheduleTokenRefresh(() => this.refreshToken());

          console.log('✅ AuthService: Login successful, user role:', response.user.role);
          return of(response.user.role as 'admin' | 'user');
        }

        return of('invalid_email' as const);
      }),
      catchError(error => {
        console.error('❌ AuthService: Login error:', error);
        return of('invalid_email' as const);
      })
    );
  }

  /**
   * Refresh access token using backend API
   */
  refreshToken(): Observable<RefreshTokenResponse> {
    const refreshToken = this.tokenService.getRefreshToken();
    
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.backendApi.refreshToken(refreshToken).pipe(
      tap(response => {
        if (response.success) {
          const currentRefreshToken = this.tokenService.getRefreshToken();
          if (currentRefreshToken) {
            this.tokenService.storeTokens(
              response.accessToken,
              currentRefreshToken,
              response.expiresIn
            );
          }
        }
      }),
      catchError(error => {
        console.error('Token refresh failed:', error);
        this.handleAuthError('refresh_failed');
        return throwError(() => error);
      })
    );
  }

  /**
   * Logout and clear all tokens
   */
  logout(): void {
    const refreshToken = this.tokenService.getRefreshToken();
    
    // Clear tokens immediately
    this.tokenService.clearTokens();
    this.updateAuthState(null, null);
    this.router.navigate(['/login']);
    
    // Notify backend to invalidate tokens (optional, runs in background)
    if (refreshToken) {
      this.backendApi.logout(refreshToken).subscribe({
        next: () => console.log('Logout successful on backend'),
        error: (error) => console.warn('Backend logout failed:', error)
      });
    }
    
    console.log('User logged out');
  }

  /**
   * Check if user is authenticated using token validation
   */
  isAuthenticated(): boolean {
    const token = this.tokenService.getAccessToken();
    const isValid = token ? this.tokenService.isTokenValid(token) : false;
    
    // Update reactive state
    this.isLoggedIn.set(isValid);
    
    return isValid;
  }

  /**
   * Get current username from token
   */
  getUsername(): string | null {
    const token = this.tokenService.getAccessToken();
    if (!token) return null;

    const payload = this.tokenService.decodeToken(token);
    const name = payload?.email?.split('@')[0] || null;
    
    this.username.set(name);
    return name;
  }

  /**
   * Get current user role from token
   */
  getUserRole(): 'admin' | 'user' | null {
    const role = this.tokenService.getRoleFromToken();
    this.userRole.set(role);
    return role;
  }

  /**
   * Get current user ID from token
   */
  getUserId(): string | null {
    return this.tokenService.getUserIdFromToken();
  }

  /**
   * Extend current session (refresh activity)
   */
  extendSession(): Observable<boolean> {
    if (!this.isAuthenticated()) {
      return of(false);
    }

    this.tokenService.updateLastActivity();
    
    // If token needs refresh, do it now
    if (this.tokenService.shouldRefreshToken()) {
      return this.refreshToken().pipe(
        map(response => response.success),
        catchError(() => of(false))
      );
    }

    return of(true);
  }

  // ===== PRIVATE HELPER METHODS =====

  private initializeAuthState(): void {
    // Check if there's a valid token on app start
    const token = this.tokenService.getAccessToken();
    
    if (token && this.tokenService.isTokenValid(token)) {
      const payload = this.tokenService.decodeToken(token);
      if (payload) {
        const user: AuthUser = {
          id: payload.sub,
          email: payload.email,
          name: payload.email.split('@')[0],
          role: payload.role
        };
        
        const expiry = new Date(payload.exp * 1000);
        this.updateAuthState(user, expiry);
      }
    }
  }

  private setupTokenMonitoring(): void {
    console.log('🟢 Setting up token monitoring...');
    
    // Listen for token expiration
    this.tokenService.tokenExpired$.subscribe(expired => {
      console.log('🔴 Token expired event received:', expired);
      if (expired) {
        this.handleAuthError('token_expired');
      }
    });

    // Listen for session warnings
    this.tokenService.sessionWarning$.subscribe(warning => {
      console.log('🟡 Session warning event received:', warning);
      if (warning.show) {
        // For simplicity, we'll just show the session expired dialog
        this.handleAuthError('token_expired');
      }
    });
  }

  private updateAuthState(user: AuthUser | null, sessionExpiry: Date | null): void {
    const isAuthenticated = user !== null;
    
    this.authStateSubject.next({
      isAuthenticated,
      user,
      sessionExpiry,
      lastActivity: isAuthenticated ? new Date() : null
    });

    // Update signals
    this.isLoggedIn.set(isAuthenticated);
    this.username.set(user?.name || null);
    this.userRole.set(user?.role || null);
  }

  private handleAuthError(error: AuthError): void {
    console.log('🔴 Auth error triggered:', error);

    console.log('📱 Opening session expired dialog');

    const dialogRef = this.dialog.open(SessionExpiredComponent, {
      disableClose: true,
      width: '400px'
    });

    // The component will handle redirect to login automatically
    dialogRef.afterClosed().subscribe(() => {
      // Ensure logout happens regardless of how dialog is closed
      this.logout();
    });
  }
}