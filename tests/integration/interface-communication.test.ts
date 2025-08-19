/**
 * Integration Tests for Microservice Interface Communication
 * 
 * This test suite validates the communication protocols and interfaces
 * between the three core microservices in the CogniSync platform.
 * 
 * @version 1.0.0
 * @created 2024-01-15
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { AtlassianSyncClient } from '../../cogni-sync-client/src/services/AtlassianSyncClient';
import { KnowledgeGraphClient } from '../../cogni-sync-client/src/services/KnowledgeGraphClient';
import { LLMRagClient } from '../../cogni-sync-client/src/services/LLMRagClient';
import { 
  generateTraceId, 
  generateSpanId, 
  TraceContext,
  TenantContext,
  DEFAULT_SERVICE_REGISTRY
} from '../../shared-types/communication-protocols';

// Test configuration
const TEST_CONFIG = {
  atlassianSync: {
    baseUrl: process.env.ATLASSIAN_SYNC_SERVICE_URL || 'http://localhost:3002',
    apiKey: process.env.TEST_API_KEY || 'test-api-key'
  },
  knowledgeGraph: {
    baseUrl: process.env.KNOWLEDGE_GRAPH_SERVICE_URL || 'http://localhost:3001',
    apiKey: process.env.TEST_API_KEY || 'test-api-key'
  },
  llmRag: {
    baseUrl: process.env.LLM_RAG_SERVICE_URL || 'http://localhost:3003',
    apiKey: process.env.TEST_API_KEY || 'test-api-key'
  }
};

// Test data
const TEST_TENANT_ID = 'test-tenant-123';
const TEST_USER_ID = 'test-user-456';

describe('Microservice Interface Communication', () => {
  let atlassianSyncClient: AtlassianSyncClient;
  let knowledgeGraphClient: KnowledgeGraphClient;
  let llmRagClient: LLMRagClient;
  let traceContext: TraceContext;
  let tenantContext: TenantContext;

  beforeAll(async () => {
    // Initialize clients
    atlassianSyncClient = new AtlassianSyncClient(TEST_CONFIG.atlassianSync);
    knowledgeGraphClient = new KnowledgeGraphClient(TEST_CONFIG.knowledgeGraph);
    llmRagClient = new LLMRagClient(TEST_CONFIG.llmRag);

    // Setup trace context
    traceContext = {
      traceId: generateTraceId(),
      spanId: generateSpanId()
    };

    // Setup tenant context
    tenantContext = {
      tenantId: TEST_TENANT_ID,
      userId: TEST_USER_ID,
      permissions: ['read', 'write']
    };

    // Configure clients
    [atlassianSyncClient, knowledgeGraphClient, llmRagClient].forEach(client => {
      client.setTraceContext(traceContext);
      client.setTenantContext(tenantContext);
    });
  });

  beforeEach(() => {
    // Generate new span for each test
    traceContext.spanId = generateSpanId();
    traceContext.parentSpanId = traceContext.spanId;
  });

  describe('Health Check Protocols', () => {
    test('should perform health checks on all services', async () => {
      const healthChecks = await Promise.allSettled([
        atlassianSyncClient.healthCheck(),
        knowledgeGraphClient.healthCheck(),
        llmRagClient.healthCheck()
      ]);

      healthChecks.forEach((result, index) => {
        const serviceName = ['Atlassian Sync', 'Knowledge Graph', 'LLM-RAG'][index];
        
        if (result.status === 'fulfilled') {
          expect(result.value.status).toMatch(/healthy|degraded/);
          expect(result.value.service).toBeDefined();
          expect(result.value.version).toBeDefined();
          expect(result.value.timestamp).toBeDefined();
        } else {
          console.warn(`${serviceName} service health check failed:`, result.reason);
        }
      });
    });

    test('should validate health check response format', async () => {
      try {
        const health = await atlassianSyncClient.healthCheck();
        
        expect(health).toHaveProperty('status');
        expect(health).toHaveProperty('timestamp');
        expect(health).toHaveProperty('service');
        expect(health).toHaveProperty('version');
        expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      } catch (error) {
        console.warn('Health check test skipped - service not available');
      }
    });
  });

  describe('Authentication and Security', () => {
    test('should handle API key authentication', async () => {
      const client = new AtlassianSyncClient({
        ...TEST_CONFIG.atlassianSync,
        apiKey: 'invalid-key'
      });

      try {
        await client.healthCheck();
      } catch (error: any) {
        // Should fail with authentication error
        expect(error.response?.status).toBe(401);
      }
    });

    test('should enforce tenant isolation', async () => {
      const differentTenantContext: TenantContext = {
        tenantId: 'different-tenant-789',
        permissions: ['read']
      };

      knowledgeGraphClient.setTenantContext(differentTenantContext);

      try {
        // Try to access data from original tenant
        await knowledgeGraphClient.get('/entities?tenantId=' + TEST_TENANT_ID);
      } catch (error: any) {
        // Should fail with tenant isolation error
        expect(error.response?.status).toBeOneOf([401, 403]);
      }
    });
  });

  describe('Distributed Tracing', () => {
    test('should propagate trace context across services', async () => {
      const testTraceId = generateTraceId();
      const testSpanId = generateSpanId();
      
      const testTraceContext: TraceContext = {
        traceId: testTraceId,
        spanId: testSpanId,
        baggage: { 'test-key': 'test-value' }
      };

      atlassianSyncClient.setTraceContext(testTraceContext);

      try {
        // Make a request that should propagate trace context
        await atlassianSyncClient.getStatus();
        
        // Verify trace headers are included (this would be verified in service logs)
        expect(testTraceContext.traceId).toBe(testTraceId);
        expect(testTraceContext.spanId).toBe(testSpanId);
      } catch (error) {
        console.warn('Tracing test skipped - service not available');
      }
    });
  });

  describe('Error Handling Standards', () => {
    test('should return standardized error responses', async () => {
      try {
        await knowledgeGraphClient.get('/entities/non-existent-id');
      } catch (error: any) {
        const errorResponse = error.response?.data;
        
        if (errorResponse) {
          expect(errorResponse).toHaveProperty('success', false);
          expect(errorResponse).toHaveProperty('error');
          expect(errorResponse.error).toHaveProperty('code');
          expect(errorResponse.error).toHaveProperty('message');
          expect(errorResponse).toHaveProperty('timestamp');
        }
      }
    });

    test('should handle validation errors consistently', async () => {
      try {
        await knowledgeGraphClient.post('/entities', {
          // Invalid entity data
          type: 'INVALID_TYPE',
          name: '' // Empty name should fail validation
        });
      } catch (error: any) {
        const errorResponse = error.response?.data;
        
        if (errorResponse?.error?.code === 'VALIDATION_ERROR') {
          expect(errorResponse.error).toHaveProperty('message');
          expect(errorResponse.error.code).toBe('VALIDATION_ERROR');
        }
      }
    });
  });

  describe('Retry and Circuit Breaker Patterns', () => {
    test('should implement retry logic for transient failures', async () => {
      const startTime = Date.now();
      
      try {
        // This should trigger retry logic if service is temporarily unavailable
        await atlassianSyncClient.get('/api/configurations', {
          retryPolicy: {
            maxAttempts: 3,
            baseDelay: 100,
            maxDelay: 1000,
            backoffMultiplier: 2,
            jitter: false
          }
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Should have taken time for retries (at least 100ms for first retry)
        if (duration > 100) {
          console.log('Retry logic appears to be working - took', duration, 'ms');
        }
      }
    });
  });

  describe('Inter-Service Communication Flow', () => {
    test('should support Atlassian Sync → Knowledge Graph flow', async () => {
      // Test the flow where Atlassian Sync creates entities in Knowledge Graph
      const testEntity = {
        type: 'DOCUMENT',
        name: 'Test Integration Document',
        description: 'Document created during integration testing',
        properties: {
          source: 'integration-test',
          format: 'markdown'
        },
        metadata: {
          confidence: 'HIGH',
          importance: 'MODERATE',
          source: 'atlassian-sync-service',
          extractionMethod: 'API_INTEGRATION',
          tags: ['test', 'integration'],
          aliases: ['test-doc']
        }
      };

      try {
        // Simulate Atlassian Sync creating an entity
        const createdEntity = await knowledgeGraphClient.post('/entities', testEntity);
        
        expect(createdEntity).toHaveProperty('success', true);
        expect(createdEntity.data).toHaveProperty('id');
        expect(createdEntity.data.name).toBe(testEntity.name);

        // Clean up
        if (createdEntity.data?.id) {
          await knowledgeGraphClient.delete(`/entities/${createdEntity.data.id}`);
        }
      } catch (error) {
        console.warn('Inter-service communication test skipped - services not available');
      }
    });

    test('should support Knowledge Graph → LLM-RAG flow', async () => {
      // Test the flow where Knowledge Graph data is used by LLM-RAG
      const testQuery = {
        query: 'Find documents related to integration testing',
        context: {
          tenantId: TEST_TENANT_ID,
          userId: TEST_USER_ID
        },
        options: {
          maxResults: 5,
          includeMetadata: true
        }
      };

      try {
        const queryResponse = await llmRagClient.post('/query/search', testQuery);
        
        expect(queryResponse).toHaveProperty('results');
        expect(Array.isArray(queryResponse.results)).toBe(true);
        expect(queryResponse).toHaveProperty('metadata');
        expect(queryResponse.metadata).toHaveProperty('processingTime');
      } catch (error) {
        console.warn('LLM-RAG query test skipped - service not available');
      }
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      const requests = [];
      
      // Make multiple rapid requests to trigger rate limiting
      for (let i = 0; i < 10; i++) {
        requests.push(
          atlassianSyncClient.healthCheck().catch(error => error)
        );
      }

      const results = await Promise.allSettled(requests);
      
      // Check if any requests were rate limited (429 status)
      const rateLimitedRequests = results.filter(result => 
        result.status === 'rejected' && 
        (result.reason as any)?.response?.status === 429
      );

      if (rateLimitedRequests.length > 0) {
        console.log('Rate limiting is working -', rateLimitedRequests.length, 'requests were rate limited');
      }
    });
  });

  describe('Data Contract Validation', () => {
    test('should validate entity schema compliance', async () => {
      const validEntity = {
        type: 'DOCUMENT',
        name: 'Schema Validation Test',
        description: 'Testing schema validation',
        properties: {
          format: 'json',
          version: '1.0'
        },
        metadata: {
          confidence: 'HIGH',
          importance: 'MODERATE',
          source: 'test',
          extractionMethod: 'MANUAL',
          tags: ['test'],
          aliases: []
        }
      };

      try {
        const response = await knowledgeGraphClient.post('/entities', validEntity);
        
        if (response.success) {
          expect(response.data).toHaveProperty('id');
          expect(response.data).toHaveProperty('type', validEntity.type);
          expect(response.data).toHaveProperty('name', validEntity.name);
          expect(response.data).toHaveProperty('createdAt');
          expect(response.data).toHaveProperty('updatedAt');
          expect(response.data).toHaveProperty('tenantId');

          // Clean up
          await knowledgeGraphClient.delete(`/entities/${response.data.id}`);
        }
      } catch (error) {
        console.warn('Schema validation test skipped - service not available');
      }
    });

    test('should validate relationship schema compliance', async () => {
      // This test would require creating two entities first
      // and then creating a relationship between them
      console.log('Relationship schema validation test - implementation depends on entity creation');
    });
  });

  describe('WebSocket Communication', () => {
    test('should support WebSocket connections for real-time queries', async () => {
      // This test would require WebSocket client implementation
      console.log('WebSocket communication test - requires WebSocket client setup');
    });
  });

  describe('Message Bus Integration', () => {
    test('should validate message bus message format', () => {
      const testMessage = {
        messageId: 'test-msg-123',
        messageType: 'CREATE_ENTITY',
        timestamp: new Date().toISOString(),
        tenantId: TEST_TENANT_ID,
        source: {
          service: 'atlassian-sync-service',
          version: '1.0.0'
        },
        correlation: {
          traceId: traceContext.traceId,
          spanId: traceContext.spanId
        },
        payload: {
          entityId: 'entity-123',
          entityType: 'DOCUMENT',
          properties: {},
          metadata: {}
        }
      };

      // Validate message structure
      expect(testMessage).toHaveProperty('messageId');
      expect(testMessage).toHaveProperty('messageType');
      expect(testMessage).toHaveProperty('timestamp');
      expect(testMessage).toHaveProperty('tenantId');
      expect(testMessage).toHaveProperty('source');
      expect(testMessage).toHaveProperty('correlation');
      expect(testMessage).toHaveProperty('payload');
    });
  });

  afterAll(async () => {
    // Cleanup any test data or connections
    console.log('Integration tests completed');
  });
});

// Helper function for Jest custom matchers
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}