import { PrismaClient, AnalyticsModel, Prediction, Insight, AnalyticsModelType, AnalyticsModelStatus, InsightType, Priority } from '@prisma/client';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import cron from 'cron';
import { logger } from '../utils/logger';

export interface ModelConfig {
  algorithm: string;
  parameters: any;
  features: string[];
  target?: string;
  trainingData?: any;
}

export interface PredictionInput {
  features: Record<string, any>;
  modelId: string;
}

export interface InsightGeneration {
  type: InsightType;
  title: string;
  description: string;
  data: any;
  priority: Priority;
  modelId?: string;
}

export interface AnalyticsMetrics {
  totalPredictions: number;
  modelAccuracy: Record<string, number>;
  insightCounts: Record<string, number>;
  trendAnalysis: any;
  anomalies: any[];
}

export class AnalyticsEngine extends EventEmitter {
  private prisma: PrismaClient;
  private wss: WebSocketServer;
  private models: Map<string, AnalyticsModel> = new Map();
  private cronJobs: Map<string, cron.CronJob> = new Map();
  private wsConnections: Map<string, WebSocket[]> = new Map();

  constructor(prisma: PrismaClient, wss: WebSocketServer) {
    super();
    this.prisma = prisma;
    this.wss = wss;
  }

  async start(): Promise<void> {
    logger.info('Starting Analytics Engine...');
    
    // Load existing models
    await this.loadModels();
    
    // Start scheduled analytics tasks
    this.startScheduledTasks();
    
    logger.info('Analytics Engine started successfully');
  }

  async stop(): Promise<void> {
    logger.info('Stopping Analytics Engine...');
    
    // Stop all cron jobs
    this.cronJobs.forEach(job => job.stop());
    this.cronJobs.clear();
    
    // Clear models cache
    this.models.clear();
    
    logger.info('Analytics Engine stopped');
  }

  // A068: Predictive Analytics
  async createModel(modelData: {
    name: string;
    description?: string;
    type: AnalyticsModelType;
    config: ModelConfig;
    tenantId: string;
  }): Promise<AnalyticsModel> {
    try {
      const model = await this.prisma.analyticsModel.create({
        data: {
          name: modelData.name,
          description: modelData.description,
          type: modelData.type,
          config: modelData.config as any,
          status: AnalyticsModelStatus.TRAINING,
          tenantId: modelData.tenantId,
        },
      });

      // Cache the model
      this.models.set(model.id, model);

      // Start training process
      await this.trainModel(model.id);

      logger.info(`Analytics model created: ${model.id} (${model.name})`);
      return model;
    } catch (error) {
      logger.error('Error creating analytics model:', error);
      throw error;
    }
  }

