import { Request, Response, NextFunction } from 'express';
export interface LoggedRequest extends Request {
    startTime?: number;
    requestId?: string;
}
export declare const requestLogger: (req: LoggedRequest, res: Response, next: NextFunction) => void;
export declare const slowRequestLogger: (thresholdMs?: number) => (req: LoggedRequest, res: Response, next: NextFunction) => void;
export declare const apiUsageLogger: (req: LoggedRequest, res: Response, next: NextFunction) => void;
export declare const correlationIdMiddleware: (req: LoggedRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=request-logger.d.ts.map