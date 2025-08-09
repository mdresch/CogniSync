/**
 * Type definitions for the Knowledge Graph Service
 */

// Core entity and relationship types
export type EntityType = 
  | 'PERSON' | 'DOCUMENT' | 'TASK' | 'API' | 'ORGANIZATION' | 'PROJECT'
  | 'CONCEPT' | 'TECHNOLOGY' | 'REQUIREMENT' | 'DECISION' | 'RISK' | 'MILESTONE';

export type RelationshipType = 
  | 'AUTHORED_BY' | 'ASSIGNED_TO' | 'DEPENDS_ON' | 'REFERENCES' | 'IMPLEMENTS'
  | 'MANAGES' | 'PARTICIPATES_IN' | 'RELATES_TO' | 'CONTAINS' | 'USES';

export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ImportanceLevel = 'MINOR' | 'MODERATE' | 'SIGNIFICANT' | 'CRITICAL';
export type ExtractionMethod = 'MANUAL' | 'NLP' | 'LLM' | 'PATTERN_MATCHING' | 'API_INTEGRATION' | 'INFERENCE';

// Entity data structure
export interface EntityData {
  type: EntityType;
  name: string;
  description?: string;
  properties: Record<string, any>;
  tenantId?: string;
  metadata: {
    confidence: ConfidenceLevel;
    importance: ImportanceLevel;
    source: string;
    extractionMethod: ExtractionMethod;
    tags: string[];
    aliases: string[];
  };
}

// Relationship data structure
export interface RelationshipData {
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  weight?: number;
  confidence: ConfidenceLevel;
  properties?: Record<string, any>;
  tenantId?: string;
  metadata: {
    source: string;
    extractionMethod: ExtractionMethod;
    evidenceCount: number;
    isInferred: boolean;
    context?: string;
  };
}

// Query interface for searching the graph
export interface GraphQuery {
  entityTypes?: EntityType[];
  relationshipTypes?: RelationshipType[];
  searchTerm?: string;
  maxResults?: number;
  includeInferred?: boolean;
  tenantId?: string;
}

// Analytics data structure
export interface GraphAnalytics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  insights: Array<{
    type: string;
    description: string;
    importance: ImportanceLevel;
    metrics: Record<string, number>;
  }>;
  lastCalculated: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Health check response
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  message: string;
  timestamp: Date;
  version?: string;
  uptime?: number;
}

// Authentication and authorization
export interface ApiKeyData {
  tenantId: string;
  permissions: string[];
  expiresAt?: Date;
}

export interface RequestContext {
  tenantId: string;
  userId?: string;
  apiKey: string;
  permissions: string[];
}

// Error types
export class KnowledgeGraphError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'KnowledgeGraphError';
  }
}

export class ValidationError extends KnowledgeGraphError {
  constructor(message: string, public field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends KnowledgeGraphError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends KnowledgeGraphError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class TenantIsolationError extends KnowledgeGraphError {
  constructor(message: string = 'Tenant isolation violation') {
    super(message, 403, 'TENANT_ISOLATION_ERROR');
    this.name = 'TenantIsolationError';
  }
}
