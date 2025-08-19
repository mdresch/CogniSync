/**
 * Communication Protocol Definitions
 * 
 * This file defines the standardized communication protocols and patterns
 * used between microservices in the CogniSync platform.
 * 
 * @version 1.0.0
 * @created 2024-01-15
 */

// ============================================================================
// Service Discovery and Configuration
// ============================================================================

export interface ServiceEndpoint {
  name: string;
  url: string;
  port: number;
  protocol: 'http' | 'https' | 'ws' | 'wss';
  version: string;
  healthCheckPath: string;
}

export interface ServiceRegistry {
  atlassianSync: ServiceEndpoint;
  knowledgeGraph: ServiceEndpoint;
  llmRag: ServiceEndpoint;
}

export const DEFAULT_SERVICE_REGISTRY: ServiceRegistry = {
  atlassianSync: {
    name: 'atlassian-sync-service',
    url: process.env.ATLASSIAN_SYNC_SERVICE_URL || 'http://localhost:3002',
    port: 3002,
    protocol: 'http',
    version: '1.0.0',
    healthCheckPath: '/health'
  },
  knowledgeGraph: {
    name: 'knowledge-graph-service',
    url: process.env.KNOWLEDGE_GRAPH_SERVICE_URL || 'http://localhost:3001',
    port: 3001,
    protocol: 'http',
    version: '1.0.0',
    healthCheckPath: '/api/v1/health'
  },
  llmRag: {
    name: 'llm-rag-service',
    url: process.env.LLM_RAG_SERVICE_URL || 'http://localhost:3003',
    port: 3003,
    protocol: 'http',
    version: '1.0.0',
    healthCheckPath: '/health'
  }
};

// ============================================================================
// HTTP Communication Patterns
// ============================================================================

export interface HttpRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitter: boolean;
  retryableStatusCodes?: number[];
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504]
};

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number; // milliseconds
  monitoringPeriod: number; // milliseconds
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 60000,
  monitoringPeriod: 10000
};

// ============================================================================
// Authentication and Security
// ============================================================================

export interface ApiKeyConfig {
  tenantId: string;
  permissions: Permission[];
  signature: string;
}

export type Permission = 'read' | 'write' | 'delete' | 'admin';

export interface ServiceAuthConfig {
  serviceName: string;
  environment: 'development' | 'staging' | 'production';
  signature: string;
}

export interface TenantContext {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  permissions: Permission[];
}

// ============================================================================
// Tracing and Observability
// ============================================================================

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage?: Record<string, string>;
}

export interface RequestMetrics {
  requestId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  errorCode?: string;
  service: string;
  endpoint: string;
  method: string;
}

// ============================================================================
// Health Check Protocols
// ============================================================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  service: string;
  version: string;
  dependencies?: Record<string, DependencyStatus>;
  details?: HealthDetails;
}

export interface DependencyStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTime?: number;
  lastChecked: string;
  error?: string;
}

export interface HealthDetails {
  database?: ConnectionStatus;
  messageBus?: MessageBusStatus;
  cache?: ConnectionStatus;
  externalServices?: Record<string, DependencyStatus>;
}

export interface ConnectionStatus {
  status: 'connected' | 'disconnected' | 'error';
  connectionCount?: number;
  lastConnected?: string;
  error?: string;
}

export interface MessageBusStatus {
  serviceBus?: ConnectionStatus;
  redis?: ConnectionStatus;
  queueDepth?: number;
  processingRate?: number;
}

// ============================================================================
// Rate Limiting
// ============================================================================

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: any) => string;
}

export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  default: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100
  },
  webhook: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000
  },
  query: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50
  },
  bulk: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10
  }
};

// ============================================================================
// WebSocket Communication
// ============================================================================

export interface WebSocketMessage {
  type: 'query' | 'result' | 'error' | 'ping' | 'pong';
  id: string;
  timestamp: string;
  payload: any;
}

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  pongTimeout?: number;
}

export const DEFAULT_WEBSOCKET_CONFIG: WebSocketConfig = {
  url: 'ws://localhost:3003',
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  pingInterval: 30000,
  pongTimeout: 5000
};

// ============================================================================
// Service Communication Interfaces
// ============================================================================

export interface ServiceCommunicator {
  // HTTP Methods
  get<T>(endpoint: string, config?: Partial<HttpRequestConfig>): Promise<T>;
  post<T>(endpoint: string, data?: any, config?: Partial<HttpRequestConfig>): Promise<T>;
  put<T>(endpoint: string, data?: any, config?: Partial<HttpRequestConfig>): Promise<T>;
  delete<T>(endpoint: string, config?: Partial<HttpRequestConfig>): Promise<T>;
  
  // Health Check
  healthCheck(): Promise<HealthStatus>;
  
  // Authentication
  setApiKey(apiKey: string): void;
  setTenantContext(context: TenantContext): void;
  
  // Tracing
  setTraceContext(context: TraceContext): void;
}

// ============================================================================
// Inter-Service API Contracts
// ============================================================================

export namespace AtlassianSyncAPI {
  export interface WebhookPayload {
    eventType: string;
    timestamp: string;
    data: any;
    signature?: string;
  }
  
  export interface SyncConfiguration {
    id: string;
    name: string;
    tenantId: string;
    source: 'jira' | 'confluence';
    enabled: boolean;
    webhookUrl: string;
    mappingRules: Record<string, any>;
    filters: Record<string, any>;
  }
  
