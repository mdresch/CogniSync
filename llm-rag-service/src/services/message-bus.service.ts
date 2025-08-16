// llm-rag-service/src/services/message-bus.service.ts
import { ServiceBusClient, ServiceBusReceiver, ServiceBusReceivedMessage } from '@azure/service-bus';
import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import { EmbeddingService } from './EmbeddingService';

dotenv.config();

export interface EntityEvent {
  messageType: 'CREATE_ENTITY' | 'LINK_ENTITIES' | 'UPDATE_ENTITY' | 'DELETE_ENTITY';
  messageId: string;
  timestamp: string;
  tenantId: string;
  payload: any;
}

export interface QueryResultEvent {
  messageType: 'QUERY_RESULT';
  sessionId: string;
  timestamp: string;
  payload: {
    queryId: string;
    results: any[];
    metadata: {
      processingTime: number;
      resultCount: number;
      confidence: number;
    };
  };
}

export class MessageBusService {
  private serviceBusClient?: ServiceBusClient;
  private receiver?: ServiceBusReceiver;
  private redisClient?: RedisClientType;
  private embeddingService: EmbeddingService;
  private isRunning = false;

  constructor() {
    this.embeddingService = new EmbeddingService();
    this.initializeClients();
  }

  private initializeClients() {
    try {
      // Initialize Azure Service Bus for consuming entity events
      const serviceBusConnectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
      const topicName = process.env.SERVICE_BUS_TOPIC_NAME;
      const subscriptionName = process.env.SERVICE_BUS_SUBSCRIPTION_NAME || 'llm-rag-subscription';

      if (serviceBusConnectionString && topicName) {
        this.serviceBusClient = new ServiceBusClient(serviceBusConnectionString);
        this.receiver = this.serviceBusClient.createReceiver(topicName, subscriptionName);
        logger.info('Azure Service Bus client initialized for LLM-RAG Service');
      } else {
        logger.warn('Azure Service Bus configuration missing - entity event consumption disabled');
      }

      // Initialize Redis for publishing real-time events
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        this.redisClient = createClient({ url: redisUrl });
        this.redisClient.on('error', (err) => {
          logger.error({ error: err.message }, 'Redis client error');
        });
        logger.info('Redis client initialized for LLM-RAG Service');
      } else {
        logger.warn('Redis configuration missing - real-time notifications disabled');
      }
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to initialize message bus clients');
    }
  }

  /**
   * Start the message bus service to consume entity events
   */
  async start(): Promise<void> {
    try {
      this.isRunning = true;

      // Connect to Redis if available
      if (this.redisClient) {
        await this.redisClient.connect();
        logger.info('Connected to Redis for real-time notifications');
      }

      // Start consuming Service Bus messages if available
      if (this.receiver) {
        this.receiver.subscribe({
          processMessage: this.processEntityEvent.bind(this),
          processError: this.processError.bind(this),
        });
        logger.info('Started consuming entity events from Service Bus');
      }

      logger.info('MessageBusService started successfully');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to start MessageBusService');
      throw error;
    }
  }

  /**
   * Stop the message bus service
   */
  async stop(): Promise<void> {
    try {
      this.isRunning = false;

      if (this.receiver) {
        await this.receiver.close();
        logger.info('Service Bus receiver closed');
      }

      if (this.serviceBusClient) {
        await this.serviceBusClient.close();
        logger.info('Service Bus client closed');
      }

      if (this.redisClient) {
        await this.redisClient.quit();
        logger.info('Redis client disconnected');
      }

      logger.info('MessageBusService stopped successfully');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error stopping MessageBusService');
    }
  }

  /**
   * Process entity events from the Service Bus
   */
  private async processEntityEvent(message: ServiceBusReceivedMessage): Promise<void> {
    const startTime = Date.now();
    logger.info({ messageId: message.messageId }, 'Received entity event from Service Bus');

    try {
      const event: EntityEvent = message.body;

      // Validate event structure
      if (!event.messageType || !event.payload || !event.tenantId) {
        throw new Error('Invalid event structure');
      }

      // Process different event types
      switch (event.messageType) {
        case 'CREATE_ENTITY':
          await this.handleCreateEntity(event);
          break;
        case 'UPDATE_ENTITY':
          await this.handleUpdateEntity(event);
          break;
        case 'DELETE_ENTITY':
          await this.handleDeleteEntity(event);
          break;
        case 'LINK_ENTITIES':
          await this.handleLinkEntities(event);
          break;
        default:
          logger.warn({ messageType: event.messageType }, 'Unknown entity event type');
      }

      // Complete the message to remove it from the queue
      if (this.receiver) {
        await this.receiver.completeMessage(message);
      }

      const processingTime = Date.now() - startTime;
      logger.info(
        { 
          messageId: message.messageId, 
          messageType: event.messageType,
          processingTime 
        }, 
        'Entity event processed successfully'
      );

    } catch (error: any) {
      logger.error(
        { 
          messageId: message.messageId, 
          error: error.message 
        }, 
        'Failed to process entity event'
      );

      // Move message to dead letter queue
      if (this.receiver) {
        await this.receiver.deadLetterMessage(message, {
          deadLetterReason: 'ProcessingError',
          deadLetterErrorDescription: error.message
        });
      }
    }
  }

  /**
   * Handle CREATE_ENTITY events by creating embeddings
   */
  private async handleCreateEntity(event: EntityEvent): Promise<void> {
    const { payload, tenantId } = event;
    
    try {
      // Extract text content from entity for embedding
      const textContent = this.extractTextFromEntity(payload);
      
      if (textContent) {
        // Create embedding for the entity
        await this.embeddingService.createDocumentEmbedding({
          content: textContent,
          metadata: {
            entityId: payload.entityId,
            entityType: payload.entityType,
            source: payload.source,
            tenantId: tenantId,
            createdAt: new Date().toISOString(),
            ...payload.metadata
          },
          tenantId: tenantId
        });

        logger.info(
          { 
            entityId: payload.entityId, 
            entityType: payload.entityType 
          }, 
          'Created embedding for new entity'
        );
      }
    } catch (error: any) {
      logger.error(
        { 
          entityId: payload.entityId, 
          error: error.message 
        }, 
        'Failed to create embedding for entity'
      );
      throw error;
    }
  }

  /**
   * Handle UPDATE_ENTITY events by updating embeddings
   */
  private async handleUpdateEntity(event: EntityEvent): Promise<void> {
    const { payload, tenantId } = event;
    
    try {
      // Find existing embeddings for this entity
      const existingEmbeddings = await this.embeddingService.listEmbeddings({
        tenantId: tenantId,
        filters: {
          'metadata.entityId': payload.entityId
        },
        limit: 100
      });

      // Delete old embeddings
      for (const embedding of existingEmbeddings.embeddings) {
        await this.embeddingService.deleteEmbedding(embedding.id, { tenantId });
      }

      // Create new embedding with updated content
      const textContent = this.extractTextFromEntity(payload);
      if (textContent) {
        await this.embeddingService.createDocumentEmbedding({
          content: textContent,
          metadata: {
            entityId: payload.entityId,
            entityType: payload.entityType,
            source: payload.source,
            tenantId: tenantId,
            updatedAt: new Date().toISOString(),
            ...payload.metadata
          },
          tenantId: tenantId
        });

        logger.info(
          { 
            entityId: payload.entityId, 
            entityType: payload.entityType 
          }, 
          'Updated embedding for entity'
        );
      }
    } catch (error: any) {
      logger.error(
        { 
          entityId: payload.entityId, 
          error: error.message 
        }, 
        'Failed to update embedding for entity'
      );
      throw error;
    }
  }

  /**
   * Handle DELETE_ENTITY events by removing embeddings
   */
  private async handleDeleteEntity(event: EntityEvent): Promise<void> {
    const { payload, tenantId } = event;
    
    try {
      // Find and delete all embeddings for this entity
      const existingEmbeddings = await this.embeddingService.listEmbeddings({
        tenantId: tenantId,
        filters: {
          'metadata.entityId': payload.entityId
        },
        limit: 100
      });

      for (const embedding of existingEmbeddings.embeddings) {
        await this.embeddingService.deleteEmbedding(embedding.id, { tenantId });
      }

      logger.info(
        { 
          entityId: payload.entityId, 
          deletedCount: existingEmbeddings.embeddings.length 
        }, 
        'Deleted embeddings for entity'
      );
    } catch (error: any) {
      logger.error(
        { 
          entityId: payload.entityId, 
          error: error.message 
        }, 
        'Failed to delete embeddings for entity'
      );
      throw error;
    }
  }

  /**
   * Handle LINK_ENTITIES events by updating relationship embeddings
   */
  private async handleLinkEntities(event: EntityEvent): Promise<void> {
    const { payload, tenantId } = event;
    
    try {
      // Create embedding for the relationship
      const relationshipText = `${payload.relationshipType} relationship between ${payload.sourceEntityId} and ${payload.targetEntityId}`;
      
      await this.embeddingService.createDocumentEmbedding({
        content: relationshipText,
        metadata: {
          relationshipId: payload.relationshipId,
          relationshipType: payload.relationshipType,
          sourceEntityId: payload.sourceEntityId,
          targetEntityId: payload.targetEntityId,
          tenantId: tenantId,
          createdAt: new Date().toISOString(),
          ...payload.metadata
        },
        tenantId: tenantId
      });

      logger.info(
        { 
          relationshipId: payload.relationshipId, 
          relationshipType: payload.relationshipType 
        }, 
        'Created embedding for entity relationship'
      );
    } catch (error: any) {
      logger.error(
        { 
          relationshipId: payload.relationshipId, 
          error: error.message 
        }, 
        'Failed to create embedding for relationship'
      );
      throw error;
    }
  }

  /**
   * Publish query results to Redis for real-time notifications
   */
  async publishQueryResult(event: QueryResultEvent): Promise<void> {
    if (!this.redisClient) {
      logger.warn('Redis client not available - cannot publish query result');
      return;
    }

    try {
      const channel = `${process.env.REDIS_CHANNEL_PREFIX || 'cognisync'}:query-results`;
      await this.redisClient.publish(channel, JSON.stringify(event));
      
      logger.info(
        { 
          sessionId: event.sessionId, 
          queryId: event.payload.queryId,
          resultCount: event.payload.resultCount 
        }, 
        'Published query result to Redis'
      );
    } catch (error: any) {
      logger.error(
        { 
          sessionId: event.sessionId, 
          error: error.message 
        }, 
        'Failed to publish query result'
      );
    }
  }

  /**
   * Publish cache invalidation events
   */
  async publishCacheInvalidation(cacheKeys: string[], reason: string): Promise<void> {
    if (!this.redisClient) {
      logger.warn('Redis client not available - cannot publish cache invalidation');
      return;
    }

    try {
      const channel = `${process.env.REDIS_CHANNEL_PREFIX || 'cognisync'}:cache-invalidation`;
      const event = {
        messageType: 'CACHE_INVALIDATION',
        timestamp: new Date().toISOString(),
        payload: {
          cacheKeys,
          reason,
          affectedServices: ['llm-rag-service']
        }
      };

      await this.redisClient.publish(channel, JSON.stringify(event));
      
      logger.info(
        { 
          cacheKeys, 
          reason 
        }, 
        'Published cache invalidation event'
      );
    } catch (error: any) {
      logger.error(
        { 
          cacheKeys, 
          error: error.message 
        }, 
        'Failed to publish cache invalidation'
      );
    }
  }

  /**
   * Extract text content from entity payload for embedding
   */
  private extractTextFromEntity(payload: any): string {
    const textParts: string[] = [];

    // Add entity properties that contain text
    if (payload.properties) {
      Object.entries(payload.properties).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim()) {
          textParts.push(`${key}: ${value}`);
        }
      });
    }

    // Add entity type and ID for context
    if (payload.entityType) {
      textParts.push(`Type: ${payload.entityType}`);
    }

    if (payload.entityId) {
      textParts.push(`ID: ${payload.entityId}`);
    }

    // Add source information
    if (payload.source) {
      if (payload.source.system) {
        textParts.push(`Source: ${payload.source.system}`);
      }
      if (payload.source.url) {
        textParts.push(`URL: ${payload.source.url}`);
      }
    }

    return textParts.join(' ');
  }

  /**
   * Handle Service Bus errors
   */
  private async processError(args: any): Promise<void> {
    logger.error(args, 'Error received from Azure Service Bus');
  }

  /**
   * Check if the service is running
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    serviceBus: { connected: boolean; error?: string };
    redis: { connected: boolean; error?: string };
  }> {
    const status = {
      serviceBus: { connected: false, error: undefined as string | undefined },
      redis: { connected: false, error: undefined as string | undefined }
    };

    // Check Service Bus connection
    try {
      if (this.serviceBusClient) {
        // Simple check - if client exists and no errors, consider it connected
        status.serviceBus.connected = true;
      }
    } catch (error: any) {
      status.serviceBus.error = error.message;
    }

    // Check Redis connection
    try {
      if (this.redisClient && this.redisClient.isReady) {
        await this.redisClient.ping();
        status.redis.connected = true;
      }
    } catch (error: any) {
      status.redis.error = error.message;
    }

    return status;
  }
}

// Export singleton instance
export const messageBusService = new MessageBusService();