import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, requirePermission } from '../middleware/auth.middleware';
import { enforceTenantIsolation } from '../middleware/tenant.middleware';
import { ReportingService } from '../services/reporting.service';
import { NotificationService } from '../services/notification.service';
import { logger, logAudit } from '../utils/logger';
import { ValidationError, NotFoundError } from '../middleware/error-handler';
import Joi from 'joi';

const router = Router();
const prisma = new PrismaClient();

// Initialize services
const notificationService = new NotificationService(prisma, {} as any);
const reportingService = new ReportingService(prisma, notificationService);

// Validation schemas
const createReportSchema = Joi.object({
  name: Joi.string().required().max(255),
  description: Joi.string().optional().max(1000),
  type: Joi.string().valid('STANDARD', 'CUSTOM', 'SCHEDULED', 'AD_HOC').required(),
  query: Joi.object().required(),
  schedule: Joi.string().optional(),
  format: Joi.string().valid('PDF', 'EXCEL', 'CSV', 'JSON').required(),
});

// Apply middleware
router.use(enforceTenantIsolation);

// A067: Standard and Custom Reporting Functions

// Get reports
router.get('/', requirePermission('reports:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, isActive, search } = req.query;
    
    const filters: any = {};
    if (type) filters.type = type;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (search) filters.search = search as string;

    const reports = await reportingService.getReports(req.user!.tenantId, filters);

    res.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    logger.error('Error fetching reports:', error);
    throw error;
  }
});

// Create report
router.post('/', requirePermission('reports:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = createReportSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid report data', error.details);
    }

    const report = await reportingService.createReport({
      ...value,
      tenantId: req.user!.tenantId,
    });

    logAudit('report_created', req.user!.userId, 'report', report.id, {
      name: report.name,
      type: report.type,
    });

    res.status(201).json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Error creating report:', error);
    throw error;
  }
});

// Update report
router.put('/:id', requirePermission('reports:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = createReportSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid report data', error.details);
    }

    const report = await reportingService.updateReport(req.params.id, value, req.user!.tenantId);

    logAudit('report_updated', req.user!.userId, 'report', req.params.id, {
      changes: value,
    });

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Error updating report:', error);
    throw error;
  }
});

// Delete report
router.delete('/:id', requirePermission('reports:delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await reportingService.deleteReport(req.params.id, req.user!.tenantId);

    logAudit('report_deleted', req.user!.userId, 'report', req.params.id);

    res.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting report:', error);
    throw error;
  }
});

// Generate report
router.post('/:id/generate', requirePermission('reports:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { parameters } = req.body;

    const execution = await reportingService.generateReport(req.params.id, req.user!.tenantId, parameters);

    logAudit('report_generated', req.user!.userId, 'report', req.params.id, {
      executionId: execution.id,
    });

    res.json({
      success: true,
      data: execution,
    });
  } catch (error) {
    logger.error('Error generating report:', error);
    throw error;
  }
});

// Get report executions
router.get('/:id/executions', requirePermission('reports:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const executions = await reportingService.getReportExecutions(req.params.id, req.user!.tenantId);

    res.json({
      success: true,
      data: executions,
    });
  } catch (error) {
    logger.error('Error fetching report executions:', error);
    throw error;
  }
});

// Download report file
router.get('/executions/:executionId/download', requirePermission('reports:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileInfo = await reportingService.getReportFile(req.params.executionId, req.user!.tenantId);

    if (!fileInfo) {
      throw new NotFoundError('Report file not found');
    }

    res.download(fileInfo.filePath, fileInfo.fileName);
  } catch (error) {
    logger.error('Error downloading report:', error);
    throw error;
  }
});

// Subscribe to report
router.post('/:id/subscribe', requirePermission('reports:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email } = req.body;

    await reportingService.subscribeToReport(
      req.params.id,
      req.user!.userId,
      email || req.user!.email,
      req.user!.tenantId
    );

    logAudit('report_subscribed', req.user!.userId, 'report', req.params.id);

    res.json({
      success: true,
      message: 'Subscribed to report successfully',
    });
  } catch (error) {
    logger.error('Error subscribing to report:', error);
    throw error;
  }
});

// Unsubscribe from report
router.delete('/:id/subscribe', requirePermission('reports:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await reportingService.unsubscribeFromReport(req.params.id, req.user!.userId, req.user!.tenantId);

    logAudit('report_unsubscribed', req.user!.userId, 'report', req.params.id);

    res.json({
      success: true,
      message: 'Unsubscribed from report successfully',
    });
  } catch (error) {
    logger.error('Error unsubscribing from report:', error);
    throw error;
  }
});

// Get standard reports
router.get('/standard', requirePermission('reports:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const standardReports = await reportingService.getStandardReports(req.user!.tenantId);

    res.json({
      success: true,
      data: standardReports,
    });
  } catch (error) {
    logger.error('Error fetching standard reports:', error);
    throw error;
  }
});

// Build custom report
router.post('/custom/build', requirePermission('reports:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query } = req.body;

    if (!query) {
      throw new ValidationError('Query is required');
    }

    const reportData = await reportingService.buildCustomReport(query, req.user!.tenantId);

    res.json({
      success: true,
      data: reportData,
    });
  } catch (error) {
    logger.error('Error building custom report:', error);
    throw error;
  }
});

export { router as reportRoutes };