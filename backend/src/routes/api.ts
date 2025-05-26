import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { OpenAI } from 'openai';
import { InfluxDB } from '@influxdata/influxdb-client';
import { securityConfig, validateApiKey } from '../config/security';
import { authenticateJWT, optionalAuth, requirePermission } from '../middleware/auth';
import { logger, securityLogger, performanceLogger, errorLogger } from '../utils/logger';
import { cacheService } from '../services/cache';

const router = Router();

// Initialize OpenAI client (if configured)
let openaiClient: OpenAI | null = null;
if (securityConfig.apiKeys.openai) {
  openaiClient = new OpenAI({
    apiKey: securityConfig.apiKeys.openai,
  });
}

// Initialize InfluxDB client
let influxClient: InfluxDB | null = null;
if (securityConfig.influxdb.url) {
  influxClient = new InfluxDB({
    url: securityConfig.influxdb.url,
    token: securityConfig.influxdb.token || '',
  });
}

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  const startTime = Date.now();
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      openai: !!openaiClient,
      influxdb: !!influxClient,
      homeassistant: !!securityConfig.homeassistant.url,
      cache: cacheService.isConnected(),
    },
    version: process.env['npm_package_version'] || '1.0.0',
    environment: securityConfig.nodeEnv,
  };

  const duration = Date.now() - startTime;
  performanceLogger.apiCall('/api/health', duration, 200, req.user?.id);
  
  res.json(health);
});

// OpenAI Chat Completion Proxy
router.post('/openai/chat',
  authenticateJWT,
  requirePermission(['ai:chat', 'ai:*']),
  [
    body('messages').isArray().withMessage('Messages must be an array'),
    body('model').optional().isString().withMessage('Model must be a string'),
    body('temperature').optional().isFloat({ min: 0, max: 2 }).withMessage('Temperature must be between 0 and 2'),
    body('max_tokens').optional().isInt({ min: 1, max: 4096 }).withMessage('Max tokens must be between 1 and 4096'),
  ],
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        errorLogger.validationError(errors.array(), req);
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      if (!openaiClient) {
        return res.status(503).json({
          error: 'OpenAI service not configured',
          code: 'SERVICE_UNAVAILABLE',
        });
      }

      // Check cache first
      const cacheKey = `openai:chat:${JSON.stringify(req.body)}`;
      const cachedResponse = await cacheService.get(cacheKey);
      
      if (cachedResponse) {
        logger.info('OpenAI response served from cache', { userId: req.user?.id });
        return res.json(cachedResponse);
      }

      // Log the request (without sensitive data)
      securityLogger.dataAccess(
        req.user!.id,
        'openai:chat',
        'create',
        req.ip
      );

      // Make OpenAI API call
      const response = await openaiClient.chat.completions.create({
        model: req.body.model || 'gpt-3.5-turbo',
        messages: req.body.messages,
        temperature: req.body.temperature || 0.7,
        max_tokens: req.body.max_tokens || 1000,
        user: req.user!.id, // For OpenAI usage tracking
      });

      // Cache the response for 5 minutes
      await cacheService.set(cacheKey, response, 300);

      const duration = Date.now() - startTime;
      performanceLogger.externalApiCall('openai', '/chat/completions', duration, 200);
      
      res.json(response);

    } catch (error) {
      const duration = Date.now() - startTime;
      errorLogger.apiError(error as Error, req, { service: 'openai' });
      
      // Handle OpenAI API errors properly
      if (error && typeof error === 'object' && 'error' in error) {
        const openaiError = error as any;
        const statusCode = openaiError.status || 500;
        
        performanceLogger.externalApiCall('openai', '/chat/completions', duration, statusCode);
        
        // Check for actual rate limit errors
        if (statusCode === 429 || (openaiError.error?.type === 'rate_limit_exceeded')) {
          res.status(429).json({
            error: 'OpenAI rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            message: openaiError.error?.message || 'Rate limit exceeded',
            retryAfter: 60,
          });
        } else if (statusCode === 401) {
          res.status(503).json({
            error: 'OpenAI API key invalid or missing',
            code: 'API_KEY_ERROR',
            message: openaiError.error?.message || 'Invalid API key',
          });
        } else if (statusCode === 400) {
          res.status(400).json({
            error: 'Invalid request to OpenAI',
            code: 'INVALID_REQUEST',
            message: openaiError.error?.message || 'Bad request',
          });
        } else {
          res.status(statusCode).json({
            error: 'OpenAI API error',
            code: 'OPENAI_API_ERROR',
            message: openaiError.error?.message || 'Unknown OpenAI error',
          });
        }
      } else {
        // Handle other types of errors (network, etc.)
        performanceLogger.externalApiCall('openai', '/chat/completions', duration, 500);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        res.status(500).json({
          error: 'OpenAI service error',
          code: 'EXTERNAL_SERVICE_ERROR',
          message: errorMessage,
        });
      }
    }
  }
);

