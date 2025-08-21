import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

export interface LoggedRequest extends Request {
  startTime?: number;
  requestId?: string;
}

// Generate unique request ID
function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Middleware to log HTTP requests
export const requestLogger = (req: LoggedRequest, res: Response, next: NextFunction): void => {
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
  };

  // Don't log sensitive data in production
  if (config.nodeEnv === 'development') {
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

  logger.info('Request started', logData);

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
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
      logger.error('Request completed with server error', responseLogData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', responseLogData);
    } else {
      logger.info('Request completed', responseLogData);
    }

    // Call original end method
    originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

// Sanitize request body to remove sensitive information
function sanitizeBody(body: any): any {
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
export const slowRequestLogger = (thresholdMs: number = 1000) => {
  return (req: LoggedRequest, res: Response, next: NextFunction): void => {
    const originalEnd = res.end;
    
    res.end = function(chunk?: any, encoding?: any, cb?: any) {
      const responseTime = req.startTime ? Date.now() - req.startTime : 0;
      
      if (responseTime > thresholdMs) {
        logger.warn('Slow request detected', {
          requestId: req.requestId,
          method: req.method,
          url: req.url,
          responseTime,
          threshold: thresholdMs,
          statusCode: res.statusCode,
        });
      }
      
      originalEnd.call(this, chunk, encoding, cb);
    };
    
    next();
  };
};

// Middleware to log API usage statistics
export const apiUsageLogger = (req: LoggedRequest, res: Response, next: NextFunction): void => {
  const originalEnd = res.end;
  
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    // Extract user info if available
    const user = (req as any).user;
    
    // Log API usage
    logger.info('API Usage', {
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
    
    originalEnd.call(this, chunk, encoding, cb);
  };
  
  next();
};

// Middleware to add correlation ID for distributed tracing
export const correlationIdMiddleware = (req: LoggedRequest, res: Response, next: NextFunction): void => {
  // Check if correlation ID is provided in headers
  const correlationId = req.get('X-Correlation-ID') || req.get('X-Request-ID') || req.requestId;
  
  // Add to request and response
  req.requestId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  next();
};