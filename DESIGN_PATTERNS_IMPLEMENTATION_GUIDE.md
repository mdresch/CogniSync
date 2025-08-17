# Design Patterns Implementation Guide

## Overview

This guide provides practical implementation instructions for applying the design patterns documented in `DESIGN_PATTERNS_DOCUMENTATION.md` within the CogniSync platform. It includes code templates, best practices, and step-by-step implementation instructions.

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Service Development Patterns](#service-development-patterns)
3. [Message Bus Integration Patterns](#message-bus-integration-patterns)
4. [Authentication and Security Patterns](#authentication-and-security-patterns)
5. [Data Access Patterns](#data-access-patterns)
6. [Error Handling Implementation](#error-handling-implementation)
7. [Testing Patterns](#testing-patterns)
8. [Code Templates](#code-templates)

---

## Quick Reference

### Pattern Decision Tree

```
New Feature Development
├── Is it a new service?
│   ├── Yes → Use Microservices + Layered Architecture
│   └── No → Continue
├── Does it involve inter-service communication?
│   ├── Yes → Use Message Queue + Observer Pattern
│   └── No → Continue
├── Does it require authentication?
│   ├── Yes → Use Authentication Middleware + Strategy Pattern
│   └── No → Continue
├── Does it involve data access?
│   ├── Yes → Use Repository + Unit of Work Pattern
│   └── No → Continue
└── Does it involve complex object creation?
    ├── Yes → Use Factory + Builder Pattern
    └── No → Use appropriate behavioral patterns
```

### Common Pattern Combinations

| Scenario | Primary Patterns | Supporting Patterns |
|----------|------------------|-------------------|
| **New Microservice** | Microservices, Layered Architecture | Repository, Factory, Middleware |
| **API Endpoint** | Facade, Decorator (Middleware) | Strategy (Auth), DTO |
| **Message Processing** | Observer, Command | Factory (Messages), Retry |
| **Data Operations** | Repository, Unit of Work | Factory (Entities), Adapter |
| **External Integration** | Adapter, Circuit Breaker | Retry, Factory |

---

## Service Development Patterns

### 1. Creating a New Microservice

**Template Structure:**
```
new-service/
├── src/
│   ├── controllers/     # Presentation Layer (Facade Pattern)
│   ├── services/        # Business Logic Layer (Service Pattern)
│   ├── repositories/    # Data Access Layer (Repository Pattern)
│   ├── middleware/      # Cross-cutting Concerns (Decorator Pattern)
│   ├── types/          # DTOs and Interfaces
│   ├── utils/          # Utility Functions
│   └── server.ts       # Application Entry Point
├── prisma/             # Database Schema
├── tests/              # Test Files
└── package.json        # Dependencies
```

**Implementation Steps:**

1. **Define Service Interface (Facade Pattern)**
```typescript
// src/services/new-service.service.ts
export class NewService {
  private repository: NewRepository;
  private messageBus: MessageBusService;

  constructor() {
    this.repository = new NewRepository();
    this.messageBus = MessageBusService.getInstance();
  }

  // Public API methods (Facade)
  async processRequest(data: RequestData): Promise<ResponseData> {
    // Orchestrate business logic
    const entity = await this.repository.create(data);
    await this.publishEvent('ENTITY_CREATED', entity);
    return this.mapToResponse(entity);
  }
}
```

2. **Implement Repository Pattern**
```typescript
// src/repositories/new.repository.ts
export class NewRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async create(data: CreateData): Promise<Entity> {
    return await this.prisma.entity.create({
      data: {
        ...data,
        tenantId: data.tenantId || 'default'
      }
    });
  }

  async findById(id: string, tenantId: string): Promise<Entity | null> {
    return await this.prisma.entity.findFirst({
      where: { id, tenantId }
    });
  }
}
```

3. **Add Authentication Middleware**
```typescript
// src/middleware/auth.middleware.ts
import { createAuthMiddleware } from '../../../shared-security/service-auth.middleware';

export const authenticate = createAuthMiddleware({
  serviceId: 'new-service',
  allowedServices: ['atlassian-sync-service', 'knowledge-graph-service'],
  allowApiKeys: true,
  skipPaths: ['/health', '/metrics']
});
```

### 2. Adding New API Endpoints

**Template:**
```typescript
// src/controllers/entity.controller.ts
import { Router } from 'express';
import { authenticate, requireScopes } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { EntityService } from '../services/entity.service';

const router = Router();
const entityService = new EntityService();

// GET endpoint with authentication and authorization
router.get('/entities/:id', 
  authenticate,
  requireScopes(['read']),
  async (req, res, next) => {
    try {
      const entity = await entityService.getById(req.params.id, req.auth.tenantId);
      if (!entity) {
        return res.status(404).json({ error: 'Entity not found' });
      }
      res.json(entity);
    } catch (error) {
      next(error);
    }
  }
);

// POST endpoint with validation
router.post('/entities',
  authenticate,
  requireScopes(['write']),
  validateRequest('CreateEntitySchema'),
  async (req, res, next) => {
    try {
      const entity = await entityService.create(req.body, req.auth.tenantId);
      res.status(201).json(entity);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

---

## Message Bus Integration Patterns

### 1. Publishing Messages (Observer Pattern)

**Factory Pattern for Message Creation:**
```typescript
// src/services/message.factory.ts
import { 
  createCreateEntityMessage, 
  MessageSource, 
  MessageCorrelation 
} from '../../../shared-types/message-bus.types';

export class MessageFactory {
  private source: MessageSource;

  constructor(serviceId: string) {
    this.source = {
      service: serviceId as any,
      version: process.env.SERVICE_VERSION || '1.0.0',
      instanceId: process.env.INSTANCE_ID || 'local'
    };
  }

  createEntityMessage(entity: any, tenantId: string, correlationId?: string) {
    const correlation: MessageCorrelation = {
      correlationId: correlationId || this.generateUUID(),
      causationId: this.generateUUID(),
      tenantId
    };

    return createCreateEntityMessage(entity, this.source, correlation);
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
```

**Service Integration:**
```typescript
// src/services/entity.service.ts
export class EntityService {
  private messageFactory: MessageFactory;
  private messageBus: MessageBusService;

  constructor() {
    this.messageFactory = new MessageFactory('new-service');
    this.messageBus = MessageBusService.getInstance();
  }

  async createEntity(data: CreateEntityData, tenantId: string): Promise<Entity> {
    // Create entity
    const entity = await this.repository.create(data);

    // Publish event
    const message = this.messageFactory.createEntityMessage(entity, tenantId);
    await this.messageBus.sendMessage(message);

    return entity;
  }
}
```

### 2. Consuming Messages (Observer Pattern)

**Message Handler Pattern:**
```typescript
// src/services/message.handler.ts
import { 
  MessageEnvelope, 
  isCreateEntityMessage,
  isLinkEntitiesMessage 
} from '../../../shared-types/message-bus.types';

export class MessageHandler {
  private entityService: EntityService;

  constructor() {
    this.entityService = new EntityService();
  }

  async handleMessage(message: MessageEnvelope): Promise<void> {
    try {
      if (isCreateEntityMessage(message)) {
        await this.handleEntityCreated(message);
      } else if (isLinkEntitiesMessage(message)) {
        await this.handleEntitiesLinked(message);
      } else {
        console.warn(`Unhandled message type: ${message.messageType}`);
      }
    } catch (error) {
      console.error('Message handling failed:', error);
      throw error; // Let the message bus handle retry logic
    }
  }

  private async handleEntityCreated(message: MessageEnvelope<CreateEntityPayload>): Promise<void> {
    const { entity } = message.payload;
    await this.entityService.processExternalEntity(entity, message.correlation.tenantId);
  }
}
```

---

## Authentication and Security Patterns

### 1. Implementing Authentication Strategies

**Strategy Pattern Implementation:**
```typescript
// src/auth/strategies/api-key.strategy.ts
export class ApiKeyStrategy implements AuthStrategy {
  async authenticate(req: Request): Promise<AuthResult> {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header');
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const isValid = await this.validateApiKey(apiKey);
    
    if (!isValid) {
      throw new AuthenticationError('Invalid API key');
    }

    return {
      type: 'apikey',
      apiKey,
      scopes: ['read', 'write'],
      tenantId: await this.getTenantForApiKey(apiKey)
    };
  }
}
```

**Middleware Integration:**
```typescript
// src/middleware/auth.middleware.ts
export function createAuthMiddleware(strategies: AuthStrategy[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let lastError: Error | null = null;

    // Try each strategy (Chain of Responsibility)
    for (const strategy of strategies) {
      try {
        const authResult = await strategy.authenticate(req);
        (req as AuthenticatedRequest).auth = authResult;
        return next();
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    // All strategies failed
    res.status(401).json({ 
      error: 'Authentication failed',
      message: lastError?.message 
    });
  };
}
```

### 2. Authorization Patterns

**Role-Based Access Control:**
```typescript
// src/middleware/authorization.middleware.ts
export function requirePermissions(permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userPermissions = req.auth?.permissions || [];
    
    const hasAllPermissions = permissions.every(permission =>
      userPermissions.includes(permission) || userPermissions.includes('admin')
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permissions,
        available: userPermissions
      });
    }

    next();
  };
}
```

---

## Data Access Patterns

### 1. Repository Pattern with Unit of Work

**Base Repository:**
```typescript
// src/repositories/base.repository.ts
export abstract class BaseRepository<T> {
  protected prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  abstract create(data: Partial<T>): Promise<T>;
  abstract findById(id: string, tenantId: string): Promise<T | null>;
  abstract update(id: string, data: Partial<T>, tenantId: string): Promise<T>;
  abstract delete(id: string, tenantId: string): Promise<void>;
}
```

**Specific Repository:**
```typescript
// src/repositories/entity.repository.ts
export class EntityRepository extends BaseRepository<Entity> {
  async create(data: Partial<Entity>): Promise<Entity> {
    return await this.prisma.entity.create({
      data: {
        ...data,
        id: data.id || this.generateId(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  async findByType(type: string, tenantId: string): Promise<Entity[]> {
    return await this.prisma.entity.findMany({
      where: { type, tenantId }
    });
  }
}
```

**Unit of Work Pattern:**
```typescript
// src/services/unit-of-work.ts
export class UnitOfWork {
  private prisma: PrismaClient;
  private repositories: Map<string, any> = new Map();

  constructor() {
    this.prisma = new PrismaClient();
  }

  getRepository<T>(repositoryClass: new (prisma: PrismaClient) => T): T {
    const key = repositoryClass.name;
    
    if (!this.repositories.has(key)) {
      this.repositories.set(key, new repositoryClass(this.prisma));
    }
    
    return this.repositories.get(key);
  }

  async executeTransaction<T>(operation: (uow: UnitOfWork) => Promise<T>): Promise<T> {
    return await this.prisma.$transaction(async (tx) => {
      // Create new UnitOfWork with transaction client
      const transactionalUow = new UnitOfWork();
      transactionalUow.prisma = tx as PrismaClient;
      
      return await operation(transactionalUow);
    });
  }
}
```

---

## Error Handling Implementation

### 1. Exception Hierarchy

**Base Exception Classes:**
```typescript
// src/errors/base.error.ts
export abstract class BaseError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  abstract readonly isOperational: boolean;

  constructor(message: string, public readonly context?: any) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends BaseError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
  readonly isOperational = true;
}

export class NotFoundError extends BaseError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
  readonly isOperational = true;
}

export class ConflictError extends BaseError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';
  readonly isOperational = true;
}
```

**Error Handler Middleware:**
```typescript
// src/middleware/error.middleware.ts
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error
  console.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body
  });

  // Handle known errors
  if (error instanceof BaseError) {
    return res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { context: error.context })
    });
  }

  // Handle Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json({
      error: 'DATABASE_ERROR',
      message: 'Database operation failed'
    });
  }

  // Default error response
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred'
  });
}
```

### 2. Retry Pattern Implementation

**Retry Decorator:**
```typescript
// src/utils/retry.decorator.ts
export function Retry(maxAttempts: number = 3, delay: number = 1000) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError: Error;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await method.apply(this, args);
        } catch (error) {
          lastError = error;
          
          if (attempt === maxAttempts) {
            throw error;
          }

          // Exponential backoff
          const waitTime = delay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      throw lastError;
    };
  };
}
```

**Usage:**
```typescript
export class ExternalApiService {
  @Retry(3, 1000)
  async callExternalApi(data: any): Promise<any> {
    // This method will be retried up to 3 times with exponential backoff
    const response = await fetch('/external-api', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }

    return response.json();
  }
}
```

---

## Testing Patterns

### 1. Unit Testing with Mocks

**Service Testing:**
```typescript
// tests/services/entity.service.test.ts
import { EntityService } from '../../src/services/entity.service';
import { EntityRepository } from '../../src/repositories/entity.repository';
import { MessageBusService } from '../../src/services/message-bus.service';

