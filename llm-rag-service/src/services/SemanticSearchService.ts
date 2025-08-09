import { PrismaClient } from '@prisma/client';
import { Pinecone } from '@pinecone-database/pinecone';
import { EmbeddingService } from './EmbeddingService';
import { 
  SearchRequest, 
  SearchResponse, 
  SearchFilters,
  ProcessingError,
  DocumentChunk
} from '../types';

export class SemanticSearchService {
  private prisma: PrismaClient;
  private embeddingService: EmbeddingService;
  private pinecone?: Pinecone;
  private pineconeIndex?: ReturnType<Pinecone['Index']>;
  private vectorProvider?: string;
  private vectorIndexName?: string;

  constructor() {
    this.prisma = new PrismaClient();
    this.embeddingService = new EmbeddingService();

    // Optional Vector DB (Pinecone) setup
    this.vectorProvider = process.env.VECTOR_DB_PROVIDER || process.env.SEMANTIC_INDEX_PROVIDER || 'pinecone';
    this.vectorIndexName = process.env.PINECONE_INDEX_NAME;
    const apiKey = process.env.PINECONE_API_KEY;

    if (this.vectorProvider === 'pinecone' && apiKey && this.vectorIndexName) {
      try {
        this.pinecone = new Pinecone({ apiKey });
        this.pineconeIndex = this.pinecone.Index(this.vectorIndexName);
      } catch (err) {
        console.warn('[VectorDB] Pinecone initialization failed:', err);
      }
    }
  }

  /**
   * Search documents using semantic similarity
   */
  async searchDocuments(
    query: string,
    tenantId: string,
    options: {
      limit?: number;
      threshold?: number;
      includeMetadata?: boolean;
      filters?: SearchFilters;
    } = {}
  ): Promise<SearchResponse> {
    const startTime = Date.now();
    const { limit = 10, threshold = 0.7, includeMetadata = false, filters } = options;

    try {
      // Create embedding for the search query
      const queryEmbedding = await this.embeddingService.createEmbedding(query);

      // Prefer Vector DB if configured, else fallback to local similarity
      let similarChunks: DocumentChunk[];
      if (this.pinecone && this.pineconeIndex) {
        similarChunks = await this.queryPinecone(queryEmbedding, tenantId, limit * 2, threshold);
      } else {
        similarChunks = await this.embeddingService.findSimilarDocuments(
          queryEmbedding,
          tenantId,
          limit * 2,
          threshold
        );
      }

      // Apply filters if provided
      let filteredChunks = similarChunks;
      if (filters) {
        filteredChunks = await this.applyFilters(similarChunks, filters, tenantId);
      }

      // Group chunks by document and select best chunk per document
      const documentMap = new Map<string, any>();
      
      for (const chunk of filteredChunks) {
        const existingDoc = documentMap.get(chunk.documentId);
        
        if (!existingDoc || (chunk.similarity && chunk.similarity > existingDoc.similarity)) {
          // Get full document details
          const document = await this.prisma.document.findUnique({
            where: { id: chunk.documentId },
            ...(includeMetadata && {
              include: {
                _count: {
                  select: { chunks: true }
                }
              }
            })
          });

          if (document) {
            documentMap.set(chunk.documentId, {
              id: document.id,
              title: document.title,
              content: chunk.content,
              relevanceScore: chunk.similarity,
              documentType: document.type,
              source: document.source,
              lastModified: document.updatedAt,
              chunkIndex: chunk.chunkIndex,
              metadata: includeMetadata ? {
                totalChunks: (document as any)._count?.chunks || 0,
                hasEmbeddings: document.hasEmbeddings,
                lastProcessed: document.lastProcessed,
                documentMetadata: JSON.parse(String(document.metadata || '{}'))
              } : undefined
            });
          }
        }
      }

      // Convert to array and limit results
      const documents = Array.from(documentMap.values())
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .slice(0, limit);

      const processingTime = Date.now() - startTime;

      return {
        documents,
        totalDocuments: documents.length,
        processingTime,
        searchMetadata: {
          query,
          threshold,
          totalChunksEvaluated: similarChunks.length,
          averageRelevance: documents.length > 0 
            ? documents.reduce((sum, doc) => sum + (doc.relevanceScore || 0), 0) / documents.length 
            : 0,
          filtersApplied: !!filters
        }
      };
    } catch (error) {
      console.error('Error in semantic search:', error);
      
      const processingError: ProcessingError = {
        type: 'processing',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'SEARCH_ERROR'
      };

      return {
        documents: [],
        totalDocuments: 0,
        processingTime: Date.now() - startTime,
        error: processingError,
        searchMetadata: {
          query,
          threshold,
          totalChunksEvaluated: 0,
          averageRelevance: 0,
          filtersApplied: false
        }
      };
    }
  }

