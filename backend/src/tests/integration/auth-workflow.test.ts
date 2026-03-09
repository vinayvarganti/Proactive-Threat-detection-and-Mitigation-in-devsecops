import request from 'supertest';
import app from '../../index';
import { AuthenticationService } from '../../services/AuthenticationService';

// Mock the AuthenticationService
jest.mock('../../services/AuthenticationService');

describe('Authentication Workflow Integration Tests', () => {
  let mockAuthService: jest.Mocked<AuthenticationService>;

  beforeEach(() => {
    mockAuthService = new AuthenticationService() as jest.Mocked<AuthenticationService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('OAuth Flow', () => {
    it('should initiate OAuth flow and return authorization URL', async () => {
      const mockOAuthUrl = 'https://github.com/login/oauth/authorize?client_id=test&scope=repo';
      mockAuthService.generateOAuthUrl = jest.fn().mockReturnValue(mockOAuthUrl);

      const response = await request(app)
        .post('/api/auth/github/initiate')
        .expect(200);

      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toBe(mockOAuthUrl);
    });

    it('should handle OAuth callback with valid code', async () => {
      const mockAccessToken = {
        token: 'mock_token',
        expiresAt: new Date(Date.now() + 3600000),
        refreshToken: 'mock_refresh_token'
      };

      mockAuthService.exchangeCodeForToken = jest.fn().mockResolvedValue(mockAccessToken);
      mockAuthService.storeToken = jest.fn().mockResolvedValue(undefined);

      // Mock axios for GitHub user API call
      const axios = require('axios');
      axios.get = jest.fn().mockResolvedValue({
        data: {
          id: 12345,
          login: 'testuser',
          avatar_url: 'https://example.com/avatar.png',
          email: 'test@example.com'
        }
      });

      const response = await request(app)
        .get('/api/auth/github/callback?code=test_code')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toHaveProperty('username', 'testuser');
    });
  });

  describe('Authentication Status', () => {
    it('should return unauthenticated status when no session exists', async () => {
      const response = await request(app)
        .get('/api/auth/status')
        .expect(200);

      expect(response.body.isAuthenticated).toBe(false);
      expect(response.body.user).toBeNull();
    });
  });

  describe('Logout', () => {
    it('should require authentication for logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });
});

