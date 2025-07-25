import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

import { TimeEntry, CreateTimeEntryRequest, UpdateTimeEntryRequest } from '../interfaces/time-entry.interface';
import { ApiResponse } from '../interfaces/api.interface';
import { API_CONFIG } from '../config/api.config';
import mockData from '../../assets/mock-data.json';

let mockTimeEntries: TimeEntry[] = mockData.timeEntries.map(entry => ({
  ...entry,
  date: new Date(entry.date),
  createdAt: new Date(entry.createdAt),
  updatedAt: new Date(entry.updatedAt)
}));

export const mockDataInterceptorFn: HttpInterceptorFn = (req, next) => {
  console.log('🔍 Functional Interceptor called for:', req.method, req.url);
  console.log('🔍 API_CONFIG.ENABLE_MOCK_DATA:', API_CONFIG.ENABLE_MOCK_DATA);
  
  const isTimeEntriesCall = req.url.includes(API_CONFIG.ENDPOINTS.TIME_ENTRIES);
  console.log('🔍 Is API call:', isTimeEntriesCall);
  
  // Only intercept if mock data is enabled and it's an API call
  if (!API_CONFIG.ENABLE_MOCK_DATA || !isTimeEntriesCall) {
    console.log('⏭️ Passing through to other intercptor or real HTTP');
    return next(req);
  }

  console.log('🔄 Mock Interceptor - Intercepting:', req.method, req.url);
  return handleMockRequest(req);
};

function handleMockRequest(req: any): Observable<any> {
  const { method, url } = req;
  let mockResponse: ApiResponse<any>;

  try {
      mockResponse = handleTimeEntriesRequest(method, req);
  } catch (error) {
    console.error('Mock request error:', error);
    mockResponse = createErrorResponse('Internal server error', 500);
  }

  const httpResponse = new HttpResponse({
    status: mockResponse.success ? 200 : (mockResponse.errors?.[0]?.code === '404' ? 404 : 400),
    statusText: mockResponse.success ? 'OK' : 'Error',
    body: mockResponse
  });

  // Simulate network delay
  return of(httpResponse).pipe(delay(300));
}

function handleTimeEntriesRequest(method: string, req: any): ApiResponse<any> {
  console.log('🔄 Handling time entries request:', method, req.url);
  
  switch (method) {
    case 'GET':
      return handleGetTimeEntries(req);
    case 'POST':
      return handleCreateTimeEntry(req);
    case 'PUT':
      return handleUpdateTimeEntry(req);
    case 'DELETE':
      return handleDeleteTimeEntry(req);
    default:
      return createErrorResponse(`Method ${method} not implemented in mock`, 501);
  }
}

function handleGetTimeEntries(req: any): ApiResponse<any> {
  console.log('📄 GET time entries');
  
  // Check if URL has ID in path
  const url = req.url || '';
  const urlParts = url.split('/');
  const lastPart = urlParts[urlParts.length - 1];
  
  // If looks like an ID (not a query param), it's a single entry request
  if (lastPart && !lastPart.includes('?') && lastPart !== 'time-entries') {
    const entryId = lastPart;
    const entry = mockTimeEntries.find(e => e.id === entryId);
    
    if (!entry) {
      return createErrorResponse('Time entry not found', 404);
    }
    
    // Validate user permissions for single entry access
    const currentUserId = localStorage.getItem('userId');
    const currentUserRole = localStorage.getItem('role');
    
    // Allow admin to access any entry, or user to access their own entry
    if (currentUserRole !== 'admin' && entry.userId !== currentUserId) {
      return createErrorResponse('Access denied: You can only view your own time entries', 403);
    }
    
    console.log('📄 Returning single entry:', entryId);
    return createSuccessResponse(entry);
  }
  
  // Otherwise handle paginated list
  const params = req.params || new URLSearchParams(url.split('?')[1] || '');
  const page = parseInt(params.get('page') || '1', 10);
  const pageSize = parseInt(params.get('pageSize') || '10', 10);
  const requestedUserId = params.get('userId');
  
  // Get current user context from localStorage
  const currentUserId = localStorage.getItem('userId');
  const currentUserRole = localStorage.getItem('role');
  
  console.log('📄 User context:', { currentUserId, currentUserRole, requestedUserId });
  console.log('📄 Pagination:', { page, pageSize });
  
  // Filter entries based on user permissions
  let filteredEntries = mockTimeEntries;
  
  if (currentUserRole === 'admin') {
    // Admin can see all entries or filter by specific user
    if (requestedUserId) {
      filteredEntries = mockTimeEntries.filter(entry => entry.userId === requestedUserId);
      console.log('📄 Admin filtering by user:', requestedUserId);
    } else {
      console.log('📄 Admin viewing all entries');
    }
  } else {
    // Regular users can only see their own entries
    if (currentUserId) {
      filteredEntries = mockTimeEntries.filter(entry => entry.userId === currentUserId);
      console.log('📄 User viewing own entries:', currentUserId);
    } else {
      console.log('📄 No user authenticated, returning empty');
      filteredEntries = [];
    }
  }
  
  // Apply pagination to filtered entries
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedEntries = filteredEntries.slice(startIndex, endIndex);

  console.log('📄 Returning entries:', paginatedEntries.length, 'of', filteredEntries.length, 'total filtered');

  // Return the correct TimeEntryResponse structure
  const timeEntryResponse = {
    data: paginatedEntries,
    total: filteredEntries.length, // Total of filtered entries, not all entries
    page,
    pageSize
  };

  return createSuccessResponse(timeEntryResponse);
}

