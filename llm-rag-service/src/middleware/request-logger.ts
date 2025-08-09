import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  // Log request
  console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip}`);
  
  // Log request body for POST/PUT/PATCH requests (excluding sensitive data)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const sanitizedBody = sanitizeRequestBody(req.body);
    if (Object.keys(sanitizedBody).length > 0) {
      console.log(`[${timestamp}] Request body:`, JSON.stringify(sanitizedBody, null, 2));
    }
  }

  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(body: any) {
    const duration = Date.now() - start;
    const responseTimestamp = new Date().toISOString();
    
    // Log response
    console.log(`[${responseTimestamp}] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
    
    // Log response body for development (excluding large responses)
    if (process.env.NODE_ENV === 'development' && res.statusCode >= 400) {
      console.log(`[${responseTimestamp}] Response body:`, JSON.stringify(body, null, 2));
    } else if (process.env.NODE_ENV === 'development' && body && typeof body === 'object') {
      // Log summary for successful responses
      const summary = getResponseSummary(body);
      if (summary) {
        console.log(`[${responseTimestamp}] Response summary:`, summary);
      }
    }
    
    return originalJson.call(this, body);
  };

  next();
};

function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return {};
  }

  const sensitiveFields = [
    'apiKey', 'api_key', 'token', 'password', 'secret', 'key',
    'authorization', 'auth', 'credentials', 'private'
  ];

  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(body)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeRequestBody(value);
    } else if (typeof value === 'string' && value.length > 500) {
      sanitized[key] = `${value.substring(0, 100)}... [TRUNCATED ${value.length} chars]`;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function getResponseSummary(body: any): string | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const summaryParts: string[] = [];

  // Check for common response patterns
  if (Array.isArray(body.results)) {
    summaryParts.push(`${body.results.length} results`);
  } else if (Array.isArray(body)) {
    summaryParts.push(`${body.length} items`);
  }

  if (body.processingTime) {
    summaryParts.push(`${body.processingTime}ms processing`);
  }

  if (body.totalResults !== undefined) {
    summaryParts.push(`${body.totalResults} total`);
  }

  if (body.metadata?.sources) {
    const sourceCount = Object.keys(body.metadata.sources).length;
    summaryParts.push(`${sourceCount} sources`);
  }

  if (body.analysis?.intentConfidence) {
    summaryParts.push(`${Math.round(body.analysis.intentConfidence * 100)}% confidence`);
  }

  return summaryParts.length > 0 ? summaryParts.join(', ') : null;
}
