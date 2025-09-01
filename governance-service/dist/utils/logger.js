"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSecurity = exports.logAudit = exports.logPerformance = exports.logDebug = exports.logWarn = exports.logInfo = exports.logError = exports.stream = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const config_1 = require("./config");
// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
// Define colors for each level
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};
// Tell winston that you want to link the colors
winston_1.default.addColors(colors);
// Define which level to log based on environment
const level = () => {
    const env = config_1.config.nodeEnv || 'development';
    const isDevelopment = env === 'development';
    return isDevelopment ? 'debug' : 'warn';
};
// Define different log formats
const format = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`));
// Define which transports the logger must use
const transports = [
    // Console transport
    new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
    }),
    // File transport for errors
    new winston_1.default.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    }),
    // File transport for all logs
    new winston_1.default.transports.File({
        filename: 'logs/combined.log',
        format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    }),
];
// Create the logger
exports.logger = winston_1.default.createLogger({
    level: level(),
    levels,
    format,
    transports,
    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston_1.default.transports.File({ filename: 'logs/exceptions.log' }),
    ],
    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston_1.default.transports.File({ filename: 'logs/rejections.log' }),
    ],
});
// Create a stream object for Morgan HTTP logger
exports.stream = {
    write: (message) => {
        exports.logger.http(message.trim());
    },
};
// Helper functions for structured logging
const logError = (message, error, metadata) => {
    exports.logger.error(message, {
        error: error ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
        } : undefined,
        ...metadata,
    });
};
exports.logError = logError;
const logInfo = (message, metadata) => {
    exports.logger.info(message, metadata);
};
exports.logInfo = logInfo;
const logWarn = (message, metadata) => {
    exports.logger.warn(message, metadata);
};
exports.logWarn = logWarn;
const logDebug = (message, metadata) => {
    exports.logger.debug(message, metadata);
};
exports.logDebug = logDebug;
// Performance logging
const logPerformance = (operation, startTime, metadata) => {
    const duration = Date.now() - startTime;
    exports.logger.info(`Performance: ${operation} completed in ${duration}ms`, {
        operation,
        duration,
        ...metadata,
    });
};
exports.logPerformance = logPerformance;
// Audit logging for governance activities
const logAudit = (action, userId, resource, resourceId, metadata) => {
    exports.logger.info('AUDIT', {
        action,
        userId,
        resource,
        resourceId,
        timestamp: new Date().toISOString(),
        ...metadata,
    });
};
exports.logAudit = logAudit;
// Security logging
const logSecurity = (event, userId, ipAddress, metadata) => {
    exports.logger.warn('SECURITY', {
        event,
        userId,
        ipAddress,
        timestamp: new Date().toISOString(),
        ...metadata,
    });
};
exports.logSecurity = logSecurity;
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map