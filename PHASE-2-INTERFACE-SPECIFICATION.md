# CogniSync Platform - Phase 2 Interface and Communication Protocol Specification

## Executive Summary

This document provides the comprehensive interface and communication protocol specification for the CogniSync Platform Phase 2 architecture. It defines clear interfaces, data exchange formats, API contracts, message queues, event-driven mechanisms, and security considerations for inter-service communication between the three core microservices:

- **Atlassian Sync Service** (Port 3002)
- **Knowledge Graph Service** (Port 3001) 
- **LLM-RAG Service** (Port 3003)

### Architecture Principles

- **Microservices Architecture**: Autonomous services with clear boundaries
- **API-First Design**: Well-defined contracts before implementation
- **Event-Driven Communication**: Asynchronous messaging for scalability
- **Multi-Tenant Support**: Tenant isolation at all communication layers
- **Security by Design**: Authentication and authorization built-in
- **Observability**: Comprehensive monitoring and tracing

---

## Table of Contents

1. [Service Interface Specifications](#service-interface-specifications)
2. [Communication Protocols](#communication-protocols)
3. [Data Exchange Formats](#data-exchange-formats)
4. [Message Queue Architecture](#message-queue-architecture)
5. [Security Specifications](#security-specifications)
6. [Error Handling and Monitoring](#error-handling-and-monitoring)
7. [Implementation Guidelines](#implementation-guidelines)
8. [Testing and Validation](#testing-and-validation)

---

## Service Interface Specifications

### 1. Atlassian Sync Service API

**Base URL**: `http://localhost:3002` (dev) | `https://api.cognisync.com/atlassian-sync` (prod)

#### Core Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Health check | No |
| GET | `/api/status` | Service status and statistics | No |
| POST | `/api/webhook/jira` | Jira webhook receiver | Yes |
| POST | `/api/webhook/confluence` | Confluence webhook receiver | Yes |
| GET | `/api/configurations` | List sync configurations | Yes |
| POST | `/api/configurations` | Create sync configuration | Yes |
| PUT | `/api/configurations/{id}` | Update sync configuration | Yes |
| DELETE | `/api/configurations/{id}` | Delete sync configuration | Yes |
| GET | `/api/events` | List sync events | Yes |
| GET | `/api/events/{id}` | Get sync event details | Yes |

#### Key Data Models

```typescript
interface SyncEvent {
  id: string;
  configId: string;
  type: string;
  source: 'jira' | 'confluence';
  externalId: string;
  changes: Record<string, any>;
  processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRYING';
  retryCount: number;
  errorMessage?: string;
  tenantId: string;
  timestamp: Date;
}

interface SyncConfiguration {
  id: string;
  name: string;
  description?: string;
  source: 'jira' | 'confluence';
  webhookUrl: string;
  isActive: boolean;
  retryLimit: number;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. Knowledge Graph Service API

**Base URL**: `http://localhost:3001/api/v1` (dev) | `https://api.cognisync.com/knowledge-graph/api/v1` (prod)

#### Core Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Health check | No |
| POST | `/entities` | Create entity | Yes |
| GET | `/entities` | Search entities | Yes |
| GET | `/entities/{id}` | Get entity by ID | Yes |
| PUT | `/entities/{id}` | Update entity | Yes |
| DELETE | `/entities/{id}` | Delete entity | Yes |
| POST | `/relationships` | Create relationship | Yes |
| GET | `/relationships` | Search relationships | Yes |
| DELETE | `/relationships/{id}` | Delete relationship | Yes |
| GET | `/entities/{id}/neighborhood` | Get entity neighborhood | Yes |
| GET | `/analytics` | Get graph analytics | Yes |
| POST | `/bulk/entities` | Bulk create entities | Yes |
| POST | `/bulk/relationships` | Bulk create relationships | Yes |

#### Key Data Models

```typescript
interface KnowledgeEntity {
  id: string;
  type: EntityType;
  name: string;
  description?: string;
  properties: Record<string, any>;
  metadata: Record<string, any>;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface KnowledgeRelationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  weight: number;
  confidence: ConfidenceLevel;
  properties: Record<string, any>;
  metadata: Record<string, any>;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

type EntityType = 'Person' | 'Issue' | 'Project' | 'Page' | 'Space' | 'Team' | 'Component' | 'Epic' | 'Sprint';
type RelationshipType = 'ASSIGNED_TO' | 'REPORTED_BY' | 'BELONGS_TO' | 'DEPENDS_ON' | 'BLOCKS' | 'RELATES_TO' | 'CREATED_BY' | 'UPDATED_BY' | 'CONTAINS' | 'PART_OF';
type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
```

### 3. LLM-RAG Service API

**Base URL**: `http://localhost:3003/api` (dev) | `https://api.cognisync.com/llm-rag/api` (prod)

#### Core Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Health check | No |
| POST | `/query` | Process single query | Yes |
| POST | `/query/search` | Semantic search | Yes |
| POST | `/query/analyze` | Query analysis | Yes |
| POST | `/query/suggestions` | Get search suggestions | Yes |
| POST | `/embeddings` | Generate embeddings | Yes |
| POST | `/embeddings/bulk` | Bulk generate embeddings | Yes |
| GET | `/analytics` | Get query analytics | Yes |
| POST | `/llm/completion` | Direct LLM completion | Yes |
| WebSocket | `ws://localhost:3003` | Real-time query streaming | Yes |

#### Key Data Models

```typescript
interface QueryRequest {
  query: string;
  context?: string;
  maxResults?: number;
  includeAnalytics?: boolean;
  sessionId?: string;
  tenantId: string;
}

interface QueryResponse {
  answer: string;
  sources: DocumentSource[];
  confidence: number;
  processingTime: number;
  sessionId: string;
  analytics?: QueryAnalytics;
}

interface DocumentEmbedding {
  id: string;
  content: string;
  embedding: number[];
  metadata: DocumentMetadata;
  tenantId: string;
  createdAt: Date;
}

interface DocumentMetadata {
  source: DocumentSource;
  title: string;
  url?: string;
  lastModified: Date;
  extractionMethod: ExtractionMethod;
  confidence: ConfidenceLevel;
}
```

---

## Communication Protocols

### 1. HTTP/REST Protocol

#### Standard Headers
```http
Content-Type: application/json
x-api-key: {api_key}
x-tenant-id: {tenant_id}
x-correlation-id: {correlation_id}
x-request-id: {request_id}
```

#### Response Format
```json
{
  "success": true,
  "data": {},
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123",
    "processingTime": 150
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "hasNext": true
  }
}
```

#### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "query",
      "value": "",
      "constraint": "Query cannot be empty"
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123"
  }
}
```

### 2. Message Bus Protocol (Azure Service Bus)

#### Message Envelope Structure
```json
{
  "messageId": "msg_123",
  "messageType": "CREATE_ENTITY",
  "source": {
    "serviceId": "atlassian-sync-service",
    "version": "1.0.0",
    "instanceId": "instance_123"
  },
  "correlation": {
    "correlationId": "corr_123",
    "causationId": "cause_123",
    "conversationId": "conv_123"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "tenantId": "tenant_123",
  "payload": {}
}
```

#### Message Types
- `CREATE_ENTITY`: Create a new entity in the knowledge graph
- `UPDATE_ENTITY`: Update an existing entity
- `DELETE_ENTITY`: Delete an entity
- `LINK_ENTITIES`: Create a relationship between entities
- `UNLINK_ENTITIES`: Remove a relationship
- `INDEX_DOCUMENT`: Index a document for search
- `REINDEX_DOCUMENT`: Reindex an existing document
- `QUERY_EXECUTED`: Analytics event for query execution

### 3. WebSocket Protocol (LLM-RAG Service)

#### Connection
```javascript
const ws = new WebSocket('ws://localhost:3003');
ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'auth',
    apiKey: 'your_api_key',
    tenantId: 'your_tenant_id'
  }));
});
```

#### Query Streaming
```javascript
// Send query
ws.send(JSON.stringify({
  type: 'query',
  payload: {
    query: 'What are the current project priorities?',
    sessionId: 'session_123'
  }
}));

// Receive streaming response
ws.on('message', (data) => {
  const message = JSON.parse(data);
  switch (message.type) {
    case 'chunk':
      console.log(message.payload); // Streaming text chunk
      break;
    case 'final':
      console.log(message.payload.sources); // Final sources
      break;
    case 'error':
      console.error(message.message);
      break;
  }
});
```

---

## Data Exchange Formats

### Primary Format: JSON

All services use JSON as the primary data exchange format with the following standards:

#### Naming Conventions
- **camelCase** for property names
- **ISO 8601** for timestamps
- **UUID v4** for identifiers
- **snake_case** for enum values

#### Data Types
```typescript
// Common types used across services
type UUID = string;
type ISO8601 = string;
type TenantId = string;
type ApiKey = string;

// Standardized metadata
interface BaseMetadata {
  createdAt: ISO8601;
  updatedAt: ISO8601;
  createdBy?: string;
  updatedBy?: string;
  version: number;
}

// Tenant isolation
interface TenantScoped {
  tenantId: TenantId;
}
```

#### Schema Validation

All message payloads are validated against JSON Schema definitions stored in `shared-schemas/`:

- `api-schemas.json`: REST API request/response schemas
- `message-schemas.json`: Message bus payload schemas

### Alternative Formats

For high-performance scenarios, the following formats are supported:

- **Protocol Buffers**: For high-throughput message bus communication
- **MessagePack**: For compressed API responses
- **Apache Avro**: For schema evolution in data pipelines

---

## Message Queue Architecture

### Technology Stack

#### Primary: Azure Service Bus
- **Use Case**: High-reliability entity lifecycle events
- **Features**: Dead letter queues, message sessions, duplicate detection
- **Configuration**:
  ```json
  {
    "connectionString": "Endpoint=sb://...",
    "queueName": "cognisync-events",
    "maxDeliveryCount": 3,
    "lockDuration": "PT5M"
  }
  ```

#### Secondary: Redis
- **Use Case**: Real-time notifications, cache invalidation
- **Features**: Pub/Sub, streams, clustering
- **Configuration**:
  ```json
  {
    "host": "localhost",
    "port": 6379,
    "db": 0,
    "keyPrefix": "cognisync:"
  }
  ```

### Event Flow Patterns

#### 1. Entity Lifecycle Events
```
Atlassian Sync → Azure Service Bus → Knowledge Graph Service
                                  → LLM-RAG Service (for indexing)
```

#### 2. Real-time Notifications
```
Any Service → Redis Pub/Sub → Connected Clients
```

#### 3. Cache Invalidation
```
Knowledge Graph → Redis → All Services (cache invalidation)
```

### Message Routing

#### Topic-Based Routing
- `cognisync.entities.created`
- `cognisync.entities.updated`
- `cognisync.entities.deleted`
- `cognisync.relationships.created`
- `cognisync.relationships.deleted`
- `cognisync.documents.indexed`
- `cognisync.queries.executed`

#### Service-Specific Queues
- `atlassian-sync-events`
- `knowledge-graph-events`
- `llm-rag-events`
- `analytics-events`

---

## Security Specifications

### Authentication Methods

#### 1. API Key Authentication
```http
x-api-key: ak_live_1234567890abcdef
```

**Features**:
- Tenant-scoped keys
- Rate limiting per key
- Automatic rotation support
- Audit logging

#### 2. JWT Token Authentication
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token Structure**:
```json
{
  "sub": "user_123",
  "iss": "cognisync-auth",
  "aud": "cognisync-api",
  "exp": 1640995200,
  "iat": 1640908800,
  "tenantId": "tenant_123",
  "scopes": ["read:entities", "write:entities"],
  "roles": ["admin", "user"]
}
```

#### 3. Service-to-Service Authentication
```typescript
// Inter-service client with mTLS
const client = new InterServiceClient({
  serviceId: 'atlassian-sync-service',
  targetService: 'knowledge-graph-service',
  baseURL: 'https://kg-service.internal',
  auth: {
    type: 'mtls',
    cert: './certs/client.crt',
    key: './certs/client.key',
    ca: './certs/ca.crt'
  }
});
```

### Authorization Model

#### Scope-Based Access Control
- `read:entities` - Read entity data
- `write:entities` - Create/update entities
- `delete:entities` - Delete entities
- `read:relationships` - Read relationship data
- `write:relationships` - Create/update relationships
- `read:analytics` - Access analytics data
- `admin:config` - Manage configurations

#### Role-Based Access Control
- **Admin**: Full access to all resources
- **User**: Read/write access to tenant data
- **Viewer**: Read-only access to tenant data
- **Service**: Inter-service communication

### Data Security

#### Encryption
- **In Transit**: TLS 1.3 for all HTTP communication
- **At Rest**: AES-256 encryption for sensitive data
- **Message Bus**: End-to-end encryption for sensitive payloads

#### Tenant Isolation
- Database-level isolation using tenant schemas
- API-level filtering by tenant ID
- Message bus topic isolation by tenant

---

## Error Handling and Monitoring

### Error Classification

#### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Rate Limited
- `500` - Internal Server Error
- `502` - Bad Gateway
- `503` - Service Unavailable

#### Error Codes
```typescript
type ErrorCode = 
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'CIRCUIT_BREAKER_OPEN';
```

### Retry Mechanisms

#### Exponential Backoff
```typescript
const retryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  jitter: true
};
```

#### Circuit Breaker Pattern
```typescript
const circuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000,
  monitoringPeriod: 10000
};
```

### Monitoring and Observability

#### Health Check Endpoints
```typescript
interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  service: string;
  version: string;
  dependencies: {
    database: 'connected' | 'disconnected';
    messageQueue: 'connected' | 'disconnected';
    externalServices: Record<string, 'healthy' | 'unhealthy'>;
  };
  metrics: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}
