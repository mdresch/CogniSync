import winston from 'winston';
export declare const logger: winston.Logger;
export declare const stream: {
    write: (message: string) => void;
};
export declare const logError: (message: string, error?: Error, metadata?: any) => void;
export declare const logInfo: (message: string, metadata?: any) => void;
export declare const logWarn: (message: string, metadata?: any) => void;
export declare const logDebug: (message: string, metadata?: any) => void;
export declare const logPerformance: (operation: string, startTime: number, metadata?: any) => void;
export declare const logAudit: (action: string, userId: string, resource: string, resourceId?: string, metadata?: any) => void;
export declare const logSecurity: (event: string, userId?: string, ipAddress?: string, metadata?: any) => void;
export default logger;
//# sourceMappingURL=logger.d.ts.map