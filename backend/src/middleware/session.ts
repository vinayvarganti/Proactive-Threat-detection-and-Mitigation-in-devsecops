import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to validate that a user session exists and is authenticated
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.session || !req.session.userId) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in.',
        retryable: false,
        suggestedAction: 'Initiate GitHub OAuth login'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  }

  next();
};

/**
 * Middleware to validate session and check token expiration
 */
export const validateSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.session || !req.session.userId) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'No active session found',
        retryable: false,
        suggestedAction: 'Please log in again'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    return;
  }

  // Check if token expiration is stored in session
  if (req.session.tokenExpiresAt) {
    const expiresAt = new Date(req.session.tokenExpiresAt);
    const now = new Date();

    if (now >= expiresAt) {
      res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Your session has expired. Please log in again.',
          retryable: false,
          suggestedAction: 'Re-authenticate with GitHub'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }
  }

  next();
};
