# Data Exchange Formats Specification

## Overview

This document specifies the standardized data exchange formats for communication between the Atlassian Sync Service, Knowledge Graph Service, and LLM-RAG Service in the CogniSync platform.

## Table of Contents

1. [Format Standards](#format-standards)
2. [Message Bus Communication](#message-bus-communication)
3. [REST API Communication](#rest-api-communication)
4. [Data Type Definitions](#data-type-definitions)
5. [Versioning Strategy](#versioning-strategy)
6. [Performance Considerations](#performance-considerations)
7. [Implementation Guidelines](#implementation-guidelines)

## Format Standards

### Primary Format: JSON

**Rationale**: JSON is chosen as the primary data exchange format for the following reasons:
- Human-readable and debuggable
- Native support in TypeScript/JavaScript ecosystem
- Excellent tooling and validation support
- Wide compatibility across services and tools
- Flexible schema evolution

### Alternative Formats Evaluation

#### Protocol Buffers (Protobuf)
- **Pros**: Compact binary format, strong typing, excellent performance
- **Cons**: Requires code generation, less human-readable, schema evolution complexity
- **Recommendation**: Consider for high-throughput internal APIs in future iterations

#### Apache Avro
- **Pros**: Schema evolution support, compact format, good for streaming
- **Cons**: Additional complexity, limited TypeScript ecosystem support
- **Recommendation**: Consider for data pipeline scenarios with frequent schema changes

## Message Bus Communication

### Standard Message Envelope

All messages sent through Azure Service Bus must follow this envelope format:

```json
{
  "messageId": "string (uuid)",
  "messageType": "string (enum)",
  "version": "string (semver)",
  "timestamp": "string (ISO 8601)",
  "source": {
    "service": "string",
    "version": "string",
    "instanceId": "string"
  },
  "correlation": {
    "correlationId": "string (uuid)",
    "causationId": "string (uuid)",
    "tenantId": "string"
  },
  "payload": "object (message-specific)"
}
```

### Message Types

#### 1. Entity Management Messages

##### CREATE_ENTITY
```json
{
  "messageType": "CREATE_ENTITY",
  "payload": {
    "entity": {
      "id": "string",
      "type": "PERSON | DOCUMENT | TASK | API | ORGANIZATION | PROJECT | CONCEPT | TECHNOLOGY | REQUIREMENT | DECISION | RISK | MILESTONE",
      "name": "string",
      "description": "string?",
      "properties": "object",
      "metadata": {
        "confidence": "LOW | MEDIUM | HIGH | CRITICAL",
        "importance": "MINOR | MODERATE | SIGNIFICANT | CRITICAL",
        "source": "string",
        "extractionMethod": "MANUAL | NLP | LLM | PATTERN_MATCHING | API_INTEGRATION | INFERENCE",
        "tags": "string[]",
        "aliases": "string[]"
      }
    }
  }
}
```

##### UPDATE_ENTITY
```json
{
  "messageType": "UPDATE_ENTITY",
  "payload": {
    "entityId": "string",
    "changes": {
      "name": "string?",
      "description": "string?",
      "properties": "object?",
      "metadata": "object?"
    },
    "changeReason": "string"
  }
}
```

##### DELETE_ENTITY
```json
{
  "messageType": "DELETE_ENTITY",
  "payload": {
    "entityId": "string",
    "reason": "string",
    "cascade": "boolean"
  }
}
```

#### 2. Relationship Management Messages

##### LINK_ENTITIES
```json
{
  "messageType": "LINK_ENTITIES",
  "payload": {
    "relationship": {
      "sourceEntityId": "string",
      "targetEntityId": "string",
      "type": "AUTHORED_BY | ASSIGNED_TO | DEPENDS_ON | REFERENCES | IMPLEMENTS | MANAGES | PARTICIPATES_IN | RELATES_TO | CONTAINS | USES",
      "weight": "number?",
      "confidence": "LOW | MEDIUM | HIGH | CRITICAL",
      "properties": "object?",
      "metadata": {
        "source": "string",
        "extractionMethod": "MANUAL | NLP | LLM | PATTERN_MATCHING | API_INTEGRATION | INFERENCE",
        "evidenceCount": "number",
        "isInferred": "boolean",
        "context": "string?"
      }
    }
  }
}
```

##### UNLINK_ENTITIES
```json
{
  "messageType": "UNLINK_ENTITIES",
  "payload": {
    "relationshipId": "string",
    "reason": "string"
  }
}
```

#### 3. Document Processing Messages

##### INDEX_DOCUMENT
```json
{
  "messageType": "INDEX_DOCUMENT",
  "payload": {
    "document": {
      "id": "string",
      "title": "string",
      "content": "string",
      "url": "string?",
      "source": "confluence | jira | knowledge_graph | external",
      "metadata": {
        "lastModified": "string (ISO 8601)",
        "author": "string?",
        "contentType": "string",
        "tags": "string[]"
      }
    }
  }
}
```

##### REINDEX_DOCUMENT
```json
{
  "messageType": "REINDEX_DOCUMENT",
  "payload": {
    "documentId": "string",
    "reason": "string"
  }
}
```

#### 4. Analytics Messages

##### QUERY_EXECUTED
```json
{
  "messageType": "QUERY_EXECUTED",
  "payload": {
    "query": {
      "id": "string",
      "text": "string",
      "intent": "business | technical | project | requirements | status",
      "results": "number",
      "processingTime": "number",
      "satisfaction": "number?"
    },
    "user": {
      "id": "string?",
      "tenantId": "string"
    }
  }
}
```

## REST API Communication

### Standard Response Format

All REST API responses must follow this format:

```json
{
  "success": "boolean",
  "data": "any?",
  "error": {
    "code": "string",
    "message": "string",
    "details": "object?"
  }?,
  "metadata": {
    "timestamp": "string (ISO 8601)",
    "version": "string",
    "requestId": "string (uuid)",
    "processingTime": "number"
  },
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number"
  }?
}
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | NOT_FOUND | UNAUTHORIZED | TENANT_ISOLATION_ERROR | INTERNAL_ERROR",
    "message": "string",
    "details": {
      "field": "string?",
      "value": "any?",
      "constraint": "string?"
    }?
  },
  "metadata": {
    "timestamp": "string (ISO 8601)",
    "version": "string",
    "requestId": "string (uuid)",
    "processingTime": "number"
  }
}
```

## Data Type Definitions

### Common Types

#### Entity Types
```typescript
type EntityType = 
  | 'PERSON' | 'DOCUMENT' | 'TASK' | 'API' | 'ORGANIZATION' | 'PROJECT'
  | 'CONCEPT' | 'TECHNOLOGY' | 'REQUIREMENT' | 'DECISION' | 'RISK' | 'MILESTONE';
```

#### Relationship Types
```typescript
type RelationshipType = 
  | 'AUTHORED_BY' | 'ASSIGNED_TO' | 'DEPENDS_ON' | 'REFERENCES' | 'IMPLEMENTS'
  | 'MANAGES' | 'PARTICIPATES_IN' | 'RELATES_TO' | 'CONTAINS' | 'USES';
```

#### Confidence Levels
```typescript
type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
```

#### Importance Levels
```typescript
type ImportanceLevel = 'MINOR' | 'MODERATE' | 'SIGNIFICANT' | 'CRITICAL';
```

#### Extraction Methods
```typescript
type ExtractionMethod = 'MANUAL' | 'NLP' | 'LLM' | 'PATTERN_MATCHING' | 'API_INTEGRATION' | 'INFERENCE';
```

### Service-Specific Types

#### Atlassian Sync Service

##### Sync Event
```json
{
  "id": "string (uuid)",
  "type": "string",
  "source": "jira | confluence",
  "timestamp": "string (ISO 8601)",
  "actorId": "string?",
  "entityId": "string?",
  "externalId": "string?",
  "changes": "object",
  "processingStatus": "PENDING | PROCESSING | COMPLETED | FAILED | RETRYING | DEAD_LETTER",
  "errorMessage": "string?",
  "retryCount": "number",
  "tenantId": "string",
  "configId": "string?"
}
```

#### Knowledge Graph Service

##### Entity
```json
{
  "id": "string (uuid)",
  "type": "EntityType",
  "name": "string",
  "description": "string?",
  "properties": "object",
  "metadata": {
    "confidence": "ConfidenceLevel",
    "importance": "ImportanceLevel",
    "source": "string",
    "extractionMethod": "ExtractionMethod",
    "tags": "string[]",
    "aliases": "string[]"
  },
  "tenantId": "string?",
  "createdAt": "string (ISO 8601)",
  "updatedAt": "string (ISO 8601)"
}
```

##### Relationship
```json
{
  "id": "string (uuid)",
  "sourceEntityId": "string",
  "targetEntityId": "string",
  "type": "RelationshipType",
  "weight": "number",
  "confidence": "ConfidenceLevel",
  "properties": "object?",
  "metadata": {
    "source": "string",
    "extractionMethod": "ExtractionMethod",
    "evidenceCount": "number",
    "isInferred": "boolean",
    "context": "string?"
  },
  "tenantId": "string?",
  "createdAt": "string (ISO 8601)",
  "updatedAt": "string (ISO 8601)"
}
```

#### LLM-RAG Service

##### Query Request
```json
{
  "query": "string",
  "tenantId": "string",
  "sessionId": "string?",
  "userId": "string?",
  "context": "object?",
  "maxResults": "number?",
  "filters": {
    "documentTypes": "string[]?",
    "sources": "string[]?",
    "dateRange": {
      "start": "string (ISO 8601)?",
      "end": "string (ISO 8601)?"
    }?,
    "tags": "string[]?"
  }?,
  "options": {
    "includeAnalysis": "boolean?",
    "includeSuggestions": "boolean?",
    "sources": "string[]?"
  }?
}
```

##### Query Response
```json
{
  "sessionId": "string",
  "response": "string",
  "context": {
    "intent": "business | technical | project | requirements | status",
    "entities": "string[]",
    "keywords": "string[]",
    "urgency": "low | medium | high",
    "complexity": "simple | moderate | complex"
  },
  "sources": [
    {
      "documentId": "string",
      "title": "string",
      "relevanceScore": "number",
      "excerpt": "string"
    }
  ],
  "processingTime": "number",
  "metadata": {
    "totalDocuments": "number?",
    "searchTime": "number?",
    "llmTokens": "number?",
    "confidence": "number?"
  }
}
```

## Versioning Strategy

### Message Versioning

1. **Semantic Versioning**: Use semver (MAJOR.MINOR.PATCH) for message schemas
2. **Backward Compatibility**: Maintain backward compatibility within major versions
3. **Version Header**: Include version in message envelope
4. **Deprecation Policy**: 6-month deprecation notice for breaking changes

### API Versioning

1. **URL Versioning**: Use `/api/v1/`, `/api/v2/` in URL paths
2. **Header Versioning**: Support `Accept-Version` header as alternative
3. **Default Version**: Always specify a default version for unversioned requests

### Schema Evolution Rules

1. **Additive Changes**: New optional fields are allowed in minor versions
2. **Breaking Changes**: Require major version increment
3. **Field Deprecation**: Mark fields as deprecated before removal
4. **Type Changes**: Considered breaking changes

## Performance Considerations

### JSON Optimization

1. **Field Ordering**: Place frequently accessed fields first
2. **Null Handling**: Omit null/undefined fields to reduce payload size
3. **Compression**: Use gzip compression for HTTP APIs
4. **Streaming**: Support streaming for large datasets

### Future Format Migration

#### Protobuf Adoption Path

1. **Phase 1**: Implement Protobuf for high-throughput internal APIs
2. **Phase 2**: Migrate message bus to Protobuf for performance-critical paths
3. **Phase 3**: Evaluate client-facing API migration

#### Avro Consideration

1. **Use Case**: Consider for data pipeline scenarios with frequent schema evolution
2. **Integration**: Evaluate with Apache Kafka if message bus migration is needed

## Implementation Guidelines

### Message Bus Implementation

1. **Dead Letter Queues**: Implement DLQ for failed message processing
2. **Retry Logic**: Exponential backoff with jitter
3. **Idempotency**: Ensure message processing is idempotent
4. **Monitoring**: Track message processing metrics

### API Implementation

1. **Content Negotiation**: Support multiple content types
2. **Rate Limiting**: Implement per-tenant rate limiting
3. **Caching**: Use appropriate cache headers
4. **Validation**: Validate all input against schemas

### Schema Validation

1. **JSON Schema**: Use JSON Schema for validation
2. **Runtime Validation**: Validate at service boundaries
3. **Documentation**: Auto-generate API documentation from schemas
4. **Testing**: Include schema validation in integration tests

### Error Handling

1. **Consistent Errors**: Use standardized error format across services
2. **Error Codes**: Define service-specific error codes
3. **Logging**: Include correlation IDs for distributed tracing
4. **Monitoring**: Track error rates and patterns

## Compliance and Security

### Data Privacy

1. **PII Handling**: Identify and protect personally identifiable information
2. **Tenant Isolation**: Ensure data isolation between tenants
3. **Encryption**: Use TLS for all communications
4. **Audit Logging**: Log all data access and modifications

### Schema Security

1. **Input Validation**: Validate all inputs against strict schemas
2. **Output Sanitization**: Sanitize outputs to prevent injection attacks
3. **Size Limits**: Enforce reasonable payload size limits
4. **Rate Limiting**: Implement rate limiting to prevent abuse

## Monitoring and Observability

### Metrics

1. **Message Processing**: Track message processing times and success rates
2. **API Performance**: Monitor API response times and error rates
3. **Schema Validation**: Track validation failures and schema evolution
4. **Data Quality**: Monitor data consistency across services

### Logging

1. **Structured Logging**: Use structured JSON logging
2. **Correlation IDs**: Include correlation IDs for request tracing
3. **Schema Versions**: Log schema versions used in processing
4. **Error Context**: Include relevant context in error logs

## Migration Strategy

### Current State Assessment

1. **Existing Formats**: All services currently use JSON
2. **Message Bus**: Azure Service Bus with JSON payloads
3. **APIs**: REST APIs with JSON request/response

### Implementation Phases

#### Phase 1: Standardization (Immediate)
- [ ] Implement standard message envelope format
- [ ] Standardize error response format
- [ ] Add version headers to all messages
- [ ] Implement JSON schema validation

#### Phase 2: Enhanced Validation (1-2 weeks)
- [ ] Create comprehensive JSON schemas for all message types
- [ ] Implement runtime schema validation
- [ ] Add schema version compatibility checks
- [ ] Enhance error handling and reporting

#### Phase 3: Performance Optimization (Future)
- [ ] Evaluate Protobuf for high-throughput scenarios
- [ ] Implement compression for large payloads
- [ ] Optimize JSON serialization/deserialization
- [ ] Consider binary formats for internal communication

## Conclusion

This specification establishes JSON as the primary data exchange format while providing a clear path for future optimization with binary formats. The standardized schemas and versioning strategy ensure consistent, reliable communication between services while maintaining flexibility for future evolution.

The implementation should be done incrementally, starting with standardization of existing JSON formats and gradually adding more sophisticated features like schema validation and performance optimizations.