  /**
   * Hybrid search combining semantic and keyword search
   */
  async hybridSearch(
    query: string,
    tenantId: string,
    options: {
      limit?: number;
      semanticWeight?: number;
      keywordWeight?: number;
      threshold?: number;
      includeMetadata?: boolean;
      filters?: SearchFilters;
    } = {}
  ): Promise<SearchResponse> {
    const startTime = Date.now();
    const { 
      limit = 10, 
      semanticWeight = 0.7, 
      keywordWeight = 0.3,
      threshold = 0.5,
      includeMetadata = false,
      filters 
    } = options;

    try {
      // Perform semantic search
      const semanticResults = await this.searchDocuments(query, tenantId, {
        limit: limit * 2,
        threshold: threshold * 0.8, // Lower threshold for semantic component
        includeMetadata,
        filters
      });

      // Perform keyword search
      const keywordResults = await this.keywordSearch(query, tenantId, {
        limit: limit * 2,
        includeMetadata,
        filters
      });

      // Combine and re-rank results
      const combinedResults = this.combineSearchResults(
        semanticResults.documents,
        keywordResults.documents,
        semanticWeight,
        keywordWeight
      );

      // Apply final filtering and limit
      const finalResults = combinedResults
        .filter(doc => doc.hybridScore >= threshold)
        .slice(0, limit)
        .map(doc => ({
          ...doc,
          relevanceScore: doc.hybridScore
        }));

      const processingTime = Date.now() - startTime;

      return {
        documents: finalResults,
        totalDocuments: finalResults.length,
        processingTime,
        searchMetadata: {
          query,
          threshold,
          totalChunksEvaluated: semanticResults.searchMetadata?.totalChunksEvaluated || 0,
          averageRelevance: finalResults.length > 0 
            ? finalResults.reduce((sum, doc) => sum + (doc.relevanceScore || 0), 0) / finalResults.length 
            : 0,
          filtersApplied: !!filters,
          searchType: 'hybrid',
          semanticWeight,
          keywordWeight
        }
      };
    } catch (error) {
      console.error('Error in hybrid search:', error);
      
      const processingError: ProcessingError = {
        type: 'processing',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'HYBRID_SEARCH_ERROR'
      };

      return {
        documents: [],
        totalDocuments: 0,
        processingTime: Date.now() - startTime,
        error: processingError,
        searchMetadata: {
          query,
          threshold,
          totalChunksEvaluated: 0,
          averageRelevance: 0,
          filtersApplied: false,
          searchType: 'hybrid'
        }
      };
    }
  }

  /**
   * Vector DB health check
   */
  async healthCheck(): Promise<void> {
    if (this.pinecone && this.pineconeIndex) {
      // A light operation to verify connectivity
      await this.pineconeIndex.describeIndexStats();
      return;
    }
    throw new Error('Vector DB not configured');
  }

