import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

import { TimeEntry } from '../interfaces/time-entry.interface';
import { ApiResponse } from '../interfaces/api.interface';
import { API_CONFIG } from '../config/api.config';
import mockData from '../../assets/mock-data.json';

const mockTimeEntries: TimeEntry[] = mockData.timeEntries.map(entry => ({
  ...entry,
  date: new Date(entry.date),
  createdAt: new Date(entry.createdAt),
  updatedAt: new Date(entry.updatedAt)
}));

export const mockDataInterceptorFn: HttpInterceptorFn = (req, next) => {
  console.log('🔍 Functional Interceptor called for:', req.method, req.url);
  console.log('🔍 API_CONFIG.ENABLE_MOCK_DATA:', API_CONFIG.ENABLE_MOCK_DATA);
  
  const isApi = isApiCall(req.url);
  console.log('🔍 Is API call:', isApi);
  
  // Only intercept if mock data is enabled and it's an API call
  if (!API_CONFIG.ENABLE_MOCK_DATA || !isApi) {
    console.log('⏭️ Passing through to real HTTP');
    return next(req);
  }

  console.log('🔄 Mock Interceptor - Intercepting:', req.method, req.url);
  return handleMockRequest(req);
};

function isApiCall(url: string): boolean {
  console.log('🔍 Checking URL:', url);
  
  // More explicit URL checking
  const patterns = [
    '/api/',
    '/api/time-entries',
    'time-entries',
    '/time-entries'
  ];
  
  const matches = patterns.some(pattern => url.includes(pattern));
  console.log('🔍 URL matches API patterns:', matches);
  
  return matches;
}

function handleMockRequest(req: any): Observable<any> {
  const { method, url } = req;
  let mockResponse: ApiResponse<any>;

  try {
    if (url.includes('time-entries')) {
      mockResponse = handleTimeEntriesRequest(method, req.params);
    } else {
      mockResponse = createErrorResponse('Endpoint not found', 404);
    }
  } catch (error) {
    mockResponse = createErrorResponse('Internal server error', 500);
  }

  const httpResponse = new HttpResponse({
    status: mockResponse.success ? 200 : 400,
    statusText: mockResponse.success ? 'OK' : 'Bad Request',
    body: mockResponse
  });

  // Simulate network delay
  return of(httpResponse).pipe(delay(500));
}

function handleTimeEntriesRequest(method: string, params: any): ApiResponse<any> {
  console.log('🔄 Handling time entries request:', method);
  
  if (method === 'GET') {
    const page = parseInt(params.get('page') || '1', 10);
    const pageSize = parseInt(params.get('pageSize') || '10', 10);
    
    console.log('📄 Pagination:', { page, pageSize });
    
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedEntries = mockTimeEntries.slice(startIndex, endIndex);

    console.log('📄 Returning entries:', paginatedEntries.length);

    return createSuccessResponse({
      data: paginatedEntries,
      total: mockTimeEntries.length,
      page,
      pageSize
    });
  }

  return createErrorResponse('Method not implemented in mock', 501);
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
