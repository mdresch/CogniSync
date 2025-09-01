"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BadRequestError = exports.ConflictError = exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.ValidationError = exports.errorHandler = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
const config_1 = require("../utils/config");
const errorHandler = (error, req, res, next) => {
    // Log the error
    (0, logger_1.logError)('Request error', error, {
        method: req.method,
        url: req.url,
        body: req.body,
        params: req.params,
        query: req.query,
        headers: req.headers,
        ip: req.ip,
    });
    // Default error response
    let statusCode = error.statusCode || 500;
    let errorCode = error.code || 'INTERNAL_ERROR';
    let message = error.message || 'Internal server error';
    let details = error.details;
    // Handle specific error types
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        ({ statusCode, errorCode, message, details } = handlePrismaError(error));
    }
    else if (error instanceof client_1.Prisma.PrismaClientUnknownRequestError) {
        statusCode = 500;
        errorCode = 'DATABASE_ERROR';
        message = 'Database operation failed';
    }
    else if (error instanceof client_1.Prisma.PrismaClientRustPanicError) {
        statusCode = 500;
        errorCode = 'DATABASE_PANIC';
        message = 'Database connection error';
    }
    else if (error instanceof client_1.Prisma.PrismaClientInitializationError) {
        statusCode = 500;
        errorCode = 'DATABASE_INIT_ERROR';
        message = 'Database initialization failed';
    }
    else if (error instanceof client_1.Prisma.PrismaClientValidationError) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
        message = 'Invalid data provided';
    }
    // Handle validation errors
    if (error.name === 'ValidationError') {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
        message = 'Validation failed';
        details = error.details;
    }
    // Handle JWT errors
    if (error.name === 'JsonWebTokenError') {
        statusCode = 401;
        errorCode = 'INVALID_TOKEN';
        message = 'Invalid authentication token';
    }
    if (error.name === 'TokenExpiredError') {
        statusCode = 401;
        errorCode = 'TOKEN_EXPIRED';
        message = 'Authentication token has expired';
    }
    // Handle multer errors (file upload)
    if (error.name === 'MulterError') {
        statusCode = 400;
        errorCode = 'FILE_UPLOAD_ERROR';
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                message = 'File size too large';
                break;
            case 'LIMIT_FILE_COUNT':
                message = 'Too many files';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message = 'Unexpected file field';
                break;
            default:
                message = 'File upload error';
        }
    }
    // Don't expose internal errors in production
    if (config_1.config.nodeEnv === 'production' && statusCode === 500) {
        message = 'Internal server error';
        details = undefined;
    }
    // Send error response
    res.status(statusCode).json({
        success: false,
        error: {
            code: errorCode,
            message,
            ...(details && { details }),
            ...(config_1.config.nodeEnv === 'development' && { stack: error.stack }),
        },
        timestamp: new Date().toISOString(),
        path: req.url,
        method: req.method,
    });
};
exports.errorHandler = errorHandler;
function handlePrismaError(error) {
    switch (error.code) {
        case 'P2000':
            return {
                statusCode: 400,
                errorCode: 'VALUE_TOO_LONG',
                message: 'The provided value is too long for the field',
                details: { field: error.meta?.target },
            };
        case 'P2001':
            return {
                statusCode: 404,
                errorCode: 'RECORD_NOT_FOUND',
                message: 'Record not found',
                details: { condition: error.meta?.cause },
            };
        case 'P2002':
            return {
                statusCode: 409,
                errorCode: 'UNIQUE_CONSTRAINT_VIOLATION',
                message: 'A record with this value already exists',
                details: { fields: error.meta?.target },
            };
        case 'P2003':
            return {
                statusCode: 400,
                errorCode: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
                message: 'Foreign key constraint failed',
                details: { field: error.meta?.field_name },
            };
        case 'P2004':
            return {
                statusCode: 400,
                errorCode: 'CONSTRAINT_VIOLATION',
                message: 'A constraint failed on the database',
                details: { constraint: error.meta?.constraint },
            };
        case 'P2005':
            return {
                statusCode: 400,
                errorCode: 'INVALID_VALUE',
                message: 'The value stored in the database is invalid for the field type',
                details: { field: error.meta?.field_name, value: error.meta?.field_value },
            };
        case 'P2006':
            return {
                statusCode: 400,
                errorCode: 'INVALID_VALUE',
                message: 'The provided value is not valid',
                details: { field: error.meta?.field_name },
            };
        case 'P2007':
            return {
                statusCode: 400,
                errorCode: 'DATA_VALIDATION_ERROR',
                message: 'Data validation error',
                details: { errors: error.meta?.errors },
            };
        case 'P2008':
            return {
                statusCode: 400,
                errorCode: 'QUERY_PARSING_ERROR',
                message: 'Failed to parse the query',
                details: { query: error.meta?.query_parsing_error },
            };
        case 'P2009':
            return {
                statusCode: 400,
                errorCode: 'QUERY_VALIDATION_ERROR',
                message: 'Failed to validate the query',
                details: { query: error.meta?.query_validation_error },
            };
        case 'P2010':
            return {
                statusCode: 500,
                errorCode: 'RAW_QUERY_FAILED',
                message: 'Raw query failed',
                details: { error: error.meta?.message },
            };
        case 'P2011':
            return {
                statusCode: 400,
                errorCode: 'NULL_CONSTRAINT_VIOLATION',
                message: 'Null constraint violation',
                details: { constraint: error.meta?.constraint },
            };
        case 'P2012':
            return {
                statusCode: 400,
                errorCode: 'MISSING_REQUIRED_VALUE',
                message: 'Missing a required value',
                details: { path: error.meta?.path },
            };
        case 'P2013':
            return {
                statusCode: 400,
                errorCode: 'MISSING_REQUIRED_ARGUMENT',
                message: 'Missing the required argument',
                details: { argument: error.meta?.argument_name, field: error.meta?.field_name },
            };
        case 'P2014':
            return {
                statusCode: 400,
                errorCode: 'RELATION_VIOLATION',
                message: 'The change would violate the required relation',
                details: { relation: error.meta?.relation_name },
            };
        case 'P2015':
            return {
                statusCode: 404,
                errorCode: 'RELATED_RECORD_NOT_FOUND',
                message: 'A related record could not be found',
                details: { details: error.meta?.details },
            };
        case 'P2016':
            return {
                statusCode: 400,
                errorCode: 'QUERY_INTERPRETATION_ERROR',
                message: 'Query interpretation error',
                details: { details: error.meta?.details },
            };
        case 'P2017':
            return {
                statusCode: 400,
                errorCode: 'RECORDS_NOT_CONNECTED',
                message: 'The records for relation are not connected',
                details: { relation: error.meta?.relation_name },
            };
        case 'P2018':
            return {
                statusCode: 404,
                errorCode: 'REQUIRED_CONNECTED_RECORDS_NOT_FOUND',
                message: 'The required connected records were not found',
                details: { details: error.meta?.details },
            };
        case 'P2019':
            return {
                statusCode: 400,
                errorCode: 'INPUT_ERROR',
                message: 'Input error',
                details: { details: error.meta?.details },
            };
        case 'P2020':
            return {
                statusCode: 400,
                errorCode: 'VALUE_OUT_OF_RANGE',
                message: 'Value out of range for the type',
                details: { details: error.meta?.details },
            };
        case 'P2021':
            return {
                statusCode: 404,
                errorCode: 'TABLE_NOT_FOUND',
                message: 'The table does not exist in the current database',
                details: { table: error.meta?.table },
            };
        case 'P2022':
            return {
                statusCode: 404,
                errorCode: 'COLUMN_NOT_FOUND',
                message: 'The column does not exist in the current database',
                details: { column: error.meta?.column },
            };
        case 'P2025':
            return {
                statusCode: 404,
                errorCode: 'RECORD_NOT_FOUND',
                message: 'An operation failed because it depends on one or more records that were required but not found',
                details: { cause: error.meta?.cause },
            };
        default:
            return {
                statusCode: 500,
                errorCode: 'DATABASE_ERROR',
                message: 'Database operation failed',
                details: { code: error.code, meta: error.meta },
            };
    }
}
// Custom error classes
class ValidationError extends Error {
    constructor(message, details) {
        super(message);
        this.statusCode = 400;
        this.code = 'VALIDATION_ERROR';
        this.name = 'ValidationError';
        this.details = details;
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends Error {
    constructor(message = 'Resource not found') {
        super(message);
        this.statusCode = 404;
        this.code = 'NOT_FOUND';
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class UnauthorizedError extends Error {
    constructor(message = 'Unauthorized') {
        super(message);
        this.statusCode = 401;
        this.code = 'UNAUTHORIZED';
        this.name = 'UnauthorizedError';
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends Error {
    constructor(message = 'Forbidden') {
        super(message);
        this.statusCode = 403;
        this.code = 'FORBIDDEN';
        this.name = 'ForbiddenError';
    }
}
exports.ForbiddenError = ForbiddenError;
class ConflictError extends Error {
    constructor(message = 'Conflict') {
        super(message);
        this.statusCode = 409;
        this.code = 'CONFLICT';
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
class BadRequestError extends Error {
    constructor(message = 'Bad request', details) {
        super(message);
        this.statusCode = 400;
        this.code = 'BAD_REQUEST';
        this.name = 'BadRequestError';
        this.details = details;
    }
}
exports.BadRequestError = BadRequestError;
//# sourceMappingURL=error-handler.js.map