import { Router, Request, Response } from 'express';
import { AuthenticationService } from '../services/AuthenticationService';
import { JWTService } from '../services/JWTService';
import { authenticateJWT } from '../middleware/jwtAuth';
import axios from 'axios';

const router = Router();
const authService = new AuthenticationService();
const jwtService = new JWTService();

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
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}?auth=error&message=Authorization code is missing`);
      return;
    }

    // Exchange code for token
    const accessToken = await authService.exchangeCodeForToken(code);

    // Get user info from GitHub
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

    // Generate JWT token
    const jwtToken = jwtService.generateToken({
      userId: githubUser.id.toString(),
      githubId: githubUser.id.toString(),
      username: githubUser.login
    });

    // Redirect to frontend with JWT token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}?auth=success&token=${encodeURIComponent(jwtToken)}&username=${encodeURIComponent(githubUser.login)}`);
  } catch (error) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const errorMessage = error instanceof Error ? error.message : 'Failed to complete OAuth flow';
    res.redirect(`${frontendUrl}?auth=error&message=${encodeURIComponent(errorMessage)}`);
  }
});

/**
 * POST /api/auth/logout
 * Logs out the user by revoking tokens
 */
router.post('/logout', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(400).json({
        error: {
          code: 'NO_USER',
          message: 'No authenticated user',
          retryable: false
        },
        timestamp: new Date()
      });
      return;
    }

    // Revoke token from database
    await authService.revokeToken(userId);

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'LOGOUT_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred during logout',
        retryable: true
      },
      timestamp: new Date()
    });
  }
});

/**
 * GET /api/auth/status
 * Returns the current authentication status
 */
router.get('/status', authenticateJWT, (req: Request, res: Response) => {
  res.json({
    isAuthenticated: true,
    user: {
      id: req.user?.userId,
      username: req.user?.username
    }
  });
});

export default router;
