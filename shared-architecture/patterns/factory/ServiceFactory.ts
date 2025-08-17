/**
 * Service Factory Implementation
 * Implements the Factory pattern for creating and configuring services
 */

import { IServiceFactory, IBaseService, IServiceConfiguration } from '../../interfaces/services/IBaseService';
import { ILogger } from '../../interfaces/logging/ILogger';
import { IDependencyContainer } from '../../dependency-injection/IDependencyContainer';

export class ServiceFactory implements IServiceFactory {
  private serviceTypes: Map<string, ServiceConstructor> = new Map();
  private serviceInstances: Map<string, IBaseService> = new Map();
  private logger: ILogger;
  private container: IDependencyContainer;

  constructor(container: IDependencyContainer, logger: ILogger) {
    this.container = container;
    this.logger = logger;
    this.registerDefaultServices();
  }

  /**
   * Create a service instance
   */
  async createService<T extends IBaseService>(
    serviceType: string,
    configuration: IServiceConfiguration
  ): Promise<T> {
    this.logger.info(`Creating service of type: ${serviceType}`, { serviceType, serviceId: configuration.serviceId });

    // Check if service already exists
    const existingService = this.serviceInstances.get(configuration.serviceId);
    if (existingService) {
      this.logger.warn(`Service ${configuration.serviceId} already exists, returning existing instance`);
      return existingService as T;
    }

    // Get service constructor
    const ServiceConstructor = this.serviceTypes.get(serviceType);
    if (!ServiceConstructor) {
      throw new Error(`Service type '${serviceType}' is not registered`);
    }

    try {
      // Validate configuration
      this.validateConfiguration(configuration);

      // Create service instance
      const service = new ServiceConstructor(configuration, this.container);

      // Register dependencies
      await this.registerServiceDependencies(service, configuration);

      // Store service instance
      this.serviceInstances.set(configuration.serviceId, service);

      this.logger.info(`Service ${configuration.serviceId} created successfully`);
      return service as T;
    } catch (error) {
      this.logger.error(`Failed to create service ${configuration.serviceId}`, { error: error.message });
      throw new ServiceCreationError(`Failed to create service: ${error.message}`, serviceType, configuration.serviceId);
    }
  }

  /**
   * Register a service type
   */
  registerServiceType<T extends IBaseService>(
    serviceType: string,
    constructor: ServiceConstructor
  ): void {
    this.logger.debug(`Registering service type: ${serviceType}`);
    this.serviceTypes.set(serviceType, constructor);
  }

  /**
   * Get registered service types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.serviceTypes.keys());
  }

  /**
   * Get service instance by ID
   */
  getService<T extends IBaseService>(serviceId: string): T | null {
    return (this.serviceInstances.get(serviceId) as T) || null;
  }

  /**
   * Remove service instance
   */
  async removeService(serviceId: string): Promise<void> {
    const service = this.serviceInstances.get(serviceId);
    if (service) {
      try {
        await service.stop();
        this.serviceInstances.delete(serviceId);
        this.logger.info(`Service ${serviceId} removed successfully`);
      } catch (error) {
        this.logger.error(`Failed to remove service ${serviceId}`, { error: error.message });
        throw error;
      }
    }
  }

  /**
   * Get all service instances
   */
  getAllServices(): IBaseService[] {
    return Array.from(this.serviceInstances.values());
  }

  /**
   * Shutdown all services
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down all services');
    
    const shutdownPromises = Array.from(this.serviceInstances.values()).map(async (service) => {
      try {
        await service.stop();
        this.logger.debug(`Service ${service.serviceId} stopped`);
      } catch (error) {
        this.logger.error(`Failed to stop service ${service.serviceId}`, { error: error.message });
      }
    });

    await Promise.all(shutdownPromises);
    this.serviceInstances.clear();
    this.logger.info('All services shut down');
  }

  /**
   * Register default service types
   */
  private registerDefaultServices(): void {
    // Register built-in service types here
    // This would be extended based on the specific services in the system
  }

  /**
   * Validate service configuration
   */
  private validateConfiguration(configuration: IServiceConfiguration): void {
    if (!configuration.serviceId) {
      throw new Error('Service ID is required');
    }

    if (!configuration.serviceName) {
      throw new Error('Service name is required');
    }

    if (!configuration.version) {
      throw new Error('Service version is required');
    }

    if (!['development', 'staging', 'production'].includes(configuration.environment)) {
      throw new Error('Invalid environment specified');
    }

    // Validate dependencies
    for (const dependency of configuration.dependencies) {
      if (!dependency.name || !dependency.type) {
        throw new Error(`Invalid dependency configuration: ${JSON.stringify(dependency)}`);
      }
    }
  }

