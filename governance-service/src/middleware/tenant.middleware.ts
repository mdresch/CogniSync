import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { logger, logSecurity } from '../utils/logger';

export interface TenantRequest extends AuthenticatedRequest {
  tenantId?: string;
  context?: Record<string, any>;
}

// Middleware to extract and validate tenant information
export const tenantMiddleware = (req: TenantRequest, res: Response, next: NextFunction): void => {
  try {
    // For authenticated requests, use tenant from JWT token
    if (req.user?.tenantId) {
      req.tenantId = req.user.tenantId;
      next();
      return;
    }

    // For unauthenticated requests, try to extract tenant from headers or query
    const tenantFromHeader = req.get('X-Tenant-ID');
    const tenantFromQuery = req.query.tenantId as string;
    const tenantFromBody = req.body?.tenantId;

    const tenantId = tenantFromHeader || tenantFromQuery || tenantFromBody;

    if (tenantId) {
      req.tenantId = tenantId;
    }

    next();
  } catch (error) {
    logger.error('Tenant middleware error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process tenant information',
      },
    });
  }
};

// Middleware to enforce tenant isolation
export const enforceTenantIsolation = (req: TenantRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required for tenant isolation',
      },
    });
    return;
  }

  // Extract tenant ID from various sources in the request
  const requestTenantSources = [
    req.params.tenantId,
    req.body?.tenantId,
    req.query.tenantId as string,
    req.get('X-Tenant-ID'),
  ].filter(Boolean);

  // Check if any requested tenant ID doesn't match user's tenant
  for (const requestedTenantId of requestTenantSources) {
    if (requestedTenantId && requestedTenantId !== req.user.tenantId) {
      logSecurity('Tenant isolation violation attempt', req.user.userId, req.ip, {
        userTenantId: req.user.tenantId,
        requestedTenantId,
        url: req.url,
        method: req.method,
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'TENANT_ISOLATION_VIOLATION',
          message: 'Access denied: tenant isolation violation',
        },
      });
      return;
    }
  }

  // Ensure tenant ID is set for the request
  req.tenantId = req.user.tenantId;

  next();
};

// Middleware to validate tenant exists and is active
export const validateTenant = (req: TenantRequest, res: Response, next: NextFunction): void => {
  // This would typically check against a tenant registry or database
  // For now, we'll just ensure a tenant ID is present
  
  if (!req.tenantId) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_TENANT',
        message: 'Tenant ID is required',
      },
    });
    return;
  }

  // TODO: Add actual tenant validation logic here
  // - Check if tenant exists in database
  // - Check if tenant is active
  // - Check tenant subscription status
  // - Apply tenant-specific rate limits
  
  next();
};

// Middleware to add tenant context to all database queries
export const addTenantContext = (req: TenantRequest, res: Response, next: NextFunction): void => {
  // Add tenant ID to request context for use in services
  if (req.tenantId) {
    // Store tenant context that can be used by services
    req.context = {
      ...req.context,
      tenantId: req.tenantId,
    };
  }

  next();
};

// Middleware to log tenant access patterns
export const logTenantAccess = (req: TenantRequest, res: Response, next: NextFunction): void => {
  if (req.tenantId && req.user) {
    logger.info('Tenant access', {
      tenantId: req.tenantId,
      userId: req.user.userId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

// Helper function to extract tenant ID from request
export const getTenantId = (req: TenantRequest): string | undefined => {
  return req.tenantId || req.user?.tenantId;
};

// Helper function to ensure tenant ID is present
export const requireTenantId = (req: TenantRequest): string => {
  const tenantId = getTenantId(req);
  
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  return tenantId;
};