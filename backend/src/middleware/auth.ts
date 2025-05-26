import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { securityConfig } from '../config/security';
import { logger } from '../utils/logger';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        permissions: string[];
      };
      apiKey?: string;
    }
    
    interface Session {
      user?: {
        id: string;
        email: string;
        role: string;
        permissions: string[];
      };
    }
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
}

// JWT Authentication Middleware
export const authenticateJWT = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ 
      error: 'Access token required',
      code: 'TOKEN_MISSING'
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, securityConfig.jwt.secret) as AuthenticatedUser;
    req.user = decoded;
    
    logger.info('User authenticated', { 
      userId: decoded.id, 
      email: decoded.email,
      ip: req.ip 
    });
    
    next();
  } catch (error) {
    logger.warn('JWT authentication failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ 
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
    } else {
      res.status(401).json({ 
        error: 'Authentication failed',
        code: 'AUTH_FAILED'
      });
    }
  }
};

// Optional JWT Authentication (for public endpoints with optional auth)
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, securityConfig.jwt.secret) as AuthenticatedUser;
    req.user = decoded;
  } catch (error) {
    // Log but don't fail for optional auth
    logger.debug('Optional auth failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip 
    });
  }

  next();
};

// API Key Authentication (for service-to-service communication)
export const authenticateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({ 
      error: 'API key required',
      code: 'API_KEY_MISSING'
    });
    return;
  }

  // In a real implementation, you'd validate against a database
  // For now, we'll use a simple validation
  if (!isValidApiKey(apiKey)) {
    logger.warn('Invalid API key attempt', { 
      apiKey: apiKey.substring(0, 8) + '...',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(401).json({ 
      error: 'Invalid API key',
      code: 'API_KEY_INVALID'
    });
    return;
  }

  req.apiKey = apiKey;
  logger.info('API key authenticated', { 
    apiKey: apiKey.substring(0, 8) + '...',
    ip: req.ip 
  });
  
  next();
};

// Role-based authorization middleware
export const requireRole = (roles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Insufficient permissions', { 
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        ip: req.ip
      });
      
      res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: allowedRoles
      });
      return;
    }

    next();
  };
};

// Permission-based authorization middleware
export const requirePermission = (permissions: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
    const userPermissions = req.user.permissions || [];
    
    const hasPermission = requiredPermissions.every(permission => 
      userPermissions.includes(permission) || userPermissions.includes('*')
    );

    if (!hasPermission) {
      logger.warn('Insufficient permissions', { 
        userId: req.user.id,
        userPermissions,
        requiredPermissions,
        ip: req.ip
      });
      
      res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: requiredPermissions
      });
      return;
    }

    next();
  };
};

// Generate JWT token
export const generateToken = (user: Omit<AuthenticatedUser, 'permissions'> & { permissions?: string[] }): string => {
  const payload: AuthenticatedUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions || []
  };

  return jwt.sign(payload, securityConfig.jwt.secret, {
    expiresIn: securityConfig.jwt.expiresIn,
    issuer: 'homeassistant-smart-insight',
    audience: 'homeassistant-smart-insight-client'
  });
};

// Validate API key (simplified implementation)
const isValidApiKey = (apiKey: string): boolean => {
  // In production, this would check against a database
  // For demo purposes, we'll accept keys that match a pattern
  const validApiKeyPattern = /^ha-si-[a-zA-Z0-9]{32}$/;
  return validApiKeyPattern.test(apiKey);
};

// Session-based authentication middleware
export const authenticateSession = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.session || !req.session.user) {
    res.status(401).json({ 
      error: 'Session authentication required',
      code: 'SESSION_REQUIRED'
    });
    return;
  }

  req.user = req.session.user;
  next();
};

// Logout helper
export const logout = (req: Request, res: Response): void => {
  if (req.session) {
    req.session.destroy((err: any) => {
      if (err) {
        logger.error('Session destruction failed', { error: err.message });
        res.status(500).json({ error: 'Logout failed' });
        return;
      }
      
      res.clearCookie(securityConfig.session.name);
      res.json({ message: 'Logged out successfully' });
    });
  } else {
    res.json({ message: 'No active session' });
  }
}; 