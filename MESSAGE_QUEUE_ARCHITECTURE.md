# CogniSync Platform - Message Queue and Event-Driven Architecture Specification

## Overview

This document specifies the message queues and event-driven mechanisms used for asynchronous communication between microservices in the CogniSync platform. The architecture is designed to ensure scalability, reliability, and efficient event handling across all services.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Message Queue Technologies](#message-queue-technologies)
3. [Event-Driven Communication Patterns](#event-driven-communication-patterns)
4. [Service Integration](#service-integration)
5. [Event Schemas](#event-schemas)
6. [Configuration and Deployment](#configuration-and-deployment)
7. [Monitoring and Observability](#monitoring-and-observability)
8. [Best Practices](#best-practices)

---

## Architecture Overview

The CogniSync platform implements a hybrid messaging architecture that supports both high-throughput enterprise messaging and lightweight pub/sub patterns:

```
┌─────────────────┐    Azure Service Bus    ┌─────────────────┐
│ Atlassian Sync  │ ──────────────────────► │ Knowledge Graph │
│ Service         │                         │ Service         │
└─────────────────┘                         └─────────────────┘
         │                                           │
         │                                           │
         ▼                                           ▼
┌─────────────────┐    Redis Pub/Sub       ┌─────────────────┐
│ Event Bus       │ ◄─────────────────────► │ LLM-RAG Service │
│ (Redis)         │                         │                 │
└─────────────────┘                         └─────────────────┘
```

### Key Design Principles

- **Eventual Consistency**: Services maintain eventual consistency through event-driven updates
- **Fault Tolerance**: Dead letter queues and retry mechanisms for robust error handling
- **Scalability**: Horizontal scaling support through message partitioning and load balancing
- **Observability**: Comprehensive metrics and logging for all message flows

---

## Message Queue Technologies

### 1. Azure Service Bus (Primary)

**Use Cases:**
- High-volume, mission-critical event processing
- Complex routing and filtering requirements
- Enterprise-grade reliability and compliance
- Cross-service entity synchronization

**Features:**
- **Topics and Subscriptions**: Pub/sub pattern with message filtering
- **Dead Letter Queues**: Automatic handling of failed messages
- **Message Sessions**: Ordered message processing
- **Duplicate Detection**: Built-in deduplication capabilities
- **Auto-scaling**: Automatic throughput adjustment

**Configuration:**
```typescript
// Environment Variables
SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://...
SERVICE_BUS_TOPIC_NAME=cognisync-events
SERVICE_BUS_SUBSCRIPTION_NAME=knowledge-graph-subscription
```

**Current Implementation:**
- **Producer**: Atlassian Sync Service
- **Consumer**: Knowledge Graph Service
- **Message Types**: CREATE_ENTITY, LINK_ENTITIES

### 2. Redis (Secondary)

**Use Cases:**
- Lightweight pub/sub messaging
- Real-time notifications
- Caching and session management
- Development and testing environments

**Features:**
- **Pub/Sub Channels**: Simple publish/subscribe messaging
- **Streams**: Persistent message logs with consumer groups
- **High Performance**: In-memory processing for low latency
- **Simple Setup**: Minimal configuration requirements

**Configuration:**
```typescript
// Environment Variables
REDIS_URL=redis://localhost:6379
REDIS_CHANNEL_PREFIX=cognisync
```

**Planned Implementation:**
- **Real-time Updates**: WebSocket notifications
- **Cache Invalidation**: Cross-service cache coordination
- **Development Messaging**: Local development alternative to Service Bus

### 3. Technology Selection Guidelines

| Criteria | Azure Service Bus | Redis |
|----------|------------------|-------|
| **Message Volume** | High (>1000/sec) | Medium (<1000/sec) |
| **Reliability** | Enterprise-grade | Good |
| **Persistence** | Durable | Optional |
| **Ordering** | Guaranteed | Best-effort |
| **Complexity** | High | Low |
| **Cost** | Higher | Lower |
| **Use Case** | Production, Critical | Development, Real-time |

---

## Event-Driven Communication Patterns

### 1. Entity Lifecycle Events

**Pattern**: Domain Event Publishing
**Technology**: Azure Service Bus
**Flow**: Atlassian Sync → Knowledge Graph → LLM-RAG

```typescript
// Event Flow
Webhook Received → Entity Extracted → Event Published → Graph Updated → Embeddings Updated
```

### 2. Real-time Notifications

**Pattern**: Pub/Sub Broadcasting
**Technology**: Redis
**Flow**: Any Service → Redis Channel → WebSocket Clients

```typescript
// Notification Flow
State Change → Event Published → Subscribers Notified → UI Updated
```

### 3. Cache Invalidation

**Pattern**: Cache-Aside with Invalidation Events
**Technology**: Redis
**Flow**: Data Update → Cache Invalidation Event → Cache Cleared

```typescript
// Cache Invalidation Flow
Data Modified → Invalidation Event → Cache Keys Removed → Fresh Data Loaded
```

---

## Service Integration

### Atlassian Sync Service

**Role**: Event Producer
**Technology**: Azure Service Bus
**Responsibilities:**
- Publish CREATE_ENTITY events when new entities are extracted
- Publish LINK_ENTITIES events when relationships are identified
- Handle message publishing failures with retry logic

**Implementation Status**: ✅ Complete

```typescript
// Current Implementation
export class MessageBusService {
  async sendMessage(message: { body: any, messageId?: string }) {
    await this.sender.sendMessages(message);
  }
}
```

### Knowledge Graph Service

**Role**: Event Consumer
**Technology**: Azure Service Bus
**Responsibilities:**
- Consume entity lifecycle events
- Update graph database with new entities and relationships
- Handle message processing failures with DLQ

**Implementation Status**: ✅ Complete

```typescript
// Current Implementation
export class IngestionService {
  private async processMessage(message: ServiceBusReceivedMessage) {
    switch (body.messageType) {
      case 'CREATE_ENTITY':
        await this.graphService.createEntity(body.payload);
        break;
      case 'LINK_ENTITIES':
        await this.graphService.linkEntities(body.payload);
        break;
    }
  }
}
```

### LLM-RAG Service

**Role**: Event Consumer (Planned)
**Technology**: Azure Service Bus + Redis
**Responsibilities:**
- Consume entity events to update embeddings
- Publish real-time query results via Redis
- Handle embedding updates asynchronously

**Implementation Status**: ✅ Complete

```typescript
// Current Implementation
export class MessageBusService {
  async processEntityEvent(message: ServiceBusReceivedMessage) {
    const event: EntityEvent = message.body;
    switch (event.messageType) {
      case 'CREATE_ENTITY':
        await this.handleCreateEntity(event);
        break;
      case 'UPDATE_ENTITY':
        await this.handleUpdateEntity(event);
        break;
      // ... other event types
    }
  }
  
  async publishQueryResult(event: QueryResultEvent) {
    const channel = `${process.env.REDIS_CHANNEL_PREFIX}:query-results`;
    await this.redisClient.publish(channel, JSON.stringify(event));
  }
}
```

---

## Event Schemas

### 1. Entity Lifecycle Events

#### CREATE_ENTITY Event
```typescript
interface CreateEntityEvent {
  messageType: 'CREATE_ENTITY';
  messageId: string;
  timestamp: string;
  tenantId: string;
  payload: {
    entityId: string;
    entityType: 'PERSON' | 'DOCUMENT' | 'PROJECT' | 'ISSUE';
    properties: Record<string, any>;
    source: {
      system: 'jira' | 'confluence';
      id: string;
      url: string;
    };
    metadata: {
      confidence: 'LOW' | 'MEDIUM' | 'HIGH';
      importance: 'MINOR' | 'NORMAL' | 'MAJOR' | 'CRITICAL';
      extractedAt: string;
    };
  };
}
```

#### LINK_ENTITIES Event
```typescript
interface LinkEntitiesEvent {
  messageType: 'LINK_ENTITIES';
  messageId: string;
  timestamp: string;
  tenantId: string;
  payload: {
    relationshipId: string;
    relationshipType: 'AUTHORED_BY' | 'ASSIGNED_TO' | 'RELATED_TO' | 'DEPENDS_ON';
    sourceEntityId: string;
    targetEntityId: string;
    properties: Record<string, any>;
    metadata: {
      confidence: 'LOW' | 'MEDIUM' | 'HIGH';
      strength: number; // 0.0 to 1.0
      extractedAt: string;
    };
  };
}
```

### 2. Real-time Notification Events

#### QUERY_RESULT Event
```typescript
interface QueryResultEvent {
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
```

#### CACHE_INVALIDATION Event
```typescript
interface CacheInvalidationEvent {
  messageType: 'CACHE_INVALIDATION';
  timestamp: string;
  payload: {
    cacheKeys: string[];
    reason: 'DATA_UPDATE' | 'MANUAL' | 'EXPIRATION';
    affectedServices: string[];
  };
}
```

---

## Configuration and Deployment

### Environment Variables

#### Azure Service Bus Configuration
```bash
# Required for all services using Service Bus
SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://cognisync.servicebus.windows.net/;SharedAccessKeyName=...
SERVICE_BUS_TOPIC_NAME=cognisync-events

# Service-specific subscriptions
SERVICE_BUS_SUBSCRIPTION_NAME=knowledge-graph-subscription  # Knowledge Graph Service
SERVICE_BUS_SUBSCRIPTION_NAME=llm-rag-subscription         # LLM-RAG Service
```

#### Redis Configuration
```bash
# Required for all services using Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# Channel configuration
REDIS_CHANNEL_PREFIX=cognisync
REDIS_NOTIFICATION_CHANNEL=notifications
REDIS_CACHE_INVALIDATION_CHANNEL=cache-invalidation
```

### Docker Compose Configuration

```yaml
# Production deployment includes both message queue systems
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  # Azure Service Bus is managed service - no container needed
  # Configure connection strings in environment variables
```

### Kubernetes Deployment

```yaml
# ConfigMap for message queue configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: message-queue-config
data:
  REDIS_URL: "redis://redis-service:6379"
  SERVICE_BUS_TOPIC_NAME: "cognisync-events"
  
---
# Secret for connection strings
apiVersion: v1
kind: Secret
metadata:
  name: message-queue-secrets
type: Opaque
stringData:
  SERVICE_BUS_CONNECTION_STRING: "Endpoint=sb://..."
  REDIS_PASSWORD: "your-redis-password"
```

---

## Monitoring and Observability

### Metrics

#### Azure Service Bus Metrics
```typescript
// Key metrics to monitor
- messages_sent_total
- messages_received_total
- messages_failed_total
- messages_dlq_total
- processing_duration_seconds
- queue_depth
- subscription_backlog
```

#### Redis Metrics
```typescript
// Key metrics to monitor
- redis_connected_clients
- redis_commands_processed_total
- redis_memory_usage_bytes
- redis_pubsub_channels
- redis_pubsub_patterns
```

### Logging

#### Structured Logging Format
```typescript
interface MessageLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  service: string;
  messageId: string;
  messageType: string;
  operation: 'send' | 'receive' | 'process' | 'complete' | 'dlq';
  duration?: number;
  error?: string;
  metadata: Record<string, any>;
}
```

### Health Checks

#### Service Bus Health Check
```typescript
export class ServiceBusHealthCheck {
  async check(): Promise<HealthStatus> {
    try {
      // Test connection and basic operations
      await this.serviceBusClient.getNamespaceProperties();
      return { status: 'healthy', details: { connected: true } };
    } catch (error) {
      return { status: 'unhealthy', details: { error: error.message } };
    }
  }
}
```

#### Redis Health Check
```typescript
export class RedisHealthCheck {
  async check(): Promise<HealthStatus> {
    try {
      const response = await this.redisClient.ping();
      return { status: 'healthy', details: { response } };
    } catch (error) {
      return { status: 'unhealthy', details: { error: error.message } };
    }
  }
}
```

---

## Best Practices

### Message Design

1. **Idempotency**: All message handlers should be idempotent
2. **Versioning**: Include schema version in all messages
3. **Correlation**: Use correlation IDs for tracing message flows
4. **Timeouts**: Set appropriate message TTL and processing timeouts

### Error Handling

1. **Retry Logic**: Implement exponential backoff for transient failures
2. **Dead Letter Queues**: Use DLQs for messages that cannot be processed
3. **Circuit Breakers**: Implement circuit breakers for downstream dependencies
4. **Monitoring**: Alert on high error rates and DLQ accumulation

### Performance Optimization

1. **Batching**: Process messages in batches when possible
2. **Parallel Processing**: Use multiple consumers for high-throughput scenarios
3. **Connection Pooling**: Reuse connections and clients
4. **Message Size**: Keep message payloads small and reference large data

### Security

1. **Authentication**: Use managed identities or secure connection strings
2. **Authorization**: Implement fine-grained access controls
3. **Encryption**: Enable encryption in transit and at rest
4. **Audit Logging**: Log all message operations for compliance

---

## Implementation Roadmap

### Phase 1: Current State (Complete)
- ✅ Azure Service Bus integration for Atlassian Sync → Knowledge Graph
- ✅ Basic Redis setup in Docker Compose
- ✅ Dead letter queue handling

### Phase 2: LLM-RAG Integration (Complete)
- ✅ Add LLM-RAG Service as event consumer
- ✅ Implement embedding update events
- ✅ Add Redis pub/sub for real-time notifications

### Phase 3: Enhanced Observability (Planned)
- 🔄 Comprehensive metrics dashboard
- 🔄 Distributed tracing for message flows
- 🔄 Automated alerting and recovery

### Phase 4: Advanced Features (Future)
- 🔄 Message replay capabilities
- 🔄 Event sourcing patterns
- 🔄 Cross-region replication

---

## Conclusion

The CogniSync platform implements a robust, scalable message queue architecture using Azure Service Bus for enterprise-grade messaging and Redis for lightweight pub/sub scenarios. This hybrid approach provides the flexibility to handle both high-volume, mission-critical events and real-time notifications efficiently.

The architecture supports the platform's requirements for scalability, reliability, and observability while maintaining clear separation of concerns between services. Future enhancements will focus on expanding LLM-RAG Service integration and improving observability across the entire message flow.