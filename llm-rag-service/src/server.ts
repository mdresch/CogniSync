import express from 'express';
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

// Health check endpoint (before auth)
app.use('/health', healthRoutes);

// API key authentication middleware for all /api routes
app.use('/api', authMiddleware);

// API routes
app.use('/api/query', queryRoutes);
app.use('/api/embeddings', embeddingRoutes);
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

    app.listen(port, () => {
      console.log('🚀 LLM/RAG Service started');
      console.log(`📡 Server running on http://localhost:${port}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔑 API Authentication: ${process.env.DISABLE_AUTH === 'true' ? 'Disabled' : 'Enabled'}`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📋 Available endpoints:');
        console.log('  - GET  /health              - Health check');
        console.log('  - POST /api/query/search    - Semantic search');
        console.log('  - POST /api/query/analyze   - Query analysis');
        console.log('  - POST /api/embeddings/create - Create embeddings');
        console.log('  - POST /api/embeddings/bulk   - Bulk create embeddings');
        console.log('  - GET  /api/analytics/overview - Analytics overview');
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
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught Exception:', error);
  await prisma.$disconnect();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  await prisma.$disconnect();
  process.exit(1);
});

// Start the server
startServer().catch(async (error) => {
  console.error('💥 Failed to start server:', error);
  await prisma.$disconnect();
  process.exit(1);
});

export { app, prisma };
