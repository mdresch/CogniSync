"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireTenantId = exports.getTenantId = exports.logTenantAccess = exports.addTenantContext = exports.validateTenant = exports.enforceTenantIsolation = exports.tenantMiddleware = void 0;
const logger_1 = require("../utils/logger");
// Middleware to extract and validate tenant information
const tenantMiddleware = (req, res, next) => {
    try {
        // For authenticated requests, use tenant from JWT token
        if (req.user?.tenantId) {
            req.tenantId = req.user.tenantId;
            next();
            return;
        }
        // For unauthenticated requests, try to extract tenant from headers or query
        const tenantFromHeader = req.get('X-Tenant-ID');
        const tenantFromQuery = req.query.tenantId;
        const tenantFromBody = req.body?.tenantId;
        const tenantId = tenantFromHeader || tenantFromQuery || tenantFromBody;
        if (tenantId) {
            req.tenantId = tenantId;
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Tenant middleware error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to process tenant information',
            },
        });
    }
};
exports.tenantMiddleware = tenantMiddleware;
// Middleware to enforce tenant isolation
const enforceTenantIsolation = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required for tenant isolation',
            },
        });
        return;
    }
    // Extract tenant ID from various sources in the request
    const requestTenantSources = [
        req.params.tenantId,
        req.body?.tenantId,
        req.query.tenantId,
        req.get('X-Tenant-ID'),
    ].filter(Boolean);
    // Check if any requested tenant ID doesn't match user's tenant
    for (const requestedTenantId of requestTenantSources) {
        if (requestedTenantId && requestedTenantId !== req.user.tenantId) {
            (0, logger_1.logSecurity)('Tenant isolation violation attempt', req.user.userId, req.ip, {
                userTenantId: req.user.tenantId,
                requestedTenantId,
                url: req.url,
                method: req.method,
            });
            res.status(403).json({
                success: false,
                error: {
                    code: 'TENANT_ISOLATION_VIOLATION',
                    message: 'Access denied: tenant isolation violation',
                },
            });
            return;
        }
    }
    // Ensure tenant ID is set for the request
    req.tenantId = req.user.tenantId;
    next();
};
exports.enforceTenantIsolation = enforceTenantIsolation;
// Middleware to validate tenant exists and is active
const validateTenant = (req, res, next) => {
    // This would typically check against a tenant registry or database
    // For now, we'll just ensure a tenant ID is present
    if (!req.tenantId) {
        res.status(400).json({
            success: false,
            error: {
                code: 'MISSING_TENANT',
                message: 'Tenant ID is required',
            },
        });
        return;
    }
    // TODO: Add actual tenant validation logic here
    // - Check if tenant exists in database
    // - Check if tenant is active
    // - Check tenant subscription status
    // - Apply tenant-specific rate limits
    next();
};
exports.validateTenant = validateTenant;
// Middleware to add tenant context to all database queries
const addTenantContext = (req, res, next) => {
    // Add tenant ID to request context for use in services
    if (req.tenantId) {
        // Store tenant context that can be used by services
        req.context = {
            ...req.context,
            tenantId: req.tenantId,
        };
    }
    next();
};
exports.addTenantContext = addTenantContext;
// Middleware to log tenant access patterns
const logTenantAccess = (req, res, next) => {
    if (req.tenantId && req.user) {
        logger_1.logger.info('Tenant access', {
            tenantId: req.tenantId,
            userId: req.user.userId,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString(),
        });
    }
    next();
};
exports.logTenantAccess = logTenantAccess;
// Helper function to extract tenant ID from request
const getTenantId = (req) => {
    return req.tenantId || req.user?.tenantId;
};
exports.getTenantId = getTenantId;
// Helper function to ensure tenant ID is present
const requireTenantId = (req) => {
    const tenantId = (0, exports.getTenantId)(req);
    if (!tenantId) {
        throw new Error('Tenant ID is required');
    }
    return tenantId;
};
exports.requireTenantId = requireTenantId;
//# sourceMappingURL=tenant.middleware.js.map