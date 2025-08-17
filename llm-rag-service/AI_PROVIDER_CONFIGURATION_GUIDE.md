# AI Provider Configuration Guide

This guide provides comprehensive instructions for configuring AI providers with automatic fallback mechanisms to maximize uptime and performance.

## Overview

The CogniSync LLM/RAG service supports multiple AI providers with automatic fallback capabilities. This ensures maximum uptime and performance by automatically switching to backup providers when the primary provider fails or becomes unavailable.

## Supported Providers

- **OpenAI** - Primary and backup instances
- **Azure OpenAI** - Primary and backup instances (different regions)
- **Anthropic** - (Future support)
- **Cohere** - (Future support)
- **Hugging Face** - (Future support)

## Configuration Files

### Primary Configuration
Copy `.env.ai-providers.example` to `.env` and configure your providers:

```bash
cp .env.ai-providers.example .env
```

### Environment Variables Structure

#### Provider Priority System
Providers are prioritized using the `PRIORITY` setting:
- `1` = Highest priority (primary)
- `2` = Secondary priority (backup)
- `3+` = Additional fallback providers

#### Provider Configuration Pattern
Each provider follows this pattern:
```bash
# Provider Identification
{PROVIDER}_API_KEY=your-api-key
{PROVIDER}_PRIORITY=1
{PROVIDER}_ENABLED=true

# Health Monitoring
{PROVIDER}_HEALTH_CHECK_INTERVAL=30000
{PROVIDER}_MAX_RETRIES=3
{PROVIDER}_RETRY_DELAY=1000
{PROVIDER}_TIMEOUT=30000

# Rate Limiting
{PROVIDER}_REQUESTS_PER_MINUTE=60
{PROVIDER}_TOKENS_PER_MINUTE=150000
```

## Configuration Scenarios

### Scenario 1: Azure Primary with OpenAI Backup
Recommended for enterprise deployments with Azure infrastructure:

```bash
# Azure OpenAI (Primary)
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_PRIORITY=1
AZURE_OPENAI_ENABLED=true

# OpenAI (Backup)
OPENAI_API_KEY=sk-your-openai-key
OPENAI_PRIMARY_PRIORITY=2
OPENAI_PRIMARY_ENABLED=true
```

### Scenario 2: OpenAI Primary with Azure Backup
Recommended for startups and smaller deployments:

```bash
# OpenAI (Primary)
OPENAI_API_KEY=sk-your-openai-key
OPENAI_PRIMARY_PRIORITY=1
OPENAI_PRIMARY_ENABLED=true

# Azure OpenAI (Backup)
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_PRIORITY=2
AZURE_OPENAI_ENABLED=true
```

### Scenario 3: Multi-Region Azure for High Availability
Recommended for mission-critical applications:

```bash
# Azure OpenAI East US (Primary)
AZURE_OPENAI_API_KEY=your-east-us-key
AZURE_OPENAI_ENDPOINT=https://your-east-resource.openai.azure.com
AZURE_OPENAI_PRIORITY=1
AZURE_OPENAI_ENABLED=true

# Azure OpenAI West US (Backup)
AZURE_OPENAI_BACKUP_API_KEY=your-west-us-key
AZURE_OPENAI_BACKUP_ENDPOINT=https://your-west-resource.openai.azure.com
AZURE_OPENAI_BACKUP_PRIORITY=2
AZURE_OPENAI_BACKUP_ENABLED=true
```

### Scenario 4: Cost Optimization
Use cheaper models as backup:

```bash
# Azure OpenAI GPT-4 (Primary)
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4-deployment
AZURE_OPENAI_PRIORITY=1

# OpenAI GPT-3.5-turbo (Backup - cheaper)
OPENAI_BACKUP_API_KEY=sk-your-backup-key
OPENAI_BACKUP_MODEL=gpt-3.5-turbo
OPENAI_BACKUP_PRIORITY=2
```

## Fallback Mechanism Features

### Automatic Provider Selection
- Providers are automatically selected based on priority and health status
- Unhealthy providers are automatically skipped
- System falls back to next available provider on failure

### Health Monitoring
- Continuous health checks for all providers
- Configurable health check intervals
- Automatic provider status updates (healthy/degraded/unhealthy)

### Retry Logic
- Configurable retry attempts per provider
- Exponential backoff for retry delays
- Circuit breaker pattern to prevent cascading failures

### Rate Limiting
- Per-provider rate limiting
- Automatic rate limit detection and handling
- Graceful degradation when limits are reached

## API Endpoints

### Health Check
```bash
GET /api/ai-providers/health
```
Returns health status of all configured providers.

### Provider Configuration
```bash
GET /api/ai-providers/config
```
Returns provider configurations (without sensitive data).

### Manual Health Check
```bash
POST /api/ai-providers/health/check
```
Triggers manual health check for all providers.

### Enable/Disable Provider
```bash
PUT /api/ai-providers/{providerName}/enabled
Content-Type: application/json

{
  "enabled": true
}
```

### Test Completion
```bash
POST /api/ai-providers/test/completion
Content-Type: application/json

{
  "message": "Hello, this is a test message."
}
```

### Test Embedding
```bash
POST /api/ai-providers/test/embedding
Content-Type: application/json

{
  "text": "This is a test text for embedding creation."
}
```

