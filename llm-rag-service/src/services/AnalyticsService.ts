import { PrismaClient } from '@prisma/client';

export class AnalyticsService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get overview analytics
   */
  async getOverviewAnalytics(params: {
    tenantId: string;
    timeRange: { start: Date; end: Date };
  }) {
    return this.getTenantAnalytics(params.tenantId, params.timeRange);
  }

  /**
   * Get query analytics
   */
  async getQueryAnalytics(params: {
    tenantId: string;
    timeRange: { start: Date; end: Date };
  }) {
    const analytics = await this.getTenantAnalytics(params.tenantId, params.timeRange);
    return {
      queryTrends: analytics.queryTrends,
      popularQueries: analytics.popularQueries,
      performanceMetrics: analytics.performanceMetrics
    };
  }

  /**
   * Track a query event
   */
  async trackQuery(params: {
    tenantId: string;
    sessionId: string;
    query: string;
    userId?: string;
    status: 'started' | 'completed' | 'failed';
    processingTime?: number;
    errorCode?: string;
  }) {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          tenantId: params.tenantId,
          sessionId: params.sessionId,
          eventType: params.status === 'started' ? 'query_started' : 
                     params.status === 'completed' ? 'query_completed' : 'query_failed',
          userId: params.userId,
          query: params.query,
          processingTime: params.processingTime,
          errorCode: params.errorCode,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Error tracking query:', error);
      // Don't throw - analytics shouldn't break the main flow
    }
  }

  /**
   * Get query history
   */
  async getQueryHistory(params: {
    tenantId: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      const [sessions, total] = await Promise.all([
        this.prisma.querySession.findMany({
          where: { tenantId: params.tenantId },
          orderBy: { createdAt: 'desc' },
          skip: params.offset || 0,
          take: params.limit || 50,
          select: {
            id: true,
            query: true,
            response: true,
            status: true,
            processingTime: true,
            createdAt: true,
            metadata: true
          }
        }),
        this.prisma.querySession.count({
          where: { tenantId: params.tenantId }
        })
      ]);

      return {
        sessions: sessions.map(session => ({
          ...session,
          metadata: session.metadata ? JSON.parse(session.metadata as string) : {}
        })),
        total,
        hasMore: (params.offset || 0) + (params.limit || 50) < total
      };
    } catch (error) {
      console.error('Error getting query history:', error);
      throw error;
    }
  }

  /**
   * Clear query history
   */
  async clearQueryHistory(params: {
    tenantId: string;
    olderThanDays?: number;
  }) {
    try {
      const cutoffDate = params.olderThanDays 
        ? new Date(Date.now() - (params.olderThanDays * 24 * 60 * 60 * 1000))
        : new Date(0);

      const deletedCount = await this.prisma.querySession.deleteMany({
        where: {
          tenantId: params.tenantId,
          createdAt: {
            lt: cutoffDate
          }
        }
      });

      return { deletedCount: deletedCount.count };
    } catch (error) {
      console.error('Error clearing query history:', error);
      throw error;
    }
  }

  /**
   * Export analytics data
   */
  async exportData(params: {
    tenantId: string;
    format: 'json' | 'csv';
    timeRange?: { start: Date; end: Date };
  }) {
    const timeRange = params.timeRange || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date()
    };

    const analytics = await this.getTenantAnalytics(params.tenantId, timeRange);

    return {
      format: params.format,
      data: params.format === 'json' ? analytics : this.convertToCSV(analytics),
      generatedAt: new Date(),
      filename: `analytics_${params.tenantId}_${Date.now()}.${params.format}`
    };
  }

  /**
   * Get realtime stats
   */
  async getRealtimeStats(params: { tenantId: string }) {
    return this.getRealTimeStats(params.tenantId);
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(
    tenantId: string,
    timeRange: { start: Date; end: Date }
  ) {
    const sessions = await this.prisma.querySession.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: timeRange.start,
          lte: timeRange.end
        }
      },
      select: {
        processingTime: true,
        status: true
      }
    });

    const fastQueries = sessions.filter(s => (s.processingTime || 0) < 1000).length;
    const mediumQueries = sessions.filter(s => {
      const time = s.processingTime || 0;
      return time >= 1000 && time <= 5000;
    }).length;
    const slowQueries = sessions.filter(s => (s.processingTime || 0) > 5000).length;
    const errorRate = sessions.length > 0
      ? (sessions.filter(s => s.status === 'failed').length / sessions.length) * 100
      : 0;

    return {
      fastQueries,
      mediumQueries,
      slowQueries,
      errorRate: Math.round(errorRate * 100) / 100
    };
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagement(
    tenantId: string,
    timeRange: { start: Date; end: Date }
  ) {
    const sessions = await this.prisma.querySession.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: timeRange.start,
          lte: timeRange.end
        }
      },
      select: {
        metadata: true,
        createdAt: true
      }
    });

    const userStats = new Map<string, number>();
    const hourlyStats = new Array(24).fill(0);

    sessions.forEach(session => {
      try {
        const metadata = session.metadata ? JSON.parse(session.metadata as string) : {};
        const userId = metadata.userContext?.userId || 'anonymous';
        userStats.set(userId, (userStats.get(userId) || 0) + 1);

        const hour = session.createdAt.getHours();
        hourlyStats[hour]++;
      } catch (error) {
        // Skip sessions with invalid metadata
      }
    });

    const uniqueUsers = userStats.size;
    const averageQueriesPerUser = uniqueUsers > 0
      ? Math.round(sessions.length / uniqueUsers)
      : 0;
    const peakUsageHour = hourlyStats.indexOf(Math.max(...hourlyStats));

    return {
      uniqueUsers,
      averageQueriesPerUser,
      peakUsageHour
    };
  }

  // Core analytics methods
  private async getTenantAnalytics(
    tenantId: string,
    timeRange: { start: Date; end: Date }
  ) {
    const [
      totalQueries,
      totalDocuments,
      queryMetrics
    ] = await Promise.all([
      this.getTotalQueries(tenantId, timeRange),
      this.getTotalDocuments(tenantId),
      this.getQueryMetrics(tenantId, timeRange)
    ]);

    const queryTrends = await this.getQueryTrends(tenantId, timeRange);
    const popularQueries = await this.getPopularQueries(tenantId, timeRange);
    const performanceMetrics = await this.getPerformanceMetrics(tenantId, timeRange);
    const userEngagement = await this.getUserEngagement(tenantId, timeRange);

    return {
      overview: {
        totalQueries,
        totalDocuments,
        averageResponseTime: queryMetrics.averageResponseTime,
        successRate: queryMetrics.successRate
      },
      queryTrends,
      popularQueries,
      documentUsage: [], // Placeholder
      performanceMetrics,
      userEngagement
    };
  }

  private async getTotalQueries(tenantId: string, timeRange: { start: Date; end: Date }): Promise<number> {
    return this.prisma.querySession.count({
      where: {
        tenantId,
        createdAt: {
          gte: timeRange.start,
          lte: timeRange.end
        }
      }
    });
  }

  private async getTotalDocuments(tenantId: string): Promise<number> {
    return this.prisma.document.count({
      where: { tenantId }
    });
  }

  private async getQueryMetrics(
    tenantId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{ averageResponseTime: number; successRate: number }> {
    const sessions = await this.prisma.querySession.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: timeRange.start,
          lte: timeRange.end
        }
      },
      select: {
        processingTime: true,
        status: true
      }
    });

    if (sessions.length === 0) {
      return { averageResponseTime: 0, successRate: 100 };
    }

    const averageResponseTime = sessions.reduce((sum, s) => sum + (s.processingTime || 0), 0) / sessions.length;
    const successfulSessions = sessions.filter(s => s.status === 'completed').length;
    const successRate = (successfulSessions / sessions.length) * 100;

    return {
      averageResponseTime: Math.round(averageResponseTime),
      successRate: Math.round(successRate * 100) / 100
    };
  }

  private async getQueryTrends(
    tenantId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<Array<{ date: string; count: number; averageTime: number }>> {
    const sessions = await this.prisma.querySession.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: timeRange.start,
          lte: timeRange.end
        }
      },
      select: {
        createdAt: true,
        processingTime: true
      }
    });

    const dailyStats = new Map<string, { count: number; totalTime: number }>();

    sessions.forEach(session => {
      const date = session.createdAt.toISOString().split('T')[0];
      const existing = dailyStats.get(date) || { count: 0, totalTime: 0 };
      existing.count += 1;
      existing.totalTime += session.processingTime || 0;
      dailyStats.set(date, existing);
    });

    return Array.from(dailyStats.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        count: stats.count,
        averageTime: stats.count > 0 ? Math.round(stats.totalTime / stats.count) : 0
      }));
  }

  private async getPopularQueries(
    tenantId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<Array<{ query: string; count: number; averageTime: number }>> {
    const sessions = await this.prisma.querySession.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: timeRange.start,
          lte: timeRange.end
        }
      },
      select: {
        query: true,
        processingTime: true
      }
    });

    const queryStats = new Map<string, { count: number; totalTime: number }>();

    sessions.forEach(session => {
      if (session.query) {
        const existing = queryStats.get(session.query) || { count: 0, totalTime: 0 };
        existing.count += 1;
        existing.totalTime += session.processingTime || 0;
        queryStats.set(session.query, existing);
      }
    });

    return Array.from(queryStats.entries())
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 10)
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        averageTime: stats.count > 0 ? Math.round(stats.totalTime / stats.count) : 0
      }));
  }

  private async getRealTimeStats(tenantId: string) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const now = new Date();

    const [
      activeQueries,
      recentSessions,
      recentEvents
    ] = await Promise.all([
      this.prisma.querySession.count({
        where: {
          tenantId,
          status: 'processing'
        }
      }),
      this.prisma.querySession.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: oneHourAgo,
            lte: now
          }
        },
        select: {
          query: true,
          processingTime: true,
          status: true
        }
      }),
      this.prisma.analyticsEvent.findMany({
        where: {
          tenantId,
          timestamp: {
            gte: oneHourAgo,
            lte: now
          },
          eventType: 'query_failed'
        }
      })
    ]);

    const queriesLastHour = recentSessions.length;
    const completedSessions = recentSessions.filter(s => s.status === 'completed');
    const averageResponseTime = completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => sum + (s.processingTime || 0), 0) / completedSessions.length
      : 0;
    
    const errorRateLastHour = recentSessions.length > 0
      ? (recentEvents.length / recentSessions.length) * 100
      : 0;

    // Get top queries
    const queryCount = new Map<string, number>();
    recentSessions.forEach(session => {
      if (session.query) {
        queryCount.set(session.query, (queryCount.get(session.query) || 0) + 1);
      }
    });

    const topQueriesLastHour = Array.from(queryCount.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([query, count]) => ({ query, count }));

    return {
      activeQueries,
      queriesLastHour,
      averageResponseTimeLastHour: Math.round(averageResponseTime),
      errorRateLastHour: Math.round(errorRateLastHour * 100) / 100,
      topQueriesLastHour
    };
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion - would need proper implementation
    return JSON.stringify(data);
  }

  /**
   * Clean up resources
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
