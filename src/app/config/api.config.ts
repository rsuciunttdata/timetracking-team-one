//API Configuration
export const API_CONFIG = {
  // Base API URL
  BASE_URL: '/api',
  
  // API Endpoints
  ENDPOINTS: {
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
  ENABLE_MOCK_DATA: true
} as const;

// Helper function to get full endpoint URL
export function getApiUrl(endpoint: keyof typeof API_CONFIG.ENDPOINTS): string {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS[endpoint]}`;
}