## Monitoring and Alerting

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "providers": [
    {
      "name": "azure-openai",
      "status": "healthy",
      "lastCheck": "2024-01-15T10:29:45Z",
      "responseTime": 245,
      "errorCount": 0,
      "uptime": 99.8
    }
  ],
  "summary": {
    "total": 2,
    "healthy": 1,
    "degraded": 1,
    "unhealthy": 0
  }
}
```

### Metrics Tracked
- Response times per provider
- Error rates and counts
- Uptime percentages
- Request volumes
- Fallback frequency

### Alert Thresholds
Configure alerts for:
- Provider error rate > 5%
- Response time > 5 seconds
- Provider downtime > 5 minutes
- All providers unhealthy

## Performance Optimization

### Connection Pooling
```bash
AI_PROVIDER_CONNECTION_POOL_SIZE=10
AI_PROVIDER_CONNECTION_POOL_TIMEOUT=30000
```

### Request Batching
```bash
AI_PROVIDER_BATCH_REQUESTS_ENABLED=false
AI_PROVIDER_BATCH_SIZE=10
AI_PROVIDER_BATCH_TIMEOUT=1000
```

### Response Caching
```bash
AI_PROVIDER_RESPONSE_CACHING_ENABLED=true
AI_PROVIDER_CACHE_TTL=3600
AI_PROVIDER_CACHE_MAX_SIZE=1000
```

## Security Considerations

### API Key Management
- Store API keys in secure environment variables
- Use different API keys for different environments
- Rotate API keys regularly
- Monitor API key usage

### Request Encryption
```bash
AI_PROVIDER_REQUEST_ENCRYPTION_ENABLED=false
AI_PROVIDER_RESPONSE_ENCRYPTION_ENABLED=false
```

### Audit Logging
```bash
AI_PROVIDER_AUDIT_LOGGING_ENABLED=true
AI_PROVIDER_AUDIT_LOG_RETENTION_DAYS=90
```

## Deployment Environment Presets

### Development
```bash
NODE_ENV=development
AI_PROVIDER_HEALTH_CHECK_INTERVAL=60000
AI_PROVIDER_REQUEST_LOGGING_ENABLED=true
AI_PROVIDER_PERFORMANCE_LOGGING_ENABLED=true
```

### Staging
```bash
NODE_ENV=staging
AI_PROVIDER_HEALTH_CHECK_INTERVAL=30000
AI_PROVIDER_CIRCUIT_BREAKER_ENABLED=true
AI_PROVIDER_METRICS_ENABLED=true
```

### Production
```bash
NODE_ENV=production
AI_PROVIDER_HEALTH_CHECK_INTERVAL=15000
AI_PROVIDER_CIRCUIT_BREAKER_ENABLED=true
AI_PROVIDER_METRICS_ENABLED=true
AI_PROVIDER_REQUEST_LOGGING_ENABLED=false
AI_PROVIDER_PERFORMANCE_LOGGING_ENABLED=true
```

## Troubleshooting

### Common Issues

#### Provider Not Responding
1. Check provider health status: `GET /api/ai-providers/health`
2. Verify API keys and endpoints
3. Check network connectivity
4. Review rate limits

#### High Error Rates
1. Monitor provider status
2. Check API key validity
3. Verify model availability
4. Review request patterns

#### Slow Response Times
1. Check provider response times
2. Verify network latency
3. Consider regional providers
4. Optimize request sizes

### Debug Commands

#### Test Provider Connectivity
```bash
curl -X POST http://localhost:3003/api/ai-providers/test/completion \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"message": "Hello, test message"}'
```

#### Check Provider Health
```bash
curl -X GET http://localhost:3003/api/ai-providers/health \
  -H "X-API-Key: your-api-key"
```

#### Trigger Manual Health Check
```bash
curl -X POST http://localhost:3003/api/ai-providers/health/check \
  -H "X-API-Key: your-api-key"
```

## Best Practices

### Provider Selection
1. Use geographically distributed providers for global applications
2. Configure at least 2 providers for redundancy
3. Test all providers regularly
4. Monitor costs across providers

### Configuration Management
1. Use environment-specific configurations
2. Store sensitive data in secure vaults
3. Version control configuration templates
4. Document provider-specific settings

### Monitoring
1. Set up comprehensive health monitoring
2. Configure alerting for critical failures
3. Track performance metrics
4. Monitor costs and usage

### Maintenance
1. Regularly update provider configurations
2. Test failover scenarios
3. Review and optimize retry settings
4. Update API keys before expiration

## Migration Guide

### From Single Provider to Multi-Provider

1. **Backup Current Configuration**
   ```bash
   cp .env .env.backup
   ```

2. **Add Backup Provider**
   ```bash
   # Add backup provider configuration
   OPENAI_BACKUP_API_KEY=sk-your-backup-key
   OPENAI_BACKUP_PRIORITY=2
   OPENAI_BACKUP_ENABLED=true
   ```

3. **Test Configuration**
   ```bash
   # Test both providers
   curl -X POST http://localhost:3003/api/ai-providers/test/completion
   ```

4. **Monitor Fallback Behavior**
   ```bash
   # Check health status
   curl -X GET http://localhost:3003/api/ai-providers/health
   ```

### From Legacy Configuration

1. **Update Environment Variables**
   - Replace `AI_PROVIDER` with provider-specific configurations
   - Add priority and health check settings
   - Configure fallback providers

2. **Update Application Code**
   - Services automatically use the new AIProviderService
   - No code changes required for basic functionality

3. **Test Migration**
   - Verify all providers are detected
   - Test fallback scenarios
   - Monitor performance metrics

## Support

For additional support:
- Check the health endpoints for real-time status
- Review logs for detailed error information
- Test individual providers using the test endpoints
- Monitor metrics for performance insights

## Version History

- **v1.0.0** - Initial AI provider configuration system
- **v1.1.0** - Added automatic fallback mechanisms
- **v1.2.0** - Enhanced health monitoring and metrics
- **v1.3.0** - Added comprehensive configuration options