```

#### Metrics Collection
- **Request Metrics**: Response time, throughput, error rate
- **Business Metrics**: Entities created, queries processed, sync events
- **System Metrics**: Memory usage, CPU usage, database connections

#### Distributed Tracing
```typescript
// Trace headers
const traceHeaders = {
  'x-trace-id': 'trace_123',
  'x-span-id': 'span_456',
  'x-parent-span-id': 'span_789'
};
```

---

## Implementation Guidelines

### Development Standards

#### API Design Principles
1. **RESTful Design**: Use standard HTTP methods and status codes
2. **Idempotency**: POST/PUT operations should be idempotent
3. **Versioning**: Use URL versioning (`/api/v1/`)
4. **Pagination**: Use cursor-based pagination for large datasets
5. **Filtering**: Support query parameters for filtering and sorting

#### Message Design Principles
1. **Immutable Events**: Events should be immutable and append-only
2. **Schema Evolution**: Support backward-compatible schema changes
3. **Correlation**: Include correlation IDs for tracing
4. **Idempotency**: Messages should be idempotent
5. **Ordering**: Use message sessions for ordered processing

### Code Examples

#### Service Client Usage
```typescript
import { createInterServiceClient } from '@cognisync/shared-security';

const kgClient = createInterServiceClient({
  serviceId: 'atlassian-sync-service',
  targetService: 'knowledge-graph-service',
  baseURL: process.env.KG_SERVICE_URL,
  auth: {
    type: 'api-key',
    apiKey: process.env.KG_SERVICE_API_KEY
  }
});

