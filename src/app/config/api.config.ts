//API Configuration
export const API_CONFIG = {
  // Base API URL - change this based on environment
  BASE_URL: '',
  
  // API Endpoints
  ENDPOINTS: {
    TIME_ENTRIES: '/',
    USERS: '/',
    AUTH: '/',
    VALIDATE: '/',
  },
  
  // Request timeout in milliseconds
  TIMEOUT: 30000,
  
  // Retry configuration
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
} as const;

// Helper function to get full endpoint URL
export function getApiUrl(endpoint: keyof typeof API_CONFIG.ENDPOINTS): string {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS[endpoint]}`;
}