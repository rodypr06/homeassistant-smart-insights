import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import morgan from 'morgan';
import { securityConfig } from './config/security';
import { logger, httpLogger, securityLogger } from './utils/logger';
import apiRoutes from './routes/api';
import authRoutes from './routes/auth';

// Create Express app
const app = express();

// Trust proxy (important for rate limiting and IP detection)
app.set('trust proxy', 1);

// Security Headers
app.use(helmet(securityConfig.helmet));

// CORS Configuration
app.use(cors(securityConfig.cors));

// Compression
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP Request Logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => {
      httpLogger.info(message.trim());
    }
  }
}));

// Rate Limiting - Temporarily disabled for development
// TODO: Re-enable with proper configuration
/*
const limiter = rateLimit({
  ...securityConfig.rateLimit,
  handler: (req, res) => {
    securityLogger.rateLimitExceeded(
      req.ip,
      req.path,
      req.get('User-Agent')
    );
    
    res.status(429).json(securityConfig.rateLimit.message);
  },
});

app.use(limiter);
*/

// Session Configuration (if using session-based auth)
app.use(session({
  ...securityConfig.session,
  resave: false,
  saveUninitialized: false,
  store: undefined, // TODO: Add Redis session store if needed
}));

// Security middleware for suspicious activity detection
app.use((req, res, next) => {
  // Log suspicious patterns
  const userAgent = req.get('User-Agent') || '';
  const suspiciousPatterns = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /nessus/i,
    /openvas/i,
    /burp/i,
    /owasp/i,
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i,
  ];

  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(userAgent) || 
    pattern.test(req.url) || 
    pattern.test(JSON.stringify(req.body))
  );

  if (isSuspicious) {
    securityLogger.suspiciousActivity(
      'Suspicious request detected',
      req.ip,
      {
        userAgent,
        url: req.url,
        method: req.method,
        body: req.body,
      }
    );
  }

  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Health check endpoint (public)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API Documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'HomeAssistant Smart Insight API',
    version: '1.0.0',
    description: 'Secure backend API proxy for HomeAssistant Smart Insight WebApp',
    endpoints: {
      auth: {
        'POST /api/auth/login': 'Authenticate user and get JWT token',
        'POST /api/auth/logout': 'Logout and invalidate session',
        'GET /api/auth/me': 'Get current user information',
      },
      api: {
        'GET /api/health': 'Service health check',
        'POST /api/openai/chat': 'OpenAI chat completion proxy (requires auth)',
        'POST /api/influxdb/query': 'InfluxDB query proxy (optional auth)',
        'ALL /api/homeassistant/*': 'HomeAssistant API proxy (requires auth)',
        'DELETE /api/cache/:key': 'Delete cache key (requires admin)',
        'DELETE /api/cache': 'Flush all cache (requires admin)',
      },
    },
    security: {
      authentication: 'JWT Bearer token or session-based',
      rateLimit: `${securityConfig.rateLimit.max} requests per ${securityConfig.rateLimit.windowMs / 1000} seconds`,
      cors: securityConfig.cors.origin,
    },
  });
});

// 404 Handler
app.use('*', (req, res) => {
  logger.warn('404 - Route not found', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  
  res.status(404).json({
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    path: req.path,
  });
});

// Global Error Handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
  });

  // Don't leak error details in production
  const isDevelopment = securityConfig.isDevelopment;
  
  res.status(error.status || 500).json({
    error: isDevelopment ? error.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(isDevelopment && { stack: error.stack }),
  });
});

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  
  // Exit the process after logging
  process.exit(1);
});

// Start server
const PORT = securityConfig.port;
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server started on port ${PORT}`, {
    environment: securityConfig.nodeEnv,
    port: PORT,
    cors: securityConfig.cors.origin,
    rateLimit: `${securityConfig.rateLimit.max} requests per ${securityConfig.rateLimit.windowMs / 1000}s`,
  });
});

// Handle server errors
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use`);
  } else {
    logger.error('Server error', { error: error.message });
  }
  process.exit(1);
});

export default app; 