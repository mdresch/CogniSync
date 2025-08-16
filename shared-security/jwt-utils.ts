/**
 * Shared JWT utilities for inter-service communication
 * Provides secure token generation, validation, and service-to-service authentication
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

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

export class JWTSecurityManager {
  private readonly jwtSecret: string;
  private readonly issuer: string;
  private readonly serviceId: string;

  constructor(serviceId: string, jwtSecret?: string, issuer?: string) {
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
  private generateSecureSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate a service-to-service authentication token
   */
  generateServiceToken(targetService: string, scopes: string[] = ['read'], tenantId?: string): string {
    const payload: ServiceToken = {
      serviceId: this.serviceId,
      tenantId,
      scopes,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
      iss: this.issuer,
      aud: [targetService]
    };

    return jwt.sign(payload, this.jwtSecret, {
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
  generateUserToken(
    userId: string, 
    tenantId: string, 
    roles: string[] = ['user'], 
    scopes: string[] = ['read'],
    email?: string,
    expiresIn: string = '1h'
  ): string {
    const payload: UserToken = {
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

    return jwt.sign(payload, this.jwtSecret, {
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
  validateToken(token: string, expectedAudience?: string): ServiceToken | UserToken {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: this.issuer,
        audience: expectedAudience,
        algorithms: ['HS256']
      }) as ServiceToken | UserToken;

      // Additional validation
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token has expired');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Token validation failed: ${error.message}`);
    }
  }

  /**
   * Validate service-to-service token
   */
  validateServiceToken(token: string): ServiceToken {
    const decoded = this.validateToken(token, this.serviceId);
    
    if (!('serviceId' in decoded)) {
      throw new Error('Invalid service token format');
    }

    return decoded as ServiceToken;
  }

  /**
   * Validate user token
   */
  validateUserToken(token: string): UserToken {
    const decoded = this.validateToken(token, 'cognisync-platform');
    
    if (!('userId' in decoded)) {
      throw new Error('Invalid user token format');
    }

    return decoded as UserToken;
  }

  /**
   * Generate a key ID for token headers
   */
  private generateKeyId(): string {
    return crypto.createHash('sha256')
      .update(this.serviceId + this.issuer)
      .digest('hex')
      .substring(0, 8);
  }

  /**
   * Parse expires in string to seconds
   */
  private parseExpiresIn(expiresIn: string): number {
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
  createSignedRequest(targetService: string, method: string, path: string, body?: any): {
    token: string;
    signature: string;
    timestamp: string;
  } {
    const timestamp = Date.now().toString();
    const token = this.generateServiceToken(targetService, ['read', 'write']);
    
    // Create request signature
    const payload = `${method}:${path}:${timestamp}:${body ? JSON.stringify(body) : ''}`;
    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(payload)
      .digest('hex');

    return { token, signature, timestamp };
  }

  /**
   * Verify a signed request
   */
  verifySignedRequest(
    token: string, 
    signature: string, 
    timestamp: string, 
    method: string, 
    path: string, 
    body?: any
  ): boolean {
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
      const expectedSignature = crypto
        .createHmac('sha256', this.jwtSecret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      return false;
    }
  }
}

/**
 * Default JWT manager instance
 */
export const createJWTManager = (serviceId: string) => {
  return new JWTSecurityManager(serviceId);
};