jest.mock('../../src/repositories/entity.repository');
jest.mock('../../src/services/message-bus.service');

describe('EntityService', () => {
  let entityService: EntityService;
  let mockRepository: jest.Mocked<EntityRepository>;
  let mockMessageBus: jest.Mocked<MessageBusService>;

  beforeEach(() => {
    mockRepository = new EntityRepository() as jest.Mocked<EntityRepository>;
    mockMessageBus = MessageBusService.getInstance() as jest.Mocked<MessageBusService>;
    entityService = new EntityService();
    
    // Inject mocks
    (entityService as any).repository = mockRepository;
    (entityService as any).messageBus = mockMessageBus;
  });

  describe('createEntity', () => {
    it('should create entity and publish event', async () => {
      // Arrange
      const entityData = { name: 'Test Entity', type: 'DOCUMENT' };
      const createdEntity = { id: '123', ...entityData };
      
      mockRepository.create.mockResolvedValue(createdEntity);
      mockMessageBus.sendMessage.mockResolvedValue();

      // Act
      const result = await entityService.createEntity(entityData, 'tenant-1');

      // Assert
      expect(mockRepository.create).toHaveBeenCalledWith(entityData);
      expect(mockMessageBus.sendMessage).toHaveBeenCalled();
      expect(result).toEqual(createdEntity);
    });
  });
});
```

### 2. Integration Testing

**API Integration Tests:**
```typescript
// tests/integration/entity.api.test.ts
import request from 'supertest';
import { app } from '../../src/server';
import { PrismaClient } from '@prisma/client';

