# Inter-Service Communication Contracts

This document defines the communication patterns, data flows, and integration contracts between the three core microservices in the CogniSync platform.

## Service Overview

### 1. Atlassian Sync Service (Port 3002)
- **Purpose**: Receives webhooks from Atlassian products, processes events, and forwards data to Knowledge Graph Service
- **Role**: Data ingestion and event processing
- **Dependencies**: Knowledge Graph Service

### 2. Knowledge Graph Service (Port 3001)
- **Purpose**: Manages entities, relationships, and graph analytics
- **Role**: Central data store and graph operations
- **Dependencies**: None (core service)

### 3. LLM-RAG Service (Port 3003)
- **Purpose**: Processes queries using RAG, generates embeddings, provides analytics
- **Role**: AI-powered query processing and semantic search
- **Dependencies**: Knowledge Graph Service (for context), External APIs (OpenAI, Pinecone)

## Communication Patterns

### 1. Atlassian Sync → Knowledge Graph Service

#### Data Flow
```
Atlassian Webhook → Atlassian Sync Service → Knowledge Graph Service
```

#### Integration Pattern
- **Type**: HTTP REST API calls
- **Authentication**: API Key (stored in sync configuration)
- **Data Format**: JSON
- **Error Handling**: Retry mechanism with exponential backoff

#### API Calls Made

##### Create Entity
```http
POST /api/v1/entities
Content-Type: application/json
x-api-key: {kgApiKey}

{
  "type": "DOCUMENT",
  "name": "JIRA-123: Bug in authentication",
  "description": "User reported authentication issues...",
  "tenantId": "tenant-123",
  "properties": {
    "issueKey": "JIRA-123",
    "issueType": "Bug",
    "priority": "High",
    "status": "Open",
    "assignee": "john.doe@company.com",
    "reporter": "jane.smith@company.com",
    "project": "AUTH",
    "labels": ["authentication", "security"],
    "components": ["Login", "OAuth"],
    "fixVersions": ["v2.1.0"]
  },
  "metadata": {
    "confidence": "HIGH",
    "importance": "SIGNIFICANT",
    "source": "jira",
    "extractionMethod": "API_IMPORT",
    "tags": ["bug", "authentication", "high-priority"],
    "aliases": ["JIRA-123", "Auth Bug"],
    "externalIds": {
      "jira": "10001",
      "atlassian": "JIRA-123"
    }
  }
}
```

##### Create Relationship
```http
POST /api/v1/relationships
Content-Type: application/json
x-api-key: {kgApiKey}

{
  "sourceEntityId": "user-entity-id",
  "targetEntityId": "issue-entity-id",
  "type": "CREATED_BY",
  "tenantId": "tenant-123",
  "confidence": "HIGH",
  "weight": 1.0,
  "metadata": {
    "source": "jira",
    "extractionMethod": "API_IMPORT",
    "evidenceCount": 1,
    "isInferred": false
  }
}
```

##### Bulk Operations
```http
POST /api/v1/entities/bulk
Content-Type: application/json
x-api-key: {kgApiKey}

{
  "entities": [
    {
      "type": "PERSON",
      "name": "John Doe",
      "tenantId": "tenant-123",
      "properties": {
        "email": "john.doe@company.com",
        "department": "Engineering"
      },
      "metadata": {
        "confidence": "HIGH",
        "importance": "MODERATE",
        "source": "jira",
        "extractionMethod": "API_IMPORT",
        "tags": ["employee", "engineer"],
        "aliases": ["John", "J.Doe"]
      }
    }
  ]
}
```

#### Error Handling
- **Retry Logic**: 3 attempts with exponential backoff (30s, 60s, 120s)
- **Dead Letter Queue**: Failed events moved to dead letter status after max retries
- **Error Codes Handled**:
  - `400`: Validation errors - log and mark as failed
  - `401`: Authentication errors - check API key configuration
  - `409`: Duplicate entity - update existing entity
  - `500`: Server errors - retry with backoff
  - `503`: Service unavailable - retry with backoff

### 2. LLM-RAG Service → Knowledge Graph Service

#### Data Flow
```
User Query → LLM-RAG Service → Knowledge Graph Service (for context) → LLM Processing → Response
```

#### Integration Pattern
- **Type**: HTTP REST API calls
- **Authentication**: API Key
- **Data Format**: JSON
- **Purpose**: Retrieve context entities and relationships for RAG processing

#### API Calls Made

##### Search Entities for Context
```http
GET /api/v1/entities?search={query_keywords}&entityTypes=DOCUMENT,PERSON,PROJECT&limit=10
x-api-key: {ragApiKey}
```

##### Get Entity Relationships
```http
GET /api/v1/entities/{entityId}/relationships
x-api-key: {ragApiKey}
```

##### Get Entity Neighborhood
```http
GET /api/v1/entities/{entityId}/neighborhood?depth=2
x-api-key: {ragApiKey}
```

