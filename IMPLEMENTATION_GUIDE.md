# Implementation Guide: Data Exchange Format Migration

## Overview

This guide provides step-by-step instructions for migrating the existing CogniSync services to use the standardized data exchange formats defined in `DATA_EXCHANGE_FORMATS.md`.

## Table of Contents

1. [Migration Strategy](#migration-strategy)
2. [Atlassian Sync Service Migration](#atlassian-sync-service-migration)
3. [Knowledge Graph Service Migration](#knowledge-graph-service-migration)
4. [LLM-RAG Service Migration](#llm-rag-service-migration)
5. [Validation and Testing](#validation-and-testing)
6. [Deployment Considerations](#deployment-considerations)

## Migration Strategy

### Phase 1: Foundation (Week 1)
- [ ] Install shared type definitions
- [ ] Update message bus services to use standard envelope
- [ ] Implement basic validation
- [ ] Update existing message formats gradually

### Phase 2: Standardization (Week 2)
- [ ] Migrate all message types to standard format
- [ ] Update API responses to standard format
- [ ] Implement comprehensive validation
- [ ] Add error handling improvements

### Phase 3: Optimization (Week 3)
- [ ] Performance testing and optimization
- [ ] Documentation updates
- [ ] Monitoring and alerting setup
- [ ] Production deployment

## Atlassian Sync Service Migration

### Current State Analysis

The current `publishKnowledgeGraphEvents` method uses a simplified message format:

```typescript
// Current format (non-standard)
const issueEntityMessage = {
  body: {
    messageType: 'CREATE_ENTITY',
    payload: {
      id: issue.key,
      type: 'Issue',
      name: issue.fields.summary,
      metadata: JSON.stringify({...})
    }
  },
  messageId: `${event.id}-issue`
};
```

### Migration Steps

#### Step 1: Install Shared Types

```bash
cd atlassian-sync-service
npm install --save-dev ../shared-types
```

#### Step 2: Update Message Bus Service

Replace the current message bus service with the standardized version:

```typescript
// atlassian-sync-service/src/services/message-bus.service.ts
import { ServiceBusClient } from '@azure/service-bus';
import { MessageEnvelope } from '../../../shared-types/message-bus.types';
import { getLogger } from '../logger';

class MessageBusService {
  private logger;
  private serviceBusClient: ServiceBusClient;
  private sender;
  private serviceInfo = {
    service: 'atlassian-sync-service' as const,
    version: '1.0.0',
    instanceId: process.env.INSTANCE_ID || 'atlassian-sync-001'
  };

  constructor() {
    const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING!;
    const topicName = process.env.SERVICE_BUS_TOPIC_NAME!;

    if (!connectionString || !topicName) {
      throw new Error('Missing Azure Service Bus connection details for producer.');
    }

    this.serviceBusClient = new ServiceBusClient(connectionString);
    this.sender = this.serviceBusClient.createSender(topicName);
    this.logger = getLogger('MessageBusService');
    this.logger.info('MessageBusService initialized with standardized format.');
  }

  async sendMessage(envelope: MessageEnvelope) {
    try {
      this.logger.info({ messageType: envelope.messageType }, 'Publishing standardized message to Service Bus.');
      await this.sender.sendMessages(envelope);
    } catch (err) {
      this.logger.error(err, 'Error publishing message to Service Bus.');
      throw err;
    }
  }

  getServiceInfo() {
    return this.serviceInfo;
  }

  async close() {
    await this.sender.close();
    await this.serviceBusClient.close();
  }
}

export const messageBusService = new MessageBusService();
```

#### Step 3: Update AtlassianSyncService

Replace the `publishKnowledgeGraphEvents` method:

```typescript
// atlassian-sync-service/src/services/atlassian-sync.service.ts
import { 
  createCreateEntityMessage, 
  createLinkEntitiesMessage,
  CreateEntityPayload,
  LinkEntitiesPayload 
} from '../../../shared-types/message-bus.types';
import { messageBusService } from './message-bus.service';

export class AtlassianSyncService {
  // ... existing code ...

  private async publishKnowledgeGraphEvents(event: SyncEvent): Promise<void> {
    const payload = event.changes as any;

    if (!payload || !payload.issue || !payload.issue.key || !payload.issue.fields || !payload.issue.fields.summary) {
      logger.warn({ eventId: event.id, payload }, 'Event payload is missing required fields. Skipping.');
      return;
    }

    const issue = payload.issue;
    const user = payload.user;
    const correlationId = event.id;
    const tenantId = event.tenantId;

    // 1. Create standardized entity message for Jira Issue
    const entityData: CreateEntityPayload['entity'] = {
      id: issue.key,
      type: 'TASK', // Standardized entity type
      name: issue.fields.summary,
      description: issue.fields.description,
      properties: {
        status: issue.fields.status?.name,
        project: issue.fields.project?.key,
        jiraId: issue.id,
        priority: issue.fields.priority?.name,
        assignee: issue.fields.assignee?.accountId
      },
      metadata: {
        confidence: 'HIGH',
        importance: 'MODERATE',
        source: 'jira-webhook',
        extractionMethod: 'API_INTEGRATION',
        tags: ['jira', 'issue', issue.fields.project?.key || 'unknown'],
        aliases: [issue.id, issue.key]
      }
    };

    const issueMessage = createCreateEntityMessage(
      entityData,
      messageBusService.getServiceInfo(),
      {
        correlationId,
        causationId: correlationId,
        tenantId
      }
    );

    await messageBusService.sendMessage(issueMessage);

    // 2. Create standardized entity message for User (if present)
    if (user && user.accountId) {
      const userEntityData: CreateEntityPayload['entity'] = {
        id: user.accountId,
        type: 'PERSON',
        name: user.displayName,
        description: `Jira user: ${user.displayName}`,
        properties: {
          email: user.emailAddress,
          active: user.active
        },
        metadata: {
          confidence: 'HIGH',
          importance: 'MODERATE',
          source: 'jira-webhook',
          extractionMethod: 'API_INTEGRATION',
          tags: ['jira', 'user'],
          aliases: [user.accountId]
        }
      };

      const userMessage = createCreateEntityMessage(
        userEntityData,
        messageBusService.getServiceInfo(),
        {
          correlationId,
          causationId: correlationId,
          tenantId
        }
      );

      await messageBusService.sendMessage(userMessage);

      // 3. Create standardized relationship message
      const relationshipData: LinkEntitiesPayload['relationship'] = {
        sourceEntityId: issue.key,
        targetEntityId: user.accountId,
        type: 'ASSIGNED_TO', // Standardized relationship type
        weight: 1.0,
        confidence: 'HIGH',
        properties: {
          establishedAt: new Date().toISOString(),
          eventType: payload.webhookEvent
        },
        metadata: {
          source: 'jira-webhook',
          extractionMethod: 'API_INTEGRATION',
          evidenceCount: 1,
          isInferred: false,
          context: `Relationship established from Jira ${payload.webhookEvent} event`
        }
      };

      const linkMessage = createLinkEntitiesMessage(
        relationshipData,
        messageBusService.getServiceInfo(),
        {
          correlationId,
          causationId: correlationId,
          tenantId
        }
      );

      await messageBusService.sendMessage(linkMessage);
    }
  }
}
```

## Knowledge Graph Service Migration

### Current State Analysis

The current ingestion service processes messages with a simple format. We need to update it to handle the standardized message envelope.

### Migration Steps

#### Step 1: Update Ingestion Service

```typescript
// knowledge-graph-server/src/services/ingestion.service.ts
import { ServiceBusClient, ServiceBusReceiver, ServiceBusReceivedMessage } from '@azure/service-bus';
import { 
  MessageEnvelope, 
  isCreateEntityMessage, 
  isLinkEntitiesMessage,
  CreateEntityPayload,
  LinkEntitiesPayload 
} from '../../../shared-types/message-bus.types';
import { logger } from '../utils/logger';
import { GraphService } from './graph.service';

export class IngestionService {
  // ... existing constructor and setup ...

  private async processMessage(message: ServiceBusReceivedMessage, context: any) {
    logger.info({ messageId: message.messageId }, 'Received message from Service Bus.');

    try {
      // Parse the standardized message envelope
      const envelope: MessageEnvelope = message.body;
      
      // Validate message envelope structure
      if (!this.isValidMessageEnvelope(envelope)) {
        throw new Error('Invalid message envelope format');
      }

      logger.info({ 
        messageType: envelope.messageType, 
        version: envelope.version,
        source: envelope.source.service 
      }, 'Processing standardized message');

      // Process based on message type using type guards
      if (isCreateEntityMessage(envelope)) {
        await this.handleCreateEntity(envelope.payload, envelope.correlation);
      } else if (isLinkEntitiesMessage(envelope)) {
        await this.handleLinkEntities(envelope.payload, envelope.correlation);
      } else {
        logger.warn({ messageType: envelope.messageType }, 'Unhandled message type');
      }

      await this.receiver.completeMessage(message);
      logger.info({ messageId: message.messageId }, 'Message processed successfully');

    } catch (error: any) {
      logger.error({ messageId: message.messageId, error: error.message }, 'Failed to process message');
      await this.receiver.deadLetterMessage(message, {
        deadLetterReason: 'ProcessingError',
        deadLetterErrorDescription: error.message
      });
    }
  }

  private isValidMessageEnvelope(envelope: any): envelope is MessageEnvelope {
    return envelope && 
           envelope.messageId && 
           envelope.messageType && 
           envelope.version && 
           envelope.source && 
           envelope.correlation && 
           envelope.payload;
  }

  private async handleCreateEntity(payload: CreateEntityPayload, correlation: any): Promise<void> {
    const { entity } = payload;
    
    logger.info({ entityId: entity.id, entityType: entity.type }, 'Creating entity from standardized payload');
    
    // Validate required fields
    if (!entity.id || !entity.name || !entity.type) {
      throw new Error('Invalid entity data: missing required fields');
    }

    // Create entity using GraphService
    await this.graphService.createEntity({
      id: entity.id,
      type: entity.type,
      name: entity.name,
      description: entity.description,
      properties: entity.properties,
      metadata: entity.metadata,
      tenantId: correlation.tenantId
    });
  }

  private async handleLinkEntities(payload: LinkEntitiesPayload, correlation: any): Promise<void> {
    const { relationship } = payload;
    
    logger.info({ 
      sourceId: relationship.sourceEntityId, 
      targetId: relationship.targetEntityId,
      type: relationship.type 
    }, 'Creating relationship from standardized payload');
    
    // Validate required fields
    if (!relationship.sourceEntityId || !relationship.targetEntityId || !relationship.type) {
      throw new Error('Invalid relationship data: missing required fields');
    }

    // Create relationship using GraphService
    await this.graphService.linkEntities({
      sourceEntityId: relationship.sourceEntityId,
      targetEntityId: relationship.targetEntityId,
      type: relationship.type,
      weight: relationship.weight,
      confidence: relationship.confidence,
      properties: relationship.properties,
      metadata: relationship.metadata,
      tenantId: correlation.tenantId
    });
  }
}
```

## LLM-RAG Service Migration

### Migration Steps

#### Step 1: Update Indexing Service

```typescript
// llm-rag-service/src/services/indexing.service.ts
import { ServiceBusClient, ServiceBusReceiver, ServiceBusReceivedMessage } from '@azure/service-bus';
import { 
  MessageEnvelope, 
  isCreateEntityMessage, 
  isIndexDocumentMessage,
  CreateEntityPayload,
  IndexDocumentPayload 
} from '../../../shared-types/message-bus.types';
import { logger } from '../utils/logger';
import { OpenAIService } from './openai.service';
import { PineconeService } from './pinecone.service';

export class IndexingService {
  // ... existing constructor and setup ...

  private async processMessage(message: ServiceBusReceivedMessage) {
    try {
      const envelope: MessageEnvelope = message.body;
      
      if (!this.isValidMessageEnvelope(envelope)) {
        throw new Error('Invalid message envelope format');
      }

      logger.info({ 
        messageType: envelope.messageType,
        source: envelope.source.service 
      }, 'Processing message for indexing');

      // Handle entity creation for indexing
      if (isCreateEntityMessage(envelope)) {
        await this.handleEntityIndexing(envelope.payload, envelope.correlation);
      } else if (isIndexDocumentMessage(envelope)) {
        await this.handleDocumentIndexing(envelope.payload, envelope.correlation);
      } else {
        // Ignore other message types
        logger.debug({ messageType: envelope.messageType }, 'Message type not relevant for indexing');
      }

      await this.receiver.completeMessage(message);
    } catch (error: any) {
      logger.error({ messageId: message.messageId, error: error.message }, 'Failed to process indexing message');
      await this.receiver.deadLetterMessage(message, {
        deadLetterReason: 'IndexingError',
        deadLetterErrorDescription: error?.message || 'Failed to process indexing message'
      });
    }
  }

  private async handleEntityIndexing(payload: CreateEntityPayload, correlation: any): Promise<void> {
    const { entity } = payload;
    
    // Only index entities that have textual content
    if (!entity.description && !entity.name) {
      logger.debug({ entityId: entity.id }, 'Entity has no textual content to index');
      return;
    }

    const textToEmbed = [entity.name, entity.description].filter(Boolean).join(' ');
    
    logger.info({ entityId: entity.id }, 'Indexing entity for semantic search');

    // Generate embedding
    const embedding = await this.openaiService.createEmbedding(textToEmbed);

    // Prepare vector for Pinecone
    const vector = {
      id: `entity-${entity.id}`,
      values: embedding,
      metadata: {
        source: entity.id,
        type: entity.type,
        name: entity.name,
        description: entity.description,
        text: textToEmbed,
        tenantId: correlation.tenantId,
        confidence: entity.metadata.confidence,
        importance: entity.metadata.importance,
        tags: entity.metadata.tags
      }
    };

    await this.pineconeService.upsert([vector]);
    logger.info({ vectorId: vector.id }, 'Entity indexed successfully');
  }

  private async handleDocumentIndexing(payload: IndexDocumentPayload, correlation: any): Promise<void> {
    const { document } = payload;
    
    logger.info({ documentId: document.id }, 'Indexing document for semantic search');

    // Generate embedding for document content
    const embedding = await this.openaiService.createEmbedding(document.content);

    // Prepare vector for Pinecone
    const vector = {
      id: `doc-${document.id}`,
      values: embedding,
      metadata: {
        source: document.source,
        title: document.title,
        url: document.url,
        text: document.content,
        tenantId: correlation.tenantId,
        contentType: document.metadata.contentType,
        author: document.metadata.author,
        tags: document.metadata.tags,
        lastModified: document.metadata.lastModified
      }
    };

    await this.pineconeService.upsert([vector]);
    logger.info({ vectorId: vector.id }, 'Document indexed successfully');
  }

  private isValidMessageEnvelope(envelope: any): envelope is MessageEnvelope {
    return envelope && 
           envelope.messageId && 
           envelope.messageType && 
           envelope.version && 
           envelope.source && 
           envelope.correlation && 
           envelope.payload;
  }
}
```

#### Step 2: Update API Response Format

```typescript
// llm-rag-service/src/routes/query.routes.ts
import { Router } from 'express';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  createValidationError,
  LLMRagAPI 
} from '../../../shared-types/api.types';

const router = Router();

router.post('/query', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || generateRequestId();

  try {
    const queryRequest: LLMRagAPI.QueryRequest = req.body;

    // Validate request
    if (!queryRequest.query) {
      const errorResponse = createErrorResponse(
        createValidationError('query is required', 'query'),
        requestId,
        Date.now() - startTime
      );
      return res.status(400).json(errorResponse);
    }

    if (!queryRequest.tenantId) {
      const errorResponse = createErrorResponse(
        createValidationError('tenantId is required', 'tenantId'),
        requestId,
        Date.now() - startTime
      );
      return res.status(400).json(errorResponse);
    }

    // Process query
    const queryResponse = await processQuery(queryRequest);

    // Return standardized success response
    const successResponse = createSuccessResponse(
      queryResponse,
      requestId,
      Date.now() - startTime
    );

    res.json(successResponse);
  } catch (error: any) {
    const errorResponse = createErrorResponse(
      { code: 'INTERNAL_ERROR', message: 'Failed to process query' },
      requestId,
      Date.now() - startTime
    );
    res.status(500).json(errorResponse);
  }
});

function generateRequestId(): string {
  return 'req-' + Math.random().toString(36).substr(2, 9);
}

export default router;
```

## Validation and Testing

### Step 1: Install Validation Dependencies

```bash
npm install ajv ajv-formats
```

### Step 2: Create Validation Middleware

```typescript
// shared-utils/validation.middleware.ts
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { Request, Response, NextFunction } from 'express';
import { createErrorResponse, createValidationError } from '../shared-types/api.types';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// Load schemas
import messageSchemas from '../shared-schemas/message-schemas.json';
import apiSchemas from '../shared-schemas/api-schemas.json';

// Add schemas to validator
Object.entries(messageSchemas.schemas).forEach(([name, schema]) => {
  ajv.addSchema(schema, name);
});

Object.entries(apiSchemas.schemas).forEach(([name, schema]) => {
  ajv.addSchema(schema, name);
});

export function validateRequestBody(schemaName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const valid = ajv.validate(schemaName, req.body);
    
    if (!valid) {
      const errors = ajv.errors?.map(err => `${err.instancePath}: ${err.message}`) || [];
      const errorResponse = createErrorResponse(
        createValidationError(`Validation failed: ${errors.join(', ')}`),
        req.headers['x-request-id'] as string || 'unknown',
        0
      );
      return res.status(400).json(errorResponse);
    }
    
    next();
  };
}

export function validateMessage(envelope: any): { valid: boolean; errors?: string[] } {
  const valid = ajv.validate('messageEnvelope', envelope);
  
  if (!valid) {
    return {
      valid: false,
      errors: ajv.errors?.map(err => `${err.instancePath}: ${err.message}`) || []
    };
  }

  return { valid: true };
}
```

### Step 3: Integration Tests

```typescript
// tests/integration/message-bus.test.ts
import { 
  createCreateEntityMessage, 
  createLinkEntitiesMessage,
  MessageEnvelope 
} from '../../shared-types/message-bus.types';
import { validateMessage } from '../../shared-utils/validation.middleware';

describe('Message Bus Integration', () => {
  test('should create valid CREATE_ENTITY message', () => {
    const message = createCreateEntityMessage(
      {
        id: 'test-entity',
        type: 'TASK',
        name: 'Test Task',
        properties: { status: 'active' },
        metadata: {
          confidence: 'HIGH',
          importance: 'MODERATE',
          source: 'test',
          extractionMethod: 'MANUAL',
          tags: ['test'],
          aliases: []
        }
      },
      { service: 'test-service', version: '1.0.0', instanceId: 'test' },
      { correlationId: 'test', causationId: 'test', tenantId: 'test' }
    );

    const validation = validateMessage(message);
    expect(validation.valid).toBe(true);
  });

  test('should create valid LINK_ENTITIES message', () => {
    const message = createLinkEntitiesMessage(
      {
        sourceEntityId: 'entity-1',
        targetEntityId: 'entity-2',
        type: 'RELATES_TO',
        confidence: 'HIGH',
        metadata: {
          source: 'test',
          extractionMethod: 'MANUAL',
          evidenceCount: 1,
          isInferred: false
        }
      },
      { service: 'test-service', version: '1.0.0', instanceId: 'test' },
      { correlationId: 'test', causationId: 'test', tenantId: 'test' }
    );

    const validation = validateMessage(message);
    expect(validation.valid).toBe(true);
  });
});
```

## Deployment Considerations

### Environment Variables

Update environment variables to include versioning information:

```bash
# .env
SERVICE_NAME=atlassian-sync-service
SERVICE_VERSION=1.0.0
INSTANCE_ID=atlassian-sync-001
MESSAGE_FORMAT_VERSION=1.0.0
API_VERSION=1.0.0
```

### Monitoring and Alerting

Add monitoring for message format compliance:

```typescript
// shared-utils/monitoring.ts
import { MessageEnvelope } from '../shared-types/message-bus.types';

export class MessageMonitoring {
  static trackMessageProcessed(envelope: MessageEnvelope, processingTime: number) {
    // Track metrics
    console.log(`Message processed: ${envelope.messageType} in ${processingTime}ms`);
  }

  static trackValidationFailure(envelope: any, errors: string[]) {
    // Track validation failures
    console.error(`Message validation failed:`, errors);
  }

  static trackFormatMigration(oldFormat: any, newFormat: MessageEnvelope) {
    // Track format migrations
    console.log(`Message format migrated from legacy to standard`);
  }
}
```

### Backward Compatibility

During migration, support both old and new formats:

```typescript
// shared-utils/format-adapter.ts
import { MessageEnvelope } from '../shared-types/message-bus.types';

export function adaptLegacyMessage(legacyMessage: any): MessageEnvelope {
  // Convert legacy message format to standard format
  if (legacyMessage.body && !legacyMessage.messageId) {
    // This is a legacy format
    return {
      messageId: generateUUID(),
      messageType: legacyMessage.body.messageType,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      source: {
        service: 'unknown',
        version: '0.0.0',
        instanceId: 'legacy'
      },
      correlation: {
        correlationId: legacyMessage.messageId || generateUUID(),
        causationId: legacyMessage.messageId || generateUUID(),
        tenantId: 'default'
      },
      payload: legacyMessage.body.payload
    };
  }
  
  return legacyMessage;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
```

## Rollback Plan

In case of issues during migration:

1. **Message Bus Rollback**: Keep legacy message handling code until migration is complete
2. **API Rollback**: Support both old and new response formats using content negotiation
3. **Database Rollback**: Ensure data models remain compatible
4. **Monitoring**: Set up alerts for increased error rates during migration

## Success Criteria

- [ ] All services use standardized message envelope format
- [ ] All APIs return standardized response format
- [ ] Message validation is implemented and working
- [ ] Error rates remain stable during migration
- [ ] Performance metrics show no degradation
- [ ] All integration tests pass
- [ ] Documentation is updated

## Timeline

- **Week 1**: Foundation setup and basic migration
- **Week 2**: Complete migration and testing
- **Week 3**: Production deployment and monitoring
- **Week 4**: Cleanup and optimization