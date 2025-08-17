/**
 * Shared Type Definitions for REST API Communication
 * 
 * This file defines the standardized types for REST API communication
 * across the CogniSync platform services.
 * 
 * @version 2.0.0
 * @updated 2024-01-15 - Enhanced with comprehensive interface specifications
 */

// ============================================================================
// Standard API Response Format
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata: ResponseMetadata;
  pagination?: PaginationInfo;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, any>;
}

export interface ResponseMetadata {
  timestamp: string; // ISO 8601
  version: string;
  requestId: string; // UUID
  processingTime: number; // milliseconds
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================================================
// Error Codes
// ============================================================================

export type ErrorCode = 
  // Common Error Codes
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'TENANT_ISOLATION_VIOLATION'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  // Atlassian Sync Service Specific
  | 'WEBHOOK_SIGNATURE_INVALID'
  | 'CONFIG_NOT_FOUND'
  | 'MAPPING_ERROR'
  | 'RETRY_LIMIT_EXCEEDED'
  // Knowledge Graph Service Specific
  | 'ENTITY_NOT_FOUND'
  | 'RELATIONSHIP_EXISTS'
  | 'CIRCULAR_DEPENDENCY'
  | 'GRAPH_CONSTRAINT_VIOLATION'
  // LLM-RAG Service Specific
  | 'QUERY_TOO_LONG'
  | 'EMBEDDING_FAILED'
  | 'LLM_SERVICE_UNAVAILABLE'
  | 'CONTEXT_LIMIT_EXCEEDED';

// ============================================================================
// Common Request/Response Types
// ============================================================================

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: string;
  version?: string;
  uptime?: number;
  services?: Record<string, 'up' | 'down'>;
  metrics?: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

export interface SearchFilters {
  documentTypes?: string[];
  sources?: string[];
  dateRange?: {
    start?: string; // ISO 8601
    end?: string; // ISO 8601
  };
  tags?: string[];
}

// ============================================================================
// Atlassian Sync Service Types
// ============================================================================

export namespace AtlassianSyncAPI {
  export interface SyncEvent {
    id: string;
    type: string;
    source: 'jira' | 'confluence';
    timestamp: string;
    actorId?: string;
    entityId?: string;
    externalId?: string;
    changes: Record<string, any>;
    processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'DEAD_LETTER';
    errorMessage?: string;
    retryCount: number;
    tenantId: string;
    configId?: string;
  }

  export interface SyncConfiguration {
    id: string;
    name: string;
    tenantId: string;
    source: string;
    enabled: boolean;
    webhookSecret: string;
    webhookUrl?: string;
    kgServiceUrl: string;
    kgApiKey: string;
    mappingRules: Record<string, any>;
    filters?: Record<string, any>;
    batchSize: number;
    retryLimit: number;
    retryDelay: number;
    createdAt: string;
    updatedAt: string;
  }

  export interface CreateConfigurationRequest {
    name: string;
    tenantId: string;
    source: string;
    enabled?: boolean;
    webhookSecret: string;
    webhookUrl?: string;
    kgServiceUrl: string;
    kgApiKey: string;
    mappingRules: Record<string, any>;
    filters?: Record<string, any>;
    batchSize?: number;
    retryLimit?: number;
    retryDelay?: number;
  }

  export interface UpdateConfigurationRequest {
    name?: string;
    enabled?: boolean;
    webhookSecret?: string;
    webhookUrl?: string;
    kgServiceUrl?: string;
    kgApiKey?: string;
    mappingRules?: Record<string, any>;
    filters?: Record<string, any>;
    batchSize?: number;
    retryLimit?: number;
    retryDelay?: number;
  }

  export interface ListEventsRequest {
    tenantId?: string;
    source?: string;
    type?: string;
    status?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }

  export interface ListConfigurationsRequest {
    tenantId?: string;
    source?: string;
    enabled?: boolean;
  }
}

// ============================================================================
// Knowledge Graph Service Types
// ============================================================================

export namespace KnowledgeGraphAPI {
  export interface Entity {
    id: string;
    type: string;
    name: string;
    description?: string;
    properties: Record<string, any>;
    metadata: {
      confidence: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      importance: 'MINOR' | 'MODERATE' | 'SIGNIFICANT' | 'CRITICAL';
      source: string;
      extractionMethod: 'MANUAL' | 'NLP' | 'LLM' | 'PATTERN_MATCHING' | 'API_INTEGRATION' | 'INFERENCE';
      tags: string[];
      aliases: string[];
    };
    tenantId?: string;
    createdAt: string;
    updatedAt: string;
  }