function handleCreateTimeEntry(req: any): ApiResponse<TimeEntry> {
  console.log('➕ CREATE time entry');
  
  const requestData: CreateTimeEntryRequest = req.body;
  const currentUserId = localStorage.getItem('userId');
  const currentUserRole = localStorage.getItem('role');
  
  // Validate required fields
  if (!requestData.userId || !requestData.date || !requestData.startTime || 
      !requestData.endTime || !requestData.breakDuration) {
    return createErrorResponse('Missing required fields', 400);
  }
  
  // Validate user permissions
  if (currentUserRole !== 'admin' && requestData.userId !== currentUserId) {
    return createErrorResponse('Access denied: You can only create entries for yourself', 403);
  }
  
  // Create new entry with generated ID
  const newEntry: TimeEntry = {
    id: generateId(),
    userId: requestData.userId,
    date: new Date(requestData.date),
    startTime: requestData.startTime,
    endTime: requestData.endTime,
    breakDuration: requestData.breakDuration,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  // Add to mock data
  mockTimeEntries.push(newEntry);
  
  console.log('➕ Created entry:', newEntry.id);
  return createSuccessResponse(newEntry);
}

function handleUpdateTimeEntry(req: any): ApiResponse<TimeEntry> {
  console.log('✏️ UPDATE time entry');
  
  const requestData: UpdateTimeEntryRequest = req.body;
  const currentUserId = localStorage.getItem('userId');
  const currentUserRole = localStorage.getItem('role');
  
  if (!requestData.id) {
    return createErrorResponse('Entry ID is required for update', 400);
  }
  
  const entryIndex = mockTimeEntries.findIndex(e => e.id === requestData.id);
  
  if (entryIndex === -1) {
    return createErrorResponse('Time entry not found', 404);
  }
  
  const existingEntry = mockTimeEntries[entryIndex];
  
  // Validate user permissions
  if (currentUserRole !== 'admin' && existingEntry.userId !== currentUserId) {
    return createErrorResponse('Access denied: You can only update your own time entries', 403);
  }
  
  // Update the entry
  const updatedEntry: TimeEntry = {
    ...existingEntry,
    userId: requestData.userId || existingEntry.userId,
    date: requestData.date ? new Date(requestData.date) : existingEntry.date,
    startTime: requestData.startTime || existingEntry.startTime,
    endTime: requestData.endTime || existingEntry.endTime,
    breakDuration: requestData.breakDuration || existingEntry.breakDuration,
    updatedAt: new Date()
  };
  
  mockTimeEntries[entryIndex] = updatedEntry;
  
  console.log('✏️ Updated entry:', updatedEntry.id);
  return createSuccessResponse(updatedEntry);
}

function handleDeleteTimeEntry(req: any): ApiResponse<void> {
  console.log('🗑️ DELETE time entry');
  
  const currentUserId = localStorage.getItem('userId');
  const currentUserRole = localStorage.getItem('role');
  
  // Extract ID from URL
  const url = req.url || '';
  const urlParts = url.split('/');
  const entryId = urlParts[urlParts.length - 1];
  
  if (!entryId || entryId === 'time-entries') {
    return createErrorResponse('Entry ID is required for deletion', 400);
  }
  
  const entryIndex = mockTimeEntries.findIndex(e => e.id === entryId);
  
  if (entryIndex === -1) {
    return createErrorResponse('Time entry not found', 404);
  }
  
  const existingEntry = mockTimeEntries[entryIndex];
  
  // Validate user permissions
  if (currentUserRole !== 'admin' && existingEntry.userId !== currentUserId) {
    return createErrorResponse('Access denied: You can only delete your own time entries', 403);
  }
  
  // Remove the entry
  mockTimeEntries.splice(entryIndex, 1);
  
  console.log('🗑️ Deleted entry:', entryId);
  return createSuccessResponse(undefined as any);
}

function generateId(): string {
  return 'entry-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    message: 'Operation completed successfully'
  };
}

function createErrorResponse(message: string, statusCode: number): ApiResponse<any> {
  return {
    success: false,
    data: null,
    message,
    errors: [{
      code: statusCode.toString(),
      message
    }]
  };
}