// Create entity
const entity = await kgClient.post('/entities', {
  type: 'Issue',
  name: 'Fix login bug',
  metadata: { jiraId: 'PROJ-123' }
});
```

#### Message Publishing
```typescript
import { createMessageEnvelope, MessageBusService } from '@cognisync/shared-types';

const messageBus = new MessageBusService();

const message = createMessageEnvelope('CREATE_ENTITY', {
  id: 'entity_123',
  type: 'Issue',
  name: 'Fix login bug',
  metadata: { jiraId: 'PROJ-123' }
}, {
  serviceId: 'atlassian-sync-service',
  tenantId: 'tenant_123'
});

await messageBus.publish('cognisync.entities.created', message);
```

### Configuration Management

#### Environment Variables
```bash
# Service Configuration
SERVICE_NAME=atlassian-sync-service
SERVICE_VERSION=1.0.0
PORT=3002

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/cognisync

# Message Queue
AZURE_SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://...
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-jwt-secret
API_KEY_ENCRYPTION_KEY=your-encryption-key

# External Services
KNOWLEDGE_GRAPH_SERVICE_URL=http://localhost:3001
LLM_RAG_SERVICE_URL=http://localhost:3003
```

---

## Testing and Validation

### Contract Testing

#### API Contract Tests
```typescript
import { validateApiContract } from '@cognisync/testing';