#### Response Processing
The LLM-RAG service processes Knowledge Graph responses to:
1. Extract relevant context for query processing
2. Build semantic context from entity relationships
3. Enhance query understanding with graph insights

### 3. Client Applications → All Services

#### Authentication Flow
```
Client → API Gateway/Load Balancer → Service (with API Key validation)
```

#### API Key Management
- Each service validates API keys independently
- API keys are tenant-scoped for multi-tenancy
- Keys include permission scopes (read, write)

## Data Mapping and Transformation

### Atlassian to Knowledge Graph Mapping

#### Jira Issue Mapping
```json
{
  "atlassian_field": "knowledge_graph_mapping",
  "issue.key": "properties.issueKey",
  "issue.summary": "name",
  "issue.description": "description",
  "issue.issuetype.name": "properties.issueType",
  "issue.priority.name": "properties.priority",
  "issue.status.name": "properties.status",
  "issue.assignee.emailAddress": "properties.assignee",
  "issue.reporter.emailAddress": "properties.reporter",
  "issue.project.key": "properties.project",
  "issue.labels": "properties.labels",
  "issue.components": "properties.components",
  "issue.fixVersions": "properties.fixVersions"
}
```

#### Confluence Page Mapping
```json
{
  "atlassian_field": "knowledge_graph_mapping",
  "page.id": "properties.pageId",
  "page.title": "name",
  "page.body.storage.value": "description",
  "page.space.key": "properties.spaceKey",
  "page.space.name": "properties.spaceName",
  "page.version.number": "properties.version",
  "page.ancestors": "properties.parentPages",
  "page.metadata.labels": "properties.labels"
}
```

### Entity Type Mapping
```json
{
  "jira_issue": "DOCUMENT",
  "jira_project": "PROJECT",
  "jira_user": "PERSON",
  "jira_component": "CONCEPT",
  "confluence_page": "DOCUMENT",
  "confluence_space": "PROJECT",
  "confluence_user": "PERSON",
  "confluence_label": "CONCEPT"
}
```

### Relationship Type Mapping
```json
{
  "issue_assignee": "ASSIGNED_TO",
  "issue_reporter": "CREATED_BY",
  "issue_component": "PART_OF",
  "issue_project": "PART_OF",
  "page_space": "PART_OF",
  "page_author": "CREATED_BY",
  "page_parent": "PART_OF",
  "user_mentions": "MENTIONS",
  "issue_links": "RELATED_TO"
}
```

## Error Handling Patterns

### Service-to-Service Error Handling

#### 1. Network Errors
```javascript
// Retry with exponential backoff
const retryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2
};

async function callWithRetry(apiCall, config) {
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (attempt === config.maxRetries) throw error;
      
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
        config.maxDelay
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

#### 2. Authentication Errors
```javascript
// Handle API key issues
if (error.status === 401) {
  // Log authentication failure
  logger.error('API key authentication failed', {
    service: 'knowledge-graph',
    configId: syncConfig.id,
    error: error.message
  });
  
  // Mark configuration as invalid
  await markConfigurationInvalid(syncConfig.id, 'Invalid API key');
  
  // Stop processing for this configuration
  return { success: false, error: 'Authentication failed' };
}
```

#### 3. Validation Errors
```javascript
// Handle validation errors
if (error.status === 400) {
  logger.error('Validation error', {
    service: 'knowledge-graph',
    payload: sanitizedPayload,
    error: error.response.data
  });
  
  // Don't retry validation errors
  return { success: false, error: 'Validation failed', retry: false };
}
```

### Circuit Breaker Pattern
```javascript
class ServiceCircuitBreaker {
  constructor(service, options = {}) {
    this.service = service;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
  }

