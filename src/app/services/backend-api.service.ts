import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

import {
  TimeEntry,
  CreateTimeEntryRequest,
  UpdateTimeEntryRequest
} from '../interfaces/time-entry.interface';
import { ApiResponse, LoginResponse, RefreshTokenResponse } from '../interfaces/api.interface';
import { User } from '../interfaces/user.interface';
import { 
  API_CONFIG,
  getDailyEndpoint, 
  getUserMonthlyEndpoint, 
  getUserWeeklyEndpoint 
} from '../config/api.config';
import { TokenService } from './token.service';

@Injectable({
  providedIn: 'root'
})
export class BackendApiService {
  private readonly baseUrl = API_CONFIG.BASE_URL;
  private tokenService = inject(TokenService);

  constructor(private http: HttpClient) { }

  // ===== AUTHENTICATION OPERATIONS =====

  /**
   * Login with email and password
   * POST /auth/login
   */
  login(email: string, password: string): Observable<LoginResponse> {
    const endpoint = `${this.baseUrl}/auth/login`;
    const payload = { email, password };

    console.log('🌐 BackendAPI: Sending login request to:', endpoint);

    return this.http.post<LoginResponse>(endpoint, payload, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      })
    }).pipe(
      tap((response: LoginResponse) => console.log('📡 BackendAPI: Login response received:', { success: response.success })),
      catchError(error => {
        console.log('💥 BackendAPI: Login request failed, error will be handled by interceptor');
        return this.handleError('login', error);
      })
    );
  }

  /**
   * Refresh access token using refresh token
   * POST /auth/refresh
   */
  refreshToken(refreshToken: string): Observable<RefreshTokenResponse> {
    const endpoint = `${this.baseUrl}/auth/refresh`;
    const payload = { refreshToken };

    return this.http.post<RefreshTokenResponse>(endpoint, payload, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      })
    }).pipe(
      catchError(error => this.handleError('refreshToken', error))
    );
  }

  /**
   * Logout (invalidate tokens)
   * POST /auth/logout
   */
  logout(refreshToken?: string): Observable<void> {
    const endpoint = `${this.baseUrl}/auth/logout`;
    const payload = refreshToken ? { refreshToken } : {};

    return this.http.post<void>(endpoint, payload, this.getHttpOptions()).pipe(
      catchError(error => this.handleError('logout', error))
    );
  }

  /**
   * Validate current access token
   * GET /auth/validate
   */
  validateToken(): Observable<{ valid: boolean; user?: User }> {
    const endpoint = `${this.baseUrl}/auth/validate`;

    return this.http.get<{ valid: boolean; user?: User }>(endpoint, this.getHttpOptions()).pipe(
      catchError(error => this.handleError('validateToken', error))
    );
  }

  // ===== DAILY TIME ENTRY OPERATIONS =====

  /**
   * Get daily time entry for a specific date
   * GET /daily/by-date/{date}
   */
  getDailyTimeEntry(date: Date): Observable<TimeEntry | null> {
    const endpoint = getDailyEndpoint(date);
    
    return this.http.get<ApiResponse<TimeEntry>>(endpoint, this.getHttpOptions())
      .pipe(
        map(response => this.handleApiResponse(response)),
        catchError(error => this.handleError('getDailyTimeEntry', error))
      );
  }

  /**
   * Create daily time entry for a specific date
   * POST /daily/by-date/{date}
   */
  createDailyTimeEntry(date: Date, timeEntry: Omit<CreateTimeEntryRequest, 'userId' | 'date'>): Observable<TimeEntry> {
    const currentUserId = this.tokenService.getUserIdFromToken();
    if (!currentUserId) {
      return throwError(() => new Error('User not authenticated'));
    }

    const endpoint = getDailyEndpoint(date);
    const payload = {
      ...timeEntry,
      userId: currentUserId,
      date: date.toISOString().split('T')[0] // YYYY-MM-DD format
    };

    return this.http.post<ApiResponse<TimeEntry>>(endpoint, payload, this.getHttpOptions())
      .pipe(
        map(response => this.handleApiResponse(response)),
        catchError(error => this.handleError('createDailyTimeEntry', error))
      );
  }

  /**
   * Update daily time entry for a specific date
   * PATCH /daily/by-date/{date}
   */
  updateDailyTimeEntry(date: Date, timeEntry: Partial<UpdateTimeEntryRequest>): Observable<TimeEntry> {
    const endpoint = getDailyEndpoint(date);

    return this.http.patch<ApiResponse<TimeEntry>>(endpoint, timeEntry, this.getHttpOptions())
      .pipe(
        map(response => this.handleApiResponse(response)),
        catchError(error => this.handleError('updateDailyTimeEntry', error))
      );
  }

  /**
   * Delete daily time entry for a specific date
   * DELETE /daily/by-date/{date}
   */
  deleteDailyTimeEntry(date: Date): Observable<void> {
    const endpoint = getDailyEndpoint(date);

    return this.http.delete<ApiResponse<void>>(endpoint, this.getHttpOptions())
      .pipe(
        map(() => undefined),
        catchError(error => this.handleError('deleteDailyTimeEntry', error))
      );
  }

  // ===== USER MONTHLY OPERATIONS =====

  /**
   * Get user's monthly time entries for a specific month
   * GET /{userId}/monthly/by-date/{date}
   */
  getUserMonthlyTimeEntries(userId: string, date: Date): Observable<TimeEntry[]> {
    const endpoint = getUserMonthlyEndpoint(userId, date);

    return this.http.get<ApiResponse<TimeEntry[]>>(endpoint, this.getHttpOptions())
      .pipe(
        map(response => this.handleApiResponse(response)),
        catchError(error => this.handleError('getUserMonthlyTimeEntries', error))
      );
  }

  /**
   * Get current user's monthly time entries
   */
  getCurrentUserMonthlyTimeEntries(date: Date): Observable<TimeEntry[]> {
    const currentUserId = this.tokenService.getUserIdFromToken();
    if (!currentUserId) {
      return throwError(() => new Error('User not authenticated'));
    }

    return this.getUserMonthlyTimeEntries(currentUserId, date);
  }

  // ===== USER WEEKLY OPERATIONS =====

  /**
   * Get user's weekly time entries for a specific week
   * GET /{userId}/weekly/by-date/{date}
   */
  getUserWeeklyTimeEntries(userId: string, date: Date): Observable<TimeEntry[]> {
    const endpoint = getUserWeeklyEndpoint(userId, date);

    return this.http.get<ApiResponse<TimeEntry[]>>(endpoint, this.getHttpOptions())
      .pipe(
        map(response => this.handleApiResponse(response)),
        catchError(error => this.handleError('getUserWeeklyTimeEntries', error))
      );
  }

  /**
   * Get current user's weekly time entries
   */
  getCurrentUserWeeklyTimeEntries(date: Date): Observable<TimeEntry[]> {
    const currentUserId = this.tokenService.getUserIdFromToken();
    if (!currentUserId) {
      return throwError(() => new Error('User not authenticated'));
    }

    return this.getUserWeeklyTimeEntries(currentUserId, date);
  }

  // ===== ADMIN OPERATIONS =====

  /**
   * Get all users' time entries for a specific date (admin only)
   * GET /admin/daily/by-date/{date}
   */
  getAdminDailyTimeEntries(date: Date): Observable<TimeEntry[]> {
    if (!this.isAdmin()) {
      return throwError(() => new Error('Access denied: Admin privileges required'));
    }

    const endpoint = `${this.baseUrl}/admin/daily/by-date/${this.formatDateForApi(date)}`;

    return this.http.get<ApiResponse<TimeEntry[]>>(endpoint, this.getHttpOptions())
      .pipe(
        map(response => this.handleApiResponse(response)),
        catchError(error => this.handleError('getAdminDailyTimeEntries', error))
      );
  }

  /**
   * Approve a time entry (admin only)
   * PATCH /admin/time-entries/{id}/approve
   */
  approveTimeEntry(entryId: string): Observable<TimeEntry> {
    if (!this.isAdmin()) {
      return throwError(() => new Error('Access denied: Admin privileges required'));
    }

    const endpoint = `${this.baseUrl}/admin/time-entries/${entryId}/approve`;
    const payload = {
      approvedBy: this.tokenService.getUserIdFromToken(),
      approvedAt: new Date().toISOString()
    };

    return this.http.patch<ApiResponse<TimeEntry>>(endpoint, payload, this.getHttpOptions())
      .pipe(
        map(response => this.handleApiResponse(response)),
        catchError(error => this.handleError('approveTimeEntry', error))
      );
  }

  /**
   * Reject a time entry (admin only)
   * PATCH /admin/time-entries/{id}/reject
   */
  rejectTimeEntry(entryId: string, reason?: string): Observable<TimeEntry> {
    if (!this.isAdmin()) {
      return throwError(() => new Error('Access denied: Admin privileges required'));
    }

    const endpoint = `${this.baseUrl}/admin/time-entries/${entryId}/reject`;
    const payload = {
      rejectedBy: this.tokenService.getUserIdFromToken(),
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason
    };

    return this.http.patch<ApiResponse<TimeEntry>>(endpoint, payload, this.getHttpOptions())
      .pipe(
        map(response => this.handleApiResponse(response)),
        catchError(error => this.handleError('rejectTimeEntry', error))
      );
  }

  // ===== BULK OPERATIONS =====

  /**
   * Submit multiple time entries for approval
   * POST /bulk/submit
   */
  bulkSubmitTimeEntries(entryIds: string[]): Observable<TimeEntry[]> {
    const endpoint = `${this.baseUrl}/bulk/submit`;
    const payload = {
      entryIds,
      submittedBy: this.tokenService.getUserIdFromToken(),
      submittedAt: new Date().toISOString()
    };

    return this.http.post<ApiResponse<TimeEntry[]>>(endpoint, payload, this.getHttpOptions())
      .pipe(
        map(response => this.handleApiResponse(response)),
        catchError(error => this.handleError('bulkSubmitTimeEntries', error))
      );
  }

  /**
   * Export time entries to various formats
   * GET /export/{format}/{userId}/by-date-range/{startDate}/{endDate}
   */
  exportTimeEntries(
    format: 'excel' | 'csv' | 'pdf',
    userId: string,
    startDate: Date,
    endDate: Date
  ): Observable<Blob> {
    const endpoint = `${this.baseUrl}/export/${format}/${userId}/by-date-range/${this.formatDateForApi(startDate)}/${this.formatDateForApi(endDate)}`;

    return this.http.get(endpoint, {
      ...this.getHttpOptions(),
      responseType: 'blob'
    }).pipe(
      catchError(error => this.handleError('exportTimeEntries', error))
    );
  }

  // ===== UTILITY METHODS =====

  /**
   * Check API health
   * GET /health
   */
  checkHealth(): Observable<{ status: string; timestamp: string }> {
    const endpoint = `${this.baseUrl}/health`;

    return this.http.get<{ status: string; timestamp: string }>(endpoint)
      .pipe(
        catchError(error => this.handleError('checkHealth', error))
      );
  }

  // ===== PRIVATE HELPER METHODS =====

  private getHttpOptions() {
    const token = this.tokenService.getAccessToken();
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    });

    return { headers };
  }

  private handleApiResponse<T>(response: ApiResponse<T>): T {
    if (response.success && response.data !== undefined) {
      return response.data;
    }
    
    throw new Error(response.message || 'API request failed');
  }

  private handleError(operation: string, error: any): Observable<never> {
    console.error(`${operation} failed:`, error);
    
    let errorMessage = 'An unexpected error occurred';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    } else if (error.status) {
      switch (error.status) {
        case 400:
          errorMessage = 'Bad request - please check your input';
          break;
        case 401:
          errorMessage = 'Unauthorized - please log in again';
          break;
        case 403:
          errorMessage = 'Forbidden - you don\'t have permission for this action';
          break;
        case 404:
          errorMessage = 'Resource not found';
          break;
        case 500:
          errorMessage = 'Server error - please try again later';
          break;
        default:
          errorMessage = `HTTP Error ${error.status}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  }

  private formatDateForApi(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  private isAdmin(): boolean {
    return this.tokenService.getRoleFromToken() === 'admin';
  }
}
