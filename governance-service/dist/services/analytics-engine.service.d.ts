import { PrismaClient, AnalyticsModel, Prediction, Insight, AnalyticsModelType, InsightType, Priority } from '@prisma/client';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
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
export declare class AnalyticsEngine extends EventEmitter {
    private prisma;
    private wss;
    private models;
    private cronJobs;
    private wsConnections;
    constructor(prisma: PrismaClient, wss: WebSocketServer);
    start(): Promise<void>;
    stop(): Promise<void>;
    createModel(modelData: {
        name: string;
        description?: string;
        type: AnalyticsModelType;
        config: ModelConfig;
        tenantId: string;
    }): Promise<AnalyticsModel>;
    trainModel(modelId: string): Promise<void>;
    makePrediction(input: PredictionInput, tenantId: string): Promise<Prediction>;
    batchPredict(inputs: PredictionInput[], tenantId: string): Promise<Prediction[]>;
    analyzeTrends(tenantId: string, options: {
        timeRange: {
            start: Date;
            end: Date;
        };
        metrics: string[];
        granularity: 'hour' | 'day' | 'week' | 'month';
    }): Promise<any>;
    private calculateTrend;
    detectAnomalies(tenantId: string, options: {
        metrics: string[];
        timeRange: {
            start: Date;
            end: Date;
        };
        sensitivity: 'low' | 'medium' | 'high';
    }): Promise<any[]>;
    private detectMetricAnomalies;
    generateInsights(tenantId: string): Promise<Insight[]>;
    private generateTrendInsights;
    private generatePerformanceInsights;
    private generateUsageInsights;
    private generateRiskInsights;
    subscribeToUpdates(ws: WebSocket, dashboardId: string): Promise<void>;
    private loadModels;
    private startScheduledTasks;
    private getModel;
    private prepareTrainingData;
    private performTraining;
    private performPrediction;
    private calculateLinearTrend;
    private calculateVariance;
    private calculateAnomalySeverity;
    private storeInsight;
    private notifyInsightUpdate;
    private getMetricValue;
    private getMetricTimeSeries;
    private getActiveTenants;
    private getAverageTaskCompletionTime;
    private getHistoricalAverageTaskCompletionTime;
    private getActiveUserCount;
    private getTotalUserCount;
    private getOverdueTaskCount;
    private getActiveTaskCount;
    private generateAnomalyInsights;
}
//# sourceMappingURL=analytics-engine.service.d.ts.map