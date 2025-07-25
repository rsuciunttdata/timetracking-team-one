import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { 
  TimeEntry, 
  TimeEntryResponse, 
  CreateTimeEntryRequest, 
  UpdateTimeEntryRequest,
  TimeEntryFilter
} from '../interfaces/time-entry.interface';
import { ApiResponse, PaginationRequest } from '../interfaces/api.interface';
import { getApiUrl } from '../config/api.config';

@Injectable({
  providedIn: 'root'
})
export class TimeEntryService {
  private readonly baseUrl = getApiUrl('TIME_ENTRIES');

  constructor(private http: HttpClient) {}

  /**
   * Get time entries for the current logged-in user only (optimized for regular users)
   */
  getUserTimeEntries(
    pagination: PaginationRequest, 
    filter?: Omit<TimeEntryFilter, 'userId'>
  ): Observable<TimeEntryResponse> {
    if (!this.getCurrentUserId()) {
      throw new Error('User not authenticated');
    }

    let params = new HttpParams()
      .set('page', pagination.page.toString())
      .set('pageSize', pagination.pageSize.toString())
      .set('userId', this.getCurrentUserId() || ''); // Always filter by current user

    if (pagination.sortBy) {
      params = params.set('sortBy', pagination.sortBy);
    }

    if (pagination.sortOrder) {
      params = params.set('sortOrder', pagination.sortOrder);
    }

    if (filter) {
      if (filter.startDate) {
        params = params.set('startDate', filter.startDate.toISOString());
      }
      if (filter.endDate) {
        params = params.set('endDate', filter.endDate.toISOString());
      }
    }

    return this.http.get<ApiResponse<TimeEntryResponse>>(this.baseUrl, { params })
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Get all time entries with optional user filtering (for admin/employer use)
   */
  getAllTimeEntries(
    pagination: PaginationRequest, 
    filter?: TimeEntryFilter
  ): Observable<TimeEntryResponse> {
    if (!this.isAdmin()) {
      throw new Error('Access denied: Admin privileges required');
    }

    let params = new HttpParams()
      .set('page', pagination.page.toString())
      .set('pageSize', pagination.pageSize.toString());

    if (pagination.sortBy) {
      params = params.set('sortBy', pagination.sortBy);
    }

    if (pagination.sortOrder) {
      params = params.set('sortOrder', pagination.sortOrder);
    }

    if (filter) {
      if (filter.startDate) {
        params = params.set('startDate', filter.startDate.toISOString());
      }
      if (filter.endDate) {
        params = params.set('endDate', filter.endDate.toISOString());
      }
      if (filter.userId) {
        params = params.set('userId', filter.userId);
      }
    }

    return this.http.get<ApiResponse<TimeEntryResponse>>(this.baseUrl, { params })
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Get time entries with pagination and filtering (legacy method - kept for compatibility)
   * @deprecated Use getUserTimeEntries() for regular users or getAllTimeEntries() for admin users
   */
  getTimeEntries(
    pagination: PaginationRequest, 
    filter?: TimeEntryFilter
  ): Observable<TimeEntryResponse> {
    let params = new HttpParams()
      .set('page', pagination.page.toString())
      .set('pageSize', pagination.pageSize.toString());

    if (pagination.sortBy) {
      params = params.set('sortBy', pagination.sortBy);
    }

    if (pagination.sortOrder) {
      params = params.set('sortOrder', pagination.sortOrder);
    }

    if (filter) {
      if (filter.startDate) {
        params = params.set('startDate', filter.startDate.toISOString());
      }
      if (filter.endDate) {
        params = params.set('endDate', filter.endDate.toISOString());
      }
      if (filter.userId) {
        params = params.set('userId', filter.userId);
      }
    }

    return this.http.get<ApiResponse<TimeEntryResponse>>(this.baseUrl, { params })
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Get a single time entry by ID
   */
  getTimeEntry(id: string): Observable<TimeEntry> {
    return this.http.get<ApiResponse<TimeEntry>>(`${this.baseUrl}/${id}`)
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Create a new time entry (automatically assigns to current user)
   */
  createTimeEntry(timeEntry: Omit<CreateTimeEntryRequest, 'userId'>): Observable<TimeEntry> {
    
    if (!this.getCurrentUserId()) {
      throw new Error('User not authenticated');
    }

    const timeEntryWithUser: CreateTimeEntryRequest = {
      ...timeEntry,
      userId: this.getCurrentUserId() || 'current-user' // Fallback for legacy support
    };

    return this.http.post<ApiResponse<TimeEntry>>(this.baseUrl, timeEntryWithUser)
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Create a time entry for a specific user (admin only)
   */
  createTimeEntryForUser(timeEntry: CreateTimeEntryRequest): Observable<TimeEntry> {
    if (!this.isAdmin()) {
      throw new Error('Access denied: Admin privileges required');
    }

    return this.http.post<ApiResponse<TimeEntry>>(this.baseUrl, timeEntry)
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Update an existing time entry (with ownership validation)
   */
  updateTimeEntry(timeEntry: UpdateTimeEntryRequest): Observable<TimeEntry> {
    // First get the entry to validate ownership
    return this.getTimeEntry(timeEntry.id).pipe(
      switchMap((existingEntry: TimeEntry) => {
        
        // Allow admin to update any entry, or user to update their own entry
        if (!this.isAdmin() && existingEntry.userId !== this.getCurrentUserId()) {
          throw new Error('Access denied: You can only update your own time entries');
        }

        return this.http.put<ApiResponse<TimeEntry>>(`${this.baseUrl}/${timeEntry.id}`, timeEntry)
          .pipe(
            map(response => response.data)
          );
      })
    );
  }

  /**
   * Delete a time entry (with ownership validation)
   */
  deleteTimeEntry(id: string): Observable<void> {
    // First get the entry to validate ownership
    return this.getTimeEntry(id).pipe(
      switchMap((existingEntry: TimeEntry) => {
        
        // Allow admin to delete any entry, or user to delete their own entry
        if (!this.isAdmin() && existingEntry.userId !== this.getCurrentUserId()) {
          throw new Error('Access denied: You can only delete your own time entries');
        }

        return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`)
          .pipe(
            map(() => undefined)
          );
      })
    );
  }

  /**
   * Get helper methods for user context
   */
  private getCurrentUserId(): string | null {
    return localStorage.getItem('userId');
  }

  private getCurrentUserRole(): string | null {
    return localStorage.getItem('role');
  }

  private isAdmin(): boolean {
    return this.getCurrentUserRole() === 'admin';
  }
}
