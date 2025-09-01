"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.correlationIdMiddleware = exports.apiUsageLogger = exports.slowRequestLogger = exports.requestLogger = void 0;
const logger_1 = require("../utils/logger");
const config_1 = require("../utils/config");
// Generate unique request ID
function generateRequestId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
// Middleware to log HTTP requests
const requestLogger = (req, res, next) => {
    // Generate unique request ID
    req.requestId = generateRequestId();
    req.startTime = Date.now();
    // Add request ID to response headers
    res.setHeader('X-Request-ID', req.requestId);
    // Log request start
    const logData = {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        contentLength: req.get('Content-Length'),
        referer: req.get('Referer'),
        headers: req.headers,
        query: req.query,
        body: undefined,
    };
    // Don't log sensitive data in production
    if (config_1.config.nodeEnv === 'development') {
        logData.headers = req.headers;
        logData.query = req.query;
        // Log body for non-GET requests (excluding sensitive fields)
        if (req.method !== 'GET' && req.body) {
            const sanitizedBody = sanitizeBody(req.body);
            if (Object.keys(sanitizedBody).length > 0) {
                logData.body = sanitizedBody;
            }
        }
    }
    logger_1.logger.info('Request started', logData);
    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (chunk, encoding, cb) {
        // Calculate response time
        const responseTime = req.startTime ? Date.now() - req.startTime : 0;
        // Log response
        const responseLogData = {
            requestId: req.requestId,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime,
            contentLength: res.get('Content-Length'),
        };
        // Determine log level based on status code
        if (res.statusCode >= 500) {
            logger_1.logger.error('Request completed with server error', responseLogData);
        }
        else if (res.statusCode >= 400) {
            logger_1.logger.warn('Request completed with client error', responseLogData);
        }
        else {
            logger_1.logger.info('Request completed', responseLogData);
        }
        // Call original end method and return its result
        return originalEnd.call(this, chunk, encoding, cb);
    };
    next();
};
exports.requestLogger = requestLogger;
// Sanitize request body to remove sensitive information
function sanitizeBody(body) {
    if (!body || typeof body !== 'object') {
        return {};
    }
    const sensitiveFields = [
        'password',
        'token',
        'secret',
        'key',
        'authorization',
        'auth',
        'credential',
        'credentials',
        'apiKey',
        'api_key',
        'accessToken',
        'access_token',
        'refreshToken',
        'refresh_token',
    ];
    const sanitized = { ...body };
    // Remove sensitive fields
    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    });
    // Recursively sanitize nested objects
    Object.keys(sanitized).forEach(key => {
        if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
            sanitized[key] = sanitizeBody(sanitized[key]);
        }
    });
    return sanitized;
}
// Middleware to log slow requests
const slowRequestLogger = (thresholdMs = 1000) => {
    return (req, res, next) => {
        const originalEnd = res.end;
        res.end = function (chunk, encoding, cb) {
            const responseTime = req.startTime ? Date.now() - req.startTime : 0;
            if (responseTime > thresholdMs) {
                logger_1.logger.warn('Slow request detected', {
                    requestId: req.requestId,
                    method: req.method,
                    url: req.url,
                    responseTime,
                    threshold: thresholdMs,
                    statusCode: res.statusCode,
                });
            }
            return originalEnd.call(this, chunk, encoding, cb);
        };
        next();
    };
};
exports.slowRequestLogger = slowRequestLogger;
// Middleware to log API usage statistics
const apiUsageLogger = (req, res, next) => {
    const originalEnd = res.end;
    res.end = function (chunk, encoding, cb) {
        // Extract user info if available
        const user = req.user;
        // Log API usage
        logger_1.logger.info('API Usage', {
            requestId: req.requestId,
            method: req.method,
            endpoint: req.route?.path || req.url,
            statusCode: res.statusCode,
            userId: user?.userId,
            tenantId: user?.tenantId,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            timestamp: new Date().toISOString(),
        });
        return originalEnd.call(this, chunk, encoding, cb);
    };
    next();
};
exports.apiUsageLogger = apiUsageLogger;
// Middleware to add correlation ID for distributed tracing
const correlationIdMiddleware = (req, res, next) => {
    // Check if correlation ID is provided in headers
    const correlationId = req.get('X-Correlation-ID') || req.get('X-Request-ID') || req.requestId;
    // Add to request and response
    req.requestId = correlationId || '';
    res.setHeader('X-Correlation-ID', correlationId || '');
    next();
};
exports.correlationIdMiddleware = correlationIdMiddleware;
//# sourceMappingURL=request-logger.js.map