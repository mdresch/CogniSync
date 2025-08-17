/**
 * Base Service Implementation
 * Provides common functionality for all CogniSync services
 */

import { 
  IBaseService, 
  IServiceConfiguration, 
  ServiceStatus, 
  ServiceMetrics, 
  DependencyStatus,
  IServiceLifecycleEvents,
  IServiceContext,
  IServiceMiddleware,
  ServiceResult,
  createSuccessResult,
  createErrorResult
} from '../../interfaces/services/IBaseService';
import { ILogger } from '../../interfaces/logging/ILogger';
import { IMetricsCollector } from '../../interfaces/monitoring/IMetricsCollector';
import { IDependencyContainer } from '../../dependency-injection/IDependencyContainer';
import { EventEmitter } from 'events';

export abstract class BaseService extends EventEmitter implements IBaseService, IServiceLifecycleEvents {
  protected logger: ILogger;
  protected metrics: IMetricsCollector;
  protected container: IDependencyContainer;
  protected middlewares: IServiceMiddleware[] = [];
  protected startTime: Date | null = null;
  protected currentStatus: ServiceStatus['status'] = 'stopped';
  protected lastHealthCheck: Date = new Date();
  protected dependencies: Map<string, DependencyStatus> = new Map();

  constructor(
    protected configuration: IServiceConfiguration,
    container: IDependencyContainer
  ) {
    super();
    this.container = container;
    this.logger = container.resolve<ILogger>('logger');
    this.metrics = container.resolve<IMetricsCollector>('metrics');
    
    this.setupEventHandlers();
  }

  // Abstract methods that must be implemented by concrete services
  protected abstract initializeService(): Promise<void>;
  protected abstract startService(): Promise<void>;
  protected abstract stopService(): Promise<void>;
  protected abstract checkServiceHealth(): Promise<boolean>;

  // IBaseService implementation
  get serviceId(): string {
    return this.configuration.serviceId;
  }

  get serviceName(): string {
    return this.configuration.serviceName;
  }

  get version(): string {
    return this.configuration.version;
  }

  async initialize(): Promise<void> {
    this.logger.info(`Initializing service ${this.serviceId}`);
    this.currentStatus = 'starting';
    
    try {
      await this.onInitializing();
      await this.initializeDependencies();
      await this.initializeService();
      await this.onInitialized();
      
      this.logger.info(`Service ${this.serviceId} initialized successfully`);
    } catch (error) {
      this.logger.error(`Failed to initialize service ${this.serviceId}`, { error: error.message });
      this.currentStatus = 'error';
      await this.onError(error);
      throw error;
    }
  }

  async start(): Promise<void> {
    this.logger.info(`Starting service ${this.serviceId}`);
    
    try {
      await this.onStarting();
      await this.startService();
      
      this.startTime = new Date();
      this.currentStatus = 'running';
      
      // Start health check interval
      this.startHealthCheckInterval();
      
      await this.onStarted();
      this.emit('started', this.serviceId);
      
      this.logger.info(`Service ${this.serviceId} started successfully`);
    } catch (error) {
      this.logger.error(`Failed to start service ${this.serviceId}`, { error: error.message });
      this.currentStatus = 'error';
      await this.onError(error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.logger.info(`Stopping service ${this.serviceId}`);
    this.currentStatus = 'stopping';
    
    try {
      await this.onStopping();
      await this.stopService();
      await this.stopDependencies();
      
      this.currentStatus = 'stopped';
      this.startTime = null;
      
      await this.onStopped();
      this.emit('stopped', this.serviceId);
      
      this.logger.info(`Service ${this.serviceId} stopped successfully`);
    } catch (error) {
      this.logger.error(`Failed to stop service ${this.serviceId}`, { error: error.message });
      this.currentStatus = 'error';
      await this.onError(error);
      throw error;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Check service-specific health
      const serviceHealthy = await this.checkServiceHealth();
      
      // Check dependencies health
      const dependenciesHealthy = await this.checkDependenciesHealth();
      
      const isHealthy = serviceHealthy && dependenciesHealthy;
      this.lastHealthCheck = new Date();
      
      // Update metrics
      this.metrics.recordGauge('service.health', isHealthy ? 1 : 0, {
        service: this.serviceId
      });
      
      return isHealthy;
    } catch (error) {
      this.logger.error(`Health check failed for service ${this.serviceId}`, { error: error.message });
      return false;
    }
  }

  async getStatus(): Promise<ServiceStatus> {
    const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    
    return {
      serviceId: this.serviceId,
      status: this.currentStatus,
      uptime,
      lastHealthCheck: this.lastHealthCheck,
      dependencies: Array.from(this.dependencies.values()),
      metadata: {
        serviceName: this.serviceName,
        version: this.version,
        environment: this.configuration.environment,
        startTime: this.startTime,
        configuration: this.getPublicConfiguration()
      }
    };
  }

  async getMetrics(): Promise<ServiceMetrics> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      requestCount: await this.getRequestCount(),
      errorCount: await this.getErrorCount(),
      averageResponseTime: await this.getAverageResponseTime(),
      memoryUsage: memoryUsage.heapUsed,
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      activeConnections: await this.getActiveConnections(),
      customMetrics: await this.getCustomMetrics()
    };
  }

  // Middleware management
  addMiddleware(middleware: IServiceMiddleware): void {
    this.middlewares.push(middleware);
    this.middlewares.sort((a, b) => a.order - b.order);
  }

