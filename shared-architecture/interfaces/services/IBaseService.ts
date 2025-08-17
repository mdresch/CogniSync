/**
 * Base service interface that all CogniSync services should implement
 * Provides common functionality and contracts for service lifecycle management
 */

export interface IBaseService {
  /**
   * Service identifier
   */
  readonly serviceId: string;

  /**
   * Service name for display purposes
   */
  readonly serviceName: string;

  /**
   * Service version
   */
  readonly version: string;

  /**
   * Initialize the service
   */
  initialize(): Promise<void>;

  /**
   * Start the service
   */
  start(): Promise<void>;

  /**
   * Stop the service gracefully
   */
  stop(): Promise<void>;

  /**
   * Check if the service is healthy
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get service status information
   */
  getStatus(): Promise<ServiceStatus>;

  /**
   * Get service metrics
   */
  getMetrics(): Promise<ServiceMetrics>;
}

export interface ServiceStatus {
  serviceId: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  uptime: number;
  lastHealthCheck: Date;
  dependencies: DependencyStatus[];
  metadata: Record<string, any>;
}

export interface DependencyStatus {
  name: string;
  type: 'database' | 'service' | 'external' | 'cache' | 'queue';
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastCheck: Date;
  error?: string;
}

export interface ServiceMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  customMetrics: Record<string, number>;
}

/**
 * Service configuration interface
 */
export interface IServiceConfiguration {
  serviceId: string;
  serviceName: string;
  version: string;
  port?: number;
  environment: 'development' | 'staging' | 'production';
  dependencies: ServiceDependency[];
  features: ServiceFeature[];
  monitoring: MonitoringConfig;
  security: SecurityConfig;
}

export interface ServiceDependency {
  name: string;
  type: 'database' | 'service' | 'external' | 'cache' | 'queue';
  required: boolean;
  connectionString?: string;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export interface ServiceFeature {
  name: string;
  enabled: boolean;
  configuration?: Record<string, any>;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsInterval: number;
  healthCheckInterval: number;
  tracing: TracingConfig;
  logging: LoggingConfig;
}

export interface TracingConfig {
  enabled: boolean;
  serviceName: string;
  endpoint?: string;
  sampleRate: number;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  destination: 'console' | 'file' | 'external';
  structured: boolean;
}

export interface SecurityConfig {
  authentication: AuthenticationConfig;
  authorization: AuthorizationConfig;
  encryption: EncryptionConfig;
  rateLimiting: RateLimitingConfig;
}

export interface AuthenticationConfig {
  enabled: boolean;
  strategies: string[];
  jwtSecret?: string;
  apiKeys?: string[];
  sessionTimeout?: number;
}

export interface AuthorizationConfig {
  enabled: boolean;
  rbac: boolean;
  tenantIsolation: boolean;
  defaultScopes: string[];
}

export interface EncryptionConfig {
  enabled: boolean;
  algorithm: string;
  keyRotation: boolean;
  transitEncryption: boolean;
}

export interface RateLimitingConfig {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  skipPaths: string[];
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  initialDelay: number;
  maxDelay: number;
  retryableErrors: string[];
}

/**
 * Service lifecycle events
 */
export interface IServiceLifecycleEvents {
  onInitializing(): Promise<void>;
  onInitialized(): Promise<void>;
  onStarting(): Promise<void>;
  onStarted(): Promise<void>;
  onStopping(): Promise<void>;
  onStopped(): Promise<void>;
  onError(error: Error): Promise<void>;
}

/**
 * Service factory interface for creating services
 */
export interface IServiceFactory {
  createService<T extends IBaseService>(
    serviceType: string,
    configuration: IServiceConfiguration
  ): Promise<T>;
  
  registerServiceType<T extends IBaseService>(
    serviceType: string,
    constructor: new (config: IServiceConfiguration) => T
  ): void;
  
  getRegisteredTypes(): string[];
}

/**
 * Service registry interface for service discovery
 */
export interface IServiceRegistry {
  register(service: ServiceRegistration): Promise<void>;
  deregister(serviceId: string): Promise<void>;
  discover(serviceName: string): Promise<ServiceInstance[]>;
  getService(serviceId: string): Promise<ServiceInstance | null>;
  subscribe(serviceName: string, callback: ServiceChangeCallback): void;
  unsubscribe(serviceName: string, callback: ServiceChangeCallback): void;
}

export interface ServiceRegistration {
  serviceId: string;
  serviceName: string;
  version: string;
  address: string;
  port: number;
  metadata: Record<string, any>;
  healthCheckUrl?: string;
  tags: string[];
}

export interface ServiceInstance {
  serviceId: string;
  serviceName: string;
  version: string;
  address: string;
  port: number;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastSeen: Date;
  metadata: Record<string, any>;
  tags: string[];
}

export type ServiceChangeCallback = (
  event: 'registered' | 'deregistered' | 'health_changed',
  instance: ServiceInstance
) => void;

/**
 * Service context interface for request-scoped data
 */
export interface IServiceContext {
  requestId: string;
  tenantId?: string;
  userId?: string;
  correlationId?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

/**
 * Service middleware interface
 */
export interface IServiceMiddleware {
  execute(context: IServiceContext, next: () => Promise<any>): Promise<any>;
  order: number;
}

/**
 * Service error interface
 */
export interface IServiceError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, any>;
  correlationId?: string;
  timestamp: Date;
}

/**
 * Service result wrapper
 */
export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: IServiceError;
  metadata?: Record<string, any>;
}

/**
 * Utility functions for service results
 */
export function createSuccessResult<T>(data: T, metadata?: Record<string, any>): ServiceResult<T> {
  return {
    success: true,
    data,
    metadata
  };
}

export function createErrorResult(error: IServiceError, metadata?: Record<string, any>): ServiceResult {
  return {
    success: false,
    error,
    metadata
  };
}

export function isSuccessResult<T>(result: ServiceResult<T>): result is ServiceResult<T> & { success: true; data: T } {
  return result.success === true;
}

export function isErrorResult<T>(result: ServiceResult<T>): result is ServiceResult<T> & { success: false; error: IServiceError } {
  return result.success === false;
}