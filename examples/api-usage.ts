/**
 * Example implementations for standardized REST API communication
 * 
 * This file demonstrates how to use the standardized API formats
 * across the CogniSync platform services.
 */

import {
  ApiResponse,
  SuccessResponse,
  ErrorResponse,
  createSuccessResponse,
  createErrorResponse,
  createValidationError,
  createNotFoundError,
  createUnauthorizedError,
  isSuccessResponse,
  isErrorResponse,
  AtlassianSyncAPI,
  KnowledgeGraphAPI,
  LLMRagAPI
} from '../shared-types/api.types';

// ============================================================================
// Example: Atlassian Sync Service API Implementation
// ============================================================================

class AtlassianSyncAPIController {
  /**
   * GET /api/configurations
   */
  async listConfigurations(req: any): Promise<ApiResponse<AtlassianSyncAPI.SyncConfiguration[]>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Validate query parameters
      const { tenantId, source, enabled } = req.query;
      
      if (tenantId && typeof tenantId !== 'string') {
        return createErrorResponse(
          createValidationError('tenantId must be a string', 'tenantId', tenantId),
          requestId,
          Date.now() - startTime
        );
      }

      // Mock data retrieval
      const configurations: AtlassianSyncAPI.SyncConfiguration[] = [
        {
          id: 'config-1',
          name: 'Jira Production Sync',
          tenantId: 'tenant-1',
          source: 'jira',
          enabled: true,
          webhookSecret: 'secret-123',
          webhookUrl: 'https://api.example.com/webhooks/jira',
          kgServiceUrl: 'http://localhost:3001/api/v1',
          kgApiKey: 'kg-api-key-123',
          mappingRules: {
            issue: {
              entityType: 'TASK',
              nameField: 'summary',
              descriptionField: 'description'
            }
          },
          filters: {
            projects: ['KAN', 'PROJ']
          },
          batchSize: 10,
          retryLimit: 3,
          retryDelay: 30000,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];

      // Apply filters
      let filteredConfigs = configurations;
      if (tenantId) {
        filteredConfigs = filteredConfigs.filter(c => c.tenantId === tenantId);
      }
      if (source) {
        filteredConfigs = filteredConfigs.filter(c => c.source === source);
      }
      if (enabled !== undefined) {
        filteredConfigs = filteredConfigs.filter(c => c.enabled === (enabled === 'true'));
      }

      return createSuccessResponse(
        filteredConfigs,
        requestId,
        Date.now() - startTime
      );
    } catch (error) {
      return createErrorResponse(
        { code: 'INTERNAL_ERROR', message: 'Failed to retrieve configurations' },
        requestId,
        Date.now() - startTime
      );
    }
  }

  /**
   * POST /api/configurations
   */
  async createConfiguration(req: any): Promise<ApiResponse<AtlassianSyncAPI.SyncConfiguration>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const configData: AtlassianSyncAPI.CreateConfigurationRequest = req.body;

      // Validate required fields
      if (!configData.name) {
        return createErrorResponse(
          createValidationError('name is required', 'name'),
          requestId,
          Date.now() - startTime
        );
      }

      if (!configData.tenantId) {
        return createErrorResponse(
          createValidationError('tenantId is required', 'tenantId'),
          requestId,
          Date.now() - startTime
        );
      }

      if (!configData.source) {
        return createErrorResponse(
          createValidationError('source is required', 'source'),
          requestId,
          Date.now() - startTime
        );
      }

      // Create configuration
      const newConfig: AtlassianSyncAPI.SyncConfiguration = {
        id: this.generateId(),
        name: configData.name,
        tenantId: configData.tenantId,
        source: configData.source,
        enabled: configData.enabled ?? true,
        webhookSecret: configData.webhookSecret,
        webhookUrl: configData.webhookUrl,
        kgServiceUrl: configData.kgServiceUrl,
        kgApiKey: configData.kgApiKey,
        mappingRules: configData.mappingRules,
        filters: configData.filters,
        batchSize: configData.batchSize ?? 10,
        retryLimit: configData.retryLimit ?? 3,
        retryDelay: configData.retryDelay ?? 30000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      return createSuccessResponse(
        newConfig,
        requestId,
        Date.now() - startTime
      );
    } catch (error) {
      return createErrorResponse(
        { code: 'INTERNAL_ERROR', message: 'Failed to create configuration' },
        requestId,
        Date.now() - startTime
      );
    }
  }

  /**
   * GET /api/events
   */
  async listEvents(req: any): Promise<ApiResponse<AtlassianSyncAPI.SyncEvent[]>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const { tenantId, source, type, status, limit = 50, offset = 0 } = req.query;

      // Mock data
      const events: AtlassianSyncAPI.SyncEvent[] = [
        {
          id: 'event-1',
          type: 'issue_updated',
          source: 'jira',
          timestamp: '2024-01-01T12:00:00Z',
          actorId: 'user-123',
          entityId: 'KAN-25',
          externalId: '12345',
          changes: {
            issue: {
              key: 'KAN-25',
              fields: {
                summary: 'Updated task summary'
              }
            }
          },
          processingStatus: 'COMPLETED',
          retryCount: 0,
          tenantId: 'tenant-1',
          configId: 'config-1'
        }
      ];

      // Apply filters and pagination
      let filteredEvents = events;
      if (tenantId) filteredEvents = filteredEvents.filter(e => e.tenantId === tenantId);
      if (source) filteredEvents = filteredEvents.filter(e => e.source === source);
      if (type) filteredEvents = filteredEvents.filter(e => e.type === type);
      if (status) filteredEvents = filteredEvents.filter(e => e.processingStatus === status);

      const total = filteredEvents.length;
      const paginatedEvents = filteredEvents.slice(offset, offset + limit);

      return createSuccessResponse(
        paginatedEvents,
        requestId,
        Date.now() - startTime,
        '1.0.0',
        {
          page: Math.floor(offset / limit) + 1,
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      );
    } catch (error) {
      return createErrorResponse(
        { code: 'INTERNAL_ERROR', message: 'Failed to retrieve events' },
        requestId,
        Date.now() - startTime
      );
    }
  }

  private generateRequestId(): string {
    return 'req-' + Math.random().toString(36).substr(2, 9);
  }

  private generateId(): string {
    return 'id-' + Math.random().toString(36).substr(2, 9);
  }
}

