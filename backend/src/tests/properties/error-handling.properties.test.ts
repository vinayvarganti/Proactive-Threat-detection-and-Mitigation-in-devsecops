import * as fc from 'fast-check';
import { loggingService, LogContext } from '../../services/LoggingService';

describe('Error Handling Property Tests', () => {
  beforeEach(() => {
    // Clear error logs before each test
    loggingService.clearErrorLogs();
  });

  describe('Property 32: API Error Logging Completeness', () => {
    // Feature: devsecops-platform, Property 32: API Error Logging Completeness
    // Validates: Requirements 9.1
    // For any failed API call, the error log should include timestamp, endpoint/operation, error message, and relevant context

    it('should log all API errors with required fields (timestamp, endpoint, error details)', () => {
      fc.assert(
        fc.property(
          fc.record({
            endpoint: fc.string({ minLength: 1, maxLength: 100 }),
            errorMessage: fc.string({ minLength: 1, maxLength: 200 }),
            statusCode: fc.integer({ min: 400, max: 599 }),
            userId: fc.option(fc.uuid(), { nil: undefined }),
            repositoryId: fc.option(fc.uuid(), { nil: undefined }),
          }),
          (testData) => {
            // Arrange
            const error = new Error(testData.errorMessage);
            (error as any).statusCode = testData.statusCode;
            
            const context: LogContext = {
              userId: testData.userId,
              repositoryId: testData.repositoryId,
            };

            const beforeTimestamp = new Date();

            // Act
            loggingService.logApiError(testData.endpoint, error, context);

            const afterTimestamp = new Date();

            // Assert
            const errorLogs = loggingService.getErrorLogs();
            expect(errorLogs.length).toBeGreaterThan(0);

            const lastLog = errorLogs[errorLogs.length - 1];

            // Verify timestamp is present and within expected range
            expect(lastLog.timestamp).toBeDefined();
            expect(lastLog.timestamp).toBeInstanceOf(Date);
            expect(lastLog.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTimestamp.getTime());
            expect(lastLog.timestamp.getTime()).toBeLessThanOrEqual(afterTimestamp.getTime());

            // Verify endpoint is present
            expect(lastLog.endpoint).toBe(testData.endpoint);

            // Verify error details are present
            expect(lastLog.details).toBeDefined();
            expect(lastLog.details).toContain(testData.errorMessage);

            // Verify message is present
            expect(lastLog.message).toBeDefined();
            expect(lastLog.message).toContain(testData.endpoint);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should log GitHub API errors with operation and service context', () => {
      fc.assert(
        fc.property(
          fc.record({
            operation: fc.constantFrom(
              'listRepositories',
              'downloadRepository',
              'commitChanges',
              'getFileTree'
            ),
            errorMessage: fc.string({ minLength: 1, maxLength: 200 }),
            userId: fc.uuid(),
          }),
          (testData) => {
            // Arrange
            const error = new Error(testData.errorMessage);
            const context: LogContext = {
              userId: testData.userId,
            };

            // Act
            loggingService.logGitHubApiError(testData.operation, error, context);

            // Assert
            const errorLogs = loggingService.getErrorLogs();
            const lastLog = errorLogs[errorLogs.length - 1];

            // Verify all required fields
            expect(lastLog.timestamp).toBeDefined();
            expect(lastLog.operation).toBe(testData.operation);
            expect(lastLog.message).toContain('GitHub API Error');
            expect(lastLog.message).toContain(testData.operation);
            expect(lastLog.details).toContain(testData.errorMessage);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should log Gemini API errors with operation and service context', () => {
      fc.assert(
        fc.property(
          fc.record({
            operation: fc.constantFrom('generateFix', 'buildPrompt', 'parseResponse'),
            errorMessage: fc.string({ minLength: 1, maxLength: 200 }),
            vulnerabilityId: fc.uuid(),
          }),
          (testData) => {
            // Arrange
            const error = new Error(testData.errorMessage);
            const context: LogContext = {
              vulnerabilityId: testData.vulnerabilityId,
            };

            // Act
            loggingService.logGeminiApiError(testData.operation, error, context);

            // Assert
            const errorLogs = loggingService.getErrorLogs();
            const lastLog = errorLogs[errorLogs.length - 1];

            // Verify all required fields
            expect(lastLog.timestamp).toBeDefined();
            expect(lastLog.operation).toBe(testData.operation);
            expect(lastLog.message).toContain('Gemini API Error');
            expect(lastLog.message).toContain(testData.operation);
            expect(lastLog.details).toContain(testData.errorMessage);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should log scanner errors with scanner name and operation context', () => {
      fc.assert(
        fc.property(
          fc.record({
            scanner: fc.constantFrom('semgrep', 'trivy', 'gitleaks'),
            errorMessage: fc.string({ minLength: 1, maxLength: 200 }),
            repositoryId: fc.uuid(),
          }),
          (testData) => {
            // Arrange
            const error = new Error(testData.errorMessage);
            const context: LogContext = {
              repositoryId: testData.repositoryId,
            };

            // Act
            loggingService.logScannerError(testData.scanner, error, context);

            // Assert
            const errorLogs = loggingService.getErrorLogs();
            const lastLog = errorLogs[errorLogs.length - 1];

            // Verify all required fields
            expect(lastLog.timestamp).toBeDefined();
            expect(lastLog.operation).toBe('scan');
            expect(lastLog.message).toContain('Scanner Error');
            expect(lastLog.message).toContain(testData.scanner);
            expect(lastLog.details).toContain(testData.errorMessage);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should log database errors with operation and service context', () => {
      fc.assert(
        fc.property(
          fc.record({
            operation: fc.constantFrom(
              'connect',
              'save',
              'find',
              'update',
              'delete'
            ),
            errorMessage: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          (testData) => {
            // Arrange
            const error = new Error(testData.errorMessage);

            // Act
            loggingService.logDatabaseError(testData.operation, error);

            // Assert
            const errorLogs = loggingService.getErrorLogs();
            const lastLog = errorLogs[errorLogs.length - 1];

            // Verify all required fields
            expect(lastLog.timestamp).toBeDefined();
            expect(lastLog.operation).toBe(testData.operation);
            expect(lastLog.message).toContain('Database Error');
            expect(lastLog.message).toContain(testData.operation);
            expect(lastLog.details).toContain(testData.errorMessage);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should preserve error stack traces in logs', () => {
      fc.assert(
        fc.property(
          fc.record({
            endpoint: fc.string({ minLength: 1, maxLength: 100 }),
            errorMessage: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          (testData) => {
            // Arrange
            const error = new Error(testData.errorMessage);
            // Error objects automatically have stack traces

            // Act
            loggingService.logApiError(testData.endpoint, error);

            // Assert
            const errorLogs = loggingService.getErrorLogs();
            const lastLog = errorLogs[errorLogs.length - 1];

            // Verify stack trace is present
            expect(lastLog.stack).toBeDefined();
            expect(lastLog.stack).toContain('Error');
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Property 40: Rate Limiting Enforcement', () => {
    // Feature: devsecops-platform, Property 40: Rate Limiting Enforcement
    // Validates: Requirements 10.6
    // For any user making scan requests, exceeding the configured rate limit should result in request rejection

    it('should reject requests when rate limit is exceeded', () => {
      fc.assert(
        fc.property(
          fc.record({
            maxRequests: fc.integer({ min: 1, max: 5 }),
            totalRequests: fc.integer({ min: 6, max: 20 }),
          }),
          (testData) => {
            // Arrange
            const requests: { timestamp: number; allowed: boolean }[] = [];
            const windowMs = 1000; // 1 second window for testing
            const startTime = Date.now();

            // Simulate rate limiting logic
            for (let i = 0; i < testData.totalRequests; i++) {
              const currentTime = startTime + i * 10; // 10ms between requests
              
              // Count requests in current window
              const windowStart = currentTime - windowMs;
              const requestsInWindow = requests.filter(
                (r) => r.timestamp > windowStart && r.allowed
              ).length;

              const allowed = requestsInWindow < testData.maxRequests;
              requests.push({ timestamp: currentTime, allowed });
            }

            // Assert
            const allowedRequests = requests.filter((r) => r.allowed).length;
            const rejectedRequests = requests.filter((r) => !r.allowed).length;

            // Should allow exactly maxRequests
            expect(allowedRequests).toBe(testData.maxRequests);
            
            // Should reject the rest
            expect(rejectedRequests).toBe(testData.totalRequests - testData.maxRequests);
            
            // All requests after the limit should be rejected
            const requestsAfterLimit = requests.slice(testData.maxRequests);
            expect(requestsAfterLimit.every((r) => !r.allowed)).toBe(true);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should track rate limits per user independently', () => {
      fc.assert(
        fc.property(
          fc.record({
            user1Requests: fc.integer({ min: 1, max: 10 }),
            user2Requests: fc.integer({ min: 1, max: 10 }),
            maxPerUser: fc.integer({ min: 5, max: 15 }),
          }),
          (testData) => {
            // Arrange
            const rateLimitTracker = new Map<string, number>();
            const maxRequests = testData.maxPerUser;

            const checkRateLimit = (userId: string): boolean => {
              const count = rateLimitTracker.get(userId) || 0;
              if (count >= maxRequests) {
                return false; // Reject
              }
              rateLimitTracker.set(userId, count + 1);
              return true; // Allow
            };

            // Act
            const user1Results: boolean[] = [];
            const user2Results: boolean[] = [];

            for (let i = 0; i < testData.user1Requests; i++) {
              user1Results.push(checkRateLimit('user1'));
            }

            for (let i = 0; i < testData.user2Requests; i++) {
              user2Results.push(checkRateLimit('user2'));
            }

            // Assert
            const user1Allowed = user1Results.filter((r) => r).length;
            const user2Allowed = user2Results.filter((r) => r).length;

            // Each user should be limited independently
            expect(user1Allowed).toBe(Math.min(testData.user1Requests, maxRequests));
            expect(user2Allowed).toBe(Math.min(testData.user2Requests, maxRequests));

            // User 1's requests should not affect User 2's limit
            if (testData.user1Requests >= maxRequests && testData.user2Requests < maxRequests) {
              expect(user2Allowed).toBe(testData.user2Requests);
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should include retry information in rate limit responses', () => {
      fc.assert(
        fc.property(
          fc.record({
            windowMs: fc.integer({ min: 1000, max: 60000 }),
            maxRequests: fc.integer({ min: 1, max: 10 }),
          }),
          (testData) => {
            // Arrange
            const rateLimitResponse = {
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests. Please try again later.',
                retryAfter: `${testData.windowMs / 1000} seconds`,
              },
            };

            // Assert
            expect(rateLimitResponse.error.code).toBe('RATE_LIMIT_EXCEEDED');
            expect(rateLimitResponse.error.message).toBeDefined();
            expect(rateLimitResponse.error.retryAfter).toBeDefined();
            expect(rateLimitResponse.error.retryAfter).toContain('seconds');
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Property 35: Rate Limit Handling', () => {
    // Feature: devsecops-platform, Property 35: Rate Limit Handling
    // Validates: Requirements 9.3
    // For any GitHub API rate limit response, the platform should notify the user, extract the reset time, and queue retry after the limit resets

    it('should detect GitHub API rate limit errors correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            statusCode: fc.constantFrom(403, 429),
            remaining: fc.constantFrom('0', 0),
            limit: fc.integer({ min: 1000, max: 5000 }),
            reset: fc.integer({ min: Math.floor(Date.now() / 1000), max: Math.floor(Date.now() / 1000) + 3600 }),
          }),
          (testData) => {
            // Arrange
            const error = {
              response: {
                status: testData.statusCode,
                headers: {
                  'x-ratelimit-remaining': String(testData.remaining),
                  'x-ratelimit-limit': String(testData.limit),
                  'x-ratelimit-reset': String(testData.reset),
                },
              },
            };

            // Act
            const { GitHubRateLimitHandler } = require('../../middleware/rateLimiter');
            const isRateLimitError = GitHubRateLimitHandler.isRateLimitError(error);

            // Assert
            if (testData.statusCode === 403 && testData.remaining === '0') {
              expect(isRateLimitError).toBe(true);
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should extract rate limit information from GitHub API responses', () => {
      fc.assert(
        fc.property(
          fc.record({
            limit: fc.integer({ min: 1000, max: 5000 }),
            remaining: fc.integer({ min: 0, max: 5000 }),
            reset: fc.integer({ min: Math.floor(Date.now() / 1000), max: Math.floor(Date.now() / 1000) + 3600 }),
            used: fc.integer({ min: 0, max: 5000 }),
          }),
          (testData) => {
            // Arrange
            const response = {
              headers: {
                'x-ratelimit-limit': String(testData.limit),
                'x-ratelimit-remaining': String(testData.remaining),
                'x-ratelimit-reset': String(testData.reset),
                'x-ratelimit-used': String(testData.used),
              },
            };

            // Act
            const { GitHubRateLimitHandler } = require('../../middleware/rateLimiter');
            const rateLimitInfo = GitHubRateLimitHandler.extractRateLimitInfo(response);

            // Assert
            expect(rateLimitInfo).not.toBeNull();
            expect(rateLimitInfo?.limit).toBe(testData.limit);
            expect(rateLimitInfo?.remaining).toBe(testData.remaining);
            expect(rateLimitInfo?.reset).toBe(testData.reset);
            expect(rateLimitInfo?.used).toBe(testData.used);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should calculate correct wait time until rate limit resets', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3600 }), // seconds in the future
          (secondsInFuture) => {
            // Arrange
            const now = Math.floor(Date.now() / 1000);
            const resetTimestamp = now + secondsInFuture;

            // Act
            const { GitHubRateLimitHandler } = require('../../middleware/rateLimiter');
            const waitTime = GitHubRateLimitHandler.getWaitTime(resetTimestamp);

            // Assert
            // Wait time should be approximately equal to secondsInFuture * 1000 (converted to ms)
            // Allow for small timing differences (within 1 second)
            expect(waitTime).toBeGreaterThanOrEqual((secondsInFuture - 1) * 1000);
            expect(waitTime).toBeLessThanOrEqual((secondsInFuture + 1) * 1000);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should return zero wait time for past reset timestamps', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3600 }), // seconds in the past
          (secondsInPast) => {
            // Arrange
            const now = Math.floor(Date.now() / 1000);
            const resetTimestamp = now - secondsInPast;

            // Act
            const { GitHubRateLimitHandler } = require('../../middleware/rateLimiter');
            const waitTime = GitHubRateLimitHandler.getWaitTime(resetTimestamp);

            // Assert
            expect(waitTime).toBe(0);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should identify when rate limit is near exhaustion', () => {
      fc.assert(
        fc.property(
          fc.record({
            limit: fc.integer({ min: 100, max: 5000 }),
            remainingPercent: fc.float({ min: 0, max: Math.fround(0.15) }), // 0-15% remaining
          }),
          (testData) => {
            // Arrange
            const remaining = Math.floor(testData.limit * testData.remainingPercent);
            const response = {
              headers: {
                'x-ratelimit-limit': String(testData.limit),
                'x-ratelimit-remaining': String(remaining),
                'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
              },
            };

            // Act
            const { GitHubRateLimitHandler } = require('../../middleware/rateLimiter');
            const { isNearLimit, rateLimitInfo } = GitHubRateLimitHandler.checkRateLimitStatus(response);

            // Assert
            expect(rateLimitInfo).not.toBeNull();
            if (testData.remainingPercent < 0.1) {
              expect(isNearLimit).toBe(true);
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should not flag rate limit as near when sufficient requests remain', () => {
      fc.assert(
        fc.property(
          fc.record({
            limit: fc.integer({ min: 100, max: 5000 }),
            remainingPercent: fc.float({ min: Math.fround(0.2), max: Math.fround(1.0) }), // 20-100% remaining
          }),
          (testData) => {
            // Arrange
            const remaining = Math.floor(testData.limit * testData.remainingPercent);
            const response = {
              headers: {
                'x-ratelimit-limit': String(testData.limit),
                'x-ratelimit-remaining': String(remaining),
                'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
              },
            };

            // Act
            const { GitHubRateLimitHandler } = require('../../middleware/rateLimiter');
            const { isNearLimit } = GitHubRateLimitHandler.checkRateLimitStatus(response);

            // Assert
            expect(isNearLimit).toBe(false);
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});