  export interface Relationship {
    id: string;
    sourceEntityId: string;
    targetEntityId: string;
    type: string;
    weight: number;
    confidence: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    properties?: Record<string, any>;
    metadata: {
      source: string;
      extractionMethod: 'MANUAL' | 'NLP' | 'LLM' | 'PATTERN_MATCHING' | 'API_INTEGRATION' | 'INFERENCE';
      evidenceCount: number;
      isInferred: boolean;
      context?: string;
    };
    tenantId?: string;
    createdAt: string;
    updatedAt: string;
  }

  export interface CreateEntityRequest {
    type: string;
    name: string;
    description?: string;
    properties: Record<string, any>;
    metadata: {
      confidence: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      importance: 'MINOR' | 'MODERATE' | 'SIGNIFICANT' | 'CRITICAL';
      source: string;
      extractionMethod: 'MANUAL' | 'NLP' | 'LLM' | 'PATTERN_MATCHING' | 'API_INTEGRATION' | 'INFERENCE';
      tags: string[];
      aliases: string[];
    };
    tenantId?: string;
  }

  export interface UpdateEntityRequest {
    type?: string;
    name?: string;
    description?: string;
    properties?: Record<string, any>;
    metadata?: Partial<Entity['metadata']>;
  }

  export interface CreateRelationshipRequest {
    sourceEntityId: string;
    targetEntityId: string;
    type: string;
    weight?: number;
    confidence: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    properties?: Record<string, any>;
    metadata: {
      source: string;
      extractionMethod: 'MANUAL' | 'NLP' | 'LLM' | 'PATTERN_MATCHING' | 'API_INTEGRATION' | 'INFERENCE';
      evidenceCount: number;
      isInferred: boolean;
      context?: string;
    };
    tenantId?: string;
  }

  export interface SearchEntitiesRequest {
    page?: number;
    limit?: number;
    search?: string;
    entityTypes?: string;
    tenantId?: string;
  }

  export interface GetNeighborhoodRequest {
    depth?: number;
    tenantId?: string;
  }

  export interface BulkCreateEntitiesRequest {
    entities: CreateEntityRequest[];
    tenantId?: string;
  }

  export interface BulkCreateRelationshipsRequest {
    relationships: CreateRelationshipRequest[];
    tenantId?: string;
  }

  export interface GraphAnalytics {
    nodeCount: number;
    edgeCount: number;
    density: number;
    insights: Array<{
      type: string;
      description: string;
      importance: 'MINOR' | 'MODERATE' | 'SIGNIFICANT' | 'CRITICAL';
      metrics: Record<string, number>;
    }>;
    lastCalculated: string;
  }
}

// ============================================================================
// LLM-RAG Service Types
// ============================================================================

export namespace LLMRagAPI {
  export interface QueryRequest {
    query: string;
    tenantId: string;
    sessionId?: string;
    userId?: string;
    context?: Record<string, any>;
    maxResults?: number;
    filters?: SearchFilters;
    options?: {
      includeAnalysis?: boolean;
      includeSuggestions?: boolean;
      sources?: string[];
    };
  }

  export interface QueryResponse {
    sessionId: string;
    response: string;
    context: {
      intent: 'business' | 'technical' | 'project' | 'requirements' | 'status';
      entities: string[];
      keywords: string[];
      urgency: 'low' | 'medium' | 'high';
      complexity: 'simple' | 'moderate' | 'complex';
    };
    sources: Array<{
      documentId: string;
      title: string;
      relevanceScore: number;
      excerpt: string;
    }>;
    processingTime: number;
    metadata: {
      totalDocuments?: number;
      searchTime?: number;
      llmTokens?: number;
      confidence?: number;
      [key: string]: any;
    };
  }

  export interface SearchResult {
    content: string;
    source: 'confluence' | 'jira' | 'knowledge_graph' | 'external';
    url: string;
    title: string;
    relevance: number;
    excerpt: string;
    lastModified: string;
    metadata?: Record<string, any>;
  }

  export interface EnhancedSearchResult extends SearchResult {
    semanticSimilarity: number;
    entityMatches: Array<{
      name: string;
      type: string;
      confidence: number;
      startPosition?: number;
      endPosition?: number;
      context?: string;
      metadata: Record<string, any>;
    }>;
    confidenceBreakdown: {
      textMatch: number;
      entityMatch: number;
      semanticMatch: number;
      contextMatch: number;
    };
  }

  export interface Document {
    id: string;
    text: string;
    title?: string;
    url?: string;
    source?: string;
    metadata?: Record<string, any>;
  }