// ============================================================================
// Example: Knowledge Graph Service API Implementation
// ============================================================================

class KnowledgeGraphAPIController {
  /**
   * POST /entities
   */
  async createEntity(req: any): Promise<ApiResponse<KnowledgeGraphAPI.Entity>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const entityData: KnowledgeGraphAPI.CreateEntityRequest = req.body;

      // Validate required fields
      if (!entityData.type) {
        return createErrorResponse(
          createValidationError('type is required', 'type'),
          requestId,
          Date.now() - startTime
        );
      }

      if (!entityData.name) {
        return createErrorResponse(
          createValidationError('name is required', 'name'),
          requestId,
          Date.now() - startTime
        );
      }

      if (!entityData.metadata) {
        return createErrorResponse(
          createValidationError('metadata is required', 'metadata'),
          requestId,
          Date.now() - startTime
        );
      }

      // Create entity
      const newEntity: KnowledgeGraphAPI.Entity = {
        id: this.generateId(),
        type: entityData.type,
        name: entityData.name,
        description: entityData.description,
        properties: entityData.properties,
        metadata: entityData.metadata,
        tenantId: entityData.tenantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      return createSuccessResponse(
        newEntity,
        requestId,
        Date.now() - startTime
      );
    } catch (error) {
      return createErrorResponse(
        { code: 'INTERNAL_ERROR', message: 'Failed to create entity' },
        requestId,
        Date.now() - startTime
      );
    }
  }

  /**
   * GET /entities/{id}
   */
  async getEntity(req: any): Promise<ApiResponse<KnowledgeGraphAPI.Entity>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const { id } = req.params;

      if (!id) {
        return createErrorResponse(
          createValidationError('id is required', 'id'),
          requestId,
          Date.now() - startTime
        );
      }

      // Mock entity lookup
      const entity = await this.findEntityById(id);

      if (!entity) {
        return createErrorResponse(
          createNotFoundError('Entity', id),
          requestId,
          Date.now() - startTime
        );
      }

      return createSuccessResponse(
        entity,
        requestId,
        Date.now() - startTime
      );
    } catch (error) {
      return createErrorResponse(
        { code: 'INTERNAL_ERROR', message: 'Failed to retrieve entity' },
        requestId,
        Date.now() - startTime
      );
    }
  }

  /**
   * GET /entities
   */
  async searchEntities(req: any): Promise<ApiResponse<KnowledgeGraphAPI.Entity[]>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const { page = 1, limit = 20, search, entityTypes } = req.query;

      // Mock search
      const entities: KnowledgeGraphAPI.Entity[] = [
        {
          id: 'entity-1',
          type: 'TASK',
          name: 'Implement authentication',
          description: 'Add OAuth2 authentication to the system',
          properties: {
            status: 'In Progress',
            priority: 'High'
          },
          metadata: {
            confidence: 'HIGH',
            importance: 'SIGNIFICANT',
            source: 'jira',
            extractionMethod: 'API_INTEGRATION',
            tags: ['authentication', 'security'],
            aliases: ['KAN-25']
          },
          tenantId: 'tenant-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];

      // Apply filters
      let filteredEntities = entities;
      if (search) {
        filteredEntities = filteredEntities.filter(e => 
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.description?.toLowerCase().includes(search.toLowerCase())
        );
      }
      if (entityTypes) {
        const types = entityTypes.split(',');
        filteredEntities = filteredEntities.filter(e => types.includes(e.type));
      }

      // Apply pagination
      const total = filteredEntities.length;
      const offset = (page - 1) * limit;
      const paginatedEntities = filteredEntities.slice(offset, offset + limit);

      return createSuccessResponse(
        paginatedEntities,
        requestId,
        Date.now() - startTime,
        '1.0.0',
        {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      );
    } catch (error) {
      return createErrorResponse(
        { code: 'INTERNAL_ERROR', message: 'Failed to search entities' },
        requestId,
        Date.now() - startTime
      );
    }
  }

  private async findEntityById(id: string): Promise<KnowledgeGraphAPI.Entity | null> {
    // Mock implementation
    if (id === 'entity-1') {
      return {
        id: 'entity-1',
        type: 'TASK',
        name: 'Implement authentication',
        description: 'Add OAuth2 authentication to the system',
        properties: { status: 'In Progress' },
        metadata: {
          confidence: 'HIGH',
          importance: 'SIGNIFICANT',
          source: 'jira',
          extractionMethod: 'API_INTEGRATION',
          tags: ['authentication'],
          aliases: ['KAN-25']
        },
        tenantId: 'tenant-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };
    }
    return null;
  }

  private generateRequestId(): string {
    return 'req-' + Math.random().toString(36).substr(2, 9);
  }

  private generateId(): string {
    return 'entity-' + Math.random().toString(36).substr(2, 9);
  }
}

// ============================================================================
// Example: LLM-RAG Service API Implementation
// ============================================================================

class LLMRagAPIController {
  /**
   * POST /query
   */
  async executeQuery(req: any): Promise<ApiResponse<LLMRagAPI.QueryResponse>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const queryRequest: LLMRagAPI.QueryRequest = req.body;

      // Validate required fields
      if (!queryRequest.query) {
        return createErrorResponse(
          createValidationError('query is required', 'query'),
          requestId,
          Date.now() - startTime
        );
      }

      if (!queryRequest.tenantId) {
        return createErrorResponse(
          createValidationError('tenantId is required', 'tenantId'),
          requestId,
          Date.now() - startTime
        );
      }

      // Process query
      const queryResponse = await this.processQuery(queryRequest);

      return createSuccessResponse(
        queryResponse,
        requestId,
        Date.now() - startTime
      );
    } catch (error) {
      return createErrorResponse(
        { code: 'INTERNAL_ERROR', message: 'Failed to process query' },
        requestId,
        Date.now() - startTime
      );
    }
  }

  /**
   * GET /query/history
   */
  async getQueryHistory(req: any): Promise<ApiResponse<LLMRagAPI.QueryResponse[]>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const { tenantId, userId, sessionId, limit = 20, offset = 0 } = req.query;

      if (!tenantId) {
        return createErrorResponse(
          createValidationError('tenantId is required', 'tenantId'),
          requestId,
          Date.now() - startTime
        );
      }

      // Mock query history
      const history: LLMRagAPI.QueryResponse[] = [
        {
          sessionId: 'session-1',
          response: 'OAuth2 is an authorization framework that enables applications to obtain limited access to user accounts.',
          context: {
            intent: 'technical',
            entities: ['OAuth2', 'authentication'],
            keywords: ['authorization', 'framework', 'access'],
            urgency: 'medium',
            complexity: 'moderate'
          },
          sources: [
            {
              documentId: 'doc-1',
              title: 'OAuth2 Implementation Guide',
              relevanceScore: 0.95,
              excerpt: 'OAuth2 is an authorization framework...'
            }
          ],
          processingTime: 1250,
          metadata: {
            totalDocuments: 5,
            searchTime: 200,
            llmTokens: 150,
            confidence: 0.92
          }
        }
      ];

      // Apply filters
      let filteredHistory = history;
      if (userId) {
        // In real implementation, filter by userId
      }
      if (sessionId) {
        filteredHistory = filteredHistory.filter(h => h.sessionId === sessionId);
      }

      // Apply pagination
      const total = filteredHistory.length;
      const paginatedHistory = filteredHistory.slice(offset, offset + limit);

      return createSuccessResponse(
        paginatedHistory,
        requestId,
        Date.now() - startTime,
        '1.0.0',
        {
          page: Math.floor(offset / limit) + 1,
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      );
    } catch (error) {
      return createErrorResponse(
        { code: 'INTERNAL_ERROR', message: 'Failed to retrieve query history' },
        requestId,
        Date.now() - startTime
      );
    }
  }

  private async processQuery(request: LLMRagAPI.QueryRequest): Promise<LLMRagAPI.QueryResponse> {
    // Mock query processing
    return {
      sessionId: request.sessionId || this.generateSessionId(),
      response: 'This is a mock response to your query about ' + request.query,
      context: {
        intent: 'technical',
        entities: ['authentication', 'OAuth2'],
        keywords: ['implement', 'security'],
        urgency: 'medium',
        complexity: 'moderate'
      },
      sources: [
        {
          documentId: 'doc-1',
          title: 'Authentication Best Practices',
          relevanceScore: 0.89,
          excerpt: 'When implementing authentication systems...'
        }
      ],
      processingTime: 1250,
      metadata: {
        totalDocuments: 3,
        searchTime: 150,
        llmTokens: 120,
        confidence: 0.87
      }
    };
  }

  private generateRequestId(): string {
    return 'req-' + Math.random().toString(36).substr(2, 9);
  }

  private generateSessionId(): string {
    return 'session-' + Math.random().toString(36).substr(2, 9);
  }
}

