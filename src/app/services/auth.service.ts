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
    
    return this.backendApi.login(email, password).pipe(
      switchMap(response => {
        
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

    this.tokenService.clearTokens();
    this.updateAuthState(null, null);
    this.router.navigate(['/login']);
 
    if (refreshToken) {
      this.backendApi.logout(refreshToken).subscribe({
        next: () => {},
        error: (error) => console.warn('Backend logout failed:', error)
      });
    }
  }

  /**
   * Check if user is authenticated using token validation
   */
  isAuthenticated(): boolean {
    const token = this.tokenService.getAccessToken();
    const isValid = token ? this.tokenService.isTokenValid(token) : false;
    
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
    
    // Listen for token expiration
    this.tokenService.tokenExpired$.subscribe(expired => {
      if (expired) {
        this.handleAuthError('token_expired');
      }
    });

    // Listen for session warnings
    this.tokenService.sessionWarning$.subscribe(warning => {
      if (warning.show) {
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

    const dialogRef = this.dialog.open(SessionExpiredComponent, {
      disableClose: true,
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(() => {
      this.logout();
    });
  }
}