describe('Knowledge Graph Service API', () => {
  it('should create entity according to contract', async () => {
    const response = await request(app)
      .post('/api/v1/entities')
      .send({
        type: 'Issue',
        name: 'Test Issue',
        metadata: { source: 'test' }
      });

    expect(response.status).toBe(201);
    await validateApiContract('createEntity', response.body);
  });
});
```

#### Message Contract Tests
```typescript
import { validateMessageContract } from '@cognisync/testing';

describe('Entity Creation Messages', () => {
  it('should publish valid CREATE_ENTITY message', async () => {
    const message = createCreateEntityMessage({
      id: 'test_123',
      type: 'Issue',
      name: 'Test Issue'
    });

    await validateMessageContract('CREATE_ENTITY', message);
  });
});
```

### Integration Testing

#### Service Integration Tests
```typescript
describe('Atlassian Sync → Knowledge Graph Integration', () => {
  it('should create entity when webhook received', async () => {
    // Send webhook to Atlassian Sync Service
    await request(atlassianSyncApp)
      .post('/api/webhook/jira')
      .send(mockJiraWebhook);

    // Verify entity created in Knowledge Graph
    await waitForMessage('CREATE_ENTITY');
    
    const entity = await kgClient.get('/entities/PROJ-123');
    expect(entity.data.name).toBe('Test Issue');
  });
});
```

### Performance Testing

#### Load Testing
```typescript
import { loadTest } from '@cognisync/testing';

