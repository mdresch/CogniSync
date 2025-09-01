"use strict";
/**
 * CogniSync Shared Security Module
 * Provides comprehensive security utilities for inter-service communication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySecurityPreset = exports.SecurityPresets = exports.getServiceSecurityConfig = exports.validateSecurityConfig = exports.loadSecurityConfig = exports.getDefaultMTLSConfig = exports.createMTLSManager = exports.MTLSManager = exports.createInterServiceClient = exports.ServiceRegistry = exports.InterServiceClient = exports.requireServiceAuth = exports.requireTenant = exports.requireRoles = exports.requireScopes = exports.createAuthMiddleware = exports.AuthorizationMiddleware = exports.ServiceAuthMiddleware = exports.createJWTManager = exports.JWTSecurityManager = void 0;
// JWT utilities
var jwt_utils_1 = require("./jwt-utils");
Object.defineProperty(exports, "JWTSecurityManager", { enumerable: true, get: function () { return jwt_utils_1.JWTSecurityManager; } });
Object.defineProperty(exports, "createJWTManager", { enumerable: true, get: function () { return jwt_utils_1.createJWTManager; } });
// Authentication and authorization middleware
var service_auth_middleware_1 = require("./service-auth.middleware");
Object.defineProperty(exports, "ServiceAuthMiddleware", { enumerable: true, get: function () { return service_auth_middleware_1.ServiceAuthMiddleware; } });
Object.defineProperty(exports, "AuthorizationMiddleware", { enumerable: true, get: function () { return service_auth_middleware_1.AuthorizationMiddleware; } });
Object.defineProperty(exports, "createAuthMiddleware", { enumerable: true, get: function () { return service_auth_middleware_1.createAuthMiddleware; } });
Object.defineProperty(exports, "requireScopes", { enumerable: true, get: function () { return service_auth_middleware_1.requireScopes; } });
Object.defineProperty(exports, "requireRoles", { enumerable: true, get: function () { return service_auth_middleware_1.requireRoles; } });
Object.defineProperty(exports, "requireTenant", { enumerable: true, get: function () { return service_auth_middleware_1.requireTenant; } });
Object.defineProperty(exports, "requireServiceAuth", { enumerable: true, get: function () { return service_auth_middleware_1.requireServiceAuth; } });
// Inter-service communication client
var inter_service_client_1 = require("./inter-service-client");
Object.defineProperty(exports, "InterServiceClient", { enumerable: true, get: function () { return inter_service_client_1.InterServiceClient; } });
Object.defineProperty(exports, "ServiceRegistry", { enumerable: true, get: function () { return inter_service_client_1.ServiceRegistry; } });
Object.defineProperty(exports, "createInterServiceClient", { enumerable: true, get: function () { return inter_service_client_1.createInterServiceClient; } });
// mTLS configuration
var mtls_config_1 = require("./mtls-config");
Object.defineProperty(exports, "MTLSManager", { enumerable: true, get: function () { return mtls_config_1.MTLSManager; } });
Object.defineProperty(exports, "createMTLSManager", { enumerable: true, get: function () { return mtls_config_1.createMTLSManager; } });
Object.defineProperty(exports, "getDefaultMTLSConfig", { enumerable: true, get: function () { return mtls_config_1.getDefaultMTLSConfig; } });
// Security configuration
var security_config_1 = require("./security-config");
Object.defineProperty(exports, "loadSecurityConfig", { enumerable: true, get: function () { return security_config_1.loadSecurityConfig; } });
Object.defineProperty(exports, "validateSecurityConfig", { enumerable: true, get: function () { return security_config_1.validateSecurityConfig; } });
Object.defineProperty(exports, "getServiceSecurityConfig", { enumerable: true, get: function () { return security_config_1.getServiceSecurityConfig; } });
Object.defineProperty(exports, "SecurityPresets", { enumerable: true, get: function () { return security_config_1.SecurityPresets; } });
Object.defineProperty(exports, "applySecurityPreset", { enumerable: true, get: function () { return security_config_1.applySecurityPreset; } });
//# sourceMappingURL=index.js.map