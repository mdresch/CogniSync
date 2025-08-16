# CogniSync Quick Start Deployment Guide

This is a simplified guide to get CogniSync running in production quickly. For detailed instructions, see [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md).

## 🚀 Quick Deploy with Docker (Recommended)

### Prerequisites
- Docker and Docker Compose installed
- Domain name with SSL certificate (optional for local testing)

### 1. Clone and Configure

```bash
git clone <your-repo-url>
cd cogni-sync-platform

# Copy and configure environment
cp .env.production.example .env.production
# Edit .env.production with your actual values
```

### 2. Required Environment Variables

Update `.env.production` with these essential values:

```bash
# Database
POSTGRES_PASSWORD=your-secure-password

# Security
JWT_SECRET=your-64-char-jwt-secret
API_KEY_SALT=your-32-char-salt

# API Keys
ATLASSIAN_SYNC_API_KEYS=your-api-key-1,your-api-key-2
KG_API_KEY=your-kg-api-key

# External Services
OPENAI_API_KEY=sk-your-openai-key
PINECONE_API_KEY=your-pinecone-key
PINECONE_ENVIRONMENT=your-pinecone-env
PINECONE_INDEX_NAME=your-index-name

# Domain
CORS_ORIGIN=https://your-domain.com
```

### 3. Deploy

```bash
# Make deployment script executable
chmod +x deploy.sh

# Deploy with Docker
./deploy.sh docker production
```

### 4. Verify Deployment

Check service health:
```bash
curl http://localhost:3002/health  # Atlassian Sync
curl http://localhost:3001/api/v1/health  # Knowledge Graph
curl http://localhost:3003/health  # LLM-RAG
curl http://localhost:4001/health  # Graph Server
```

## 🌐 Quick Deploy to Vercel

### Prerequisites
- Vercel account and CLI installed
- External PostgreSQL database (Vercel doesn't provide persistent storage)

### 1. Install Vercel CLI
```bash
npm i -g vercel
vercel login
```

### 2. Deploy Services
```bash
cd vercel
chmod +x deploy-vercel.sh
./deploy-vercel.sh
```

### 3. Configure Environment Variables
In Vercel dashboard, add environment variables for each service:
- Database URLs (external PostgreSQL)
- API keys and secrets
- External service credentials

## ☁️ Quick Deploy to Azure

### Prerequisites
- Azure account and CLI installed
- Resource group created

### 1. Login to Azure
```bash
az login
az account set --subscription "your-subscription-id"
```

### 2. Create Resource Group
```bash
az group create --name cogni-sync-rg --location eastus
```

### 3. Deploy with Container Instances
```bash
# Build and push images to Azure Container Registry
az acr create --resource-group cogni-sync-rg --name cognisyncregistry --sku Basic
az acr login --name cognisyncregistry

# Build and push images
docker build -t cognisyncregistry.azurecr.io/atlassian-sync:latest ./atlassian-sync-service
docker push cognisyncregistry.azurecr.io/atlassian-sync:latest

# Deploy container group
az container create \
  --resource-group cogni-sync-rg \
  --name cogni-sync-services \
  --image cognisyncregistry.azurecr.io/atlassian-sync:latest \
  --cpu 1 --memory 1.5 --ports 3002
```

## 🔧 Quick Deploy to Kubernetes

### Prerequisites
- Kubernetes cluster access
- kubectl configured

### 1. Deploy to Kubernetes
```bash
cd kubernetes
chmod +x deploy.sh

# Update secrets.yaml with real values first!
./deploy.sh
```

### 2. Access Services
```bash
# Port forwarding for testing
kubectl port-forward -n cogni-sync service/atlassian-sync 3002:3002
kubectl port-forward -n cogni-sync service/knowledge-graph 3001:3001
kubectl port-forward -n cogni-sync service/llm-rag 3003:3003
```

## 🔐 Essential Security Setup

### 1. Generate Secure Keys
```bash
# JWT Secret (64 characters)
openssl rand -base64 64

# API Key Salt (32 characters)
openssl rand -hex 32

# API Keys
openssl rand -hex 32
```

### 2. SSL/TLS Setup
- Obtain SSL certificates (Let's Encrypt, CloudFlare, etc.)
- Configure HTTPS in your load balancer
- Update CORS_ORIGIN with HTTPS URLs

### 3. Database Security
- Use strong passwords
- Enable SSL connections
- Restrict network access

## 📊 Quick Monitoring Setup

### Health Check URLs
- Atlassian Sync: `GET /health`
- Knowledge Graph: `GET /api/v1/health`
- LLM-RAG: `GET /health`
- Graph Server: `GET /health`

### Basic Monitoring Script
```bash
#!/bin/bash
services=("localhost:3002/health" "localhost:3001/api/v1/health" "localhost:3003/health" "localhost:4001/health")
for service in "${services[@]}"; do
  if curl -f "http://$service" &> /dev/null; then
    echo "✓ $service is healthy"
  else
    echo "✗ $service is down"
  fi
done
```

## 🚨 Common Issues & Solutions

### Database Connection Issues
```bash
# Check database connectivity
docker exec -it cogni-sync-postgres psql -U cogni_sync -d cogni_sync -c "SELECT 1;"
```

### Service Communication Issues
```bash
# Check service logs
docker logs cogni-sync-atlassian-sync
docker logs cogni-sync-knowledge-graph
docker logs cogni-sync-llm-rag
```

### Memory/Performance Issues
```bash
# Monitor resource usage
docker stats
```

## 📋 Production Checklist

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database migrations applied
- [ ] Health checks passing
- [ ] API keys generated and secured
- [ ] CORS origins configured
- [ ] Monitoring set up
- [ ] Backup procedures in place
- [ ] Load testing completed

## 🆘 Getting Help

1. Check service logs for errors
2. Verify environment variables
3. Test database connectivity
4. Review [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md) for detailed instructions
5. Check individual service README files

## 🔄 Updating Services

### Docker Update
```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose -f docker-compose.production.yml up --build -d
```

### Vercel Update
```bash
# Redeploy services
cd vercel
./deploy-vercel.sh
```

### Kubernetes Update
```bash
# Apply updates
kubectl apply -f kubernetes/
kubectl rollout restart deployment -n cogni-sync
```

---

For production-grade deployment with advanced features, monitoring, and scaling, refer to the complete [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md).