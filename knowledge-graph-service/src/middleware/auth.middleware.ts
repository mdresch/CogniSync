// Enhanced authentication middleware for Knowledge Graph Service
import { Request, Response, NextFunction } from 'express';
import { 
  createAuthMiddleware, 
  requireScopes, 
  requireTenant,
  requireServiceAuth,
  AuthenticatedRequest 
} from '../../../shared-security/service-auth.middleware';

// Create authentication middleware instance
const authMiddleware = createAuthMiddleware({
  serviceId: 'knowledge-graph-service',
  allowedServices: ['atlassian-sync-service', 'llm-rag-service'],
  allowApiKeys: true,
  allowServiceTokens: true,
  allowUserTokens: true,
  skipPaths: ['/health', '/metrics', '/api/v1/health'],
  developmentMode: process.env.NODE_ENV === 'development'
});

// Legacy API key authentication for backward compatibility
const VALID_API_KEYS = process.env.VALID_API_KEYS
  ? process.env.VALID_API_KEYS.split(',').map(k => k.trim())
  : [];

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  // Accept API key from either Authorization header or x-api-key header
  let apiKey: string | undefined;
  const authHeader = req.headers['authorization'];
  const xApiKeyHeader = req.headers['x-api-key'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.replace('Bearer ', '').trim();
  } else if (typeof xApiKeyHeader === 'string') {
    apiKey = xApiKeyHeader.trim();
  } else if (Array.isArray(xApiKeyHeader)) {
    apiKey = xApiKeyHeader[0].trim();
  }

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key (provide in Authorization or x-api-key header)' });
  }
  if (!VALID_API_KEYS.includes(apiKey)) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  return next();
}

// Enhanced authentication middleware
export const authenticate = authMiddleware;

// Authorization middleware exports
export { requireScopes, requireTenant, requireServiceAuth };

// Convenience middleware for common authorization patterns
export const requireReadAccess = requireScopes(['read']);
export const requireWriteAccess = requireScopes(['write']);
export const requireAdminAccess = requireScopes(['admin']);

// Entity-specific authorization
export function requireEntityAccess(action: 'read' | 'write' | 'delete') {
  const scopeMap = {
    read: ['read'],
    write: ['write'],
    delete: ['delete', 'admin']
  };
  
  return requireScopes(scopeMap[action]);
}

// Tenant isolation for multi-tenant operations
export function requireTenantIsolation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (process.env.TENANT_ISOLATION_ENABLED !== 'true') {
    return next();
  }
  
  // Ensure tenant context is available
  if (!req.tenantId) {
    return res.status(400).json({
      error: 'Tenant isolation required',
      message: 'This operation requires tenant context'
    });
  }
  
  next();
}
