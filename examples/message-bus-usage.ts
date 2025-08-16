/**
 * Example implementations for standardized message bus communication
 * 
 * This file demonstrates how to use the standardized message formats
 * across the CogniSync platform services.
 */

import {
  MessageEnvelope,
  CreateEntityPayload,
  LinkEntitiesPayload,
  IndexDocumentPayload,
  QueryExecutedPayload,
  createMessageEnvelope,
  createCreateEntityMessage,
  createLinkEntitiesMessage,
  createIndexDocumentMessage,
  isCreateEntityMessage,
  isLinkEntitiesMessage
} from '../shared-types/message-bus.types';

// ============================================================================
// Example: Atlassian Sync Service Publishing Messages
// ============================================================================

class AtlassianSyncMessagePublisher {
  private serviceName = 'atlassian-sync-service';
  private serviceVersion = '1.0.0';
  private instanceId = 'atlassian-sync-001';

  /**
   * Publishes a CREATE_ENTITY message when a Jira issue is processed
   */
  async publishJiraIssueEntity(issueData: any, tenantId: string, correlationId: string): Promise<void> {
    const entity: CreateEntityPayload['entity'] = {
      id: issueData.key, // e.g., "KAN-25"
      type: 'TASK',
      name: issueData.fields.summary,
      description: issueData.fields.description,
      properties: {
        status: issueData.fields.status?.name,
        project: issueData.fields.project?.key,
        jiraId: issueData.id,
        priority: issueData.fields.priority?.name,
        assignee: issueData.fields.assignee?.accountId
      },
      metadata: {
        confidence: 'HIGH',
        importance: 'MODERATE',
        source: 'jira-webhook',
        extractionMethod: 'API_INTEGRATION',
        tags: ['jira', 'issue', issueData.fields.project?.key || 'unknown'],
        aliases: [issueData.id, issueData.key]
      }
    };

    const message = createCreateEntityMessage(
      entity,
      {
        service: this.serviceName,
        version: this.serviceVersion,
        instanceId: this.instanceId
      },
      {
        correlationId,
        causationId: correlationId,
        tenantId
      }
    );

    await this.sendMessage(message);
  }

  /**
   * Publishes a LINK_ENTITIES message to connect a user to an issue
   */
  async publishUserIssueRelationship(
    issueKey: string,
    userAccountId: string,
    relationshipType: 'ASSIGNED_TO' | 'AUTHORED_BY',
    tenantId: string,
    correlationId: string
  ): Promise<void> {
    const relationship: LinkEntitiesPayload['relationship'] = {
      sourceEntityId: issueKey,
      targetEntityId: userAccountId,
      type: relationshipType,
      weight: 1.0,
      confidence: 'HIGH',
      properties: {
        establishedAt: new Date().toISOString(),
        source: 'jira-webhook'
      },
      metadata: {
        source: 'jira-webhook',
        extractionMethod: 'API_INTEGRATION',
        evidenceCount: 1,
        isInferred: false,
        context: `${relationshipType} relationship from Jira webhook`
      }
    };

    const message = createLinkEntitiesMessage(
      relationship,
      {
        service: this.serviceName,
        version: this.serviceVersion,
        instanceId: this.instanceId
      },
      {
        correlationId,
        causationId: correlationId,
        tenantId
      }
    );

    await this.sendMessage(message);
  }

  private async sendMessage(message: MessageEnvelope): Promise<void> {
    // Implementation would use Azure Service Bus client
    console.log('Publishing message:', JSON.stringify(message, null, 2));
  }
}

// ============================================================================
// Example: Knowledge Graph Service Message Consumer
// ============================================================================

class KnowledgeGraphMessageConsumer {
  private serviceName = 'knowledge-graph-service';
  private serviceVersion = '1.0.0';
  private instanceId = 'kg-service-001';

