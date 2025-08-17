/**
 * Authentication Strategy Pattern Implementation
 * Provides pluggable authentication mechanisms for CogniSync services
 */

import { ILogger } from '../../interfaces/logging/ILogger';
import { IMetricsCollector } from '../../interfaces/monitoring/IMetricsCollector';

// Authentication types
export enum AuthenticationType {
  JWT = 'jwt',
  API_KEY = 'api_key',
  OAUTH = 'oauth',
  BASIC = 'basic',
  SERVICE_TOKEN = 'service_token',
  MUTUAL_TLS = 'mutual_tls'
}

// Authentication request
export interface AuthRequest {
  type: AuthenticationType;
  credentials: any;
  context: AuthContext;
}

// Authentication context
export interface AuthContext {
  requestId: string;
  ipAddress: string;
  userAgent?: string;
  tenantId?: string;
  serviceId?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

// Authentication result
export interface AuthResult {
  success: boolean;
  user?: AuthenticatedUser;
  service?: AuthenticatedService;
  error?: AuthError;
  metadata?: Record<string, any>;
}

// Authenticated user
export interface AuthenticatedUser {
  userId: string;
  email?: string;
  tenantId: string;
  roles: string[];
  scopes: string[];
  permissions: string[];
  metadata: Record<string, any>;
}

// Authenticated service
export interface AuthenticatedService {
  serviceId: string;
  serviceName: string;
  tenantId?: string;
  scopes: string[];
  permissions: string[];
  metadata: Record<string, any>;
}

// Authentication error
export interface AuthError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Authentication strategy interface
export interface IAuthenticationStrategy {
  readonly type: AuthenticationType;
  readonly name: string;
  readonly priority: number;
  
  supports(request: AuthRequest): boolean;
  authenticate(request: AuthRequest): Promise<AuthResult>;
  validate(credentials: any): Promise<boolean>;
  refresh?(credentials: any): Promise<AuthResult>;
}

// Base authentication strategy
export abstract class BaseAuthenticationStrategy implements IAuthenticationStrategy {
  protected logger: ILogger;
  protected metrics: IMetricsCollector;

  constructor(
    public readonly type: AuthenticationType,
    public readonly name: string,
    public readonly priority: number,
    logger: ILogger,
    metrics: IMetricsCollector
  ) {
    this.logger = logger;
    this.metrics = metrics;
  }

  abstract supports(request: AuthRequest): boolean;
  abstract authenticate(request: AuthRequest): Promise<AuthResult>;
  abstract validate(credentials: any): Promise<boolean>;

  protected createSuccessResult(
    user?: AuthenticatedUser,
    service?: AuthenticatedService,
    metadata?: Record<string, any>
  ): AuthResult {
    this.metrics.incrementCounter('auth.success', {
      strategy: this.name,
      type: this.type
    });

    return {
      success: true,
      user,
      service,
      metadata
    };
  }

  protected createErrorResult(code: string, message: string, details?: Record<string, any>): AuthResult {
    this.metrics.incrementCounter('auth.failure', {
      strategy: this.name,
      type: this.type,
      error: code
    });

    return {
      success: false,
      error: {
        code,
        message,
        details
      }
    };
  }
}

// JWT Authentication Strategy
export class JWTAuthenticationStrategy extends BaseAuthenticationStrategy {
  private jwtSecret: string;
  private jwtIssuer: string;

  constructor(
    logger: ILogger,
    metrics: IMetricsCollector,
    jwtSecret: string,
    jwtIssuer: string
  ) {
    super(AuthenticationType.JWT, 'JWT Authentication', 1, logger, metrics);
    this.jwtSecret = jwtSecret;
    this.jwtIssuer = jwtIssuer;
  }

  supports(request: AuthRequest): boolean {
    return request.type === AuthenticationType.JWT && 
           request.credentials?.token && 
           typeof request.credentials.token === 'string';
  }

  async authenticate(request: AuthRequest): Promise<AuthResult> {
    try {
      const { token } = request.credentials;
      
      // Validate JWT token format
      if (!this.isValidJWTFormat(token)) {
        return this.createErrorResult('INVALID_TOKEN_FORMAT', 'Invalid JWT token format');
      }

      // Verify and decode JWT
      const payload = await this.verifyJWT(token);
      
      if (!payload) {
        return this.createErrorResult('INVALID_TOKEN', 'Invalid or expired JWT token');
      }

      // Check if it's a user token or service token
      if (payload.sub && payload.email) {
        // User token
        const user: AuthenticatedUser = {
          userId: payload.sub,
          email: payload.email,
          tenantId: payload.tenantId || request.context.tenantId || '',
          roles: payload.roles || [],
          scopes: payload.scopes || [],
          permissions: payload.permissions || [],
          metadata: {
            tokenType: 'user',
            issuedAt: payload.iat,
            expiresAt: payload.exp
          }
        };

        return this.createSuccessResult(user, undefined, {
          tokenType: 'user',
          expiresAt: payload.exp
        });
      } else if (payload.serviceId) {
        // Service token
        const service: AuthenticatedService = {
          serviceId: payload.serviceId,
          serviceName: payload.serviceName || payload.serviceId,
          tenantId: payload.tenantId,
          scopes: payload.scopes || [],
          permissions: payload.permissions || [],
          metadata: {
            tokenType: 'service',
            issuedAt: payload.iat,
            expiresAt: payload.exp
          }
        };

        return this.createSuccessResult(undefined, service, {
          tokenType: 'service',
          expiresAt: payload.exp
        });
      } else {
        return this.createErrorResult('INVALID_TOKEN_PAYLOAD', 'JWT token payload is invalid');
      }
    } catch (error) {
      this.logger.error('JWT authentication failed', { error: error.message });
      return this.createErrorResult('AUTH_ERROR', 'Authentication failed', { error: error.message });
    }
  }

