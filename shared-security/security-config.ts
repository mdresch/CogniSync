/**
 * Comprehensive security configuration for CogniSync platform
 * Centralizes all security settings and provides a unified interface
 */

import { MTLSConfig, getDefaultMTLSConfig } from './mtls-config';

export interface SecurityConfig {
  // Service identification
  serviceId: string;
  environment: 'development' | 'staging' | 'production' | 'test';
  
  // Authentication settings
  authentication: {
    jwtSecret: string;
    jwtIssuer: string;
    jwtExpiresIn: string;
    apiKeyPrefix: string;
    allowedApiKeys: string[];
    enableApiKeys: boolean;
    enableJWT: boolean;
    enableServiceTokens: boolean;
  };

  // Authorization settings
  authorization: {
    enableRBAC: boolean;
    enableScopeValidation: boolean;
    enableTenantIsolation: boolean;
    defaultScopes: string[];
    adminScopes: string[];
    serviceScopes: string[];
  };

  // Encryption settings
  encryption: {
    algorithm: string;
    keyLength: number;
    enableDataEncryption: boolean;
    enableTransitEncryption: boolean;
    encryptionKey?: string;
  };

  // mTLS settings
  mtls: MTLSConfig;

  // Rate limiting
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipPaths: string[];
    trustProxy: boolean;
  };

  // CORS settings
  cors: {
    enabled: boolean;
    origins: string[];
    credentials: boolean;
    methods: string[];
    headers: string[];
  };

  // Security headers
  securityHeaders: {
    enableHSTS: boolean;
    enableCSP: boolean;
    enableXFrameOptions: boolean;
    enableXContentTypeOptions: boolean;
    enableReferrerPolicy: boolean;
    customHeaders: Record<string, string>;
  };

  // Audit and logging
  audit: {
    enableAuditLogging: boolean;
    auditLevel: 'minimal' | 'standard' | 'detailed';
    logFailedAttempts: boolean;
    logSuccessfulAttempts: boolean;
    retentionDays: number;
  };

  // Development settings
  development: {
    disableAuth: boolean;
    allowInsecureConnections: boolean;
    enableDebugLogging: boolean;
    mockExternalServices: boolean;
  };
}

/**
 * Load security configuration from environment variables
 */
export function loadSecurityConfig(serviceId: string): SecurityConfig {
  const environment = (process.env.NODE_ENV as any) || 'development';
  const isProduction = environment === 'production';
  const isDevelopment = environment === 'development';

  return {
    serviceId,
    environment,

    authentication: {
      jwtSecret: process.env.JWT_SECRET || generateSecureSecret(),
      jwtIssuer: process.env.JWT_ISSUER || 'cognisync-platform',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
      apiKeyPrefix: process.env.API_KEY_PREFIX || serviceId,
      allowedApiKeys: (process.env.VALID_API_KEYS || process.env.API_KEYS || '')
        .split(',')
        .map(key => key.trim())
        .filter(key => key.length > 0),
      enableApiKeys: process.env.ENABLE_API_KEYS !== 'false',
      enableJWT: process.env.ENABLE_JWT !== 'false',
      enableServiceTokens: process.env.ENABLE_SERVICE_TOKENS !== 'false'
    },

    authorization: {
      enableRBAC: process.env.ENABLE_RBAC === 'true',
      enableScopeValidation: process.env.ENABLE_SCOPE_VALIDATION !== 'false',
      enableTenantIsolation: process.env.TENANT_ISOLATION_ENABLED === 'true',
      defaultScopes: (process.env.DEFAULT_SCOPES || 'read').split(','),
      adminScopes: (process.env.ADMIN_SCOPES || 'admin,read,write,delete').split(','),
      serviceScopes: (process.env.SERVICE_SCOPES || 'read,write').split(',')
    },

    encryption: {
      algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
      keyLength: parseInt(process.env.ENCRYPTION_KEY_LENGTH || '32'),
      enableDataEncryption: process.env.ENABLE_DATA_ENCRYPTION === 'true',
      enableTransitEncryption: process.env.ENABLE_TRANSIT_ENCRYPTION !== 'false',
      encryptionKey: process.env.ENCRYPTION_KEY
    },

    mtls: getDefaultMTLSConfig(),

    rateLimiting: {
      enabled: process.env.ENABLE_RATE_LIMITING !== 'false',
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      skipPaths: (process.env.RATE_LIMIT_SKIP_PATHS || '/health,/metrics').split(','),
      trustProxy: process.env.TRUST_PROXY === 'true'
    },

    cors: {
      enabled: process.env.ENABLE_CORS !== 'false',
      origins: (process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || '*').split(','),
      credentials: process.env.CORS_CREDENTIALS === 'true',
      methods: (process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS').split(','),
      headers: (process.env.CORS_HEADERS || 'Content-Type,Authorization,x-api-key,x-tenant-id').split(',')
    },

    securityHeaders: {
      enableHSTS: process.env.ENABLE_HSTS !== 'false' && isProduction,
      enableCSP: process.env.ENABLE_CSP !== 'false',
      enableXFrameOptions: process.env.ENABLE_X_FRAME_OPTIONS !== 'false',
      enableXContentTypeOptions: process.env.ENABLE_X_CONTENT_TYPE_OPTIONS !== 'false',
      enableReferrerPolicy: process.env.ENABLE_REFERRER_POLICY !== 'false',
      customHeaders: parseCustomHeaders(process.env.CUSTOM_SECURITY_HEADERS)
    },

    audit: {
      enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING === 'true',
      auditLevel: (process.env.AUDIT_LEVEL as any) || 'standard',
      logFailedAttempts: process.env.LOG_FAILED_ATTEMPTS !== 'false',
      logSuccessfulAttempts: process.env.LOG_SUCCESSFUL_ATTEMPTS === 'true',
      retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '90')
    },

    development: {
      disableAuth: isDevelopment && process.env.DISABLE_AUTH === 'true',
      allowInsecureConnections: isDevelopment && process.env.ALLOW_INSECURE === 'true',
      enableDebugLogging: isDevelopment && process.env.DEBUG_LOGGING === 'true',
      mockExternalServices: isDevelopment && process.env.MOCK_EXTERNAL_SERVICES === 'true'
    }
  };
}

