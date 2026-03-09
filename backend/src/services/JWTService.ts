import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  githubId: string;
  username: string;
}

export class JWTService {
  private readonly secret: string;
  private readonly expiresIn = '7d'; // 7 days

  constructor() {
    this.secret = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
    
    if (this.secret === 'dev-secret-change-in-production' && process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET must be set in production');
    }
  }

  /**
   * Generate a JWT token
   */
  generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      issuer: 'devsecops-platform'
    });
  }

  /**
   * Verify and decode a JWT token
   */
  verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: 'devsecops-platform'
      }) as JWTPayload;
      
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw new Error('Token verification failed');
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch {
      return null;
    }
  }
}
