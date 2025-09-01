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
    private generateSecureSecret;
    generateServiceToken(targetService: string, scopes?: string[], tenantId?: string): string;
    generateUserToken(userId: string, tenantId: string, roles?: string[], scopes?: string[], email?: string, expiresIn?: string): string;
    validateToken(token: string, expectedAudience?: string): ServiceToken | UserToken;
    validateServiceToken(token: string): ServiceToken;
    validateUserToken(token: string): UserToken;
    private generateKeyId;
    private parseExpiresIn;
    createSignedRequest(targetService: string, method: string, path: string, body?: any): {
        token: string;
        signature: string;
        timestamp: string;
    };
    verifySignedRequest(token: string, signature: string, timestamp: string, method: string, path: string, body?: any): boolean;
}
export declare const createJWTManager: (serviceId: string) => JWTSecurityManager;
//# sourceMappingURL=jwt-utils.d.ts.map