  async validate(credentials: any): Promise<boolean> {
    try {
      const { token } = credentials;
      return this.isValidJWTFormat(token) && (await this.verifyJWT(token)) !== null;
    } catch {
      return false;
    }
  }

  async refresh(credentials: any): Promise<AuthResult> {
    // Implement JWT refresh logic
    try {
      const { refreshToken } = credentials;
      
      if (!refreshToken) {
        return this.createErrorResult('MISSING_REFRESH_TOKEN', 'Refresh token is required');
      }

      // Verify refresh token and generate new access token
      const payload = await this.verifyJWT(refreshToken);
      if (!payload) {
        return this.createErrorResult('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
      }

      // Generate new access token
      const newToken = await this.generateJWT(payload);
      
      return this.createSuccessResult(undefined, undefined, {
        accessToken: newToken,
        tokenType: 'Bearer',
        expiresIn: 3600
      });
    } catch (error) {
      return this.createErrorResult('REFRESH_ERROR', 'Token refresh failed', { error: error.message });
    }
  }

  private isValidJWTFormat(token: string): boolean {
    return typeof token === 'string' && token.split('.').length === 3;
  }

  private async verifyJWT(token: string): Promise<any> {
    // Implement JWT verification logic
    // This would use a JWT library like jsonwebtoken
    try {
      // Mock implementation - replace with actual JWT verification
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      // Check expiration
      if (payload.exp && payload.exp < Date.now() / 1000) {
        return null;
      }
      
      // Check issuer
      if (payload.iss !== this.jwtIssuer) {
        return null;
      }
      
      return payload;
    } catch {
      return null;
    }
  }

  private async generateJWT(payload: any): Promise<string> {
    // Implement JWT generation logic
    // This would use a JWT library like jsonwebtoken
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    
    const jwtPayload = {
      ...payload,
      iat: now,
      exp: now + 3600, // 1 hour
      iss: this.jwtIssuer
    };
    
    // Mock implementation - replace with actual JWT signing
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64');
    const encodedPayload = Buffer.from(JSON.stringify(jwtPayload)).toString('base64');
    const signature = 'mock-signature'; // Replace with actual HMAC signature
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }
}

// API Key Authentication Strategy
export class ApiKeyAuthenticationStrategy extends BaseAuthenticationStrategy {
  private validApiKeys: Set<string>;
  private apiKeyToTenant: Map<string, string>;

  constructor(
    logger: ILogger,
    metrics: IMetricsCollector,
    validApiKeys: string[],
    apiKeyMappings?: Map<string, string>
  ) {
    super(AuthenticationType.API_KEY, 'API Key Authentication', 2, logger, metrics);
    this.validApiKeys = new Set(validApiKeys);
    this.apiKeyToTenant = apiKeyMappings || new Map();
  }

  supports(request: AuthRequest): boolean {
    return request.type === AuthenticationType.API_KEY && 
           request.credentials?.apiKey && 
           typeof request.credentials.apiKey === 'string';
  }

  async authenticate(request: AuthRequest): Promise<AuthResult> {
    try {
      const { apiKey } = request.credentials;
      
      if (!this.validApiKeys.has(apiKey)) {
        return this.createErrorResult('INVALID_API_KEY', 'Invalid API key');
      }

      // Extract tenant from API key or mapping
      const tenantId = this.extractTenantFromApiKey(apiKey) || 
                       this.apiKeyToTenant.get(apiKey) || 
                       request.context.tenantId;

      if (!tenantId) {
        return this.createErrorResult('MISSING_TENANT', 'Tenant ID could not be determined');
      }

      // Create authenticated user for API key
      const user: AuthenticatedUser = {
        userId: `api-key-${this.hashApiKey(apiKey)}`,
        tenantId,
        roles: ['api-user'],
        scopes: ['read', 'write'], // Default scopes for API keys
        permissions: ['api:access'],
        metadata: {
          authType: 'api_key',
          keyPrefix: apiKey.substring(0, 8) + '...'
        }
      };

      return this.createSuccessResult(user, undefined, {
        authType: 'api_key'
      });
    } catch (error) {
      this.logger.error('API key authentication failed', { error: error.message });
      return this.createErrorResult('AUTH_ERROR', 'Authentication failed', { error: error.message });
    }
  }

  async validate(credentials: any): Promise<boolean> {
    const { apiKey } = credentials;
    return typeof apiKey === 'string' && this.validApiKeys.has(apiKey);
  }

