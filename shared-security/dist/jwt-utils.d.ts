/**
 * Shared JWT utilities for inter-service communication
 * Provides secure token generation, validation, and service-to-service authentication
 */
export interface ServiceToken {
    serviceId: string;
    tenantId?: string;
    scopes: string[];
    iat: number;
    exp: number;
    iss: string;
    aud: string[];
}
export interface UserToken {
    userId: string;
    tenantId: string;
    email?: string;
    roles: string[];
    scopes: string[];
    iat: number;
    exp: number;
    iss: string;
    aud: string[];
}
export declare class JWTSecurityManager {
    private readonly jwtSecret;
    private readonly issuer;
    private readonly serviceId;
    constructor(serviceId: string, jwtSecret?: string, issuer?: string);
    /**
     * Generate a secure random secret for JWT signing
     */
    private generateSecureSecret;
    /**
     * Generate a service-to-service authentication token
     */
    generateServiceToken(targetService: string, scopes?: string[], tenantId?: string): string;
    /**
     * Generate a user authentication token
     */
    generateUserToken(userId: string, tenantId: string, roles?: string[], scopes?: string[], email?: string, expiresIn?: string): string;
    /**
     * Validate and decode a JWT token
     */
    validateToken(token: string, expectedAudience?: string): ServiceToken | UserToken;
    /**
     * Validate service-to-service token
     */
    validateServiceToken(token: string): ServiceToken;
    /**
     * Validate user token
     */
    validateUserToken(token: string): UserToken;
    /**
     * Generate a key ID for token headers
     */
    private generateKeyId;
    /**
     * Parse expires in string to seconds
     */
    private parseExpiresIn;
    /**
     * Create a signed request for inter-service communication
     */
    createSignedRequest(targetService: string, method: string, path: string, body?: any): {
        token: string;
        signature: string;
        timestamp: string;
    };
    /**
     * Verify a signed request
     */
    verifySignedRequest(token: string, signature: string, timestamp: string, method: string, path: string, body?: any): boolean;
}
/**
 * Default JWT manager instance
 */
export declare const createJWTManager: (serviceId: string) => JWTSecurityManager;
//# sourceMappingURL=jwt-utils.d.ts.map