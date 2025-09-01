/**
 * Enhanced authentication middleware for inter-service communication
 * Supports JWT tokens, API keys, and service-to-service authentication
 */

import { Request, Response, NextFunction } from 'express';
import { JWTSecurityManager, ServiceToken, UserToken } from './jwt-utils';
import crypto from 'crypto';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    tenantId: string;
    email?: string;
    roles: string[];
    scopes: string[];
  };
  service?: {
    serviceId: string;
    tenantId?: string;
    scopes: string[];
  };
  authType: 'user' | 'service' | 'apikey';
  tenantId?: string;
  scopes: string[];
}

export interface AuthMiddlewareOptions {
  serviceId: string;
  allowedServices?: string[];
  requiredScopes?: string[];
  allowApiKeys?: boolean;
  allowServiceTokens?: boolean;
  allowUserTokens?: boolean;
  skipPaths?: string[];
  developmentMode?: boolean;
}

export class ServiceAuthMiddleware {
  private jwtManager: JWTSecurityManager;
  private validApiKeys: Set<string>;
  private options: AuthMiddlewareOptions;

  constructor(options: AuthMiddlewareOptions) {
    this.options = {
      allowApiKeys: true,
      allowServiceTokens: true,
      allowUserTokens: true,
      skipPaths: ['/health', '/metrics'],
      developmentMode: process.env.NODE_ENV === 'development',
      ...options
    };

    this.jwtManager = new JWTSecurityManager(options.serviceId);
    this.validApiKeys = new Set(this.loadValidApiKeys());
  }

  /**
   * Load valid API keys from environment
   */
  private loadValidApiKeys(): string[] {
    const apiKeysEnv = process.env.VALID_API_KEYS || process.env.API_KEYS;
    if (!apiKeysEnv) return [];
    
    return apiKeysEnv.split(',').map(key => key.trim()).filter(key => key.length > 0);
  }

  /**
   * Main authentication middleware
   */
  authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Skip authentication for specified paths
    if (this.shouldSkipAuth(req.path)) {
      return next();
    }

    // Development mode bypass
    if (this.options.developmentMode && process.env.DISABLE_AUTH === 'true') {
      this.setDevelopmentAuth(req);
      return next();
    }

    try {
      // Try different authentication methods
      if (this.tryJWTAuthentication(req)) {
        return next();
      }

      if (this.options.allowApiKeys && this.tryApiKeyAuthentication(req)) {
        return next();
      }

      // No valid authentication found
      return this.sendAuthError(res, 'Authentication required', 'MISSING_AUTH');
    } catch (error) {
      let errorMsg = 'Unknown error';
      if (error && typeof error === 'object' && 'message' in error) {
        errorMsg = (error as any).message;
      }
      return this.sendAuthError(res, errorMsg, 'AUTH_ERROR');
    }
  };

  /**
   * Try JWT token authentication (both service and user tokens)
   */
  private tryJWTAuthentication(req: AuthenticatedRequest): boolean {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.slice(7);
    
    try {
      // Try service token first
      if (this.options.allowServiceTokens) {
        try {
          const serviceToken = this.jwtManager.validateServiceToken(token);
          this.setServiceAuth(req, serviceToken);
          return true;
        } catch (error) {
          // Not a service token, try user token
        }
      }

      // Try user token
      if (this.options.allowUserTokens) {
        try {
          const userToken = this.jwtManager.validateUserToken(token);
          this.setUserAuth(req, userToken);
          return true;
        } catch (error) {
          // Not a user token either
        }
      }

      return false;
    } catch (error) {
      let errorMsg = 'Unknown error';
      if (error && typeof error === 'object' && 'message' in error) {
        errorMsg = (error as any).message;
      }
      throw new Error(`Invalid JWT token: ${errorMsg}`);
    }
  }

  /**
   * Try API key authentication
   */
  private tryApiKeyAuthentication(req: AuthenticatedRequest): boolean {
    // Check multiple possible headers for API key
    const apiKey = req.headers['x-api-key'] as string ||
                   req.headers['api-key'] as string ||
                   (req.headers.authorization?.startsWith('ApiKey ') ? 
                    req.headers.authorization.slice(7) : null);

    if (!apiKey) {
      return false;
    }

    // Validate API key format and existence
    if (!this.isValidApiKey(apiKey)) {
      throw new Error('Invalid API key');
    }

    this.setApiKeyAuth(req, apiKey);
    return true;
  }

  /**
   * Validate API key
   */
  private isValidApiKey(apiKey: string): boolean {
    // Check if API key exists in valid keys
    if (this.validApiKeys.has(apiKey)) {
      return true;
    }

    // For service-specific API keys, validate format
    const servicePrefix = `${this.options.serviceId}-`;
    if (apiKey.startsWith(servicePrefix) && apiKey.length > servicePrefix.length + 10) {
      return true;
    }

    return false;
  }

  /**
   * Set service authentication context
   */
  private setServiceAuth(req: AuthenticatedRequest, token: ServiceToken) {
    req.service = {
      serviceId: token.serviceId,
      tenantId: token.tenantId,
      scopes: token.scopes
    };
    req.authType = 'service';
    req.tenantId = token.tenantId;
    req.scopes = token.scopes;

    // Validate allowed services
    if (this.options.allowedServices && 
        !this.options.allowedServices.includes(token.serviceId)) {
      throw new Error(`Service ${token.serviceId} not allowed`);
    }
  }

  /**
   * Set user authentication context
   */
  private setUserAuth(req: AuthenticatedRequest, token: UserToken) {
    req.user = {
      userId: token.userId,
      tenantId: token.tenantId,
      email: token.email,
      roles: token.roles,
      scopes: token.scopes
    };
    req.authType = 'user';
    req.tenantId = token.tenantId;
    req.scopes = token.scopes;
  }

  /**
   * Set API key authentication context
   */
  private setApiKeyAuth(req: AuthenticatedRequest, apiKey: string) {
    // Extract tenant ID from API key if possible
    const tenantId = this.extractTenantFromApiKey(apiKey);
    
    req.authType = 'apikey';
    req.tenantId = tenantId;
    req.scopes = ['read', 'write']; // Default scopes for API keys
  }

  /**
   * Extract tenant ID from API key format
   */
  private extractTenantFromApiKey(apiKey: string): string | undefined {
    // Format: service-tenant-random or just return undefined for global keys
    const parts = apiKey.split('-');
    if (parts.length >= 3) {
      return parts[1];
    }
    return undefined;
  }

  /**
   * Set development mode authentication
   */
  private setDevelopmentAuth(req: AuthenticatedRequest) {
    const tenantId = req.headers['x-tenant-id'] as string || 
                     req.query.tenantId as string || 
                     'dev-tenant';
    
    req.authType = 'user';
    req.tenantId = tenantId;
    req.scopes = ['read', 'write', 'admin'];
    req.user = {
      userId: 'dev-user',
      tenantId,
      roles: ['admin'],
      scopes: ['read', 'write', 'admin']
    };
  }

  /**
   * Check if authentication should be skipped for this path
   */
  private shouldSkipAuth(path: string): boolean {
    return this.options.skipPaths?.some(skipPath => 
      path === skipPath || path.startsWith(skipPath + '/')
    ) || false;
  }

  /**
   * Send authentication error response
   */
  private sendAuthError(res: Response, message: string, code: string) {
    return res.status(401).json({
      error: 'Authentication failed',
      code,
      message,
      timestamp: new Date().toISOString(),
      supportedMethods: this.getSupportedAuthMethods()
    });
  }

  /**
   * Get supported authentication methods for error responses
   */
  private getSupportedAuthMethods(): string[] {
    const methods: string[] = [];
    
    if (this.options.allowUserTokens) {
      methods.push('Bearer JWT (user token)');
    }
    
    if (this.options.allowServiceTokens) {
      methods.push('Bearer JWT (service token)');
    }
    
    if (this.options.allowApiKeys) {
      methods.push('x-api-key header');
      methods.push('ApiKey authorization header');
    }
    
    return methods;
  }
}

