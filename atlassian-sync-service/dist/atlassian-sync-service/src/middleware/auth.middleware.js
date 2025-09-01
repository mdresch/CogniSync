"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminAccess = exports.requireWriteAccess = exports.requireReadAccess = exports.requireServiceAuth = exports.requireTenant = exports.requireScopes = exports.authenticate = void 0;
exports.apiKeyAuth = apiKeyAuth;
exports.webhookAuth = webhookAuth;
const service_auth_middleware_1 = require("../../../shared-security/service-auth.middleware");
Object.defineProperty(exports, "requireScopes", { enumerable: true, get: function () { return service_auth_middleware_1.requireScopes; } });
Object.defineProperty(exports, "requireTenant", { enumerable: true, get: function () { return service_auth_middleware_1.requireTenant; } });
Object.defineProperty(exports, "requireServiceAuth", { enumerable: true, get: function () { return service_auth_middleware_1.requireServiceAuth; } });
const authMiddleware = (0, service_auth_middleware_1.createAuthMiddleware)({
    serviceId: 'atlassian-sync-service',
    allowedServices: ['knowledge-graph-service', 'llm-rag-service'],
    allowApiKeys: true,
    allowServiceTokens: true,
    allowUserTokens: true,
    skipPaths: ['/health', '/metrics', '/api/status'],
    developmentMode: process.env.NODE_ENV === 'development'
});
const VALID_API_KEYS = process.env.VALID_API_KEYS
    ? process.env.VALID_API_KEYS.split(',').map(k => k.trim())
    : [];
function apiKeyAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    console.log('[AUTH] Received Authorization header:', authHeader);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('[AUTH] Missing or invalid Authorization header');
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const apiKey = authHeader.replace('Bearer ', '').trim();
    const isValid = VALID_API_KEYS.includes(apiKey);
    console.log('[AUTH] Extracted API key:', apiKey, '| Valid:', isValid);
    if (!isValid) {
        console.warn('[AUTH] Invalid API key:', apiKey);
        return res.status(403).json({ error: 'Invalid API key' });
    }
    return next();
}
exports.authenticate = authMiddleware;
exports.requireReadAccess = (0, service_auth_middleware_1.requireScopes)(['read']);
exports.requireWriteAccess = (0, service_auth_middleware_1.requireScopes)(['write']);
exports.requireAdminAccess = (0, service_auth_middleware_1.requireScopes)(['admin']);
function webhookAuth(req, res, next) {
    if (req.authType === 'apikey' || req.authType === 'service') {
        return next();
    }
    return res.status(403).json({
        error: 'Webhook authentication required',
        message: 'Webhooks require API key or service token authentication'
    });
}
//# sourceMappingURL=auth.middleware.js.map