describe('Entity API Integration Tests', () => {
  let prisma: PrismaClient;
  let authToken: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    authToken = 'test-api-key'; // Use test API key
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean database
    await prisma.entity.deleteMany();
  });

  describe('POST /api/entities', () => {
    it('should create a new entity', async () => {
      const entityData = {
        name: 'Test Entity',
        type: 'DOCUMENT',
        description: 'Test description'
      };

      const response = await request(app)
        .post('/api/entities')
        .set('Authorization', `Bearer ${authToken}`)
        .send(entityData)
        .expect(201);

      expect(response.body).toMatchObject({
        name: entityData.name,
        type: entityData.type,
        description: entityData.description
      });

      // Verify in database
      const entity = await prisma.entity.findUnique({
        where: { id: response.body.id }
      });
      expect(entity).toBeTruthy();
    });
  });
});
```

---

## Code Templates

### 1. New Service Template

**package.json:**
```json
{
  "name": "@cognisync/new-service",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "express": "^4.18.0",
    "@prisma/client": "^5.0.0",
    "@azure/service-bus": "^7.9.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "ts-node-dev": "^2.0.0",
    "@types/express": "^4.17.0",
    "jest": "^29.0.0",
    "prisma": "^5.0.0"
  }
}
```

**Server Template:**
```typescript
// src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authenticate } from './middleware/auth.middleware';
import { errorHandler } from './middleware/error.middleware';
import entityRoutes from './controllers/entity.controller';

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', authenticate, entityRoutes);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 New Service running on port ${PORT}`);
});

