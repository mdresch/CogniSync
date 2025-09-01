"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRoutes = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const tenant_middleware_1 = require("../middleware/tenant.middleware");
const notification_service_1 = require("../services/notification.service");
const logger_1 = require("../utils/logger");
const error_handler_1 = require("../middleware/error-handler");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
exports.notificationRoutes = router;
const prisma = new client_1.PrismaClient();
// Initialize service (WebSocket server would be injected in real application)
const notificationService = new notification_service_1.NotificationService(prisma, {});
// Validation schemas
const sendNotificationSchema = joi_1.default.object({
    userIds: joi_1.default.array().items(joi_1.default.string()).optional(),
    userId: joi_1.default.string().optional(),
    type: joi_1.default.string().valid('TASK_ASSIGNED', 'TASK_COMPLETED', 'DOCUMENT_APPROVAL', 'WORKFLOW_COMPLETED', 'SYSTEM_ALERT', 'REMINDER', 'CUSTOM').required(),
    title: joi_1.default.string().required().max(255),
    message: joi_1.default.string().required().max(1000),
    data: joi_1.default.object().optional(),
    priority: joi_1.default.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
}).xor('userIds', 'userId');
const createTemplateSchema = joi_1.default.object({
    name: joi_1.default.string().required().max(100),
    type: joi_1.default.string().valid('TASK_ASSIGNED', 'TASK_COMPLETED', 'DOCUMENT_APPROVAL', 'WORKFLOW_COMPLETED', 'SYSTEM_ALERT', 'REMINDER', 'CUSTOM').required(),
    subject: joi_1.default.string().required().max(255),
    template: joi_1.default.string().required(),
});
// Apply middleware
router.use(tenant_middleware_1.enforceTenantIsolation);
// Get user notifications
router.get('/', async (req, res) => {
    try {
        const { status, type, priority, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
        const filters = {};
        if (status)
            filters.status = status;
        if (type)
            filters.type = type;
        if (priority)
            filters.priority = priority;
        if (dateFrom)
            filters.dateFrom = new Date(dateFrom);
        if (dateTo)
            filters.dateTo = new Date(dateTo);
        const result = await notificationService.getUserNotifications(req.user.userId, req.user.tenantId, filters, Number(page), Number(limit));
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching notifications:', error);
        throw error;
    }
});
// Send notification
router.post('/', (0, auth_middleware_1.requirePermission)('notifications:write'), async (req, res) => {
    try {
        const { error, value } = sendNotificationSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid notification data', error.details);
        }
        if (value.userIds) {
            // Send bulk notification
            const notifications = await notificationService.sendBulkNotification(value.userIds, {
                type: value.type,
                title: value.title,
                message: value.message,
                data: value.data,
                priority: value.priority,
                tenantId: req.user.tenantId,
            });
            (0, logger_1.logAudit)('bulk_notification_sent', req.user.userId, 'notification', 'bulk', {
                userCount: value.userIds.length,
                type: value.type,
                title: value.title,
            });
            res.status(201).json({
                success: true,
                data: notifications,
            });
        }
        else {
            // Send single notification
            const notification = await notificationService.sendNotification({
                userId: value.userId,
                type: value.type,
                title: value.title,
                message: value.message,
                data: value.data,
                priority: value.priority,
                tenantId: req.user.tenantId,
            });
            (0, logger_1.logAudit)('notification_sent', req.user.userId, 'notification', notification.id, {
                recipientId: value.userId,
                type: value.type,
                title: value.title,
            });
            res.status(201).json({
                success: true,
                data: notification,
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Error sending notification:', error);
        throw error;
    }
});
// Mark notification as read
router.put('/:id/read', async (req, res) => {
    try {
        const notification = await notificationService.markAsRead(req.params.id, req.user.userId, req.user.tenantId);
        res.json({
            success: true,
            data: notification,
        });
    }
    catch (error) {
        logger_1.logger.error('Error marking notification as read:', error);
        throw error;
    }
});
// Mark all notifications as read
router.put('/read-all', async (req, res) => {
    try {
        const count = await notificationService.markAllAsRead(req.user.userId, req.user.tenantId);
        res.json({
            success: true,
            data: { markedCount: count },
        });
    }
    catch (error) {
        logger_1.logger.error('Error marking all notifications as read:', error);
        throw error;
    }
});
// Archive notification
router.put('/:id/archive', async (req, res) => {
    try {
        const notification = await notificationService.archiveNotification(req.params.id, req.user.userId, req.user.tenantId);
        res.json({
            success: true,
            data: notification,
        });
    }
    catch (error) {
        logger_1.logger.error('Error archiving notification:', error);
        throw error;
    }
});
// Get unread count
router.get('/unread-count', async (req, res) => {
    try {
        const count = await notificationService.getUnreadCount(req.user.userId, req.user.tenantId);
        res.json({
            success: true,
            data: { count },
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching unread count:', error);
        throw error;
    }
});
// Send system alert
router.post('/system-alert', (0, auth_middleware_1.requirePermission)('notifications:write'), async (req, res) => {
    try {
        const { title, message, userIds } = req.body;
        if (!title || !message) {
            throw new error_handler_1.ValidationError('Title and message are required');
        }
        await notificationService.sendSystemAlert(title, message, req.user.tenantId, userIds);
        (0, logger_1.logAudit)('system_alert_sent', req.user.userId, 'notification', 'system_alert', {
            title,
            userCount: userIds ? userIds.length : 'all',
        });
        res.json({
            success: true,
            message: 'System alert sent successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Error sending system alert:', error);
        throw error;
    }
});
// Send reminder
router.post('/reminder', (0, auth_middleware_1.requirePermission)('notifications:write'), async (req, res) => {
    try {
        const { userId, title, message, data } = req.body;
        if (!userId || !title || !message) {
            throw new error_handler_1.ValidationError('User ID, title, and message are required');
        }
        await notificationService.sendReminder(userId, title, message, req.user.tenantId, data);
        (0, logger_1.logAudit)('reminder_sent', req.user.userId, 'notification', 'reminder', {
            recipientId: userId,
            title,
        });
        res.json({
            success: true,
            message: 'Reminder sent successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Error sending reminder:', error);
        throw error;
    }
});
// Notification templates
router.get('/templates', (0, auth_middleware_1.requirePermission)('notifications:read'), async (req, res) => {
    try {
        const templates = await notificationService.getTemplates(req.user.tenantId);
        res.json({
            success: true,
            data: templates,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching notification templates:', error);
        throw error;
    }
});
router.post('/templates', (0, auth_middleware_1.requirePermission)('notifications:write'), async (req, res) => {
    try {
        const { error, value } = createTemplateSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid template data', error.details);
        }
        const template = await notificationService.createTemplate({
            ...value,
            tenantId: req.user.tenantId,
        });
        (0, logger_1.logAudit)('notification_template_created', req.user.userId, 'notification_template', template.id, {
            name: template.name,
            type: template.type,
        });
        res.status(201).json({
            success: true,
            data: template,
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating notification template:', error);
        throw error;
    }
});
router.put('/templates/:id', (0, auth_middleware_1.requirePermission)('notifications:write'), async (req, res) => {
    try {
        const { error, value } = createTemplateSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid template data', error.details);
        }
        const template = await notificationService.updateTemplate(req.params.id, value, req.user.tenantId);
        (0, logger_1.logAudit)('notification_template_updated', req.user.userId, 'notification_template', req.params.id, {
            changes: value,
        });
        res.json({
            success: true,
            data: template,
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating notification template:', error);
        throw error;
    }
});
// Cleanup old notifications
router.post('/cleanup', (0, auth_middleware_1.requirePermission)('notifications:write'), async (req, res) => {
    try {
        const { daysToKeep = 90 } = req.body;
        const count = await notificationService.cleanupOldNotifications(daysToKeep);
        (0, logger_1.logAudit)('notifications_cleanup', req.user.userId, 'notification', 'cleanup', {
            daysToKeep,
            deletedCount: count,
        });
        res.json({
            success: true,
            data: { deletedCount: count },
        });
    }
    catch (error) {
        logger_1.logger.error('Error cleaning up notifications:', error);
        throw error;
    }
});
//# sourceMappingURL=notification.routes.js.map