/**
 * CogniSync Shared Security Module
 * Provides comprehensive security utilities for inter-service communication
 */

// JWT utilities
export {
  JWTSecurityManager,
  ServiceToken,
  UserToken,
  createJWTManager
} from './jwt-utils';

// Authentication and authorization middleware
export {
  ServiceAuthMiddleware,
  AuthorizationMiddleware,
  AuthenticatedRequest,
  AuthMiddlewareOptions,
  createAuthMiddleware,
  requireScopes,
  requireRoles,
  requireTenant,
  requireServiceAuth
} from './service-auth.middleware';

// Inter-service communication client
export {
  InterServiceClient,
  ServiceRegistry,
  ServiceClientOptions,
  SecureRequestOptions,
  createInterServiceClient
} from './inter-service-client';

// mTLS configuration
export {
  MTLSManager,
  MTLSConfig,
  ServiceCertificate,
  createMTLSManager,
  getDefaultMTLSConfig
} from './mtls-config';

// Security configuration
export {
  SecurityConfig,
  loadSecurityConfig,
  validateSecurityConfig,
  getServiceSecurityConfig,
  SecurityPresets,
  applySecurityPreset
} from './security-config';

// Re-export commonly used types
export type {
  AuthenticatedRequest as SecureRequest,
  ServiceToken,
  UserToken,
  MTLSConfig,
  SecurityConfig
};