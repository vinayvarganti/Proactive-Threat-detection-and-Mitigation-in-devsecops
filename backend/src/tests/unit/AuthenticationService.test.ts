import { AuthenticationService } from '../../services/AuthenticationService';
import User from '../../models/User';
import { AccessToken } from '../../types/auth.types';
import * as fc from 'fast-check';

// Mock the User model
jest.mock('../../models/User');

// Mock axios
jest.mock('axios');

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  
  beforeAll(() => {
    // Set up environment variables for testing
    process.env.TOKEN_ENCRYPTION_KEY = '12345678901234567890123456789012'; // exactly 32 characters
    process.env.GITHUB_CLIENT_ID = 'test_client_id';
    process.env.GITHUB_CLIENT_SECRET = 'test_client_secret';
    process.env.GITHUB_CALLBACK_URL = 'http://localhost:3000/api/auth/github/callback';
  });

  beforeEach(() => {
    authService = new AuthenticationService();
    jest.clearAllMocks();
  });

  describe('Token Encryption/Decryption', () => {
    it('should encrypt a token', () => {
      const plainToken = 'github_pat_test_token_12345';
      const encrypted = authService.encryptToken(plainToken);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plainToken);
      expect(encrypted).toContain(':'); // Should have IV:data format
    });

    it('should decrypt an encrypted token back to original', () => {
      const plainToken = 'github_pat_test_token_12345';
      const encrypted = authService.encryptToken(plainToken);
      const decrypted = authService.decryptToken(encrypted);
      
      expect(decrypted).toBe(plainToken);
    });

    // Feature: devsecops-platform, Property 3: Token Encryption Invariant
    // **Validates: Requirements 10.1**
    it('property: token encryption round-trip preserves original value', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary strings to represent tokens
          fc.string({ minLength: 1, maxLength: 500 }),
          (token) => {
            // Encrypt the token
            const encrypted = authService.encryptToken(token);
            
            // Verify encrypted value is different from original (unless empty)
            if (token.length > 0) {
              expect(encrypted).not.toBe(token);
            }
            
            // Verify encrypted format (should contain IV:data)
            expect(encrypted).toContain(':');
            const parts = encrypted.split(':');
            expect(parts.length).toBe(2);
            expect(parts[0].length).toBeGreaterThan(0); // IV part
            expect(parts[1].length).toBeGreaterThan(0); // Encrypted data part
            
            // Decrypt the token
            const decrypted = authService.decryptToken(encrypted);
            
            // Property: Decrypted value must equal original value
            expect(decrypted).toBe(token);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should produce different encrypted values for same token (due to random IV)', () => {
      const plainToken = 'github_pat_test_token_12345';
      const encrypted1 = authService.encryptToken(plainToken);
      const encrypted2 = authService.encryptToken(plainToken);
      
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to the same value
      expect(authService.decryptToken(encrypted1)).toBe(plainToken);
      expect(authService.decryptToken(encrypted2)).toBe(plainToken);
    });

    it('should throw error when decrypting invalid format', () => {
      expect(() => {
        authService.decryptToken('invalid-format');
      }).toThrow('Token decryption failed');
    });

    it('should throw error when decrypting corrupted data', () => {
      const plainToken = 'github_pat_test_token_12345';
      const encrypted = authService.encryptToken(plainToken);
      const corrupted = encrypted.substring(0, encrypted.length - 5) + 'xxxxx';
      
      expect(() => {
        authService.decryptToken(corrupted);
      }).toThrow('Token decryption failed');
    });

    it('should handle empty string encryption and decryption', () => {
      const plainToken = '';
      const encrypted = authService.encryptToken(plainToken);
      const decrypted = authService.decryptToken(encrypted);
      
      expect(decrypted).toBe(plainToken);
    });

    it('should handle long tokens', () => {
      const plainToken = 'a'.repeat(1000);
      const encrypted = authService.encryptToken(plainToken);
      const decrypted = authService.decryptToken(encrypted);
      
      expect(decrypted).toBe(plainToken);
    });

    it('should handle tokens with special characters', () => {
      const plainToken = 'token!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const encrypted = authService.encryptToken(plainToken);
      const decrypted = authService.decryptToken(encrypted);
      
      expect(decrypted).toBe(plainToken);
    });
  });

  describe('Token Storage and Retrieval', () => {
    const mockAccessToken: AccessToken = {
      token: 'github_pat_test_token',
      refreshToken: 'refresh_token_test',
      expiresAt: new Date('2024-12-31')
    };

    it('should store token with encryption', async () => {
      const userId = 'github_user_123';
      
      (User.findOneAndUpdate as jest.Mock).mockResolvedValue({});
      
      await authService.storeToken(userId, mockAccessToken);
      
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { githubId: userId },
        expect.objectContaining({
          encryptedToken: expect.any(String),
          refreshToken: expect.any(String),
          tokenExpiresAt: mockAccessToken.expiresAt,
          lastLoginAt: expect.any(Date)
        }),
        { upsert: false }
      );
      
      // Verify that stored tokens are encrypted (not plain text)
      const call = (User.findOneAndUpdate as jest.Mock).mock.calls[0][1];
      expect(call.encryptedToken).not.toBe(mockAccessToken.token);
      expect(call.refreshToken).not.toBe(mockAccessToken.refreshToken);
    });

    it('should retrieve and decrypt token', async () => {
      const userId = 'github_user_123';
      const encryptedToken = authService.encryptToken(mockAccessToken.token);
      const encryptedRefreshToken = authService.encryptToken(mockAccessToken.refreshToken);
      
      (User.findOne as jest.Mock).mockResolvedValue({
        githubId: userId,
        encryptedToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: mockAccessToken.expiresAt
      });
      
      const result = await authService.getToken(userId);
      
      expect(result).not.toBeNull();
      expect(result?.token).toBe(mockAccessToken.token);
      expect(result?.refreshToken).toBe(mockAccessToken.refreshToken);
      expect(result?.expiresAt).toEqual(mockAccessToken.expiresAt);
    });

    it('should return null when user not found', async () => {
      const userId = 'nonexistent_user';
      
      (User.findOne as jest.Mock).mockResolvedValue(null);
      
      const result = await authService.getToken(userId);
      
      expect(result).toBeNull();
    });

    it('should throw error when storage fails', async () => {
      const userId = 'github_user_123';
      
      (User.findOneAndUpdate as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      await expect(authService.storeToken(userId, mockAccessToken)).rejects.toThrow('Failed to store token');
    });

    it('should throw error when retrieval fails due to database error', async () => {
      const userId = 'github_user_123';
      
      (User.findOne as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      await expect(authService.getToken(userId)).rejects.toThrow('Failed to retrieve token');
    });
  });

  describe('Token Revocation', () => {
    it('should revoke token by deleting user', async () => {
      const userId = 'github_user_123';
      
      (User.findOneAndDelete as jest.Mock).mockResolvedValue({});
      
      await authService.revokeToken(userId);
      
      expect(User.findOneAndDelete).toHaveBeenCalledWith({ githubId: userId });
    });

    it('should throw error when revocation fails', async () => {
      const userId = 'github_user_123';
      
      (User.findOneAndDelete as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      await expect(authService.revokeToken(userId)).rejects.toThrow('Failed to revoke token');
    });
  });

  describe('Constructor Validation', () => {
    it('should throw error when TOKEN_ENCRYPTION_KEY is not set', () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;
      
      expect(() => {
        new AuthenticationService();
      }).toThrow('TOKEN_ENCRYPTION_KEY environment variable is required');
      
      // Restore for other tests
      process.env.TOKEN_ENCRYPTION_KEY = '12345678901234567890123456789012';
    });

    it('should throw error when TOKEN_ENCRYPTION_KEY is not 32 characters', () => {
      process.env.TOKEN_ENCRYPTION_KEY = 'short-key';
      
      expect(() => {
        new AuthenticationService();
      }).toThrow('TOKEN_ENCRYPTION_KEY must be exactly 32 characters');
      
      // Restore for other tests
      process.env.TOKEN_ENCRYPTION_KEY = '12345678901234567890123456789012';
    });
  });

  describe('OAuth URL Generation', () => {
    it('should generate valid OAuth URL with required parameters', () => {
      const url = authService.generateOAuthUrl();
      
      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test_client_id');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('scope=repo+read%3Auser');
      expect(url).toContain('state=');
    });

    it('should generate different state values for CSRF protection', () => {
      const url1 = authService.generateOAuthUrl();
      const url2 = authService.generateOAuthUrl();
      
      const state1 = new URL(url1).searchParams.get('state');
      const state2 = new URL(url2).searchParams.get('state');
      
      expect(state1).not.toBe(state2);
    });
  });

  describe('OAuth Error Handling', () => {
    // Mock axios for OAuth tests
    const axios = require('axios');
    jest.mock('axios');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('exchangeCodeForToken - Authorization Failures', () => {
      it('should throw error when authorization code is invalid', async () => {
        const invalidCode = 'invalid_code_12345';
        const axios = require('axios');
        
        // Mock GitHub API error response for invalid code
        const mockError = new Error('Request failed with status code 401');
        Object.assign(mockError, {
          response: {
            data: {
              error: 'bad_verification_code',
              error_description: 'The code passed is incorrect or expired.'
            }
          }
        });
        
        (axios.post as jest.Mock).mockRejectedValue(mockError);
        (axios.isAxiosError as jest.Mock).mockReturnValue(true);

        await expect(authService.exchangeCodeForToken(invalidCode))
          .rejects
          .toThrow('Failed to exchange code for token: The code passed is incorrect or expired.');
      });

      it('should throw error when GitHub returns no access token', async () => {
        const code = 'valid_code_12345';
        const axios = require('axios');
        
        // Mock GitHub API response without access_token
        (axios.post as jest.Mock).mockResolvedValue({
          data: {
            error: 'invalid_request'
          }
        });

        await expect(authService.exchangeCodeForToken(code))
          .rejects
          .toThrow('No access token received from GitHub');
      });

      it('should handle network errors during token exchange', async () => {
        const code = 'valid_code_12345';
        const axios = require('axios');
        
        // Mock network error
        const mockError = new Error('Network Error');
        Object.assign(mockError, {
          code: 'ECONNREFUSED'
        });
        
        (axios.post as jest.Mock).mockRejectedValue(mockError);
        (axios.isAxiosError as jest.Mock).mockReturnValue(true);

        await expect(authService.exchangeCodeForToken(code))
          .rejects
          .toThrow('Failed to exchange code for token: Network Error');
      });

      it('should handle timeout errors during token exchange', async () => {
        const code = 'valid_code_12345';
        const axios = require('axios');
        
        // Mock timeout error
        const mockError = new Error('timeout of 5000ms exceeded');
        Object.assign(mockError, {
          code: 'ECONNABORTED'
        });
        
        (axios.post as jest.Mock).mockRejectedValue(mockError);
        (axios.isAxiosError as jest.Mock).mockReturnValue(true);

        await expect(authService.exchangeCodeForToken(code))
          .rejects
          .toThrow('Failed to exchange code for token: timeout of 5000ms exceeded');
      });

      it('should handle GitHub API rate limit errors', async () => {
        const code = 'valid_code_12345';
        const axios = require('axios');
        
        // Mock rate limit error
        const mockError = new Error('Request failed with status code 429');
        Object.assign(mockError, {
          response: {
            status: 429,
            data: {
              error: 'rate_limit_exceeded',
              error_description: 'API rate limit exceeded'
            }
          }
        });
        
        (axios.post as jest.Mock).mockRejectedValue(mockError);
        (axios.isAxiosError as jest.Mock).mockReturnValue(true);

        await expect(authService.exchangeCodeForToken(code))
          .rejects
          .toThrow('Failed to exchange code for token: API rate limit exceeded');
      });

      it('should handle GitHub server errors (5xx)', async () => {
        const code = 'valid_code_12345';
        const axios = require('axios');
        
        // Mock server error
        const mockError = new Error('Request failed with status code 503');
        Object.assign(mockError, {
          response: {
            status: 503,
            data: {
              error: 'service_unavailable',
              error_description: 'GitHub service is temporarily unavailable'
            }
          }
        });
        
        (axios.post as jest.Mock).mockRejectedValue(mockError);
        (axios.isAxiosError as jest.Mock).mockReturnValue(true);

        await expect(authService.exchangeCodeForToken(code))
          .rejects
          .toThrow('Failed to exchange code for token: GitHub service is temporarily unavailable');
      });

      it('should handle malformed response from GitHub', async () => {
        const code = 'valid_code_12345';
        const axios = require('axios');
        
        // Mock malformed response
        (axios.post as jest.Mock).mockResolvedValue({
          data: {}
        });

        await expect(authService.exchangeCodeForToken(code))
          .rejects
          .toThrow('No access token received from GitHub');
      });
    });

    describe('Token Expiration Scenarios', () => {
      it('should detect expired token during refresh', async () => {
        const userId = 'github_user_123';
        const expiredToken: AccessToken = {
          token: 'expired_token',
          refreshToken: 'refresh_token',
          expiresAt: new Date('2020-01-01') // Past date
        };

        // Mock token retrieval
        const encryptedToken = authService.encryptToken(expiredToken.token);
        const encryptedRefreshToken = authService.encryptToken(expiredToken.refreshToken);
        
        (User.findOne as jest.Mock).mockResolvedValue({
          githubId: userId,
          encryptedToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: expiredToken.expiresAt
        });

        // Mock GitHub API validation failure
        (axios.get as jest.Mock).mockRejectedValue({
          isAxiosError: true,
          response: {
            status: 401,
            data: {
              message: 'Bad credentials'
            }
          }
        });

        await expect(authService.refreshToken(userId))
          .rejects
          .toThrow('Token is invalid or expired. Please re-authenticate.');
      });

      it('should successfully refresh valid token', async () => {
        const userId = 'github_user_123';
        const validToken: AccessToken = {
          token: 'valid_token',
          refreshToken: 'refresh_token',
          expiresAt: new Date('2025-12-31')
        };

        // Mock token retrieval
        const encryptedToken = authService.encryptToken(validToken.token);
        const encryptedRefreshToken = authService.encryptToken(validToken.refreshToken);
        
        (User.findOne as jest.Mock).mockResolvedValue({
          githubId: userId,
          encryptedToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: validToken.expiresAt
        });

        // Mock successful GitHub API validation
        (axios.get as jest.Mock).mockResolvedValue({
          data: {
            id: 123,
            login: 'testuser'
          }
        });

        // Mock token update
        (User.findOneAndUpdate as jest.Mock).mockResolvedValue({});

        const refreshedToken = await authService.refreshToken(userId);

        expect(refreshedToken.token).toBe(validToken.token);
        expect(refreshedToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
      });

      it('should throw error when no token found for user during refresh', async () => {
        const userId = 'nonexistent_user';
        
        (User.findOne as jest.Mock).mockResolvedValue(null);

        await expect(authService.refreshToken(userId))
          .rejects
          .toThrow('No token found for user');
      });

      it('should handle network errors during token validation', async () => {
        const userId = 'github_user_123';
        const validToken: AccessToken = {
          token: 'valid_token',
          refreshToken: 'refresh_token',
          expiresAt: new Date('2025-12-31')
        };

        // Mock token retrieval
        const encryptedToken = authService.encryptToken(validToken.token);
        const encryptedRefreshToken = authService.encryptToken(validToken.refreshToken);
        
        (User.findOne as jest.Mock).mockResolvedValue({
          githubId: userId,
          encryptedToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: validToken.expiresAt
        });

        // Mock network error during validation
        (axios.get as jest.Mock).mockRejectedValue({
          isAxiosError: true,
          message: 'Network Error',
          code: 'ECONNREFUSED'
        });

        await expect(authService.refreshToken(userId))
          .rejects
          .toThrow('Token is invalid or expired. Please re-authenticate.');
      });
    });

    describe('GitHub API Error Responses', () => {
      it('should handle 401 Unauthorized from GitHub API', async () => {
        const code = 'valid_code_12345';
        const axios = require('axios');
        
        const mockError = new Error('Request failed with status code 401');
        Object.assign(mockError, {
          response: {
            status: 401,
            data: {
              error: 'unauthorized',
              error_description: 'Bad credentials'
            }
          }
        });
        
        (axios.post as jest.Mock).mockRejectedValue(mockError);
        (axios.isAxiosError as jest.Mock).mockReturnValue(true);

        await expect(authService.exchangeCodeForToken(code))
          .rejects
          .toThrow('Failed to exchange code for token: Bad credentials');
      });

      it('should handle 403 Forbidden from GitHub API', async () => {
        const code = 'valid_code_12345';
        const axios = require('axios');
        
        const mockError = new Error('Request failed with status code 403');
        Object.assign(mockError, {
          response: {
            status: 403,
            data: {
              error: 'forbidden',
              error_description: 'Resource not accessible by integration'
            }
          }
        });
        
        (axios.post as jest.Mock).mockRejectedValue(mockError);
        (axios.isAxiosError as jest.Mock).mockReturnValue(true);

        await expect(authService.exchangeCodeForToken(code))
          .rejects
          .toThrow('Failed to exchange code for token: Resource not accessible by integration');
      });

      it('should handle 404 Not Found from GitHub API', async () => {
        const code = 'valid_code_12345';
        const axios = require('axios');
        
        const mockError = new Error('Request failed with status code 404');
        Object.assign(mockError, {
          response: {
            status: 404,
            data: {
              error: 'not_found',
              error_description: 'Not Found'
            }
          }
        });
        
        (axios.post as jest.Mock).mockRejectedValue(mockError);
        (axios.isAxiosError as jest.Mock).mockReturnValue(true);

        await expect(authService.exchangeCodeForToken(code))
          .rejects
          .toThrow('Failed to exchange code for token: Not Found');
      });

      it('should handle generic axios errors without response', async () => {
        const code = 'valid_code_12345';
        const axios = require('axios');
        
        const mockError = new Error('Request failed');
        Object.assign(mockError, {
          code: 'ERR_UNKNOWN'
        });
        
        (axios.post as jest.Mock).mockRejectedValue(mockError);
        (axios.isAxiosError as jest.Mock).mockReturnValue(true);

        await expect(authService.exchangeCodeForToken(code))
          .rejects
          .toThrow('Failed to exchange code for token: Request failed');
      });

      it('should handle non-axios errors', async () => {
        const code = 'valid_code_12345';
        const axios = require('axios');
        
        (axios.post as jest.Mock).mockRejectedValue(new Error('Unexpected error'));
        (axios.isAxiosError as jest.Mock).mockReturnValue(false);

        await expect(authService.exchangeCodeForToken(code))
          .rejects
          .toThrow('Failed to exchange code for token: Unexpected error');
      });

      it('should handle successful token exchange with all fields', async () => {
        const code = 'valid_code_12345';
        const axios = require('axios');
        
        (axios.post as jest.Mock).mockResolvedValue({
          data: {
            access_token: 'gho_test_token_12345',
            refresh_token: 'ghr_refresh_token_12345',
            expires_in: 28800, // 8 hours
            token_type: 'bearer',
            scope: 'repo,read:user'
          }
        });

        const result = await authService.exchangeCodeForToken(code);

        expect(result.token).toBe('gho_test_token_12345');
        expect(result.refreshToken).toBe('ghr_refresh_token_12345');
        expect(result.expiresAt).toBeInstanceOf(Date);
        expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
      });

      it('should handle token exchange without refresh_token', async () => {
        const code = 'valid_code_12345';
        const axios = require('axios');
        
        (axios.post as jest.Mock).mockResolvedValue({
          data: {
            access_token: 'gho_test_token_12345',
            token_type: 'bearer',
            scope: 'repo,read:user'
          }
        });

        const result = await authService.exchangeCodeForToken(code);

        expect(result.token).toBe('gho_test_token_12345');
        expect(result.refreshToken).toBe('gho_test_token_12345'); // Should use access token as fallback
        expect(result.expiresAt).toBeInstanceOf(Date);
      });

      it('should handle token exchange without expires_in', async () => {
        const code = 'valid_code_12345';
        const axios = require('axios');
        
        (axios.post as jest.Mock).mockResolvedValue({
          data: {
            access_token: 'gho_test_token_12345',
            refresh_token: 'ghr_refresh_token_12345',
            token_type: 'bearer',
            scope: 'repo,read:user'
          }
        });

        const result = await authService.exchangeCodeForToken(code);

        expect(result.token).toBe('gho_test_token_12345');
        expect(result.expiresAt).toBeInstanceOf(Date);
        // Should default to 1 year from now
        const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
        expect(result.expiresAt.getTime()).toBeLessThanOrEqual(oneYearFromNow.getTime());
      });
    });
  });
});

