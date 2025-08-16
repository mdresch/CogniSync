# CogniSync Shared Security Module

A comprehensive security library for the CogniSync platform that provides authentication, authorization, encryption, and secure inter-service communication capabilities.

## Features

### 🔐 Authentication
- **JWT Token Authentication**: Service-to-service and user authentication
- **API Key Authentication**: Legacy and modern API key support
- **Request Signing**: HMAC-SHA256 request integrity verification
- **Multi-factor Authentication**: Support for multiple authentication methods

### 🛡️ Authorization
- **Role-Based Access Control (RBAC)**: Hierarchical permission system
- **Scope-Based Authorization**: Fine-grained permission controls
- **Tenant Isolation**: Multi-tenant security enforcement
- **Service-to-Service Authorization**: Restrict inter-service access

### 🔒 Encryption
- **Transport Layer Security**: TLS 1.2/1.3 with modern cipher suites
- **Mutual TLS (mTLS)**: Certificate-based service authentication
- **Data Encryption**: AES-256-GCM for sensitive data
- **Perfect Forward Secrecy**: DHE/ECDHE key exchange

### 🌐 Secure Communication
- **Inter-Service Client**: Secure HTTP client with automatic authentication
- **Service Registry**: Centralized service discovery and management
- **Request Validation**: Input validation and sanitization
- **Rate Limiting**: Protection against abuse and DoS attacks

## Quick Start

### Installation

```bash
# Clone or copy the shared-security module
cd shared-security

# Install dependencies
npm install

# Build the module
npm run build

# Run installation script
./install.sh
```

### Basic Usage

#### 1. Authentication Middleware

```typescript
import { createAuthMiddleware, requireScopes } from '@cognisync/shared-security';

// Create authentication middleware
const authenticate = createAuthMiddleware({
  serviceId: 'my-service',
  allowedServices: ['other-service'],
  allowApiKeys: true,
  allowServiceTokens: true,
  allowUserTokens: true
});

// Apply to Express routes
app.use('/api', authenticate);
app.use('/api/admin', authenticate, requireScopes(['admin']));
```

#### 2. Inter-Service Communication

```typescript
import { createInterServiceClient } from '@cognisync/shared-security';

// Create secure client
const client = createInterServiceClient({
  serviceId: 'my-service',
  targetService: 'other-service',
  baseURL: 'https://other-service.internal',
  enableMTLS: true
});

// Make secure requests
const response = await client.post('/api/data', { 
  message: 'Hello' 
}, {
  tenantId: 'tenant-123',
  scopes: ['write']
});
```

#### 3. JWT Token Management

```typescript
import { createJWTManager } from '@cognisync/shared-security';

const jwtManager = createJWTManager('my-service');

// Generate service token
const serviceToken = jwtManager.generateServiceToken(
  'target-service', 
  ['read', 'write']
);

// Generate user token
const userToken = jwtManager.generateUserToken(
  'user123',
  'tenant123',
  ['user'],
  ['read', 'write']
);

// Validate token
const decoded = jwtManager.validateServiceToken(serviceToken);
```

## Configuration

### Environment Variables

Copy `.env.security.example` to `.env.security` and configure:

```bash
# Authentication
JWT_SECRET=your-64-character-jwt-secret
VALID_API_KEYS=key1,key2,key3

# Authorization
ENABLE_RBAC=true
TENANT_ISOLATION_ENABLED=true

# Encryption
MTLS_ENABLED=true
MTLS_CERT_PATH=/etc/ssl/certs/service.crt
MTLS_KEY_PATH=/etc/ssl/private/service.key

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000
```

### Security Configuration

```typescript
import { getServiceSecurityConfig } from '@cognisync/shared-security';

const config = getServiceSecurityConfig('my-service');

// Configuration is automatically validated
console.log('Security config loaded:', config.serviceId);
```

## API Reference

### Authentication Middleware

#### `createAuthMiddleware(options)`

Creates an authentication middleware instance.

**Options:**
- `serviceId` (string): Unique service identifier
- `allowedServices` (string[]): List of allowed calling services
- `allowApiKeys` (boolean): Enable API key authentication
- `allowServiceTokens` (boolean): Enable service token authentication
- `allowUserTokens` (boolean): Enable user token authentication
- `skipPaths` (string[]): Paths to skip authentication