// ============================================================================
// Example: API Response Handling
// ============================================================================

class APIClient {
  async handleResponse<T>(response: ApiResponse<T>): Promise<T> {
    if (isSuccessResponse(response)) {
      console.log(`Request ${response.metadata.requestId} succeeded in ${response.metadata.processingTime}ms`);
      return response.data;
    } else if (isErrorResponse(response)) {
      console.error(`Request ${response.metadata.requestId} failed:`, response.error);
      throw new Error(`API Error: ${response.error.message}`);
    } else {
      throw new Error('Invalid API response format');
    }
  }

  async makeRequest<T>(url: string, options: any): Promise<T> {
    try {
      // Mock HTTP request
      const response: ApiResponse<T> = {
        success: true,
        data: {} as T,
        metadata: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          requestId: 'req-123',
          processingTime: 150
        }
      };

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  }
}

// ============================================================================
// Example Usage
// ============================================================================

async function demonstrateAPIUsage(): Promise<void> {
  console.log('=== API Usage Examples ===\n');

  // 1. Atlassian Sync Service API
  const atlassianController = new AtlassianSyncAPIController();
  
  const configsResponse = await atlassianController.listConfigurations({
    query: { tenantId: 'tenant-1', enabled: 'true' }
  });
  
  console.log('Configurations response:', JSON.stringify(configsResponse, null, 2));

  // 2. Knowledge Graph Service API
  const kgController = new KnowledgeGraphAPIController();
  
  const entityResponse = await kgController.createEntity({
    body: {
      type: 'TASK',
      name: 'Test Entity',
      properties: { status: 'active' },
      metadata: {
        confidence: 'HIGH',
        importance: 'MODERATE',
        source: 'test',
        extractionMethod: 'MANUAL',
        tags: ['test'],
        aliases: []
      }
    }
  });
  
  console.log('Entity creation response:', JSON.stringify(entityResponse, null, 2));

  // 3. LLM-RAG Service API
  const ragController = new LLMRagAPIController();
  
  const queryResponse = await ragController.executeQuery({
    body: {
      query: 'How do I implement OAuth2?',
      tenantId: 'tenant-1',
      maxResults: 5
    }
  });
  
  console.log('Query response:', JSON.stringify(queryResponse, null, 2));

  // 4. API Client usage
  const client = new APIClient();
  
  try {
    const data = await client.makeRequest('/api/test', {});
    console.log('Client request succeeded:', data);
  } catch (error) {
    console.error('Client request failed:', error);
  }
}

// Run the demonstration
if (require.main === module) {
  demonstrateAPIUsage().catch(console.error);
}

export {
  AtlassianSyncAPIController,
  KnowledgeGraphAPIController,
  LLMRagAPIController,
  APIClient
};