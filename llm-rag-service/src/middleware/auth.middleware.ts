
// Enhanced authentication middleware for LLM-RAG Service
import { Request, Response, NextFunction } from 'express';
import { 
  createAuthMiddleware, 
  requireScopes, 
  requireTenant,
  requireServiceAuth,
  AuthenticatedRequest 
} from '../../../shared-security/service-auth.middleware';

// Legacy interface for backward compatibility
export interface AuthRequest extends Request {
  tenantId?: string;
  userId?: string;
  apiKey?: string;
  scopes?: string[];
}

// Create authentication middleware instance
const enhancedAuthMiddleware = createAuthMiddleware({
  serviceId: 'llm-rag-service',
  allowedServices: ['atlassian-sync-service', 'knowledge-graph-service'],
  allowApiKeys: true,
  allowServiceTokens: true,
  allowUserTokens: true,
  skipPaths: ['/health', '/metrics', '/api/health'],
  developmentMode: process.env.NODE_ENV === 'development'
});

// Legacy authentication middleware for backward compatibility
export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Skip auth for health checks and development mode
  if (req.path === '/health' || process.env.DISABLE_AUTH === 'true') {
    return next();
  }

  const apiKey = req.headers['x-api-key'] as string;
  const authorization = req.headers['authorization'] as string;

  // Check for API key
  if (apiKey) {
    // Validate API key format
    if (!apiKey.startsWith('llm-rag-')) {
      return res.status(401).json({
        error: 'Invalid API key format',
        code: 'INVALID_API_KEY',
        message: 'API key must start with "llm-rag-"',
      });
    }

    // Extract tenant ID from API key (format: llm-rag-{tenantId}-{random})
    const keyParts = apiKey.split('-');
    if (keyParts.length < 3) {
      return res.status(401).json({
        error: 'Invalid API key format',
        code: 'INVALID_API_KEY',
        message: 'API key format is invalid',
      });
    }

    const tenantId = keyParts[2];
    
    // TODO: Validate API key against database
    // For now, accept any properly formatted key
    req.tenantId = tenantId;
    req.apiKey = apiKey;
    req.scopes = ['read', 'write']; // Default scopes
    
    return next();
  }

  // Check for Bearer token
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice(7);
    
    try {
      // TODO: Implement JWT token validation
      // For now, accept any token and extract tenant ID from query param or header
      const tenantId = req.headers['x-tenant-id'] as string || req.query.tenantId as string;
      
      if (!tenantId) {
        return res.status(401).json({
          error: 'Tenant ID required',
          code: 'MISSING_TENANT_ID',
          message: 'Tenant ID must be provided via x-tenant-id header or tenantId query parameter',
        });
      }

      req.tenantId = tenantId;
      req.userId = 'user-from-token'; // TODO: Extract from JWT
      req.scopes = ['read', 'write']; // TODO: Extract from JWT
      
      return next();
    } catch (error) {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
        message: 'The provided token is invalid or expired',
      });
    }
  }

  // No valid authentication found
  return res.status(401).json({
    error: 'Authentication required',
    code: 'MISSING_AUTH',
    message: 'Request must include either x-api-key header or Authorization Bearer token',
    examples: {
      apiKey: 'x-api-key: llm-rag-{tenantId}-{randomString}',
      bearer: 'Authorization: Bearer {jwtToken}',
    },
  });
};


export const requireScope = (requiredScope: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Skip scope requirement in development mode when auth is disabled
    if (process.env.DISABLE_AUTH === 'true') {
      return next();
    }
    if (!req.scopes?.includes(requiredScope)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_SCOPE',
        message: `This operation requires '${requiredScope}' scope`,
        required: requiredScope,
        available: req.scopes || [],
      });
    }
    next();
  };
};

// Enhanced authentication middleware
export const authenticate = enhancedAuthMiddleware;

// Authorization middleware exports
export { requireScopes, requireTenant as requireTenantAuth, requireServiceAuth };

// Convenience middleware for common authorization patterns
export const requireReadAccess = requireScopes(['read']);
export const requireWriteAccess = requireScopes(['write']);
export const requireAdminAccess = requireScopes(['admin']);

// LLM-specific authorization
export const requireLLMAccess = requireScopes(['llm', 'query']);
export const requireEmbeddingAccess = requireScopes(['embedding', 'write']);
export const requireAnalyticsAccess = requireScopes(['analytics', 'read']);

// Legacy tenant requirement function
export const requireTenant = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Skip tenant requirement in development mode when auth is disabled
  if (process.env.DISABLE_AUTH === 'true') {
    // Extract tenant ID from request body or query params for development
    const tenantId = req.body?.tenantId || req.query.tenantId as string;
    if (tenantId) {
      req.tenantId = tenantId;
    }
    return next();
  }
  if (!req.tenantId) {
    return res.status(400).json({
      error: 'Tenant ID required',
      code: 'MISSING_TENANT_ID',
      message: 'This operation requires a valid tenant ID',
    });
  }
  next();
};
