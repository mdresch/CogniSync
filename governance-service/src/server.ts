import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// Import routes
import { workflowRoutes } from './routes/workflow.routes';
import { userRoutes } from './routes/user.routes';
import { documentRoutes } from './routes/document.routes';
import { notificationRoutes } from './routes/notification.routes';
import { dataRoutes } from './routes/data.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { reportRoutes } from './routes/report.routes';
import { analyticsRoutes } from './routes/analytics.routes';
import { healthRoutes } from './routes/health.routes';

// Import middleware
import { authMiddleware } from './middleware/auth.middleware';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { tenantMiddleware } from './middleware/tenant.middleware';

// Import services
import { NotificationService } from './services/notification.service';
import { WorkflowEngine } from './services/workflow-engine.service';
import { AnalyticsEngine } from './services/analytics-engine.service';
import { ReportingService } from './services/reporting.service';

// Import utilities
import { logger } from './utils/logger';
import { config } from './utils/config';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Initialize Prisma client
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Initialize services
let notificationService: NotificationService;
let workflowEngine: WorkflowEngine;
let analyticsEngine: AnalyticsEngine;
let reportingService: ReportingService;

// Security middleware
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

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Tenant isolation middleware
app.use(tenantMiddleware);

// Health check endpoint (no auth required)
app.use('/health', healthRoutes);

// Authentication middleware for protected routes
app.use('/api', authMiddleware);

// API routes
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/workflows`, workflowRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/documents`, documentRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/data`, dataRoutes);
app.use(`${API_PREFIX}/dashboards`, dashboardRoutes);
app.use(`${API_PREFIX}/reports`, reportRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);

// WebSocket connection handling
wss.on('connection', (ws, request) => {
  logger.info('New WebSocket connection established');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'subscribe_notifications':
          // Subscribe to real-time notifications
          await notificationService.subscribeToNotifications(ws, data.userId);
          break;
        case 'subscribe_workflow_updates':
          // Subscribe to workflow status updates
          await workflowEngine.subscribeToUpdates(ws, data.workflowId);
          break;
        case 'subscribe_analytics':
          // Subscribe to real-time analytics updates
          await analyticsEngine.subscribeToUpdates(ws, data.dashboardId);
          break;
        default:
          ws.send(JSON.stringify({ error: 'Unknown message type' }));
      }
    } catch (error) {
      logger.error('WebSocket message error:', error);
      ws.send(JSON.stringify({ error: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize services
async function initializeServices() {
  try {
    logger.info('Initializing governance services...');
    
    notificationService = new NotificationService(prisma, wss);
    workflowEngine = new WorkflowEngine(prisma, notificationService);
    analyticsEngine = new AnalyticsEngine(prisma, wss);
    reportingService = new ReportingService(prisma, notificationService);

    // Start background services
    await workflowEngine.start();
    await analyticsEngine.start();
    await reportingService.start();
    
    logger.info('All governance services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown() {
  logger.info('Shutting down governance service...');
  
  try {
    // Stop background services
    if (workflowEngine) await workflowEngine.stop();
    if (analyticsEngine) await analyticsEngine.stop();
    if (reportingService) await reportingService.stop();
    
    // Close database connection
    await prisma.$disconnect();
    
    // Close WebSocket server
    wss.close();
    
    // Close HTTP server
    server.close(() => {
      logger.info('Governance service shut down successfully');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
async function startServer() {
  try {
    await initializeServices();
    
    const port = config.port || 3004;
    server.listen(port, () => {
      logger.info(`Governance service running on port ${port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`API endpoints available at: http://localhost:${port}${API_PREFIX}`);
      logger.info(`Health check available at: http://localhost:${port}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

// Start the server
startServer();

export { app, server, prisma, wss };