"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRoutes = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const tenant_middleware_1 = require("../middleware/tenant.middleware");
const analytics_engine_service_1 = require("../services/analytics-engine.service");
const logger_1 = require("../utils/logger");
const error_handler_1 = require("../middleware/error-handler");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
exports.analyticsRoutes = router;
const prisma = new client_1.PrismaClient();
// Initialize service
const analyticsEngine = new analytics_engine_service_1.AnalyticsEngine(prisma, {});
// Validation schemas
const createModelSchema = joi_1.default.object({
    name: joi_1.default.string().required().max(255),
    description: joi_1.default.string().optional().max(1000),
    type: joi_1.default.string().valid('CLASSIFICATION', 'REGRESSION', 'CLUSTERING', 'TIME_SERIES', 'ANOMALY_DETECTION').required(),
    config: joi_1.default.object().required(),
});
const predictionSchema = joi_1.default.object({
    modelId: joi_1.default.string().required(),
    features: joi_1.default.object().required(),
});
const trendAnalysisSchema = joi_1.default.object({
    timeRange: joi_1.default.object({
        start: joi_1.default.date().required(),
        end: joi_1.default.date().required(),
    }).required(),
    metrics: joi_1.default.array().items(joi_1.default.string()).required(),
    granularity: joi_1.default.string().valid('hour', 'day', 'week', 'month').required(),
});
const anomalyDetectionSchema = joi_1.default.object({
    metrics: joi_1.default.array().items(joi_1.default.string()).required(),
    timeRange: joi_1.default.object({
        start: joi_1.default.date().required(),
        end: joi_1.default.date().required(),
    }).required(),
    sensitivity: joi_1.default.string().valid('low', 'medium', 'high').required(),
});
// Apply middleware
router.use(tenant_middleware_1.enforceTenantIsolation);
// A068: Predictive Analytics and Insights Engine
// Get analytics models
router.get('/models', (0, auth_middleware_1.requirePermission)('analytics:read'), async (req, res) => {
    try {
        const models = await prisma.analyticsModel.findMany({
            where: { tenantId: req.user.tenantId },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            data: models,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching analytics models:', error);
        throw error;
    }
});
// Create analytics model
router.post('/models', (0, auth_middleware_1.requirePermission)('analytics:write'), async (req, res) => {
    try {
        const { error, value } = createModelSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid model data', error.details);
        }
        const model = await analyticsEngine.createModel({
            ...value,
            tenantId: req.user.tenantId,
        });
        (0, logger_1.logAudit)('analytics_model_created', req.user.userId, 'analytics_model', model.id, {
            name: model.name,
            type: model.type,
        });
        res.status(201).json({
            success: true,
            data: model,
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating analytics model:', error);
        throw error;
    }
});
// Train model
router.post('/models/:id/train', (0, auth_middleware_1.requirePermission)('analytics:write'), async (req, res) => {
    try {
        await analyticsEngine.trainModel(req.params.id);
        (0, logger_1.logAudit)('analytics_model_trained', req.user.userId, 'analytics_model', req.params.id);
        res.json({
            success: true,
            message: 'Model training started',
        });
    }
    catch (error) {
        logger_1.logger.error('Error training analytics model:', error);
        throw error;
    }
});
// Make prediction
router.post('/predict', (0, auth_middleware_1.requirePermission)('analytics:read'), async (req, res) => {
    try {
        const { error, value } = predictionSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid prediction data', error.details);
        }
        const prediction = await analyticsEngine.makePrediction(value, req.user.tenantId);
        (0, logger_1.logAudit)('prediction_made', req.user.userId, 'prediction', prediction.id, {
            modelId: value.modelId,
        });
        res.json({
            success: true,
            data: prediction,
        });
    }
    catch (error) {
        logger_1.logger.error('Error making prediction:', error);
        throw error;
    }
});
// Batch predictions
router.post('/predict/batch', (0, auth_middleware_1.requirePermission)('analytics:read'), async (req, res) => {
    try {
        const { inputs } = req.body;
        if (!inputs || !Array.isArray(inputs)) {
            throw new error_handler_1.ValidationError('Inputs array is required');
        }
        const predictions = await analyticsEngine.batchPredict(inputs, req.user.tenantId);
        (0, logger_1.logAudit)('batch_prediction_made', req.user.userId, 'prediction', 'batch', {
            count: predictions.length,
        });
        res.json({
            success: true,
            data: predictions,
        });
    }
    catch (error) {
        logger_1.logger.error('Error making batch predictions:', error);
        throw error;
    }
});
// Get insights
router.get('/insights', (0, auth_middleware_1.requirePermission)('analytics:read'), async (req, res) => {
    try {
        const { type, priority, isActive } = req.query;
        const where = { tenantId: req.user.tenantId };
        if (type)
            where.type = type;
        if (priority)
            where.priority = priority;
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        const insights = await prisma.insight.findMany({
            where,
            include: {
                model: {
                    select: { id: true, name: true, type: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            data: insights,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching insights:', error);
        throw error;
    }
});
// Generate insights
router.post('/insights/generate', (0, auth_middleware_1.requirePermission)('analytics:write'), async (req, res) => {
    try {
        const insights = await analyticsEngine.generateInsights(req.user.tenantId);
        (0, logger_1.logAudit)('insights_generated', req.user.userId, 'insight', 'generation', {
            count: insights.length,
        });
        res.json({
            success: true,
            data: insights,
        });
    }
    catch (error) {
        logger_1.logger.error('Error generating insights:', error);
        throw error;
    }
});
// Analyze trends
router.post('/trends', (0, auth_middleware_1.requirePermission)('analytics:read'), async (req, res) => {
    try {
        const { error, value } = trendAnalysisSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid trend analysis data', error.details);
        }
        const trends = await analyticsEngine.analyzeTrends(req.user.tenantId, value);
        (0, logger_1.logAudit)('trend_analysis_performed', req.user.userId, 'analytics', 'trend_analysis', {
            metrics: value.metrics,
            timeRange: value.timeRange,
        });
        res.json({
            success: true,
            data: trends,
        });
    }
    catch (error) {
        logger_1.logger.error('Error analyzing trends:', error);
        throw error;
    }
});
// Detect anomalies
router.post('/anomalies', (0, auth_middleware_1.requirePermission)('analytics:read'), async (req, res) => {
    try {
        const { error, value } = anomalyDetectionSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid anomaly detection data', error.details);
        }
        const anomalies = await analyticsEngine.detectAnomalies(req.user.tenantId, value);
        (0, logger_1.logAudit)('anomaly_detection_performed', req.user.userId, 'analytics', 'anomaly_detection', {
            metrics: value.metrics,
            anomaliesFound: anomalies.length,
        });
        res.json({
            success: true,
            data: anomalies,
        });
    }
    catch (error) {
        logger_1.logger.error('Error detecting anomalies:', error);
        throw error;
    }
});
// Get predictions for a model
router.get('/models/:id/predictions', (0, auth_middleware_1.requirePermission)('analytics:read'), async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const predictions = await prisma.prediction.findMany({
            where: {
                modelId: req.params.id,
                tenantId: req.user.tenantId,
            },
            orderBy: { createdAt: 'desc' },
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit),
        });
        res.json({
            success: true,
            data: predictions,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching model predictions:', error);
        throw error;
    }
});
// Get analytics metrics
router.get('/metrics', (0, auth_middleware_1.requirePermission)('analytics:read'), async (req, res) => {
    try {
        const [totalModels, totalPredictions, totalInsights, activeModels,] = await Promise.all([
            prisma.analyticsModel.count({ where: { tenantId: req.user.tenantId } }),
            prisma.prediction.count({ where: { tenantId: req.user.tenantId } }),
            prisma.insight.count({ where: { tenantId: req.user.tenantId } }),
            prisma.analyticsModel.count({
                where: {
                    tenantId: req.user.tenantId,
                    status: { in: ['TRAINED', 'DEPLOYED'] },
                },
            }),
        ]);
        const metrics = {
            totalModels,
            totalPredictions,
            totalInsights,
            activeModels,
            modelAccuracy: {}, // Would be calculated from actual model performance
            insightCounts: {}, // Would be calculated from insight types
        };
        res.json({
            success: true,
            data: metrics,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching analytics metrics:', error);
        throw error;
    }
});
//# sourceMappingURL=analytics.routes.js.map