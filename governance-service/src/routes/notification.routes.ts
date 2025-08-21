import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, requirePermission } from '../middleware/auth.middleware';
import { enforceTenantIsolation } from '../middleware/tenant.middleware';
import { NotificationService } from '../services/notification.service';
import { logger, logAudit } from '../utils/logger';
import { ValidationError, NotFoundError } from '../middleware/error-handler';
import Joi from 'joi';

const router = Router();
const prisma = new PrismaClient();

// Initialize service (WebSocket server would be injected in real application)
const notificationService = new NotificationService(prisma, {} as any);

// Validation schemas
const sendNotificationSchema = Joi.object({
  userIds: Joi.array().items(Joi.string()).optional(),
  userId: Joi.string().optional(),
  type: Joi.string().valid(
    'TASK_ASSIGNED', 'TASK_COMPLETED', 'DOCUMENT_APPROVAL', 
    'WORKFLOW_COMPLETED', 'SYSTEM_ALERT', 'REMINDER', 'CUSTOM'
  ).required(),
  title: Joi.string().required().max(255),
  message: Joi.string().required().max(1000),
  data: Joi.object().optional(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
}).xor('userIds', 'userId');

const createTemplateSchema = Joi.object({
  name: Joi.string().required().max(100),
  type: Joi.string().valid(
    'TASK_ASSIGNED', 'TASK_COMPLETED', 'DOCUMENT_APPROVAL', 
    'WORKFLOW_COMPLETED', 'SYSTEM_ALERT', 'REMINDER', 'CUSTOM'
  ).required(),
  subject: Joi.string().required().max(255),
  template: Joi.string().required(),
});

// Apply middleware
router.use(enforceTenantIsolation);

// Get user notifications
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, type, priority, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
    
    const filters: any = {};
    
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (priority) filters.priority = priority;
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);

    const result = await notificationService.getUserNotifications(
      req.user!.userId,
      req.user!.tenantId,
      filters,
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    throw error;
  }
});

// Send notification
router.post('/', requirePermission('notifications:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = sendNotificationSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid notification data', error.details);
    }

    if (value.userIds) {
      // Send bulk notification
      const notifications = await notificationService.sendBulkNotification(value.userIds, {
        type: value.type,
        title: value.title,
        message: value.message,
        data: value.data,
        priority: value.priority,
        tenantId: req.user!.tenantId,
      });

      logAudit('bulk_notification_sent', req.user!.userId, 'notification', 'bulk', {
        userCount: value.userIds.length,
        type: value.type,
        title: value.title,
      });

      res.status(201).json({
        success: true,
        data: notifications,
      });
    } else {
      // Send single notification
      const notification = await notificationService.sendNotification({
        userId: value.userId,
        type: value.type,
        title: value.title,
        message: value.message,
        data: value.data,
        priority: value.priority,
        tenantId: req.user!.tenantId,
      });

      logAudit('notification_sent', req.user!.userId, 'notification', notification.id, {
        recipientId: value.userId,
        type: value.type,
        title: value.title,
      });

      res.status(201).json({
        success: true,
        data: notification,
      });
    }
  } catch (error) {
    logger.error('Error sending notification:', error);
    throw error;
  }
});

// Mark notification as read
router.put('/:id/read', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notification = await notificationService.markAsRead(
      req.params.id,
      req.user!.userId,
      req.user!.tenantId
    );

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    throw error;
  }
});

// Mark all notifications as read
router.put('/read-all', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const count = await notificationService.markAllAsRead(req.user!.userId, req.user!.tenantId);

    res.json({
      success: true,
      data: { markedCount: count },
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    throw error;
  }
});

// Archive notification
router.put('/:id/archive', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notification = await notificationService.archiveNotification(
      req.params.id,
      req.user!.userId,
      req.user!.tenantId
    );

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    logger.error('Error archiving notification:', error);
    throw error;
  }
});

// Get unread count
router.get('/unread-count', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.userId, req.user!.tenantId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    logger.error('Error fetching unread count:', error);
    throw error;
  }
});

// Send system alert
router.post('/system-alert', requirePermission('notifications:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, message, userIds } = req.body;

    if (!title || !message) {
      throw new ValidationError('Title and message are required');
    }

    await notificationService.sendSystemAlert(title, message, req.user!.tenantId, userIds);

    logAudit('system_alert_sent', req.user!.userId, 'notification', 'system_alert', {
      title,
      userCount: userIds ? userIds.length : 'all',
    });

    res.json({
      success: true,
      message: 'System alert sent successfully',
    });
  } catch (error) {
    logger.error('Error sending system alert:', error);
    throw error;
  }
});

// Send reminder
router.post('/reminder', requirePermission('notifications:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, title, message, data } = req.body;

    if (!userId || !title || !message) {
      throw new ValidationError('User ID, title, and message are required');
    }

    await notificationService.sendReminder(userId, title, message, req.user!.tenantId, data);

    logAudit('reminder_sent', req.user!.userId, 'notification', 'reminder', {
      recipientId: userId,
      title,
    });

    res.json({
      success: true,
      message: 'Reminder sent successfully',
    });
  } catch (error) {
    logger.error('Error sending reminder:', error);
    throw error;
  }
});

// Notification templates
router.get('/templates', requirePermission('notifications:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const templates = await notificationService.getTemplates(req.user!.tenantId);

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    logger.error('Error fetching notification templates:', error);
    throw error;
  }
});

router.post('/templates', requirePermission('notifications:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = createTemplateSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid template data', error.details);
    }

    const template = await notificationService.createTemplate({
      ...value,
      tenantId: req.user!.tenantId,
    });

    logAudit('notification_template_created', req.user!.userId, 'notification_template', template.id, {
      name: template.name,
      type: template.type,
    });

    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Error creating notification template:', error);
    throw error;
  }
});

router.put('/templates/:id', requirePermission('notifications:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = createTemplateSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid template data', error.details);
    }

    const template = await notificationService.updateTemplate(req.params.id, value, req.user!.tenantId);

    logAudit('notification_template_updated', req.user!.userId, 'notification_template', req.params.id, {
      changes: value,
    });

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Error updating notification template:', error);
    throw error;
  }
});

// Cleanup old notifications
router.post('/cleanup', requirePermission('notifications:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { daysToKeep = 90 } = req.body;
    
    const count = await notificationService.cleanupOldNotifications(daysToKeep);

    logAudit('notifications_cleanup', req.user!.userId, 'notification', 'cleanup', {
      daysToKeep,
      deletedCount: count,
    });

    res.json({
      success: true,
      data: { deletedCount: count },
    });
  } catch (error) {
    logger.error('Error cleaning up notifications:', error);
    throw error;
  }
});

export { router as notificationRoutes };