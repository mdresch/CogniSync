import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../utils/config';
import { logger, logSecurity } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    tenantId: string;
    roles: string[];
    permissions: string[];
  };
}

export interface JWTPayload {
  userId: string;
  email: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      logSecurity('Missing authorization header', undefined, req.ip);
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization header is required',
        },
      });
      return;
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    
    if (!token) {
      logSecurity('Missing token in authorization header', undefined, req.ip);
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token is required',
        },
      });
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
    
    // Validate token structure
    if (!decoded.userId || !decoded.tenantId) {
      logSecurity('Invalid token structure', decoded.userId, req.ip);
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token',
        },
      });
      return;
    }

    // Add user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      tenantId: decoded.tenantId,
      roles: decoded.roles || [],
      permissions: decoded.permissions || [],
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logSecurity('Token expired', undefined, req.ip);
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired',
        },
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      logSecurity('Invalid token', undefined, req.ip, { error: error.message });
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token',
        },
      });
      return;
    }

    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed',
      },
    });
  }
};

// Middleware to check specific permissions
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    const hasPermission = req.user.permissions.includes(permission) || 
                         req.user.permissions.includes('*');

    if (!hasPermission) {
      logSecurity('Permission denied', req.user.userId, req.ip, { 
        requiredPermission: permission,
        userPermissions: req.user.permissions,
      });
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Permission required: ${permission}`,
        },
      });
      return;
    }

    next();
  };
};

// Middleware to check if user has any of the specified permissions
export const requireAnyPermission = (permissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    const hasAnyPermission = permissions.some(permission => 
      req.user!.permissions.includes(permission) || req.user!.permissions.includes('*')
    );

    if (!hasAnyPermission) {
      logSecurity('Permission denied', req.user.userId, req.ip, { 
        requiredPermissions: permissions,
        userPermissions: req.user.permissions,
      });
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `One of these permissions required: ${permissions.join(', ')}`,
        },
      });
      return;
    }

    next();
  };
};

// Middleware to check if user has a specific role
export const requireRole = (role: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    const hasRole = req.user.roles.includes(role);

    if (!hasRole) {
      logSecurity('Role access denied', req.user.userId, req.ip, { 
        requiredRole: role,
        userRoles: req.user.roles,
      });
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Role required: ${role}`,
        },
      });
      return;
    }

    next();
  };
};

// Middleware to check if user has any of the specified roles
export const requireAnyRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    const hasAnyRole = roles.some(role => req.user!.roles.includes(role));

    if (!hasAnyRole) {
      logSecurity('Role access denied', req.user.userId, req.ip, { 
        requiredRoles: roles,
        userRoles: req.user.roles,
      });
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `One of these roles required: ${roles.join(', ')}`,
        },
      });
      return;
    }

    next();
  };
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      next();
      return;
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    
    if (!token) {
      next();
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
    
    // Add user info to request if token is valid
    if (decoded.userId && decoded.tenantId) {
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        tenantId: decoded.tenantId,
        roles: decoded.roles || [],
        permissions: decoded.permissions || [],
      };
    }

    next();
  } catch (error) {
    // Ignore token errors for optional auth
    next();
  }
};

// Middleware to validate tenant access
export const validateTenantAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    return;
  }

  // Check if the requested resource belongs to the user's tenant
  const requestedTenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
  
  if (requestedTenantId && requestedTenantId !== req.user.tenantId) {
    logSecurity('Tenant isolation violation', req.user.userId, req.ip, { 
      userTenantId: req.user.tenantId,
      requestedTenantId,
    });
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied to this tenant resource',
      },
    });
    return;
  }

  next();
};