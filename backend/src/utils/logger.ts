import winston from 'winston';
import { securityConfig } from '../config/security';

// Custom log levels for security events
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    security: 2,
    info: 3,
    http: 4,
    debug: 5,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    security: 'magenta',
    info: 'green',
    http: 'cyan',
    debug: 'blue',
  },
};

// Add colors to winston
winston.addColors(customLevels.colors);

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
    });
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  levels: customLevels.levels,
  level: securityConfig.isDevelopment ? 'debug' : 'info',
  format: logFormat,
  defaultMeta: {
    service: 'homeassistant-smart-insight-backend',
    environment: securityConfig.nodeEnv,
  },
  transports: [
    // Console transport for development
    ...(securityConfig.isDevelopment
      ? [
          new winston.transports.Console({
            format: consoleFormat,
          }),
        ]
      : []),

    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // File transport for security events
    new winston.transports.File({
      filename: 'logs/security.log',
      level: 'security',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

// Security-specific logging functions
export const securityLogger = {
  authSuccess: (userId: string, ip: string, userAgent?: string) => {
    logger.log('security', 'Authentication successful', {
      event: 'auth_success',
      userId,
      ip,
      userAgent,
    });
  },

  authFailure: (reason: string, ip: string, userAgent?: string, email?: string) => {
    logger.log('security', 'Authentication failed', {
      event: 'auth_failure',
      reason,
      ip,
      userAgent,
      email,
    });
  },

  apiKeyUsage: (apiKey: string, endpoint: string, ip: string) => {
    logger.log('security', 'API key used', {
      event: 'api_key_usage',
      apiKey: apiKey.substring(0, 8) + '...',
      endpoint,
      ip,
    });
  },

  rateLimitExceeded: (ip: string, endpoint: string, userAgent?: string) => {
    logger.log('security', 'Rate limit exceeded', {
      event: 'rate_limit_exceeded',
      ip,
      endpoint,
      userAgent,
    });
  },

  suspiciousActivity: (description: string, ip: string, details?: Record<string, any>) => {
    logger.log('security', 'Suspicious activity detected', {
      event: 'suspicious_activity',
      description,
      ip,
      ...details,
    });
  },

  dataAccess: (userId: string, resource: string, action: string, ip: string) => {
    logger.log('security', 'Data access', {
      event: 'data_access',
      userId,
      resource,
      action,
      ip,
    });
  },
};

// HTTP request logging middleware
export const httpLogger = winston.createLogger({
  level: 'http',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/http.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Performance logging
export const performanceLogger = {
  apiCall: (endpoint: string, duration: number, statusCode: number, userId?: string) => {
    logger.info('API call completed', {
      event: 'api_performance',
      endpoint,
      duration,
      statusCode,
      userId,
    });
  },

  databaseQuery: (query: string, duration: number, recordCount?: number) => {
    logger.debug('Database query completed', {
      event: 'db_performance',
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      duration,
      recordCount,
    });
  },

  externalApiCall: (service: string, endpoint: string, duration: number, statusCode: number) => {
    logger.info('External API call completed', {
      event: 'external_api_performance',
      service,
      endpoint,
      duration,
      statusCode,
    });
  },
};

// Error logging with context
export const errorLogger = {
  apiError: (error: Error, req: any, context?: Record<string, any>) => {
    logger.error('API error occurred', {
      event: 'api_error',
      error: error.message,
      stack: error.stack,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      ...context,
    });
  },

  serviceError: (service: string, error: Error, context?: Record<string, any>) => {
    logger.error('Service error occurred', {
      event: 'service_error',
      service,
      error: error.message,
      stack: error.stack,
      ...context,
    });
  },

  validationError: (errors: any[], req: any) => {
    logger.warn('Validation error', {
      event: 'validation_error',
      errors,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userId: req.user?.id,
    });
  },
};

export default logger; 