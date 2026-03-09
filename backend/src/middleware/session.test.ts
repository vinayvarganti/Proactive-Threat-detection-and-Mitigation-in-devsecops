import { Request, Response, NextFunction } from 'express';
import { requireAuth, validateSession } from './session';

describe('Session Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      session: {} as any,
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    nextFunction = jest.fn();
  });

  describe('requireAuth', () => {
    it('should call next() when session exists with userId', () => {
      mockRequest.session = { userId: 'test-user-123' } as any;

      requireAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 when session does not exist', () => {
      mockRequest.session = undefined;

      requireAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please log in.'
          })
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 when session exists but userId is missing', () => {
      mockRequest.session = {} as any;

      requireAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('validateSession', () => {
    it('should call next() when session is valid and not expired', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      mockRequest.session = {
        userId: 'test-user-123',
        tokenExpiresAt: futureDate
      } as any;

      await validateSession(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 when session does not exist', async () => {
      mockRequest.session = undefined;

      await validateSession(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'UNAUTHORIZED',
            message: 'No active session found'
          })
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 when token has expired', async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      mockRequest.session = {
        userId: 'test-user-123',
        tokenExpiresAt: pastDate
      } as any;

      await validateSession(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'TOKEN_EXPIRED',
            message: 'Your session has expired. Please log in again.'
          })
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next() when session exists without tokenExpiresAt', async () => {
      mockRequest.session = {
        userId: 'test-user-123'
      } as any;

      await validateSession(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});