  /**
   * Query Pinecone index and map to document chunks
   */
  private async queryPinecone(
    queryEmbedding: number[],
    tenantId: string,
    topK: number,
    threshold: number
  ): Promise<DocumentChunk[]> {
    if (!this.pineconeIndex) return [];

    const resp = await this.pineconeIndex.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter: { tenantId },
    });

    const matches = (resp.matches || []).filter(m => (m.score ?? 0) >= threshold);
    if (matches.length === 0) return [];

    const ids = matches.map(m => m.id);
    const chunks = await this.prisma.documentChunk.findMany({
      where: { id: { in: ids }, tenantId },
      select: {
        id: true,
        documentId: true,
        content: true,
        embedding: true,
        chunkIndex: true,
        metadata: true,
      }
    });

    const byId = new Map(chunks.map(c => [c.id, c]));
    return matches
      .map(m => byId.get(m.id))
      .filter((c): c is any => !!c)
      .map(c => ({
        id: c.id,
        documentId: c.documentId,
        content: c.content,
        embedding: JSON.parse(c.embedding as any),
        chunkIndex: c.chunkIndex,
        metadata: JSON.parse((c.metadata as any) || '{}'),
        similarity: (matches.find(m => m.id === c.id)?.score) || 0,
      }));
  }

  /**
   * Keyword-based search using full-text search
   */
  async keywordSearch(
    query: string,
    tenantId: string,
    options: {
      limit?: number;
      includeMetadata?: boolean;
      filters?: SearchFilters;
    } = {}
  ): Promise<SearchResponse> {
    const startTime = Date.now();
    const { limit = 10, includeMetadata = false, filters } = options;

    try {
      // Prepare search terms
      const searchTerms = query
        .toLowerCase()
        .split(/\s+/)
        .filter(term => term.length > 2)
        .join(' | '); // PostgreSQL full-text search OR syntax

      // Build where clause
      let whereClause: any = {
        tenantId,
        OR: [
          {
            title: {
              contains: query,
              mode: 'insensitive'
            }
          },
          {
            content: {
              contains: query,
              mode: 'insensitive'
            }
          }
        ]
      };

      // Apply filters
      if (filters) {
        whereClause = await this.buildFilteredWhereClause(whereClause, filters);
      }

      // Search documents
      const documents = await this.prisma.document.findMany({
        where: whereClause,
        orderBy: [
          { updatedAt: 'desc' },
          { title: 'asc' }
        ],
        take: limit,
        ...(includeMetadata && {
          include: {
            _count: {
              select: { chunks: true }
            }
          }
        })
      });

      // Calculate keyword relevance scores
      const resultsWithScores = documents.map(doc => {
        const titleScore = this.calculateKeywordScore(query, doc.title);
        const contentScore = this.calculateKeywordScore(query, doc.content.substring(0, 1000));
        const combinedScore = (titleScore * 2 + contentScore) / 3; // Weight title higher

        return {
          id: doc.id,
          title: doc.title,
          content: doc.content.substring(0, 500) + '...',
          relevanceScore: combinedScore,
          documentType: doc.type,
          source: doc.source,
          lastModified: doc.updatedAt,
          metadata: includeMetadata ? {
            totalChunks: (doc as any)._count?.chunks || 0,
            hasEmbeddings: doc.hasEmbeddings,
            lastProcessed: doc.lastProcessed,
            documentMetadata: JSON.parse(String(doc.metadata || '{}'))
          } : undefined
        };
      });

      const processingTime = Date.now() - startTime;

      return {
        documents: resultsWithScores,
        totalDocuments: resultsWithScores.length,
        processingTime,
        searchMetadata: {
          query,
          threshold: 0,
          totalChunksEvaluated: 0,
          averageRelevance: resultsWithScores.length > 0 
            ? resultsWithScores.reduce((sum, doc) => sum + (doc.relevanceScore || 0), 0) / resultsWithScores.length 
            : 0,
          filtersApplied: !!filters,
          searchType: 'keyword'
        }
      };
    } catch (error) {
      console.error('Error in keyword search:', error);
      
      const processingError: ProcessingError = {
        type: 'processing',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'KEYWORD_SEARCH_ERROR'
      };

      return {
        documents: [],
        totalDocuments: 0,
        processingTime: Date.now() - startTime,
        error: processingError,
        searchMetadata: {
          query,
          threshold: 0,
          totalChunksEvaluated: 0,
          averageRelevance: 0,
          filtersApplied: false,
          searchType: 'keyword'
        }
      };
    }
  }

  /**
   * Apply search filters to document chunks
   */
  private async applyFilters(
    chunks: DocumentChunk[],
    filters: SearchFilters,
    tenantId: string
  ): Promise<DocumentChunk[]> {
    if (!filters || Object.keys(filters).length === 0) {
      return chunks;
    }

    const documentIds = [...new Set(chunks.map(chunk => chunk.documentId))];
    
    let whereClause: any = {
      id: { in: documentIds },
      tenantId
    };

    whereClause = await this.buildFilteredWhereClause(whereClause, filters);

    const filteredDocuments = await this.prisma.document.findMany({
      where: whereClause,
      select: { id: true }
    });

    const filteredDocIds = new Set(filteredDocuments.map(doc => doc.id));
    
    return chunks.filter(chunk => filteredDocIds.has(chunk.documentId));
  }

  /**
   * Build filtered where clause for Prisma queries
   */
  private async buildFilteredWhereClause(baseWhere: any, filters: SearchFilters): Promise<any> {
    let whereClause = { ...baseWhere };

    if (filters.documentTypes && filters.documentTypes.length > 0) {
      whereClause.type = { in: filters.documentTypes };
    }

    if (filters.sources && filters.sources.length > 0) {
      whereClause.source = { in: filters.sources };
    }

    if (filters.dateRange) {
      whereClause.updatedAt = {};
      if (filters.dateRange.start) {
        whereClause.updatedAt.gte = filters.dateRange.start;
      }
      if (filters.dateRange.end) {
        whereClause.updatedAt.lte = filters.dateRange.end;
      }
    }

    if (filters.tags && filters.tags.length > 0) {
      // Assuming tags are stored in metadata JSON field
      whereClause.metadata = {
        contains: filters.tags.join('|') // Simple implementation
      };
    }

    return whereClause;
  }

  /**
   * Combine semantic and keyword search results
   */
  private combineSearchResults(
    semanticResults: any[],
    keywordResults: any[],
    semanticWeight: number,
    keywordWeight: number
  ): any[] {
    const combinedMap = new Map<string, any>();

    // Add semantic results
    semanticResults.forEach(doc => {
      combinedMap.set(doc.id, {
        ...doc,
        semanticScore: doc.relevanceScore || 0,
        keywordScore: 0,
        hybridScore: (doc.relevanceScore || 0) * semanticWeight
      });
    });

    // Add/update with keyword results
    keywordResults.forEach(doc => {
      const existing = combinedMap.get(doc.id);
      if (existing) {
        existing.keywordScore = doc.relevanceScore || 0;
        existing.hybridScore = existing.semanticScore * semanticWeight + (doc.relevanceScore || 0) * keywordWeight;
      } else {
        combinedMap.set(doc.id, {
          ...doc,
          semanticScore: 0,
          keywordScore: doc.relevanceScore || 0,
          hybridScore: (doc.relevanceScore || 0) * keywordWeight
        });
      }
    });

    return Array.from(combinedMap.values())
      .sort((a, b) => b.hybridScore - a.hybridScore);
  }

  /**
   * Calculate keyword relevance score
   */
  private calculateKeywordScore(query: string, text: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    const textLower = text.toLowerCase();
    
    let score = 0;
    const totalTerms = queryTerms.length;
    
    queryTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = textLower.match(regex);
      if (matches) {
        score += matches.length / totalTerms;
      }
    });

    // Normalize score (0-1 range)
    return Math.min(score, 1);
  }

  /**
   * Get search suggestions based on query history
   */
  async getSearchSuggestions(
    partialQuery: string,
    tenantId: string,
    limit: number = 5
  ): Promise<string[]> {
    try {
      const sessions = await this.prisma.querySession.findMany({
        where: {
          tenantId,
          query: {
            contains: partialQuery
          }
        },
        select: {
          query: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit * 2
      });

      // Get unique suggestions
      const suggestions = [...new Set(sessions.map(s => s.query))]
        .filter(query => query.toLowerCase().includes(partialQuery.toLowerCase()))
        .slice(0, limit);

      return suggestions;
    } catch (error) {
      console.error('Error getting search suggestions:', error);
      return [];
    }
  }

  /**
   * Clean up resources
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    await this.embeddingService.disconnect();
  }
}
