// IndexingService integration
import { IndexingService } from './services/indexing.service';
let indexingService: IndexingService | undefined;

// MessageBusService integration
import { messageBusService } from './services/message-bus.service';
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Services
import { EmbeddingService } from './services/EmbeddingService';
import { LLMQueryService } from './services/LLMQueryService';
import { SemanticSearchService } from './services/SemanticSearchService';
import { AnalyticsService } from './services/AnalyticsService';

// Routes
import queryRoutes from './routes/query.routes.js';
import embeddingRoutes from './routes/embedding.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import llmRoutes from './routes/llm.routes.js';
import healthRoutes from './routes/health.routes.js';

// Middleware
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { authMiddleware } from './middleware/auth.middleware';

// Load environment variables
dotenv.config();

// Initialize Prisma
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Initialize services
let embeddingService: EmbeddingService;
let llmQueryService: LLMQueryService;
let semanticSearchService: SemanticSearchService;
let analyticsService: AnalyticsService;

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3003;

// Security and middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.openai.com", "https://*.pinecone.io"],
    },
  },
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// --- WebSocket Server Setup ---
import { logger } from './utils/logger';
import { RAGService } from './services/rag.service';
const PORT = process.env.PORT || 3003;
const wss = new WebSocketServer({ server });
const ragService = new RAGService();
logger.info('🚀 WebSocket server initialized');

// Type annotation for ws
wss.on('connection', (ws: WebSocket) => {
  logger.info('✅ Client connected via WebSocket');

  ws.on('message', async (message: Buffer) => {
    try {
      const parsed = JSON.parse(message.toString());
      logger.info({ receivedQuery: parsed.query }, 'Received query via WebSocket');

      if (parsed.query && typeof parsed.query === 'string') {
        // Hand off the query to the RAG service to handle the entire pipeline
        ragService.processQueryStream(parsed.query, ws);
      } else {
        throw new Error('Invalid query format. Message must be a JSON object with a "query" string property.');
      }

    } catch (error: any) {
      logger.error({ error: error.message }, 'Error parsing incoming WebSocket message');
      ws.send(JSON.stringify({ type: 'error', message: error.message || 'Invalid message format.' }));
    }
  });

  ws.on('close', () => {
    logger.info('⚪ Client disconnected');
  });
});
// --- End WebSocket Server Setup ---

// Health check endpoint (before auth)
app.use('/health', healthRoutes);

// API key authentication middleware for all /api routes
app.use('/api', authMiddleware);

// API routes
app.use('/api/query', queryRoutes);
app.use('/api/embeddings', embeddingRoutes);

app.use('/api/llm', llmRoutes);
app.use('/api/analytics', analyticsRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'LLM/RAG Service',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /health',
      'POST /api/query/search',
      'POST /api/query/analyze',
      'POST /api/embeddings/create',
      'POST /api/embeddings/bulk',
      'GET /api/embeddings/:id',
      'DELETE /api/embeddings/:id',
      'GET /api/analytics/overview',
      'GET /api/analytics/queries',
      'POST /api/llm/completion',
    ],
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// Initialize services
async function initializeServices() {
  try {
    console.log('🔧 Initializing services...');

    // Initialize services
    embeddingService = new EmbeddingService();
    llmQueryService = new LLMQueryService();
    semanticSearchService = new SemanticSearchService();
    analyticsService = new AnalyticsService();

    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Make services available to routes
    app.locals.embeddingService = embeddingService;
    app.locals.llmQueryService = llmQueryService;
    app.locals.semanticSearchService = semanticSearchService;
    app.locals.analyticsService = analyticsService;
    app.locals.prisma = prisma;

    console.log('✅ All services initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    await initializeServices();

    server.listen(port, async () => {
      logger.info('🚀 LLM/RAG Service started');
      logger.info(`📡 Server running on http://localhost:${port}`);
      logger.info(`👂 WebSocket listening on ws://localhost:${port}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔑 API Authentication: ${process.env.DISABLE_AUTH === 'true' ? 'Disabled' : 'Enabled'}`);
      if (process.env.NODE_ENV === 'development') {
        logger.info('📋 Available endpoints:');
        logger.info('  - GET  /health              - Health check');
        logger.info('  - POST /api/query/search    - Semantic search');
        logger.info('  - POST /api/query/analyze   - Query analysis');
        logger.info('  - POST /api/embeddings/create - Create embeddings');
        logger.info('  - POST /api/embeddings/bulk   - Bulk create embeddings');
        logger.info('  - GET  /api/analytics/overview - Analytics overview');
        logger.info('  - POST /api/llm/completion    - Direct LLM completion');
      }
      // Start IndexingService
      indexingService = new IndexingService();
      try {
        await indexingService.start();
        logger.info('IndexingService started successfully');
      } catch (err) {
        logger.error('Failed to start IndexingService: ' + (err instanceof Error ? err.message : String(err)));
      }

      // Start MessageBusService
      try {
        await messageBusService.start();
        logger.info('MessageBusService started successfully');
      } catch (err) {
        logger.error('Failed to start MessageBusService: ' + (err instanceof Error ? err.message : String(err)));
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  if (indexingService) {
    try {
      await indexingService.stop();
      logger.info('IndexingService stopped successfully');
    } catch (err) {
  logger.error('Error stopping IndexingService: ' + (err instanceof Error ? err.message : String(err)));
    }
  }
  
  try {
    await messageBusService.stop();
    logger.info('MessageBusService stopped successfully');
  } catch (err) {
    logger.error('Error stopping MessageBusService: ' + (err instanceof Error ? err.message : String(err)));
  }
  
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  if (indexingService) {
    try {
      await indexingService.stop();
      logger.info('IndexingService stopped successfully');
    } catch (err) {
  logger.error('Error stopping IndexingService: ' + (err instanceof Error ? err.message : String(err)));
    }
  }
  
  try {
    await messageBusService.stop();
    logger.info('MessageBusService stopped successfully');
  } catch (err) {
    logger.error('Error stopping MessageBusService: ' + (err instanceof Error ? err.message : String(err)));
  }
  
  await prisma.$disconnect();
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught Exception:', error);
  if (indexingService) {
    try {
      await indexingService.stop();
      logger.info('IndexingService stopped successfully');
    } catch (err) {
  logger.error('Error stopping IndexingService: ' + (err instanceof Error ? err.message : String(err)));
    }
  }
  
  try {
    await messageBusService.stop();
    logger.info('MessageBusService stopped successfully');
  } catch (err) {
    logger.error('Error stopping MessageBusService: ' + (err instanceof Error ? err.message : String(err)));
  }
  
  await prisma.$disconnect();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  if (indexingService) {
    try {
      await indexingService.stop();
      logger.info('IndexingService stopped successfully');
    } catch (err) {
  logger.error('Error stopping IndexingService: ' + (err instanceof Error ? err.message : String(err)));
    }
  }
  
  try {
    await messageBusService.stop();
    logger.info('MessageBusService stopped successfully');
  } catch (err) {
    logger.error('Error stopping MessageBusService: ' + (err instanceof Error ? err.message : String(err)));
  }
  
  await prisma.$disconnect();
  process.exit(1);
});

// Start the server
startServer().catch(async (error) => {
  console.error('💥 Failed to start server:', error);
  try {
    await messageBusService.stop();
  } catch (err) {
    logger.error('Error stopping MessageBusService during startup failure: ' + (err instanceof Error ? err.message : String(err)));
  }
  await prisma.$disconnect();
  process.exit(1);
});

export { app, prisma };
