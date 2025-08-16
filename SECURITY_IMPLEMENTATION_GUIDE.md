# CogniSync Security Implementation Guide

## Overview

This guide provides comprehensive documentation for the security enhancements implemented across the CogniSync platform to address inter-service communication security requirements.

## Security Features Implemented

### 1. Authentication Mechanisms ✅

#### JWT Token Authentication
- **Service-to-Service Tokens**: Short-lived tokens (15 minutes) for inter-service communication
- **User Authentication Tokens**: Standard JWT tokens for user sessions (1 hour default)
- **Token Validation**: Comprehensive validation including signature, expiry, issuer, and audience
- **Key Rotation**: Support for JWT secret rotation

#### API Key Authentication
- **Legacy Support**: Backward compatibility with existing API key systems
- **Service-Specific Keys**: Prefixed API keys for each service
- **Multi-Header Support**: Accept API keys from Authorization header or x-api-key header

#### Enhanced Security Features
- **Request Signing**: HMAC-SHA256 signatures for request integrity
- **Timestamp Validation**: Prevent replay attacks with timestamp checking
- **Service Identity Verification**: Validate calling service identity

### 2. Authorization Protocols ✅

#### Role-Based Access Control (RBAC)
- **User Roles**: admin, user, service roles with hierarchical permissions
- **Scope-Based Authorization**: Fine-grained permissions (read, write, delete, admin)
- **Service-Specific Scopes**: LLM, embedding, analytics scopes for specialized operations

#### Tenant Isolation
- **Multi-Tenant Support**: Secure tenant data isolation
- **Tenant Context Validation**: Ensure operations are performed within correct tenant scope
- **Cross-Tenant Prevention**: Block unauthorized cross-tenant access

#### Authorization Middleware
- **requireScopes()**: Validate required scopes for operations
- **requireRoles()**: Enforce role-based access
- **requireTenant()**: Ensure tenant context
- **requireServiceAuth()**: Restrict to service-to-service calls

### 3. Data Encryption ✅

#### Transport Layer Security
- **TLS 1.2/1.3**: Modern TLS protocols only
- **Strong Cipher Suites**: ECDHE with AES-256-GCM and ChaCha20-Poly1305
- **Perfect Forward Secrecy**: DHE/ECDHE key exchange
- **OCSP Stapling**: Certificate validation optimization

#### Mutual TLS (mTLS)
- **Client Certificate Authentication**: Verify service identity via certificates
- **Certificate Management**: Automated certificate rotation and validation
- **Certificate Fingerprinting**: Additional security layer for service verification
- **CA Trust Chain**: Proper certificate authority validation

#### Data Encryption at Rest
- **AES-256-GCM**: Industry-standard encryption for sensitive data
- **Key Management**: Secure encryption key storage and rotation
- **Field-Level Encryption**: Encrypt specific sensitive fields

### 4. Secure API Gateway ✅

#### Enhanced Nginx Configuration
- **Security Headers**: Comprehensive security headers (HSTS, CSP, X-Frame-Options, etc.)
- **Rate Limiting**: Multiple rate limiting zones for different endpoints
- **Request Validation**: Input validation and sanitization
- **IP Whitelisting**: Restrict internal endpoints to private networks

#### Advanced Features
- **Request ID Tracking**: Unique request identifiers for audit trails
- **Service Type Headers**: Identify target service types
- **Webhook Security**: Specialized handling for webhook endpoints
- **Health Check Optimization**: Separate rate limits for health checks

## Implementation Details

### Service Integration

#### Atlassian Sync Service
```typescript
// Enhanced authentication middleware
import { authenticate, requireWriteAccess, webhookAuth } from './middleware/auth.middleware';

// Apply to routes
app.use('/api', authenticate, requireWriteAccess);
app.use('/webhooks', webhookAuth);
```

#### Knowledge Graph Service
```typescript
// Tenant isolation and entity access control
import { authenticate, requireEntityAccess, requireTenantIsolation } from './middleware/auth.middleware';

app.use('/api/v1/entities', authenticate, requireTenantIsolation, requireEntityAccess('read'));
```

#### LLM-RAG Service
```typescript
// Specialized LLM access controls
import { authenticate, requireLLMAccess, requireEmbeddingAccess } from './middleware/auth.middleware';

app.use('/api/llm', authenticate, requireLLMAccess);
app.use('/api/embeddings', authenticate, requireEmbeddingAccess);
```

### Inter-Service Communication

#### Secure Client Usage
```typescript
import { createInterServiceClient } from '@cognisync/shared-security';

const client = createInterServiceClient({
  serviceId: 'atlassian-sync-service',
  targetService: 'knowledge-graph-service',
  baseURL: 'https://kg-service.internal',
  enableMTLS: true,
  clientCert: process.env.CLIENT_CERT,
  clientKey: process.env.CLIENT_KEY,
  caCert: process.env.CA_CERT
});

// Secure request with automatic authentication
const response = await client.post('/api/v1/entities', entityData, {
  tenantId: 'tenant-123',
  scopes: ['write']
});
```

#### Service Registry
```typescript
import { ServiceRegistry } from '@cognisync/shared-security';

const registry = new ServiceRegistry('my-service');

// Register services
registry.register('knowledge-graph', {
  baseURL: 'https://kg-service.internal',
  enableMTLS: true
});

// Use registered client
const kgClient = registry.getClient('knowledge-graph');
const entities = await kgClient.get('/api/v1/entities');
```

### Security Configuration

#### Environment Setup
```bash
# Copy security configuration template
cp shared-security/.env.security.example .env.security

# Generate secure secrets
openssl rand -hex 64  # JWT secret
openssl rand -hex 32  # API key salt
openssl rand -hex 32  # Encryption key

# Generate DH parameters for nginx
openssl dhparam -out /etc/nginx/ssl/dhparam.pem 2048
```