  /**
   * Processes incoming messages from the message bus
   */
  async processMessage(message: MessageEnvelope): Promise<void> {
    console.log(`Processing message type: ${message.messageType}`);

    try {
      if (isCreateEntityMessage(message)) {
        await this.handleCreateEntity(message.payload);
      } else if (isLinkEntitiesMessage(message)) {
        await this.handleLinkEntities(message.payload);
      } else {
        console.log(`Unhandled message type: ${message.messageType}`);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      throw error; // Will be handled by message bus dead letter queue
    }
  }

  private async handleCreateEntity(payload: CreateEntityPayload): Promise<void> {
    const { entity } = payload;
    
    console.log(`Creating entity: ${entity.name} (${entity.type})`);
    
    // Validate entity data
    if (!entity.id || !entity.name || !entity.type) {
      throw new Error('Invalid entity data: missing required fields');
    }

    // Create entity in knowledge graph database
    const createdEntity = await this.createEntityInDatabase({
      id: entity.id,
      type: entity.type,
      name: entity.name,
      description: entity.description,
      properties: entity.properties,
      metadata: entity.metadata,
      tenantId: 'default', // From message correlation
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`Entity created successfully: ${createdEntity.id}`);
  }

  private async handleLinkEntities(payload: LinkEntitiesPayload): Promise<void> {
    const { relationship } = payload;
    
    console.log(`Creating relationship: ${relationship.sourceEntityId} -> ${relationship.targetEntityId} (${relationship.type})`);
    
    // Validate relationship data
    if (!relationship.sourceEntityId || !relationship.targetEntityId || !relationship.type) {
      throw new Error('Invalid relationship data: missing required fields');
    }

    // Verify entities exist
    const sourceExists = await this.entityExists(relationship.sourceEntityId);
    const targetExists = await this.entityExists(relationship.targetEntityId);
    
    if (!sourceExists || !targetExists) {
      throw new Error('Cannot create relationship: one or both entities do not exist');
    }

    // Create relationship in knowledge graph database
    const createdRelationship = await this.createRelationshipInDatabase({
      sourceEntityId: relationship.sourceEntityId,
      targetEntityId: relationship.targetEntityId,
      type: relationship.type,
      weight: relationship.weight || 1.0,
      confidence: relationship.confidence,
      properties: relationship.properties,
      metadata: relationship.metadata,
      tenantId: 'default', // From message correlation
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`Relationship created successfully: ${createdRelationship.id}`);
  }

  private async createEntityInDatabase(entity: any): Promise<any> {
    // Mock implementation - would use actual database
    return { ...entity, id: entity.id || 'generated-id' };
  }

  private async createRelationshipInDatabase(relationship: any): Promise<any> {
    // Mock implementation - would use actual database
    return { ...relationship, id: 'generated-relationship-id' };
  }

  private async entityExists(entityId: string): Promise<boolean> {
    // Mock implementation - would check actual database
    return true;
  }
}

// ============================================================================
// Example: LLM-RAG Service Message Consumer
// ============================================================================

class LLMRagMessageConsumer {
  private serviceName = 'llm-rag-service';
  private serviceVersion = '1.0.0';
  private instanceId = 'llm-rag-001';

  /**
   * Processes INDEX_DOCUMENT messages for embedding generation
   */
  async processIndexDocumentMessage(message: MessageEnvelope<IndexDocumentPayload>): Promise<void> {
    const { document } = message.payload;
    
    console.log(`Indexing document: ${document.title}`);
    
    try {
      // Generate embeddings for the document
      const embeddings = await this.generateEmbeddings(document.content);
      
      // Store in vector database
      await this.storeEmbeddings({
        id: document.id,
        title: document.title,
        content: document.content,
        embeddings,
        metadata: {
          ...document.metadata,
          source: document.source,
          url: document.url,
          indexedAt: new Date().toISOString()
        }
      });

      console.log(`Document indexed successfully: ${document.id}`);
    } catch (error) {
      console.error(`Failed to index document ${document.id}:`, error);
      throw error;
    }
  }

  /**
   * Publishes analytics events when queries are executed
   */
  async publishQueryAnalytics(
    queryId: string,
    queryText: string,
    intent: string,
    resultCount: number,
    processingTime: number,
    userId: string,
    tenantId: string
  ): Promise<void> {
    const analyticsPayload: QueryExecutedPayload = {
      query: {
        id: queryId,
        text: queryText,
        intent: intent as any,
        results: resultCount,
        processingTime,
        satisfaction: undefined // Could be set based on user feedback
      },
      user: {
        id: userId,
        tenantId
      }
    };

    const message = createMessageEnvelope(
      'QUERY_EXECUTED',
      analyticsPayload,
      {
        service: this.serviceName,
        version: this.serviceVersion,
        instanceId: this.instanceId
      },
      {
        correlationId: queryId,
        causationId: queryId,
        tenantId
      }
    );

    await this.sendMessage(message);
  }

  private async generateEmbeddings(text: string): Promise<number[]> {
    // Mock implementation - would use actual embedding service
    return new Array(1536).fill(0).map(() => Math.random());
  }

  private async storeEmbeddings(data: any): Promise<void> {
    // Mock implementation - would store in vector database
    console.log(`Storing embeddings for document: ${data.id}`);
  }

  private async sendMessage(message: MessageEnvelope): Promise<void> {
    // Implementation would use Azure Service Bus client
    console.log('Publishing analytics message:', JSON.stringify(message, null, 2));
  }
}

// ============================================================================
// Example: Message Validation
// ============================================================================

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

class MessageValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
    
    // Load schemas (would be loaded from shared-schemas directory)
    this.loadSchemas();
  }

  validateMessage(message: MessageEnvelope): { valid: boolean; errors?: string[] } {
    const valid = this.ajv.validate('messageEnvelope', message);
    
    if (!valid) {
      return {
        valid: false,
        errors: this.ajv.errors?.map(err => `${err.instancePath}: ${err.message}`) || []
      };
    }

    // Validate payload based on message type
    const payloadValid = this.validatePayload(message.messageType, message.payload);
    
    return payloadValid;
  }

  private validatePayload(messageType: string, payload: any): { valid: boolean; errors?: string[] } {
    const schemaName = this.getPayloadSchemaName(messageType);
    
    if (!schemaName) {
      return { valid: true }; // No specific validation for this message type
    }

    const valid = this.ajv.validate(schemaName, payload);
    
    if (!valid) {
      return {
        valid: false,
        errors: this.ajv.errors?.map(err => `payload${err.instancePath}: ${err.message}`) || []
      };
    }

    return { valid: true };
  }

  private getPayloadSchemaName(messageType: string): string | null {
    const schemaMap: Record<string, string> = {
      'CREATE_ENTITY': 'createEntityPayload',
      'UPDATE_ENTITY': 'updateEntityPayload',
      'DELETE_ENTITY': 'deleteEntityPayload',
      'LINK_ENTITIES': 'linkEntitiesPayload',
      'UNLINK_ENTITIES': 'unlinkEntitiesPayload',
      'INDEX_DOCUMENT': 'indexDocumentPayload',
      'REINDEX_DOCUMENT': 'reindexDocumentPayload',
      'QUERY_EXECUTED': 'queryExecutedPayload'
    };

    return schemaMap[messageType] || null;
  }

  private loadSchemas(): void {
    // Mock implementation - would load actual schemas from files
    // In real implementation, load from shared-schemas/message-schemas.json
    console.log('Loading message validation schemas...');
  }
}

// ============================================================================
// Example Usage
// ============================================================================

async function demonstrateMessageBusUsage(): Promise<void> {
  console.log('=== Message Bus Usage Examples ===\n');

  // 1. Atlassian Sync Service publishing messages
  const atlassianPublisher = new AtlassianSyncMessagePublisher();
  
  const mockJiraIssue = {
    id: '12345',
    key: 'KAN-25',
    fields: {
      summary: 'Implement user authentication',
      description: 'Add OAuth2 authentication to the application',
      status: { name: 'In Progress' },
      project: { key: 'KAN' },
      priority: { name: 'High' },
      assignee: { accountId: 'user-123' }
    }
  };

  await atlassianPublisher.publishJiraIssueEntity(mockJiraIssue, 'tenant-1', 'corr-123');
  await atlassianPublisher.publishUserIssueRelationship('KAN-25', 'user-123', 'ASSIGNED_TO', 'tenant-1', 'corr-123');

  // 2. Knowledge Graph Service consuming messages
  const kgConsumer = new KnowledgeGraphMessageConsumer();
  
  const createEntityMessage = createCreateEntityMessage(
    {
      id: 'KAN-25',
      type: 'TASK',
      name: 'Implement user authentication',
      properties: { status: 'In Progress' },
      metadata: {
        confidence: 'HIGH',
        importance: 'MODERATE',
        source: 'jira',
        extractionMethod: 'API_INTEGRATION',
        tags: ['jira', 'task'],
        aliases: ['12345']
      }
    },
    { service: 'atlassian-sync-service', version: '1.0.0', instanceId: 'test' },
    { correlationId: 'test', causationId: 'test', tenantId: 'tenant-1' }
  );

  await kgConsumer.processMessage(createEntityMessage);

  // 3. LLM-RAG Service publishing analytics
  const ragConsumer = new LLMRagMessageConsumer();
  
  await ragConsumer.publishQueryAnalytics(
    'query-123',
    'How do I implement OAuth2?',
    'technical',
    5,
    1250,
    'user-456',
    'tenant-1'
  );

  // 4. Message validation
  const validator = new MessageValidator();
  const validationResult = validator.validateMessage(createEntityMessage);
  
  console.log('Message validation result:', validationResult);
}

// Run the demonstration
if (require.main === module) {
  demonstrateMessageBusUsage().catch(console.error);
}

export {
  AtlassianSyncMessagePublisher,
  KnowledgeGraphMessageConsumer,
  LLMRagMessageConsumer,
  MessageValidator
};