
import 'dotenv/config';
/**
 * Atlassian Sync Service Express Server
 * Handles incoming webhooks from Confluence and Jira
 */

import express from 'express';
import { apiKeyAuth } from './middleware/auth.middleware';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { AtlassianSyncService } from './services/atlassian-sync.service';

const app: express.Application = express();
const port = process.env.PORT || 3002;
const prisma = new PrismaClient();
const syncService = new AtlassianSyncService();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Health check (public)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'atlassian-sync-service',
    version: '1.0.0',
  });
});

// Service status endpoint (public)
app.get('/api/status', async (req, res) => {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    // Get basic statistics
    const stats = await Promise.all([
      prisma.syncEvent.count(),
      prisma.syncEvent.count({ where: { processingStatus: 'completed' } }),
      prisma.syncEvent.count({ where: { processingStatus: 'failed' } }),
      prisma.syncEvent.count({ where: { processingStatus: 'pending' } }),
      prisma.syncConfiguration.count({ where: { enabled: true } }),
      prisma.userMapping.count(),
      prisma.entityMapping.count(),
    ]);
  // ...existing code...
  } catch (error) {
    // ...existing code...
  }
});

// API key authentication for all /api and /webhooks routes (excluding /api/status)
app.use(['/api', '/webhooks'], (req, res, next) => {
  if (req.path === '/status') return next();
  return apiKeyAuth(req, res, next);
});

/**
 * Generic webhook endpoint for all Atlassian events
 * Route: POST /webhooks/:configId
 */
app.post('/webhooks/:configId', async (req, res) => {
  try {
    const { configId } = req.params;
    const signature = req.get('X-Hub-Signature-256') || req.get('X-Atlassian-Webhook-Signature');
    
    console.log(`Received webhook for config ${configId}:`, {
      eventType: req.body.eventType || req.body.webhookEvent,
      timestamp: new Date().toISOString(),
    });

    // Process the webhook
    const result = await syncService.processWebhookEvent(req.body, configId, signature);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        syncEventId: result.syncEventId,
      });
    } else {
      console.error(`Webhook processing failed for config ${configId}:`, result.error);
      res.status(422).json({
        success: false,
        error: result.error,
        message: 'Webhook processing failed',
      });
    }
  } catch (error) {
    console.error('Webhook endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      message: 'Failed to process webhook',
    });
  }
});

/**
 * Configuration management endpoints
 */

