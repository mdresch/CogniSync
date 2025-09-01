import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
export interface TenantRequest extends AuthenticatedRequest {
    tenantId?: string;
    context?: Record<string, any>;
}
export declare const tenantMiddleware: (req: TenantRequest, res: Response, next: NextFunction) => void;
export declare const enforceTenantIsolation: (req: TenantRequest, res: Response, next: NextFunction) => void;
export declare const validateTenant: (req: TenantRequest, res: Response, next: NextFunction) => void;
export declare const addTenantContext: (req: TenantRequest, res: Response, next: NextFunction) => void;
export declare const logTenantAccess: (req: TenantRequest, res: Response, next: NextFunction) => void;
export declare const getTenantId: (req: TenantRequest) => string | undefined;
export declare const requireTenantId: (req: TenantRequest) => string;
//# sourceMappingURL=tenant.middleware.d.ts.map