  async call(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.service}`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}
```

## Configuration Management

### Service Discovery
```json
{
  "services": {
    "knowledge-graph": {
      "url": "http://knowledge-graph-service:3001/api/v1",
      "healthCheck": "/health",
      "timeout": 30000,
      "retries": 3
    },
    "llm-rag": {
      "url": "http://llm-rag-service:3003/api",
      "healthCheck": "/health",
      "timeout": 60000,
      "retries": 2
    }
  }
}
```

### Environment-Specific Configuration
```bash
# Development
KNOWLEDGE_GRAPH_SERVICE_URL=http://localhost:3001/api/v1
LLM_RAG_SERVICE_URL=http://localhost:3003/api

# Production
KNOWLEDGE_GRAPH_SERVICE_URL=https://api.cognisync.com/knowledge-graph/api/v1
LLM_RAG_SERVICE_URL=https://api.cognisync.com/llm-rag/api
```

## Monitoring and Observability

### Health Check Endpoints
Each service provides health check endpoints that other services can use:

```http
GET /health - Basic health check
GET /health/detailed - Detailed health with dependencies
GET /health/ready - Kubernetes readiness probe
GET /health/live - Kubernetes liveness probe
```

### Metrics Collection
Services expose metrics for monitoring inter-service communication:

```javascript
// Example metrics
const serviceMetrics = {
  'http_requests_total': 'Counter of HTTP requests',
  'http_request_duration_seconds': 'Histogram of request durations',
  'service_dependency_up': 'Gauge indicating if dependency is up',
  'circuit_breaker_state': 'Gauge indicating circuit breaker state'
};
```

### Distributed Tracing
Each inter-service call includes tracing headers:

```http
X-Trace-Id: 123e4567-e89b-12d3-a456-426614174000
X-Span-Id: 456e7890-e89b-12d3-a456-426614174001
X-Parent-Span-Id: 789e0123-e89b-12d3-a456-426614174002
```

## Security Considerations

### API Key Security
- API keys are stored encrypted in configuration
- Keys are rotated regularly
- Each service validates keys independently
- Failed authentication attempts are logged and monitored

### Network Security
- All inter-service communication uses HTTPS in production
- Services are deployed in private networks
- API gateways handle external traffic
- Rate limiting is applied at multiple levels

### Data Privacy
- Tenant data is isolated at all levels
- PII is handled according to privacy policies
- Audit logs track all data access
- Data retention policies are enforced

## Testing Inter-Service Communication

### Integration Tests
```javascript
describe('Atlassian Sync → Knowledge Graph Integration', () => {
  it('should create entity from Jira webhook', async () => {
    // Mock webhook payload
    const webhookPayload = {
      webhookEvent: 'jira:issue_created',
      issue: {
        key: 'TEST-123',
        fields: {
          summary: 'Test issue',
          description: 'Test description'
        }
      }
    };

    // Send webhook
    const response = await request(atlassianSyncApp)
      .post('/webhooks/test-config-id')
      .send(webhookPayload)
      .expect(202);

    // Verify entity was created in Knowledge Graph
    const entity = await knowledgeGraphService.getEntityByExternalId('TEST-123');
    expect(entity).toBeDefined();
    expect(entity.name).toBe('Test issue');
  });
});
```

### Contract Tests
```javascript
// Pact contract testing
const { Pact } = require('@pact-foundation/pact');

const provider = new Pact({
  consumer: 'atlassian-sync-service',
  provider: 'knowledge-graph-service',
  port: 1234,
  log: path.resolve(process.cwd(), 'logs', 'pact.log'),
  dir: path.resolve(process.cwd(), 'pacts'),
  logLevel: 'INFO'
});

describe('Knowledge Graph API Contract', () => {
  beforeAll(() => provider.setup());
  afterAll(() => provider.finalize());

  it('should create entity', async () => {
    await provider.addInteraction({
      state: 'valid API key provided',
      uponReceiving: 'a request to create an entity',
      withRequest: {
        method: 'POST',
        path: '/api/v1/entities',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'valid-api-key'
        },
        body: {
          type: 'DOCUMENT',
          name: 'Test Entity',
          tenantId: 'test-tenant'
        }
      },
      willRespondWith: {
        status: 201,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          success: true,
          data: {
            id: Matchers.uuid(),
            type: 'DOCUMENT',
            name: 'Test Entity'
          }
        }
      }
    });

    const response = await knowledgeGraphClient.createEntity({
      type: 'DOCUMENT',
      name: 'Test Entity',
      tenantId: 'test-tenant'
    });

    expect(response.success).toBe(true);
  });
});
```

## Deployment Considerations

### Service Dependencies
```yaml
# docker-compose.yml
version: '3.8'
services:
  knowledge-graph-service:
    build: ./knowledge-graph-service
    ports:
      - "3001:3001"
    depends_on:
      - postgres
    
  atlassian-sync-service:
    build: ./atlassian-sync-service
    ports:
      - "3002:3002"
    depends_on:
      - knowledge-graph-service
      - postgres
    
  llm-rag-service:
    build: ./llm-rag-service
    ports:
      - "3003:3003"
    depends_on:
      - knowledge-graph-service
      - postgres
```

### Kubernetes Deployment
```yaml
# Service dependencies in Kubernetes
apiVersion: apps/v1
kind: Deployment
metadata:
  name: atlassian-sync-service
spec:
  template:
    spec:
      initContainers:
      - name: wait-for-kg-service
        image: busybox
        command: ['sh', '-c', 'until nc -z knowledge-graph-service 3001; do sleep 1; done']
      containers:
      - name: atlassian-sync-service
        image: atlassian-sync-service:latest
        env:
        - name: KNOWLEDGE_GRAPH_SERVICE_URL
          value: "http://knowledge-graph-service:3001/api/v1"
```

This document provides a comprehensive overview of how the three microservices communicate, including API contracts, error handling, data mapping, and operational considerations.