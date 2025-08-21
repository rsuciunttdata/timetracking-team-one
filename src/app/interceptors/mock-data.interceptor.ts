import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay, catchError } from 'rxjs/operators';

import { TimeEntry, EntryStatus } from '../interfaces/time-entry.interface';
import { ApiResponse } from '../interfaces/api.interface';
import { API_CONFIG } from '../config/api.config';
import mockData from '../../assets/mock-data.json';

/**
 * FALLBACK MODE (MOCK_AS_FALLBACK_ONLY = true): Try real requests first, fallback to mock
 * IMMEDIATE MODE (MOCK_AS_FALLBACK_ONLY = false): Intercept immediately with mock data
 */

let mockTimeEntries: TimeEntry[] = mockData.timeEntries.map(entry => ({
  ...entry,
  date: new Date(entry.date),
  createdAt: new Date(entry.createdAt),
  updatedAt: new Date(entry.updatedAt),
  status: (entry.status ?? 'completed_unsent') as EntryStatus
}));

export const mockDataInterceptorFn: HttpInterceptorFn = (req, next) => {
  // Only intercept API calls to our mock domain when mock is enabled
  const isMockApiCall = req.url.includes(API_CONFIG.BASE_URL) && API_CONFIG.ENABLE_MOCK_DATA;

  if (!isMockApiCall) {
    return next(req);
  }

  if (API_CONFIG.MOCK_AS_FALLBACK_ONLY) {
    // Try real request first, fallback to mock on failure
    return next(req).pipe(
      catchError((error: any) => {
        console.log('🔄 Real request failed, using mock data for:', req.url);
        return handleMockRequest(req);
      })
    );
  } else {
    // Intercept immediately with mock data
    console.log('🎯 Using mock data for:', req.url);
    return handleMockRequest(req);
  }
};

function handleMockRequest(req: any): Observable<any> {
  try {
    const response = routeRequest(req);
    
    return of(new HttpResponse({
      status: response.success ? 200 : 400,
      statusText: response.success ? 'OK' : 'Error',
      body: response
    })).pipe(delay(200)); // Realistic delay
    
  } catch (error) {
    console.error('Mock request error:', error);
    return of(new HttpResponse({
      status: 500,
      statusText: 'Internal Server Error',
      body: createErrorResponse('Internal server error', 500)
    }));
  }
}

function routeRequest(req: any): ApiResponse<any> {
  const { method, url } = req;
  
  // Route based on URL patterns (simplified)
  if (url.includes('/monthly/by-date/') || url.includes('/weekly/by-date/')) {
    return handleUserTimeEntries(req);
  }
  
  if (url.includes('/daily/by-date/')) {
    return handleDailyTimeEntries(req);
  }
  
  if (url.includes('/admin/')) {
    return handleAdminRequests(req);
  }
  
  if (url.includes('/time-entries')) {
    return handleTimeEntriesRequest(req);
  }
  
  if (url.includes('/health')) {
    return createSuccessResponse({ status: 'healthy', timestamp: new Date().toISOString() });
  }
  
  return createErrorResponse('Endpoint not found', 404);
}

// ===== CORE HANDLERS =====

function handleUserTimeEntries(req: any): ApiResponse<any> {
  if (req.method !== 'GET') {
    return createErrorResponse(`Method ${req.method} not supported`, 405);
  }

  const currentUserId = getCurrentUserId();
  if (!currentUserId) {
    return createErrorResponse('User not authenticated', 401);
  }

  // Extract requested userId from URL if present
  const urlParts = req.url.split('/');
  const requestedUserId = urlParts.find((part: string, index: number) => 
    urlParts[index + 1] === 'monthly' || urlParts[index + 1] === 'weekly'
  );

  // Validate permissions
  if (!isAdmin() && requestedUserId !== currentUserId) {
    return createErrorResponse('Access denied', 403);
  }

  const userEntries = mockTimeEntries.filter(entry => 
    entry.userId === (requestedUserId || currentUserId)
  );
  
  return createSuccessResponse(userEntries);
}

function handleDailyTimeEntries(req: any): ApiResponse<any> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) {
    return createErrorResponse('User not authenticated', 401);
  }

  const userEntries = mockTimeEntries.filter(entry => entry.userId === currentUserId);
  
  switch (req.method) {
    case 'GET':
      return createSuccessResponse(userEntries[0] || null);
    case 'POST':
      return handleCreateEntry(req);
    case 'PATCH':
      return handleUpdateEntry(req);
    case 'DELETE':
      return handleDeleteEntry(req);
    default:
      return createErrorResponse(`Method ${req.method} not supported`, 405);
  }
}

function handleTimeEntriesRequest(req: any): ApiResponse<any> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) {
    return createErrorResponse('User not authenticated', 401);
  }

  switch (req.method) {
    case 'GET':
      return handleGetEntries(req);
    case 'POST':
      return handleCreateEntry(req);
    case 'PUT':
      return handleUpdateEntry(req);
    case 'DELETE':
      return handleDeleteEntry(req);
    default:
      return createErrorResponse(`Method ${req.method} not supported`, 405);
  }
}

function handleAdminRequests(req: any): ApiResponse<any> {
  if (!isAdmin()) {
    return createErrorResponse('Admin access required', 403);
  }

  if (req.url.includes('/daily/by-date/')) {
    return createSuccessResponse(mockTimeEntries); // All entries for admin
  }

  return createErrorResponse('Admin endpoint not implemented', 404);
}

// ===== CRUD OPERATIONS =====

