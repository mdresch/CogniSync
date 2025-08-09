/**
 * Atlassian Sync Service
 * Extracts and processes webhooks from Confluence and Jira,
 * transforming them into Knowledge Graph entities via HTTP API calls.
 */

import axios, { AxiosInstance } from 'axios';
import { PrismaClient } from '@prisma/client';

interface KnowledgeGraphClient {
  baseURL: string;
  apiKey: string;
  client: AxiosInstance;
}

interface SyncConfig {
  tenantId: string;
  source: 'confluence' | 'jira';
  kgServiceUrl: string;
  kgApiKey: string;
  mappingRules: any;
  filters?: any;
  batchSize: number;
  retryLimit: number;
  retryDelay: number;
}

interface WebhookEvent {
  eventType: string;
  timestamp: Date;
  user?: {
    accountId: string;
    displayName: string;
    emailAddress?: string;
  };
  page?: any;
  issue?: any;
  space?: any;
  project?: any;
  comment?: any;
}

interface EntityCreationResult {
  entityId: string;
  relationshipIds?: string[];
  success: boolean;
  error?: string;
}

export class AtlassianSyncService {
  private prisma: PrismaClient;
  private kgClients: Map<string, KnowledgeGraphClient> = new Map();

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Initialize Knowledge Graph client for a tenant
   */
  private initializeKGClient(config: SyncConfig): void {
    const clientKey = `${config.tenantId}-${config.source}`;
    
    if (!this.kgClients.has(clientKey)) {
      const client = axios.create({
        baseURL: config.kgServiceUrl,
        headers: {
          'Authorization': `Bearer ${config.kgApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      this.kgClients.set(clientKey, {
        baseURL: config.kgServiceUrl,
        apiKey: config.kgApiKey,
        client,
      });
    }
  }

  /**
   * Get or create Knowledge Graph client
   */
  private getKGClient(config: SyncConfig): AxiosInstance {
    const clientKey = `${config.tenantId}-${config.source}`;
    this.initializeKGClient(config);
    return this.kgClients.get(clientKey)!.client;
  }

  /**
   * Process webhook event from Confluence or Jira
   */
  async processWebhookEvent(
    webhookPayload: any,
    configId: string,
    signature?: string
  ): Promise<{ success: boolean; syncEventId?: string; error?: string }> {
    try {
      // Get sync configuration
      const config = await this.prisma.syncConfiguration.findUnique({
        where: { id: configId },
      });

      if (!config || !config.enabled) {
        throw new Error(`Sync configuration not found or disabled: ${configId}`);
      }

      // Verify webhook signature if provided
      if (signature && !this.verifyWebhookSignature(webhookPayload, signature, config.webhookSecret)) {
        throw new Error('Invalid webhook signature');
      }

      // Create webhook delivery record
      const webhookDelivery = await this.prisma.webhookDelivery.create({
        data: {
          tenantId: config.tenantId,
          source: config.source,
          eventType: webhookPayload.eventType || 'unknown',
          payload: webhookPayload,
          signature,
          status: 'validated',
        },
      });

      // Extract event data
      const event = this.extractEventData(webhookPayload, config.source);
      
      // Create sync event
      const syncEvent = await this.prisma.syncEvent.create({
        data: {
          type: event.eventType,
          source: config.source,
          timestamp: event.timestamp,
          actorId: event.user?.accountId,
          entityId: this.extractEntityId(event),
          externalId: this.extractExternalId(event),
          changes: this.extractChanges(event),
          metadata: webhookPayload,
          tenantId: config.tenantId,
          processingStatus: 'processing',
        },
      });

      // Update webhook delivery with sync event
      await this.prisma.webhookDelivery.update({
        where: { id: webhookDelivery.id },
        data: { 
          syncEventId: syncEvent.id,
          status: 'processing',
          processedAt: new Date(),
        },
      });

      // Prepare SyncConfig object for type safety
      const syncConfig: SyncConfig = {
        tenantId: config.tenantId,
        source: config.source as 'confluence' | 'jira',
        kgServiceUrl: config.kgServiceUrl,
        kgApiKey: config.kgApiKey,
        mappingRules: config.mappingRules,
        filters: config.filters,
        batchSize: config.batchSize,
        retryLimit: config.retryLimit,
        retryDelay: config.retryDelay,
      };

      // Process the event based on type
      const result = await this.processEventByType(event, syncConfig);

      // Update sync event with results
      await this.prisma.syncEvent.update({
        where: { id: syncEvent.id },
        data: {
          kgEntityId: result.entityId,
          kgRelationshipIds: result.relationshipIds ? JSON.stringify(result.relationshipIds) : undefined,
          processingStatus: result.success ? 'completed' : 'failed',
          errorMessage: result.error,
        },
      });

      // Update webhook delivery status
      await this.prisma.webhookDelivery.update({
        where: { id: webhookDelivery.id },
        data: {
          status: result.success ? 'completed' : 'failed',
          errorMessage: result.error,
        },
      });

      return {
        success: result.success,
        syncEventId: syncEvent.id,
        error: result.error,
      };

    } catch (error) {
      console.error('Error processing webhook event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process event based on its type
   */
  private async processEventByType(event: WebhookEvent, config: SyncConfig): Promise<EntityCreationResult> {
    const kgClient = this.getKGClient(config);

    try {
      // Handle user management first
      if (event.user) {
        await this.ensureUserEntity(event.user, config, kgClient);
      }

      // Process based on event type
      switch (event.eventType) {
        case 'page_created':
        case 'page_updated':
          return await this.processPageEvent(event, config, kgClient);

        case 'page_removed':
          return await this.processPageDeletion(event, config, kgClient);

        case 'issue_created':
        case 'issue_updated':
          return await this.processIssueEvent(event, config, kgClient);

        case 'issue_deleted':
          return await this.processIssueDeletion(event, config, kgClient);

        case 'comment_created':
        case 'comment_updated':
          return await this.processCommentEvent(event, config, kgClient);

        case 'comment_removed':
          return await this.processCommentDeletion(event, config, kgClient);

        default:
          console.warn(`Unhandled event type: ${event.eventType}`);
          return {
            entityId: '',
            success: true, // Don't fail for unhandled events
          };
      }
    } catch (error) {
      console.error(`Error processing ${event.eventType}:`, error);
      return {
        entityId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Processing error',
      };
    }
  }

  /**
   * Process Confluence page events
   */
  private async processPageEvent(event: WebhookEvent, config: SyncConfig, kgClient: AxiosInstance): Promise<EntityCreationResult> {
    const page = event.page;
    if (!page) {
      throw new Error('Page data not found in event');
    }

    // Check if page already exists in mapping
    let entityMapping = await this.prisma.entityMapping.findUnique({
      where: {
        tenantId_source_externalId: {
          tenantId: config.tenantId,
          source: 'confluence',
          externalId: page.id.toString(),
        },
      },
    });

    const entityData = {
      name: page.title,
      type: 'Document',
      description: this.extractPageDescription(page),
      metadata: {
        source: 'confluence',
        pageId: page.id,
        spaceKey: page.space?.key,
        version: page.version?.number,
        url: page._links?.webui,
        createdDate: page.createdDate,
        lastModified: page.lastModified || page.version?.when,
        labels: page.metadata?.labels?.results?.map((l: any) => l.name) || [],
        attachments: page.metadata?.attachments?.results?.length || 0,
      },
      tenantId: config.tenantId,
    };

    let entityId: string;
    let relationshipIds: string[] = [];

    if (entityMapping) {
      // Update existing entity
      const response = await kgClient.put(`/entities/${entityMapping.kgEntityId}`, entityData);
      entityId = response.data.entityId;
      
      // Update mapping
      await this.prisma.entityMapping.update({
        where: { id: entityMapping.id },
        data: {
          lastSyncAt: new Date(),
          syncVersion: page.version?.number?.toString(),
          externalData: page,
        },
      });
    } else {
      // Create new entity
      const response = await kgClient.post('/entities', entityData);
      entityId = response.data.entityId;

      // Create mapping
      await this.prisma.entityMapping.create({
        data: {
          tenantId: config.tenantId,
          source: 'confluence',
          externalId: page.id.toString(),
          externalType: 'page',
          kgEntityId: entityId,
          syncVersion: page.version?.number?.toString(),
          externalData: page,
        },
      });
    }

    // Create relationships
    relationshipIds = await this.createPageRelationships(page, entityId, config, kgClient);

    return {
      entityId,
      relationshipIds,
      success: true,
    };
  }

  /**
   * Process Jira issue events
   */
  private async processIssueEvent(event: WebhookEvent, config: SyncConfig, kgClient: AxiosInstance): Promise<EntityCreationResult> {
    const issue = event.issue;
    if (!issue) {
      throw new Error('Issue data not found in event');
    }

    // Check if issue already exists in mapping
    let entityMapping = await this.prisma.entityMapping.findUnique({
      where: {
        tenantId_source_externalId: {
          tenantId: config.tenantId,
          source: 'jira',
          externalId: issue.key,
        },
      },
    });

    const entityData = {
      name: issue.fields.summary,
      type: this.mapIssueTypeToEntityType(issue.fields.issuetype?.name),
      description: this.stripHtml(issue.fields.description || ''),
      metadata: {
        source: 'jira',
        issueKey: issue.key,
        issueId: issue.id,
        projectKey: issue.fields.project?.key,
        issueType: issue.fields.issuetype?.name,
        status: issue.fields.status?.name,
        priority: issue.fields.priority?.name,
        resolution: issue.fields.resolution?.name,
        created: issue.fields.created,
        updated: issue.fields.updated,
        labels: issue.fields.labels || [],
        components: issue.fields.components?.map((c: any) => c.name) || [],
        fixVersions: issue.fields.fixVersions?.map((v: any) => v.name) || [],
      },
      tenantId: config.tenantId,
    };

    let entityId: string;
    let relationshipIds: string[] = [];

    if (entityMapping) {
      // Update existing entity
      const response = await kgClient.put(`/entities/${entityMapping.kgEntityId}`, entityData);
      entityId = response.data.entityId;
      
      // Update mapping
      await this.prisma.entityMapping.update({
        where: { id: entityMapping.id },
        data: {
          lastSyncAt: new Date(),
          syncVersion: issue.fields.updated,
          externalData: issue,
        },
      });
    } else {
      // Create new entity
      const response = await kgClient.post('/entities', entityData);
      entityId = response.data.entityId;

      // Create mapping
      await this.prisma.entityMapping.create({
        data: {
          tenantId: config.tenantId,
          source: 'jira',
          externalId: issue.key,
          externalType: 'issue',
          kgEntityId: entityId,
          syncVersion: issue.fields.updated,
          externalData: issue,
        },
      });
    }

    // Create relationships
    relationshipIds = await this.createIssueRelationships(issue, entityId, config, kgClient);

    return {
      entityId,
      relationshipIds,
      success: true,
    };
  }

  /**
   * Ensure user entity exists in Knowledge Graph
   */
  private async ensureUserEntity(user: any, config: SyncConfig, kgClient: AxiosInstance): Promise<string> {
    // Check if user mapping exists
    let userMapping = await this.prisma.userMapping.findUnique({
      where: {
        tenantId_atlassianAccountId: {
          tenantId: config.tenantId,
          atlassianAccountId: user.accountId,
        },
      },
    });

    if (userMapping && userMapping.kgEntityId) {
      // Update user info if needed
      await this.prisma.userMapping.update({
        where: { id: userMapping.id },
        data: {
          displayName: user.displayName,
          atlassianEmail: user.emailAddress,
          profile: user,
          lastSyncAt: new Date(),
        },
      });
      return userMapping.kgEntityId;
    }

    // Create user entity in Knowledge Graph
    const userData = {
      name: user.displayName,
      type: 'Person',
      description: `Atlassian user: ${user.displayName}`,
      metadata: {
        source: 'atlassian',
        accountId: user.accountId,
        email: user.emailAddress,
        userType: user.userType || 'atlassian',
      },
      tenantId: config.tenantId,
    };

    const response = await kgClient.post('/entities', userData);
    const entityId = response.data.entityId;

    // Create or update user mapping
    if (userMapping) {
      await this.prisma.userMapping.update({
        where: { id: userMapping.id },
        data: {
          kgEntityId: entityId,
          displayName: user.displayName,
          atlassianEmail: user.emailAddress,
          profile: user,
          lastSyncAt: new Date(),
        },
      });
    } else {
      await this.prisma.userMapping.create({
        data: {
          tenantId: config.tenantId,
          atlassianAccountId: user.accountId,
          atlassianEmail: user.emailAddress,
          displayName: user.displayName,
          kgEntityId: entityId,
          profile: user,
        },
      });
    }

    return entityId;
  }

  // Helper methods for data extraction and processing
  private extractEventData(payload: any, source: string): WebhookEvent {
    // Implementation depends on webhook payload structure
    return {
      eventType: payload.eventType || payload.webhookEvent,
      timestamp: new Date(payload.timestamp || Date.now()),
      user: payload.user,
      page: payload.page,
      issue: payload.issue,
      space: payload.space,
      project: payload.project,
      comment: payload.comment,
    };
  }

  private extractEntityId(event: WebhookEvent): string | null {
    return event.page?.id || event.issue?.id || event.comment?.id || null;
  }

  private extractExternalId(event: WebhookEvent): string | null {
    return event.page?.id || event.issue?.key || event.comment?.id || null;
  }

  private extractChanges(event: WebhookEvent): any {
    // Extract relevant changes from the event
    return {
      eventType: event.eventType,
      timestamp: event.timestamp,
    };
  }

  private extractPageDescription(page: any): string {
    // Extract description from page content
    return page.body?.storage?.value ? this.stripHtml(page.body.storage.value) : '';
  }

  private mapIssueTypeToEntityType(issueType: string): string {
    const mapping: { [key: string]: string } = {
      'Story': 'Requirement',
      'Task': 'Task',
      'Bug': 'Issue',
      'Epic': 'Epic',
      'Sub-task': 'Task',
    };
    return mapping[issueType] || 'Task';
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  private verifyWebhookSignature(payload: any, signature: string, secret: string): boolean {
    // Implement webhook signature verification
    // This would typically use HMAC-SHA256
    return true; // Simplified for now
  }

  // Placeholder methods for relationship creation
  private async createPageRelationships(page: any, entityId: string, config: SyncConfig, kgClient: AxiosInstance): Promise<string[]> {
    const relationshipIds: string[] = [];
    
    // Create relationship with author if available
    if (page.version?.by) {
      const authorId = await this.ensureUserEntity(page.version.by, config, kgClient);
      const response = await kgClient.post('/relationships', {
        fromEntityId: entityId,
        toEntityId: authorId,
        relationshipType: 'AUTHORED_BY',
        metadata: { role: 'author' },
        tenantId: config.tenantId,
      });
      relationshipIds.push(response.data.relationshipId);
    }

    return relationshipIds;
  }

  private async createIssueRelationships(issue: any, entityId: string, config: SyncConfig, kgClient: AxiosInstance): Promise<string[]> {
    const relationshipIds: string[] = [];
    
    // Create relationship with reporter
    if (issue.fields.reporter) {
      const reporterId = await this.ensureUserEntity(issue.fields.reporter, config, kgClient);
      const response = await kgClient.post('/relationships', {
        fromEntityId: entityId,
        toEntityId: reporterId,
        relationshipType: 'REPORTED_BY',
        metadata: { role: 'reporter' },
        tenantId: config.tenantId,
      });
      relationshipIds.push(response.data.relationshipId);
    }

    // Create relationship with assignee
    if (issue.fields.assignee) {
      const assigneeId = await this.ensureUserEntity(issue.fields.assignee, config, kgClient);
      const response = await kgClient.post('/relationships', {
        fromEntityId: entityId,
        toEntityId: assigneeId,
        relationshipType: 'ASSIGNED_TO',
        metadata: { role: 'assignee' },
        tenantId: config.tenantId,
      });
      relationshipIds.push(response.data.relationshipId);
    }

    return relationshipIds;
  }

  // Placeholder deletion methods
  private async processPageDeletion(event: WebhookEvent, config: SyncConfig, kgClient: AxiosInstance): Promise<EntityCreationResult> {
    // Implementation for page deletion
    return { entityId: '', success: true };
  }

  private async processIssueDeletion(event: WebhookEvent, config: SyncConfig, kgClient: AxiosInstance): Promise<EntityCreationResult> {
    // Implementation for issue deletion
    return { entityId: '', success: true };
  }

  private async processCommentEvent(event: WebhookEvent, config: SyncConfig, kgClient: AxiosInstance): Promise<EntityCreationResult> {
    // Implementation for comment processing
    return { entityId: '', success: true };
  }

  private async processCommentDeletion(event: WebhookEvent, config: SyncConfig, kgClient: AxiosInstance): Promise<EntityCreationResult> {
    // Implementation for comment deletion
    return { entityId: '', success: true };
  }
}
