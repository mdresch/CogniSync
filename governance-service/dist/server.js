"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wss = exports.prisma = exports.server = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const client_1 = require("@prisma/client");
const http_1 = require("http");
const ws_1 = require("ws");
// Import routes
const workflow_routes_1 = require("./routes/workflow.routes");
const user_routes_1 = require("./routes/user.routes");
const document_routes_1 = require("./routes/document.routes");
const notification_routes_1 = require("./routes/notification.routes");
const data_routes_1 = require("./routes/data.routes");
const dashboard_routes_1 = require("./routes/dashboard.routes");
const report_routes_1 = require("./routes/report.routes");
const analytics_routes_1 = require("./routes/analytics.routes");
const health_routes_1 = require("./routes/health.routes");
// Import middleware
const auth_middleware_1 = require("./middleware/auth.middleware");
const error_handler_1 = require("./middleware/error-handler");
const request_logger_1 = require("./middleware/request-logger");
const tenant_middleware_1 = require("./middleware/tenant.middleware");
// Import services
const notification_service_1 = require("./services/notification.service");
const workflow_engine_service_1 = require("./services/workflow-engine.service");
const analytics_engine_service_1 = require("./services/analytics-engine.service");
const reporting_service_1 = require("./services/reporting.service");
// Import utilities
const logger_1 = require("./utils/logger");
const config_1 = require("./utils/config");
const app = (0, express_1.default)();
exports.app = app;
const server = (0, http_1.createServer)(app);
exports.server = server;
const wss = new ws_1.WebSocketServer({ server });
exports.wss = wss;
// Initialize Prisma client
const prisma = new client_1.PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});
exports.prisma = prisma;
// Initialize services
let notificationService;
let workflowEngine;
let analyticsEngine;
let reportingService;
// Security middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));
app.use((0, cors_1.default)({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
}));
app.use((0, compression_1.default)());
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Request logging
app.use(request_logger_1.requestLogger);
// Tenant isolation middleware
app.use(tenant_middleware_1.tenantMiddleware);
// Health check endpoint (no auth required)
app.use('/health', health_routes_1.healthRoutes);
// Authentication middleware for protected routes
app.use('/api', auth_middleware_1.authMiddleware);
// API routes
const API_PREFIX = '/api/v1';
app.use(`${API_PREFIX}/workflows`, workflow_routes_1.workflowRoutes);
app.use(`${API_PREFIX}/users`, user_routes_1.userRoutes);
app.use(`${API_PREFIX}/documents`, document_routes_1.documentRoutes);
app.use(`${API_PREFIX}/notifications`, notification_routes_1.notificationRoutes);
app.use(`${API_PREFIX}/data`, data_routes_1.dataRoutes);
app.use(`${API_PREFIX}/dashboards`, dashboard_routes_1.dashboardRoutes);
app.use(`${API_PREFIX}/reports`, report_routes_1.reportRoutes);
app.use(`${API_PREFIX}/analytics`, analytics_routes_1.analyticsRoutes);
// WebSocket connection handling
wss.on('connection', (ws, request) => {
    logger_1.logger.info('New WebSocket connection established');
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
        }
        catch (error) {
            logger_1.logger.error('WebSocket message error:', error);
            ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
    });
    ws.on('close', () => {
        logger_1.logger.info('WebSocket connection closed');
    });
    ws.on('error', (error) => {
        logger_1.logger.error('WebSocket error:', error);
    });
});
// Error handling middleware (must be last)
app.use(error_handler_1.errorHandler);
// Initialize services
async function initializeServices() {
    try {
        logger_1.logger.info('Initializing governance services...');
        notificationService = new notification_service_1.NotificationService(prisma, wss);
        workflowEngine = new workflow_engine_service_1.WorkflowEngine(prisma, notificationService);
        analyticsEngine = new analytics_engine_service_1.AnalyticsEngine(prisma, wss);
        reportingService = new reporting_service_1.ReportingService(prisma, notificationService);
        // Start background services
        await workflowEngine.start();
        await analyticsEngine.start();
        await reportingService.start();
        logger_1.logger.info('All governance services initialized successfully');
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize services:', error);
        process.exit(1);
    }
}
// Graceful shutdown
async function gracefulShutdown() {
    logger_1.logger.info('Shutting down governance service...');
    try {
        // Stop background services
        if (workflowEngine)
            await workflowEngine.stop();
        if (analyticsEngine)
            await analyticsEngine.stop();
        if (reportingService)
            await reportingService.stop();
        // Close database connection
        await prisma.$disconnect();
        // Close WebSocket server
        wss.close();
        // Close HTTP server
        server.close(() => {
            logger_1.logger.info('Governance service shut down successfully');
            process.exit(0);
        });
    }
    catch (error) {
        logger_1.logger.error('Error during shutdown:', error);
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
        const port = config_1.config.port || 3004;
        server.listen(port, () => {
            logger_1.logger.info(`Governance service running on port ${port}`);
            logger_1.logger.info(`Environment: ${config_1.config.nodeEnv}`);
            logger_1.logger.info(`API endpoints available at: http://localhost:${port}${API_PREFIX}`);
            logger_1.logger.info(`Health check available at: http://localhost:${port}/health`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught exception:', error);
    gracefulShutdown();
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    gracefulShutdown();
});
// Start the server
startServer();
//# sourceMappingURL=server.js.map