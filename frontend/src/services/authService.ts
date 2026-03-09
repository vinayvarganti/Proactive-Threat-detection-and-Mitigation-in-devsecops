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
   * Handles OAuth callback by exchanging code for token
   */
  async handleOAuthCallback(code: string): Promise<User> {
    try {
      const response = await axios.get<AuthResponse>(`${this.baseURL}/github/callback`, {
        params: { code }
      });
      return response.data.user;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data as ErrorResponse;
        throw new Error(errorData.error.message || 'Failed to complete authentication');
      }
      throw new Error('Failed to complete authentication');
    }
  }

  /**
   * Logs out the current user
   */
  async logout(): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/logout`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data as ErrorResponse;
        throw new Error(errorData.error.message || 'Failed to logout');
      }
      throw new Error('Failed to logout');
    }
  }

  /**
   * Gets the current authentication status
   */
  async getAuthStatus(): Promise<AuthStatus> {
    try {
      const response = await axios.get<{ isAuthenticated: boolean; user: User | null }>(`${this.baseURL}/status`);
      
      if (response.data.isAuthenticated && response.data.user) {
        return {
          isAuthenticated: true,
          username: response.data.user.username,
          avatarUrl: response.data.user.avatarUrl || null
        };
      }
      
      return {
        isAuthenticated: false,
        username: null,
        avatarUrl: null
      };
    } catch (error) {
      // If status check fails, assume not authenticated
      return {
        isAuthenticated: false,
        username: null,
        avatarUrl: null
      };
    }
  }
}

export const authService = new AuthService();
