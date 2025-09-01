"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireServiceAuth = exports.requireTenant = exports.requireRoles = exports.requireScopes = exports.AuthorizationMiddleware = exports.ServiceAuthMiddleware = void 0;
exports.createAuthMiddleware = createAuthMiddleware;
const jwt_utils_1 = require("./jwt-utils");
class ServiceAuthMiddleware {
    constructor(options) {
        this.authenticate = (req, res, next) => {
            if (this.shouldSkipAuth(req.path)) {
                return next();
            }
            if (this.options.developmentMode && process.env.DISABLE_AUTH === 'true') {
                this.setDevelopmentAuth(req);
                return next();
            }
            try {
                if (this.tryJWTAuthentication(req)) {
                    return next();
                }
                if (this.options.allowApiKeys && this.tryApiKeyAuthentication(req)) {
                    return next();
                }
                return this.sendAuthError(res, 'Authentication required', 'MISSING_AUTH');
            }
            catch (error) {
                let errorMsg = 'Unknown error';
                if (error && typeof error === 'object' && 'message' in error) {
                    errorMsg = error.message;
                }
                return this.sendAuthError(res, errorMsg, 'AUTH_ERROR');
            }
        };
        this.options = {
            allowApiKeys: true,
            allowServiceTokens: true,
            allowUserTokens: true,
            skipPaths: ['/health', '/metrics'],
            developmentMode: process.env.NODE_ENV === 'development',
            ...options
        };
        this.jwtManager = new jwt_utils_1.JWTSecurityManager(options.serviceId);
        this.validApiKeys = new Set(this.loadValidApiKeys());
    }
    loadValidApiKeys() {
        const apiKeysEnv = process.env.VALID_API_KEYS || process.env.API_KEYS;
        if (!apiKeysEnv)
            return [];
        return apiKeysEnv.split(',').map(key => key.trim()).filter(key => key.length > 0);
    }
    tryJWTAuthentication(req) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return false;
        }
        const token = authHeader.slice(7);
        try {
            if (this.options.allowServiceTokens) {
                try {
                    const serviceToken = this.jwtManager.validateServiceToken(token);
                    this.setServiceAuth(req, serviceToken);
                    return true;
                }
                catch (error) {
                }
            }
            if (this.options.allowUserTokens) {
                try {
                    const userToken = this.jwtManager.validateUserToken(token);
                    this.setUserAuth(req, userToken);
                    return true;
                }
                catch (error) {
                }
            }
            return false;
        }
        catch (error) {
            let errorMsg = 'Unknown error';
            if (error && typeof error === 'object' && 'message' in error) {
                errorMsg = error.message;
            }
            throw new Error(`Invalid JWT token: ${errorMsg}`);
        }
    }
    tryApiKeyAuthentication(req) {
        const apiKey = req.headers['x-api-key'] ||
            req.headers['api-key'] ||
            (req.headers.authorization?.startsWith('ApiKey ') ?
                req.headers.authorization.slice(7) : null);
        if (!apiKey) {
            return false;
        }
        if (!this.isValidApiKey(apiKey)) {
            throw new Error('Invalid API key');
        }
        this.setApiKeyAuth(req, apiKey);
        return true;
    }
    isValidApiKey(apiKey) {
        if (this.validApiKeys.has(apiKey)) {
            return true;
        }
        const servicePrefix = `${this.options.serviceId}-`;
        if (apiKey.startsWith(servicePrefix) && apiKey.length > servicePrefix.length + 10) {
            return true;
        }
        return false;
    }
    setServiceAuth(req, token) {
        req.service = {
            serviceId: token.serviceId,
            tenantId: token.tenantId,
            scopes: token.scopes
        };
        req.authType = 'service';
        req.tenantId = token.tenantId;
        req.scopes = token.scopes;
        if (this.options.allowedServices &&
            !this.options.allowedServices.includes(token.serviceId)) {
            throw new Error(`Service ${token.serviceId} not allowed`);
        }
    }
    setUserAuth(req, token) {
        req.user = {
            userId: token.userId,
            tenantId: token.tenantId,
            email: token.email,
            roles: token.roles,
            scopes: token.scopes
        };
        req.authType = 'user';
        req.tenantId = token.tenantId;
        req.scopes = token.scopes;
    }
    setApiKeyAuth(req, apiKey) {
        const tenantId = this.extractTenantFromApiKey(apiKey);
        req.authType = 'apikey';
        req.tenantId = tenantId;
        req.scopes = ['read', 'write'];
    }
    extractTenantFromApiKey(apiKey) {
        const parts = apiKey.split('-');
        if (parts.length >= 3) {
            return parts[1];
        }
        return undefined;
    }
    setDevelopmentAuth(req) {
        const tenantId = req.headers['x-tenant-id'] ||
            req.query.tenantId ||
            'dev-tenant';
        req.authType = 'user';
        req.tenantId = tenantId;
        req.scopes = ['read', 'write', 'admin'];
        req.user = {
            userId: 'dev-user',
            tenantId,
            roles: ['admin'],
            scopes: ['read', 'write', 'admin']
        };
    }
    shouldSkipAuth(path) {
        return this.options.skipPaths?.some(skipPath => path === skipPath || path.startsWith(skipPath + '/')) || false;
    }
    sendAuthError(res, message, code) {
        return res.status(401).json({
            error: 'Authentication failed',
            code,
            message,
            timestamp: new Date().toISOString(),
            supportedMethods: this.getSupportedAuthMethods()
        });
    }
    getSupportedAuthMethods() {
        const methods = [];
        if (this.options.allowUserTokens) {
            methods.push('Bearer JWT (user token)');
        }
        if (this.options.allowServiceTokens) {
            methods.push('Bearer JWT (service token)');
        }
        if (this.options.allowApiKeys) {
            methods.push('x-api-key header');
            methods.push('ApiKey authorization header');
        }
        return methods;
    }
}
exports.ServiceAuthMiddleware = ServiceAuthMiddleware;
class AuthorizationMiddleware {
    static requireScopes(requiredScopes) {
        return (req, res, next) => {
            if (process.env.DISABLE_AUTH === 'true') {
                return next();
            }
            if (!req.scopes) {
                return res.status(403).json({
                    error: 'Authorization failed',
                    code: 'MISSING_SCOPES',
                    message: 'No scopes found in authentication context'
                });
            }
            const hasRequiredScopes = requiredScopes.every(scope => req.scopes.includes(scope) || req.scopes.includes('admin'));
            if (!hasRequiredScopes) {
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    code: 'INSUFFICIENT_SCOPES',
                    message: `Required scopes: ${requiredScopes.join(', ')}`,
                    available: req.scopes,
                    required: requiredScopes
                });
            }
            next();
        };
    }
    static requireRoles(requiredRoles) {
        return (req, res, next) => {
            if (process.env.DISABLE_AUTH === 'true') {
                return next();
            }
            if (req.authType !== 'user' || !req.user?.roles) {
                return res.status(403).json({
                    error: 'Authorization failed',
                    code: 'MISSING_ROLES',
                    message: 'User roles required for this operation'
                });
            }
            const hasRequiredRoles = requiredRoles.every(role => req.user.roles.includes(role) || req.user.roles.includes('admin'));
            if (!hasRequiredRoles) {
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    code: 'INSUFFICIENT_ROLES',
                    message: `Required roles: ${requiredRoles.join(', ')}`,
                    available: req.user.roles,
                    required: requiredRoles
                });
            }
            next();
        };
    }
    static requireTenant() {
        return (req, res, next) => {
            if (process.env.DISABLE_AUTH === 'true') {
                return next();
            }
            if (!req.tenantId) {
                return res.status(400).json({
                    error: 'Tenant required',
                    code: 'MISSING_TENANT',
                    message: 'This operation requires a valid tenant context'
                });
            }
            next();
        };
    }
    static requireServiceAuth(allowedServices) {
        return (req, res, next) => {
            if (process.env.DISABLE_AUTH === 'true') {
                return next();
            }
            if (req.authType !== 'service' || !req.service) {
                return res.status(403).json({
                    error: 'Service authentication required',
                    code: 'SERVICE_AUTH_REQUIRED',
                    message: 'This endpoint requires service-to-service authentication'
                });
            }
            if (allowedServices && !allowedServices.includes(req.service.serviceId)) {
                return res.status(403).json({
                    error: 'Service not authorized',
                    code: 'SERVICE_NOT_ALLOWED',
                    message: `Service ${req.service.serviceId} not authorized for this operation`,
                    allowedServices
                });
            }
            next();
        };
    }
}
exports.AuthorizationMiddleware = AuthorizationMiddleware;
function createAuthMiddleware(options) {
    const authMiddleware = new ServiceAuthMiddleware(options);
    return authMiddleware.authenticate;
}
exports.requireScopes = AuthorizationMiddleware.requireScopes;
exports.requireRoles = AuthorizationMiddleware.requireRoles;
exports.requireTenant = AuthorizationMiddleware.requireTenant;
exports.requireServiceAuth = AuthorizationMiddleware.requireServiceAuth;
//# sourceMappingURL=service-auth.middleware.js.map