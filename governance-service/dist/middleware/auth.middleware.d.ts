import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        email: string;
        tenantId: string;
        roles: string[];
        permissions: string[];
    };
}
export interface JWTPayload {
    userId: string;
    email: string;
    tenantId: string;
    roles: string[];
    permissions: string[];
    iat?: number;
    exp?: number;
    iss?: string;
    aud?: string;
}
export declare const authMiddleware: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const requirePermission: (permission: string) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const requireAnyPermission: (permissions: string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const requireRole: (role: string) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const requireAnyRole: (roles: string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const optionalAuth: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const validateTenantAccess: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map