# CogniSync Knowledge Graph Service

A standalone microservice for managing knowledge graphs, extracted from the API Management Platform for multi-project reuse.

## Overview

The Knowledge Graph Service provides RESTful APIs for creating, managing, and querying knowledge graphs. It supports entities, relationships, and graph analytics with multi-tenant architecture.

## Features

- **Entity Management**: Create, read, update, delete entities with rich metadata
- **Relationship Management**: Define and manage relationships between entities
- **Graph Analytics**: Calculate graph metrics, density, and insights
- **Multi-tenant Support**: Isolated data per tenant
- **REST API**: Comprehensive RESTful interface
- **Authentication**: API key-based authentication
- **Validation**: Input validation and error handling
- **Bulk Operations**: Batch create entities and relationships
- **Health Monitoring**: Health checks and monitoring endpoints

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 13+ (or SQLite for development)
- Docker (optional)

### Installation

1. **Clone and setup**:
   ```bash
   cd cogni-sync-platform/knowledge-graph-service
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your database settings
   ```

3. **Setup database**:
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

4. **Start the service**:
   ```bash
   npm run dev
   ```

The service will be available at `http://localhost:3001`

### Docker Setup

1. **Using Docker Compose** (recommended for development):
   ```bash
   docker-compose up -d
   ```

2. **Using Docker only**:
   ```bash
   docker build -t knowledge-graph-service .
   docker run -p 3001:3001 knowledge-graph-service
   ```

## API Documentation

### Authentication

All API requests require an API key in the `x-api-key` header:

```bash
curl -H "x-api-key: your-api-key" http://localhost:3001/api/v1/entities
```

#### Development API Key

For development, use the default key: `kg-dev-key-12345`

#### Generating API Keys

In development mode, generate new API keys:

```bash
curl -X POST http://localhost:3001/admin/api-keys \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "your-tenant", "permissions": ["read", "write"]}'
```

### Core Endpoints

#### Health Check
```bash
GET /api/v1/health
```

#### Entities

**Create Entity**:
```bash
POST /api/v1/entities
Content-Type: application/json
x-api-key: your-api-key

{
  "type": "DOCUMENT",
  "name": "API Documentation",
  "description": "Documentation for the Knowledge Graph API",
  "properties": {
    "format": "markdown",
    "version": "1.0"
  },
  "metadata": {
    "confidence": "HIGH",
    "importance": "SIGNIFICANT",
    "source": "manual_entry",
    "extractionMethod": "MANUAL",
    "tags": ["documentation", "api"],
    "aliases": ["docs", "api-docs"]
  }
}
```

**Get Entity**:
```bash
GET /api/v1/entities/{id}
x-api-key: your-api-key
```

**Search Entities**:
```bash
GET /api/v1/entities?search=documentation&entityTypes=DOCUMENT&page=1&limit=50
x-api-key: your-api-key
```

**Update Entity**:
```bash
PUT /api/v1/entities/{id}
Content-Type: application/json
x-api-key: your-api-key

{
  "name": "Updated Name",
  "description": "Updated description"
}
```

**Delete Entity**:
```bash
DELETE /api/v1/entities/{id}
x-api-key: your-api-key
```

#### Relationships

**Create Relationship**:
```bash
POST /api/v1/relationships
Content-Type: application/json
x-api-key: your-api-key

{
  "sourceEntityId": "entity-id-1",
  "targetEntityId": "entity-id-2",
  "type": "REFERENCES",
  "confidence": "HIGH",
  "weight": 0.8,
  "metadata": {
    "source": "manual_entry",
    "extractionMethod": "MANUAL",
    "evidenceCount": 1,
    "isInferred": false
  }
}
```

**Get Entity Relationships**:
```bash
GET /api/v1/entities/{id}/relationships
x-api-key: your-api-key
```

**Get Entity Neighborhood**:
```bash
GET /api/v1/entities/{id}/neighborhood?depth=2
x-api-key: your-api-key
```

#### Analytics

**Get Graph Analytics**:
```bash
GET /api/v1/analytics
x-api-key: your-api-key
```

#### Bulk Operations

**Bulk Create Entities**:
```bash
POST /api/v1/entities/bulk
Content-Type: application/json
x-api-key: your-api-key

{
  "entities": [
    {
      "type": "PERSON",
      "name": "John Doe",
      "metadata": { ... }
    },
    {
      "type": "DOCUMENT",
      "name": "Requirements Doc",
      "metadata": { ... }
    }
  ]
}
```

## Data Types

### Entity Types
- `PERSON` - Individual people
- `DOCUMENT` - Documents and files
- `TASK` - Tasks and work items
- `API` - API definitions
- `ORGANIZATION` - Organizations and companies
- `PROJECT` - Projects
- `CONCEPT` - Abstract concepts
- `TECHNOLOGY` - Technologies and tools
- `REQUIREMENT` - Requirements
- `DECISION` - Decisions
- `RISK` - Risks
- `MILESTONE` - Milestones

### Relationship Types
- `AUTHORED_BY` - Document authored by person
- `ASSIGNED_TO` - Task assigned to person
- `DEPENDS_ON` - Dependency relationship
- `REFERENCES` - Reference relationship
- `IMPLEMENTS` - Implementation relationship
- `MANAGES` - Management relationship
- `PARTICIPATES_IN` - Participation relationship
- `RELATES_TO` - General relationship
- `CONTAINS` - Containment relationship
- `USES` - Usage relationship

