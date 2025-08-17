import OpenAI from 'openai';
import { logger } from '../utils/logger';

export interface AIProviderConfig {
  name: string;
  type: 'openai' | 'azure' | 'anthropic' | 'cohere' | 'huggingface';
  priority: number;
  enabled: boolean;
  healthCheckInterval: number;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  config: {
    apiKey: string;
    baseURL?: string;
    organization?: string;
    apiVersion?: string;
    deployment?: string;
    model?: string;
    embeddingModel?: string;
    maxTokens?: number;
    temperature?: number;
  };
}

export interface ProviderHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime: number;
  errorCount: number;
  lastError?: string;
  uptime: number;
}

export interface AIProviderResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  provider: string;
  responseTime: number;
  retryCount: number;
}

export class AIProviderService {
  private providers: Map<string, AIProviderConfig> = new Map();
  private clients: Map<string, OpenAI> = new Map();
  private healthStatus: Map<string, ProviderHealth> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  constructor() {
    this.loadProviderConfigurations();
    this.initializeProviders();
    this.startHealthChecks();
  }

  /**
   * Load provider configurations from environment variables
   */
  private loadProviderConfigurations(): void {
    // Primary OpenAI Provider
    if (process.env.OPENAI_API_KEY) {
      this.providers.set('openai-primary', {
        name: 'openai-primary',
        type: 'openai',
        priority: parseInt(process.env.OPENAI_PRIMARY_PRIORITY || '1'),
        enabled: process.env.OPENAI_PRIMARY_ENABLED !== 'false',
        healthCheckInterval: parseInt(process.env.OPENAI_HEALTH_CHECK_INTERVAL || '30000'),
        maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3'),
        retryDelay: parseInt(process.env.OPENAI_RETRY_DELAY || '1000'),
        timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000'),
        rateLimit: {
          requestsPerMinute: parseInt(process.env.OPENAI_REQUESTS_PER_MINUTE || '60'),
          tokensPerMinute: parseInt(process.env.OPENAI_TOKENS_PER_MINUTE || '150000')
        },
        config: {
          apiKey: process.env.OPENAI_API_KEY,
          organization: process.env.OPENAI_ORG_ID,
          model: process.env.OPENAI_MODEL || 'gpt-4',
          embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002',
          maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000'),
          temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7')
        }
      });
    }

    // Backup OpenAI Provider
    if (process.env.OPENAI_BACKUP_API_KEY) {
      this.providers.set('openai-backup', {
        name: 'openai-backup',
        type: 'openai',
        priority: parseInt(process.env.OPENAI_BACKUP_PRIORITY || '2'),
        enabled: process.env.OPENAI_BACKUP_ENABLED !== 'false',
        healthCheckInterval: parseInt(process.env.OPENAI_BACKUP_HEALTH_CHECK_INTERVAL || '30000'),
        maxRetries: parseInt(process.env.OPENAI_BACKUP_MAX_RETRIES || '2'),
        retryDelay: parseInt(process.env.OPENAI_BACKUP_RETRY_DELAY || '1500'),
        timeout: parseInt(process.env.OPENAI_BACKUP_TIMEOUT || '30000'),
        rateLimit: {
          requestsPerMinute: parseInt(process.env.OPENAI_BACKUP_REQUESTS_PER_MINUTE || '30'),
          tokensPerMinute: parseInt(process.env.OPENAI_BACKUP_TOKENS_PER_MINUTE || '75000')
        },
        config: {
          apiKey: process.env.OPENAI_BACKUP_API_KEY,
          organization: process.env.OPENAI_BACKUP_ORG_ID,
          model: process.env.OPENAI_BACKUP_MODEL || 'gpt-3.5-turbo',
          embeddingModel: process.env.OPENAI_BACKUP_EMBEDDING_MODEL || 'text-embedding-ada-002',
          maxTokens: parseInt(process.env.OPENAI_BACKUP_MAX_TOKENS || '4000'),
          temperature: parseFloat(process.env.OPENAI_BACKUP_TEMPERATURE || '0.7')
        }
      });
    }

    // Azure OpenAI Provider
    if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
      this.providers.set('azure-openai', {
        name: 'azure-openai',
        type: 'azure',
        priority: parseInt(process.env.AZURE_OPENAI_PRIORITY || '1'),
        enabled: process.env.AZURE_OPENAI_ENABLED !== 'false',
        healthCheckInterval: parseInt(process.env.AZURE_OPENAI_HEALTH_CHECK_INTERVAL || '30000'),
        maxRetries: parseInt(process.env.AZURE_OPENAI_MAX_RETRIES || '3'),
        retryDelay: parseInt(process.env.AZURE_OPENAI_RETRY_DELAY || '1000'),
        timeout: parseInt(process.env.AZURE_OPENAI_TIMEOUT || '30000'),
        rateLimit: {
          requestsPerMinute: parseInt(process.env.AZURE_OPENAI_REQUESTS_PER_MINUTE || '120'),
          tokensPerMinute: parseInt(process.env.AZURE_OPENAI_TOKENS_PER_MINUTE || '300000')
        },
        config: {
          apiKey: process.env.AZURE_OPENAI_API_KEY,
          baseURL: process.env.AZURE_OPENAI_ENDPOINT,
          apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
          deployment: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT,
          embeddingModel: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
          maxTokens: parseInt(process.env.AZURE_OPENAI_MAX_TOKENS || '4000'),
          temperature: parseFloat(process.env.AZURE_OPENAI_TEMPERATURE || '0.7')
        }
      });
    }