describe('API Performance', () => {
  it('should handle 100 concurrent requests', async () => {
    const results = await loadTest({
      url: '/api/v1/entities',
      method: 'GET',
      concurrency: 100,
      duration: '30s'
    });

    expect(results.averageResponseTime).toBeLessThan(500);
    expect(results.errorRate).toBeLessThan(0.01);
  });
});
```

---

## Conclusion

This specification provides a comprehensive foundation for implementing the Phase 2 architecture interfaces and communication protocols. The defined standards ensure:

- **Consistency**: Standardized patterns across all services
- **Scalability**: Event-driven architecture for high throughput
- **Reliability**: Robust error handling and retry mechanisms
- **Security**: Multi-layered security with authentication and authorization
- **Observability**: Comprehensive monitoring and tracing
- **Maintainability**: Clear contracts and documentation

### Implementation Roadmap

1. **Phase 2A**: Implement core API contracts and basic message bus integration
2. **Phase 2B**: Add advanced security features and monitoring
3. **Phase 2C**: Implement performance optimizations and advanced features
4. **Phase 2D**: Add comprehensive testing and validation

### Maintenance and Evolution

This specification should be reviewed and updated regularly to ensure it remains current with the evolving needs of the CogniSync platform. All changes should be backward-compatible and follow the established versioning strategy.

---

*Document Version: 1.0*  
*Last Updated: 2024-01-15*  
*Next Review: 2024-04-15*