### Confidence Levels
- `LOW` - Low confidence
- `MEDIUM` - Medium confidence
- `HIGH` - High confidence
- `CRITICAL` - Critical/Certain

### Importance Levels
- `MINOR` - Minor importance
- `MODERATE` - Moderate importance
- `SIGNIFICANT` - Significant importance
- `CRITICAL` - Critical importance

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `file:./dev.db` |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `API_PREFIX` | API path prefix | `/api/v1` |
| `CORS_ORIGIN` | CORS origin | `*` |
| `TENANT_ISOLATION_ENABLED` | Enable tenant isolation | `true` |
| `RATE_LIMIT_MAX_REQUESTS` | Rate limit max requests | `100` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` |

### Multi-tenancy

The service supports multi-tenant architecture:

1. **API Key Level**: Each API key is associated with a tenant
2. **Data Isolation**: Data is isolated by tenant ID
3. **Schema Isolation**: Optional PostgreSQL schema per tenant

## Development

### Project Structure
```
src/
├── server.ts          # Main server application
├── service.ts         # Core knowledge graph service
├── routes.ts          # API routes
├── auth.ts           # Authentication middleware
├── validation.ts     # Input validation
└── types.ts          # TypeScript types
prisma/
├── schema.prisma     # Database schema
└── migrations/       # Database migrations
```

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production bundle
- `npm start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:reset` - Reset database
- `npm test` - Run tests (when implemented)

### Adding New Entity Types

1. Update `EntityType` in `src/types.ts`
2. Update validation in `src/validation.ts`
3. Add to documentation

### Adding New Relationship Types

1. Update `RelationshipType` in `src/types.ts`
2. Update validation in `src/validation.ts`
3. Add to documentation

## Deployment

### Production Deployment

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Set production environment**:
   ```bash
   export NODE_ENV=production
   export DATABASE_URL=postgresql://user:password@host:5432/database
   ```

3. **Run migrations**:
   ```bash
   npx prisma migrate deploy
   ```

4. **Start the service**:
   ```bash
   npm start
   ```

### Docker Deployment

```bash
docker build -t knowledge-graph-service .
docker run -d \
  -p 3001:3001 \
  -e DATABASE_URL=postgresql://user:password@host:5432/database \
  -e NODE_ENV=production \
  knowledge-graph-service
```

### Kubernetes Deployment

Example Kubernetes manifests:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: knowledge-graph-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: knowledge-graph-service
  template:
    metadata:
      labels:
        app: knowledge-graph-service
    spec:
      containers:
      - name: knowledge-graph-service
        image: knowledge-graph-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
---
apiVersion: v1
kind: Service
metadata:
  name: knowledge-graph-service
spec:
  selector:
    app: knowledge-graph-service
  ports:
  - port: 80
    targetPort: 3001
```

## Monitoring

### Health Checks

The service provides comprehensive health checks:

- **Endpoint**: `GET /api/v1/health`
- **Response**: Service status and database connectivity
- **Docker Health Check**: Automatic container health monitoring

### Metrics

Future enhancements will include:
- Prometheus metrics endpoint
- Request/response metrics
- Business metrics (entities, relationships)
- Performance metrics

## Security

### Authentication
- API key-based authentication
- Configurable key generation
- Permission-based access control

### Authorization
- Role-based permissions (read, write, admin)
- Tenant isolation
- Resource-level access control

### Security Headers
- Helmet.js security headers
- CORS configuration
- Rate limiting
- Request size limits

## Integration Examples

### Python Client
```python
import requests

class KnowledgeGraphClient:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {"x-api-key": api_key}
    
    def create_entity(self, entity_data):
        response = requests.post(
            f"{self.base_url}/api/v1/entities",
            json=entity_data,
            headers=self.headers
        )
        return response.json()

# Usage
client = KnowledgeGraphClient("http://localhost:3001", "your-api-key")
entity = client.create_entity({
    "type": "DOCUMENT",
    "name": "My Document",
    "metadata": { ... }
})
```

### JavaScript/Node.js Client
```javascript
class KnowledgeGraphClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async createEntity(entityData) {
    const response = await fetch(`${this.baseUrl}/api/v1/entities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify(entityData)
    });
    return response.json();
  }
}
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL format
   - Verify database server is running
   - Check network connectivity

2. **Authentication Failed**
   - Verify API key is correct
   - Check x-api-key header is set
   - Ensure API key is active

3. **Validation Errors**
   - Check required fields are present
   - Verify data types match schema
   - Check enum values are valid

### Debugging

1. **Enable debug logging**:
   ```bash
   export LOG_LEVEL=debug
   ```

2. **Check service health**:
   ```bash
   curl http://localhost:3001/api/v1/health
   ```

3. **Verify database schema**:
   ```bash
   npx prisma db push --preview-feature
   ```

## Contributing

### Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Create feature branch: `git checkout -b feature/your-feature`
5. Make changes and test
6. Commit: `git commit -m "Add your feature"`
7. Push: `git push origin feature/your-feature`
8. Create pull request

### Code Style

- TypeScript with strict mode
- ESLint for linting
- Prettier for formatting
- Conventional commits

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation at `/api/v1/docs`
- Review the health check at `/api/v1/health`
