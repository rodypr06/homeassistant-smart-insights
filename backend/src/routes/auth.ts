import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { generateToken, authenticateJWT, logout } from '../middleware/auth';
import { logger, securityLogger, errorLogger } from '../utils/logger';

const router = Router();

// Mock user database (in production, use a real database)
interface User {
  id: string;
  email: string;
  password: string;
  role: string;
  permissions: string[];
  createdAt: Date;
  lastLogin?: Date;
}

const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@homeassistant.local',
    password: '$2a$10$3W4nOVxN.Cf.Mgy4h3XfHeRhFPgFPxolh57TaxzubeibB3rLJ1wC2', // 'admin123'
    role: 'admin',
    permissions: ['*'],
    createdAt: new Date(),
  },
  {
    id: '2',
    email: 'user@homeassistant.local',
    password: '$2a$10$sK4NPxP2EnYAifGtMC9zSO2hnvx5FQjaqI4NaQccEuKmC8H5cywjq', // 'user123'
    role: 'user',
    permissions: ['influxdb:read', 'homeassistant:read'],
    createdAt: new Date(),
  },
];

// Login endpoint
router.post('/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        errorLogger.validationError(errors.array(), req);
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { email, password } = req.body;

      // Find user
      const user = mockUsers.find(u => u.email === email);
      if (!user) {
        securityLogger.authFailure('User not found', req.ip, req.get('User-Agent'), email);
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        securityLogger.authFailure('Invalid password', req.ip, req.get('User-Agent'), email);
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      // Update last login
      user.lastLogin = new Date();

      // Generate JWT token
      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      });

      // Set session if using session-based auth
      if (req.session) {
        req.session.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
        };
      }

      securityLogger.authSuccess(user.id, req.ip, req.get('User-Agent'));

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          lastLogin: user.lastLogin,
        },
      });

    } catch (error) {
      errorLogger.apiError(error as Error, req);
      res.status(500).json({
        error: 'Login failed',
        code: 'LOGIN_ERROR',
      });
    }
  }
);

// Logout endpoint
router.post('/logout', authenticateJWT, (req: Request, res: Response) => {
  logout(req, res);
});

// Get current user info
router.get('/me', authenticateJWT, (req: Request, res: Response) => {
  const user = req.user!;
  
  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
  });
});

// Refresh token endpoint
router.post('/refresh', authenticateJWT, (req: Request, res: Response) => {
  const user = req.user!;
  
  // Generate new token
  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
  });

  logger.info('Token refreshed', { userId: user.id });

  res.json({
    message: 'Token refreshed',
    token,
  });
});

// Change password endpoint
router.post('/change-password',
  authenticateJWT,
  [
    body('currentPassword').isLength({ min: 6 }).withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        errorLogger.validationError(errors.array(), req);
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { currentPassword, newPassword } = req.body;
      const userId = req.user!.id;

      // Find user
      const user = mockUsers.find(u => u.id === userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        securityLogger.authFailure('Invalid current password', req.ip, req.get('User-Agent'), user.email);
        return res.status(401).json({
          error: 'Invalid current password',
          code: 'INVALID_PASSWORD',
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;

      logger.info('Password changed', { userId: user.id });

      res.json({
        message: 'Password changed successfully',
      });

    } catch (error) {
      errorLogger.apiError(error as Error, req);
      res.status(500).json({
        error: 'Password change failed',
        code: 'PASSWORD_CHANGE_ERROR',
      });
    }
  }
);

export default router; 