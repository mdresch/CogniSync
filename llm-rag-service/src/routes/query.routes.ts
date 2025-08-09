import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requireTenant, requireScope } from '../middleware/auth.middleware.js';
import { SemanticSearchService } from '../services/SemanticSearchService';
import { LLMQueryService } from '../services/LLMQueryService';
import { AnalyticsService } from '../services/AnalyticsService';
import { QueryRequest, QueryResponse } from '../types.js';

const router = Router();

// Apply authentication middleware
router.use(requireTenant);

// Convenience endpoint: process a single query
router.post('/', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const llmQueryService: LLMQueryService = req.app.locals.llmQueryService;
  const analyticsService: AnalyticsService = req.app.locals.analyticsService;

  const {
    query,
    context,
    sessionId,
    userId,
    includeContext = true,
    maxSources = 5,
    requireAnalytics = false,
  } = req.body || {};

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'Query is required and must be a non-empty string', code: 'INVALID_QUERY' });
  }

  const startTime = Date.now();
  const request: QueryRequest = {
    query,
    tenantId: req.tenantId,
    sessionId,
    userId,
    context,
    maxResults: maxSources,
    options: { includeAnalysis: includeContext !== false, includeSuggestions: false, maxResults: maxSources }
  } as any;

  try {
    const result = await llmQueryService.processQuery(request);

    // Track analytics success
    await analyticsService.trackQuery({
      sessionId: result.sessionId,
      query,
      tenantId: req.tenantId,
      userId,
      status: 'completed',
      processingTime: result.processingTime,
    });

    // Map to test-friendly shape
    const responsePayload: any = {
      sessionId: result.sessionId,
      response: result.response,
      confidence: result.metadata?.confidence,
      processingTime: result.processingTime,
      sources: result.sources || [],
    };

    if (includeContext) {
      responsePayload.enhancedContext = result.context;
      // Provide a lightweight analysis view from context
      responsePayload.analysis = {
        complexity: result.context?.complexity,
        intent: result.context?.intent,
        entities: result.context?.entities || [],
      };
    }

    if (requireAnalytics) {
      responsePayload.analytics = { enabled: true };
      responsePayload.metrics = {
        totalDocuments: result.metadata?.totalDocuments || 0,
        searchTime: result.metadata?.searchTime || 0,
        llmTokens: result.metadata?.llmTokens || 0,
      };
    }

    res.json(responsePayload);
  } catch (error) {
    // Track failed query
    await analyticsService.trackQuery({
      sessionId: sessionId || `failed-${Date.now()}`,
      query,
      tenantId: req.tenantId,
      userId,
      status: 'failed',
      processingTime: Date.now() - startTime,
      errorCode: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}));

// Semantic search endpoint
router.post('/search', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const semanticSearchService: SemanticSearchService = req.app.locals.semanticSearchService;
  const llmQueryService: LLMQueryService = req.app.locals.llmQueryService;
  const analyticsService: AnalyticsService = req.app.locals.analyticsService;
  
  const queryRequest: QueryRequest = {
    query: req.body.query,
    tenantId: req.tenantId,
    sessionId: req.body.sessionId,
    userId: req.userId,
    context: req.body.context,
    options: {
      includeAnalysis: req.body.includeAnalysis !== false, // Default to true
      includeSuggestions: req.body.includeSuggestions !== false, // Default to true
      maxResults: req.body.maxResults || 10,
      sources: req.body.sources,
    },
  };

  // Validate required fields
  if (!queryRequest.query || typeof queryRequest.query !== 'string') {
    return res.status(400).json({
      error: 'Query is required and must be a string',
      code: 'INVALID_QUERY',
    });
  }

  if (queryRequest.query.trim().length === 0) {
    return res.status(400).json({
      error: 'Query cannot be empty',
      code: 'EMPTY_QUERY',
    });
  }

  if (queryRequest.query.length > 5000) {
    return res.status(400).json({
      error: 'Query too long (max 5000 characters)',
      code: 'QUERY_TOO_LONG',
    });
  }

  const startTime = Date.now();

  try {
    const response = await llmQueryService.processQuery(queryRequest);
    
    // Track analytics
    await analyticsService.trackQuery({
      sessionId: response.sessionId,
      query: queryRequest.query,
      tenantId: queryRequest.tenantId!,
      userId: queryRequest.userId,
      status: 'completed',
      processingTime: response.metadata.processingTime,
    });

    res.json(response);
  } catch (error) {
    // Track failed query
    await analyticsService.trackQuery({
      sessionId: queryRequest.sessionId || `failed-${Date.now()}`,
      query: queryRequest.query,
      tenantId: queryRequest.tenantId!,
      userId: queryRequest.userId,
      status: 'failed',
      processingTime: Date.now() - startTime,
      errorCode: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}));

// Query analysis endpoint
router.post('/analyze', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const llmQueryService: LLMQueryService = req.app.locals.llmQueryService;
  
  const { query } = req.body;

  // Validate input
  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      error: 'Query is required and must be a string',
      code: 'INVALID_QUERY',
    });
  }

  if (query.trim().length === 0) {
    return res.status(400).json({
      error: 'Query cannot be empty',
      code: 'EMPTY_QUERY',
    });
  }

  const startTime = Date.now();

  try {
    // Simple query analysis - can be enhanced later
    const analysis = {
      query,
      length: query.length,
      complexity: query.split(' ').length > 5 ? 'high' : query.split(' ').length > 2 ? 'medium' : 'low',
      keywords: query.toLowerCase().split(' ').filter(word => word.length > 3),
      timestamp: new Date().toISOString()
    };
    
    res.json({
      query,
      analysis,
      metadata: {
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    throw error;
  }
}));

