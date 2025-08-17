# CogniSync Shared Architecture Components

This directory contains shared architectural components that implement the enhanced modular and scalable architecture design patterns across all CogniSync services.

## Directory Structure

```
shared-architecture/
├── README.md
├── patterns/                    # Design pattern implementations
│   ├── factory/                # Factory pattern implementations
│   ├── strategy/               # Strategy pattern implementations
│   ├── observer/               # Observer pattern implementations
│   ├── repository/             # Repository pattern implementations
│   └── circuit-breaker/        # Circuit breaker pattern
├── interfaces/                 # Core interfaces and contracts
│   ├── services/               # Service interfaces
│   ├── repositories/           # Repository interfaces
│   └── events/                 # Event interfaces
├── base-classes/               # Abstract base classes
│   ├── services/               # Base service classes
│   ├── controllers/            # Base controller classes
│   └── middleware/             # Base middleware classes
├── dependency-injection/       # DI container implementation
├── caching/                    # Caching strategies and implementations
├── monitoring/                 # Observability and monitoring
└── examples/                   # Usage examples and templates
```

## Core Components

### 1. Design Patterns
- **Factory Pattern**: Service instantiation and configuration
- **Strategy Pattern**: Pluggable algorithms and behaviors
- **Observer Pattern**: Event-driven communication
- **Repository Pattern**: Data access abstraction
- **Circuit Breaker**: Resilience and fault tolerance

### 2. Architectural Interfaces
- Service contracts and interfaces
- Repository abstractions
- Event and messaging interfaces
- Authentication and authorization contracts

### 3. Base Classes
- Abstract service implementations
- Base controller classes with common functionality
- Middleware base classes with standard patterns

### 4. Infrastructure Components
- Dependency injection container
- Caching strategies and implementations
- Monitoring and observability tools
- Configuration management

## Usage

### Installing Shared Architecture

```bash
# In each service directory
npm install --save ../shared-architecture
```

### Basic Service Implementation

```typescript
import { BaseService } from '@cognisync/shared-architecture/base-classes/services';
import { IServiceFactory } from '@cognisync/shared-architecture/interfaces/services';

export class MyService extends BaseService {
  constructor(factory: IServiceFactory) {
    super(factory);
  }
  
  // Service implementation
}
```

### Using Design Patterns

```typescript
import { ServiceFactory } from '@cognisync/shared-architecture/patterns/factory';
import { AuthenticationStrategy } from '@cognisync/shared-architecture/patterns/strategy';

// Factory pattern usage
const factory = new ServiceFactory(config);
const service = factory.createService('my-service');

// Strategy pattern usage
const authStrategy = new JWTAuthenticationStrategy();
authContext.setStrategy(authStrategy);
```

## Contributing

When adding new architectural components:

1. Follow the established patterns and interfaces
2. Include comprehensive TypeScript types
3. Add unit tests for all components
4. Update documentation and examples
5. Ensure backward compatibility

## Documentation

- [Enhanced Modular Architecture Design](../ENHANCED_MODULAR_ARCHITECTURE.md)
- [Design Patterns Guide](./patterns/README.md)
- [Interface Documentation](./interfaces/README.md)
- [Implementation Examples](./examples/README.md)