#### Authorization Functions

- `requireScopes(scopes)`: Require specific scopes
- `requireRoles(roles)`: Require specific user roles
- `requireTenant()`: Require tenant context
- `requireServiceAuth(services?)`: Require service authentication

### JWT Security Manager

#### `JWTSecurityManager(serviceId, jwtSecret?, issuer?)`

Manages JWT token generation and validation.

**Methods:**
- `generateServiceToken(targetService, scopes?, tenantId?)`: Generate service token
- `generateUserToken(userId, tenantId, roles?, scopes?, email?, expiresIn?)`: Generate user token
- `validateServiceToken(token)`: Validate service token
- `validateUserToken(token)`: Validate user token
- `createSignedRequest(targetService, method, path, body?)`: Create signed request
- `verifySignedRequest(token, signature, timestamp, method, path, body?)`: Verify signed request

### Inter-Service Client

#### `InterServiceClient(options)`

Secure HTTP client for inter-service communication.

**Options:**
- `serviceId` (string): Source service identifier
- `targetService` (string): Target service identifier
- `baseURL` (string): Target service base URL
- `enableMTLS` (boolean): Enable mutual TLS
- `clientCert` (string): Client certificate for mTLS
- `clientKey` (string): Client private key for mTLS
- `caCert` (string): CA certificate for validation

**Methods:**
- `get(url, options?)`: Secure GET request
- `post(url, data?, options?)`: Secure POST request
- `put(url, data?, options?)`: Secure PUT request
- `delete(url, options?)`: Secure DELETE request
- `healthCheck()`: Check service health
- `testConnection()`: Test connectivity and authentication

### mTLS Manager

#### `MTLSManager(config)`

Manages mutual TLS certificates and validation.

**Methods:**
- `getClientTLSOptions(targetService)`: Get client TLS options
- `getServerTLSOptions()`: Get server TLS options
- `verifyPeerCertificate(socket)`: Verify peer certificate
- `getCertificateInfo(serviceId?)`: Get certificate information
- `isEnabled()`: Check if mTLS is enabled

## Testing

### Run Security Tests

```bash
# Run comprehensive security test suite
npm test

# Run specific test file
npx ts-node security-test.ts
```

### Manual Testing

```bash
# Test JWT token validation
curl -H "Authorization: Bearer <token>" https://api.example.com/test

# Test API key authentication
curl -H "x-api-key: <api-key>" https://api.example.com/test

# Test mTLS connection
curl --cert client.crt --key client.key --cacert ca.crt https://api.example.com/test
```

## Security Best Practices

### 1. Token Management
- Use short-lived tokens (15 minutes for service tokens)
- Implement token rotation
- Never log tokens in plain text
- Store tokens securely

### 2. Certificate Management
- Implement automated certificate rotation
- Monitor certificate expiry dates
- Use strong key lengths (2048+ bits)
- Validate certificate chains

### 3. Network Security
- Use private networks for inter-service communication
- Implement strict firewall rules
- Monitor network traffic
- Use VPN/VPC for additional isolation

### 4. Configuration Security
- Use environment variables for secrets
- Validate configuration on startup
- Implement configuration encryption
- Regular security audits

## Troubleshooting

### Common Issues

#### JWT Token Validation Failures
```bash
# Check token format
echo "<token>" | base64 -d | jq .

# Verify JWT secret consistency
grep JWT_SECRET .env*
```

#### mTLS Connection Issues
```bash
# Verify certificate
openssl x509 -in cert.pem -text -noout

# Test TLS connection
openssl s_client -connect api.example.com:443
```

#### Authorization Failures
```bash
# Check user scopes
curl -H "Authorization: Bearer <token>" https://api.example.com/user/info

# Verify service permissions
curl -H "Authorization: Bearer <service-token>" https://api.example.com/service/info
```

### Debug Mode

Enable debug logging:

```bash
export DEBUG_LOGGING=true
export LOG_LEVEL=debug
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting guide
- Review the security implementation guide

## Changelog

### v1.0.0
- Initial release
- JWT authentication and authorization
- mTLS support
- Inter-service communication client
- Comprehensive security configuration
- Rate limiting and security headers
- Audit logging and monitoring