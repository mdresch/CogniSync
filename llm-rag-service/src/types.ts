/**
 * Core Types and Interfaces for LLM/RAG Service
 */

// Core search result interface
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

// Enhanced search result with semantic information
export interface EnhancedSearchResult extends SearchResult {
  semanticSimilarity: number;
  entityMatches: AdvancedEntity[];
  confidenceBreakdown: {
    textMatch: number;
    entityMatch: number;
    semanticMatch: number;
    contextMatch: number;
  };
}

// Processing error type
export interface ProcessingError {
  type: 'validation' | 'processing' | 'network' | 'authentication' | 'rate_limit';
  message: string;
  code: string;
  details?: Record<string, any>;
}

// Document chunk for embeddings
export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  chunkIndex: number;
  metadata: {
    length: number;
    wordCount: number;
    processingTime: number;
  };
  similarity?: number;
}

// Embedding metrics
export interface EmbeddingMetrics {
  totalDocuments: number;
  embeddedDocuments: number;
  totalChunks: number;
  averageChunksPerDocument: number;
  embeddingCoverage: number;
}

// Search filters
export interface SearchFilters {
  documentTypes?: string[];
  sources?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  tags?: string[];
}

// Search request and response
export interface SearchRequest {
  query: string;
  tenantId: string;
  filters?: SearchFilters;
  limit?: number;
  threshold?: number;
  includeMetadata?: boolean;
}

export interface SearchResponse {
  documents: any[];
  totalDocuments: number;
  processingTime: number;
  error?: ProcessingError;
  searchMetadata?: {
    query: string;
    threshold: number;
    totalChunksEvaluated: number;
    averageRelevance: number;
    filtersApplied: boolean;
    searchType?: string;
    semanticWeight?: number;
    keywordWeight?: number;
  };
}

// Expanded query information  
export interface ExpandedQuery {
  original: string;
  expanded: string;
  synonyms: string[];
  relatedTerms: string[];
  suggestions: string[];
  contextualPhrases?: string[];
  domainSpecificTerms?: string[];
  confidence?: number;
}

// Advanced entity with enhanced properties
export interface AdvancedEntity {
  name: string;
  type: 'person' | 'project' | 'technology' | 'concept' | 'location' | 'organization' | 'custom' | string;
  confidence: number;
  startPosition?: number;
  endPosition?: number;
  context?: string;
  metadata: Record<string, any>;
}

// Query context and analysis
export interface QueryContext {
  intent: 'business' | 'technical' | 'project' | 'requirements' | 'status';
  entities: string[];
  keywords: string[];
  urgency: 'low' | 'medium' | 'high';
  complexity: 'simple' | 'moderate' | 'complex';
}

// Enhanced query context with LLM analysis
export interface EnhancedQueryContext {
  intent: 'business' | 'technical' | 'project' | 'requirements' | 'status';
  entities: AdvancedEntity[];
  keywords: string[];
  urgency: 'low' | 'medium' | 'high';
  complexity: 'simple' | 'moderate' | 'complex';
  expandedQuery: ExpandedQuery;
  semanticEmbedding: number[];
  confidenceScore: number;
  processingMetadata: {
    originalLength: number;
    expandedLength: number;
    entitiesFound: number;
    processingTime: number;
  };
}

// LLM query analysis
export interface LLMQueryAnalysis {
  originalQuery: string;
  analysisTimestamp: Date;
  
  // Query Understanding
  interpretedIntent: QueryIntent;
  intentConfidence: number;
  queryComplexity: 'simple' | 'moderate' | 'complex';
  queryType: 'factual' | 'procedural' | 'analytical' | 'comparative' | 'troubleshooting';
  
  // Query Decomposition
  subQueries: string[];
  primaryFocus: string;
  secondaryTopics: string[];
  
  // Enhanced Entity Recognition
  llmExtractedEntities: LLMEntity[];
  entityRelationships: EntityRelationship[];
  
