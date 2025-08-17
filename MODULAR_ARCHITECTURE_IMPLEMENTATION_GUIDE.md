# CogniSync Platform - Modular Architecture Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the modular architecture defined in the CogniSync Platform Modular Architecture Blueprint. It includes practical examples, code templates, and best practices for developers.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Module Implementation Steps](#module-implementation-steps)
3. [Interface Implementation](#interface-implementation)
4. [Communication Patterns](#communication-patterns)
5. [Testing Strategy](#testing-strategy)
6. [Deployment Guidelines](#deployment-guidelines)
7. [Migration from Current Architecture](#migration-from-current-architecture)
8. [Best Practices](#best-practices)

---

## Getting Started

### Prerequisites

Before implementing the modular architecture, ensure you have:

- Node.js 18+ and TypeScript 4.9+
- Docker and Docker Compose
- Access to required cloud services (Azure, AWS, etc.)
- Understanding of the existing CogniSync codebase

### Development Environment Setup

1. **Clone the repository and install dependencies**:
```bash
git clone <repository-url>
cd cogni-sync-platform
npm install
```

2. **Set up shared components**:
```bash
# Install shared types and security modules
cd shared-types && npm install && npm run build
cd ../shared-security && npm install && npm run build
```

3. **Configure environment variables**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

---

## Module Implementation Steps

### Step 1: Define Module Structure

Create a standardized directory structure for each module:

```
module-name/
├── src/
│   ├── api/              # API layer (controllers, routes)
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── middleware/
│   ├── services/         # Business logic
│   ├── models/           # Data models and schemas
│   ├── interfaces/       # Module interface definitions
│   ├── utils/            # Utility functions
│   └── types/            # TypeScript type definitions
├── tests/
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── e2e/              # End-to-end tests
├── docs/
│   ├── api.md            # API documentation
│   └── README.md
├── package.json
├── tsconfig.json
├── jest.config.js
└── Dockerfile
```

### Step 2: Implement Module Interface

Create the module interface implementation:

```typescript
// src/interfaces/IModuleName.ts
import { IModuleNameInterface } from '../../../shared-types/module-interfaces';

export class ModuleNameService implements IModuleNameInterface {
  constructor(
    private readonly dataStorage: IDataStorageModule,
    private readonly security: ISecurityModule,
    private readonly eventBus: IEventBusModule,
    private readonly monitoring: IMonitoringModule
  ) {}

  async methodName(request: RequestType): Promise<ResponseType> {
    const span = this.monitoring.startTrace('ModuleName.methodName');
    
    try {
      // Validate input
      await this.validateInput(request);
      
      // Check permissions
      await this.security.checkPermission(request.user, 'resource', 'action');
      
      // Business logic
      const result = await this.executeBusinessLogic(request);
      
      // Emit event
      await this.eventBus.publish('module.event', {
        messageType: 'EVENT_TYPE',
        payload: result,
        tenantId: request.tenantId
      });
      
      this.monitoring.recordMetric('module.method.success', 1);
      return result;
      
    } catch (error) {
      this.monitoring.recordMetric('module.method.error', 1);
      throw error;
    } finally {
      this.monitoring.finishTrace(span);
    }
  }
}
```

### Step 3: Create API Layer

Implement the REST API controllers:

```typescript
// src/api/controllers/ModuleController.ts
import { Request, Response } from 'express';
import { ModuleNameService } from '../services/ModuleNameService';
import { createSuccessResponse, createErrorResponse } from '../../../shared-types/api.types';

export class ModuleController {
  constructor(private readonly moduleService: ModuleNameService) {}

  async handleRequest(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.moduleService.methodName(req.body);
      res.json(createSuccessResponse(result));
    } catch (error) {
      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        error.message
      ));
    }
  }
}
```

### Step 4: Set Up Dependency Injection

Create a dependency injection container:

```typescript
// src/container.ts
import { Container } from 'inversify';
import { ModuleNameService } from './services/ModuleNameService';
import { SecurityModule } from '../../shared-security';
import { EventBusModule } from './services/EventBusModule';

const container = new Container();

// Bind interfaces to implementations
container.bind<IModuleNameInterface>('ModuleNameService').to(ModuleNameService);
container.bind<ISecurityModule>('SecurityModule').to(SecurityModule);
container.bind<IEventBusModule>('EventBusModule').to(EventBusModule);

export { container };
```

---

## Interface Implementation

### Creating Type-Safe Interfaces

1. **Define the interface contract**:
```typescript
// shared-types/interfaces/IKnowledgeGraphModule.ts
export interface IKnowledgeGraphModule {
  createEntity(request: CreateEntityRequest): Promise<Entity>;
  updateEntity(entityId: string, updates: UpdateEntityRequest): Promise<Entity>;
  deleteEntity(entityId: string): Promise<void>;
  // ... other methods
}
```

2. **Implement the interface**:
```typescript
// knowledge-graph-service/src/services/KnowledgeGraphService.ts
import { IKnowledgeGraphModule } from '../../../shared-types/interfaces';

export class KnowledgeGraphService implements IKnowledgeGraphModule {
  async createEntity(request: CreateEntityRequest): Promise<Entity> {
    // Implementation
  }
  
  // ... implement all interface methods
}
```

3. **Add validation and error handling**:
```typescript
async createEntity(request: CreateEntityRequest): Promise<Entity> {
  // Input validation
  const validationResult = await this.validateCreateEntityRequest(request);
  if (!validationResult.isValid) {
    throw new ValidationError(validationResult.errors);
  }
  
  // Business logic
  try {
    const entity = await this.dataStorage.executeQuery({
      sql: 'INSERT INTO entities ...',
      parameters: [request.name, request.type, request.tenantId],
      database: 'knowledge-graph'
    });
    
    return entity;
  } catch (error) {
    this.monitoring.recordMetric('entity.create.error', 1);
    throw new DatabaseError('Failed to create entity', error);
  }
}
```

---

## Communication Patterns

### Synchronous Communication (HTTP/REST)

1. **Set up HTTP client**:
```typescript
// shared-components/http-client.ts
import axios, { AxiosInstance } from 'axios';
import { ISecurityModule } from '../shared-security';

export class HttpClient {
  private client: AxiosInstance;
  
  constructor(
    private readonly baseURL: string,
    private readonly security: ISecurityModule
  ) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    this.setupInterceptors();
  }
  
  private setupInterceptors(): void {
    // Request interceptor for authentication
    this.client.interceptors.request.use(async (config) => {
      const token = await this.security.generateJWT({
        service: 'module-name',
        scopes: ['read', 'write']
      });
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    
    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.handleHttpError(error);
        return Promise.reject(error);
      }
    );
  }
}
```

2. **Implement service client**:
```typescript
// src/clients/KnowledgeGraphClient.ts
export class KnowledgeGraphClient {
  constructor(private readonly httpClient: HttpClient) {}
  
  async createEntity(request: CreateEntityRequest): Promise<Entity> {
    const response = await this.httpClient.post('/entities', request);
    return response.data.data;
  }
  
  async getEntity(entityId: string): Promise<Entity> {
    const response = await this.httpClient.get(`/entities/${entityId}`);
    return response.data.data;
  }
}
```

### Asynchronous Communication (Message Bus)

1. **Set up message publisher**:
```typescript
// src/services/MessagePublisher.ts
export class MessagePublisher {
  constructor(private readonly eventBus: IEventBusModule) {}
  
  async publishEntityCreated(entity: Entity): Promise<void> {
    await this.eventBus.publish('entity.created', {
      messageId: generateUUID(),
      messageType: 'CREATE_ENTITY',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      source: {
        service: 'knowledge-graph-service',
        version: '1.0.0'
      },
      tenantId: entity.tenantId,
      payload: {
        id: entity.id,
        type: entity.type,
        name: entity.name,
        properties: entity.properties
      }
    });
  }
}
```

2. **Set up message subscriber**:
```typescript
// src/services/MessageSubscriber.ts
export class MessageSubscriber {
  constructor(
    private readonly eventBus: IEventBusModule,
    private readonly llmRagService: ILLMRAGModule
  ) {}
  
  async initialize(): Promise<void> {
    await this.eventBus.subscribe(
      'entity.created',
      this.handleEntityCreated.bind(this),
      {
        maxRetries: 3,
        retryDelay: 1000
      }
    );
  }
  
  private async handleEntityCreated(message: MessageEnvelope): Promise<MessageHandlerResult> {
    try {
      const entity = message.payload as CreateEntityPayload;
      
      // Process the entity for indexing
      await this.llmRagService.indexDocument({
        id: entity.id,
        title: entity.name,
        content: JSON.stringify(entity.properties),
        tenantId: message.tenantId
      });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        retry: true,
        delayMs: 5000
      };
    }
  }
}
```

---

## Testing Strategy

### Unit Testing

1. **Test module interfaces**:
```typescript
// tests/unit/services/KnowledgeGraphService.test.ts
import { KnowledgeGraphService } from '../../../src/services/KnowledgeGraphService';
import { createMockDataStorage, createMockSecurity } from '../../mocks';

describe('KnowledgeGraphService', () => {
  let service: KnowledgeGraphService;
  let mockDataStorage: jest.Mocked<IDataStorageModule>;
  let mockSecurity: jest.Mocked<ISecurityModule>;
  
  beforeEach(() => {
    mockDataStorage = createMockDataStorage();
    mockSecurity = createMockSecurity();
    service = new KnowledgeGraphService(mockDataStorage, mockSecurity);
  });
  
  describe('createEntity', () => {
    it('should create entity successfully', async () => {
      // Arrange
      const request: CreateEntityRequest = {
        type: 'DOCUMENT',
        name: 'Test Entity',
        properties: { key: 'value' },
        tenantId: 'tenant-123'
      };
      
      mockDataStorage.executeQuery.mockResolvedValue({
        data: [{ id: 'entity-123', ...request }],
        rowCount: 1,
        executionTime: 100
      });
      
      // Act
      const result = await service.createEntity(request);
      
      // Assert
      expect(result.id).toBe('entity-123');
      expect(result.name).toBe('Test Entity');
      expect(mockDataStorage.executeQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining('INSERT INTO entities'),
          parameters: expect.arrayContaining([request.name, request.type])
        })
      );
    });
    
    it('should handle validation errors', async () => {
      // Arrange
      const invalidRequest = { name: '', type: 'INVALID' } as CreateEntityRequest;
      
      // Act & Assert
      await expect(service.createEntity(invalidRequest))
        .rejects.toThrow(ValidationError);
    });
  });
});
```

### Integration Testing

1. **Test module interactions**:
```typescript
// tests/integration/KnowledgeGraphIntegration.test.ts
import { TestContainer } from '../helpers/TestContainer';
import { KnowledgeGraphService } from '../../src/services/KnowledgeGraphService';

describe('Knowledge Graph Integration', () => {
  let container: TestContainer;
  let knowledgeGraphService: KnowledgeGraphService;
  
  beforeAll(async () => {
    container = new TestContainer();
    await container.initialize();
    knowledgeGraphService = container.get<KnowledgeGraphService>('KnowledgeGraphService');
  });
  
  afterAll(async () => {
    await container.cleanup();
  });
  
  it('should create entity and publish event', async () => {
    // Arrange
    const request: CreateEntityRequest = {
      type: 'DOCUMENT',
      name: 'Integration Test Entity',
      properties: { source: 'test' },
      tenantId: 'test-tenant'
    };
    
    // Act
    const entity = await knowledgeGraphService.createEntity(request);
    
    // Assert
    expect(entity.id).toBeDefined();
    
    // Verify event was published
    const publishedEvents = await container.getPublishedEvents();
    expect(publishedEvents).toHaveLength(1);
    expect(publishedEvents[0].messageType).toBe('CREATE_ENTITY');
  });
});
```

### End-to-End Testing

1. **Test complete workflows**:
```typescript
// tests/e2e/AtlassianSyncWorkflow.test.ts
import { TestHarness } from '../helpers/TestHarness';

describe('Atlassian Sync Workflow', () => {
  let testHarness: TestHarness;
  
  beforeAll(async () => {
    testHarness = new TestHarness();
    await testHarness.startServices();
  });
  
  afterAll(async () => {
    await testHarness.stopServices();
  });
  
  it('should process webhook and create knowledge graph entities', async () => {
    // Arrange
    const webhookPayload = {
      webhookEvent: 'jira:issue_created',
      issue: {
        id: '10001',
        key: 'TEST-1',
        fields: {
          summary: 'Test Issue',
          description: 'Test Description'
        }
      }
    };
    
    // Act
    const response = await testHarness.sendWebhook('/webhooks/config-123', webhookPayload);
    
    // Assert
    expect(response.status).toBe(202);
    
    // Wait for processing
    await testHarness.waitForProcessing();
    
    // Verify entity was created in knowledge graph
    const entities = await testHarness.knowledgeGraphClient.searchEntities({
      query: 'TEST-1',
      type: 'ISSUE'
    });
    
    expect(entities.results).toHaveLength(1);
    expect(entities.results[0].name).toBe('Test Issue');
  });
});
```

---

## Deployment Guidelines

### Docker Configuration

1. **Create Dockerfile for each module**:
```dockerfile
# knowledge-graph-service/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY shared-types/ ./shared-types/

# Build the application
RUN npm run build

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["npm", "start"]
```

2. **Update docker-compose.yml**:
```yaml
version: '3.8'

services:
  knowledge-graph:
    build: ./knowledge-graph-service
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${KG_DATABASE_URL}
      - API_KEYS=${KG_API_KEYS}
    depends_on:
      - postgres
      - redis
    networks:
      - cogni-sync-network
    
  atlassian-sync:
    build: ./atlassian-sync-service
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${AS_DATABASE_URL}
      - KG_SERVICE_URL=http://knowledge-graph:3001
    depends_on:
      - knowledge-graph
    networks:
      - cogni-sync-network

networks:
  cogni-sync-network:
    driver: bridge
```

### Kubernetes Deployment

1. **Create deployment manifests**:
```yaml
# kubernetes/knowledge-graph-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: knowledge-graph
  namespace: cogni-sync
spec:
  replicas: 3
  selector:
    matchLabels:
      app: knowledge-graph
  template:
    metadata:
      labels:
        app: knowledge-graph
    spec:
      containers:
      - name: knowledge-graph
        image: cognisync/knowledge-graph:latest
        ports:
        - containerPort: 3001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: cogni-sync-secrets
              key: kg-database-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

---

## Migration from Current Architecture

### Phase 1: Preparation (Week 1)

1. **Install shared components**:
```bash
# In each service directory
npm install ../shared-types ../shared-security
```

2. **Update TypeScript configurations**:
```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@shared/types": ["../shared-types/src"],
      "@shared/security": ["../shared-security/src"]
    }
  }
}
```

3. **Create interface implementations**:
```typescript
// Create wrapper classes for existing services
export class LegacyKnowledgeGraphService implements IKnowledgeGraphModule {
  constructor(private readonly legacyService: any) {}
  
  async createEntity(request: CreateEntityRequest): Promise<Entity> {
    // Adapt legacy service calls to new interface
    return this.legacyService.createEntity(request);
  }
}
```

### Phase 2: Gradual Migration (Weeks 2-4)

1. **Migrate one module at a time**:
   - Start with the least dependent module
   - Update interfaces and implementations
   - Add comprehensive testing
   - Deploy and monitor

2. **Update inter-service communication**:
```typescript
// Replace direct HTTP calls with client interfaces
// Before:
const response = await axios.post('http://kg-service/entities', data);

// After:
const entity = await this.knowledgeGraphClient.createEntity(data);
```

3. **Implement event-driven communication**:
```typescript
// Replace synchronous calls with events where appropriate
// Before:
await this.updateSearchIndex(entity);

// After:
await this.eventBus.publish('entity.created', {
  messageType: 'CREATE_ENTITY',
  payload: entity
});
```

### Phase 3: Optimization (Weeks 5-6)

1. **Performance optimization**:
   - Add caching layers
   - Optimize database queries
   - Implement connection pooling

2. **Monitoring and observability**:
   - Add distributed tracing
   - Set up alerting
   - Create dashboards

3. **Security hardening**:
   - Implement proper authentication
   - Add rate limiting
   - Security audit

---

## Best Practices

### Code Organization

1. **Follow consistent naming conventions**:
```typescript
// Interfaces: I + PascalCase
interface IKnowledgeGraphModule {}

// Classes: PascalCase
class KnowledgeGraphService {}

// Methods: camelCase
async createEntity() {}

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
```

2. **Use dependency injection**:
```typescript
// Good: Dependencies injected through constructor
class ServiceA {
  constructor(
    private readonly serviceB: IServiceB,
    private readonly config: IConfiguration
  ) {}
}

// Avoid: Direct instantiation
class ServiceA {
  private serviceB = new ServiceB(); // Don't do this
}
```

### Error Handling

1. **Use structured error types**:
```typescript
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class BusinessLogicError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'BusinessLogicError';
  }
}
```

2. **Implement proper error boundaries**:
```typescript
async function handleRequest(req: Request, res: Response): Promise<void> {
  try {
    const result = await service.processRequest(req.body);
    res.json(createSuccessResponse(result));
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json(createErrorResponse('VALIDATION_ERROR', error.message));
    } else if (error instanceof BusinessLogicError) {
      res.status(422).json(createErrorResponse(error.code, error.message));
    } else {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  }
}
```

### Performance Optimization

1. **Implement caching strategies**:
```typescript
export class CachedKnowledgeGraphService implements IKnowledgeGraphModule {
  constructor(
    private readonly baseService: IKnowledgeGraphModule,
    private readonly cache: ICacheService
  ) {}
  
  async getEntity(entityId: string): Promise<Entity> {
    const cacheKey = `entity:${entityId}`;
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const entity = await this.baseService.getEntity(entityId);
    await this.cache.set(cacheKey, entity, { ttl: 300 }); // 5 minutes
    
    return entity;
  }
}
```

2. **Use connection pooling**:
```typescript
export class DatabaseService {
  private pool: Pool;
  
  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      connectionString: config.url,
      max: 20, // Maximum number of connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });
  }
}
```

### Security Best Practices

1. **Validate all inputs**:
```typescript
import Joi from 'joi';

