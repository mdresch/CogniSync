import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requireTenant, requireScope } from '../middleware/auth.middleware.js';
import { AnalyticsService } from '../services/AnalyticsService';
import { PrismaClient } from '@prisma/client';

const router = Router();

// Apply authentication middleware
router.use(requireTenant);

// Get analytics overview
router.get('/overview', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const analyticsService: AnalyticsService = req.app.locals.analyticsService;
  
  const {
    startDate,
    endDate,
    period = '7d', // 1d, 7d, 30d, 90d
  } = req.query;

  // Calculate date range
  const now = new Date();
  let start: Date, end: Date;

  if (startDate && endDate) {
    start = new Date(startDate as string);
    end = new Date(endDate as string);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format. Use ISO 8601 format (e.g., 2023-12-01T00:00:00Z)',
        code: 'INVALID_DATE_FORMAT',
      });
    }
  } else {
    end = now;
    switch (period) {
      case '1d':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        return res.status(400).json({
          error: 'Invalid period. Must be one of: 1d, 7d, 30d, 90d',
          code: 'INVALID_PERIOD',
        });
    }
  }

  try {
    const analytics = await analyticsService.getOverviewAnalytics({
      tenantId: req.tenantId,
      timeRange: {
        start: start,
        end: end,
      },
    });

    res.json({
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        duration: `${Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))}d`,
      },
      ...analytics,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    throw error;
  }
}));

// Get query analytics
router.get('/queries', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const analyticsService: AnalyticsService = req.app.locals.analyticsService;
  
  const {
    startDate,
    endDate,
    period = '7d',
    groupBy = 'day', // hour, day, week, month
    intent,
    source,
    limit = 100,
    offset = 0,
  } = req.query;

  // Calculate date range (same logic as overview)
  const now = new Date();
  let start: Date, end: Date;

  if (startDate && endDate) {
    start = new Date(startDate as string);
    end = new Date(endDate as string);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format',
        code: 'INVALID_DATE_FORMAT',
      });
    }
  } else {
    end = now;
    switch (period) {
      case '1d':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  try {
    const analytics = await analyticsService.getQueryAnalytics({
      tenantId: req.tenantId,
      timeRange: {
        start: start,
        end: end,
      }
    });

    res.json({
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        groupBy,
      },
      filters: {
        intent,
        source,
      },
      ...analytics,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    throw error;
  }
}));

// Get performance metrics
router.get('/performance', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const analyticsService: AnalyticsService = req.app.locals.analyticsService;
  
  const {
    startDate,
    endDate,
    period = '7d',
    percentile = 95, // 50, 95, 99
  } = req.query;

  // Calculate date range (same logic as above)
  const now = new Date();
  let start: Date, end: Date;

  if (startDate && endDate) {
    start = new Date(startDate as string);
    end = new Date(endDate as string);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format',
        code: 'INVALID_DATE_FORMAT',
      });
    }
  } else {
    end = now;
    switch (period) {
      case '1d':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  const validPercentiles = [50, 95, 99];
  const targetPercentile = parseInt(percentile as string);
  
  if (!validPercentiles.includes(targetPercentile)) {
    return res.status(400).json({
      error: 'Invalid percentile. Must be one of: 50, 95, 99',
      code: 'INVALID_PERCENTILE',
    });
  }

  try {
    const metrics = await analyticsService.getPerformanceMetrics(
      req.tenantId,
      {
        start: start,
        end: end,
      }
    );

    res.json({
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        percentile: targetPercentile,
      },
      ...metrics,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    throw error;
  }
}));

// Get user engagement metrics
router.get('/engagement', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const analyticsService: AnalyticsService = req.app.locals.analyticsService;
  
  const {
    startDate,
    endDate,
    period = '7d',
  } = req.query;

  // Calculate date range (same logic as above)
  const now = new Date();
  let start: Date, end: Date;

  if (startDate && endDate) {
    start = new Date(startDate as string);
    end = new Date(endDate as string);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format',
        code: 'INVALID_DATE_FORMAT',
      });
    }
  } else {
    end = now;
    switch (period) {
      case '1d':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  try {
    const engagement = await analyticsService.getUserEngagement(
      req.tenantId,
      {
        start: start,
        end: end,
      }
    );

    res.json({
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      ...engagement,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    throw error;
  }
}));

// Export analytics data
router.get('/export', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const analyticsService: AnalyticsService = req.app.locals.analyticsService;
  
  const {
    startDate,
    endDate,
    format = 'json', // json, csv
    type = 'queries', // queries, performance, engagement
  } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      error: 'Both startDate and endDate are required for export',
      code: 'MISSING_DATE_RANGE',
    });
  }

  const start = new Date(startDate as string);
  const end = new Date(endDate as string);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({
      error: 'Invalid date format',
      code: 'INVALID_DATE_FORMAT',
    });
  }

  // Check date range limit (max 90 days)
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff > 90) {
    return res.status(400).json({
      error: 'Date range cannot exceed 90 days for export',
      code: 'DATE_RANGE_TOO_LARGE',
    });
  }

  const validFormats = ['json', 'csv'];
  const validTypes = ['queries', 'performance', 'engagement'];

  if (!validFormats.includes(format as string)) {
    return res.status(400).json({
      error: `Invalid format. Must be one of: ${validFormats.join(', ')}`,
      code: 'INVALID_FORMAT',
    });
  }

  if (!validTypes.includes(type as string)) {
    return res.status(400).json({
      error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      code: 'INVALID_TYPE',
    });
  }

  try {
    const exportData = await analyticsService.exportData({
      tenantId: req.tenantId,
      format: format as 'json' | 'csv',
      timeRange: {
        start: start,
        end: end,
      },
    });

    // Set appropriate headers
    const filename = `llm-rag-analytics-${type}-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}.${format}`;
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportData);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json(exportData);
    }
  } catch (error) {
    throw error;
  }
}));

