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
    private loadValidApiKeys;
    authenticate: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
    private tryJWTAuthentication;
    private tryApiKeyAuthentication;
    private isValidApiKey;
    private setServiceAuth;
    private setUserAuth;
    private setApiKeyAuth;
    private extractTenantFromApiKey;
    private setDevelopmentAuth;
    private shouldSkipAuth;
    private sendAuthError;
    private getSupportedAuthMethods;
}
export declare class AuthorizationMiddleware {
    static requireScopes(requiredScopes: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
    static requireRoles(requiredRoles: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
    static requireTenant(): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
    static requireServiceAuth(allowedServices?: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
}
export declare function createAuthMiddleware(options: AuthMiddlewareOptions): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const requireScopes: typeof AuthorizationMiddleware.requireScopes;
export declare const requireRoles: typeof AuthorizationMiddleware.requireRoles;
export declare const requireTenant: typeof AuthorizationMiddleware.requireTenant;
export declare const requireServiceAuth: typeof AuthorizationMiddleware.requireServiceAuth;
//# sourceMappingURL=service-auth.middleware.d.ts.map