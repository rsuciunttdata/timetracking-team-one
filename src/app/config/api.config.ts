//API Configuration
export const API_CONFIG = {
  // Base API URL
  BASE_URL: 'https://your-api-domain.com/api', // TODO: Update with actual API base URL
  
  // API Endpoints
  ENDPOINTS: {
    // Authentication endpoints
    AUTH_LOGIN: '/auth/login',
    AUTH_REFRESH: '/auth/refresh', 
    AUTH_LOGOUT: '/auth/logout',
    AUTH_VALIDATE: '/auth/validate',
    
    // Daily time entry operations (by date)
    DAILY_BY_DATE: '/daily/by-date',
    
    // User-specific monthly operations
    USER_MONTHLY_BY_DATE: '/monthly/by-date',
    
    // User-specific weekly operations  
    USER_WEEKLY_BY_DATE: '/weekly/by-date',
    
    // Legacy endpoints
    TIME_ENTRIES: '/time-entries',
    USERS: '/users',
    AUTH: '/auth',
    VALIDATE: '/validate',
  },
  
  // Request timeout
  TIMEOUT: 30000,
  
  // Retry configuration
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  
  // Simple flags
  ENABLE_MOCK_DATA: true,
  MOCK_AS_FALLBACK_ONLY: true  // true: try real requests first, false: use mock immediately
} as const;

// Helper function to get full endpoint URL
export function getApiUrl(endpoint: keyof typeof API_CONFIG.ENDPOINTS): string {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS[endpoint]}`;
}

// Helper function to format date for API (YYYY-MM-DD)
export function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper function to build daily endpoint URL
export function getDailyEndpoint(date: Date): string {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DAILY_BY_DATE}/${formatDateForApi(date)}`;
}

// Helper function to build user monthly endpoint URL
export function getUserMonthlyEndpoint(userId: string, date: Date): string {
  return `${API_CONFIG.BASE_URL}/${userId}${API_CONFIG.ENDPOINTS.USER_MONTHLY_BY_DATE}/${formatDateForApi(date)}`;
}

// Helper function to build user weekly endpoint URL
export function getUserWeeklyEndpoint(userId: string, date: Date): string {
  return `${API_CONFIG.BASE_URL}/${userId}${API_CONFIG.ENDPOINTS.USER_WEEKLY_BY_DATE}/${formatDateForApi(date)}`;
}