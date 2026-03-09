import axios from 'axios';

export interface AuthStatus {
  isAuthenticated: boolean;
  username: string | null;
  avatarUrl: string | null;
}

export interface User {
  id: string;
  username: string;
  avatarUrl: string;
  email?: string;
}

export interface AuthResponse {
  success: boolean;
  user: User;
  message: string;
}

export interface OAuthInitiateResponse {
  url: string;
  message: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    suggestedAction?: string;
  };
  timestamp: Date;
  requestId: string;
}

class AuthService {
  private baseURL = '/api/auth';
  private TOKEN_KEY = 'jwt_token';

  /**
   * Store JWT token in localStorage
   */
  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  /**
   * Get JWT token from localStorage
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Remove JWT token from localStorage
   */
  clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  /**
   * Check if user has a valid token
   */
  hasToken(): boolean {
    return !!this.getToken();
  }

  /**
   * Initiates GitHub OAuth flow by getting the authorization URL
   */
  async initiateGitHubLogin(): Promise<string> {
    try {
      const response = await axios.post<OAuthInitiateResponse>(`${this.baseURL}/github/initiate`);
      return response.data.url;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data as ErrorResponse;
        throw new Error(errorData.error.message || 'Failed to initiate GitHub login');
      }
      throw new Error('Failed to initiate GitHub login');
    }
  }

  /**
   * Handles OAuth callback by extracting JWT token from URL
   */
  handleOAuthCallback(): { token: string; username: string } | null {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const username = urlParams.get('username');

    if (token && username) {
      this.setToken(token);
      return { token, username: decodeURIComponent(username) };
    }

    return null;
  }

  /**
   * Logs out the current user
   */
  async logout(): Promise<void> {
    this.clearToken();
  }

  /**
   * Gets the current authentication status
   */
  async getAuthStatus(): Promise<AuthStatus> {
    const token = this.getToken();
    
    if (!token) {
      return {
        isAuthenticated: false,
        username: null,
        avatarUrl: null
      };
    }

    try {
      const response = await axios.get<{ isAuthenticated: boolean; user: User | null }>(`${this.baseURL}/status`);
      
      if (response.data.isAuthenticated && response.data.user) {
        return {
          isAuthenticated: true,
          username: response.data.user.username,
          avatarUrl: response.data.user.avatarUrl || null
        };
      }
      
      // Token is invalid, clear it
      this.clearToken();
      return {
        isAuthenticated: false,
        username: null,
        avatarUrl: null
      };
    } catch (error) {
      // If status check fails, clear token and assume not authenticated
      this.clearToken();
      return {
        isAuthenticated: false,
        username: null,
        avatarUrl: null
      };
    }
  }
}

export const authService = new AuthService();