// InfluxDB Query Proxy
router.post('/influxdb/query',
  optionalAuth, // Allow both authenticated and unauthenticated access
  [
    body('query').isString().withMessage('Query must be a string'),
    body('database').optional().isString().withMessage('Database must be a string'),
  ],
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        errorLogger.validationError(errors.array(), req);
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      if (!influxClient) {
        return res.status(503).json({
          error: 'InfluxDB service not configured',
          code: 'SERVICE_UNAVAILABLE',
        });
      }

      // Check cache first
      const cacheKey = `influxdb:query:${JSON.stringify(req.body)}`;
      const cachedResponse = await cacheService.get(cacheKey);
      
      if (cachedResponse) {
        logger.info('InfluxDB response served from cache', { userId: req.user?.id });
        return res.json(cachedResponse);
      }

      // Log data access
      if (req.user) {
        securityLogger.dataAccess(
          req.user.id,
          'influxdb:query',
          'read',
          req.ip
        );
      }

      const { query, database } = req.body;
      
      // For InfluxDB 1.x (InfluxQL)
      if (database) {
        const url = `${securityConfig.influxdb.url}/query?db=${database}&q=${encodeURIComponent(query)}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: securityConfig.influxdb.token ? {
            'Authorization': `Token ${securityConfig.influxdb.token}`,
          } : {},
        });

        if (!response.ok) {
          throw new Error(`InfluxDB query failed: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Cache for 1 minute
        await cacheService.set(cacheKey, data, securityConfig.cache.ttl.influxData);
        
        const duration = Date.now() - startTime;
        performanceLogger.externalApiCall('influxdb', '/query', duration, response.status);
        
        res.json(data);
      } else {
        // For InfluxDB 2.x (Flux)
        const queryApi = influxClient.getQueryApi(securityConfig.influxdb.org);
        const results: any[] = [];

        for await (const { values, tableMeta } of queryApi.iterateRows(query)) {
          const row: any = {};
          tableMeta.columns.forEach((column, index) => {
            row[column.label] = values[index];
          });
          results.push(row);
        }

        // Cache for 1 minute
        await cacheService.set(cacheKey, results, securityConfig.cache.ttl.influxData);
        
        const duration = Date.now() - startTime;
        performanceLogger.externalApiCall('influxdb', '/query', duration, 200);
        
        res.json(results);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      errorLogger.apiError(error as Error, req, { service: 'influxdb' });
      performanceLogger.externalApiCall('influxdb', '/query', duration, 500);
      
      res.status(500).json({
        error: 'InfluxDB service error',
        code: 'EXTERNAL_SERVICE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// HomeAssistant API Proxy
router.all('/homeassistant/*',
  authenticateJWT,
  requirePermission(['homeassistant:*']),
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      if (!securityConfig.homeassistant.url) {
        return res.status(503).json({
          error: 'HomeAssistant service not configured',
          code: 'SERVICE_UNAVAILABLE',
        });
      }

      if (!securityConfig.apiKeys.homeassistant) {
        return res.status(503).json({
          error: 'HomeAssistant token not configured',
          code: 'SERVICE_UNAVAILABLE',
        });
      }

      // Extract the path after /homeassistant/
      const path = req.path.replace('/api/homeassistant/', '');
      const url = `${securityConfig.homeassistant.url}/api/${path}`;

      // Log data access
      securityLogger.dataAccess(
        req.user!.id,
        `homeassistant:${path}`,
        req.method.toLowerCase(),
        req.ip
      );

      // Forward the request to HomeAssistant
      const fetchOptions: RequestInit = {
        method: req.method,
        headers: {
          'Authorization': `Bearer ${securityConfig.apiKeys.homeassistant}`,
          'Content-Type': 'application/json',
          ...req.headers,
        },
      };

      if (req.method !== 'GET') {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const response = await fetch(url, fetchOptions);

      const data = await response.json();
      
      const duration = Date.now() - startTime;
      performanceLogger.externalApiCall('homeassistant', path, duration, response.status);
      
      res.status(response.status).json(data);

    } catch (error) {
      const duration = Date.now() - startTime;
      errorLogger.apiError(error as Error, req, { service: 'homeassistant' });
      performanceLogger.externalApiCall('homeassistant', req.path, duration, 500);
      
      res.status(500).json({
        error: 'HomeAssistant service error',
        code: 'EXTERNAL_SERVICE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Cache management endpoints
router.delete('/cache/:key',
  authenticateJWT,
  requirePermission(['cache:delete', 'admin:*']),
  async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      await cacheService.delete(key);
      
      logger.info('Cache key deleted', { key, userId: req.user!.id });
      res.json({ message: 'Cache key deleted successfully' });
    } catch (error) {
      errorLogger.apiError(error as Error, req);
      res.status(500).json({ error: 'Failed to delete cache key' });
    }
  }
);

router.delete('/cache',
  authenticateJWT,
  requirePermission(['cache:flush', 'admin:*']),
  async (req: Request, res: Response) => {
    try {
      await cacheService.flush();
      
      logger.info('Cache flushed', { userId: req.user!.id });
      res.json({ message: 'Cache flushed successfully' });
    } catch (error) {
      errorLogger.apiError(error as Error, req);
      res.status(500).json({ error: 'Failed to flush cache' });
    }
  }
);

export default router; 