const createEntitySchema = Joi.object({
  type: Joi.string().valid('DOCUMENT', 'ISSUE', 'USER').required(),
  name: Joi.string().min(1).max(255).required(),
  properties: Joi.object().required(),
  tenantId: Joi.string().uuid().required()
});

async function validateCreateEntityRequest(request: any): Promise<CreateEntityRequest> {
  const { error, value } = createEntitySchema.validate(request);
  if (error) {
    throw new ValidationError(error.details[0].message, error.details[0].path[0], request);
  }
  return value;
}
```

2. **Implement proper authentication**:
```typescript
export async function authenticateRequest(req: Request): Promise<User> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid authorization header');
  }
  
  const token = authHeader.substring(7);
  const validation = await securityModule.validateJWT(token);
  
  if (!validation.isValid) {
    throw new AuthenticationError('Invalid token');
  }
  
  return validation.payload;
}
```

---

## Conclusion

This implementation guide provides a comprehensive approach to implementing the modular architecture for the CogniSync platform. By following these guidelines, you can ensure:

- **Consistent implementation** across all modules
- **Type safety** through well-defined interfaces
- **Robust error handling** and validation
- **Comprehensive testing** at all levels
- **Scalable deployment** strategies
- **Security best practices** throughout

Remember to implement changes incrementally, test thoroughly, and monitor performance throughout the migration process.

---

*Document Version: 1.0*  
*Last Updated: 2024-01-15*  
*Next Review: 2024-04-15*