  async trainModel(modelId: string): Promise<void> {
    try {
      const model = await this.prisma.analyticsModel.findUnique({
        where: { id: modelId },
      });

      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }

      // Update status to training
      await this.prisma.analyticsModel.update({
        where: { id: modelId },
        data: { status: AnalyticsModelStatus.TRAINING },
      });

      // Simulate training process (in real implementation, this would use ML libraries)
      const trainingData = await this.prepareTrainingData(model);
      const trainedModel = await this.performTraining(model, trainingData);

      // Update model with training results
      const updatedModel = await this.prisma.analyticsModel.update({
        where: { id: modelId },
        data: {
          status: AnalyticsModelStatus.TRAINED,
          accuracy: trainedModel.accuracy,
          lastTrained: new Date(),
          config: trainedModel.config as any,
        },
      });

      // Update cache
      this.models.set(modelId, updatedModel);

      // Emit training completed event
      this.emit('modelTrained', { model: updatedModel });

      logger.info(`Model training completed: ${modelId} (accuracy: ${trainedModel.accuracy})`);
    } catch (error) {
      logger.error('Error training model:', error);
      
      // Update model status to failed
      await this.prisma.analyticsModel.update({
        where: { id: modelId },
        data: { status: AnalyticsModelStatus.FAILED },
      });
      
      throw error;
    }
  }

  async makePrediction(input: PredictionInput, tenantId: string): Promise<Prediction> {
    try {
      const model = await this.getModel(input.modelId);
      
      if (!model || model.tenantId !== tenantId) {
        throw new Error('Model not found or access denied');
      }

      if (model.status !== AnalyticsModelStatus.TRAINED && model.status !== AnalyticsModelStatus.DEPLOYED) {
        throw new Error('Model is not ready for predictions');
      }

      // Perform prediction
      const predictionResult = await this.performPrediction(model, input.features);

      // Store prediction
      const prediction = await this.prisma.prediction.create({
        data: {
          modelId: input.modelId,
          input: input.features as any,
          output: predictionResult.output as any,
          confidence: predictionResult.confidence,
          tenantId,
        },
      });

      logger.info(`Prediction made: ${prediction.id} (confidence: ${predictionResult.confidence})`);
      return prediction;
    } catch (error) {
      logger.error('Error making prediction:', error);
      throw error;
    }
  }

  async batchPredict(inputs: PredictionInput[], tenantId: string): Promise<Prediction[]> {
    try {
      const predictions = await Promise.all(
        inputs.map(input => this.makePrediction(input, tenantId))
      );

      logger.info(`Batch prediction completed: ${predictions.length} predictions`);
      return predictions;
    } catch (error) {
      logger.error('Error in batch prediction:', error);
      throw error;
    }
  }

  // A068: Trend Analysis
  async analyzeTrends(tenantId: string, options: {
    timeRange: { start: Date; end: Date };
    metrics: string[];
    granularity: 'hour' | 'day' | 'week' | 'month';
  }): Promise<any> {
    try {
      const trends = {};

      for (const metric of options.metrics) {
        trends[metric] = await this.calculateTrend(metric, tenantId, options);
      }

      // Generate trend insights
      await this.generateTrendInsights(trends, tenantId);

      logger.info(`Trend analysis completed for tenant: ${tenantId}`);
      return trends;
    } catch (error) {
      logger.error('Error analyzing trends:', error);
      throw error;
    }
  }

  private async calculateTrend(metric: string, tenantId: string, options: any): Promise<any> {
    // This would implement actual trend calculation logic
    // For now, return mock data structure
    
    const dataPoints = [];
    const { start, end, granularity } = options.timeRange;
    
    // Generate time series data based on granularity
    let current = new Date(start);
    while (current <= end) {
      const value = await this.getMetricValue(metric, current, tenantId);
      dataPoints.push({
        timestamp: new Date(current),
        value,
      });
      
      // Increment based on granularity
      switch (granularity) {
        case 'hour':
          current.setHours(current.getHours() + 1);
          break;
        case 'day':
          current.setDate(current.getDate() + 1);
          break;
        case 'week':
          current.setDate(current.getDate() + 7);
          break;
        case 'month':
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }

    // Calculate trend statistics
    const values = dataPoints.map(dp => dp.value);
    const trend = this.calculateLinearTrend(values);
    
    return {
      dataPoints,
      trend: {
        direction: trend.slope > 0 ? 'increasing' : trend.slope < 0 ? 'decreasing' : 'stable',
        slope: trend.slope,
        correlation: trend.correlation,
        significance: Math.abs(trend.correlation) > 0.7 ? 'high' : Math.abs(trend.correlation) > 0.3 ? 'medium' : 'low',
      },
      statistics: {
        min: Math.min(...values),
        max: Math.max(...values),
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        variance: this.calculateVariance(values),
      },
    };
  }

  // A068: Anomaly Detection
  async detectAnomalies(tenantId: string, options: {
    metrics: string[];
    timeRange: { start: Date; end: Date };
    sensitivity: 'low' | 'medium' | 'high';
  }): Promise<any[]> {
    try {
      const anomalies = [];

      for (const metric of options.metrics) {
        const metricAnomalies = await this.detectMetricAnomalies(metric, tenantId, options);
        anomalies.push(...metricAnomalies);
      }

      // Generate anomaly insights
      if (anomalies.length > 0) {
        await this.generateAnomalyInsights(anomalies, tenantId);
      }

      logger.info(`Anomaly detection completed: ${anomalies.length} anomalies found`);
      return anomalies;
    } catch (error) {
      logger.error('Error detecting anomalies:', error);
      throw error;
    }
  }

  private async detectMetricAnomalies(metric: string, tenantId: string, options: any): Promise<any[]> {
    // Implement statistical anomaly detection
    const data = await this.getMetricTimeSeries(metric, tenantId, options.timeRange);
    const anomalies = [];

    // Calculate statistical thresholds
    const values = data.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(this.calculateVariance(values));
    
    // Set threshold based on sensitivity
    const thresholdMultiplier = options.sensitivity === 'high' ? 2 : 
                               options.sensitivity === 'medium' ? 2.5 : 3;
    const upperThreshold = mean + (stdDev * thresholdMultiplier);
    const lowerThreshold = mean - (stdDev * thresholdMultiplier);

    // Detect anomalies
    data.forEach(point => {
      if (point.value > upperThreshold || point.value < lowerThreshold) {
        anomalies.push({
          metric,
          timestamp: point.timestamp,
          value: point.value,
          expectedRange: { min: lowerThreshold, max: upperThreshold },
          severity: this.calculateAnomalySeverity(point.value, mean, stdDev),
          type: point.value > upperThreshold ? 'spike' : 'drop',
        });
      }
    });

    return anomalies;
  }

  // A068: Automated Insights Generation
  async generateInsights(tenantId: string): Promise<Insight[]> {
    try {
      const insights = [];

      // Generate different types of insights
      const trendInsights = await this.generateTrendInsights({}, tenantId);
      const performanceInsights = await this.generatePerformanceInsights(tenantId);
      const usageInsights = await this.generateUsageInsights(tenantId);
      const riskInsights = await this.generateRiskInsights(tenantId);

      insights.push(...trendInsights, ...performanceInsights, ...usageInsights, ...riskInsights);

      // Store insights in database
      for (const insight of insights) {
        await this.storeInsight(insight, tenantId);
      }

      // Notify subscribers
      this.notifyInsightUpdate(tenantId, insights);

      logger.info(`Generated ${insights.length} insights for tenant: ${tenantId}`);
      return insights;
    } catch (error) {
      logger.error('Error generating insights:', error);
      throw error;
    }
  }

  private async generateTrendInsights(trends: any, tenantId: string): Promise<any[]> {
    const insights = [];

    // Analyze workflow completion trends
    const workflowTrend = await this.analyzeTrends(tenantId, {
      timeRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
      metrics: ['workflow_completions'],
      granularity: 'day',
    });

    if (workflowTrend.workflow_completions?.trend.direction === 'decreasing') {
      insights.push({
        type: InsightType.TREND,
        title: 'Declining Workflow Completion Rate',
        description: 'Workflow completion rates have been declining over the past 30 days',
        data: workflowTrend.workflow_completions,
        priority: Priority.HIGH,
      });
    }

    return insights;
  }

  private async generatePerformanceInsights(tenantId: string): Promise<any[]> {
    const insights = [];

    // Analyze task completion times
    const avgCompletionTime = await this.getAverageTaskCompletionTime(tenantId);
    const historicalAvg = await this.getHistoricalAverageTaskCompletionTime(tenantId);

    if (avgCompletionTime > historicalAvg * 1.5) {
      insights.push({
        type: InsightType.ALERT,
        title: 'Task Completion Time Increased',
        description: `Average task completion time has increased by ${Math.round(((avgCompletionTime - historicalAvg) / historicalAvg) * 100)}%`,
        data: { current: avgCompletionTime, historical: historicalAvg },
        priority: Priority.MEDIUM,
      });
    }

    return insights;
  }

  private async generateUsageInsights(tenantId: string): Promise<any[]> {
    const insights = [];

    // Analyze user activity patterns
    const activeUsers = await this.getActiveUserCount(tenantId);
    const totalUsers = await this.getTotalUserCount(tenantId);
    const activityRate = activeUsers / totalUsers;

    if (activityRate < 0.3) {
      insights.push({
        type: InsightType.RECOMMENDATION,
        title: 'Low User Engagement',
        description: `Only ${Math.round(activityRate * 100)}% of users are actively using the platform`,
        data: { activeUsers, totalUsers, activityRate },
        priority: Priority.MEDIUM,
      });
    }

    return insights;
  }

  private async generateRiskInsights(tenantId: string): Promise<any[]> {
    const insights = [];

    // Analyze overdue tasks
    const overdueTasks = await this.getOverdueTaskCount(tenantId);
    const totalActiveTasks = await this.getActiveTaskCount(tenantId);
    const overdueRate = overdueTasks / totalActiveTasks;

    if (overdueRate > 0.2) {
      insights.push({
        type: InsightType.ALERT,
        title: 'High Overdue Task Rate',
        description: `${Math.round(overdueRate * 100)}% of active tasks are overdue`,
        data: { overdueTasks, totalActiveTasks, overdueRate },
        priority: Priority.HIGH,
      });
    }

    return insights;
  }

  async subscribeToUpdates(ws: WebSocket, dashboardId: string): Promise<void> {
    if (!this.wsConnections.has(dashboardId)) {
      this.wsConnections.set(dashboardId, []);
    }
    this.wsConnections.get(dashboardId)!.push(ws);

    ws.on('close', () => {
      const connections = this.wsConnections.get(dashboardId);
      if (connections) {
        const index = connections.indexOf(ws);
        if (index > -1) {
          connections.splice(index, 1);
        }
      }
    });
  }

  private async loadModels(): Promise<void> {
    const models = await this.prisma.analyticsModel.findMany({
      where: {
        status: { in: [AnalyticsModelStatus.TRAINED, AnalyticsModelStatus.DEPLOYED] },
      },
    });

    models.forEach(model => {
      this.models.set(model.id, model);
    });

    logger.info(`Loaded ${models.length} analytics models`);
  }

  private startScheduledTasks(): void {
    // Generate insights daily
    const insightJob = new cron.CronJob('0 2 * * *', async () => {
      try {
        const tenants = await this.getActiveTenants();
        for (const tenantId of tenants) {
          await this.generateInsights(tenantId);
        }
      } catch (error) {
        logger.error('Error in scheduled insight generation:', error);
      }
    });

    insightJob.start();
    this.cronJobs.set('insight-generation', insightJob);

    // Detect anomalies every hour
    const anomalyJob = new cron.CronJob('0 * * * *', async () => {
      try {
        const tenants = await this.getActiveTenants();
        for (const tenantId of tenants) {
          await this.detectAnomalies(tenantId, {
            metrics: ['workflow_completions', 'task_completions', 'user_activity'],
            timeRange: { start: new Date(Date.now() - 24 * 60 * 60 * 1000), end: new Date() },
            sensitivity: 'medium',
          });
        }
      } catch (error) {
        logger.error('Error in scheduled anomaly detection:', error);
      }
    });

    anomalyJob.start();
    this.cronJobs.set('anomaly-detection', anomalyJob);
  }

  // Helper methods
  private async getModel(modelId: string): Promise<AnalyticsModel | null> {
    if (this.models.has(modelId)) {
      return this.models.get(modelId)!;
    }

    const model = await this.prisma.analyticsModel.findUnique({
      where: { id: modelId },
    });

    if (model) {
      this.models.set(modelId, model);
    }

    return model;
  }

  private async prepareTrainingData(model: AnalyticsModel): Promise<any> {
    // This would implement data preparation logic based on model type
    return {};
  }

  private async performTraining(model: AnalyticsModel, trainingData: any): Promise<{ accuracy: number; config: any }> {
    // This would implement actual ML training logic
    // For now, return mock results
    return {
      accuracy: 0.85 + Math.random() * 0.1, // Mock accuracy between 0.85-0.95
      config: model.config,
    };
  }

  private async performPrediction(model: AnalyticsModel, features: any): Promise<{ output: any; confidence: number }> {
    // This would implement actual prediction logic
    // For now, return mock results
    return {
      output: { prediction: Math.random() > 0.5 ? 'positive' : 'negative' },
      confidence: 0.7 + Math.random() * 0.3, // Mock confidence between 0.7-1.0
    };
  }

  private calculateLinearTrend(values: number[]): { slope: number; correlation: number } {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = values.reduce((sum, yi) => sum + yi * yi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const correlation = (n * sumXY - sumX * sumY) / 
                       Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    return { slope, correlation };
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  }

  private calculateAnomalySeverity(value: number, mean: number, stdDev: number): 'low' | 'medium' | 'high' {
    const zScore = Math.abs((value - mean) / stdDev);
    if (zScore > 3) return 'high';
    if (zScore > 2) return 'medium';
    return 'low';
  }

  private async storeInsight(insight: any, tenantId: string): Promise<Insight> {
    return this.prisma.insight.create({
      data: {
        type: insight.type,
        title: insight.title,
        description: insight.description,
        data: insight.data as any,
        priority: insight.priority,
        modelId: insight.modelId,
        tenantId,
      },
    });
  }

  private notifyInsightUpdate(tenantId: string, insights: any[]): void {
    // Notify WebSocket subscribers
    const connections = this.wsConnections.get(tenantId);
    if (connections) {
      const message = JSON.stringify({
        type: 'insights_updated',
        insights,
      });

      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }

  // Mock data methods (would be replaced with actual database queries)
  private async getMetricValue(metric: string, timestamp: Date, tenantId: string): Promise<number> {
    // Mock implementation
    return Math.floor(Math.random() * 100);
  }

  private async getMetricTimeSeries(metric: string, tenantId: string, timeRange: any): Promise<any[]> {
    // Mock implementation
    const data = [];
    let current = new Date(timeRange.start);
    while (current <= timeRange.end) {
      data.push({
        timestamp: new Date(current),
        value: Math.floor(Math.random() * 100),
      });
      current.setHours(current.getHours() + 1);
    }
    return data;
  }

  private async getActiveTenants(): Promise<string[]> {
    const tenants = await this.prisma.user.findMany({
      select: { tenantId: true },
      distinct: ['tenantId'],
    });
    return tenants.map(t => t.tenantId);
  }

  private async getAverageTaskCompletionTime(tenantId: string): Promise<number> {
    // Mock implementation
    return Math.floor(Math.random() * 48) + 24; // 24-72 hours
  }

  private async getHistoricalAverageTaskCompletionTime(tenantId: string): Promise<number> {
    // Mock implementation
    return Math.floor(Math.random() * 24) + 24; // 24-48 hours
  }

  private async getActiveUserCount(tenantId: string): Promise<number> {
    return this.prisma.user.count({
      where: {
        tenantId,
        isActive: true,
        lastLogin: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });
  }

  private async getTotalUserCount(tenantId: string): Promise<number> {
    return this.prisma.user.count({
      where: { tenantId },
    });
  }

  private async getOverdueTaskCount(tenantId: string): Promise<number> {
    return this.prisma.workflowTask.count({
      where: {
        tenantId,
        status: 'OVERDUE',
      },
    });
  }

  private async getActiveTaskCount(tenantId: string): Promise<number> {
    return this.prisma.workflowTask.count({
      where: {
        tenantId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });
  }

  private async generateAnomalyInsights(anomalies: any[], tenantId: string): Promise<void> {
    for (const anomaly of anomalies) {
      await this.storeInsight({
        type: InsightType.ANOMALY,
        title: `Anomaly Detected in ${anomaly.metric}`,
        description: `Unusual ${anomaly.type} detected in ${anomaly.metric}`,
        data: anomaly,
        priority: anomaly.severity === 'high' ? Priority.HIGH : Priority.MEDIUM,
      }, tenantId);
    }
  }
}