  // Query Enhancement
  rewrittenQuery: string;
  expandedQueries: string[];
  contextualQueries: string[];
  
  // Semantic Understanding
  semanticCategories: string[];
  domainSpecificTerms: string[];
  technicalLevel: 'beginner' | 'intermediate' | 'advanced';
  
  // Response Guidance
  expectedResponseType: 'documentation' | 'code_example' | 'explanation' | 'status_update' | 'comparison';
  suggestedSources: ('confluence' | 'jira' | 'knowledge_graph' | 'external')[];
  recommendedFollowUps: string[];
}

// LLM-specific entity type
export interface LLMEntity extends AdvancedEntity {
  llmConfidence: number;
  semanticType: string;
  contextualMeaning: string;
  synonyms: string[];
  relatedConcepts: string[];
}

// Entity relationships
export interface EntityRelationship {
  sourceEntity: string;
  targetEntity: string;
  relationship: string;
  confidence: number;
  context: string;
}

// Query intent enumeration
export type QueryIntent = 'business' | 'technical' | 'project' | 'requirements' | 'status' | 'analytical' | 'comparative';

// Document for embedding
export interface Document {
  id: string;
  text: string;
  title?: string;
  url?: string;
  source?: string;
  metadata?: Record<string, any>;
}

// Vector embedding
export interface Embedding {
  id: string;
  vector: number[];
  metadata?: Record<string, any>;
}

// Semantic search request
export interface SemanticSearchRequest {
  query: string;
  tenantId?: string;
  filters?: {
    source?: string[];
    contentType?: string[];
    dateRange?: {
      start?: string;
      end?: string;
    };
    tags?: string[];
  };
  limit?: number;
  threshold?: number;
}

// Semantic search response
export interface SemanticSearchResponse {
  results: EnhancedSearchResult[];
  totalResults: number;
  processingTime: number;
  queryAnalysis: LLMQueryAnalysis;
  suggestions?: string[];
}

// Configuration interfaces
export interface LLMConfig {
  provider: 'openai' | 'azure' | 'anthropic';
  model: string;
  apiKey: string;
  endpoint?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface EmbeddingConfig {
  provider: 'openai' | 'azure';
  model: string;
  apiKey?: string;
  endpoint?: string;
  dimensions?: number;
}

export interface VectorDBConfig {
  provider: 'pinecone' | 'weaviate' | 'qdrant';
  apiKey: string;
  environment?: string;
  indexName: string;
  dimensions?: number;
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
}

// Service configuration
export interface RAGServiceConfig {
  tenantId: string;
  llm: LLMConfig;
  embedding: EmbeddingConfig;
  vectorDB: VectorDBConfig;
  knowledgeGraphUrl?: string;
  knowledgeGraphApiKey?: string;
  processing?: {
    chunkSize?: number;
    chunkOverlap?: number;
    maxResults?: number;
    similarityThreshold?: number;
    rerankingEnabled?: boolean;
  };
}

// API request/response types
export interface QueryRequest {
  query: string;
  tenantId: string;
  sessionId?: string;
  userId?: string;
  context?: any;
  maxResults?: number;
  filters?: SearchFilters;
  options?: {
    includeAnalysis?: boolean;
    includeSuggestions?: boolean;
    maxResults?: number;
    sources?: string[];
  };
}

export interface QueryResponse {
  sessionId: string;
  response: string;
  context: EnhancedQueryContext;
  sources: Array<{
    documentId: string;
    title: string;
    relevanceScore: number;
    excerpt: string;
  }>;
  processingTime: number;
  error?: ProcessingError;
  metadata: {
    totalDocuments?: number;
    searchTime?: number;
    llmTokens?: number;
    confidence?: number;
    [key: string]: any;
  };
}

// Bulk operations
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

// Analytics types
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

// Error types
export interface RAGError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Health check response
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    llm: 'up' | 'down';
    embeddings: 'up' | 'down';
    vectorDB: 'up' | 'down';
    knowledgeGraph?: 'up' | 'down';
  };
  metrics?: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}
