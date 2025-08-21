import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

const router = Router();
const prisma = new PrismaClient();

// Basic health check
router.get('/', async (req: Request, res: Response) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'governance-service',
      version: process.env.npm_package_version || '1.0.0',
      environment: config.nodeEnv,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    res.status(200).json(healthCheck);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'governance-service',
      error: 'Health check failed',
    });
  }
});

// Detailed health check with dependencies
router.get('/detailed', async (req: Request, res: Response) => {
  const checks = {
    service: 'healthy',
    database: 'unknown',
    memory: 'unknown',
    disk: 'unknown',
  };

  let overallStatus = 'healthy';

  try {
    // Database health check
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = 'healthy';
    } catch (error) {
      checks.database = 'unhealthy';
      overallStatus = 'unhealthy';
      logger.error('Database health check failed:', error);
    }

    // Memory health check
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    if (memoryUsagePercent > 90) {
      checks.memory = 'critical';
      overallStatus = 'degraded';
    } else if (memoryUsagePercent > 75) {
      checks.memory = 'warning';
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    } else {
      checks.memory = 'healthy';
    }

    // Disk space check (simplified)
    checks.disk = 'healthy'; // Would implement actual disk space check

    const healthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'governance-service',
      version: process.env.npm_package_version || '1.0.0',
      environment: config.nodeEnv,
      uptime: process.uptime(),
      checks,
      system: {
        memory: memoryUsage,
        cpu: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version,
      },
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'governance-service',
      error: 'Health check failed',
      checks,
    });
  }
});

// Readiness probe
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if service is ready to accept requests
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      service: 'governance-service',
    });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      service: 'governance-service',
      error: 'Service not ready',
    });
  }
});

// Liveness probe
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    service: 'governance-service',
    uptime: process.uptime(),
  });
});

// Metrics endpoint (basic)
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      service: 'governance-service',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      
      // Database metrics
      database: {
        connections: await getDatabaseConnectionCount(),
      },
      
      // Application metrics (would be collected from actual usage)
      application: {
        totalUsers: await prisma.user.count(),
        totalWorkflows: await prisma.workflow.count(),
        totalDocuments: await prisma.document.count(),
        totalNotifications: await prisma.notification.count(),
        activeWorkflowInstances: await prisma.workflowInstance.count({
          where: {
            status: { in: ['PENDING', 'RUNNING'] },
          },
        }),
      },
    };

    res.status(200).json(metrics);
  } catch (error) {
    logger.error('Metrics collection failed:', error);
    res.status(500).json({
      error: 'Failed to collect metrics',
      timestamp: new Date().toISOString(),
    });
  }
});

// Helper function to get database connection count
async function getDatabaseConnectionCount(): Promise<number> {
  try {
    // This is a simplified version - actual implementation would depend on database
    const result = await prisma.$queryRaw`
      SELECT count(*) as connection_count 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    ` as any[];
    
    return parseInt(result[0]?.connection_count || '0');
  } catch (error) {
    logger.warn('Could not get database connection count:', error);
    return 0;
  }
}

export { router as healthRoutes };