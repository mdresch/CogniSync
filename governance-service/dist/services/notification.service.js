"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const client_1 = require("@prisma/client");
const ws_1 = require("ws");
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = require("../utils/logger");
const config_1 = require("../utils/config");
class NotificationService {
    constructor(prisma, wss) {
        this.userConnections = new Map();
        this.templates = new Map();
        this.prisma = prisma;
        this.wss = wss;
        this.initializeEmailTransporter();
        this.loadTemplates();
    }
    // A064: Core Notification System
    async sendNotification(notificationData) {
        try {
            // Create notification record
            const notification = await this.prisma.notification.create({
                data: {
                    userId: notificationData.userId,
                    type: notificationData.type,
                    title: notificationData.title,
                    message: notificationData.message,
                    data: notificationData.data || {},
                    priority: notificationData.priority || client_1.Priority.MEDIUM,
                    tenantId: notificationData.tenantId,
                },
                include: {
                    user: {
                        select: { id: true, firstName: true, lastName: true, email: true },
                    },
                },
            });
            // Send real-time notification via WebSocket
            await this.sendRealTimeNotification(notification);
            // Send email notification for high priority or specific types
            if (this.shouldSendEmail(notification)) {
                await this.sendEmailNotification(notification);
            }
            // Set up escalation if needed
            await this.setupEscalation(notification);
            logger_1.logger.info(`Notification sent: ${notification.id} to user ${notificationData.userId}`);
            return notification;
        }
        catch (error) {
            logger_1.logger.error('Error sending notification:', error);
            throw error;
        }
    }
    async sendBulkNotification(userIds, notificationData) {
        try {
            const notifications = await Promise.all(userIds.map(userId => this.sendNotification({ ...notificationData, userId })));
            logger_1.logger.info(`Bulk notification sent to ${userIds.length} users`);
            return notifications;
        }
        catch (error) {
            logger_1.logger.error('Error sending bulk notification:', error);
            throw error;
        }
    }
    async markAsRead(notificationId, userId, tenantId) {
        try {
            const notification = await this.prisma.notification.update({
                where: {
                    id: notificationId,
                    userId,
                    tenantId,
                },
                data: {
                    status: client_1.NotificationStatus.READ,
                    readAt: new Date(),
                },
            });
            // Send real-time update
            await this.sendRealTimeUpdate(userId, {
                type: 'notification_read',
                notificationId,
            });
            return notification;
        }
        catch (error) {
            logger_1.logger.error('Error marking notification as read:', error);
            throw error;
        }
    }
    async markAllAsRead(userId, tenantId) {
        try {
            const result = await this.prisma.notification.updateMany({
                where: {
                    userId,
                    tenantId,
                    status: client_1.NotificationStatus.UNREAD,
                },
                data: {
                    status: client_1.NotificationStatus.READ,
                    readAt: new Date(),
                },
            });
            // Send real-time update
            await this.sendRealTimeUpdate(userId, {
                type: 'all_notifications_read',
                count: result.count,
            });
            logger_1.logger.info(`Marked ${result.count} notifications as read for user ${userId}`);
            return result.count;
        }
        catch (error) {
            logger_1.logger.error('Error marking all notifications as read:', error);
            throw error;
        }
    }
    async archiveNotification(notificationId, userId, tenantId) {
        try {
            const notification = await this.prisma.notification.update({
                where: {
                    id: notificationId,
                    userId,
                    tenantId,
                },
                data: {
                    status: client_1.NotificationStatus.ARCHIVED,
                },
            });
            return notification;
        }
        catch (error) {
            logger_1.logger.error('Error archiving notification:', error);
            throw error;
        }
    }
    async getUserNotifications(userId, tenantId, filters, page = 1, limit = 20) {
        const where = { userId, tenantId };
        if (filters) {
            if (filters.status) {
                where.status = filters.status;
            }
            if (filters.type) {
                where.type = filters.type;
            }
            if (filters.priority) {
                where.priority = filters.priority;
            }
            if (filters.dateFrom || filters.dateTo) {
                where.createdAt = {};
                if (filters.dateFrom) {
                    where.createdAt.gte = filters.dateFrom;
                }
                if (filters.dateTo) {
                    where.createdAt.lte = filters.dateTo;
                }
            }
        }
        const [notifications, total, unreadCount] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.notification.count({ where }),
            this.prisma.notification.count({
                where: { userId, tenantId, status: client_1.NotificationStatus.UNREAD },
            }),
        ]);
        return {
            notifications,
            total,
            unreadCount,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async getUnreadCount(userId, tenantId) {
        return this.prisma.notification.count({
            where: {
                userId,
                tenantId,
                status: client_1.NotificationStatus.UNREAD,
            },
        });
    }
    // A064: Real-time Communication via WebSocket
    async subscribeToNotifications(ws, userId) {
        if (!this.userConnections.has(userId)) {
            this.userConnections.set(userId, []);
        }
        this.userConnections.get(userId).push(ws);
        // Send current unread count
        const unreadCount = await this.getUnreadCount(userId, ''); // TODO: Get tenantId from context
        ws.send(JSON.stringify({
            type: 'unread_count',
            count: unreadCount,
        }));
        ws.on('close', () => {
            const connections = this.userConnections.get(userId);
            if (connections) {
                const index = connections.indexOf(ws);
                if (index > -1) {
                    connections.splice(index, 1);
                }
            }
        });
        logger_1.logger.info(`User ${userId} subscribed to notifications`);
    }
    async sendRealTimeNotification(notification) {
        const connections = this.userConnections.get(notification.userId);
        if (connections && connections.length > 0) {
            const message = JSON.stringify({
                type: 'new_notification',
                notification: {
                    id: notification.id,
                    type: notification.type,
                    title: notification.title,
                    message: notification.message,
                    priority: notification.priority,
                    createdAt: notification.createdAt,
                    data: notification.data,
                },
            });
            connections.forEach(ws => {
                if (ws.readyState === ws_1.WebSocket.OPEN) {
                    ws.send(message);
                }
            });
        }
    }
    async sendRealTimeUpdate(userId, update) {
        const connections = this.userConnections.get(userId);
        if (connections && connections.length > 0) {
            const message = JSON.stringify(update);
            connections.forEach(ws => {
                if (ws.readyState === ws_1.WebSocket.OPEN) {
                    ws.send(message);
                }
            });
        }
    }
    // A064: Email Notifications
    async sendEmailNotification(notification) {
        try {
            if (!this.emailTransporter || !notification.user.email) {
                return;
            }
            const template = await this.getTemplate(notification.type, notification.tenantId);
            const subject = template ? this.renderTemplate(template.subject, notification) : notification.title;
            const body = template ? this.renderTemplate(template.template, notification) : notification.message;
            await this.emailTransporter.sendMail({
                from: config_1.config.emailFrom,
                to: notification.user.email,
                subject,
                html: body,
            });
            logger_1.logger.info(`Email notification sent to ${notification.user.email}`);
        }
        catch (error) {
            logger_1.logger.error('Error sending email notification:', error);
        }
    }
    shouldSendEmail(notification) {
        // Send email for high priority notifications or specific types
        return notification.priority === client_1.Priority.HIGH ||
            notification.priority === client_1.Priority.CRITICAL ||
            notification.type === client_1.NotificationType.SYSTEM_ALERT ||
            notification.type === client_1.NotificationType.DOCUMENT_APPROVAL;
    }
    // A064: Notification Templates
    async createTemplate(templateData) {
        try {
            const template = await this.prisma.notificationTemplate.create({
                data: templateData,
            });
            // Update cache
            this.templates.set(`${template.type}_${template.tenantId}`, template);
            logger_1.logger.info(`Notification template created: ${template.id} (${template.name})`);
            return template;
        }
        catch (error) {
            logger_1.logger.error('Error creating notification template:', error);
            throw error;
        }
    }
    async updateTemplate(templateId, updateData, tenantId) {
        try {
            const template = await this.prisma.notificationTemplate.update({
                where: { id: templateId, tenantId },
                data: updateData,
            });
            // Update cache
            this.templates.set(`${template.type}_${template.tenantId}`, template);
            logger_1.logger.info(`Notification template updated: ${templateId}`);
            return template;
        }
        catch (error) {
            logger_1.logger.error('Error updating notification template:', error);
            throw error;
        }
    }
    async getTemplates(tenantId) {
        return this.prisma.notificationTemplate.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' },
        });
    }
    async getTemplate(type, tenantId) {
        const cacheKey = `${type}_${tenantId}`;
        if (this.templates.has(cacheKey)) {
            return this.templates.get(cacheKey);
        }
        const template = await this.prisma.notificationTemplate.findFirst({
            where: { type, tenantId, isActive: true },
        });
        if (template) {
            this.templates.set(cacheKey, template);
        }
        return template;
    }
    renderTemplate(template, notification) {
        return template
            .replace(/\{\{title\}\}/g, notification.title)
            .replace(/\{\{message\}\}/g, notification.message)
            .replace(/\{\{userName\}\}/g, notification.user ? `${notification.user.firstName} ${notification.user.lastName}` : '')
            .replace(/\{\{userEmail\}\}/g, notification.user?.email || '')
            .replace(/\{\{priority\}\}/g, notification.priority)
            .replace(/\{\{type\}\}/g, notification.type)
            .replace(/\{\{createdAt\}\}/g, notification.createdAt.toISOString());
    }
    // A064: Escalation Mechanisms
    async setupEscalation(notification) {
        // Only set up escalation for high priority notifications that require action
        if (notification.priority !== client_1.Priority.HIGH && notification.priority !== client_1.Priority.CRITICAL) {
            return;
        }
        const escalationRules = await this.getEscalationRules(notification.type, notification.tenantId);
        for (const rule of escalationRules) {
            setTimeout(async () => {
                await this.processEscalation(notification, rule);
            }, rule.afterMinutes * 60 * 1000);
        }
    }
    async processEscalation(notification, rule) {
        try {
            // Check if notification is still unread
            const currentNotification = await this.prisma.notification.findUnique({
                where: { id: notification.id },
            });
            if (!currentNotification || currentNotification.status !== client_1.NotificationStatus.UNREAD) {
                return; // Already read, no need to escalate
            }
            // Send escalation notifications
            for (const escalateToUserId of rule.escalateTo) {
                await this.sendNotification({
                    userId: escalateToUserId,
                    type: rule.notificationType,
                    title: `Escalated: ${notification.title}`,
                    message: `This notification has been escalated: ${notification.message}`,
                    priority: rule.priority,
                    data: {
                        originalNotificationId: notification.id,
                        escalated: true,
                    },
                    tenantId: notification.tenantId,
                });
            }
            logger_1.logger.info(`Notification escalated: ${notification.id}`);
        }
        catch (error) {
            logger_1.logger.error('Error processing escalation:', error);
        }
    }
    async getEscalationRules(type, tenantId) {
        // This would typically be configured per tenant/organization
        // For now, return default rules
        const defaultRules = [];
        if (type === client_1.NotificationType.DOCUMENT_APPROVAL) {
            defaultRules.push({
                afterMinutes: 60, // 1 hour
                escalateTo: [], // Would be configured with manager IDs
                notificationType: client_1.NotificationType.REMINDER,
                priority: client_1.Priority.HIGH,
            });
        }
        if (type === client_1.NotificationType.SYSTEM_ALERT) {
            defaultRules.push({
                afterMinutes: 30, // 30 minutes
                escalateTo: [], // Would be configured with admin IDs
                notificationType: client_1.NotificationType.SYSTEM_ALERT,
                priority: client_1.Priority.CRITICAL,
            });
        }
        return defaultRules;
    }
    // A064: Communication Features
    async sendSystemAlert(title, message, tenantId, userIds) {
        try {
            let targetUserIds = userIds;
            if (!targetUserIds) {
                // Send to all active users in tenant
                const users = await this.prisma.user.findMany({
                    where: { tenantId, isActive: true },
                    select: { id: true },
                });
                targetUserIds = users.map(u => u.id);
            }
            await this.sendBulkNotification(targetUserIds, {
                type: client_1.NotificationType.SYSTEM_ALERT,
                title,
                message,
                priority: client_1.Priority.HIGH,
                tenantId,
            });
            logger_1.logger.info(`System alert sent to ${targetUserIds.length} users`);
        }
        catch (error) {
            logger_1.logger.error('Error sending system alert:', error);
            throw error;
        }
    }
    async sendReminder(userId, title, message, tenantId, data) {
        await this.sendNotification({
            userId,
            type: client_1.NotificationType.REMINDER,
            title,
            message,
            priority: client_1.Priority.MEDIUM,
            data,
            tenantId,
        });
    }
    // Cleanup old notifications
    async cleanupOldNotifications(daysToKeep = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            const result = await this.prisma.notification.deleteMany({
                where: {
                    createdAt: { lt: cutoffDate },
                    status: { in: [client_1.NotificationStatus.READ, client_1.NotificationStatus.ARCHIVED] },
                },
            });
            logger_1.logger.info(`Cleaned up ${result.count} old notifications`);
            return result.count;
        }
        catch (error) {
            logger_1.logger.error('Error cleaning up old notifications:', error);
            throw error;
        }
    }
    initializeEmailTransporter() {
        if (config_1.config.emailHost && config_1.config.emailPort && config_1.config.emailUser && config_1.config.emailPassword) {
            this.emailTransporter = nodemailer_1.default.createTransport({
                host: config_1.config.emailHost,
                port: config_1.config.emailPort,
                secure: config_1.config.emailSecure || false,
                auth: {
                    user: config_1.config.emailUser,
                    pass: config_1.config.emailPassword,
                },
            });
            logger_1.logger.info('Email transporter initialized');
        }
        else {
            logger_1.logger.warn('Email configuration not found, email notifications disabled');
        }
    }
    async loadTemplates() {
        try {
            const templates = await this.prisma.notificationTemplate.findMany({
                where: { isActive: true },
            });
            templates.forEach(template => {
                this.templates.set(`${template.type}_${template.tenantId}`, template);
            });
            logger_1.logger.info(`Loaded ${templates.length} notification templates`);
        }
        catch (error) {
            logger_1.logger.error('Error loading notification templates:', error);
        }
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=notification.service.js.map