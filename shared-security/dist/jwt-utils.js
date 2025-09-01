"use strict";
/**
 * Shared JWT utilities for inter-service communication
 * Provides secure token generation, validation, and service-to-service authentication
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJWTManager = exports.JWTSecurityManager = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
class JWTSecurityManager {
    constructor(serviceId, jwtSecret, issuer) {
        this.serviceId = serviceId;
        this.jwtSecret = jwtSecret || process.env.JWT_SECRET || this.generateSecureSecret();
        this.issuer = issuer || process.env.JWT_ISSUER || 'cognisync-platform';
        if (this.jwtSecret.length < 32) {
            throw new Error('JWT secret must be at least 32 characters long');
        }
    }
    /**
     * Generate a secure random secret for JWT signing
     */
    generateSecureSecret() {
        return crypto_1.default.randomBytes(64).toString('hex');
    }
    /**
     * Generate a service-to-service authentication token
     */
    generateServiceToken(targetService, scopes = ['read'], tenantId) {
        const payload = {
            serviceId: this.serviceId,
            tenantId,
            scopes,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
            iss: this.issuer,
            aud: [targetService]
        };
        return jsonwebtoken_1.default.sign(payload, this.jwtSecret, {
            algorithm: 'HS256',
            header: {
                typ: 'JWT',
                alg: 'HS256',
                kid: this.generateKeyId()
            }
        });
    }
    /**
     * Generate a user authentication token
     */
    generateUserToken(userId, tenantId, roles = ['user'], scopes = ['read'], email, expiresIn = '1h') {
        const payload = {
            userId,
            tenantId,
            email,
            roles,
            scopes,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + this.parseExpiresIn(expiresIn),
            iss: this.issuer,
            aud: ['cognisync-platform']
        };
        return jsonwebtoken_1.default.sign(payload, this.jwtSecret, {
            algorithm: 'HS256',
            header: {
                typ: 'JWT',
                alg: 'HS256',
                kid: this.generateKeyId()
            }
        });
    }
    /**
     * Validate and decode a JWT token
     */
    validateToken(token, expectedAudience) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.jwtSecret, {
                issuer: this.issuer,
                audience: expectedAudience,
                algorithms: ['HS256']
            });
            // Additional validation
            if (decoded.exp < Math.floor(Date.now() / 1000)) {
                throw new Error('Token has expired');
            }
            return decoded;
        }
        catch (error) {
            let errorMsg = 'Unknown error';
            if (error && typeof error === 'object' && 'message' in error) {
                errorMsg = error.message;
            }
            throw new Error(`Token validation failed: ${errorMsg}`);
        }
    }
    /**
     * Validate service-to-service token
     */
    validateServiceToken(token) {
        const decoded = this.validateToken(token, this.serviceId);
        if (!('serviceId' in decoded)) {
            throw new Error('Invalid service token format');
        }
        return decoded;
    }
    /**
     * Validate user token
     */
    validateUserToken(token) {
        const decoded = this.validateToken(token, 'cognisync-platform');
        if (!('userId' in decoded)) {
            throw new Error('Invalid user token format');
        }
        return decoded;
    }
    /**
     * Generate a key ID for token headers
     */
    generateKeyId() {
        return crypto_1.default.createHash('sha256')
            .update(this.serviceId + this.issuer)
            .digest('hex')
            .substring(0, 8);
    }
    /**
     * Parse expires in string to seconds
     */
    parseExpiresIn(expiresIn) {
        const match = expiresIn.match(/^(\d+)([smhd])$/);
        if (!match) {
            throw new Error('Invalid expiresIn format. Use format like "1h", "30m", "7d"');
        }
        const value = parseInt(match[1]);
        const unit = match[2];
        switch (unit) {
            case 's': return value;
            case 'm': return value * 60;
            case 'h': return value * 60 * 60;
            case 'd': return value * 60 * 60 * 24;
            default: throw new Error('Invalid time unit');
        }
    }
    /**
     * Create a signed request for inter-service communication
     */
    createSignedRequest(targetService, method, path, body) {
        const timestamp = Date.now().toString();
        const token = this.generateServiceToken(targetService, ['read', 'write']);
        // Create request signature
        const payload = `${method}:${path}:${timestamp}:${body ? JSON.stringify(body) : ''}`;
        const signature = crypto_1.default
            .createHmac('sha256', this.jwtSecret)
            .update(payload)
            .digest('hex');
        return { token, signature, timestamp };
    }
    /**
     * Verify a signed request
     */
    verifySignedRequest(token, signature, timestamp, method, path, body) {
        try {
            // Validate token first
            this.validateServiceToken(token);
            // Check timestamp (prevent replay attacks)
            const requestTime = parseInt(timestamp);
            const currentTime = Date.now();
            const timeDiff = Math.abs(currentTime - requestTime);
            if (timeDiff > 5 * 60 * 1000) { // 5 minutes tolerance
                throw new Error('Request timestamp too old');
            }
            // Verify signature
            const payload = `${method}:${path}:${timestamp}:${body ? JSON.stringify(body) : ''}`;
            const expectedSignature = crypto_1.default
                .createHmac('sha256', this.jwtSecret)
                .update(payload)
                .digest('hex');
            return crypto_1.default.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
        }
        catch (error) {
            return false;
        }
    }
}
exports.JWTSecurityManager = JWTSecurityManager;
/**
 * Default JWT manager instance
 */
const createJWTManager = (serviceId) => {
    return new JWTSecurityManager(serviceId);
};
exports.createJWTManager = createJWTManager;
//# sourceMappingURL=jwt-utils.js.map