function handleGetEntries(req: any): ApiResponse<any> {
  const currentUserId = getCurrentUserId()!;
  const userEntries = isAdmin() 
    ? mockTimeEntries 
    : mockTimeEntries.filter(entry => entry.userId === currentUserId);

  // Simple pagination
  const page = parseInt(getUrlParam(req.url, 'page') || '1');
  const pageSize = parseInt(getUrlParam(req.url, 'pageSize') || '10');
  const startIndex = (page - 1) * pageSize;
  const paginatedEntries = userEntries.slice(startIndex, startIndex + pageSize);

  return createSuccessResponse({
    data: paginatedEntries,
    total: userEntries.length,
    page,
    pageSize
  });
}

function handleCreateEntry(req: any): ApiResponse<TimeEntry> {
  const requestData = req.body;
  const currentUserId = getCurrentUserId()!;

  if (!requestData.startTime) {
    return createErrorResponse('Missing required field: startTime', 400);
  }

  const newEntry: TimeEntry = {
    id: generateId(),
    userId: requestData.userId || currentUserId,
    date: new Date(requestData.date || new Date()),
    startTime: requestData.startTime,
    endTime: requestData.endTime || '',
    breakDuration: requestData.breakDuration || 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: calculateStatus(requestData.startTime, requestData.endTime, requestData.breakDuration)
  };

  mockTimeEntries.push(newEntry);
  return createSuccessResponse(newEntry);
}

function handleUpdateEntry(req: any): ApiResponse<TimeEntry> {
  const requestData = req.body;
  const entryId = requestData.id || getIdFromUrl(req.url);
  
  if (!entryId) {
    return createErrorResponse('Entry ID required', 400);
  }

  const entryIndex = mockTimeEntries.findIndex(e => e.id === entryId);
  if (entryIndex === -1) {
    return createErrorResponse('Entry not found', 404);
  }

  const existingEntry = mockTimeEntries[entryIndex];
  
  // Validate permissions
  if (!isAdmin() && existingEntry.userId !== getCurrentUserId()) {
    return createErrorResponse('Access denied', 403);
  }

  // Update entry
  const updatedEntry = {
    ...existingEntry,
    ...requestData,
    id: existingEntry.id, // Preserve ID
    updatedAt: new Date(),
    status: calculateStatus(
      requestData.startTime || existingEntry.startTime,
      requestData.endTime || existingEntry.endTime,
      requestData.breakDuration || existingEntry.breakDuration
    )
  };

  mockTimeEntries[entryIndex] = updatedEntry;
  return createSuccessResponse(updatedEntry);
}

function handleDeleteEntry(req: any): ApiResponse<any> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) {
    return createErrorResponse('User not authenticated', 401);
  }
  if (req.url.includes('/by-date/')) {
    const urlParts = req.url.split('/');
    const dateIndex = urlParts.findIndex((part: string) => part === 'by-date') + 1;
    const dateString = urlParts[dateIndex];
    
    if (!dateString) {
      return createErrorResponse('Date required for daily delete', 400);
    }

    // Find entry by date and current user
    const entryIndex = mockTimeEntries.findIndex(e => {
      const entryDate = e.date.toISOString().split('T')[0];
      return entryDate === dateString && e.userId === currentUserId;
    });

    if (entryIndex === -1) {
      return createErrorResponse('No entry found for this date', 404);
    }

    const deletedEntry = mockTimeEntries[entryIndex];
    mockTimeEntries.splice(entryIndex, 1);
    
    console.log('🗑️ Deleted entry by date:', { id: deletedEntry.id, date: dateString });
    return createSuccessResponse({ message: 'Entry deleted successfully', deletedId: deletedEntry.id });
  }
  
  // For regular time-entries endpoint, delete by ID
  const entryId = getIdFromUrl(req.url);
  
  if (!entryId) {
    return createErrorResponse('Entry ID required', 400);
  }

  const entryIndex = mockTimeEntries.findIndex(e => e.id === entryId);
  if (entryIndex === -1) {
    return createErrorResponse('Entry not found', 404);
  }

  const existingEntry = mockTimeEntries[entryIndex];
  
  // Validate permissions
  if (!isAdmin() && existingEntry.userId !== currentUserId) {
    return createErrorResponse('Access denied', 403);
  }

  mockTimeEntries.splice(entryIndex, 1);
  return createSuccessResponse({ message: 'Entry deleted successfully' });
}

// ===== UTILITY FUNCTIONS =====

function getCurrentUserId(): string | null {
  return localStorage.getItem('userId');
}

function isAdmin(): boolean {
  return localStorage.getItem('role') === 'admin';
}

function getIdFromUrl(url: string): string | null {
  const parts = url.split('/');
  const lastPart = parts[parts.length - 1];
  return lastPart && !lastPart.includes('?') ? lastPart : null;
}

function getUrlParam(url: string, param: string): string | null {
  const urlParams = new URLSearchParams(url.split('?')[1] || '');
  return urlParams.get(param);
}

function generateId(): string {
  return 'entry-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
}

function calculateStatus(startTime: string, endTime?: string, breakDuration?: number): EntryStatus {
  if (!startTime || !endTime) return 'completed_partially';
  
  const parseTime = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const workedMinutes = parseTime(endTime) - parseTime(startTime) - (breakDuration || 0);
  return workedMinutes >= 480 ? 'completed_unsent' : 'completed_partially'; // 8 hours = 480 minutes
}

function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return { success: true, data, message: 'Success' };
}

function createErrorResponse(message: string, statusCode: number): ApiResponse<any> {
  return {
    success: false,
    data: null,
    message,
    errors: [{ code: statusCode.toString(), message }]
  };
}