/**
 * Validate security configuration
 */
export function validateSecurityConfig(config: SecurityConfig): string[] {
  const errors: string[] = [];

  // Validate JWT secret
  if (config.authentication.enableJWT && config.authentication.jwtSecret.length < 32) {
    errors.push('JWT secret must be at least 32 characters long');
  }

  // Validate API keys in production
  if (config.environment === 'production' && 
      config.authentication.enableApiKeys && 
      config.authentication.allowedApiKeys.length === 0) {
    errors.push('API keys must be configured in production environment');
  }

  // Validate encryption key
  if (config.encryption.enableDataEncryption && !config.encryption.encryptionKey) {
    errors.push('Encryption key must be provided when data encryption is enabled');
  }

  // Validate mTLS configuration
  if (config.mtls.enabled) {
    if (!config.mtls.certPath || !config.mtls.keyPath || !config.mtls.caPath) {
      errors.push('mTLS certificate paths must be provided when mTLS is enabled');
    }
  }

  // Validate CORS origins in production
  if (config.environment === 'production' && 
      config.cors.enabled && 
      config.cors.origins.includes('*')) {
    errors.push('CORS origins should not include wildcard (*) in production');
  }

  return errors;
}

/**
 * Generate a secure random secret
 */
function generateSecureSecret(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Parse custom headers from environment variable
 */
function parseCustomHeaders(headersString?: string): Record<string, string> {
  if (!headersString) return {};

  try {
    return JSON.parse(headersString);
  } catch (error) {
    // Fallback to simple key=value parsing
    const headers: Record<string, string> = {};
    headersString.split(',').forEach(header => {
      const [key, value] = header.split('=');
      if (key && value) {
        headers[key.trim()] = value.trim();
      }
    });
    return headers;
  }
}

/**
 * Get security configuration for specific service
 */
export function getServiceSecurityConfig(serviceId: string): SecurityConfig {
  const config = loadSecurityConfig(serviceId);
  
  // Validate configuration
  const errors = validateSecurityConfig(config);
  if (errors.length > 0) {
    throw new Error(`Security configuration validation failed:\n${errors.join('\n')}`);
  }

  return config;
}

/**
 * Security configuration presets for different environments
 */
export const SecurityPresets = {
  development: {
    authentication: {
      enableApiKeys: true,
      enableJWT: true,
      enableServiceTokens: true
    },
    authorization: {
      enableRBAC: false,
      enableScopeValidation: true,
      enableTenantIsolation: false
    },
    encryption: {
      enableDataEncryption: false,
      enableTransitEncryption: false
    },
    mtls: {
      enabled: false
    },
    development: {
      disableAuth: true,
      allowInsecureConnections: true,
      enableDebugLogging: true
    }
  },

  staging: {
    authentication: {
      enableApiKeys: true,
      enableJWT: true,
      enableServiceTokens: true
    },
    authorization: {
      enableRBAC: true,
      enableScopeValidation: true,
      enableTenantIsolation: true
    },
    encryption: {
      enableDataEncryption: true,
      enableTransitEncryption: true
    },
    mtls: {
      enabled: true
    },
    development: {
      disableAuth: false,
      allowInsecureConnections: false,
      enableDebugLogging: false
    }
  },

  production: {
    authentication: {
      enableApiKeys: true,
      enableJWT: true,
      enableServiceTokens: true
    },
    authorization: {
      enableRBAC: true,
      enableScopeValidation: true,
      enableTenantIsolation: true
    },
    encryption: {
      enableDataEncryption: true,
      enableTransitEncryption: true
    },
    mtls: {
      enabled: true
    },
    development: {
      disableAuth: false,
      allowInsecureConnections: false,
      enableDebugLogging: false
    }
  }
};

/**
 * Apply security preset to configuration
 */
export function applySecurityPreset(
  config: SecurityConfig, 
  preset: keyof typeof SecurityPresets
): SecurityConfig {
  const presetConfig = SecurityPresets[preset];
  
  return {
    ...config,
    authentication: { ...config.authentication, ...presetConfig.authentication },
    authorization: { ...config.authorization, ...presetConfig.authorization },
    encryption: { ...config.encryption, ...presetConfig.encryption },
    mtls: { ...config.mtls, ...presetConfig.mtls },
    development: { ...config.development, ...presetConfig.development }
  };
}