#### Service Configuration
```typescript
import { getServiceSecurityConfig } from '@cognisync/shared-security';

const securityConfig = getServiceSecurityConfig('my-service');

// Configuration is automatically validated
if (securityConfig.mtls.enabled) {
  // Setup mTLS
}
```

## Security Best Practices

### 1. Token Management
- **Short Expiry**: Use short-lived tokens (15 minutes for service tokens)
- **Secure Storage**: Never log or expose tokens in plain text
- **Rotation**: Implement regular token rotation
- **Revocation**: Support token revocation for compromised tokens

### 2. Certificate Management
- **Automated Rotation**: Implement automated certificate rotation
- **Monitoring**: Monitor certificate expiry dates
- **Backup**: Maintain secure certificate backups
- **Validation**: Validate certificate chains and fingerprints

### 3. Network Security
- **Private Networks**: Use private networks for inter-service communication
- **Firewall Rules**: Implement strict firewall rules
- **VPN/VPC**: Use VPN or VPC for additional network isolation
- **Monitoring**: Monitor network traffic for anomalies

### 4. Audit and Monitoring
- **Request Logging**: Log all authentication attempts
- **Failure Monitoring**: Monitor and alert on authentication failures
- **Anomaly Detection**: Implement anomaly detection for unusual patterns
- **Compliance**: Maintain audit logs for compliance requirements

## Deployment Guide

### 1. Development Environment
```bash
# Disable authentication for development
export DISABLE_AUTH=true
export NODE_ENV=development

# Start services with development security preset
npm run dev
```

### 2. Staging Environment
```bash
# Enable full security features
export NODE_ENV=staging
export MTLS_ENABLED=true
export ENABLE_AUDIT_LOGGING=true

# Deploy with staging security configuration
docker-compose -f docker-compose.staging.yml up
```

### 3. Production Environment
```bash
# Production security configuration
export NODE_ENV=production
export MTLS_ENABLED=true
export ENABLE_AUDIT_LOGGING=true
export TENANT_ISOLATION_ENABLED=true

# Deploy with production security
kubectl apply -f kubernetes/
```

## Security Testing

### 1. Authentication Testing
```bash
# Test JWT token validation
curl -H "Authorization: Bearer invalid-token" https://api.cognisync.com/api/v1/entities
# Expected: 401 Unauthorized

# Test API key authentication
curl -H "x-api-key: valid-api-key" https://api.cognisync.com/api/v1/entities
# Expected: 200 OK
```

### 2. Authorization Testing
```bash
# Test scope validation
curl -H "Authorization: Bearer read-only-token" -X POST https://api.cognisync.com/api/v1/entities
# Expected: 403 Forbidden

# Test tenant isolation
curl -H "Authorization: Bearer tenant-a-token" https://api.cognisync.com/api/v1/entities?tenantId=tenant-b
# Expected: 403 Forbidden
```

### 3. mTLS Testing
```bash
# Test mTLS connection
curl --cert client.crt --key client.key --cacert ca.crt https://internal-api.cognisync.com/health
# Expected: 200 OK

# Test without client certificate
curl https://internal-api.cognisync.com/health
# Expected: SSL handshake failure
```

## Troubleshooting

### Common Issues

#### 1. JWT Token Validation Failures
- **Check JWT Secret**: Ensure JWT_SECRET is consistent across services
- **Verify Token Format**: Ensure proper Bearer token format
- **Check Expiry**: Verify token hasn't expired
- **Validate Audience**: Ensure token audience matches service

#### 2. mTLS Connection Issues
- **Certificate Paths**: Verify certificate file paths are correct
- **Certificate Validity**: Check certificate expiry dates
- **CA Trust**: Ensure CA certificate is properly configured
- **Network Connectivity**: Verify network connectivity between services

#### 3. Authorization Failures
- **Scope Mismatch**: Verify required scopes are included in token
- **Tenant Context**: Ensure tenant ID is properly set
- **Role Permissions**: Check user roles and permissions
- **Service Allowlist**: Verify service is in allowed services list

### Debug Commands
```bash
# Check JWT token contents
echo "eyJ..." | base64 -d | jq .

# Verify certificate
openssl x509 -in cert.pem -text -noout

# Test TLS connection
openssl s_client -connect api.cognisync.com:443 -servername api.cognisync.com

# Check service connectivity
curl -v https://service.internal/health
```

## Compliance and Governance

### Security Standards
- **OWASP Top 10**: Protection against common web vulnerabilities
- **SOC 2 Type II**: Security controls for service organizations
- **GDPR**: Data protection and privacy compliance
- **ISO 27001**: Information security management

### Audit Requirements
- **Authentication Logs**: All authentication attempts logged
- **Authorization Logs**: All authorization decisions logged
- **Data Access Logs**: All data access operations logged
- **Security Events**: All security-related events logged

### Regular Security Reviews
- **Monthly**: Review access logs and security metrics
- **Quarterly**: Security configuration review and updates
- **Annually**: Comprehensive security audit and penetration testing
- **Continuous**: Automated security monitoring and alerting

## Conclusion

The implemented security enhancements provide comprehensive protection for inter-service communication in the CogniSync platform. The solution addresses all acceptance criteria:

✅ **Authentication mechanisms** - JWT tokens, API keys, and service-to-service authentication
✅ **Authorization protocols** - RBAC, scope-based access control, and tenant isolation  
✅ **Data encryption** - TLS/mTLS for transit, AES-256-GCM for data at rest
✅ **Secure API gateways** - Enhanced nginx configuration with security headers and rate limiting

The modular design allows for easy integration across all services while maintaining backward compatibility and providing flexibility for future security enhancements.