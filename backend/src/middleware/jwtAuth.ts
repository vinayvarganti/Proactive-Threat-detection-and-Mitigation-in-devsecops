import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../services/JWTService';

const jwtService = new JWTService();

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        githubId: string;
        username: string;
      };
    }
  }
}

/**
 * Middleware to verify JWT token from Authorization header
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: 'No authorization header provided' });
      return;
    }

    // Extract token from "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({ error: 'Invalid authorization header format. Use: Bearer <token>' });
      return;
    }

    const token = parts[1];

    // Verify token
    const payload = jwtService.verifyToken(token);

    // Attach user info to request
    req.user = {
      userId: payload.userId,
      githubId: payload.githubId,
      username: payload.username
    };

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    res.status(401).json({ error: message });
    return;
  }
};

/**
 * Optional JWT authentication - doesn't fail if no token provided
 */
export const optionalJWT = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        const payload = jwtService.verifyToken(token);
        
        req.user = {
          userId: payload.userId,
          githubId: payload.githubId,
          username: payload.username
        };
      }
    }

    next();
  } catch {
    // Ignore errors for optional auth
    next();
  }
};