    // Backup Azure OpenAI Provider
    if (process.env.AZURE_OPENAI_BACKUP_API_KEY && process.env.AZURE_OPENAI_BACKUP_ENDPOINT) {
      this.providers.set('azure-openai-backup', {
        name: 'azure-openai-backup',
        type: 'azure',
        priority: parseInt(process.env.AZURE_OPENAI_BACKUP_PRIORITY || '2'),
        enabled: process.env.AZURE_OPENAI_BACKUP_ENABLED !== 'false',
        healthCheckInterval: parseInt(process.env.AZURE_OPENAI_BACKUP_HEALTH_CHECK_INTERVAL || '30000'),
        maxRetries: parseInt(process.env.AZURE_OPENAI_BACKUP_MAX_RETRIES || '2'),
        retryDelay: parseInt(process.env.AZURE_OPENAI_BACKUP_RETRY_DELAY || '1500'),
        timeout: parseInt(process.env.AZURE_OPENAI_BACKUP_TIMEOUT || '30000'),
        rateLimit: {
          requestsPerMinute: parseInt(process.env.AZURE_OPENAI_BACKUP_REQUESTS_PER_MINUTE || '60'),
          tokensPerMinute: parseInt(process.env.AZURE_OPENAI_BACKUP_TOKENS_PER_MINUTE || '150000')
        },
        config: {
          apiKey: process.env.AZURE_OPENAI_BACKUP_API_KEY,
          baseURL: process.env.AZURE_OPENAI_BACKUP_ENDPOINT,
          apiVersion: process.env.AZURE_OPENAI_BACKUP_API_VERSION || '2024-02-15-preview',
          deployment: process.env.AZURE_OPENAI_BACKUP_CHAT_DEPLOYMENT,
          embeddingModel: process.env.AZURE_OPENAI_BACKUP_EMBEDDING_DEPLOYMENT,
          maxTokens: parseInt(process.env.AZURE_OPENAI_BACKUP_MAX_TOKENS || '4000'),
          temperature: parseFloat(process.env.AZURE_OPENAI_BACKUP_TEMPERATURE || '0.7')
        }
      });
    }

