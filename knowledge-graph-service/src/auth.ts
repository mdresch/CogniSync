import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { UnauthorizedError, TenantIsolationError, RequestContext } from './types';

// Extend Express Request to include our context
declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
    }
  }
}

/**
 * Simple API key authentication middleware
 * In production, this should be replaced with a more robust authentication system
 */

interface ApiKeyConfig {
  key: string;
  tenantId: string;
  permissions: string[];
  expiresAt?: Date;
  isActive: boolean;
}

// In-memory API key storage (in production, use a database)
const API_KEYS: Map<string, ApiKeyConfig> = new Map();

// Initialize with a default API key for development
if (process.env.NODE_ENV === 'development') {
  const defaultKey = 'kg-dev-key-12345';
  API_KEYS.set(defaultKey, {
    key: defaultKey,
    tenantId: 'default',
    permissions: ['read', 'write', 'admin'],
    isActive: true
  });
  console.log('🔑 Development API key initialized: kg-dev-key-12345');
}

/**
 * Generate a new API key for a tenant
 */
export function generateApiKey(tenantId: string, permissions: string[] = ['read', 'write']): string {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(16).toString('hex');
  const salt = process.env.API_KEY_SALT || 'default-salt';
  
  const hash = crypto
    .createHash('sha256')
    .update(`${tenantId}:${timestamp}:${random}:${salt}`)
    .digest('hex');
  
  const apiKey = `kg-${tenantId}-${hash.substring(0, 16)}`;
  
  API_KEYS.set(apiKey, {
    key: apiKey,
    tenantId,
    permissions,
    isActive: true
  });

  console.log(`🔑 Generated API key for tenant ${tenantId}: ${apiKey}`);
  return apiKey;
}

/**
 * Validate API key and extract tenant context
 */
function validateApiKey(apiKey: string): ApiKeyConfig {
  if (!apiKey) {
    throw new UnauthorizedError('API key is required');
  }

  const config = API_KEYS.get(apiKey);
  if (!config) {
    throw new UnauthorizedError('Invalid API key');
  }

  if (!config.isActive) {
    throw new UnauthorizedError('API key is inactive');
  }

  if (config.expiresAt && config.expiresAt < new Date()) {
    throw new UnauthorizedError('API key has expired');
  }

  return config;
}

/**
 * Authentication middleware
 */
export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  try {
    // Extract API key from header or query parameter
    const apiKey = req.headers['x-api-key'] as string || 
                   req.headers['authorization']?.replace('Bearer ', '') ||
                   req.query.apiKey as string;

    if (!apiKey) {
      throw new UnauthorizedError('API key is required. Provide it in x-api-key header, Authorization bearer token, or apiKey query parameter');
    }

    const config = validateApiKey(apiKey);

    // Set request context
    req.context = {
      tenantId: config.tenantId,
      apiKey: config.key,
      permissions: config.permissions
    };

    console.log(`🔐 Authenticated request for tenant: ${config.tenantId}`);
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        timestamp: new Date()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Authentication failed',
        timestamp: new Date()
      });
    }
  }
}

/**
 * Permission check middleware
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.context) {
        throw new UnauthorizedError('Request context not found');
      }

      if (!req.context.permissions.includes(permission) && !req.context.permissions.includes('admin')) {
        throw new UnauthorizedError(`Insufficient permissions. Required: ${permission}`);
      }

      next();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          timestamp: new Date()
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Permission check failed',
          timestamp: new Date()
        });
      }
    }
  };
}

/**
 * Tenant isolation middleware
 */
export function enforceTenantIsolation(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!req.context) {
      throw new UnauthorizedError('Request context not found');
    }

    // Extract tenant ID from request (URL parameter, body, or query)
    const requestTenantId = req.params.tenantId || 
                           req.body?.tenantId || 
                           req.query.tenantId as string ||
                           req.context.tenantId; // Default to context tenant

    // Ensure tenant isolation
    if (requestTenantId !== req.context.tenantId && !req.context.permissions.includes('admin')) {
      throw new TenantIsolationError(`Access denied to tenant: ${requestTenantId}`);
    }

    // Set the validated tenant ID for use in controllers
    req.body = req.body || {};
    req.body.tenantId = requestTenantId;

    next();
  } catch (error) {
    if (error instanceof TenantIsolationError || error instanceof UnauthorizedError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        timestamp: new Date()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Tenant isolation check failed',
        timestamp: new Date()
      });
    }
  }
}

/**
 * Utility functions for API key management
 */
export function listApiKeys(): Array<{ key: string; tenantId: string; permissions: string[]; isActive: boolean }> {
  return Array.from(API_KEYS.values()).map(config => ({
    key: config.key.substring(0, 10) + '...',
    tenantId: config.tenantId,
    permissions: config.permissions,
    isActive: config.isActive
  }));
}

export function revokeApiKey(apiKey: string): boolean {
  const config = API_KEYS.get(apiKey);
  if (config) {
    config.isActive = false;
    console.log(`🔑 Revoked API key: ${apiKey}`);
    return true;
  }
  return false;
}

export function deleteApiKey(apiKey: string): boolean {
  const deleted = API_KEYS.delete(apiKey);
  if (deleted) {
    console.log(`🔑 Deleted API key: ${apiKey}`);
  }
  return deleted;
}