/**
 * Authorization middleware for scope and role checking
 */
export class AuthorizationMiddleware {
  /**
   * Require specific scopes
   */
  static requireScopes(requiredScopes: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (process.env.DISABLE_AUTH === 'true') {
        return next();
      }

      if (!req.scopes) {
        return res.status(403).json({
          error: 'Authorization failed',
          code: 'MISSING_SCOPES',
          message: 'No scopes found in authentication context'
        });
      }

      const hasRequiredScopes = requiredScopes.every(scope => 
        req.scopes.includes(scope) || req.scopes.includes('admin')
      );

      if (!hasRequiredScopes) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_SCOPES',
          message: `Required scopes: ${requiredScopes.join(', ')}`,
          available: req.scopes,
          required: requiredScopes
        });
      }

      next();
    };
  }

  /**
   * Require specific roles (for user tokens)
   */
  static requireRoles(requiredRoles: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (process.env.DISABLE_AUTH === 'true') {
        return next();
      }

      if (req.authType !== 'user' || !req.user?.roles) {
        return res.status(403).json({
          error: 'Authorization failed',
          code: 'MISSING_ROLES',
          message: 'User roles required for this operation'
        });
      }

      const hasRequiredRoles = requiredRoles.every(role => 
        req.user!.roles.includes(role) || req.user!.roles.includes('admin')
      );

      if (!hasRequiredRoles) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_ROLES',
          message: `Required roles: ${requiredRoles.join(', ')}`,
          available: req.user.roles,
          required: requiredRoles
        });
      }

      next();
    };
  }

  /**
   * Require tenant isolation
   */
  static requireTenant() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (process.env.DISABLE_AUTH === 'true') {
        return next();
      }

      if (!req.tenantId) {
        return res.status(400).json({
          error: 'Tenant required',
          code: 'MISSING_TENANT',
          message: 'This operation requires a valid tenant context'
        });
      }

      next();
    };
  }

  /**
   * Require service-to-service authentication
   */
  static requireServiceAuth(allowedServices?: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (process.env.DISABLE_AUTH === 'true') {
        return next();
      }

      if (req.authType !== 'service' || !req.service) {
        return res.status(403).json({
          error: 'Service authentication required',
          code: 'SERVICE_AUTH_REQUIRED',
          message: 'This endpoint requires service-to-service authentication'
        });
      }

      if (allowedServices && !allowedServices.includes(req.service.serviceId)) {
        return res.status(403).json({
          error: 'Service not authorized',
          code: 'SERVICE_NOT_ALLOWED',
          message: `Service ${req.service.serviceId} not authorized for this operation`,
          allowedServices
        });
      }

      next();
    };
  }
}

/**
 * Factory function to create authentication middleware
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions) {
  const authMiddleware = new ServiceAuthMiddleware(options);
  return authMiddleware.authenticate;
}

/**
 * Convenience exports
 */
export const requireScopes = AuthorizationMiddleware.requireScopes;
export const requireRoles = AuthorizationMiddleware.requireRoles;
export const requireTenant = AuthorizationMiddleware.requireTenant;
export const requireServiceAuth = AuthorizationMiddleware.requireServiceAuth;