  export interface SyncEvent {
    id: string;
    type: string;
    source: string;
    timestamp: string;
    processingStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
    tenantId: string;
    entityId?: string;
    errorMessage?: string;
    retryCount: number;
  }
}

export namespace KnowledgeGraphAPI {
  export interface Entity {
    id: string;
    type: string;
    name: string;
    description?: string;
    properties: Record<string, any>;
    metadata: EntityMetadata;
    tenantId: string;
    createdAt: string;
    updatedAt: string;
  }
  
  export interface EntityMetadata {
    confidence: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    importance: 'MINOR' | 'MODERATE' | 'SIGNIFICANT' | 'CRITICAL';
    source: string;
    extractionMethod: 'MANUAL' | 'NLP' | 'LLM' | 'PATTERN_MATCHING' | 'API_INTEGRATION' | 'INFERENCE';
    tags: string[];
    aliases: string[];
    lastVerified?: string;
    verificationSource?: string;
  }
  
  export interface Relationship {
    id: string;
    sourceEntityId: string;
    targetEntityId: string;
    type: string;
    confidence: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    weight: number;
    metadata: RelationshipMetadata;
    tenantId: string;
    createdAt: string;
    updatedAt: string;
  }
  
  export interface RelationshipMetadata {
    source: string;
    extractionMethod: 'MANUAL' | 'NLP' | 'LLM' | 'PATTERN_MATCHING' | 'API_INTEGRATION' | 'INFERENCE';
    evidenceCount: number;
    isInferred: boolean;
    lastVerified?: string;
    verificationSource?: string;
  }
}

export namespace LLMRagAPI {
  export interface QueryRequest {
    query: string;
    context?: {
      tenantId: string;
      userId?: string;
      sessionId?: string;
    };
    options?: {
      maxResults?: number;
      includeMetadata?: boolean;
      searchDepth?: number;
      filters?: Record<string, any>;
    };
  }
  
  export interface QueryResponse {
    queryId: string;
    results: SearchResult[];
    metadata: QueryMetadata;
    suggestions?: string[];
    timestamp: string;
  }
  
  export interface QueryMetadata {
    processingTime: number;
    resultCount: number;
    confidence: number;
    intent?: string;
    entities?: ExtractedEntity[];
  }
  
  export interface SearchResult {
    id: string;
    content: string;
    score: number;
    metadata: Record<string, any>;
  }
  
  export interface ExtractedEntity {
    text: string;
    type: string;
    confidence: number;
    startIndex: number;
    endIndex: number;
  }
  
  export interface EmbeddingRequest {
    content: string;
    metadata?: Record<string, any>;
    tenantId: string;
  }
  
  export interface EmbeddingResponse {
    id: string;
    vector: number[];
    metadata: Record<string, any>;
    createdAt: string;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function generateTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateSpanId(): string {
  return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createApiKey(tenantId: string, permissions: Permission[]): string {
  const permissionString = permissions.join(',');
  const signature = Buffer.from(`${tenantId}:${permissionString}`).toString('base64');
  return `${tenantId}.${permissionString}.${signature}`;
}

export function parseApiKey(apiKey: string): ApiKeyConfig | null {
  try {
    const parts = apiKey.split('.');
    if (parts.length !== 3) return null;
    
    const [tenantId, permissionString, signature] = parts;
    const permissions = permissionString.split(',') as Permission[];
    
    return { tenantId, permissions, signature };
  } catch {
    return null;
  }
}

export function createServiceAuthKey(serviceName: string, environment: string): string {
  const signature = Buffer.from(`${serviceName}:${environment}:${Date.now()}`).toString('base64');
  return `service.${serviceName}.${environment}.${signature}`;
}

export function calculateRetryDelay(attempt: number, policy: RetryPolicy): number {
  const delay = Math.min(
    policy.baseDelay * Math.pow(policy.backoffMultiplier, attempt - 1),
    policy.maxDelay
  );
  
  if (policy.jitter) {
    return delay + Math.random() * delay * 0.1;
  }
  
  return delay;
}

export function shouldRetry(statusCode: number, policy: RetryPolicy): boolean {
  if (!policy.retryableStatusCodes) return false;
  return policy.retryableStatusCodes.includes(statusCode);
}

export function createTraceHeaders(context: TraceContext): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Trace-Id': context.traceId,
    'X-Span-Id': context.spanId
  };
  
  if (context.parentSpanId) {
    headers['X-Parent-Span-Id'] = context.parentSpanId;
  }
  
  if (context.baggage) {
    headers['X-Trace-Baggage'] = JSON.stringify(context.baggage);
  }
  
  return headers;
}

export function extractTraceContext(headers: Record<string, string>): TraceContext | null {
  const traceId = headers['X-Trace-Id'] || headers['x-trace-id'];
  const spanId = headers['X-Span-Id'] || headers['x-span-id'];
  
  if (!traceId || !spanId) return null;
  
  const parentSpanId = headers['X-Parent-Span-Id'] || headers['x-parent-span-id'];
  const baggageHeader = headers['X-Trace-Baggage'] || headers['x-trace-baggage'];
  
  let baggage: Record<string, string> | undefined;
  if (baggageHeader) {
    try {
      baggage = JSON.parse(baggageHeader);
    } catch {
      // Ignore invalid baggage
    }
  }
  
  return { traceId, spanId, parentSpanId, baggage };
}