// Get real-time statistics
router.get('/realtime', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const analyticsService: AnalyticsService = req.app.locals.analyticsService;

  try {
    const stats = await analyticsService.getRealtimeStats({
      tenantId: req.tenantId,
    });

    res.json({
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    throw error;
  }
}));

export default router;

// --- Legacy/test endpoints below ---

// Summary metrics (legacy endpoint used by tests)
router.get('/metrics', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const analyticsService: AnalyticsService = req.app.locals.analyticsService;

  // Default to last 7 days if not provided
  const period = (req.query.period as string) || '7d';
  const now = new Date();
  let start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period.endsWith('h')) {
    const hours = parseInt(period.replace('h', ''), 10) || 24;
    start = new Date(now.getTime() - hours * 60 * 60 * 1000);
  } else if (period.endsWith('d')) {
    const days = parseInt(period.replace('d', ''), 10) || 7;
    start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  const overview = await analyticsService.getOverviewAnalytics({
    tenantId: req.tenantId,
    timeRange: { start, end: now },
  });

  res.json({
    totalQueries: overview.overview.totalQueries || 0,
    averageResponseTime: overview.overview.averageResponseTime || 0,
    successRate: overview.overview.successRate || 0,
    timePeriod: period,
    generatedAt: new Date().toISOString(),
  });
}));

// Usage statistics over time (legacy endpoint used by tests)
router.get('/usage', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const prisma: PrismaClient = req.app.locals.prisma;
  const period = (req.query.period as string) || '24h';
  const granularity = (req.query.granularity as string) || 'hour'; // hour|day

  const now = new Date();
  let start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (period.endsWith('h')) {
    const hours = parseInt(period.replace('h', ''), 10) || 24;
    start = new Date(now.getTime() - hours * 60 * 60 * 1000);
  } else if (period.endsWith('d')) {
    const days = parseInt(period.replace('d', ''), 10) || 7;
    start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  const sessions = await prisma.querySession.findMany({
    where: {
      tenantId: req.tenantId,
      createdAt: { gte: start, lte: now },
    },
    select: { createdAt: true },
  });

  const bucketMs = granularity === 'day' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const buckets: Record<string, number> = {};

  // Initialize buckets
  for (let t = Math.floor(start.getTime() / bucketMs) * bucketMs; t <= now.getTime(); t += bucketMs) {
    buckets[new Date(t).toISOString()] = 0;
  }

  sessions.forEach(s => {
    const bucketTime = Math.floor(s.createdAt.getTime() / bucketMs) * bucketMs;
    const key = new Date(bucketTime).toISOString();
    buckets[key] = (buckets[key] || 0) + 1;
  });

  const dataPoints = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([timestamp, count]) => ({ timestamp, count }));

  res.json({
    period,
    granularity,
    dataPoints,
    generatedAt: new Date().toISOString(),
  });
}));

// Create analytics event (legacy endpoint used by tests)
router.post('/events', requireScope('write'), asyncHandler(async (req: any, res: any) => {
  const prisma: PrismaClient = req.app.locals.prisma;
  const { eventType, sessionId, userId, query, documentId, processingTime, errorCode, metadata } = req.body || {};

  if (!eventType) {
    return res.status(400).json({ error: 'eventType is required', code: 'MISSING_EVENT_TYPE' });
  }

  const sid = sessionId || `auto-session-${Date.now()}`;
  const created = await prisma.analyticsEvent.create({
    data: {
      tenantId: req.tenantId,
      sessionId: sid,
      eventType,
      userId: userId || null,
      query: query || null,
      documentId: documentId || null,
      processingTime: processingTime || null,
      errorCode: errorCode || null,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      timestamp: new Date(),
    },
  });

  res.json({
    eventId: created.id,
    eventType: created.eventType,
    timestamp: created.timestamp,
  });
}));

// Popular queries (legacy endpoint used by tests)
router.get('/popular-queries', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const prisma: PrismaClient = req.app.locals.prisma;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const period = (req.query.period as string) || '7d';

  const now = new Date();
  let start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period.endsWith('h')) {
    const hours = parseInt(period.replace('h', ''), 10) || 168;
    start = new Date(now.getTime() - hours * 60 * 60 * 1000);
  } else if (period.endsWith('d')) {
    const days = parseInt(period.replace('d', ''), 10) || 7;
    start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  const sessions = await prisma.querySession.findMany({
    where: {
      tenantId: req.tenantId,
      createdAt: { gte: start, lte: now },
    },
    select: { query: true, processingTime: true },
  });

  const queryStats = new Map<string, { count: number; totalTime: number }>();
  sessions.forEach(s => {
    if (s.query) {
      const stats = queryStats.get(s.query) || { count: 0, totalTime: 0 };
      stats.count += 1;
      stats.totalTime += s.processingTime || 0;
      queryStats.set(s.query, stats);
    }
  });

  const queries = Array.from(queryStats.entries())
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, limit)
    .map(([query, stats]) => ({ query, count: stats.count, averageTime: stats.count ? Math.round(stats.totalTime / stats.count) : 0 }));

  res.json({
    queries,
    period,
    generatedAt: new Date().toISOString(),
  });
}));
