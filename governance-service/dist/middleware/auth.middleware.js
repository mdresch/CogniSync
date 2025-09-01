"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTenantAccess = exports.optionalAuth = exports.requireAnyRole = exports.requireRole = exports.requireAnyPermission = exports.requirePermission = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            (0, logger_1.logSecurity)('Missing authorization header', undefined, req.ip);
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authorization header is required',
                },
            });
            return;
        }
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        if (!token) {
            (0, logger_1.logSecurity)('Missing token in authorization header', undefined, req.ip);
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Token is required',
                },
            });
            return;
        }
        // Verify JWT token
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
        // Validate token structure
        if (!decoded.userId || !decoded.tenantId) {
            (0, logger_1.logSecurity)('Invalid token structure', decoded.userId, req.ip);
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Invalid token',
                },
            });
            return;
        }
        // Add user info to request
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            tenantId: decoded.tenantId,
            roles: decoded.roles || [],
            permissions: decoded.permissions || [],
        };
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            (0, logger_1.logSecurity)('Token expired', undefined, req.ip);
            res.status(401).json({
                success: false,
                error: {
                    code: 'TOKEN_EXPIRED',
                    message: 'Token has expired',
                },
            });
            return;
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            (0, logger_1.logSecurity)('Invalid token', undefined, req.ip, { error: error.message });
            res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid token',
                },
            });
            return;
        }
        logger_1.logger.error('Authentication error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Authentication failed',
            },
        });
    }
};
exports.authMiddleware = authMiddleware;
// Middleware to check specific permissions
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                },
            });
            return;
        }
        const hasPermission = req.user.permissions.includes(permission) ||
            req.user.permissions.includes('*');
        if (!hasPermission) {
            (0, logger_1.logSecurity)('Permission denied', req.user.userId, req.ip, {
                requiredPermission: permission,
                userPermissions: req.user.permissions,
            });
            res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: `Permission required: ${permission}`,
                },
            });
            return;
        }
        next();
    };
};
exports.requirePermission = requirePermission;
// Middleware to check if user has any of the specified permissions
const requireAnyPermission = (permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                },
            });
            return;
        }
        const hasAnyPermission = permissions.some(permission => req.user.permissions.includes(permission) || req.user.permissions.includes('*'));
        if (!hasAnyPermission) {
            (0, logger_1.logSecurity)('Permission denied', req.user.userId, req.ip, {
                requiredPermissions: permissions,
                userPermissions: req.user.permissions,
            });
            res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: `One of these permissions required: ${permissions.join(', ')}`,
                },
            });
            return;
        }
        next();
    };
};
exports.requireAnyPermission = requireAnyPermission;
// Middleware to check if user has a specific role
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                },
            });
            return;
        }
        const hasRole = req.user.roles.includes(role);
        if (!hasRole) {
            (0, logger_1.logSecurity)('Role access denied', req.user.userId, req.ip, {
                requiredRole: role,
                userRoles: req.user.roles,
            });
            res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: `Role required: ${role}`,
                },
            });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
// Middleware to check if user has any of the specified roles
const requireAnyRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                },
            });
            return;
        }
        const hasAnyRole = roles.some(role => req.user.roles.includes(role));
        if (!hasAnyRole) {
            (0, logger_1.logSecurity)('Role access denied', req.user.userId, req.ip, {
                requiredRoles: roles,
                userRoles: req.user.roles,
            });
            res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: `One of these roles required: ${roles.join(', ')}`,
                },
            });
            return;
        }
        next();
    };
};
exports.requireAnyRole = requireAnyRole;
// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            next();
            return;
        }
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        if (!token) {
            next();
            return;
        }
        // Verify JWT token
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
        // Add user info to request if token is valid
        if (decoded.userId && decoded.tenantId) {
            req.user = {
                userId: decoded.userId,
                email: decoded.email,
                tenantId: decoded.tenantId,
                roles: decoded.roles || [],
                permissions: decoded.permissions || [],
            };
        }
        next();
    }
    catch (error) {
        // Ignore token errors for optional auth
        next();
    }
};
exports.optionalAuth = optionalAuth;
// Middleware to validate tenant access
const validateTenantAccess = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
            },
        });
        return;
    }
    // Check if the requested resource belongs to the user's tenant
    const requestedTenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
    if (requestedTenantId && requestedTenantId !== req.user.tenantId) {
        (0, logger_1.logSecurity)('Tenant isolation violation', req.user.userId, req.ip, {
            userTenantId: req.user.tenantId,
            requestedTenantId,
        });
        res.status(403).json({
            success: false,
            error: {
                code: 'FORBIDDEN',
                message: 'Access denied to this tenant resource',
            },
        });
        return;
    }
    next();
};
exports.validateTenantAccess = validateTenantAccess;
//# sourceMappingURL=auth.middleware.js.map