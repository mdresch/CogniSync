"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
require("dotenv/config");
const express_1 = tslib_1.__importDefault(require("express"));
const auth_middleware_1 = require("./middleware/auth.middleware");
const cors_1 = tslib_1.__importDefault(require("cors"));
const helmet_1 = tslib_1.__importDefault(require("helmet"));
const express_rate_limit_1 = tslib_1.__importDefault(require("express-rate-limit"));
const client_1 = require("@prisma/client");
const atlassian_sync_service_1 = require("./services/atlassian-sync.service");
const app = (0, express_1.default)();
const port = process.env.PORT || 3002;
const prisma = new client_1.PrismaClient();
const atlassianSyncService = new atlassian_sync_service_1.AtlassianSyncService();
atlassianSyncService.startProcessing();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'atlassian-sync-service',
        version: '1.0.0',
    });
});
app.get('/api/status', async (req, res) => {
    try {
        await prisma.$queryRaw `SELECT 1`;
        const stats = await Promise.all([
            prisma.syncEvent.count(),
            prisma.syncEvent.count({ where: { processingStatus: 'completed' } }),
            prisma.syncEvent.count({ where: { processingStatus: 'failed' } }),
            prisma.syncEvent.count({ where: { processingStatus: 'pending' } }),
            prisma.syncConfiguration.count({ where: { enabled: true } }),
            prisma.userMapping.count(),
            prisma.entityMapping.count(),
        ]);
    }
    catch (error) {
    }
});
app.use(['/api', '/webhooks'], (req, res, next) => {
    if (req.path === '/status')
        return next();
    return (0, auth_middleware_1.apiKeyAuth)(req, res, next);
});
app.post('/webhooks/:configId', async (req, res) => {
    try {
        const { configId } = req.params;
        const signature = req.get('X-Hub-Signature-256') || req.get('X-Atlassian-Webhook-Signature');
        await atlassianSyncService.enqueueWebhookEvent(configId, req.body);
        res.status(202).json({
            success: true,
            message: 'Webhook event accepted for processing',
        });
    }
    catch (error) {
        console.error('Webhook enqueue error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
            message: 'Failed to enqueue webhook event',
        });
    }
});
app.get('/api/configurations', async (req, res) => {
    try {
        const { tenantId, source, enabled } = req.query;
        const where = {};
        if (tenantId)
            where.tenantId = tenantId;
        if (source)
            where.source = source;
        if (enabled !== undefined)
            where.enabled = enabled === 'true';
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
            },
        });
        res.json({
            success: true,
            data: configurations,
            count: configurations.length,
        });
    }
    catch (error) {
        console.error('Error fetching configurations:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
app.post('/api/configurations', async (req, res) => {
    try {
        const { name, tenantId, source, webhookSecret, webhookUrl, kgServiceUrl, kgApiKey, mappingRules, filters, batchSize = 10, retryLimit = 3, retryDelay = 30000, } = req.body;
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
                kgServiceUrl: kgServiceUrl || process.env.KNOWLEDGE_GRAPH_SERVICE_URL,
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
    }
    catch (error) {
        console.error('Error creating configuration:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
app.put('/api/configurations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };
        delete updateData.id;
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
    }
    catch (error) {
        console.error('Error updating configuration:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
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
    }
    catch (error) {
        console.error('Error deleting configuration:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
app.get('/api/events', async (req, res) => {
    try {
        const { tenantId, source, type, status, limit = '50', offset = '0', startDate, endDate, } = req.query;
        const where = {};
        if (tenantId)
            where.tenantId = tenantId;
        if (source)
            where.source = source;
        if (type)
            where.type = type;
        if (status)
            where.processingStatus = status;
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate)
                where.timestamp.gte = new Date(startDate);
            if (endDate)
                where.timestamp.lte = new Date(endDate);
        }
        const events = await prisma.syncEvent.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset),
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
            },
        });
        const totalCount = await prisma.syncEvent.count({ where });
        res.json({
            success: true,
            data: events,
            pagination: {
                total: totalCount,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: totalCount > parseInt(offset) + parseInt(limit),
            },
        });
    }
    catch (error) {
        console.error('Error fetching sync events:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
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
    }
    catch (error) {
        console.error('Error fetching sync event:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
app.post('/api/events/:id/retry', async (req, res) => {
    try {
        const { id } = req.params;
        const event = await prisma.syncEvent.findUnique({
            where: { id },
        });
        if (!event) {
            return res.status(404).json({ success: false, error: 'Sync event not found' });
        }
        if (event.processingStatus !== 'DEAD_LETTER') {
            return res.status(400).json({
                success: false,
                error: `Event is not in the dead-letter queue. Current status: ${event.processingStatus}`,
            });
        }
        await prisma.syncEvent.update({
            where: { id },
            data: {
                processingStatus: 'PENDING',
                retryCount: 0,
                logs: {
                    push: { timestamp: new Date(), status: 'REQUEUED', message: 'Manual retry triggered by user.' },
                },
            },
        });
        res.json({
            success: true,
            message: 'Event has been re-queued for processing.',
        });
    }
    catch (error) {
        console.error('Error retrying sync event:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred',
    });
});
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`,
    });
});
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
app.listen(port, () => {
    console.log(`🚀 Atlassian Sync Service listening on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`🔧 Status endpoint: http://localhost:${port}/api/status`);
    console.log(`📥 Webhook endpoint pattern: http://localhost:${port}/webhooks/{configId}`);
    console.log(`🔑 Loaded API Key(s):`, process.env.VALID_API_KEYS);
});
exports.default = app;
//# sourceMappingURL=server.js.map