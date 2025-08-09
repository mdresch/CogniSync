import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/error-handler.js';

const router = Router();

// Health check endpoint
router.get('/', asyncHandler(async (req: any, res: any) => {
  const prisma: PrismaClient = req.app.locals.prisma;
  const startTime = Date.now();

  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    const dbStatus = 'up';
    
    // Test embedding service
    let embeddingStatus = 'up';
    try {
      const embeddingService = req.app.locals.embeddingService;
      if (embeddingService) {
        // Test with a simple embedding request
        await embeddingService.createEmbedding('health check');
      }
    } catch (error) {
      embeddingStatus = 'down';
      console.warn('Embedding service health check failed:', error);
    }

    // Test LLM service
    let llmStatus = 'up';
    try {
      const llmService = req.app.locals.llmQueryService;
      if (llmService) {
        // Test with a simple analysis
        await llmService.analyzeQuery('health check');
      }
    } catch (error) {
      llmStatus = 'down';
      console.warn('LLM service health check failed:', error);
    }

    // Test vector database
    let vectorDbStatus = 'up';
    try {
      const semanticSearchService = req.app.locals.semanticSearchService;
      if (semanticSearchService) {
        // Test vector database connection
  await semanticSearchService.healthCheck();
      }
    } catch (error) {
      vectorDbStatus = 'down';
      console.warn('Vector database health check failed:', error);
    }

    const responseTime = Date.now() - startTime;
    
    // Determine overall status
    const services = {
      database: dbStatus,
      llm: llmStatus,
      embeddings: embeddingStatus,
      vectorDB: vectorDbStatus,
    };

    const allUp = Object.values(services).every(status => status === 'up');
    const overallStatus = allUp ? 'healthy' : 'degraded';

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
      metrics: {
        responseTime,
        uptime: process.uptime(),
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        version: '1.0.0',
      },
      environment: process.env.NODE_ENV || 'development',
    });

  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'down',
        llm: 'unknown',
        embeddings: 'unknown',
        vectorDB: 'unknown',
      },
      error: 'Service health check failed',
      metrics: {
        responseTime: Date.now() - startTime,
        uptime: process.uptime(),
      },
    });
  }
}));

// Detailed health check
router.get('/detailed', asyncHandler(async (req: any, res: any) => {
  const prisma: PrismaClient = req.app.locals.prisma;
  const startTime = Date.now();

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {} as any,
    metrics: {} as any,
    diagnostics: {} as any,
  };

  // Database diagnostics
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbResponseTime = Date.now() - dbStart;
    
    // Get table counts
    const [querySessions, queryResults, embeddings] = await Promise.all([
      prisma.querySession.count(),
      prisma.queryResult.count(),
      prisma.documentEmbedding.count(),
    ]);

    health.services.database = 'up';
    health.diagnostics.database = {
      responseTime: dbResponseTime,
      tableStats: {
        querySessions,
        queryResults,
        embeddings,
      },
    };
  } catch (error) {
    health.services.database = 'down';
    health.diagnostics.database = {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    health.status = 'degraded';
  }

  // Embedding service diagnostics
  try {
    const embeddingStart = Date.now();
    const embeddingService = req.app.locals.embeddingService;
    
    if (embeddingService) {
      const testEmbedding = await embeddingService.createEmbedding('test query for health check');
      const embeddingResponseTime = Date.now() - embeddingStart;
      
      health.services.embeddings = 'up';
      health.diagnostics.embeddings = {
        responseTime: embeddingResponseTime,
        dimensions: testEmbedding.length,
        provider: process.env.EMBEDDING_PROVIDER || 'openai',
      };
    } else {
      throw new Error('Embedding service not initialized');
    }
  } catch (error) {
    health.services.embeddings = 'down';
    health.diagnostics.embeddings = {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    health.status = 'degraded';
  }

  // LLM service diagnostics
  try {
    const llmStart = Date.now();
    const llmService = req.app.locals.llmQueryService;
    
    if (llmService) {
      const analysis = await llmService.analyzeQuery('test health check query');
      const llmResponseTime = Date.now() - llmStart;
      
      health.services.llm = 'up';
      health.diagnostics.llm = {
        responseTime: llmResponseTime,
        provider: process.env.LLM_PROVIDER || 'openai',
        model: process.env.LLM_MODEL || 'gpt-3.5-turbo',
        analysisConfidence: analysis.intentConfidence,
      };
    } else {
      throw new Error('LLM service not initialized');
    }
  } catch (error) {
    health.services.llm = 'down';
    health.diagnostics.llm = {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    health.status = 'degraded';
  }

  // Vector database diagnostics
  try {
    const vectorStart = Date.now();
    const semanticSearchService = req.app.locals.semanticSearchService;
    
    if (semanticSearchService) {
      await semanticSearchService.healthCheck();
      const vectorResponseTime = Date.now() - vectorStart;
      
      health.services.vectorDB = 'up';
      health.diagnostics.vectorDB = {
        responseTime: vectorResponseTime,
        provider: process.env.VECTOR_DB_PROVIDER || 'pinecone',
        indexName: process.env.PINECONE_INDEX_NAME,
      };
    } else {
      throw new Error('Vector database service not initialized');
    }
  } catch (error) {
    health.services.vectorDB = 'down';
    health.diagnostics.vectorDB = {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    health.status = 'degraded';
  }

  // Overall metrics
  health.metrics = {
    totalResponseTime: Date.now() - startTime,
    uptime: process.uptime(),
    memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
    cpuUsage: process.cpuUsage(),
    version: '1.0.0',
    nodeVersion: process.version,
  };

  // Set HTTP status based on health
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
}));

// Readiness probe (for Kubernetes)
router.get('/ready', asyncHandler(async (req: any, res: any) => {
  const prisma: PrismaClient = req.app.locals.prisma;
  
  try {
    // Quick database check
    await prisma.$queryRaw`SELECT 1`;
    
    // Check if services are initialized
    const servicesReady = !!(
      req.app.locals.embeddingService &&
      req.app.locals.llmQueryService &&
      req.app.locals.semanticSearchService
    );

    if (!servicesReady) {
      throw new Error('Services not fully initialized');
    }

    res.json({
      ready: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

// Liveness probe (for Kubernetes)
router.get('/live', asyncHandler(async (req: any, res: any) => {
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}));

export default router;
