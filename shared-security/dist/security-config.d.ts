/**
 * Comprehensive security configuration for CogniSync platform
 * Centralizes all security settings and provides a unified interface
 */
import { MTLSConfig } from './mtls-config';
export interface SecurityConfig {
    serviceId: string;
    environment: 'development' | 'staging' | 'production' | 'test';
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
    authorization: {
        enableRBAC: boolean;
        enableScopeValidation: boolean;
        enableTenantIsolation: boolean;
        defaultScopes: string[];
        adminScopes: string[];
        serviceScopes: string[];
    };
    encryption: {
        algorithm: string;
        keyLength: number;
        enableDataEncryption: boolean;
        enableTransitEncryption: boolean;
        encryptionKey?: string;
    };
    mtls: MTLSConfig;
    rateLimiting: {
        enabled: boolean;
        windowMs: number;
        maxRequests: number;
        skipPaths: string[];
        trustProxy: boolean;
    };
    cors: {
        enabled: boolean;
        origins: string[];
        credentials: boolean;
        methods: string[];
        headers: string[];
    };
    securityHeaders: {
        enableHSTS: boolean;
        enableCSP: boolean;
        enableXFrameOptions: boolean;
        enableXContentTypeOptions: boolean;
        enableReferrerPolicy: boolean;
        customHeaders: Record<string, string>;
    };
    audit: {
        enableAuditLogging: boolean;
        auditLevel: 'minimal' | 'standard' | 'detailed';
        logFailedAttempts: boolean;
        logSuccessfulAttempts: boolean;
        retentionDays: number;
    };
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
export declare function loadSecurityConfig(serviceId: string): SecurityConfig;
/**
 * Validate security configuration
 */
export declare function validateSecurityConfig(config: SecurityConfig): string[];
/**
 * Get security configuration for specific service
 */
export declare function getServiceSecurityConfig(serviceId: string): SecurityConfig;
/**
 * Security configuration presets for different environments
 */
export declare const SecurityPresets: {
    development: {
        authentication: {
            enableApiKeys: boolean;
            enableJWT: boolean;
            enableServiceTokens: boolean;
        };
        authorization: {
            enableRBAC: boolean;
            enableScopeValidation: boolean;
            enableTenantIsolation: boolean;
        };
        encryption: {
            enableDataEncryption: boolean;
            enableTransitEncryption: boolean;
        };
        mtls: {
            enabled: boolean;
        };
        development: {
            disableAuth: boolean;
            allowInsecureConnections: boolean;
            enableDebugLogging: boolean;
        };
    };
    staging: {
        authentication: {
            enableApiKeys: boolean;
            enableJWT: boolean;
            enableServiceTokens: boolean;
        };
        authorization: {
            enableRBAC: boolean;
            enableScopeValidation: boolean;
            enableTenantIsolation: boolean;
        };
        encryption: {
            enableDataEncryption: boolean;
            enableTransitEncryption: boolean;
        };
        mtls: {
            enabled: boolean;
        };
        development: {
            disableAuth: boolean;
            allowInsecureConnections: boolean;
            enableDebugLogging: boolean;
        };
    };
    production: {
        authentication: {
            enableApiKeys: boolean;
            enableJWT: boolean;
            enableServiceTokens: boolean;
        };
        authorization: {
            enableRBAC: boolean;
            enableScopeValidation: boolean;
            enableTenantIsolation: boolean;
        };
        encryption: {
            enableDataEncryption: boolean;
            enableTransitEncryption: boolean;
        };
        mtls: {
            enabled: boolean;
        };
        development: {
            disableAuth: boolean;
            allowInsecureConnections: boolean;
            enableDebugLogging: boolean;
        };
    };
};
/**
 * Apply security preset to configuration
 */
export declare function applySecurityPreset(config: SecurityConfig, preset: keyof typeof SecurityPresets): SecurityConfig;
//# sourceMappingURL=security-config.d.ts.map