  removeMiddleware(middleware: IServiceMiddleware): void {
    const index = this.middlewares.indexOf(middleware);
    if (index > -1) {
      this.middlewares.splice(index, 1);
    }
  }

  // Execute operation with middleware chain
  protected async executeWithMiddleware<T>(
    context: IServiceContext,
    operation: () => Promise<T>
  ): Promise<ServiceResult<T>> {
    try {
      let index = 0;
      
      const next = async (): Promise<T> => {
        if (index < this.middlewares.length) {
          const middleware = this.middlewares[index++];
          return await middleware.execute(context, next);
        } else {
          return await operation();
        }
      };
      
      const result = await next();
      return createSuccessResult(result);
    } catch (error) {
      this.logger.error(`Operation failed in service ${this.serviceId}`, { 
        error: error.message,
        context 
      });
      
      return createErrorResult({
        name: error.name,
        message: error.message,
        code: error.code || 'OPERATION_FAILED',
        statusCode: error.statusCode || 500,
        correlationId: context.correlationId,
        timestamp: new Date()
      });
    }
  }

  // IServiceLifecycleEvents implementation
  async onInitializing(): Promise<void> {
    this.emit('initializing', this.serviceId);
  }

  async onInitialized(): Promise<void> {
    this.emit('initialized', this.serviceId);
  }

  async onStarting(): Promise<void> {
    this.emit('starting', this.serviceId);
  }

  async onStarted(): Promise<void> {
    this.emit('started', this.serviceId);
  }

  async onStopping(): Promise<void> {
    this.emit('stopping', this.serviceId);
  }

  async onStopped(): Promise<void> {
    this.emit('stopped', this.serviceId);
  }

  async onError(error: Error): Promise<void> {
    this.emit('error', error, this.serviceId);
    this.metrics.incrementCounter('service.errors', {
      service: this.serviceId,
      error: error.name
    });
  }

  // Protected helper methods
  protected async initializeDependencies(): Promise<void> {
    this.logger.debug(`Initializing dependencies for service ${this.serviceId}`);
    
    for (const dependency of this.configuration.dependencies) {
      try {
        await this.initializeDependency(dependency);
        this.updateDependencyStatus(dependency.name, 'healthy');
      } catch (error) {
        this.updateDependencyStatus(dependency.name, 'unhealthy', error.message);
        
        if (dependency.required) {
          throw new Error(`Required dependency ${dependency.name} failed to initialize: ${error.message}`);
        } else {
          this.logger.warn(`Optional dependency ${dependency.name} failed to initialize`, { error: error.message });
        }
      }
    }
  }

  protected async initializeDependency(dependency: any): Promise<void> {
    // Override in concrete services to handle specific dependency types
    this.logger.debug(`Initializing dependency: ${dependency.name}`);
  }

  protected async stopDependencies(): Promise<void> {
    this.logger.debug(`Stopping dependencies for service ${this.serviceId}`);
    
    for (const dependency of this.configuration.dependencies) {
      try {
        await this.stopDependency(dependency);
      } catch (error) {
        this.logger.warn(`Failed to stop dependency ${dependency.name}`, { error: error.message });
      }
    }
  }

  protected async stopDependency(dependency: any): Promise<void> {
    // Override in concrete services to handle specific dependency types
    this.logger.debug(`Stopping dependency: ${dependency.name}`);
  }

  protected async checkDependenciesHealth(): Promise<boolean> {
    for (const dependency of this.configuration.dependencies) {
      if (dependency.required) {
        const status = this.dependencies.get(dependency.name);
        if (!status || status.status !== 'healthy') {
          return false;
        }
      }
    }
    return true;
  }

  protected updateDependencyStatus(
    name: string, 
    status: DependencyStatus['status'], 
    error?: string,
    responseTime?: number
  ): void {
    const dependency = this.configuration.dependencies.find(d => d.name === name);
    if (dependency) {
      this.dependencies.set(name, {
        name,
        type: dependency.type,
        status,
        responseTime,
        lastCheck: new Date(),
        error
      });
    }
  }

  protected startHealthCheckInterval(): void {
    const interval = this.configuration.monitoring.healthCheckInterval || 30000; // 30 seconds default
    
    setInterval(async () => {
      try {
        await this.isHealthy();
      } catch (error) {
        this.logger.error(`Health check interval failed for service ${this.serviceId}`, { error: error.message });
      }
    }, interval);
  }

  protected getPublicConfiguration(): any {
    // Return a sanitized version of configuration without sensitive data
    return {
      serviceId: this.configuration.serviceId,
      serviceName: this.configuration.serviceName,
      version: this.configuration.version,
      environment: this.configuration.environment,
      features: this.configuration.features.map(f => ({ name: f.name, enabled: f.enabled }))
    };
  }

  protected setupEventHandlers(): void {
    // Setup graceful shutdown handlers
    process.on('SIGTERM', async () => {
      this.logger.info(`Received SIGTERM, shutting down service ${this.serviceId}`);
      await this.stop();
    });

    process.on('SIGINT', async () => {
      this.logger.info(`Received SIGINT, shutting down service ${this.serviceId}`);
      await this.stop();
    });
  }

  // Abstract methods for metrics (to be implemented by concrete services)
  protected abstract getRequestCount(): Promise<number>;
  protected abstract getErrorCount(): Promise<number>;
  protected abstract getAverageResponseTime(): Promise<number>;
  protected abstract getActiveConnections(): Promise<number>;
  protected abstract getCustomMetrics(): Promise<Record<string, number>>;
}