// Enhanced authentication middleware for Atlassian Sync Service
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
  serviceId: 'atlassian-sync-service',
  allowedServices: ['knowledge-graph-service', 'llm-rag-service'],
  allowApiKeys: true,
  allowServiceTokens: true,
  allowUserTokens: true,
  skipPaths: ['/health', '/metrics', '/api/status'],
  developmentMode: process.env.NODE_ENV === 'development'
});

// Legacy API key authentication for backward compatibility
const VALID_API_KEYS = process.env.VALID_API_KEYS
  ? process.env.VALID_API_KEYS.split(',').map(k => k.trim())
  : [];

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  console.log('[AUTH] Received Authorization header:', authHeader);
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[AUTH] Missing or invalid Authorization header');
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const apiKey = authHeader.replace('Bearer ', '').trim();
  const isValid = VALID_API_KEYS.includes(apiKey);
  console.log('[AUTH] Extracted API key:', apiKey, '| Valid:', isValid);
  if (!isValid) {
    console.warn('[AUTH] Invalid API key:', apiKey);
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

// Webhook-specific authentication
export function webhookAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Webhooks can use either API keys or service tokens
  if (req.authType === 'apikey' || req.authType === 'service') {
    return next();
  }
  
  return res.status(403).json({
    error: 'Webhook authentication required',
    message: 'Webhooks require API key or service token authentication'
  });
}
