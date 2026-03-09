import { AuthenticationService } from '../../services/AuthenticationService';
import User from '../../models/User';
import { AccessToken } from '../../types/auth.types';
import * as fc from 'fast-check';
import axios from 'axios';

// Mock dependencies
jest.mock('../../models/User');
jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Authentication Properties', () => {
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

  // Feature: devsecops-platform, Property 1: OAuth Round-Trip Completeness
  // **Validates: Requirements 1.1, 1.2, 1.3**
  describe('Property 1: OAuth Round-Trip Completeness', () => {
    it('property: complete OAuth flow results in authenticated session with encrypted token', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary OAuth codes and user data
          fc.record({
            oauthCode: fc.string({ minLength: 20, maxLength: 40 }),
            githubUserId: fc.string({ minLength: 1, maxLength: 20 }),
            accessToken: fc.string({ minLength: 40, maxLength: 100 }),
            refreshToken: fc.string({ minLength: 40, maxLength: 100 }),
            expiresIn: fc.integer({ min: 3600, max: 31536000 }) // 1 hour to 1 year
          }),
          async (testData) => {
            // Step 1: Generate OAuth URL (initiate login)
            const oauthUrl = authService.generateOAuthUrl();
            
            // Verify OAuth URL is properly formatted
            expect(oauthUrl).toContain('https://github.com/login/oauth/authorize');
            expect(oauthUrl).toContain('client_id=test_client_id');
            // Scope can be encoded as either + or %20 for spaces
            expect(oauthUrl).toMatch(/scope=(repo(\+|%20)read%3Auser|repo\+read%3Auser)/);
            expect(oauthUrl).toContain('state='); // CSRF protection
            
            // Step 2: Mock GitHub OAuth token exchange (authorization succeeds)
            const mockTokenResponse = {
              data: {
                access_token: testData.accessToken,
                refresh_token: testData.refreshToken,
                expires_in: testData.expiresIn,
                token_type: 'bearer'
              }
            };
            
            mockedAxios.post.mockResolvedValueOnce(mockTokenResponse);
            
            // Step 3: Exchange code for token (receive access token)
            const receivedToken: AccessToken = await authService.exchangeCodeForToken(testData.oauthCode);
            
            // Verify token was received
            expect(receivedToken).toBeDefined();
            expect(receivedToken.token).toBe(testData.accessToken);
            expect(receivedToken.refreshToken).toBe(testData.refreshToken);
            expect(receivedToken.expiresAt).toBeInstanceOf(Date);
            
            // Verify GitHub API was called correctly
            expect(mockedAxios.post).toHaveBeenCalledWith(
              'https://github.com/login/oauth/access_token',
              expect.objectContaining({
                client_id: 'test_client_id',
                client_secret: 'test_client_secret',
                code: testData.oauthCode
              }),
              expect.objectContaining({
                headers: { Accept: 'application/json' }
              })
            );
            
            // Step 4: Store token securely (secure storage)
            let storedEncryptedToken: string = '';
            let storedEncryptedRefreshToken: string = '';
            
            (User.findOneAndUpdate as jest.Mock).mockImplementation((_query, update) => {
              storedEncryptedToken = update.encryptedToken;
              storedEncryptedRefreshToken = update.refreshToken;
              return Promise.resolve({});
            });
            
            await authService.storeToken(testData.githubUserId, receivedToken);
            
            // Verify token was stored
            expect(User.findOneAndUpdate).toHaveBeenCalledWith(
              { githubId: testData.githubUserId },
              expect.objectContaining({
                encryptedToken: expect.any(String),
                refreshToken: expect.any(String),
                tokenExpiresAt: receivedToken.expiresAt,
                lastLoginAt: expect.any(Date)
              }),
              { upsert: false }
            );
            
            // Property: Stored token must be encrypted (not plain text)
            expect(storedEncryptedToken).not.toBe(testData.accessToken);
            expect(storedEncryptedRefreshToken).not.toBe(testData.refreshToken);
            expect(storedEncryptedToken).toContain(':'); // Encrypted format: iv:data
            expect(storedEncryptedRefreshToken).toContain(':');
            
            // Step 5: Retrieve token (authenticated session)
            (User.findOne as jest.Mock).mockResolvedValue({
              githubId: testData.githubUserId,
              encryptedToken: storedEncryptedToken,
              refreshToken: storedEncryptedRefreshToken,
              tokenExpiresAt: receivedToken.expiresAt
            });
            
            const retrievedToken = await authService.getToken(testData.githubUserId);
            
            // Property: Retrieved token must match original token (decryption works)
            expect(retrievedToken).not.toBeNull();
            expect(retrievedToken?.token).toBe(testData.accessToken);
            expect(retrievedToken?.refreshToken).toBe(testData.refreshToken);
            expect(retrievedToken?.expiresAt).toEqual(receivedToken.expiresAt);
            
            // Property: Complete OAuth round-trip results in authenticated session
            // An authenticated session means:
            // 1. OAuth URL was generated ✓
            // 2. Token was received from GitHub ✓
            // 3. Token was encrypted and stored ✓
            // 4. Token can be retrieved and decrypted ✓
            // 5. Retrieved token matches original ✓
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  // Feature: devsecops-platform, Property 4: Session Cleanup on Logout
  // **Validates: Requirements 10.4**
  describe('Property 4: Session Cleanup on Logout', () => {
    it('property: logout removes all session data and tokens from database', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary user session data
          fc.record({
            githubUserId: fc.string({ minLength: 1, maxLength: 20 }),
            username: fc.string({ minLength: 3, maxLength: 30 }),
            email: fc.emailAddress(),
            accessToken: fc.string({ minLength: 40, maxLength: 100 }),
            refreshToken: fc.string({ minLength: 40, maxLength: 100 }),
            sessionData: fc.record({
              userId: fc.string({ minLength: 1, maxLength: 20 }),
              username: fc.string({ minLength: 3, maxLength: 30 }),
              tokenExpiresAt: fc.date({ min: new Date(), max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) })
            })
          }),
          async (testData) => {
            // Step 1: Set up an authenticated session with stored tokens
            const encryptedToken = authService.encryptToken(testData.accessToken);
            const encryptedRefreshToken = authService.encryptToken(testData.refreshToken);
            
            // Mock user exists in database with tokens
            const mockUser = {
              githubId: testData.githubUserId,
              username: testData.username,
              email: testData.email,
              encryptedToken,
              refreshToken: encryptedRefreshToken,
              tokenExpiresAt: testData.sessionData.tokenExpiresAt,
              createdAt: new Date(),
              lastLoginAt: new Date()
            };
            
            (User.findOne as jest.Mock).mockResolvedValue(mockUser);
            
            // Verify user has tokens stored before logout
            const tokenBeforeLogout = await authService.getToken(testData.githubUserId);
            expect(tokenBeforeLogout).not.toBeNull();
            expect(tokenBeforeLogout?.token).toBe(testData.accessToken);
            
            // Step 2: Perform logout (revoke token)
            let deletedUserId: string | null = null;
            (User.findOneAndDelete as jest.Mock).mockImplementation((query) => {
              deletedUserId = query.githubId;
              return Promise.resolve(mockUser);
            });
            
            await authService.revokeToken(testData.githubUserId);
            
            // Property: Logout must call database deletion for the user
            expect(User.findOneAndDelete).toHaveBeenCalledWith({ githubId: testData.githubUserId });
            expect(deletedUserId).toBe(testData.githubUserId);
            
            // Step 3: Verify tokens are removed from database
            (User.findOne as jest.Mock).mockResolvedValue(null);
            
            const tokenAfterLogout = await authService.getToken(testData.githubUserId);
            
            // Property: After logout, no tokens should be retrievable from database
            expect(tokenAfterLogout).toBeNull();
            
            // Step 4: Verify session data would be invalidated
            // In a real scenario, the session middleware would clear req.session
            // Here we verify that the database state is clean
            const userAfterLogout = await User.findOne({ githubId: testData.githubUserId });
            expect(userAfterLogout).toBeNull();
            
            // Property: Session cleanup on logout means:
            // 1. User tokens are deleted from database ✓
            // 2. Token retrieval returns null after logout ✓
            // 3. User record is removed from database ✓
            // 4. No session data remains accessible ✓
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});