// Get search suggestions
router.post('/suggestions', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const semanticSearchService: SemanticSearchService = req.app.locals.semanticSearchService;
  
  const { query, limit = 5 } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      error: 'Query is required and must be a string',
      code: 'INVALID_QUERY',
    });
  }

  const startTime = Date.now();

  try {
    // Simple query suggestions - can be enhanced later
    const suggestions = [
      `What is ${query}?`,
      `How does ${query} work?`,
      `Examples of ${query}`,
      `Best practices for ${query}`,
      `${query} documentation`
    ].filter(s => s !== query).slice(0, Math.min(limit, 20));
    
    res.json({
      query,
      suggestions,
      metadata: {
        count: suggestions.length,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    throw error;
  }
}));

// Get query history for a tenant
router.get('/history', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const analyticsService: AnalyticsService = req.app.locals.analyticsService;
  const { limit = 50, offset = 0 } = req.query;

  try {
    const history = await analyticsService.getQueryHistory({
      tenantId: req.tenantId,
      limit: Math.min(parseInt(limit as string) || 50, 100),
      offset: parseInt(offset as string) || 0,
    });
    
    res.json({
      history: history.sessions,
      metadata: {
        total: history.total,
        limit: Math.min(parseInt(limit as string) || 50, 100),
        offset: parseInt(offset as string) || 0,
        hasMore: history.hasMore,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    throw error;
  }
}));

// Clear query history for a session
router.delete('/history/:sessionId', requireScope('write'), asyncHandler(async (req: any, res: any) => {
  const analyticsService: AnalyticsService = req.app.locals.analyticsService;
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({
      error: 'Session ID is required',
      code: 'MISSING_SESSION_ID',
    });
  }

  try {
    const deleted = await analyticsService.clearQueryHistory({
      tenantId: req.tenantId,
    });
    
    res.json({
      message: 'Query history cleared successfully',
      deleted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    throw error;
  }
}));

// Batch search endpoint
router.post('/batch', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const semanticSearchService: SemanticSearchService = req.app.locals.semanticSearchService;
  const llmQueryService: LLMQueryService = req.app.locals.llmQueryService;
  const { queries, options = {} } = req.body;

  if (!Array.isArray(queries)) {
    return res.status(400).json({
      error: 'Queries must be an array',
      code: 'INVALID_QUERIES',
    });
  }

  if (queries.length === 0) {
    return res.status(400).json({
      error: 'At least one query is required',
      code: 'EMPTY_QUERIES',
    });
  }

  if (queries.length > 10) {
    return res.status(400).json({
      error: 'Maximum 10 queries allowed per batch',
      code: 'TOO_MANY_QUERIES',
    });
  }

  // Validate each query
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: `Query at index ${i} is invalid`,
        code: 'INVALID_QUERY_IN_BATCH',
      });
    }
  }

  const startTime = Date.now();

  try {
    const results = await Promise.allSettled(
      queries.map((query: string, index: number) => 
        llmQueryService.processQuery({
          query,
          tenantId: req.tenantId,
          sessionId: `batch-${Date.now()}-${index}`,
          userId: req.userId,
          maxResults: Math.min(options.maxResults || 5, 20),
          options: {
            includeAnalysis: options.includeAnalysis !== false,
            includeSuggestions: false, // Disable suggestions for batch
            maxResults: Math.min(options.maxResults || 5, 20),
          },
        })
      )
    );

    const responses = results.map((result, index) => ({
      query: queries[index],
      success: result.status === 'fulfilled',
      ...(result.status === 'fulfilled' 
        ? { data: result.value }
        : { error: result.reason instanceof Error ? result.reason.message : 'Unknown error' }
      ),
    }));

    const successCount = responses.filter(r => r.success).length;
    const failureCount = responses.length - successCount;

    res.json({
      results: responses,
      metadata: {
        total: queries.length,
        successful: successCount,
        failed: failureCount,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    throw error;
  }
}));

export default router;
