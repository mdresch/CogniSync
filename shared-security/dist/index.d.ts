/**
 * CogniSync Shared Security Module
 * Provides comprehensive security utilities for inter-service communication
 */
export { JWTSecurityManager, ServiceToken, UserToken, createJWTManager } from './jwt-utils';
export { ServiceAuthMiddleware, AuthorizationMiddleware, AuthenticatedRequest, AuthMiddlewareOptions, createAuthMiddleware, requireScopes, requireRoles, requireTenant, requireServiceAuth } from './service-auth.middleware';
export { InterServiceClient, ServiceRegistry, ServiceClientOptions, SecureRequestOptions, createInterServiceClient } from './inter-service-client';
export { MTLSManager, MTLSConfig, ServiceCertificate, createMTLSManager, getDefaultMTLSConfig } from './mtls-config';
export { SecurityConfig, loadSecurityConfig, validateSecurityConfig, getServiceSecurityConfig, SecurityPresets, applySecurityPreset } from './security-config';
//# sourceMappingURL=index.d.ts.map