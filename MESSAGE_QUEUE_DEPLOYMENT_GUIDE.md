# Message Queue Deployment Guide

This guide provides step-by-step instructions for deploying and configuring the message queue infrastructure for the CogniSync platform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Azure Service Bus Setup](#azure-service-bus-setup)
3. [Redis Setup](#redis-setup)
4. [Service Configuration](#service-configuration)
5. [Docker Deployment](#docker-deployment)
6. [Kubernetes Deployment](#kubernetes-deployment)
7. [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)

---

## Prerequisites

- Azure subscription (for Azure Service Bus)
- Docker and Docker Compose
- Kubernetes cluster (optional)
- Access to service configuration files

---

## Azure Service Bus Setup

### 1. Create Azure Service Bus Namespace

```bash
# Create resource group
az group create --name cognisync-rg --location eastus

# Create Service Bus namespace
az servicebus namespace create \
  --resource-group cognisync-rg \
  --name cognisync-servicebus \
  --location eastus \
  --sku Standard
```

### 2. Create Topic and Subscriptions

```bash
# Create topic
az servicebus topic create \
  --resource-group cognisync-rg \
  --namespace-name cognisync-servicebus \
  --name cognisync-events

# Create subscription for Knowledge Graph Service
az servicebus topic subscription create \
  --resource-group cognisync-rg \
  --namespace-name cognisync-servicebus \
  --topic-name cognisync-events \
  --name knowledge-graph-subscription

# Create subscription for LLM-RAG Service
az servicebus topic subscription create \
  --resource-group cognisync-rg \
  --namespace-name cognisync-servicebus \
  --topic-name cognisync-events \
  --name llm-rag-subscription
```

### 3. Get Connection String

```bash
# Get connection string
az servicebus namespace authorization-rule keys list \
  --resource-group cognisync-rg \
  --namespace-name cognisync-servicebus \
  --name RootManageSharedAccessKey \
  --query primaryConnectionString \
  --output tsv
```

### 4. Configure Dead Letter Queues

```bash
# Configure DLQ for knowledge-graph subscription
az servicebus topic subscription update \
  --resource-group cognisync-rg \
  --namespace-name cognisync-servicebus \
  --topic-name cognisync-events \
  --name knowledge-graph-subscription \
  --enable-dead-lettering-on-message-expiration true \
  --max-delivery-count 3

# Configure DLQ for llm-rag subscription
az servicebus topic subscription update \
  --resource-group cognisync-rg \
  --namespace-name cognisync-servicebus \
  --topic-name cognisync-events \
  --name llm-rag-subscription \
  --enable-dead-lettering-on-message-expiration true \
  --max-delivery-count 3
```

---

## Redis Setup

### 1. Local Development (Docker)

```yaml
# docker-compose.yml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  redis_data:
```

### 2. Production (Azure Cache for Redis)

```bash
# Create Azure Cache for Redis
az redis create \
  --resource-group cognisync-rg \
  --name cognisync-redis \
  --location eastus \
  --sku Basic \
  --vm-size c0

# Get connection details
az redis show \
  --resource-group cognisync-rg \
  --name cognisync-redis \
  --query [hostName,port,enableNonSslPort] \
  --output table

# Get access keys
az redis list-keys \
  --resource-group cognisync-rg \
  --name cognisync-redis
```

---

## Service Configuration

### Atlassian Sync Service

```bash
# .env
SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://cognisync-servicebus.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=...
SERVICE_BUS_TOPIC_NAME=cognisync-events
```

### Knowledge Graph Service

```bash
# .env
SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://cognisync-servicebus.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=...
SERVICE_BUS_TOPIC_NAME=cognisync-events
SERVICE_BUS_SUBSCRIPTION_NAME=knowledge-graph-subscription
```

### LLM-RAG Service

```bash
# .env
SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://cognisync-servicebus.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=...
SERVICE_BUS_TOPIC_NAME=cognisync-events
SERVICE_BUS_SUBSCRIPTION_NAME=llm-rag-subscription
REDIS_URL=redis://cognisync-redis.redis.cache.windows.net:6380
REDIS_CHANNEL_PREFIX=cognisync
```

---

## Docker Deployment

### 1. Update Docker Compose

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  atlassian-sync:
    build: ./atlassian-sync-service
    environment:
      - SERVICE_BUS_CONNECTION_STRING=${SERVICE_BUS_CONNECTION_STRING}
      - SERVICE_BUS_TOPIC_NAME=cognisync-events
    depends_on:
      - redis

  knowledge-graph:
    build: ./knowledge-graph-service
    environment:
      - SERVICE_BUS_CONNECTION_STRING=${SERVICE_BUS_CONNECTION_STRING}
      - SERVICE_BUS_TOPIC_NAME=cognisync-events
      - SERVICE_BUS_SUBSCRIPTION_NAME=knowledge-graph-subscription
    depends_on:
      - redis

  llm-rag:
    build: ./llm-rag-service
    environment:
      - SERVICE_BUS_CONNECTION_STRING=${SERVICE_BUS_CONNECTION_STRING}
      - SERVICE_BUS_TOPIC_NAME=cognisync-events
      - SERVICE_BUS_SUBSCRIPTION_NAME=llm-rag-subscription
      - REDIS_URL=redis://redis:6379
      - REDIS_CHANNEL_PREFIX=cognisync
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  redis_data:
```

### 2. Environment Variables

```bash
# .env.production
SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://cognisync-servicebus.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=...
```

### 3. Deploy

```bash
# Deploy with production configuration
docker-compose -f docker-compose.production.yml up -d

# Check service health
curl http://localhost:3001/health  # Knowledge Graph
curl http://localhost:3002/health  # Atlassian Sync
curl http://localhost:3003/health  # LLM-RAG
```

---

## Kubernetes Deployment

### 1. Create Secrets

```yaml
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: message-queue-secrets
  namespace: cognisync
type: Opaque
stringData:
  SERVICE_BUS_CONNECTION_STRING: "Endpoint=sb://cognisync-servicebus.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=..."
  REDIS_PASSWORD: "your-redis-password"
```

### 2. Create ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: message-queue-config
  namespace: cognisync
data:
  SERVICE_BUS_TOPIC_NAME: "cognisync-events"
  REDIS_URL: "redis://redis-service:6379"
  REDIS_CHANNEL_PREFIX: "cognisync"
```

### 3. Deploy Redis

```yaml
# redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: cognisync
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        command: ["redis-server", "--appendonly", "yes"]
        volumeMounts:
        - name: redis-data
          mountPath: /data
        livenessProbe:
          exec:
            command: ["redis-cli", "ping"]
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command: ["redis-cli", "ping"]
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: redis-data
        persistentVolumeClaim:
          claimName: redis-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: cognisync
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
```

### 4. Update Service Deployments

```yaml
# atlassian-sync-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: atlassian-sync
  namespace: cognisync
spec:
  template:
    spec:
      containers:
      - name: atlassian-sync
        env:
        - name: SERVICE_BUS_CONNECTION_STRING
          valueFrom:
            secretKeyRef:
              name: message-queue-secrets
              key: SERVICE_BUS_CONNECTION_STRING
        - name: SERVICE_BUS_TOPIC_NAME
          valueFrom:
            configMapKeyRef:
              name: message-queue-config
              key: SERVICE_BUS_TOPIC_NAME
```

### 5. Deploy

```bash
# Apply configurations
kubectl apply -f secrets.yaml
kubectl apply -f configmap.yaml
kubectl apply -f redis-deployment.yaml
kubectl apply -f atlassian-sync-deployment.yaml
kubectl apply -f knowledge-graph-deployment.yaml
kubectl apply -f llm-rag-deployment.yaml

# Check deployment status
kubectl get pods -n cognisync
kubectl logs -f deployment/atlassian-sync -n cognisync
```

---

## Monitoring and Troubleshooting

### 1. Health Checks

```bash
# Check service health endpoints
curl http://localhost:3001/health/detailed  # Knowledge Graph
curl http://localhost:3002/health           # Atlassian Sync
curl http://localhost:3003/health/detailed  # LLM-RAG

# Check message bus status in health response
curl http://localhost:3003/health/detailed | jq '.diagnostics.messageBus'
```

### 2. Azure Service Bus Monitoring

```bash
# Check topic metrics
az monitor metrics list \
  --resource /subscriptions/{subscription-id}/resourceGroups/cognisync-rg/providers/Microsoft.ServiceBus/namespaces/cognisync-servicebus/topics/cognisync-events \
  --metric "Messages" \
  --interval PT1M

# Check subscription metrics
az monitor metrics list \
  --resource /subscriptions/{subscription-id}/resourceGroups/cognisync-rg/providers/Microsoft.ServiceBus/namespaces/cognisync-servicebus/topics/cognisync-events/subscriptions/knowledge-graph-subscription \
  --metric "ActiveMessages,DeadLetteredMessages" \
  --interval PT1M
```

### 3. Redis Monitoring

```bash
# Connect to Redis CLI
redis-cli -h localhost -p 6379

# Check Redis info
INFO replication
INFO memory
INFO clients

# Monitor pub/sub channels
PUBSUB CHANNELS cognisync:*
PUBSUB NUMSUB cognisync:query-results
```

### 4. Common Issues and Solutions

#### Service Bus Connection Issues

```bash
# Check connection string format
echo $SERVICE_BUS_CONNECTION_STRING | grep -o "Endpoint=.*"

# Test connection with Azure CLI
az servicebus namespace show --resource-group cognisync-rg --name cognisync-servicebus
```

#### Redis Connection Issues

```bash
# Test Redis connection
redis-cli -h localhost -p 6379 ping

# Check Redis logs
docker logs redis-container-name
```

#### Message Processing Issues

```bash
# Check dead letter queue
az servicebus topic subscription show \
  --resource-group cognisync-rg \
  --namespace-name cognisync-servicebus \
  --topic-name cognisync-events \
  --name knowledge-graph-subscription \
  --query "deadLetteringOnMessageExpiration"

# View dead letter messages (requires custom script or Service Bus Explorer)
```

### 5. Performance Tuning

#### Service Bus Optimization

```bash
# Increase message prefetch count for better throughput
# Set in service configuration:
# SERVICEBUS_PREFETCH_COUNT=100

# Enable partitioning for high-throughput scenarios
az servicebus topic update \
  --resource-group cognisync-rg \
  --namespace-name cognisync-servicebus \
  --name cognisync-events \
  --enable-partitioning true
```

#### Redis Optimization

```bash
# Configure Redis for persistence and performance
# redis.conf
save 900 1
save 300 10
save 60 10000
maxmemory 2gb
maxmemory-policy allkeys-lru
```

---

## Security Considerations

### 1. Service Bus Security

- Use Managed Identity when possible
- Rotate access keys regularly
- Implement least-privilege access policies
- Enable diagnostic logging

### 2. Redis Security

- Use Redis AUTH for authentication
- Enable TLS encryption for production
- Restrict network access with firewall rules
- Regular security updates

### 3. Network Security

- Use private endpoints for Azure services
- Implement network segmentation
- Monitor network traffic
- Use VPN or ExpressRoute for hybrid connectivity

---

## Backup and Recovery

### 1. Service Bus Backup

- Service Bus metadata is automatically backed up by Azure
- Implement message replay capabilities for data recovery
- Use geo-replication for disaster recovery

### 2. Redis Backup

```bash
# Configure Redis persistence
# In redis.conf:
appendonly yes
appendfsync everysec

# Manual backup
redis-cli --rdb /backup/dump.rdb

# Restore from backup
cp /backup/dump.rdb /data/dump.rdb
systemctl restart redis
```

---

This deployment guide provides comprehensive instructions for setting up and managing the message queue infrastructure for the CogniSync platform. Follow the appropriate sections based on your deployment environment and requirements.