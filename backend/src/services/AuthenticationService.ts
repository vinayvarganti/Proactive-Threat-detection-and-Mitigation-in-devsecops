import crypto from 'crypto';
import axios from 'axios';
import User from '../models/User';
import { AccessToken } from '../types/auth.types';
import { HTTPSEnforcer } from '../middleware/security';

export class AuthenticationService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly encryptionKey: Buffer;
  private readonly ivLength = 16;
  private readonly githubClientId: string;
  private readonly githubClientSecret: string;
  private readonly githubCallbackUrl: string;
  private readonly secureAxios = HTTPSEnforcer.createSecureAxiosInstance();

  constructor() {
    const key = process.env.TOKEN_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required');
    }
    
    // Ensure the key is exactly 32 bytes for AES-256
    if (key.length !== 32) {
      throw new Error('TOKEN_ENCRYPTION_KEY must be exactly 32 characters');
    }
    
    this.encryptionKey = Buffer.from(key, 'utf-8');

    // GitHub OAuth configuration
    this.githubClientId = process.env.GITHUB_CLIENT_ID || '';
    this.githubClientSecret = process.env.GITHUB_CLIENT_SECRET || '';
    this.githubCallbackUrl = process.env.GITHUB_CALLBACK_URL || '';

    if (!this.githubClientId || !this.githubClientSecret || !this.githubCallbackUrl) {
      throw new Error('GitHub OAuth configuration is incomplete. Check GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_CALLBACK_URL');
    }
  }

  /**
   * Encrypts a token using AES-256-CBC encryption
   * @param token - The plain text token to encrypt
   * @returns The encrypted token in format: iv:encryptedData
   */
  encryptToken(token: string): string {
    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      // Encrypt the token
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Return IV and encrypted data separated by colon
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      throw new Error(`Token encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypts an encrypted token
   * @param encryptedToken - The encrypted token in format: iv:encryptedData
   * @returns The decrypted plain text token
   */
  decryptToken(encryptedToken: string): string {
    try {
      // Split IV and encrypted data
      const parts = encryptedToken.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted token format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedData = parts[1];
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      
      // Decrypt the token
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Token decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stores an access token securely in MongoDB
   * @param userId - The GitHub user ID
   * @param token - The access token object containing token, expiresAt, and refreshToken
   * @param userInfo - Optional user information (username, email, avatarUrl) for creating new users
   */
  async storeToken(userId: string, token: AccessToken, userInfo?: { username: string; email: string; avatarUrl: string }): Promise<void> {
    try {
      // Encrypt both the access token and refresh token
      const encryptedToken = this.encryptToken(token.token);
      const encryptedRefreshToken = this.encryptToken(token.refreshToken);
      
      // Update or create user with encrypted tokens
      await User.findOneAndUpdate(
        { githubId: userId },
        {
          ...(userInfo && {
            username: userInfo.username,
            email: userInfo.email,
            avatarUrl: userInfo.avatarUrl
          }),
          encryptedToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: token.expiresAt,
          lastLoginAt: new Date()
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      throw new Error(`Failed to store token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieves and decrypts an access token from MongoDB
   * @param userId - The GitHub user ID
   * @returns The decrypted access token or null if not found
   */
  async getToken(userId: string): Promise<AccessToken | null> {
    try {
      const user = await User.findOne({ githubId: userId });
      
      if (!user) {
        return null;
      }
      
      // Decrypt both tokens
      const token = this.decryptToken(user.encryptedToken);
      const refreshToken = this.decryptToken(user.refreshToken);
      
      return {
        token,
        refreshToken,
        expiresAt: user.tokenExpiresAt
      };
    } catch (error) {
      throw new Error(`Failed to retrieve token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Removes a user's stored tokens from MongoDB
   * @param userId - The GitHub user ID
   */
  async revokeToken(userId: string): Promise<void> {
    try {
      await User.findOneAndDelete({ githubId: userId });
    } catch (error) {
      throw new Error(`Failed to revoke token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generates GitHub OAuth authorization URL with required scopes
   * @returns The OAuth authorization URL
   */
  generateOAuthUrl(): string {
    const scopes = ['repo', 'read:user'];
    const scopeString = scopes.join(' ');
    
    const params = new URLSearchParams({
      client_id: this.githubClientId,
      redirect_uri: this.githubCallbackUrl,
      scope: scopeString,
      state: crypto.randomBytes(16).toString('hex') // CSRF protection
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchanges OAuth authorization code for access token
   * @param code - The authorization code from GitHub OAuth callback
   * @returns The access token object
   */
  async exchangeCodeForToken(code: string): Promise<AccessToken> {
    try {
      // Exchange code for access token
      const tokenResponse = await this.secureAxios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: this.githubClientId,
          client_secret: this.githubClientSecret,
          code,
          redirect_uri: this.githubCallbackUrl
        },
        {
          headers: {
            Accept: 'application/json'
          }
        }
      );

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      if (!access_token) {
        throw new Error('No access token received from GitHub');
      }

      // Calculate expiration date (GitHub tokens typically don't expire, but we set a far future date)
      const expiresAt = expires_in 
        ? new Date(Date.now() + expires_in * 1000)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year default

      return {
        token: access_token,
        refreshToken: refresh_token || access_token, // GitHub may not provide refresh token
        expiresAt
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error_description || error.message;
        throw new Error(`Failed to exchange code for token: ${message}`);
      }
      throw new Error(`Failed to exchange code for token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refreshes an expired access token
   * @param userId - The GitHub user ID
   * @returns The new access token object
   */
  async refreshToken(userId: string): Promise<AccessToken> {
    try {
      // Get the current token
      const currentToken = await this.getToken(userId);
      
      if (!currentToken) {
        throw new Error('No token found for user');
      }

      // GitHub OAuth tokens typically don't expire and don't have a refresh mechanism
      // If the token is invalid, the user needs to re-authenticate
      // We'll attempt to validate the token by making a test API call
      try {
        await this.secureAxios.get('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${currentToken.token}`,
            Accept: 'application/vnd.github+json'
          }
        });

        // Token is still valid, return it with updated expiration
        const newExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        const refreshedToken: AccessToken = {
          ...currentToken,
          expiresAt: newExpiresAt
        };

        // Update the expiration in the database
        await this.storeToken(userId, refreshedToken);

        return refreshedToken;
      } catch (validationError) {
        // Token is invalid, user needs to re-authenticate
        throw new Error('Token is invalid or expired. Please re-authenticate.');
      }
    } catch (error) {
      throw new Error(`Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
