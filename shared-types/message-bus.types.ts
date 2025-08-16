/**
 * Shared Type Definitions for Message Bus Communication
 * 
 * This file defines the standardized types for inter-service communication
 * via Azure Service Bus across the CogniSync platform.
 */

// ============================================================================
// Core Message Envelope
// ============================================================================

export interface MessageEnvelope<T = any> {
  messageId: string; // UUID
  messageType: MessageType;
  version: string; // Semver format
  timestamp: string; // ISO 8601
  source: MessageSource;
  correlation: MessageCorrelation;
  payload: T;
}

export interface MessageSource {
  service: ServiceName;
  version: string;
  instanceId: string;
}

export interface MessageCorrelation {
  correlationId: string; // UUID
  causationId: string; // UUID
  tenantId: string;
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageType = 
  // Entity Management
  | 'CREATE_ENTITY'
  | 'UPDATE_ENTITY'
  | 'DELETE_ENTITY'
  // Relationship Management
  | 'LINK_ENTITIES'
  | 'UNLINK_ENTITIES'
  // Document Processing
  | 'INDEX_DOCUMENT'
  | 'REINDEX_DOCUMENT'
  // Analytics
  | 'QUERY_EXECUTED'
  // System Events
  | 'HEALTH_CHECK'
  | 'SERVICE_STARTED'
  | 'SERVICE_STOPPED';

export type ServiceName = 
  | 'atlassian-sync-service'
  | 'knowledge-graph-service'
  | 'llm-rag-service';

// ============================================================================
// Common Domain Types
// ============================================================================

export type EntityType = 
  | 'PERSON' 
  | 'DOCUMENT' 
  | 'TASK' 
  | 'API' 
  | 'ORGANIZATION' 
  | 'PROJECT'
  | 'CONCEPT' 
  | 'TECHNOLOGY' 
  | 'REQUIREMENT' 
  | 'DECISION' 
  | 'RISK' 
  | 'MILESTONE';

export type RelationshipType = 
  | 'AUTHORED_BY' 
  | 'ASSIGNED_TO' 
  | 'DEPENDS_ON' 
  | 'REFERENCES' 
  | 'IMPLEMENTS'
  | 'MANAGES' 
  | 'PARTICIPATES_IN' 
  | 'RELATES_TO' 
  | 'CONTAINS' 
  | 'USES';

export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ImportanceLevel = 'MINOR' | 'MODERATE' | 'SIGNIFICANT' | 'CRITICAL';
export type ExtractionMethod = 'MANUAL' | 'NLP' | 'LLM' | 'PATTERN_MATCHING' | 'API_INTEGRATION' | 'INFERENCE';
export type DocumentSource = 'confluence' | 'jira' | 'knowledge_graph' | 'external';
export type QueryIntent = 'business' | 'technical' | 'project' | 'requirements' | 'status';

// ============================================================================
// Entity Management Messages
// ============================================================================

export interface CreateEntityPayload {
  entity: {
    id: string;
    type: EntityType;
    name: string;
    description?: string;
    properties: Record<string, any>;
    metadata: EntityMetadata;
  };
}

export interface UpdateEntityPayload {
  entityId: string;
  changes: {
    name?: string;
    description?: string;
    properties?: Record<string, any>;
    metadata?: Partial<EntityMetadata>;
  };
  changeReason: string;
}

export interface DeleteEntityPayload {
  entityId: string;
  reason: string;
  cascade: boolean;
}

export interface EntityMetadata {
  confidence: ConfidenceLevel;
  importance: ImportanceLevel;
  source: string;
  extractionMethod: ExtractionMethod;
  tags: string[];
  aliases: string[];
}

// ============================================================================
// Relationship Management Messages
// ============================================================================

export interface LinkEntitiesPayload {
  relationship: {
    sourceEntityId: string;
    targetEntityId: string;
    type: RelationshipType;
    weight?: number;
    confidence: ConfidenceLevel;
    properties?: Record<string, any>;
    metadata: RelationshipMetadata;
  };
}

export interface UnlinkEntitiesPayload {
  relationshipId: string;
  reason: string;
}

export interface RelationshipMetadata {
  source: string;
  extractionMethod: ExtractionMethod;
  evidenceCount: number;
  isInferred: boolean;
  context?: string;
}

// ============================================================================
// Document Processing Messages
// ============================================================================

export interface IndexDocumentPayload {
  document: {
    id: string;
    title: string;
    content: string;
    url?: string;
    source: DocumentSource;
    metadata: DocumentMetadata;
  };
}

export interface ReindexDocumentPayload {
  documentId: string;
  reason: string;
}

export interface DocumentMetadata {
  lastModified: string; // ISO 8601
  author?: string;
  contentType: string;
  tags: string[];
}

// ============================================================================
// Analytics Messages
// ============================================================================

export interface QueryExecutedPayload {
  query: {
    id: string;
    text: string;
    intent: QueryIntent;
    results: number;
    processingTime: number;
    satisfaction?: number;
  };
  user: {
    id?: string;
    tenantId: string;
  };
}

// ============================================================================
// Message Type Guards
// ============================================================================

export function isCreateEntityMessage(message: MessageEnvelope): message is MessageEnvelope<CreateEntityPayload> {
  return message.messageType === 'CREATE_ENTITY';
}

export function isUpdateEntityMessage(message: MessageEnvelope): message is MessageEnvelope<UpdateEntityPayload> {
  return message.messageType === 'UPDATE_ENTITY';
}

export function isDeleteEntityMessage(message: MessageEnvelope): message is MessageEnvelope<DeleteEntityPayload> {
  return message.messageType === 'DELETE_ENTITY';
}

export function isLinkEntitiesMessage(message: MessageEnvelope): message is MessageEnvelope<LinkEntitiesPayload> {
  return message.messageType === 'LINK_ENTITIES';
}

export function isUnlinkEntitiesMessage(message: MessageEnvelope): message is MessageEnvelope<UnlinkEntitiesPayload> {
  return message.messageType === 'UNLINK_ENTITIES';
}

export function isIndexDocumentMessage(message: MessageEnvelope): message is MessageEnvelope<IndexDocumentPayload> {
  return message.messageType === 'INDEX_DOCUMENT';
}

export function isReindexDocumentMessage(message: MessageEnvelope): message is MessageEnvelope<ReindexDocumentPayload> {
  return message.messageType === 'REINDEX_DOCUMENT';
}

export function isQueryExecutedMessage(message: MessageEnvelope): message is MessageEnvelope<QueryExecutedPayload> {
  return message.messageType === 'QUERY_EXECUTED';
}

// ============================================================================
// Message Factory Functions
// ============================================================================

export function createMessageEnvelope<T>(
  messageType: MessageType,
  payload: T,
  source: MessageSource,
  correlation: MessageCorrelation,
  version: string = '1.0.0'
): MessageEnvelope<T> {
  return {
    messageId: generateUUID(),
    messageType,
    version,
    timestamp: new Date().toISOString(),
    source,
    correlation,
    payload
  };
}

export function createCreateEntityMessage(
  entity: CreateEntityPayload['entity'],
  source: MessageSource,
  correlation: MessageCorrelation
): MessageEnvelope<CreateEntityPayload> {
  return createMessageEnvelope('CREATE_ENTITY', { entity }, source, correlation);
}

export function createLinkEntitiesMessage(
  relationship: LinkEntitiesPayload['relationship'],
  source: MessageSource,
  correlation: MessageCorrelation
): MessageEnvelope<LinkEntitiesPayload> {
  return createMessageEnvelope('LINK_ENTITIES', { relationship }, source, correlation);
}

export function createIndexDocumentMessage(
  document: IndexDocumentPayload['document'],
  source: MessageSource,
  correlation: MessageCorrelation
): MessageEnvelope<IndexDocumentPayload> {
  return createMessageEnvelope('INDEX_DOCUMENT', { document }, source, correlation);
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================================================
// Validation Schemas (JSON Schema format)
// ============================================================================

export const MessageEnvelopeSchema = {
  type: 'object',
  required: ['messageId', 'messageType', 'version', 'timestamp', 'source', 'correlation', 'payload'],
  properties: {
    messageId: { type: 'string', format: 'uuid' },
    messageType: { type: 'string', enum: [
      'CREATE_ENTITY', 'UPDATE_ENTITY', 'DELETE_ENTITY',
      'LINK_ENTITIES', 'UNLINK_ENTITIES',
      'INDEX_DOCUMENT', 'REINDEX_DOCUMENT',
      'QUERY_EXECUTED',
      'HEALTH_CHECK', 'SERVICE_STARTED', 'SERVICE_STOPPED'
    ]},
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    timestamp: { type: 'string', format: 'date-time' },
    source: {
      type: 'object',
      required: ['service', 'version', 'instanceId'],
      properties: {
        service: { type: 'string', enum: ['atlassian-sync-service', 'knowledge-graph-service', 'llm-rag-service'] },
        version: { type: 'string' },
        instanceId: { type: 'string' }
      }
    },
    correlation: {
      type: 'object',
      required: ['correlationId', 'causationId', 'tenantId'],
      properties: {
        correlationId: { type: 'string', format: 'uuid' },
        causationId: { type: 'string', format: 'uuid' },
        tenantId: { type: 'string' }
      }
    },
    payload: { type: 'object' }
  }
};

export const CreateEntityPayloadSchema = {
  type: 'object',
  required: ['entity'],
  properties: {
    entity: {
      type: 'object',
      required: ['id', 'type', 'name', 'properties', 'metadata'],
      properties: {
        id: { type: 'string' },
        type: { type: 'string', enum: [
          'PERSON', 'DOCUMENT', 'TASK', 'API', 'ORGANIZATION', 'PROJECT',
          'CONCEPT', 'TECHNOLOGY', 'REQUIREMENT', 'DECISION', 'RISK', 'MILESTONE'
        ]},
        name: { type: 'string' },
        description: { type: 'string' },
        properties: { type: 'object' },
        metadata: {
          type: 'object',
          required: ['confidence', 'importance', 'source', 'extractionMethod', 'tags', 'aliases'],
          properties: {
            confidence: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
            importance: { type: 'string', enum: ['MINOR', 'MODERATE', 'SIGNIFICANT', 'CRITICAL'] },
            source: { type: 'string' },
            extractionMethod: { type: 'string', enum: ['MANUAL', 'NLP', 'LLM', 'PATTERN_MATCHING', 'API_INTEGRATION', 'INFERENCE'] },
            tags: { type: 'array', items: { type: 'string' } },
            aliases: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  }
};

export const LinkEntitiesPayloadSchema = {
  type: 'object',
  required: ['relationship'],
  properties: {
    relationship: {
      type: 'object',
      required: ['sourceEntityId', 'targetEntityId', 'type', 'confidence', 'metadata'],
      properties: {
        sourceEntityId: { type: 'string' },
        targetEntityId: { type: 'string' },
        type: { type: 'string', enum: [
          'AUTHORED_BY', 'ASSIGNED_TO', 'DEPENDS_ON', 'REFERENCES', 'IMPLEMENTS',
          'MANAGES', 'PARTICIPATES_IN', 'RELATES_TO', 'CONTAINS', 'USES'
        ]},
        weight: { type: 'number' },
        confidence: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
        properties: { type: 'object' },
        metadata: {
          type: 'object',
          required: ['source', 'extractionMethod', 'evidenceCount', 'isInferred'],
          properties: {
            source: { type: 'string' },
            extractionMethod: { type: 'string', enum: ['MANUAL', 'NLP', 'LLM', 'PATTERN_MATCHING', 'API_INTEGRATION', 'INFERENCE'] },
            evidenceCount: { type: 'number' },
            isInferred: { type: 'boolean' },
            context: { type: 'string' }
          }
        }
      }
    }
  }
};