  /**
   * Register service dependencies in the DI container
   */
  private async registerServiceDependencies(
    service: IBaseService,
    configuration: IServiceConfiguration
  ): Promise<void> {
    // Register the service itself
    this.container.register(configuration.serviceId, service);
    this.container.register(`${configuration.serviceName}Service`, service);

    // Register service configuration
    this.container.register(`${configuration.serviceId}Config`, configuration);

    // Register service-specific dependencies
    for (const dependency of configuration.dependencies) {
      try {
        await this.registerDependency(dependency, configuration);
      } catch (error) {
        this.logger.warn(`Failed to register dependency ${dependency.name}`, { error: error.message });
        if (dependency.required) {
          throw new Error(`Required dependency ${dependency.name} failed to register: ${error.message}`);
        }
      }
    }
  }

  /**
   * Register a specific dependency
   */
  private async registerDependency(
    dependency: any,
    configuration: IServiceConfiguration
  ): Promise<void> {
    const dependencyKey = `${configuration.serviceId}_${dependency.name}`;
    
    switch (dependency.type) {
      case 'database':
        // Register database connection
        break;
      case 'service':
        // Register service client
        break;
      case 'external':
        // Register external service client
        break;
      case 'cache':
        // Register cache client
        break;
      case 'queue':
        // Register message queue client
        break;
      default:
        this.logger.warn(`Unknown dependency type: ${dependency.type}`);
    }
  }
}

/**
 * Service constructor type
 */
type ServiceConstructor = new (
  configuration: IServiceConfiguration,
  container: IDependencyContainer
) => IBaseService;

/**
 * Service creation error
 */
export class ServiceCreationError extends Error {
  constructor(
    message: string,
    public readonly serviceType: string,
    public readonly serviceId: string
  ) {
    super(message);
    this.name = 'ServiceCreationError';
  }
}

/**
 * Abstract service factory for specific service types
 */
export abstract class AbstractServiceFactory<T extends IBaseService> {
  constructor(
    protected factory: ServiceFactory,
    protected serviceType: string
  ) {}

  abstract createService(configuration: IServiceConfiguration): Promise<T>;

  protected async createBaseService(configuration: IServiceConfiguration): Promise<T> {
    return await this.factory.createService<T>(this.serviceType, configuration);
  }
}

/**
 * Atlassian Sync Service Factory
 */
export class AtlassianSyncServiceFactory extends AbstractServiceFactory<any> {
  constructor(factory: ServiceFactory) {
    super(factory, 'atlassian-sync');
  }

  async createService(configuration: IServiceConfiguration): Promise<any> {
    // Add Atlassian-specific configuration validation
    this.validateAtlassianConfig(configuration);
    
    return await this.createBaseService(configuration);
  }

  private validateAtlassianConfig(configuration: IServiceConfiguration): void {
    // Validate Atlassian-specific configuration
    const atlassianFeature = configuration.features.find(f => f.name === 'atlassian-integration');
    if (!atlassianFeature || !atlassianFeature.enabled) {
      throw new Error('Atlassian integration feature must be enabled');
    }
  }
}

/**
 * Knowledge Graph Service Factory
 */
export class KnowledgeGraphServiceFactory extends AbstractServiceFactory<any> {
  constructor(factory: ServiceFactory) {
    super(factory, 'knowledge-graph');
  }

  async createService(configuration: IServiceConfiguration): Promise<any> {
    // Add Knowledge Graph-specific configuration validation
    this.validateKnowledgeGraphConfig(configuration);
    
    return await this.createBaseService(configuration);
  }

  private validateKnowledgeGraphConfig(configuration: IServiceConfiguration): void {
    // Validate Knowledge Graph-specific configuration
    const graphFeature = configuration.features.find(f => f.name === 'graph-analytics');
    if (!graphFeature) {
      throw new Error('Graph analytics feature configuration is required');
    }
  }
}

/**
 * LLM-RAG Service Factory
 */
export class LLMRagServiceFactory extends AbstractServiceFactory<any> {
  constructor(factory: ServiceFactory) {
    super(factory, 'llm-rag');
  }

  async createService(configuration: IServiceConfiguration): Promise<any> {
    // Add LLM-RAG-specific configuration validation
    this.validateLLMRagConfig(configuration);
    
    return await this.createBaseService(configuration);
  }

  private validateLLMRagConfig(configuration: IServiceConfiguration): void {
    // Validate LLM-RAG-specific configuration
    const llmFeature = configuration.features.find(f => f.name === 'llm-integration');
    const ragFeature = configuration.features.find(f => f.name === 'rag-pipeline');
    
    if (!llmFeature || !llmFeature.enabled) {
      throw new Error('LLM integration feature must be enabled');
    }
    
    if (!ragFeature || !ragFeature.enabled) {
      throw new Error('RAG pipeline feature must be enabled');
    }
  }
}