  export interface BulkEmbeddingRequest {
    documents: Document[];
    tenantId: string;
    options?: {
      batchSize?: number;
      overwrite?: boolean;
    };
  }

  export interface BulkEmbeddingResponse {
    processed: number;
    skipped: number;
    errors: number;
    processingTime: number;
    details: {
      successful: string[];
      failed: Array<{
        id: string;
        error: string;
      }>;
    };
  }

  export interface QueryAnalyticsData {
    tenantId: string;
    dateRange: {
      start: string;
      end: string;
    };
    metrics: {
      totalQueries: number;
      successRate: number;
      avgResponseTime: number;
      topIntents: Array<{
        intent: string;
        count: number;
        percentage: number;
      }>;
      topSources: Array<{
        source: string;
        count: number;
        percentage: number;
      }>;
      userEngagement: {
        uniqueUsers: number;
        repeatUsers: number;
        avgQueriesPerUser: number;
      };
      qualityMetrics: {
        avgRelevanceScore: number;
        avgSemanticScore: number;
        userSatisfactionScore?: number;
      };
    };
  }
}

// ============================================================================
// Utility Types
// ============================================================================

export type SuccessResponse<T> = ApiResponse<T> & { success: true; data: T };
export type ErrorResponse = ApiResponse<never> & { success: false; error: ApiError };

export interface PaginatedRequest {
  page?: number;
  limit?: number;
}

export interface TimestampedEntity {
  createdAt: string;
  updatedAt: string;
}

export interface TenantScoped {
  tenantId: string;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isSuccessResponse<T>(response: ApiResponse<T>): response is SuccessResponse<T> {
  return response.success === true;
}

export function isErrorResponse<T>(response: ApiResponse<T>): response is ErrorResponse {
  return response.success === false;
}

// ============================================================================
// Response Factory Functions
// ============================================================================

export function createSuccessResponse<T>(
  data: T,
  requestId: string,
  processingTime: number,
  version: string = '1.0.0',
  pagination?: PaginationInfo
): SuccessResponse<T> {
  return {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      version,
      requestId,
      processingTime
    },
    pagination
  };
}

export function createErrorResponse(
  error: ApiError,
  requestId: string,
  processingTime: number,
  version: string = '1.0.0'
): ErrorResponse {
  return {
    success: false,
    error,
    metadata: {
      timestamp: new Date().toISOString(),
      version,
      requestId,
      processingTime
    }
  };
}

export function createValidationError(message: string, field?: string, value?: any): ApiError {
  return {
    code: 'VALIDATION_ERROR',
    message,
    details: field ? { field, value } : undefined
  };
}

export function createNotFoundError(resource: string, id: string): ApiError {
  return {
    code: 'NOT_FOUND',
    message: `${resource} not found: ${id}`,
    details: { resource, id }
  };
}

export function createUnauthorizedError(message: string = 'Unauthorized'): ApiError {
  return {
    code: 'UNAUTHORIZED',
    message
  };
}

export function createTenantIsolationError(message: string = 'Tenant isolation violation'): ApiError {
  return {
    code: 'TENANT_ISOLATION_ERROR',
    message
  };
}

export function createInternalError(message: string = 'Internal server error'): ApiError {
  return {
    code: 'INTERNAL_ERROR',
    message
  };
}

// ============================================================================
// Validation Schemas (JSON Schema format)
// ============================================================================

export const ApiResponseSchema = {
  type: 'object',
  required: ['success', 'metadata'],
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object' },
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { 
          type: 'string', 
          enum: [
            'VALIDATION_ERROR', 'NOT_FOUND', 'UNAUTHORIZED', 'FORBIDDEN',
            'TENANT_ISOLATION_ERROR', 'RATE_LIMIT_EXCEEDED', 'INTERNAL_ERROR',
            'SERVICE_UNAVAILABLE', 'TIMEOUT', 'CONFLICT', 'UNPROCESSABLE_ENTITY'
          ]
        },
        message: { type: 'string' },
        details: { type: 'object' }
      }
    },
    metadata: {
      type: 'object',
      required: ['timestamp', 'version', 'requestId', 'processingTime'],
      properties: {
        timestamp: { type: 'string', format: 'date-time' },
        version: { type: 'string' },
        requestId: { type: 'string', format: 'uuid' },
        processingTime: { type: 'number' }
      }
    },
    pagination: {
      type: 'object',
      required: ['page', 'limit', 'total', 'totalPages'],
      properties: {
        page: { type: 'number', minimum: 1 },
        limit: { type: 'number', minimum: 1, maximum: 1000 },
        total: { type: 'number', minimum: 0 },
        totalPages: { type: 'number', minimum: 0 }
      }
    }
  }
};