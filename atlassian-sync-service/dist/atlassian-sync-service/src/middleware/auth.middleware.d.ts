import { Request, Response, NextFunction } from 'express';
import { requireScopes, requireTenant, requireServiceAuth, AuthenticatedRequest } from '../../../shared-security/service-auth.middleware';
export declare function apiKeyAuth(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
export declare const authenticate: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export { requireScopes, requireTenant, requireServiceAuth };
export declare const requireReadAccess: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const requireWriteAccess: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const requireAdminAccess: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare function webhookAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
//# sourceMappingURL=auth.middleware.d.ts.map