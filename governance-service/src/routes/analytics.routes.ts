import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, requirePermission } from '../middleware/auth.middleware';
import { enforceTenantIsolation } from '../middleware/tenant.middleware';
import { AnalyticsEngine } from '../services/analytics-engine.service';
import { logger, logAudit } from '../utils/logger';
import { ValidationError, NotFoundError } from '../middleware/error-handler';
import Joi from 'joi';

const router = Router();
const prisma = new PrismaClient();

// Initialize service
const analyticsEngine = new AnalyticsEngine(prisma, {} as any);

// Validation schemas
const createModelSchema = Joi.object({
  name: Joi.string().required().max(255),
  description: Joi.string().optional().max(1000),
  type: Joi.string().valid('CLASSIFICATION', 'REGRESSION', 'CLUSTERING', 'TIME_SERIES', 'ANOMALY_DETECTION').required(),
  config: Joi.object().required(),
});

const predictionSchema = Joi.object({
  modelId: Joi.string().required(),
  features: Joi.object().required(),
});

const trendAnalysisSchema = Joi.object({
  timeRange: Joi.object({
    start: Joi.date().required(),
    end: Joi.date().required(),
  }).required(),
  metrics: Joi.array().items(Joi.string()).required(),
  granularity: Joi.string().valid('hour', 'day', 'week', 'month').required(),
});

const anomalyDetectionSchema = Joi.object({
  metrics: Joi.array().items(Joi.string()).required(),
  timeRange: Joi.object({
    start: Joi.date().required(),
    end: Joi.date().required(),
  }).required(),
  sensitivity: Joi.string().valid('low', 'medium', 'high').required(),
});

// Apply middleware
router.use(enforceTenantIsolation);

// A068: Predictive Analytics and Insights Engine

// Get analytics models
router.get('/models', requirePermission('analytics:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const models = await prisma.analyticsModel.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: models,
    });
  } catch (error) {
    logger.error('Error fetching analytics models:', error);
    throw error;
  }
});

// Create analytics model
router.post('/models', requirePermission('analytics:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = createModelSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid model data', error.details);
    }

    const model = await analyticsEngine.createModel({
      ...value,
      tenantId: req.user!.tenantId,
    });

    logAudit('analytics_model_created', req.user!.userId, 'analytics_model', model.id, {
      name: model.name,
      type: model.type,
    });

    res.status(201).json({
      success: true,
      data: model,
    });
  } catch (error) {
    logger.error('Error creating analytics model:', error);
    throw error;
  }
});

// Train model
router.post('/models/:id/train', requirePermission('analytics:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await analyticsEngine.trainModel(req.params.id);

    logAudit('analytics_model_trained', req.user!.userId, 'analytics_model', req.params.id);

    res.json({
      success: true,
      message: 'Model training started',
    });
  } catch (error) {
    logger.error('Error training analytics model:', error);
    throw error;
  }
});

// Make prediction
router.post('/predict', requirePermission('analytics:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = predictionSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid prediction data', error.details);
    }

    const prediction = await analyticsEngine.makePrediction(value, req.user!.tenantId);

    logAudit('prediction_made', req.user!.userId, 'prediction', prediction.id, {
      modelId: value.modelId,
    });

    res.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    logger.error('Error making prediction:', error);
    throw error;
  }
});

// Batch predictions
router.post('/predict/batch', requirePermission('analytics:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { inputs } = req.body;

    if (!inputs || !Array.isArray(inputs)) {
      throw new ValidationError('Inputs array is required');
    }

    const predictions = await analyticsEngine.batchPredict(inputs, req.user!.tenantId);

    logAudit('batch_prediction_made', req.user!.userId, 'prediction', 'batch', {
      count: predictions.length,
    });

    res.json({
      success: true,
      data: predictions,
    });
  } catch (error) {
    logger.error('Error making batch predictions:', error);
    throw error;
  }
});

// Get insights
router.get('/insights', requirePermission('analytics:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, priority, isActive } = req.query;
    
    const where: any = { tenantId: req.user!.tenantId };
    
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (isActive !== undefined) where.isActive = isActive === 'true';

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
  } catch (error) {
    logger.error('Error fetching insights:', error);
    throw error;
  }
});

// Generate insights
router.post('/insights/generate', requirePermission('analytics:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const insights = await analyticsEngine.generateInsights(req.user!.tenantId);

    logAudit('insights_generated', req.user!.userId, 'insight', 'generation', {
      count: insights.length,
    });

    res.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    logger.error('Error generating insights:', error);
    throw error;
  }
});

// Analyze trends
router.post('/trends', requirePermission('analytics:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = trendAnalysisSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid trend analysis data', error.details);
    }

    const trends = await analyticsEngine.analyzeTrends(req.user!.tenantId, value);

    logAudit('trend_analysis_performed', req.user!.userId, 'analytics', 'trend_analysis', {
      metrics: value.metrics,
      timeRange: value.timeRange,
    });

    res.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    logger.error('Error analyzing trends:', error);
    throw error;
  }
});

// Detect anomalies
router.post('/anomalies', requirePermission('analytics:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = anomalyDetectionSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid anomaly detection data', error.details);
    }

    const anomalies = await analyticsEngine.detectAnomalies(req.user!.tenantId, value);

    logAudit('anomaly_detection_performed', req.user!.userId, 'analytics', 'anomaly_detection', {
      metrics: value.metrics,
      anomaliesFound: anomalies.length,
    });

    res.json({
      success: true,
      data: anomalies,
    });
  } catch (error) {
    logger.error('Error detecting anomalies:', error);
    throw error;
  }
});

// Get predictions for a model
router.get('/models/:id/predictions', requirePermission('analytics:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const predictions = await prisma.prediction.findMany({
      where: {
        modelId: req.params.id,
        tenantId: req.user!.tenantId,
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    res.json({
      success: true,
      data: predictions,
    });
  } catch (error) {
    logger.error('Error fetching model predictions:', error);
    throw error;
  }
});

// Get analytics metrics
router.get('/metrics', requirePermission('analytics:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      totalModels,
      totalPredictions,
      totalInsights,
      activeModels,
    ] = await Promise.all([
      prisma.analyticsModel.count({ where: { tenantId: req.user!.tenantId } }),
      prisma.prediction.count({ where: { tenantId: req.user!.tenantId } }),
      prisma.insight.count({ where: { tenantId: req.user!.tenantId } }),
      prisma.analyticsModel.count({ 
        where: { 
          tenantId: req.user!.tenantId,
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
  } catch (error) {
    logger.error('Error fetching analytics metrics:', error);
    throw error;
  }
});

export { router as analyticsRoutes };