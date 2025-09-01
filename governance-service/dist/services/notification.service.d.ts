import { PrismaClient, Notification, NotificationTemplate, NotificationType, NotificationStatus, Priority } from '@prisma/client';
import { WebSocketServer, WebSocket } from 'ws';
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
export declare class NotificationService {
    private prisma;
    private wss;
    private emailTransporter?;
    private userConnections;
    private templates;
    constructor(prisma: PrismaClient, wss: WebSocketServer);
    sendNotification(notificationData: SendNotificationRequest): Promise<Notification>;
    sendBulkNotification(userIds: string[], notificationData: Omit<SendNotificationRequest, 'userId'>): Promise<Notification[]>;
    markAsRead(notificationId: string, userId: string, tenantId: string): Promise<Notification>;
    markAllAsRead(userId: string, tenantId: string): Promise<number>;
    archiveNotification(notificationId: string, userId: string, tenantId: string): Promise<Notification>;
    getUserNotifications(userId: string, tenantId: string, filters?: NotificationFilters, page?: number, limit?: number): Promise<{
        notifications: Notification[];
        total: number;
        unreadCount: number;
        page: number;
        totalPages: number;
    }>;
    getUnreadCount(userId: string, tenantId: string): Promise<number>;
    subscribeToNotifications(ws: WebSocket, userId: string): Promise<void>;
    private sendRealTimeNotification;
    private sendRealTimeUpdate;
    private sendEmailNotification;
    private shouldSendEmail;
    createTemplate(templateData: CreateTemplateRequest): Promise<NotificationTemplate>;
    updateTemplate(templateId: string, updateData: Partial<CreateTemplateRequest>, tenantId: string): Promise<NotificationTemplate>;
    getTemplates(tenantId: string): Promise<NotificationTemplate[]>;
    private getTemplate;
    private renderTemplate;
    private setupEscalation;
    private processEscalation;
    private getEscalationRules;
    sendSystemAlert(title: string, message: string, tenantId: string, userIds?: string[]): Promise<void>;
    sendReminder(userId: string, title: string, message: string, tenantId: string, data?: any): Promise<void>;
    cleanupOldNotifications(daysToKeep?: number): Promise<number>;
    private initializeEmailTransporter;
    private loadTemplates;
}
//# sourceMappingURL=notification.service.d.ts.map