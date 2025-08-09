import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import dotenv from 'dotenv';
import routes from './routes';
import { enforceTenantIsolation, generateApiKey } from './auth';
import { apiKeyAuth } from './middleware/auth.middleware';
import { ValidationError, NotFoundError, UnauthorizedError, TenantIsolationError, KnowledgeGraphError } from './types';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Security middleware
import { authenticateApiKey } from './auth';
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: process.env.CORS_CREDENTIALS === 'true',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later',
    timestamp: new Date()
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`${timestamp} - ${method} ${url} - ${ip}`);
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'CogniSync Knowledge Graph Service',
    version: process.env.npm_package_version || '1.0.0',
    documentation: `${req.protocol}://${req.get('host')}${API_PREFIX}/docs`,
    health: `${req.protocol}://${req.get('host')}${API_PREFIX}/health`,
    timestamp: new Date()
  });
});

// API documentation endpoint
app.get(API_PREFIX + '/docs', (req, res) => {
  res.json({
    success: true,
    message: 'CogniSync Knowledge Graph Service API Documentation',
    version: '1.0.0',
    baseUrl: `${req.protocol}://${req.get('host')}${API_PREFIX}`,
    authentication: {
      type: 'API Key',
      header: 'x-api-key',
      description: 'Include your API key in the x-api-key header'
    },
    endpoints: {
      health: {
        method: 'GET',
        path: '/health',
        description: 'Health check endpoint',
        authentication: false
      },
      entities: {
        create: { method: 'POST', path: '/entities', description: 'Create a new entity' },
        get: { method: 'GET', path: '/entities/:id', description: 'Get entity by ID' },
        update: { method: 'PUT', path: '/entities/:id', description: 'Update entity' },
        delete: { method: 'DELETE', path: '/entities/:id', description: 'Delete entity' },
        search: { method: 'GET', path: '/entities', description: 'Search entities' },
        relationships: { method: 'GET', path: '/entities/:id/relationships', description: 'Get entity relationships' },
        neighborhood: { method: 'GET', path: '/entities/:id/neighborhood', description: 'Get entity neighborhood' },
        bulkCreate: { method: 'POST', path: '/entities/bulk', description: 'Create multiple entities' }
      },
      relationships: {
        create: { method: 'POST', path: '/relationships', description: 'Create a new relationship' },
        delete: { method: 'DELETE', path: '/relationships/:id', description: 'Delete relationship' },
        bulkCreate: { method: 'POST', path: '/relationships/bulk', description: 'Create multiple relationships' }
      },
      analytics: {
        get: { method: 'GET', path: '/analytics', description: 'Get graph analytics' }
      }
    },
    examples: {
      createEntity: {
        method: 'POST',
        url: '/entities',
        headers: { 'x-api-key': 'your-api-key', 'Content-Type': 'application/json' },
        body: {
          type: 'DOCUMENT',
          name: 'API Documentation',
          description: 'Documentation for the Knowledge Graph API',
          properties: { format: 'markdown', version: '1.0' },
          metadata: {
            confidence: 'HIGH',
            importance: 'SIGNIFICANT',
            source: 'manual_entry',
            extractionMethod: 'MANUAL',
            tags: ['documentation', 'api'],
            aliases: ['docs', 'api-docs']
          }
        }
      },
      createRelationship: {
        method: 'POST',
        url: '/relationships',
        headers: { 'x-api-key': 'your-api-key', 'Content-Type': 'application/json' },
        body: {
          sourceEntityId: 'entity-id-1',
          targetEntityId: 'entity-id-2',
          type: 'REFERENCES',
          confidence: 'HIGH',
          weight: 0.8,
          metadata: {
            source: 'manual_entry',
            extractionMethod: 'MANUAL',
            evidenceCount: 1,
            isInferred: false
          }
        }
      }
    },
    timestamp: new Date()
  });
});

// Public health check (no authentication required)
app.get(API_PREFIX + '/health', routes);

// Management endpoints for API keys (development only)
if (process.env.NODE_ENV === 'development') {
  app.post('/admin/api-keys', (req, res) => {
    try {
      const { tenantId, permissions } = req.body;
      
      if (!tenantId || typeof tenantId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'tenantId is required and must be a string',
          timestamp: new Date()
        });
      }

      const apiKey = generateApiKey(tenantId, permissions || ['read', 'write']);
      
      return res.status(201).json({
        success: true,
        data: {
          apiKey,
          tenantId,
          permissions: permissions || ['read', 'write']
        },
        message: 'API key generated successfully',
        timestamp: new Date()
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
    }
  });
}

// Apply robust API key authentication middleware to protected routes (excluding /health)
app.use(API_PREFIX, (req, res, next) => {
  if (req.path === '/health') return next();
  return authenticateApiKey(req, res, next);
});
app.use(API_PREFIX, (req, res, next) => {
  if (req.path === '/health') return next();
  return enforceTenantIsolation(req, res, next);
});

// Main API routes
app.use(API_PREFIX, routes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.method} ${req.originalUrl} was not found`,
    documentation: `${req.protocol}://${req.get('host')}${API_PREFIX}/docs`,
    timestamp: new Date()
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('🚨 Error occurred:', error);

  // Handle known error types
  if (error instanceof ValidationError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
      field: error.field,
      timestamp: new Date()
    });
  }

  if (error instanceof NotFoundError || error instanceof UnauthorizedError || error instanceof TenantIsolationError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
      timestamp: new Date()
    });
  }

  if (error instanceof KnowledgeGraphError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
      timestamp: new Date()
    });
  }

  // Handle Prisma errors
  if (error.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry. A record with the same unique field already exists.',
      code: 'DUPLICATE_ENTRY',
      timestamp: new Date()
    });
  }

  if (error.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: 'Record not found',
      code: 'NOT_FOUND',
      timestamp: new Date()
    });
  }

  // Handle JSON parsing errors
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
      timestamp: new Date()
    });
  }

  // Generic error handler
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(isDevelopment && { details: error.message, stack: error.stack }),
    timestamp: new Date()
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 CogniSync Knowledge Graph Service started');
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌐 API available at http://localhost:${PORT}${API_PREFIX}`);
  console.log(`📚 Documentation at http://localhost:${PORT}${API_PREFIX}/docs`);
  console.log(`❤️  Health check at http://localhost:${PORT}${API_PREFIX}/health`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🔑 Development mode: Default API key available: kg-dev-key-12345');
    console.log('🔧 Admin API at http://localhost:${PORT}/admin/api-keys (POST)');
  }
  
  console.log(`🏢 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('✅ Service ready to accept requests');
});

export default app;
