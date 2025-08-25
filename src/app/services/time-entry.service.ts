import { Injectable } from '@angular/core';
import { Observable, of, throwError, combineLatest } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

import {
  TimeEntry,
  TimeEntryResponse,
  CreateTimeEntryRequest,
  UpdateTimeEntryRequest,
  TimeEntryFilter
} from '../interfaces/time-entry.interface';
import { PaginationRequest } from '../interfaces/api.interface';
import { BackendApiService } from './backend-api.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class TimeEntryService {

  constructor(
    private backendApiService: BackendApiService,
    private authService: AuthService
  ) { }

  /**
   * Get time entries for the current logged-in user with date range filtering
   */
  getUserTimeEntries(
    pagination: PaginationRequest,
    filter?: Omit<TimeEntryFilter, 'userId'>
  ): Observable<TimeEntryResponse> {
    if (!this.getCurrentUserId()) {
      throw new Error('User not authenticated');
    }

    const targetDate = filter?.startDate || new Date();
    
    return this.getUserMonthlyTimeEntries(targetDate).pipe(
      map((entries: TimeEntry[]) => {
        // Filter by date range if provided
        let filteredEntries = entries;
        
        if (filter?.startDate && filter.endDate) {
          filteredEntries = entries.filter(entry => {
            const entryDate = new Date(entry.date);
            return entryDate >= filter.startDate! && entryDate <= filter.endDate!;
          });
        }

        // Apply client-side pagination
        const startIndex = (pagination.page - 1) * pagination.pageSize;
        const endIndex = startIndex + pagination.pageSize;
        const paginatedEntries = filteredEntries.slice(startIndex, endIndex);

        return {
          data: paginatedEntries,
          total: filteredEntries.length,
          page: pagination.page,
          pageSize: pagination.pageSize
        } as TimeEntryResponse;
      })
    );
  }

  /**
   * Get all time entries with optional user filtering (for admin use)
   */
  getAllTimeEntries(
    pagination: PaginationRequest,
    filter?: TimeEntryFilter
  ): Observable<TimeEntryResponse> {
    if (!this.isAdmin()) {
      throw new Error('Access denied: Admin privileges required');
    }
    const targetDate = filter?.startDate || new Date();
    
    return this.backendApiService.getAdminDailyTimeEntries(targetDate).pipe(
      map((entries: TimeEntry[]) => {
        // Filter by user if provided
        let filteredEntries = entries;
        
        if (filter?.userId) {
          filteredEntries = entries.filter(entry => entry.userId === filter.userId);
        }

        // Apply date range filter if provided
        if (filter?.startDate && filter.endDate) {
          filteredEntries = filteredEntries.filter(entry => {
            const entryDate = new Date(entry.date);
            return entryDate >= filter.startDate! && entryDate <= filter.endDate!;
          });
        }

        // Apply client-side pagination
        const startIndex = (pagination.page - 1) * pagination.pageSize;
        const endIndex = startIndex + pagination.pageSize;
        const paginatedEntries = filteredEntries.slice(startIndex, endIndex);

        return {
          data: paginatedEntries,
          total: filteredEntries.length,
          page: pagination.page,
          pageSize: pagination.pageSize
        } as TimeEntryResponse;
      })
    );
  }

  /**
   * Get time entries for the current logged-in user for a specific month
   */
  getTimeEntries(
    pagination: PaginationRequest,
    filter?: TimeEntryFilter
  ): Observable<TimeEntryResponse> {
    // Delegate to appropriate method based on user role
    if (this.isAdmin() && filter?.userId) {
      return this.getAllTimeEntries(pagination, filter);
    } else {
      return this.getUserTimeEntries(pagination, filter);
    }
  }

  /**
   * Get a single time entry by ID
   */
  getTimeEntry(id: string): Observable<TimeEntry> {
    const currentDate = new Date();
    
    return this.getUserMonthlyTimeEntries(currentDate).pipe(
      map((entries: TimeEntry[]) => {
        const entry = entries.find(e => e.id === id);
        if (!entry) {
          throw new Error('Time entry not found');
        }
        return entry;
      }),
      catchError(() => throwError(() => new Error('Time entry not found')))
    );
  }

  /**
   * Create a new time entry (automatically assigns to current user)
   */
  createTimeEntry(timeEntry: Omit<CreateTimeEntryRequest, 'userId'>): Observable<TimeEntry> {
    const currentUserId = this.getCurrentUserId();
    if (!currentUserId) {
      throw new Error('User not authenticated');
    }

    return this.backendApiService.createDailyTimeEntry(timeEntry.date, {
      startTime: timeEntry.startTime,
      endTime: timeEntry.endTime,
      breakDuration: timeEntry.breakDuration
    });
  }

  /**
   * Create a time entry for a specific user (admin only)
   */
  createTimeEntryForUser(timeEntry: CreateTimeEntryRequest): Observable<TimeEntry> {
    if (!this.isAdmin()) {
      throw new Error('Access denied: Admin privileges required');
    }

    return this.backendApiService.createDailyTimeEntry(timeEntry.date, {
      startTime: timeEntry.startTime,
      endTime: timeEntry.endTime,
      breakDuration: timeEntry.breakDuration
    });
  }

  /**
   * Update an existing time entry (with ownership validation)
   */
  updateTimeEntry(timeEntry: UpdateTimeEntryRequest): Observable<TimeEntry> {
    if (!timeEntry?.id) {
      throw new Error('Invalid time entry: missing ID');
    }

    return this.getTimeEntry(timeEntry.id).pipe(
      switchMap((existingEntry: TimeEntry | null) => {
        if (!existingEntry) {
          throw new Error('Time entry not found');
        }

        if (!this.isAdmin() && existingEntry.userId !== this.getCurrentUserId()) {
          throw new Error('Access denied: You can only update your own time entries');
        }

        const targetDate = timeEntry.date || existingEntry.date;
        return this.backendApiService.updateDailyTimeEntry(targetDate, {
          id: timeEntry.id,
          userId: timeEntry.userId,
          startTime: timeEntry.startTime,
          endTime: timeEntry.endTime,
          breakDuration: timeEntry.breakDuration
        });
      })
    );
  }

  /**
   * Delete a time entry (with ownership validation)
   */
  deleteTimeEntry(id: string): Observable<void> {
    return this.getTimeEntry(id).pipe(
      switchMap((existingEntry: TimeEntry) => {

        // Allow admin to delete any entry, or user to delete their own entry
        if (!this.isAdmin() && existingEntry.userId !== this.getCurrentUserId()) {
          throw new Error('Access denied: You can only delete your own time entries');
        }
        return this.backendApiService.deleteDailyTimeEntry(existingEntry.date);
      })
    );
  }

  /**
   * Get user context helper methods
   */
  private getCurrentUserId(): string | null {
    const userId = this.authService.getUserId();
    return userId;
  }

  private getCurrentUserRole(): string | null {
    const role = this.authService.getUserRole();
    return role;
  }

  private isAdmin(): boolean {
    const isAdmin = this.getCurrentUserRole() === 'admin';
    return isAdmin;
  }

  // ===== BACKEND API METHODS =====

  /**
   * Get daily time entry for a specific date
   */
  getDailyTimeEntry(date: Date): Observable<TimeEntry | null> {
    return this.backendApiService.getDailyTimeEntry(date);
  }

  /**
   * Create daily time entry for a specific date
   */
  createDailyTimeEntry(date: Date, timeEntry: Omit<CreateTimeEntryRequest, 'userId' | 'date'>): Observable<TimeEntry> {
    return this.backendApiService.createDailyTimeEntry(date, timeEntry);
  }

  /**
   * Update daily time entry for a specific date
   */
  updateDailyTimeEntry(date: Date, timeEntry: Partial<UpdateTimeEntryRequest>): Observable<TimeEntry> {
    return this.backendApiService.updateDailyTimeEntry(date, timeEntry);
  }

  /**
   * Delete daily time entry for a specific date
   */
  deleteDailyTimeEntry(date: Date): Observable<void> {
    return this.backendApiService.deleteDailyTimeEntry(date);
  }

  /**
   * Get user's monthly time entries
   */
  getUserMonthlyTimeEntries(date: Date): Observable<TimeEntry[]> {
    return this.backendApiService.getCurrentUserMonthlyTimeEntries(date);
  }

  /**
   * Get user's weekly time entries
   */
  getUserWeeklyTimeEntries(date: Date): Observable<TimeEntry[]> {
    return this.backendApiService.getCurrentUserWeeklyTimeEntries(date);
  }

  /**
   * Approve time entry (admin only)
   */
  approveTimeEntry(entryId: string): Observable<TimeEntry> {
    return this.backendApiService.approveTimeEntry(entryId);
  }

  /**
   * Reject time entry (admin only)
   */
  rejectTimeEntry(entryId: string, reason?: string): Observable<TimeEntry> {
    return this.backendApiService.rejectTimeEntry(entryId, reason);
  }

  /**
   * Submit multiple time entries for approval
   */
  bulkSubmitTimeEntries(entryIds: string[]): Observable<TimeEntry[]> {
    return this.backendApiService.bulkSubmitTimeEntries(entryIds);
  }

  // ===== CONVENIENCE METHODS =====

  /**
   * Create or update a time entry for a specific date
   */
  createOrUpdateDailyEntry(date: Date, timeEntry: Omit<CreateTimeEntryRequest, 'userId' | 'date'>): Observable<TimeEntry> {
    return this.getDailyTimeEntry(date).pipe(
      switchMap((existingEntry: TimeEntry | null) => {
        if (existingEntry) {
          // Update existing entry
          return this.updateDailyTimeEntry(date, {
            id: existingEntry.id,
            startTime: timeEntry.startTime,
            endTime: timeEntry.endTime,
            breakDuration: timeEntry.breakDuration
          });
        } else {
          // Create new entry
          return this.createDailyTimeEntry(date, timeEntry);
        }
      })
    );
  }

  /**
   * Get time entries for a date range
   */
  getTimeEntriesInDateRange(startDate: Date, endDate: Date): Observable<TimeEntry[]> {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) {
      // Single day: use daily endpoint
      return this.backendApiService.getDailyTimeEntry(startDate).pipe(
        map(entry => entry ? [entry] : [])
      );
    } else if (diffDays <= 7) {
      // Weekly range: use weekly endpoint and filter
      return this.backendApiService.getCurrentUserWeeklyTimeEntries(startDate).pipe(
        map(entries => this.filterEntriesByDateRange(entries, startDate, endDate))
      );
    } else if (diffDays <= 31 && this.isSameMonth(startDate, endDate)) {
      // Monthly range in same month: use monthly endpoint and filter
      return this.backendApiService.getCurrentUserMonthlyTimeEntries(startDate).pipe(
        map(entries => this.filterEntriesByDateRange(entries, startDate, endDate))
      );
    } else {
      // Complex ranges: use multi-month strategy
      return this.getTimeEntriesInMultiMonthRange(startDate, endDate);
    }
  }
  
  /**
   * Check if two dates are in the same month
   */
  private isSameMonth(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() && 
           date1.getMonth() === date2.getMonth();
  }

  /**
   * Enhanced method to get user time entries with intelligent date range handling
   */
  getUserTimeEntriesOptimized(
    pagination: PaginationRequest,
    filter?: Omit<TimeEntryFilter, 'userId'>
  ): Observable<TimeEntryResponse> {
    if (!this.getCurrentUserId()) {
      throw new Error('User not authenticated');
    }

    // If no date range specified, use monthly data as before
    if (!filter?.startDate || !filter?.endDate) {
      return this.getUserTimeEntries(pagination, filter);
    }

    // Use optimized date range fetching
    return this.getTimeEntriesInDateRange(filter.startDate, filter.endDate).pipe(
      map((entries: TimeEntry[]) => {
        // Apply client-side pagination
        const startIndex = (pagination.page - 1) * pagination.pageSize;
        const endIndex = startIndex + pagination.pageSize;
        const paginatedEntries = entries.slice(startIndex, endIndex);

        return {
          data: paginatedEntries,
          total: entries.length,
          page: pagination.page,
          pageSize: pagination.pageSize
        } as TimeEntryResponse;
      })
    );
  }

  /**
   * Private helper to handle multi-month date ranges
   */
  private getTimeEntriesInMultiMonthRange(startDate: Date, endDate: Date): Observable<TimeEntry[]> {
    const monthlyRequests: Observable<TimeEntry[]>[] = [];
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    // Create requests for each month in the range
    while (current <= end) {
      monthlyRequests.push(
        this.backendApiService.getCurrentUserMonthlyTimeEntries(new Date(current))
      );
      current.setMonth(current.getMonth() + 1);
    }

    // Combine all monthly data and filter by actual date range
    return combineLatest(monthlyRequests).pipe(
      map((monthlyResults: TimeEntry[][]) => {
        const allEntries = monthlyResults.flat();
        return this.filterEntriesByDateRange(allEntries, startDate, endDate);
      })
    );
  }

  /**
   * Private helper to filter entries by date range
   */
  private filterEntriesByDateRange(entries: TimeEntry[], startDate: Date, endDate: Date): TimeEntry[] {
    return entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= startDate && entryDate <= endDate;
    });
  }

  /**
   * Check API health using BackendApiService
   */
  checkApiHealth(): Observable<{ status: string; timestamp: string }> {
    return this.backendApiService.checkHealth();
  }

  /**
   * Export time entries using BackendApiService
   * For now the export service is used
   */
  exportTimeEntries(
    format: 'excel' | 'csv' | 'pdf',
    startDate: Date,
    endDate: Date
  ): Observable<Blob> {
    const currentUserId = this.getCurrentUserId();
    if (!currentUserId) {
      throw new Error('User not authenticated');
    }
    
    return this.backendApiService.exportTimeEntries(format, currentUserId, startDate, endDate);
  }
}