  private extractTenantFromApiKey(apiKey: string): string | null {
    // Extract tenant from API key format: service-tenant-random
    const parts = apiKey.split('-');
    return parts.length >= 3 ? parts[1] : null;
  }

  private hashApiKey(apiKey: string): string {
    // Create a hash of the API key for user ID
    return Buffer.from(apiKey).toString('base64').substring(0, 16);
  }
}

// Service Token Authentication Strategy
export class ServiceTokenAuthenticationStrategy extends BaseAuthenticationStrategy {
  private validServices: Set<string>;
  private serviceSecrets: Map<string, string>;

  constructor(
    logger: ILogger,
    metrics: IMetricsCollector,
    serviceSecrets: Map<string, string>
  ) {
    super(AuthenticationType.SERVICE_TOKEN, 'Service Token Authentication', 0, logger, metrics);
    this.serviceSecrets = serviceSecrets;
    this.validServices = new Set(serviceSecrets.keys());
  }

  supports(request: AuthRequest): boolean {
    return request.type === AuthenticationType.SERVICE_TOKEN && 
           request.credentials?.serviceId && 
           request.credentials?.serviceSecret;
  }

  async authenticate(request: AuthRequest): Promise<AuthResult> {
    try {
      const { serviceId, serviceSecret, tenantId } = request.credentials;
      
      if (!this.validServices.has(serviceId)) {
        return this.createErrorResult('INVALID_SERVICE', 'Service not recognized');
      }

      const expectedSecret = this.serviceSecrets.get(serviceId);
      if (expectedSecret !== serviceSecret) {
        return this.createErrorResult('INVALID_SERVICE_SECRET', 'Invalid service secret');
      }

      const service: AuthenticatedService = {
        serviceId,
        serviceName: serviceId,
        tenantId,
        scopes: ['service:access', 'read', 'write'],
        permissions: ['service:*'],
        metadata: {
          authType: 'service_token',
          authenticatedAt: new Date().toISOString()
        }
      };

      return this.createSuccessResult(undefined, service, {
        authType: 'service_token'
      });
    } catch (error) {
      this.logger.error('Service token authentication failed', { error: error.message });
      return this.createErrorResult('AUTH_ERROR', 'Authentication failed', { error: error.message });
    }
  }

  async validate(credentials: any): Promise<boolean> {
    const { serviceId, serviceSecret } = credentials;
    return this.validServices.has(serviceId) && 
           this.serviceSecrets.get(serviceId) === serviceSecret;
  }
}

// Authentication Context Manager
export class AuthenticationContext {
  private strategies: Map<AuthenticationType, IAuthenticationStrategy> = new Map();
  private logger: ILogger;
  private metrics: IMetricsCollector;

  constructor(logger: ILogger, metrics: IMetricsCollector) {
    this.logger = logger;
    this.metrics = metrics;
  }

  registerStrategy(strategy: IAuthenticationStrategy): void {
    this.strategies.set(strategy.type, strategy);
    this.logger.info(`Registered authentication strategy: ${strategy.name}`);
  }

  unregisterStrategy(type: AuthenticationType): void {
    if (this.strategies.delete(type)) {
      this.logger.info(`Unregistered authentication strategy: ${type}`);
    }
  }

  async authenticate(request: AuthRequest): Promise<AuthResult> {
    const startTime = Date.now();
    
    try {
      // Find supporting strategy
      const strategy = this.findSupportingStrategy(request);
      if (!strategy) {
        return this.createErrorResult('NO_STRATEGY', 'No authentication strategy supports this request');
      }

      // Authenticate using the strategy
      const result = await strategy.authenticate(request);
      
      // Record metrics
      const duration = Date.now() - startTime;
      this.metrics.recordHistogram('auth.duration', duration, {
        strategy: strategy.name,
        success: result.success.toString()
      });

      return result;
    } catch (error) {
      this.logger.error('Authentication failed', { error: error.message, request });
      return this.createErrorResult('AUTH_ERROR', 'Authentication failed', { error: error.message });
    }
  }

  async validateCredentials(type: AuthenticationType, credentials: any): Promise<boolean> {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      return false;
    }

    try {
      return await strategy.validate(credentials);
    } catch (error) {
      this.logger.error('Credential validation failed', { error: error.message, type });
      return false;
    }
  }

  getRegisteredStrategies(): IAuthenticationStrategy[] {
    return Array.from(this.strategies.values())
      .sort((a, b) => a.priority - b.priority);
  }

  private findSupportingStrategy(request: AuthRequest): IAuthenticationStrategy | null {
    // First try to find exact type match
    const exactStrategy = this.strategies.get(request.type);
    if (exactStrategy && exactStrategy.supports(request)) {
      return exactStrategy;
    }

    // Then try all strategies in priority order
    const sortedStrategies = this.getRegisteredStrategies();
    for (const strategy of sortedStrategies) {
      if (strategy.supports(request)) {
        return strategy;
      }
    }

    return null;
  }

  private createErrorResult(code: string, message: string, details?: Record<string, any>): AuthResult {
    return {
      success: false,
      error: {
        code,
        message,
        details
      }
    };
  }
}