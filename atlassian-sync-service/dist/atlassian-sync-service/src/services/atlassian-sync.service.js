"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AtlassianSyncService = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../logger");
const metrics_1 = require("../metrics");
const message_bus_service_1 = require("./message-bus.service");
const logger = (0, logger_1.getLogger)('AtlassianSyncService');
const metrics = (0, metrics_1.getMetrics)();
const prisma = new client_1.PrismaClient();
const WORKER_INTERVAL_MS = 10000;
const BATCH_SIZE = 10;
class AtlassianSyncService {
    constructor() {
        this.workerInterval = null;
    }
    async enqueueWebhookEvent(configId, payload) {
        logger.info({ configId, msg: 'Event received. Enqueuing for processing.' });
        metrics.incrementEventsReceived();
        const event = await prisma.syncEvent.create({
            data: { configId, changes: payload, type: payload.webhookEvent || 'unknown', source: 'jira',
                externalId: payload.issue?.id || payload.page?.id, processingStatus: client_1.ProcessingStatus.PENDING,
                tenantId: 'default',
            },
        });
        return event;
    }
    startProcessing() {
        logger.info(`Starting background worker with ${WORKER_INTERVAL_MS}ms interval.`);
        this.workerInterval = setInterval(() => this.processPendingEvents(), WORKER_INTERVAL_MS);
    }
    stopProcessing() {
        if (this.workerInterval) {
            logger.info('Stopping background worker.');
            clearInterval(this.workerInterval);
            this.workerInterval = null;
        }
    }
    async processPendingEvents() {
        const eventsToProcess = await this.leaseEvents(BATCH_SIZE);
        if (eventsToProcess.length > 0) {
            logger.info(`Worker leased ${eventsToProcess.length} events for processing.`);
        }
        for (const event of eventsToProcess) {
            await this.processSingleEvent(event);
        }
    }
    async leaseEvents(limit) {
        const events = await prisma.syncEvent.findMany({
            where: { processingStatus: { in: [client_1.ProcessingStatus.PENDING, client_1.ProcessingStatus.RETRYING] } },
            take: limit, orderBy: { timestamp: 'asc' },
        });
        if (events.length === 0)
            return [];
        const eventIds = events.map((e) => e.id);
        await prisma.syncEvent.updateMany({ where: { id: { in: eventIds } }, data: { processingStatus: client_1.ProcessingStatus.PROCESSING } });
        return events;
    }
    async processSingleEvent(event) {
        try {
            await this.publishKnowledgeGraphEvents(event);
            await this.markEventAsCompleted(event.id);
        }
        catch (error) {
            logger.warn({ eventId: event.id, error: error.message, msg: "Event processing failed." });
            await this.handleProcessingFailure(event, error);
        }
    }
    async publishKnowledgeGraphEvents(event) {
        const payload = event.changes;
        if (!payload || !payload.issue || !payload.issue.key || !payload.issue.fields || !payload.issue.fields.summary) {
            logger.warn({ eventId: event.id, payload }, 'Event payload is missing required fields (issue.key, issue.fields.summary). Skipping.');
            return;
        }
        const issue = payload.issue;
        const user = payload.user;
        const issueEntityMessage = {
            body: {
                messageType: 'CREATE_ENTITY',
                payload: {
                    id: issue.key,
                    type: 'Issue',
                    name: issue.fields.summary,
                    metadata: JSON.stringify({
                        status: issue.fields.status?.name,
                        project: issue.fields.project?.key,
                        jiraId: issue.id,
                    }),
                },
            },
            messageId: `${event.id}-issue`
        };
        await message_bus_service_1.messageBusService.sendMessage(issueEntityMessage);
        if (user && user.accountId) {
            const userEntityMessage = {
                body: {
                    messageType: 'CREATE_ENTITY',
                    payload: {
                        id: user.accountId,
                        type: 'Person',
                        name: user.displayName,
                    },
                },
                messageId: `${event.id}-user`
            };
            await message_bus_service_1.messageBusService.sendMessage(userEntityMessage);
            const linkMessage = {
                body: {
                    messageType: 'LINK_ENTITIES',
                    payload: {
                        sourceEntityId: issue.key,
                        targetEntityId: user.accountId,
                        relationshipType: 'REPORTED_BY',
                    },
                },
                messageId: `${event.id}-link`
            };
            await message_bus_service_1.messageBusService.sendMessage(linkMessage);
        }
    }
    async markEventAsCompleted(eventId) {
        logger.info({ eventId, msg: "Event processed and published successfully." });
        metrics.incrementEventsSucceeded();
        await prisma.syncEvent.update({ where: { id: eventId }, data: { processingStatus: client_1.ProcessingStatus.COMPLETED, errorMessage: null } });
    }
    async handleProcessingFailure(event, error) {
        const config = await prisma.syncConfiguration.findFirst({ where: { id: event.configId } });
        const retryLimit = config?.retryLimit ?? 3;
        const newRetryCount = event.retryCount + 1;
        if (newRetryCount > retryLimit) {
            metrics.incrementEventsDlq();
            logger.error({ eventId: event.id, error: error.message }, "Retry limit exceeded. Moving to DLQ.");
            await prisma.syncEvent.update({
                where: { id: event.id },
                data: {
                    processingStatus: client_1.ProcessingStatus.FAILED,
                    dlqPayload: event.changes ?? client_1.Prisma.DbNull,
                    dlqError: error.message,
                    dlqFailedAt: new Date(),
                    dlqAttempts: newRetryCount,
                    errorMessage: error.message,
                },
            });
        }
        else {
            metrics.incrementEventsRetried();
            logger.warn({ eventId: event.id, attempt: newRetryCount }, "Scheduling retry.");
            await prisma.syncEvent.update({
                where: { id: event.id },
                data: { processingStatus: client_1.ProcessingStatus.RETRYING, retryCount: newRetryCount, errorMessage: error.message },
            });
        }
    }
}
exports.AtlassianSyncService = AtlassianSyncService;
//# sourceMappingURL=atlassian-sync.service.js.map