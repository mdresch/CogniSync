import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export interface APIError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export const errorHandler = (
  error: APIError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const timestamp = new Date().toISOString();
  
  // Log error details
  console.error(`[${timestamp}] Error in ${req.method} ${req.url}:`, {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    code: error.code,
    details: error.details,
  });

  // Handle specific error types
  let statusCode = error.statusCode || 500;
  let errorCode = error.code || 'INTERNAL_SERVER_ERROR';
  let message = error.message || 'An unexpected error occurred';
  let details = error.details;

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    statusCode = 400;
    errorCode = `PRISMA_${error.code}`;
    
    switch (error.code) {
      case 'P2002':
        message = 'A record with this value already exists';
        details = { constraint: error.meta?.target };
        break;
      case 'P2025':
        message = 'Record not found';
        statusCode = 404;
        break;
      case 'P2014':
        message = 'The change would violate a required relation';
        break;
      default:
        message = 'Database operation failed';
    }
  } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = 500;
    errorCode = 'DATABASE_ERROR';
    message = 'Unknown database error occurred';
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Invalid data provided';
  }

  // OpenAI/LLM errors
  if (error.message?.includes('OpenAI') || error.message?.includes('API')) {
    if (error.message.includes('rate limit') || error.message.includes('quota')) {
      statusCode = 429;
      errorCode = 'RATE_LIMIT_EXCEEDED';
      message = 'AI service rate limit exceeded, please try again later';
    } else if (error.message.includes('invalid') || error.message.includes('authentication')) {
      statusCode = 401;
      errorCode = 'AI_SERVICE_AUTH_ERROR';
      message = 'AI service authentication failed';
    } else if (error.message.includes('timeout')) {
      statusCode = 408;
      errorCode = 'AI_SERVICE_TIMEOUT';
      message = 'AI service request timed out';
    } else {
      statusCode = 502;
      errorCode = 'AI_SERVICE_ERROR';
      message = 'AI service temporarily unavailable';
    }
  }

  // Vector database errors
  if (error.message?.includes('Pinecone') || error.message?.includes('vector')) {
    statusCode = 502;
    errorCode = 'VECTOR_DB_ERROR';
    message = 'Vector database service error';
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  }

  // Network/HTTP errors
  if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
    message = 'External service temporarily unavailable';
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
    details = undefined;
  }

  const errorResponse = {
    error: message,
    code: errorCode,
    timestamp,
    path: req.path,
    method: req.method,
    ...(details && { details }),
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack?.split('\n').slice(0, 10) // Limit stack trace
    }),
  };

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error classes
export class ValidationError extends Error {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  details?: any;
  
  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  code = 'NOT_FOUND';
  
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  statusCode = 401;
  code = 'UNAUTHORIZED';
  
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  code = 'FORBIDDEN';
  
  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class RateLimitError extends Error {
  statusCode = 429;
  code = 'RATE_LIMIT_EXCEEDED';
  
  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends Error {
  statusCode = 503;
  code = 'SERVICE_UNAVAILABLE';
  
  constructor(message: string = 'Service temporarily unavailable') {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}
