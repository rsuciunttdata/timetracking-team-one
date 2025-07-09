import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

import { TimeEntry } from '../interfaces/time-entry.interface';
import { ApiResponse } from '../interfaces/api.interface';
import { API_CONFIG } from '../config/api.config';

// Mock data
const mockTimeEntries: TimeEntry[] = [
  {
    id: '1',
    userId: 'user1',
    date: new Date('2025-07-01'),
    startTime: '09:00',
    endTime: '17:30',
    breakDuration: '00:30',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    userId: 'user1',
    date: new Date('2025-07-02'),
    startTime: '08:30',
    endTime: '17:00',
    breakDuration: '00:45',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    userId: 'user1',
    date: new Date('2025-07-03'),
    startTime: '09:15',
    endTime: '18:00',
    breakDuration: '01:00',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '4',
    userId: 'user1',
    date: new Date('2025-07-04'),
    startTime: '08:45',
    endTime: '17:15',
    breakDuration: '00:30',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '5',
    userId: 'user1',
    date: new Date('2025-07-07'),
    startTime: '09:00',
    endTime: '18:30',
    breakDuration: '01:15',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '6',
    userId: 'user1',
    date: new Date('2025-07-08'),
    startTime: '08:00',
    endTime: '16:30',
    breakDuration: '00:30',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '7',
    userId: 'user1',
    date: new Date('2025-07-09'),
    startTime: '09:30',
    endTime: '18:00',
    breakDuration: '01:00',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '8',
    userId: 'user1',
    date: new Date('2025-07-10'),
    startTime: '08:15',
    endTime: '17:45',
    breakDuration: '00:45',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '9',
    userId: 'user1',
    date: new Date('2025-07-11'),
    startTime: '09:00',
    endTime: '17:00',
    breakDuration: '01:00',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '10',
    userId: 'user1',
    date: new Date('2025-07-14'),
    startTime: '08:30',
    endTime: '18:15',
    breakDuration: '01:30',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '11',
    userId: 'user1',
    date: new Date('2025-07-15'),
    startTime: '09:45',
    endTime: '17:30',
    breakDuration: '00:45',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '12',
    userId: 'user1',
    date: new Date('2025-07-16'),
    startTime: '08:00',
    endTime: '16:00',
    breakDuration: '00:30',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '13',
    userId: 'user1',
    date: new Date('2025-07-17'),
    startTime: '09:15',
    endTime: '18:45',
    breakDuration: '01:15',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '14',
    userId: 'user1',
    date: new Date('2025-07-18'),
    startTime: '08:30',
    endTime: '17:00',
    breakDuration: '00:30',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '15',
    userId: 'user1',
    date: new Date('2025-07-21'),
    startTime: '09:00',
    endTime: '17:30',
    breakDuration: '01:00',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '16',
    userId: 'user1',
    date: new Date('2025-07-22'),
    startTime: '08:45',
    endTime: '17:15',
    breakDuration: '00:30',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '17',
    userId: 'user1',
    date: new Date('2025-07-23'),
    startTime: '09:20',
    endTime: '18:00',
    breakDuration: '00:40',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '18',
    userId: 'user1',
    date: new Date('2025-07-24'),
    startTime: '08:00',
    endTime: '16:30',
    breakDuration: '00:30',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '19',
    userId: 'user1',
    date: new Date('2025-07-25'),
    startTime: '09:30',
    endTime: '18:30',
    breakDuration: '01:00',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '20',
    userId: 'user1',
    date: new Date('2025-07-28'),
    startTime: '08:15',
    endTime: '17:45',
    breakDuration: '01:15',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

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
