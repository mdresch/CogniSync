# CogniSync Production Deployment Guide

This guide provides comprehensive instructions for deploying the CogniSync platform to production environments including Vercel, Azure, AWS, and other cloud providers.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Deployment Options](#deployment-options)
   - [Vercel Deployment](#vercel-deployment)
   - [Azure Deployment](#azure-deployment)
   - [AWS Deployment](#aws-deployment)
   - [Docker/Kubernetes Deployment](#dockerkubernetes-deployment)
6. [Service Configuration](#service-configuration)
7. [Inter-Service Communication](#inter-service-communication)
8. [Monitoring and Health Checks](#monitoring-and-health-checks)
9. [Security Considerations](#security-considerations)
10. [Troubleshooting](#troubleshooting)

## Architecture Overview

CogniSync consists of four main microservices:

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  Atlassian Sync     │    │  Knowledge Graph    │    │  LLM-RAG Service    │
│  Service            │    │  Service            │    │                     │
│  Port: 3002         │◄──►│  Port: 3001         │◄──►│  Port: 3003         │
│                     │    │                     │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
           │                           │                           │
           │                           │                           │
           ▼                           ▼                           ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  PostgreSQL         │    │  PostgreSQL         │    │  PostgreSQL         │
│  (Atlassian Data)   │    │  (Graph Data)       │    │  (RAG Data)         │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
                                       │
                                       ▼
                           ┌─────────────────────┐
                           │  Knowledge Graph    │
                           │  Server (GraphQL)   │
                           │  Port: 4001         │
                           └─────────────────────┘
                                       │
                                       ▼
                           ┌─────────────────────┐
                           │  Neo4j Database     │
                           │  (Graph Storage)    │
                           └─────────────────────┘
```

### External Dependencies

- **OpenAI API**: For LLM and embedding services
- **Pinecone**: Vector database for semantic search
- **Neo4j AuraDB**: Graph database (optional, for advanced graph operations)
- **Azure Service Bus**: Message queue for inter-service communication
- **PostgreSQL**: Primary database for all services

## Prerequisites

### Required Accounts and Services

1. **Cloud Provider Account** (Vercel, Azure, AWS, etc.)
2. **Database Services**:
   - PostgreSQL database (managed service recommended)
   - Neo4j AuraDB account (optional)
3. **External APIs**:
   - OpenAI API key
   - Pinecone account and API key
4. **Message Queue**:
   - Azure Service Bus namespace (or alternative)

### Development Tools

- Node.js 18+
- npm/pnpm
- Docker (for containerized deployment)
- Git

## Environment Configuration

### Global Environment Variables

Create these environment variables for all services:

```bash
# Database Configuration
DATABASE_URL="postgresql://username:password@host:port/database"

# Authentication
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
API_KEY_SALT="your-api-key-salt-change-this-in-production"

# Inter-service Communication
ATLASSIAN_SYNC_URL="https://your-atlassian-sync-service.com"
KNOWLEDGE_GRAPH_URL="https://your-knowledge-graph-service.com"
LLM_RAG_URL="https://your-llm-rag-service.com"
KNOWLEDGE_GRAPH_SERVER_URL="https://your-knowledge-graph-server.com"

# Message Queue
AZURE_SERVICE_BUS_CONNECTION_STRING="your-service-bus-connection-string"

# Security
CORS_ORIGIN="https://your-frontend-domain.com"
NODE_ENV="production"
```

### Service-Specific Environment Variables

#### Atlassian Sync Service
```bash
PORT=3002
VALID_API_KEYS="AS-SYNC-PROD-KEY-1,AS-SYNC-PROD-KEY-2"
KG_SERVICE_URL="https://your-knowledge-graph-service.com/api/v1"
KG_API_KEY="your-kg-api-key"
```

#### Knowledge Graph Service
```bash
PORT=3001
API_PREFIX="/api/v1"
TENANT_ISOLATION_ENABLED=true
DEFAULT_TENANT_ID="default"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### LLM-RAG Service
```bash
PORT=3003
DISABLE_AUTH=false
OPENAI_API_KEY="your-openai-api-key"
OPENAI_ORG_ID="your-openai-org-id"
LLM_MODEL="gpt-4"
EMBEDDING_MODEL="text-embedding-ada-002"
PINECONE_API_KEY="your-pinecone-api-key"
PINECONE_ENVIRONMENT="your-pinecone-environment"
PINECONE_INDEX_NAME="llm-rag-embeddings"
KNOWLEDGE_GRAPH_API_KEY="your-kg-api-key"
```

#### Knowledge Graph Server
```bash
PORT=4001
NEO4J_URI="neo4j+s://your-auradb-instance.databases.neo4j.io"
NEO4J_USERNAME="neo4j"
NEO4J_PASSWORD="your-neo4j-password"
```

## Database Setup

### PostgreSQL Setup

1. **Create Databases**:
   ```sql
   CREATE DATABASE atlassian_sync_prod;
   CREATE DATABASE knowledge_graph_prod;
   CREATE DATABASE llm_rag_prod;
   ```

2. **Run Migrations** for each service:
   ```bash
   # Atlassian Sync Service
   cd atlassian-sync-service
   npx prisma migrate deploy
   
   # Knowledge Graph Service
   cd knowledge-graph-service
   npx prisma migrate deploy
   
   # LLM-RAG Service
   cd llm-rag-service
   npx prisma migrate deploy
   ```

### Neo4j Setup (Optional)

1. Create a Neo4j AuraDB instance
2. Note the connection URI, username, and password
3. Configure the Knowledge Graph Server with these credentials

## Deployment Options

### Vercel Deployment

Vercel is ideal for the API services but requires some configuration for database connections.

#### Prerequisites
- Vercel CLI installed: `npm i -g vercel`
- Vercel account connected to your Git repository

#### Deployment Steps

1. **Prepare each service for Vercel**:

   Create `vercel.json` in each service directory:

   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "dist/server.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "dist/server.js"
       }
     ],
     "env": {
       "NODE_ENV": "production"
     }
   }
   ```

2. **Deploy each service**:

   ```bash
   # Atlassian Sync Service
   cd atlassian-sync-service
   npm run build
   vercel --prod
   
   # Knowledge Graph Service
   cd knowledge-graph-service
   npm run build
   vercel --prod
   
   # LLM-RAG Service
   cd llm-rag-service
   npm run build
   vercel --prod
   
   # Knowledge Graph Server
   cd knowledge-graph-server
   npm run build
   vercel --prod
   ```

3. **Configure Environment Variables** in Vercel dashboard for each service

#### Vercel Limitations
- No persistent file system (use external databases)
- Function timeout limits (consider for long-running operations)
- Cold starts (implement proper health checks)

### Azure Deployment

Azure provides comprehensive services for microservices deployment.

#### Option 1: Azure App Service

1. **Create App Service Plans**:
   ```bash
   az appservice plan create \
     --name cogni-sync-plan \
     --resource-group cogni-sync-rg \
     --sku B1 \
     --is-linux
   ```

2. **Create Web Apps**:
   ```bash
   # Atlassian Sync Service
   az webapp create \
     --resource-group cogni-sync-rg \
     --plan cogni-sync-plan \
     --name cogni-sync-atlassian \
     --runtime "NODE|18-lts"
   
   # Knowledge Graph Service
   az webapp create \
     --resource-group cogni-sync-rg \
     --plan cogni-sync-plan \
     --name cogni-sync-knowledge-graph \
     --runtime "NODE|18-lts"
   
   # LLM-RAG Service
   az webapp create \
     --resource-group cogni-sync-rg \
     --plan cogni-sync-plan \
     --name cogni-sync-llm-rag \
     --runtime "NODE|18-lts"
   
   # Knowledge Graph Server
   az webapp create \
     --resource-group cogni-sync-rg \
     --plan cogni-sync-plan \
     --name cogni-sync-graph-server \
     --runtime "NODE|18-lts"
   ```

3. **Deploy using GitHub Actions**:

   Create `.github/workflows/azure-deploy.yml`:

   ```yaml
   name: Deploy to Azure App Service
   
   on:
     push:
       branches: [ main ]
   
   jobs:
     deploy-atlassian-sync:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v2
         
         - name: Setup Node.js
           uses: actions/setup-node@v2
           with:
             node-version: '18'
             
         - name: Install dependencies
           run: |
             cd atlassian-sync-service
             npm ci
             
         - name: Build application
           run: |
             cd atlassian-sync-service
             npm run build
             
         - name: Deploy to Azure
           uses: azure/webapps-deploy@v2
           with:
             app-name: 'cogni-sync-atlassian'
             publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE_ATLASSIAN }}
             package: './atlassian-sync-service'
   
     # Repeat similar jobs for other services
   ```

#### Option 2: Azure Container Instances

1. **Build and push Docker images**:
   ```bash
   # Build images
   docker build -t cognisync/atlassian-sync:latest ./atlassian-sync-service
   docker build -t cognisync/knowledge-graph:latest ./knowledge-graph-service
   docker build -t cognisync/llm-rag:latest ./llm-rag-service
   docker build -t cognisync/graph-server:latest ./knowledge-graph-server
   
   # Push to Azure Container Registry
   az acr login --name cognisyncregistry
   docker tag cognisync/atlassian-sync:latest cognisyncregistry.azurecr.io/atlassian-sync:latest
   docker push cognisyncregistry.azurecr.io/atlassian-sync:latest
   # Repeat for other images
   ```

2. **Deploy container groups**:
   ```bash
   az container create \
     --resource-group cogni-sync-rg \
     --name cogni-sync-services \
     --image cognisyncregistry.azurecr.io/atlassian-sync:latest \
     --cpu 1 \
     --memory 1.5 \
     --ports 3002 \
     --environment-variables NODE_ENV=production
   ```

### AWS Deployment

#### Option 1: AWS Elastic Beanstalk

1. **Install EB CLI**:
   ```bash
   pip install awsebcli
   ```

2. **Initialize and deploy each service**:
   ```bash
   cd atlassian-sync-service
   eb init
   eb create production
   eb deploy
   ```

#### Option 2: AWS ECS with Fargate

1. **Create task definitions** for each service
2. **Set up Application Load Balancer**
3. **Deploy using ECS services**

### Docker/Kubernetes Deployment

#### Docker Compose (Single Server)

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  atlassian-sync:
    build: ./atlassian-sync-service
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${ATLASSIAN_DATABASE_URL}
    depends_on:
      - postgres
    restart: unless-stopped

  knowledge-graph:
    build: ./knowledge-graph-service
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${KG_DATABASE_URL}
    depends_on:
      - postgres
    restart: unless-stopped

  llm-rag:
    build: ./llm-rag-service
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${RAG_DATABASE_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - PINECONE_API_KEY=${PINECONE_API_KEY}
    depends_on:
      - postgres
    restart: unless-stopped

  graph-server:
    build: ./knowledge-graph-server
    ports:
      - "4001:4001"
    environment:
      - NODE_ENV=production
      - NEO4J_URI=${NEO4J_URI}
      - NEO4J_USERNAME=${NEO4J_USERNAME}
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - atlassian-sync
      - knowledge-graph
      - llm-rag
      - graph-server
    restart: unless-stopped

volumes:
  postgres_data:
```

#### Kubernetes Deployment

Create Kubernetes manifests for each service:

```yaml
# atlassian-sync-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: atlassian-sync
spec:
  replicas: 2
  selector:
    matchLabels:
      app: atlassian-sync
  template:
    metadata:
      labels:
        app: atlassian-sync
    spec:
      containers:
      - name: atlassian-sync
        image: cognisync/atlassian-sync:latest
        ports:
        - containerPort: 3002
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: atlassian-db-url
---
apiVersion: v1
kind: Service
metadata:
  name: atlassian-sync-service
spec:
  selector:
    app: atlassian-sync
  ports:
  - port: 80
    targetPort: 3002
  type: LoadBalancer
```

## Service Configuration

### API Keys and Authentication

1. **Generate secure API keys** for inter-service communication:
   ```bash
   # Generate random API keys
   openssl rand -hex 32
   ```

2. **Configure API keys** in each service's environment variables

3. **Set up JWT secrets** for authentication:
   ```bash
   # Generate JWT secret
   openssl rand -base64 64
   ```

### Rate Limiting

Configure appropriate rate limits for production:

```javascript
// Example rate limiting configuration
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
};
```

## Inter-Service Communication

### Service Discovery

Configure service URLs in environment variables:

```bash
# In Atlassian Sync Service
KNOWLEDGE_GRAPH_URL="https://kg-service.yourdomain.com/api/v1"

# In LLM-RAG Service
KNOWLEDGE_GRAPH_URL="https://kg-service.yourdomain.com/api/v1"
ATLASSIAN_SYNC_URL="https://atlassian-sync.yourdomain.com"
```

### Message Queue Setup

Configure Azure Service Bus or alternative message queue:

```bash
# Azure Service Bus
AZURE_SERVICE_BUS_CONNECTION_STRING="Endpoint=sb://your-namespace.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=your-key"

# Alternative: Redis for simple pub/sub
REDIS_URL="redis://your-redis-instance:6379"
```

## Monitoring and Health Checks

### Health Check Endpoints

Each service provides health check endpoints:

- Atlassian Sync: `GET /health`
- Knowledge Graph: `GET /api/v1/health`
- LLM-RAG: `GET /health`
- Graph Server: `GET /health`

### Monitoring Setup

1. **Application Insights** (Azure):
   ```bash
   npm install applicationinsights
   ```

2. **CloudWatch** (AWS):
   ```bash
   npm install aws-cloudwatch-metrics
   ```

3. **Custom Monitoring**:
   ```javascript
   // Example monitoring middleware
   app.use('/metrics', (req, res) => {
     res.json({
       uptime: process.uptime(),
       memory: process.memoryUsage(),
       timestamp: Date.now()
     });
   });
   ```

### Logging

Configure structured logging for production:

```javascript
// Using Pino logger (already configured in services)
const logger = require('pino')({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty'
  } : undefined
});
```

## Security Considerations

### HTTPS/TLS

1. **Obtain SSL certificates** (Let's Encrypt, CloudFlare, etc.)
2. **Configure HTTPS** in your load balancer or reverse proxy
3. **Redirect HTTP to HTTPS**

### Environment Variables

1. **Never commit secrets** to version control
2. **Use secure secret management**:
   - Azure Key Vault
   - AWS Secrets Manager
   - Kubernetes Secrets

### Network Security

1. **Configure firewalls** to allow only necessary traffic
2. **Use private networks** for inter-service communication
3. **Implement API rate limiting**

### Database Security

1. **Use connection pooling**
2. **Enable SSL for database connections**
3. **Regular security updates**

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Check connection strings
   - Verify network connectivity
   - Check database server status

2. **Service Communication Failures**:
   - Verify service URLs
   - Check API keys
   - Review network policies

3. **Memory/Performance Issues**:
   - Monitor resource usage
   - Implement caching
   - Optimize database queries

### Debugging

1. **Enable debug logging**:
   ```bash
   LOG_LEVEL=debug
   ```

2. **Check service health endpoints**

3. **Monitor application metrics**

### Rollback Strategy

1. **Keep previous deployment artifacts**
2. **Implement blue-green deployment**
3. **Database migration rollback procedures**

## Production Checklist

- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] Health checks configured
- [ ] Monitoring and alerting set up
- [ ] Backup procedures in place
- [ ] Security scanning completed
- [ ] Load testing performed
- [ ] Documentation updated
- [ ] Team trained on deployment procedures

## Support and Maintenance

### Regular Tasks

1. **Security updates** - Monthly
2. **Dependency updates** - Quarterly
3. **Database maintenance** - Weekly
4. **Log rotation** - Daily
5. **Backup verification** - Weekly

### Scaling Considerations

1. **Horizontal scaling** - Add more service instances
2. **Database scaling** - Read replicas, sharding
3. **Caching** - Redis, CDN
4. **Load balancing** - Multiple regions

---

For additional support or questions about deployment, please refer to the individual service README files or contact the development team.