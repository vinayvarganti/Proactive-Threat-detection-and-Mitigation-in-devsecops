import winston from 'winston';

export interface LogContext {
  endpoint?: string;
  operation?: string;
  userId?: string;
  repositoryId?: string;
  [key: string]: any;
}

export interface ErrorLogEntry {
  timestamp: Date;
  level: string;
  message: string;
  endpoint?: string;
  operation?: string;
  details?: any;
  stack?: string;
}

class LoggingService {
  private logger: winston.Logger;
  private errorLogs: ErrorLogEntry[] = [];

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
              return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
        }),
      ],
    });
  }

  /**
   * Log informational messages
   */
  info(message: string, context?: LogContext): void {
    this.logger.info(message, context);
  }

  /**
   * Log warning messages
   */
  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, context);
  }

  /**
   * Log error messages with structured format
   */
  error(message: string, error?: Error | any, context?: LogContext): void {
    const errorLog: ErrorLogEntry = {
      timestamp: new Date(),
      level: 'error',
      message,
      endpoint: context?.endpoint,
      operation: context?.operation,
      details: error?.message || error,
      stack: error?.stack,
    };

    // Store error log for retrieval
    this.errorLogs.push(errorLog);

    // Log to winston
    this.logger.error(message, {
      ...context,
      error: error?.message || error,
      stack: error?.stack,
    });

    // Notify admin for critical errors
    if (this.isCriticalError(error, context)) {
      this.notifyAdmin(errorLog);
    }
  }

  /**
   * Log debug messages
   */
  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, context);
  }

  /**
   * Log API errors with complete context
   */
  logApiError(
    endpoint: string,
    error: Error | any,
    additionalContext?: LogContext
  ): void {
    this.error(
      `API Error: ${endpoint}`,
      error,
      {
        endpoint,
        ...additionalContext,
      }
    );
  }

  /**
   * Log GitHub API errors
   */
  logGitHubApiError(
    operation: string,
    error: Error | any,
    context?: LogContext
  ): void {
    this.error(
      `GitHub API Error: ${operation}`,
      error,
      {
        operation,
        service: 'GitHub',
        ...context,
      }
    );
  }

  /**
   * Log Gemini API errors
   */
  logGeminiApiError(
    operation: string,
    error: Error | any,
    context?: LogContext
  ): void {
    this.error(
      `Gemini API Error: ${operation}`,
      error,
      {
        operation,
        service: 'Gemini',
        ...context,
      }
    );
  }

  /**
   * Log scanner errors
   */
  logScannerError(
    scanner: string,
    error: Error | any,
    context?: LogContext
  ): void {
    this.error(
      `Scanner Error: ${scanner}`,
      error,
      {
        scanner,
        operation: 'scan',
        ...context,
      }
    );
  }

  /**
   * Log database errors
   */
  logDatabaseError(
    operation: string,
    error: Error | any,
    context?: LogContext
  ): void {
    this.error(
      `Database Error: ${operation}`,
      error,
      {
        operation,
        service: 'MongoDB',
        ...context,
      }
    );
  }

  /**
   * Get recent error logs
   */
  getErrorLogs(limit: number = 100): ErrorLogEntry[] {
    return this.errorLogs.slice(-limit);
  }

  /**
   * Clear error logs
   */
  clearErrorLogs(): void {
    this.errorLogs = [];
  }

  /**
   * Determine if an error is critical
   */
  private isCriticalError(error: any, context?: LogContext): boolean {
    // Database connection failures
    if (context?.service === 'MongoDB' && error?.message?.includes('connection')) {
      return true;
    }

    // Authentication failures
    if (context?.operation?.includes('auth') && error?.statusCode === 401) {
      return true;
    }

    // System-level errors
    if (error?.code === 'ENOSPC' || error?.code === 'ENOMEM') {
      return true;
    }

    return false;
  }

  /**
   * Notify admin about critical errors (console for now)
   */
  private notifyAdmin(errorLog: ErrorLogEntry): void {
    console.error('='.repeat(80));
    console.error('CRITICAL ERROR - ADMIN NOTIFICATION');
    console.error('='.repeat(80));
    console.error(`Timestamp: ${errorLog.timestamp.toISOString()}`);
    console.error(`Message: ${errorLog.message}`);
    console.error(`Endpoint: ${errorLog.endpoint || 'N/A'}`);
    console.error(`Operation: ${errorLog.operation || 'N/A'}`);
    console.error(`Details: ${JSON.stringify(errorLog.details, null, 2)}`);
    if (errorLog.stack) {
      console.error(`Stack: ${errorLog.stack}`);
    }
    console.error('='.repeat(80));
  }
}

// Export singleton instance
export const loggingService = new LoggingService();
export default loggingService;
