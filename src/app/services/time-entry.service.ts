import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
   * Get time entries with pagination and filtering
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
   * Create a new time entry
   */
  createTimeEntry(timeEntry: CreateTimeEntryRequest): Observable<TimeEntry> {
    return this.http.post<ApiResponse<TimeEntry>>(this.baseUrl, timeEntry)
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Update an existing time entry
   */
  updateTimeEntry(timeEntry: UpdateTimeEntryRequest): Observable<TimeEntry> {
    return this.http.put<ApiResponse<TimeEntry>>(`${this.baseUrl}/${timeEntry.id}`, timeEntry)
      .pipe(
        map(response => response.data)
      );
  }

  /**
   * Delete a time entry
   */
  deleteTimeEntry(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`)
      .pipe(
        map(() => undefined)
      );
  }
}
