import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { 
  QueryRequest, 
  QueryResponse, 
  EnhancedQueryContext, 
  ProcessingError,
  ExpandedQuery,
  AdvancedEntity
} from '../types';
import { EmbeddingService } from './EmbeddingService';
import { SemanticSearchService } from './SemanticSearchService';

export class LLMQueryService {
  private openai: OpenAI;
  private prisma: PrismaClient;
  private embeddingService: EmbeddingService;
  private searchService: SemanticSearchService;

  constructor() {
    if (process.env.AI_PROVIDER === 'azure') {
      this.openai = new OpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_CHAT_DEPLOYMENT}`,
        defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION },
        defaultHeaders: {
          'api-key': process.env.AZURE_OPENAI_API_KEY,
        },
      });
    } else {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || '',
      });
    }
    this.prisma = new PrismaClient();
    this.embeddingService = new EmbeddingService();
    this.searchService = new SemanticSearchService();
  }

  /**
   * Lightweight analysis for health checks and quick probes
   */
  async analyzeQuery(query: string): Promise<{ intent: string; intentConfidence: number }> {
    try {
      const ctx = await this.enhanceQueryContext(query, {}, 'default');
      return {
        intent: ctx.intent || 'technical',
        intentConfidence: ctx.confidenceScore || 0.5,
      };
    } catch {
      // Fall back without throwing to avoid failing health checks
      return { intent: 'technical', intentConfidence: 0.5 };
    }
  }

  /**
   * Process a query request and return enhanced response
   */
  async processQuery(request: QueryRequest): Promise<QueryResponse> {
    const startTime = Date.now();
    
    try {
      // Save initial query session
      const session = await this.prisma.querySession.create({
        data: {
          id: `session_${Date.now()}`,
          tenantId: request.tenantId,
          query: request.query,
          status: 'processing',
          metadata: JSON.stringify({
            userContext: request.context,
            requestTime: new Date().toISOString()
          })
        }
      });

      // Enhance the query context
      const enhancedContext = await this.enhanceQueryContext(
        request.query, 
        request.context,
        request.tenantId
      );

      // Perform semantic search
      const searchResults = await this.searchService.searchDocuments(
        request.query,
        request.tenantId,
        {
          limit: request.maxResults || 10,
          includeMetadata: true,
          filters: request.filters
        }
      );

      // Generate LLM response
      const llmResponse = await this.generateResponse(
        request.query,
        enhancedContext,
        searchResults.documents,
        request.tenantId
      );

      const processingTime = Date.now() - startTime;

      // Update session with results
      await this.prisma.querySession.update({
        where: { id: session.id },
        data: {
          response: llmResponse.content,
          status: 'completed',
          processingTime,
          metadata: JSON.stringify({
            ...JSON.parse(String(session.metadata || '{}')),
            enhancedContext,
            searchResults: searchResults.documents.length,
            completionTime: new Date().toISOString()
          })
        }
      });

      const response: QueryResponse = {
        sessionId: session.id,
        response: llmResponse.content,
        context: enhancedContext,
        sources: searchResults.documents.map(doc => ({
          documentId: doc.id,
          title: doc.title,
          relevanceScore: doc.relevanceScore || 0,
          excerpt: doc.content.substring(0, 200) + '...'
        })),
        processingTime,
        metadata: {
          totalDocuments: searchResults.totalDocuments,
          searchTime: searchResults.processingTime,
          llmTokens: llmResponse.usage?.total_tokens || 0,
          confidence: enhancedContext.confidenceScore
        }
      };

      return response;
    } catch (error) {
      console.error('Error processing query:', error);
      
      const processingError: ProcessingError = {
        type: 'processing',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'QUERY_PROCESSING_ERROR'
      };

      return {
        sessionId: '',
        response: 'I apologize, but I encountered an error while processing your query. Please try again.',
        context: {} as EnhancedQueryContext,
        sources: [],
        processingTime: Date.now() - startTime,
        error: processingError,
        metadata: {}
      };
    }
  }

  /**
   * Enhance query context using LLM analysis
   */
  async enhanceQueryContext(
    query: string,
    baseContext: any,
    tenantId: string
  ): Promise<EnhancedQueryContext> {
    const startTime = Date.now();

    try {
      // Analyze query intent and extract entities
      const analysisPrompt = `
        Analyze the following query and provide structured analysis:
        Query: "${query}"
        
        Please identify:
        1. Intent (business/technical/project/requirements/status)
        2. Key entities mentioned
        3. Important keywords
        4. Urgency level (low/medium/high)
        5. Complexity (simple/moderate/complex)
        6. Suggested query expansions
        
        Respond in JSON format.
      `;

      const model = process.env.AI_PROVIDER === 'azure' 
        ? process.env.AZURE_OPENAI_CHAT_DEPLOYMENT!
        : 'gpt-4';

      const response = await this.openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: 'You are an expert query analyzer. Respond only with valid JSON.' },
          { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      // Create embedding for semantic search
      const queryEmbedding = await this.embeddingService.createEmbedding(query);

      // Extract advanced entities
      const entities: AdvancedEntity[] = (analysis.entities || []).map((entity: any) => ({
        name: entity.name || entity,
        type: entity.type || 'unknown',
        confidence: entity.confidence || 0.8,
        metadata: entity.metadata || {}
      }));

      // Create expanded query
      const expandedQuery: ExpandedQuery = {
        original: query,
        expanded: analysis.expandedQuery || query,
        synonyms: analysis.synonyms || [],
        relatedTerms: analysis.relatedTerms || [],
        suggestions: analysis.suggestions || []
      };

      const processingTime = Date.now() - startTime;

      const enhancedContext: EnhancedQueryContext = {
        intent: analysis.intent || 'technical',
        entities,
        keywords: analysis.keywords || [],
        urgency: analysis.urgency || 'medium',
        complexity: analysis.complexity || 'moderate',
        expandedQuery,
        semanticEmbedding: queryEmbedding,
        confidenceScore: analysis.confidence || 0.8,
        processingMetadata: {
          originalLength: query.length,
          expandedLength: expandedQuery.expanded.length,
          entitiesFound: entities.length,
          processingTime
        }
      };

      return enhancedContext;
    } catch (error) {
      console.error('Error enhancing query context:', error);
      
      // Return basic context if enhancement fails
      const queryEmbedding = await this.embeddingService.createEmbedding(query);
      
      return {
        intent: 'technical',
        entities: [],
        keywords: query.split(' ').filter(word => word.length > 3),
        urgency: 'medium',
        complexity: 'moderate',
        expandedQuery: {
          original: query,
          expanded: query,
          synonyms: [],
          relatedTerms: [],
          suggestions: []
        },
        semanticEmbedding: queryEmbedding,
        confidenceScore: 0.5,
        processingMetadata: {
          originalLength: query.length,
          expandedLength: query.length,
          entitiesFound: 0,
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Generate LLM response based on context and search results
   */
  async generateResponse(
    query: string,
    context: EnhancedQueryContext,
    documents: any[],
    tenantId: string
  ): Promise<{ content: string; usage?: any }> {
    try {
      // Get tenant configuration for response customization
      const tenantConfig = await this.prisma.lLMConfiguration.findFirst({
        where: { tenantId }
      });

      // Prepare context from relevant documents
      const documentContext = documents.slice(0, 5).map(doc => 
        `Document: ${doc.title}\nContent: ${doc.content.substring(0, 500)}...`
      ).join('\n\n');

      // Create system prompt based on tenant configuration
      const systemPrompt = tenantConfig?.systemPrompt || `
        You are an AI assistant specializing in API management and technical documentation.
        Provide accurate, helpful responses based on the provided context.
        Be concise but comprehensive, and always cite your sources when possible.
      `;

      // Create user prompt with context
      const userPrompt = `
        Query: ${query}
        
        Context Information:
        - Intent: ${context.intent}
        - Complexity: ${context.complexity}
        - Key Entities: ${context.entities.map(e => e.name).join(', ')}
        
        Relevant Documents:
        ${documentContext}
        
        Please provide a comprehensive answer based on the available information.
        If the information is insufficient, please indicate what additional details would be helpful.
      `;

      const model = process.env.AI_PROVIDER === 'azure' 
        ? process.env.AZURE_OPENAI_CHAT_DEPLOYMENT!
        : (tenantConfig?.model || 'gpt-4');

      const response = await this.openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: tenantConfig?.temperature || 0.7,
        max_tokens: tenantConfig?.maxTokens || 2000
      });

      return {
        content: response.choices[0].message.content || 'No response generated',
        usage: response.usage
      };
    } catch (error) {
      console.error('Error generating LLM response:', error);
      return {
        content: 'I apologize, but I encountered an error while generating a response. Please try rephrasing your query.'
      };
    }
  }

  /**
   * Get query history for a tenant
   */
  async getQueryHistory(
    tenantId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    sessions: any[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const [sessions, total] = await Promise.all([
        this.prisma.querySession.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
          select: {
            id: true,
            query: true,
            response: true,
            status: true,
            processingTime: true,
            createdAt: true,
            metadata: true
          }
        }),
        this.prisma.querySession.count({
          where: { tenantId }
        })
      ]);

      return {
        sessions: sessions.map(session => ({
          ...session,
          metadata: JSON.parse(String(session.metadata || '{}'))
        })),
        total,
        hasMore: offset + limit < total
      };
    } catch (error) {
      console.error('Error getting query history:', error);
      throw error;
    }
  }

  /**
   * Get query analytics
   */
  async getQueryAnalytics(
    tenantId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{
    totalQueries: number;
    averageProcessingTime: number;
    successRate: number;
    topIntents: Array<{ intent: string; count: number }>;
    topEntities: Array<{ entity: string; count: number }>;
  }> {
    try {
      const sessions = await this.prisma.querySession.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end
          }
        }
      });

      const totalQueries = sessions.length;
      const successfulQueries = sessions.filter(s => s.status === 'completed').length;
      const averageProcessingTime = sessions.reduce((sum, s) => sum + (s.processingTime || 0), 0) / totalQueries;

      // Analyze intents and entities from metadata
      const intents: Record<string, number> = {};
      const entities: Record<string, number> = {};

      sessions.forEach(session => {
        try {
          const metadata = JSON.parse(String(session.metadata || '{}'));
          const context = metadata.enhancedContext;
          
          if (context?.intent) {
            intents[context.intent] = (intents[context.intent] || 0) + 1;
          }

          if (context?.entities) {
            context.entities.forEach((entity: AdvancedEntity) => {
              entities[entity.name] = (entities[entity.name] || 0) + 1;
            });
          }
        } catch (error) {
          // Skip sessions with invalid metadata
        }
      });

      return {
        totalQueries,
        averageProcessingTime: Math.round(averageProcessingTime),
        successRate: totalQueries > 0 ? Math.round((successfulQueries / totalQueries) * 100) : 0,
        topIntents: Object.entries(intents)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([intent, count]) => ({ intent, count })),
        topEntities: Object.entries(entities)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([entity, count]) => ({ entity, count }))
      };
    } catch (error) {
      console.error('Error getting query analytics:', error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    await this.embeddingService.disconnect();
    await this.searchService.disconnect();
  }
}