export { app };
```

### 2. Controller Template

```typescript
// src/controllers/entity.controller.ts
import { Router } from 'express';
import { authenticate, requireScopes } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { EntityService } from '../services/entity.service';
import { CreateEntitySchema, UpdateEntitySchema } from '../schemas/entity.schema';

const router = Router();
const entityService = new EntityService();

// GET /entities
router.get('/entities', 
  requireScopes(['read']),
  async (req, res, next) => {
    try {
      const entities = await entityService.findAll(req.auth.tenantId);
      res.json(entities);
    } catch (error) {
      next(error);
    }
  }
);

// GET /entities/:id
router.get('/entities/:id',
  requireScopes(['read']),
  async (req, res, next) => {
    try {
      const entity = await entityService.findById(req.params.id, req.auth.tenantId);
      if (!entity) {
        return res.status(404).json({ error: 'Entity not found' });
      }
      res.json(entity);
    } catch (error) {
      next(error);
    }
  }
);

// POST /entities
router.post('/entities',
  requireScopes(['write']),
  validateRequest(CreateEntitySchema),
  async (req, res, next) => {
    try {
      const entity = await entityService.create(req.body, req.auth.tenantId);
      res.status(201).json(entity);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /entities/:id
router.put('/entities/:id',
  requireScopes(['write']),
  validateRequest(UpdateEntitySchema),
  async (req, res, next) => {
    try {
      const entity = await entityService.update(req.params.id, req.body, req.auth.tenantId);
      res.json(entity);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /entities/:id
router.delete('/entities/:id',
  requireScopes(['delete']),
  async (req, res, next) => {
    try {
      await entityService.delete(req.params.id, req.auth.tenantId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

---

## Conclusion

This implementation guide provides practical templates and patterns for developing within the CogniSync platform. Follow these patterns to ensure consistency, maintainability, and adherence to the platform's architectural principles.

### Key Takeaways

1. **Consistency**: Use the same patterns across similar implementations
2. **Testing**: Always include comprehensive tests for new patterns
3. **Documentation**: Document any deviations from standard patterns
4. **Security**: Always implement authentication and authorization
5. **Error Handling**: Use structured error handling throughout

### Next Steps

1. Review existing code against these patterns
2. Refactor inconsistent implementations
3. Create automated pattern validation tools
4. Establish code review guidelines based on these patterns

---

*Document Version: 1.0*  
*Last Updated: 2024-01-15*  
*Next Review: 2024-04-15*