    logger.info(`Loaded ${this.providers.size} AI provider configurations`);
  }

  /**
   * Initialize OpenAI clients for each provider
   */
  private initializeProviders(): void {
    for (const [name, config] of this.providers) {
      try {
        let client: OpenAI;

        if (config.type === 'azure') {
          client = new OpenAI({
            apiKey: config.config.apiKey,
            baseURL: config.config.baseURL,
            defaultQuery: { 'api-version': config.config.apiVersion },
            defaultHeaders: {
              'api-key': config.config.apiKey,
            },
            timeout: config.timeout
          });
        } else {
          client = new OpenAI({
            apiKey: config.config.apiKey,
            organization: config.config.organization,
            timeout: config.timeout
          });
        }

        this.clients.set(name, client);
        
        // Initialize health status
        this.healthStatus.set(name, {
          name,
          status: 'healthy',
          lastCheck: new Date(),
          responseTime: 0,
          errorCount: 0,
          uptime: 100
        });

        logger.info(`Initialized AI provider: ${name}`);
      } catch (error) {
        logger.error({ error }, `Failed to initialize AI provider ${name}`);
        this.healthStatus.set(name, {
          name,
          status: 'unhealthy',
          lastCheck: new Date(),
          responseTime: 0,
          errorCount: 1,
          lastError: error instanceof Error ? error.message : 'Unknown error',
          uptime: 0
        });
      }
    }
  }

  /**
   * Start health check intervals for all providers
   */
  private startHealthChecks(): void {
    for (const [name, config] of this.providers) {
      if (config.enabled) {
        const interval = setInterval(
          () => this.performHealthCheck(name),
          config.healthCheckInterval
        );
        this.healthCheckIntervals.set(name, interval);
      }
    }
  }

  /**
   * Perform health check for a specific provider
   */
  private async performHealthCheck(providerName: string): Promise<void> {
    const config = this.providers.get(providerName);
    const client = this.clients.get(providerName);
    const currentHealth = this.healthStatus.get(providerName);

    if (!config || !client || !currentHealth) return;

    const startTime = Date.now();

    try {
      // Perform a lightweight test request
      await client.models.list();
      
      const responseTime = Date.now() - startTime;
      
      // Update health status
      this.healthStatus.set(providerName, {
        ...currentHealth,
        status: responseTime < 5000 ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        responseTime,
        errorCount: Math.max(0, currentHealth.errorCount - 1), // Gradually reduce error count on success
        uptime: Math.min(100, currentHealth.uptime + 1)
      });

      logger.debug(`Health check passed for ${providerName}: ${responseTime}ms`);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.healthStatus.set(providerName, {
        ...currentHealth,
        status: currentHealth.errorCount > 3 ? 'unhealthy' : 'degraded',
        lastCheck: new Date(),
        responseTime,
        errorCount: currentHealth.errorCount + 1,
        lastError: errorMessage,
        uptime: Math.max(0, currentHealth.uptime - 5)
      });

      logger.warn(`Health check failed for ${providerName}: ${errorMessage}`);
    }
  }

  /**
   * Get available providers sorted by priority and health
   */
  private getAvailableProviders(): string[] {
    return Array.from(this.providers.entries())
      .filter(([name, config]) => {
        const health = this.healthStatus.get(name);
        return config.enabled && health && health.status !== 'unhealthy';
      })
      .sort(([nameA, configA], [nameB, configB]) => {
        const healthA = this.healthStatus.get(nameA)!;
        const healthB = this.healthStatus.get(nameB)!;
        
        // Sort by health status first, then priority
        if (healthA.status !== healthB.status) {
          const statusOrder = { healthy: 0, degraded: 1, unhealthy: 2 };
          return statusOrder[healthA.status] - statusOrder[healthB.status];
        }
        
        return configA.priority - configB.priority;
      })
      .map(([name]) => name);
  }

  /**
   * Check rate limits for a provider
   */
  private checkRateLimit(providerName: string): boolean {
    const config = this.providers.get(providerName);
    if (!config?.rateLimit) return true;

    const now = Date.now();
    const requestData = this.requestCounts.get(providerName);

    if (!requestData || now > requestData.resetTime) {
      this.requestCounts.set(providerName, {
        count: 1,
        resetTime: now + 60000 // Reset every minute
      });
      return true;
    }

    if (requestData.count >= config.rateLimit.requestsPerMinute) {
      return false;
    }

    requestData.count++;
    return true;
  }

  /**
   * Execute a request with automatic fallback
   */
  private async executeWithFallback<T>(
    operation: (client: OpenAI, config: AIProviderConfig) => Promise<T>,
    operationType: string = 'request'
  ): Promise<AIProviderResponse<T>> {
    const availableProviders = this.getAvailableProviders();
    
    if (availableProviders.length === 0) {
      return {
        success: false,
        error: 'No healthy AI providers available',
        provider: 'none',
        responseTime: 0,
        retryCount: 0
      };
    }

    let lastError: string = '';
    let totalRetryCount = 0;

    for (const providerName of availableProviders) {
      const config = this.providers.get(providerName)!;
      const client = this.clients.get(providerName)!;

      // Check rate limits
      if (!this.checkRateLimit(providerName)) {
        logger.warn(`Rate limit exceeded for provider ${providerName}, trying next provider`);
        continue;
      }

      let retryCount = 0;
      const startTime = Date.now();

      while (retryCount <= config.maxRetries) {
        try {
          const result = await operation(client, config);
          const responseTime = Date.now() - startTime;

          logger.info(`${operationType} successful with provider ${providerName} (attempt ${retryCount + 1}/${config.maxRetries + 1})`);

          return {
            success: true,
            data: result,
            provider: providerName,
            responseTime,
            retryCount: totalRetryCount + retryCount
          };
        } catch (error) {
          retryCount++;
          totalRetryCount++;
          lastError = error instanceof Error ? error.message : 'Unknown error';

          logger.warn(`${operationType} failed with provider ${providerName} (attempt ${retryCount}/${config.maxRetries + 1}): ${lastError}`);

          // Update provider health on error
          const currentHealth = this.healthStatus.get(providerName)!;
          this.healthStatus.set(providerName, {
            ...currentHealth,
            errorCount: currentHealth.errorCount + 1,
            lastError
          });

          if (retryCount <= config.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, config.retryDelay * retryCount));
          }
        }
      }
    }

    return {
      success: false,
      error: `All providers failed. Last error: ${lastError}`,
      provider: 'fallback-exhausted',
      responseTime: 0,
      retryCount: totalRetryCount
    };
  }

  /**
   * Create chat completion with automatic fallback
   */
  async createChatCompletion(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  }): Promise<AIProviderResponse<any>> {
    return this.executeWithFallback(async (client, config) => {
      const model = params.model || config.config.model || 'gpt-4';
      
      if (config.type === 'azure') {
        // For Azure, use the deployment name as the model
        return await client.chat.completions.create({
          model: config.config.deployment || model,
          messages: params.messages,
          temperature: params.temperature ?? config.config.temperature,
          max_tokens: params.maxTokens ?? config.config.maxTokens,
          stream: params.stream || false
        });
      } else {
        return await client.chat.completions.create({
          model,
          messages: params.messages,
          temperature: params.temperature ?? config.config.temperature,
          max_tokens: params.maxTokens ?? config.config.maxTokens,
          stream: params.stream || false
        });
      }
    }, 'chat completion');
  }

  /**
   * Create embeddings with automatic fallback
   */
  async createEmbedding(params: {
    input: string | string[];
    model?: string;
  }): Promise<AIProviderResponse<any>> {
    return this.executeWithFallback(async (client, config) => {
      const model = params.model || config.config.embeddingModel || 'text-embedding-ada-002';
      
      if (config.type === 'azure') {
        // For Azure, use the embedding deployment name as the model
        return await client.embeddings.create({
          model: config.config.embeddingModel || model,
          input: params.input
        });
      } else {
        return await client.embeddings.create({
          model,
          input: params.input
        });
      }
    }, 'embedding creation');
  }

  /**
   * Get provider health status
   */
  getProviderHealth(): ProviderHealth[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Get provider configurations (without sensitive data)
   */
  getProviderConfigurations(): Array<Omit<AIProviderConfig, 'config'> & { config: Omit<AIProviderConfig['config'], 'apiKey'> }> {
    return Array.from(this.providers.values()).map(config => ({
      name: config.name,
      type: config.type,
      priority: config.priority,
      enabled: config.enabled,
      healthCheckInterval: config.healthCheckInterval,
      maxRetries: config.maxRetries,
      retryDelay: config.retryDelay,
      timeout: config.timeout,
      rateLimit: config.rateLimit,
      config: {
        baseURL: config.config.baseURL,
        organization: config.config.organization,
        apiVersion: config.config.apiVersion,
        deployment: config.config.deployment,
        model: config.config.model,
        embeddingModel: config.config.embeddingModel,
        maxTokens: config.config.maxTokens,
        temperature: config.config.temperature
      }
    }));
  }

  /**
   * Manually trigger health check for all providers
   */
  async triggerHealthCheck(): Promise<void> {
    const promises = Array.from(this.providers.keys()).map(name => 
      this.performHealthCheck(name)
    );
    await Promise.all(promises);
  }

  /**
   * Enable or disable a provider
   */
  setProviderEnabled(providerName: string, enabled: boolean): boolean {
    const config = this.providers.get(providerName);
    if (!config) return false;

    config.enabled = enabled;
    
    if (enabled && !this.healthCheckIntervals.has(providerName)) {
      const interval = setInterval(
        () => this.performHealthCheck(providerName),
        config.healthCheckInterval
      );
      this.healthCheckIntervals.set(providerName, interval);
    } else if (!enabled && this.healthCheckIntervals.has(providerName)) {
      clearInterval(this.healthCheckIntervals.get(providerName)!);
      this.healthCheckIntervals.delete(providerName);
    }

    return true;
  }

  /**
   * Clean up resources
   */
  async disconnect(): Promise<void> {
    // Clear all health check intervals
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();

    logger.info('AI Provider Service disconnected');
  }
}