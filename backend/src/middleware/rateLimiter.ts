import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import loggingService from '../services/LoggingService';

/**
 * Rate limiter for scan operations
 * Limits users to 10 scans per hour
 */
export const scanRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each user to 10 requests per windowMs
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many scan requests. Please try again later.',
      retryAfter: '1 hour',
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    loggingService.warn('Rate limit exceeded for scan operation', {
      endpoint: req.path,
      userId: (req.session as any)?.userId,
      ip: req.ip,
    });

    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many scan requests. Please try again later.',
        retryAfter: '1 hour',
      },
    });
  },
  // Use user ID from session if available, otherwise fall back to IP
  keyGenerator: (req: Request) => {
    return (req.session as any)?.userId || req.ip || 'unknown';
  },
});

/**
 * Rate limiter for general API operations
 * Limits users to 100 requests per 15 minutes
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each user to 100 requests per windowMs
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
      retryAfter: '15 minutes',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    loggingService.warn('Rate limit exceeded for API operation', {
      endpoint: req.path,
      userId: (req.session as any)?.userId,
      ip: req.ip,
    });

    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter: '15 minutes',
      },
    });
  },
  keyGenerator: (req: Request) => {
    return (req.session as any)?.userId || req.ip || 'unknown';
  },
});

/**
 * GitHub API rate limit handler
 * Handles rate limit responses from GitHub API and implements retry logic
 */
export interface GitHubRateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  used: number;
}

export class GitHubRateLimitHandler {
  /**
   * Check if a GitHub API error is a rate limit error
   */
  static isRateLimitError(error: any): boolean {
    return (
      error?.response?.status === 403 &&
      error?.response?.headers?.['x-ratelimit-remaining'] === '0'
    );
  }

  /**
   * Extract rate limit information from GitHub API response
   */
  static extractRateLimitInfo(response: any): GitHubRateLimitInfo | null {
    const headers = response?.headers;
    if (!headers) return null;

    const limit = headers['x-ratelimit-limit'];
    const remaining = headers['x-ratelimit-remaining'];
    const reset = headers['x-ratelimit-reset'];
    const used = headers['x-ratelimit-used'];

    if (limit === undefined || remaining === undefined || reset === undefined) {
      return null;
    }

    return {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      reset: parseInt(reset, 10),
      used: used ? parseInt(used, 10) : 0,
    };
  }

  /**
   * Calculate wait time until rate limit resets
   */
  static getWaitTime(resetTimestamp: number): number {
    const now = Math.floor(Date.now() / 1000);
    const waitTime = Math.max(0, resetTimestamp - now);
    return waitTime * 1000; // Convert to milliseconds
  }

  /**
   * Handle GitHub API rate limit error
   * Returns a promise that resolves after the rate limit resets
   */
  static async handleRateLimit(
    error: any,
    context?: { operation?: string; userId?: string }
  ): Promise<void> {
    if (!this.isRateLimitError(error)) {
      throw error; // Not a rate limit error, rethrow
    }

    const rateLimitInfo = this.extractRateLimitInfo(error.response);
    
    if (!rateLimitInfo) {
      loggingService.error(
        'GitHub API rate limit exceeded but could not extract reset time',
        error,
        context
      );
      throw error;
    }

    const waitTime = this.getWaitTime(rateLimitInfo.reset);
    const resetDate = new Date(rateLimitInfo.reset * 1000);

    loggingService.warn(
      `GitHub API rate limit exceeded. Waiting until ${resetDate.toISOString()}`,
      {
        ...context,
        rateLimitInfo,
        waitTimeMs: waitTime,
      }
    );

    // Wait until rate limit resets
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    loggingService.info('GitHub API rate limit reset. Retrying operation.', context);
  }

  /**
   * Wrap a GitHub API call with automatic rate limit handling and retry
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    context?: { operation?: string; userId?: string },
    maxRetries: number = 1
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (this.isRateLimitError(error) && attempt < maxRetries) {
          await this.handleRateLimit(error, context);
          // Continue to next iteration to retry
        } else {
          throw error; // Not a rate limit error or max retries exceeded
        }
      }
    }

    throw lastError;
  }

  /**
   * Check rate limit status without making an API call
   * Useful for proactive rate limit management
   */
  static checkRateLimitStatus(response: any): {
    isNearLimit: boolean;
    rateLimitInfo: GitHubRateLimitInfo | null;
  } {
    const rateLimitInfo = this.extractRateLimitInfo(response);
    
    if (!rateLimitInfo) {
      return { isNearLimit: false, rateLimitInfo: null };
    }

    // Consider "near limit" if less than 10% remaining
    const isNearLimit = rateLimitInfo.remaining < rateLimitInfo.limit * 0.1;

    if (isNearLimit) {
      loggingService.warn('GitHub API rate limit is near exhaustion', {
        rateLimitInfo,
      });
    }

    return { isNearLimit, rateLimitInfo };
  }
}