// List all sync configurations
app.get('/api/configurations', async (req, res) => {
  try {
    const { tenantId, source, enabled } = req.query;
    
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (source) where.source = source;
    if (enabled !== undefined) where.enabled = enabled === 'true';

    const configurations = await prisma.syncConfiguration.findMany({
      where,
      select: {
        id: true,
        name: true,
        tenantId: true,
        source: true,
        enabled: true,
        webhookUrl: true,
        mappingRules: true,
        filters: true,
        batchSize: true,
        retryLimit: true,
        retryDelay: true,
        createdAt: true,
        updatedAt: true,
        // Exclude sensitive fields
      },
    });

    res.json({
      success: true,
      data: configurations,
      count: configurations.length,
    });
  } catch (error) {
    console.error('Error fetching configurations:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create new sync configuration
app.post('/api/configurations', async (req, res) => {
  try {
    const {
      name,
      tenantId,
      source,
      webhookSecret,
      webhookUrl,
      kgServiceUrl,
      kgApiKey,
      mappingRules,
      filters,
      batchSize = 10,
      retryLimit = 3,
      retryDelay = 30000,
    } = req.body;

    // Validate required fields
    if (!name || !tenantId || !source || !webhookSecret || !kgApiKey || !mappingRules) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: name, tenantId, source, webhookSecret, kgApiKey, mappingRules',
      });
      return;
    }

    const configuration = await prisma.syncConfiguration.create({
      data: {
        name,
        tenantId,
        source,
        webhookSecret,
        webhookUrl,
        kgServiceUrl: kgServiceUrl || process.env.KNOWLEDGE_GRAPH_SERVICE_URL!,
        kgApiKey,
        mappingRules,
        filters,
        batchSize,
        retryLimit,
        retryDelay,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: configuration.id,
        name: configuration.name,
        tenantId: configuration.tenantId,
        source: configuration.source,
        webhookUrl: `/webhooks/${configuration.id}`,
        enabled: configuration.enabled,
      },
      message: 'Configuration created successfully',
    });
  } catch (error) {
    console.error('Error creating configuration:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update sync configuration
app.put('/api/configurations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData.id; // Prevent ID modification

    const configuration = await prisma.syncConfiguration.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      data: {
        id: configuration.id,
        name: configuration.name,
        enabled: configuration.enabled,
        updatedAt: configuration.updatedAt,
      },
      message: 'Configuration updated successfully',
    });
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete sync configuration
app.delete('/api/configurations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.syncConfiguration.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Configuration deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting configuration:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Sync events monitoring endpoints
 */

// List sync events
app.get('/api/events', async (req, res) => {
  try {
    const {
      tenantId,
      source,
      type,
      status,
      limit = '50',
      offset = '0',
      startDate,
      endDate,
    } = req.query;

    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (source) where.source = source;
    if (type) where.type = type;
    if (status) where.processingStatus = status;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }

    const events = await prisma.syncEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      select: {
        id: true,
        type: true,
        source: true,
        timestamp: true,
        actorId: true,
        entityId: true,
        externalId: true,
        processingStatus: true,
        errorMessage: true,
        retryCount: true,
        tenantId: true,
        kgEntityId: true,
        // Exclude large metadata field by default
      },
    });

    const totalCount = await prisma.syncEvent.count({ where });

    res.json({
      success: true,
      data: events,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: totalCount > parseInt(offset as string) + parseInt(limit as string),
      },
    });
  } catch (error) {
    console.error('Error fetching sync events:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get specific sync event details
app.get('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.syncEvent.findUnique({
      where: { id },
      include: {
        webhookDeliveries: {
          select: {
            id: true,
            eventType: true,
            receivedAt: true,
            processedAt: true,
            status: true,
            errorMessage: true,
          },
        },
      },
    });

    if (!event) {
      res.status(404).json({
        success: false,
        error: 'Sync event not found',
      });
      return;
    }

    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('Error fetching sync event:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Retry failed sync event
app.post('/api/events/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.syncEvent.findUnique({
      where: { id },
      include: {
        webhookDeliveries: {
          orderBy: { receivedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!event) {
      res.status(404).json({
        success: false,
        error: 'Sync event not found',
      });
      return;
    }

    if (event.processingStatus === 'completed') {
      res.status(400).json({
        success: false,
        error: 'Event has already been processed successfully',
      });
      return;
    }

    // Get the configuration for this event
    const config = await prisma.syncConfiguration.findFirst({
      where: {
        tenantId: event.tenantId,
        source: event.source,
      },
    });

    if (!config) {
      res.status(400).json({
        success: false,
        error: 'No valid configuration found for this event',
      });
      return;
    }

    // Retry the event
    const webhookPayload = event.webhookDeliveries[0]?.payload;
    const result = await syncService.processWebhookEvent(webhookPayload, config.id);

    res.json({
      success: true,
      data: {
        eventId: id,
        retryResult: result,
      },
      message: 'Event retry initiated',
    });
  } catch (error) {
    console.error('Error retrying sync event:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred',
  });
});

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Atlassian Sync Service listening on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🔧 Status endpoint: http://localhost:${port}/api/status`);
  console.log(`📥 Webhook endpoint pattern: http://localhost:${port}/webhooks/{configId}`);
  console.log(`🔑 Loaded API Key(s):`, process.env.VALID_API_KEYS);
});

export default app;
