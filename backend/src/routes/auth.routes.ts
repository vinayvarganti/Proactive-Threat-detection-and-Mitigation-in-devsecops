import { Router, Request, Response } from 'express';
import { AuthenticationService } from '../services/AuthenticationService';
import { requireAuth } from '../middleware/session';

const router = Router();
const authService = new AuthenticationService();

/**
 * POST /api/auth/github/initiate
 * Initiates GitHub OAuth flow by returning the authorization URL
 */
router.post('/github/initiate', (req: Request, res: Response) => {
  try {
    const oauthUrl = authService.generateOAuthUrl();
    res.json({ 
      url: oauthUrl,
      message: 'Redirect user to this URL to begin OAuth flow'
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'OAUTH_INITIATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to initiate OAuth flow',
        retryable: true,
        suggestedAction: 'Try again or check server configuration'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

/**
 * GET /api/auth/github/callback
 * Handles OAuth callback from GitHub
 */
router.get('/github/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      // Redirect to frontend with error
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}?auth=error&message=Authorization code is missing`);
      return;
    }

    // Exchange code for token
    const accessToken = await authService.exchangeCodeForToken(code);

    // Get user info from GitHub to get the user ID
    const axios = require('axios');
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        Accept: 'application/vnd.github+json'
      }
    });

    const githubUser = userResponse.data;

    // Store token in database with user information
    await authService.storeToken(githubUser.id.toString(), accessToken, {
      username: githubUser.login,
      email: githubUser.email || '',
      avatarUrl: githubUser.avatar_url || ''
    });

    // Create session
    req.session.userId = githubUser.id.toString();
    req.session.username = githubUser.login;
    req.session.tokenExpiresAt = accessToken.expiresAt.toISOString();

    // Save session before redirecting
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
      }
      
      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}?auth=success&username=${encodeURIComponent(githubUser.login)}`);
    });
  } catch (error) {
    // Redirect to frontend with error
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const errorMessage = error instanceof Error ? error.message : 'Failed to complete OAuth flow';
    res.redirect(`${frontendUrl}?auth=error&message=${encodeURIComponent(errorMessage)}`);
  }
});

/**
 * POST /api/auth/logout
 * Logs out the user by invalidating session and revoking tokens
 */
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      res.status(400).json({
        error: {
          code: 'NO_SESSION',
          message: 'No active session to logout',
          retryable: false
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Revoke token from database using AuthenticationService
    await authService.revokeToken(userId);

    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
        res.status(500).json({
          error: {
            code: 'LOGOUT_FAILED',
            message: 'Failed to destroy session',
            retryable: true,
            suggestedAction: 'Try logging out again'
          },
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
      }

      // Clear session cookie
      res.clearCookie('connect.sid');

      res.json({
        success: true,
        message: 'Logout successful'
      });
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'LOGOUT_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred during logout',
        retryable: true,
        suggestedAction: 'Try logging out again'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

/**
 * GET /api/auth/status
 * Returns the current authentication status
 */
router.get('/status', (req: Request, res: Response) => {
  if (req.session && req.session.userId) {
    res.json({
      isAuthenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username
      }
    });
  } else {
    res.json({
      isAuthenticated: false,
      user: null
    });
  }
});

export default router;
