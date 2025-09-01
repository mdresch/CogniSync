import { Request, Response, NextFunction } from 'express';
export interface ApiError extends Error {
    statusCode?: number;
    code?: string;
    details?: any;
}
export declare const errorHandler: (error: ApiError, req: Request, res: Response, next: NextFunction) => void;
export declare class ValidationError extends Error {
    statusCode: number;
    code: string;
    details: any;
    constructor(message: string, details?: any);
}
export declare class NotFoundError extends Error {
    statusCode: number;
    code: string;
    constructor(message?: string);
}
export declare class UnauthorizedError extends Error {
    statusCode: number;
    code: string;
    constructor(message?: string);
}
export declare class ForbiddenError extends Error {
    statusCode: number;
    code: string;
    constructor(message?: string);
}
export declare class ConflictError extends Error {
    statusCode: number;
    code: string;
    constructor(message?: string);
}
export declare class BadRequestError extends Error {
    statusCode: number;
    code: string;
    details: any;
    constructor(message?: string, details?: any);
}
//# sourceMappingURL=error-handler.d.ts.map