/**
 * Enhanced authentication middleware for inter-service communication
 * Supports JWT tokens, API keys, and service-to-service authentication
 */
import { Request, Response, NextFunction } from 'express';
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
export declare class ServiceAuthMiddleware {
    private jwtManager;
    private validApiKeys;
    private options;
    constructor(options: AuthMiddlewareOptions);
    /**
     * Load valid API keys from environment
     */
    private loadValidApiKeys;
    /**
     * Main authentication middleware
     */
    authenticate: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
    /**
     * Try JWT token authentication (both service and user tokens)
     */
    private tryJWTAuthentication;
    /**
     * Try API key authentication
     */
    private tryApiKeyAuthentication;
    /**
     * Validate API key
     */
    private isValidApiKey;
    /**
     * Set service authentication context
     */
    private setServiceAuth;
    /**
     * Set user authentication context
     */
    private setUserAuth;
    /**
     * Set API key authentication context
     */
    private setApiKeyAuth;
    /**
     * Extract tenant ID from API key format
     */
    private extractTenantFromApiKey;
    /**
     * Set development mode authentication
     */
    private setDevelopmentAuth;
    /**
     * Check if authentication should be skipped for this path
     */
    private shouldSkipAuth;
    /**
     * Send authentication error response
     */
    private sendAuthError;
    /**
     * Get supported authentication methods for error responses
     */
    private getSupportedAuthMethods;
}
/**
 * Authorization middleware for scope and role checking
 */
export declare class AuthorizationMiddleware {
    /**
     * Require specific scopes
     */
    static requireScopes(requiredScopes: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
    /**
     * Require specific roles (for user tokens)
     */
    static requireRoles(requiredRoles: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
    /**
     * Require tenant isolation
     */
    static requireTenant(): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
    /**
     * Require service-to-service authentication
     */
    static requireServiceAuth(allowedServices?: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
}
/**
 * Factory function to create authentication middleware
 */
export declare function createAuthMiddleware(options: AuthMiddlewareOptions): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
/**
 * Convenience exports
 */
export declare const requireScopes: typeof AuthorizationMiddleware.requireScopes;
export declare const requireRoles: typeof AuthorizationMiddleware.requireRoles;
export declare const requireTenant: typeof AuthorizationMiddleware.requireTenant;
export declare const requireServiceAuth: typeof AuthorizationMiddleware.requireServiceAuth;
//# sourceMappingURL=service-auth.middleware.d.ts.map