import axios from 'axios';

// Configure axios defaults
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
axios.defaults.withCredentials = true; // Enable sending cookies with requests
axios.defaults.timeout = 300000; // 5 minute timeout for long-running scans

// Debug: Log the base URL to verify it's loaded
console.log('Axios baseURL configured as:', axios.defaults.baseURL);
console.log('VITE_API_BASE_URL env var:', import.meta.env.VITE_API_BASE_URL);

// Request interceptor for adding common headers
axios.interceptors.request.use(
  (config) => {
    // Add JWT token to Authorization header if available
    const token = localStorage.getItem('jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle common error scenarios
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      
      console.error('Response error:', {
        status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.config?.url
      });
      
      if (status === 401) {
        // Unauthorized - redirect to login
        console.error('Unauthorized access - please login');
        // Could dispatch a global auth state update here
      } else if (status === 403) {
        console.error('Forbidden - insufficient permissions');
      } else if (status === 429) {
        console.error('Rate limit exceeded - please try again later');
      } else if (status >= 500) {
        console.error('Server error - please try again later');
      }
    } else if (error.request) {
      // Request made but no response received
      console.error('Network error details:', {
        message: error.message,
        code: error.code,
        request: error.request
      });
      console.error('Network error - please check your connection');
    } else {
      // Something else happened
      console.error('Request error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default axios;
