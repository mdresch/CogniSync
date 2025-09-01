import { PrismaClient, Notification, NotificationTemplate, NotificationType, NotificationStatus, Priority } from '@prisma/client';
import { WebSocketServer, WebSocket } from 'ws';
import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

export interface SendNotificationRequest {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  priority?: Priority;
  tenantId: string;
}

export interface CreateTemplateRequest {
  name: string;
  type: NotificationType;
  subject: string;
  template: string;
  tenantId: string;
}

export interface NotificationFilters {
  status?: NotificationStatus;
  type?: NotificationType;
  priority?: Priority;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface EscalationRule {
  afterMinutes: number;
  escalateTo: string[];
  notificationType: NotificationType;
  priority: Priority;
}

export class NotificationService {
  private prisma: PrismaClient;
  private wss: WebSocketServer;
  private emailTransporter?: nodemailer.Transporter;
  private userConnections: Map<string, WebSocket[]> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();

  constructor(prisma: PrismaClient, wss: WebSocketServer) {
    this.prisma = prisma;
    this.wss = wss;
    this.initializeEmailTransporter();
    this.loadTemplates();
  }

  // A064: Core Notification System
  async sendNotification(notificationData: SendNotificationRequest): Promise<Notification> {
    try {
      // Create notification record
      const notification = await this.prisma.notification.create({
        data: {
          userId: notificationData.userId,
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          data: notificationData.data || {},
          priority: notificationData.priority || Priority.MEDIUM,
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

      logger.info(`Notification sent: ${notification.id} to user ${notificationData.userId}`);
      return notification;
    } catch (error) {
      logger.error('Error sending notification:', error);
      throw error;
    }
  }

  async sendBulkNotification(userIds: string[], notificationData: Omit<SendNotificationRequest, 'userId'>): Promise<Notification[]> {
    try {
      const notifications = await Promise.all(
        userIds.map(userId => 
          this.sendNotification({ ...notificationData, userId })
        )
      );

      logger.info(`Bulk notification sent to ${userIds.length} users`);
      return notifications;
    } catch (error) {
      logger.error('Error sending bulk notification:', error);
      throw error;
    }
  }

  async markAsRead(notificationId: string, userId: string, tenantId: string): Promise<Notification> {
    try {
      const notification = await this.prisma.notification.update({
        where: { 
          id: notificationId,
          userId,
          tenantId,
        },
        data: {
          status: NotificationStatus.READ,
          readAt: new Date(),
        },
      });

      // Send real-time update
      await this.sendRealTimeUpdate(userId, {
        type: 'notification_read',
        notificationId,
      });

      return notification;
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  async markAllAsRead(userId: string, tenantId: string): Promise<number> {
    try {
      const result = await this.prisma.notification.updateMany({
        where: {
          userId,
          tenantId,
          status: NotificationStatus.UNREAD,
        },
        data: {
          status: NotificationStatus.READ,
          readAt: new Date(),
        },
      });

      // Send real-time update
      await this.sendRealTimeUpdate(userId, {
        type: 'all_notifications_read',
        count: result.count,
      });

      logger.info(`Marked ${result.count} notifications as read for user ${userId}`);
      return result.count;
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  async archiveNotification(notificationId: string, userId: string, tenantId: string): Promise<Notification> {
    try {
      const notification = await this.prisma.notification.update({
        where: { 
          id: notificationId,
          userId,
          tenantId,
        },
        data: {
          status: NotificationStatus.ARCHIVED,
        },
      });

      return notification;
    } catch (error) {
      logger.error('Error archiving notification:', error);
      throw error;
    }
  }

  async getUserNotifications(
    userId: string, 
    tenantId: string, 
    filters?: NotificationFilters,
    page = 1,
    limit = 20
  ): Promise<{
    notifications: Notification[];
    total: number;
    unreadCount: number;
    page: number;
    totalPages: number;
  }> {
    const where: any = { userId, tenantId };

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
        where: { userId, tenantId, status: NotificationStatus.UNREAD },
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

  async getUnreadCount(userId: string, tenantId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        tenantId,
        status: NotificationStatus.UNREAD,
      },
    });
  }

  // A064: Real-time Communication via WebSocket
  async subscribeToNotifications(ws: WebSocket, userId: string): Promise<void> {
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, []);
    }
    this.userConnections.get(userId)!.push(ws);

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

    logger.info(`User ${userId} subscribed to notifications`);
  }

  private async sendRealTimeNotification(notification: Notification & { user: any }): Promise<void> {
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
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }

  private async sendRealTimeUpdate(userId: string, update: any): Promise<void> {
    const connections = this.userConnections.get(userId);
    if (connections && connections.length > 0) {
      const message = JSON.stringify(update);

      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }

  // A064: Email Notifications
  private async sendEmailNotification(notification: Notification & { user: any }): Promise<void> {
    try {
      if (!this.emailTransporter || !notification.user.email) {
        return;
      }

      const template = await this.getTemplate(notification.type, notification.tenantId);
      const subject = template ? this.renderTemplate(template.subject, notification) : notification.title;
      const body = template ? this.renderTemplate(template.template, notification) : notification.message;

      await this.emailTransporter.sendMail({
        from: config.emailFrom,
        to: notification.user.email,
        subject,
        html: body,
      });

      logger.info(`Email notification sent to ${notification.user.email}`);
    } catch (error) {
      logger.error('Error sending email notification:', error);
    }
  }

  private shouldSendEmail(notification: Notification): boolean {
    // Send email for high priority notifications or specific types
    return notification.priority === Priority.HIGH || 
           notification.priority === Priority.CRITICAL ||
           notification.type === NotificationType.SYSTEM_ALERT ||
           notification.type === NotificationType.DOCUMENT_APPROVAL;
  }

  // A064: Notification Templates
  async createTemplate(templateData: CreateTemplateRequest): Promise<NotificationTemplate> {
    try {
      const template = await this.prisma.notificationTemplate.create({
        data: templateData,
      });

      // Update cache
      this.templates.set(`${template.type}_${template.tenantId}`, template);

      logger.info(`Notification template created: ${template.id} (${template.name})`);
      return template;
    } catch (error) {
      logger.error('Error creating notification template:', error);
      throw error;
    }
  }

  async updateTemplate(templateId: string, updateData: Partial<CreateTemplateRequest>, tenantId: string): Promise<NotificationTemplate> {
    try {
      const template = await this.prisma.notificationTemplate.update({
        where: { id: templateId, tenantId },
        data: updateData,
      });

      // Update cache
      this.templates.set(`${template.type}_${template.tenantId}`, template);

      logger.info(`Notification template updated: ${templateId}`);
      return template;
    } catch (error) {
      logger.error('Error updating notification template:', error);
      throw error;
    }
  }

  async getTemplates(tenantId: string): Promise<NotificationTemplate[]> {
    return this.prisma.notificationTemplate.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  private async getTemplate(type: NotificationType, tenantId: string): Promise<NotificationTemplate | null> {
    const cacheKey = `${type}_${tenantId}`;
    
    if (this.templates.has(cacheKey)) {
      return this.templates.get(cacheKey)!;
    }

    const template = await this.prisma.notificationTemplate.findFirst({
      where: { type, tenantId, isActive: true },
    });

    if (template) {
      this.templates.set(cacheKey, template);
    }

    return template;
  }

  private renderTemplate(template: string, notification: Notification & { user?: any }): string {
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
  private async setupEscalation(notification: Notification): Promise<void> {
    // Only set up escalation for high priority notifications that require action
    if (notification.priority !== Priority.HIGH && notification.priority !== Priority.CRITICAL) {
      return;
    }

    const escalationRules = await this.getEscalationRules(notification.type, notification.tenantId);
    
    for (const rule of escalationRules) {
      setTimeout(async () => {
        await this.processEscalation(notification, rule);
      }, rule.afterMinutes * 60 * 1000);
    }
  }

  private async processEscalation(notification: Notification, rule: EscalationRule): Promise<void> {
    try {
      // Check if notification is still unread
      const currentNotification = await this.prisma.notification.findUnique({
        where: { id: notification.id },
      });

      if (!currentNotification || currentNotification.status !== NotificationStatus.UNREAD) {
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

      logger.info(`Notification escalated: ${notification.id}`);
    } catch (error) {
      logger.error('Error processing escalation:', error);
    }
  }

  private async getEscalationRules(type: NotificationType, tenantId: string): Promise<EscalationRule[]> {
    // This would typically be configured per tenant/organization
    // For now, return default rules
    const defaultRules: EscalationRule[] = [];

    if (type === NotificationType.DOCUMENT_APPROVAL) {
      defaultRules.push({
        afterMinutes: 60, // 1 hour
        escalateTo: [], // Would be configured with manager IDs
        notificationType: NotificationType.REMINDER,
        priority: Priority.HIGH,
      });
    }

    if (type === NotificationType.SYSTEM_ALERT) {
      defaultRules.push({
        afterMinutes: 30, // 30 minutes
        escalateTo: [], // Would be configured with admin IDs
        notificationType: NotificationType.SYSTEM_ALERT,
        priority: Priority.CRITICAL,
      });
    }

    return defaultRules;
  }

  // A064: Communication Features
  async sendSystemAlert(title: string, message: string, tenantId: string, userIds?: string[]): Promise<void> {
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
        type: NotificationType.SYSTEM_ALERT,
        title,
        message,
        priority: Priority.HIGH,
        tenantId,
      });

      logger.info(`System alert sent to ${targetUserIds.length} users`);
    } catch (error) {
      logger.error('Error sending system alert:', error);
      throw error;
    }
  }

  async sendReminder(userId: string, title: string, message: string, tenantId: string, data?: any): Promise<void> {
    await this.sendNotification({
      userId,
      type: NotificationType.REMINDER,
      title,
      message,
      priority: Priority.MEDIUM,
      data,
      tenantId,
    });
  }

  // Cleanup old notifications
  async cleanupOldNotifications(daysToKeep = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.prisma.notification.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          status: { in: [NotificationStatus.READ, NotificationStatus.ARCHIVED] },
        },
      });

      logger.info(`Cleaned up ${result.count} old notifications`);
      return result.count;
    } catch (error) {
      logger.error('Error cleaning up old notifications:', error);
      throw error;
    }
  }

  private initializeEmailTransporter(): void {
    if (config.emailHost && config.emailPort && config.emailUser && config.emailPassword) {
      this.emailTransporter = nodemailer.createTransport({
        host: config.emailHost,
        port: config.emailPort,
        secure: config.emailSecure || false,
        auth: {
          user: config.emailUser,
          pass: config.emailPassword,
        },
      });

      logger.info('Email transporter initialized');
    } else {
      logger.warn('Email configuration not found, email notifications disabled');
    }
  }

  private async loadTemplates(): Promise<void> {
    try {
      const templates = await this.prisma.notificationTemplate.findMany({
        where: { isActive: true },
      });

      templates.forEach(template => {
        this.templates.set(`${template.type}_${template.tenantId}`, template);
      });

      logger.info(`Loaded ${templates.length} notification templates`);
    } catch (error) {
      logger.error('Error loading notification templates:', error);
    }
  }
}