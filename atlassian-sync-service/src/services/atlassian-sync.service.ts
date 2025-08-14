
// src/services/atlassian-sync.service.ts


import { PrismaClient, SyncEvent, ProcessingStatus, Prisma } from '@prisma/client';
import { getLogger } from '../logger';
import { getMetrics } from '../metrics';
import { messageBusService } from './message-bus.service';

const logger = getLogger('AtlassianSyncService');
const metrics = getMetrics();
const prisma = new PrismaClient();

const WORKER_INTERVAL_MS = 10000;
const BATCH_SIZE = 10;

export class AtlassianSyncService {
  private workerInterval: NodeJS.Timeout | null = null;

  constructor() {}
  
  public async enqueueWebhookEvent(configId: string, payload: any): Promise<SyncEvent> {
    logger.info({ configId, msg: 'Event received. Enqueuing for processing.' });
    metrics.incrementEventsReceived();
    const event = await prisma.syncEvent.create({
      data: { configId, changes: payload, type: payload.webhookEvent || 'unknown', source: 'jira',
        externalId: payload.issue?.id || payload.page?.id, processingStatus: ProcessingStatus.PENDING,
        tenantId: 'default',
      },
    });
    return event;
  }

  public startProcessing() {
    logger.info(`Starting background worker with ${WORKER_INTERVAL_MS}ms interval.`);
    this.workerInterval = setInterval(() => this.processPendingEvents(), WORKER_INTERVAL_MS);
  }

  public stopProcessing() {
    if (this.workerInterval) {
      logger.info('Stopping background worker.');
      clearInterval(this.workerInterval);
      this.workerInterval = null;
    }
  }

  private async processPendingEvents(): Promise<void> {
    const eventsToProcess = await this.leaseEvents(BATCH_SIZE);
    if (eventsToProcess.length > 0) {
      logger.info(`Worker leased ${eventsToProcess.length} events for processing.`);
    }
    for (const event of eventsToProcess) {
      await this.processSingleEvent(event);
    }
  }

  private async leaseEvents(limit: number): Promise<SyncEvent[]> {
    const events = await prisma.syncEvent.findMany({
      where: { processingStatus: { in: [ProcessingStatus.PENDING, ProcessingStatus.RETRYING] }},
      take: limit, orderBy: { timestamp: 'asc' },
    });
    if (events.length === 0) return [];
    const eventIds = events.map((e) => e.id);
    await prisma.syncEvent.updateMany({ where: { id: { in: eventIds } }, data: { processingStatus: ProcessingStatus.PROCESSING }});
    return events;
  }

  /**
   * REFACTORED: This now calls the event publishing logic.
   */
  private async processSingleEvent(event: SyncEvent): Promise<void> {
    try {
      // The mock logic is now replaced with a call to publish real events.
      await this.publishKnowledgeGraphEvents(event);
      await this.markEventAsCompleted(event.id);
    } catch (error: any) {
      logger.warn({ eventId: event.id, error: error.message, msg: "Event processing failed."});
      await this.handleProcessingFailure(event, error);
    }
  }

  /**
   * NEW METHOD: This is the core of the integration.
   * It transforms the raw webhook event into structured messages for the Knowledge Graph.
   */
  private async publishKnowledgeGraphEvents(event: SyncEvent): Promise<void> {
    const payload = event.changes as any;

    // THE FIX: Add a more specific guard clause to validate the payload structure.
    if (!payload || !payload.issue || !payload.issue.key || !payload.issue.fields || !payload.issue.fields.summary) {
      logger.warn({ eventId: event.id, payload }, 'Event payload is missing required fields (issue.key, issue.fields.summary). Skipping.');
      // We will mark this as complete because it's not a transient error and cannot be retried.
      return;
    }

    const issue = payload.issue;
    const user = payload.user;

    // 1. Create a message to represent the Jira Issue as an Entity
    const issueEntityMessage = {
      body: {
        messageType: 'CREATE_ENTITY',
        payload: {
          id: issue.key, // Use the human-readable key like 'KAN-25'
          type: 'Issue',
          name: issue.fields.summary,
          metadata: JSON.stringify({
            status: issue.fields.status?.name, // Safe access
            project: issue.fields.project?.key, // Safe access
            jiraId: issue.id,
          }),
        },
      },
      messageId: `${event.id}-issue`
    };
    await messageBusService.sendMessage(issueEntityMessage);

    // 2. Create a message to represent the User as an Entity
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
      await messageBusService.sendMessage(userEntityMessage);

      // 3. Create a message to LINK the Issue to the User
      const linkMessage = {
        body: {
          messageType: 'LINK_ENTITIES',
          payload: {
            sourceEntityId: issue.key,
            targetEntityId: user.accountId,
            relationshipType: 'REPORTED_BY', // Or 'ASSIGNED_TO' etc. based on event type
          },
        },
        messageId: `${event.id}-link`
      };
      await messageBusService.sendMessage(linkMessage);
    }
  }

  // markEventAsCompleted and handleProcessingFailure remain the same
  // ... Paste the existing methods here ...
  private async markEventAsCompleted(eventId: string): Promise<void> {
    logger.info({ eventId, msg: "Event processed and published successfully." });
    metrics.incrementEventsSucceeded();
    await prisma.syncEvent.update({ where: { id: eventId }, data: { processingStatus: ProcessingStatus.COMPLETED, errorMessage: null }});
  }

  private async handleProcessingFailure(event: SyncEvent, error: Error): Promise<void> {
    const config = await prisma.syncConfiguration.findFirst({where: {id: event.configId!}});
    const retryLimit = config?.retryLimit ?? 3;
    const newRetryCount = event.retryCount + 1;

    if (newRetryCount > retryLimit) {
      metrics.incrementEventsDlq();
      logger.error({ eventId: event.id, error: error.message }, "Retry limit exceeded. Moving to DLQ.");
      await prisma.syncEvent.update({
        where: { id: event.id },
        data: {
          processingStatus: ProcessingStatus.FAILED,
          dlqPayload: event.changes ?? Prisma.DbNull,
          dlqError: error.message,
          dlqFailedAt: new Date(),
          dlqAttempts: newRetryCount,
          errorMessage: error.message,
        },
      });
    } else {
      metrics.incrementEventsRetried();
      logger.warn({ eventId: event.id, attempt: newRetryCount }, "Scheduling retry.");
      await prisma.syncEvent.update({
        where: { id: event.id },
        data: { processingStatus: ProcessingStatus.RETRYING, retryCount: newRetryCount, errorMessage: error.message },
      });
    }
  }
}
