/**
 * Atlassian Sync Service Database Seed
 * Creates sample sync configurations and test data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Atlassian Sync Service database...');

  // Clean existing data
  await prisma.webhookDelivery.deleteMany();
  await prisma.syncEvent.deleteMany();
  await prisma.entityMapping.deleteMany();
  await prisma.userMapping.deleteMany();
  await prisma.syncConfiguration.deleteMany();

  console.log('📝 Creating sample sync configurations...');

  // Create sample Confluence sync configuration
  const confluenceConfig = await prisma.syncConfiguration.create({
    data: {
      name: 'Default Confluence Sync',
      tenantId: 'default',
      source: 'confluence',
      enabled: true,
      webhookSecret: 'confluence-webhook-secret-123',
      webhookUrl: 'http://localhost:3002/webhooks/',
      kgServiceUrl: 'http://localhost:3001/api/v1',
      kgApiKey: 'dev-api-key-confluence',
      mappingRules: {
        entityTypes: {
          page: 'Document',
          blogpost: 'Article',
          comment: 'Comment',
          attachment: 'File'
        },
        relationshipTypes: {
          authored_by: 'AUTHORED_BY',
          commented_on: 'COMMENTED_ON',
          attached_to: 'ATTACHED_TO',
          belongs_to_space: 'BELONGS_TO'
        },
        fieldMappings: {
          title: 'name',
          body: 'content',
          createdDate: 'created_at',
          lastModified: 'updated_at'
        }
      },
      filters: {
        includeSpaces: ['DEV', 'DOCS', 'PROJ'],
        excludeLabels: ['draft', 'archive'],
        includeContentTypes: ['page', 'blogpost']
      },
      batchSize: 10,
      retryLimit: 3,
      retryDelay: 30000,
    },
  });

  console.log(`✅ Created Confluence config: ${confluenceConfig.id}`);

  // Create sample Jira sync configuration
  const jiraConfig = await prisma.syncConfiguration.create({
    data: {
      name: 'Default Jira Sync',
      tenantId: 'default',
      source: 'jira',
      enabled: true,
      webhookSecret: 'jira-webhook-secret-456',
      webhookUrl: 'http://localhost:3002/webhooks/',
      kgServiceUrl: 'http://localhost:3001/api/v1',
      kgApiKey: 'dev-api-key-jira',
      mappingRules: {
        entityTypes: {
          story: 'Requirement',
          task: 'Task',
          bug: 'Issue',
          epic: 'Epic',
          'sub-task': 'Task'
        },
        relationshipTypes: {
          reported_by: 'REPORTED_BY',
          assigned_to: 'ASSIGNED_TO',
          depends_on: 'DEPENDS_ON',
          blocks: 'BLOCKS',
          relates_to: 'RELATES_TO'
        },
        fieldMappings: {
          summary: 'name',
          description: 'content',
          created: 'created_at',
          updated: 'updated_at',
          status: 'status',
          priority: 'priority'
        }
      },
      filters: {
        includeProjects: ['DEV', 'PROD', 'SUPP'],
        includeIssueTypes: ['Story', 'Task', 'Bug', 'Epic'],
        excludeStatuses: ['Closed', 'Cancelled']
      },
      batchSize: 15,
      retryLimit: 3,
      retryDelay: 45000,
    },
  });

  console.log(`✅ Created Jira config: ${jiraConfig.id}`);

  console.log('👥 Creating sample user mappings...');

  // Create sample user mappings
  const sampleUsers = [
    {
      tenantId: 'default',
      atlassianAccountId: 'acc-123456789',
      atlassianEmail: 'john.doe@example.com',
      displayName: 'John Doe',
      kgEntityId: 'kg-user-001',
      profile: {
        userType: 'atlassian',
        timezone: 'America/New_York',
        locale: 'en_US'
      }
    },
    {
      tenantId: 'default',
      atlassianAccountId: 'acc-987654321',
      atlassianEmail: 'jane.smith@example.com',
      displayName: 'Jane Smith',
      kgEntityId: 'kg-user-002',
      profile: {
        userType: 'atlassian',
        timezone: 'Europe/London',
        locale: 'en_GB'
      }
    },
    {
      tenantId: 'default',
      atlassianAccountId: 'acc-456789123',
      atlassianEmail: 'bob.wilson@example.com',
      displayName: 'Bob Wilson',
      kgEntityId: 'kg-user-003',
      profile: {
        userType: 'atlassian',
        timezone: 'Asia/Tokyo',
        locale: 'ja_JP'
      }
    }
  ];

  for (const userData of sampleUsers) {
    const user = await prisma.userMapping.create({ data: userData });
    console.log(`  👤 Created user mapping: ${user.displayName} (${user.atlassianAccountId})`);
  }

  console.log('📄 Creating sample entity mappings...');

  // Create sample entity mappings
  const sampleMappings = [
    {
      tenantId: 'default',
      source: 'confluence',
      externalId: 'conf-page-001',
      externalType: 'page',
      kgEntityId: 'kg-doc-001',
      syncVersion: '12',
      externalData: {
        title: 'API Documentation',
        spaceKey: 'DEV',
        version: 12,
        lastModified: '2024-01-15T10:30:00Z'
      }
    },
    {
      tenantId: 'default',
      source: 'confluence',
      externalId: 'conf-page-002',
      externalType: 'page',
      kgEntityId: 'kg-doc-002',
      syncVersion: '8',
      externalData: {
        title: 'System Architecture',
        spaceKey: 'DOCS',
        version: 8,
        lastModified: '2024-01-10T14:20:00Z'
      }
    },
    {
      tenantId: 'default',
      source: 'jira',
      externalId: 'PROJ-123',
      externalType: 'issue',
      kgEntityId: 'kg-task-001',
      syncVersion: '2024-01-15T16:45:00.000+0000',
      externalData: {
        key: 'PROJ-123',
        summary: 'Implement user authentication',
        issueType: 'Story',
        status: 'In Progress',
        priority: 'High'
      }
    },
    {
      tenantId: 'default',
      source: 'jira',
      externalId: 'PROJ-124',
      externalType: 'issue',
      kgEntityId: 'kg-task-002',
      syncVersion: '2024-01-12T09:15:00.000+0000',
      externalData: {
        key: 'PROJ-124',
        summary: 'Fix login page styling',
        issueType: 'Bug',
        status: 'Done',
        priority: 'Medium'
      }
    }
  ];

  for (const mappingData of sampleMappings) {
    const mapping = await prisma.entityMapping.create({ data: mappingData });
    console.log(`  📄 Created entity mapping: ${mapping.source}:${mapping.externalId} -> ${mapping.kgEntityId}`);
  }

  console.log('📊 Creating sample sync events...');

  // Create sample sync events
  const sampleEvents = [
    {
      type: 'page_created',
      source: 'confluence',
      timestamp: new Date('2024-01-15T10:30:00Z'),
      actorId: 'acc-123456789',
      entityId: 'conf-page-001',
      externalId: 'conf-page-001',
      changes: {
        eventType: 'page_created',
        changeType: 'create',
        fields: ['title', 'content', 'space']
      },
      processingStatus: 'completed',
      kgEntityId: 'kg-doc-001',
      kgRelationshipIds: JSON.stringify(['rel-001', 'rel-002']),
      tenantId: 'default',
      metadata: {
        webhookId: 'wh-001',
        source: 'confluence',
        spaceKey: 'DEV'
      }
    },
    {
      type: 'issue_updated',
      source: 'jira',
      timestamp: new Date('2024-01-15T16:45:00Z'),
      actorId: 'acc-987654321',
      entityId: 'PROJ-123',
      externalId: 'PROJ-123',
      changes: {
        eventType: 'issue_updated',
        changeType: 'update',
        fields: ['status', 'assignee']
      },
      processingStatus: 'completed',
      kgEntityId: 'kg-task-001',
      kgRelationshipIds: JSON.stringify(['rel-003']),
      tenantId: 'default',
      metadata: {
        webhookId: 'wh-002',
        source: 'jira',
        projectKey: 'PROJ'
      }
    },
    {
      type: 'page_updated',
      source: 'confluence',
      timestamp: new Date('2024-01-16T09:15:00Z'),
      actorId: 'acc-456789123',
      entityId: 'conf-page-002',
      externalId: 'conf-page-002',
      changes: {
        eventType: 'page_updated',
        changeType: 'update',
        fields: ['content', 'labels']
      },
      processingStatus: 'failed',
      errorMessage: 'Knowledge Graph API returned 500 error',
      retryCount: 2,
      tenantId: 'default',
      metadata: {
        webhookId: 'wh-003',
        source: 'confluence',
        spaceKey: 'DOCS'
      }
    }
  ];

  for (const eventData of sampleEvents) {
    const event = await prisma.syncEvent.create({ data: eventData });
    console.log(`  📊 Created sync event: ${event.type} (${event.processingStatus})`);
  }

  console.log('📥 Creating sample webhook deliveries...');

  // Get the sync events to link webhook deliveries
  const syncEvents = await prisma.syncEvent.findMany();

  const sampleWebhooks = [
    {
      tenantId: 'default',
      source: 'confluence',
      webhookId: 'wh-001',
      eventType: 'page_created',
      payload: {
        eventType: 'page_created',
        page: {
          id: 'conf-page-001',
          title: 'API Documentation',
          space: { key: 'DEV' },
          version: { number: 1 }
        },
        user: {
          accountId: 'acc-123456789',
          displayName: 'John Doe'
        }
      },
      signature: 'sha256=abc123def456',
      receivedAt: new Date('2024-01-15T10:30:00Z'),
      processedAt: new Date('2024-01-15T10:30:05Z'),
      status: 'completed',
      syncEventId: syncEvents.find(e => e.type === 'page_created')?.id
    },
    {
      tenantId: 'default',
      source: 'jira',
      webhookId: 'wh-002',
      eventType: 'issue_updated',
      payload: {
        eventType: 'issue_updated',
        issue: {
          key: 'PROJ-123',
          fields: {
            summary: 'Implement user authentication',
            status: { name: 'In Progress' },
            assignee: {
              accountId: 'acc-987654321',
              displayName: 'Jane Smith'
            }
          }
        },
        user: {
          accountId: 'acc-987654321',
          displayName: 'Jane Smith'
        }
      },
      signature: 'sha256=def456ghi789',
      receivedAt: new Date('2024-01-15T16:45:00Z'),
      processedAt: new Date('2024-01-15T16:45:03Z'),
      status: 'completed',
      syncEventId: syncEvents.find(e => e.type === 'issue_updated')?.id
    },
    {
      tenantId: 'default',
      source: 'confluence',
      webhookId: 'wh-003',
      eventType: 'page_updated',
      payload: {
        eventType: 'page_updated',
        page: {
          id: 'conf-page-002',
          title: 'System Architecture',
          space: { key: 'DOCS' },
          version: { number: 8 }
        },
        user: {
          accountId: 'acc-456789123',
          displayName: 'Bob Wilson'
        }
      },
      signature: 'sha256=ghi789jkl012',
      receivedAt: new Date('2024-01-16T09:15:00Z'),
      processedAt: new Date('2024-01-16T09:15:02Z'),
      status: 'failed',
      errorMessage: 'Downstream service unavailable',
      syncEventId: syncEvents.find(e => e.type === 'page_updated')?.id
    }
  ];

  for (const webhookData of sampleWebhooks) {
    const webhook = await prisma.webhookDelivery.create({ data: webhookData });
    console.log(`  📥 Created webhook delivery: ${webhook.eventType} (${webhook.status})`);
  }

  // Display summary
  console.log('\n📈 Seeding Summary:');
  console.log('==================');
  
  const stats = await Promise.all([
    prisma.syncConfiguration.count(),
    prisma.userMapping.count(),
    prisma.entityMapping.count(),
    prisma.syncEvent.count(),
    prisma.webhookDelivery.count(),
  ]);

  console.log(`✅ Sync Configurations: ${stats[0]}`);
  console.log(`👥 User Mappings: ${stats[1]}`);
  console.log(`📄 Entity Mappings: ${stats[2]}`);
  console.log(`📊 Sync Events: ${stats[3]}`);
  console.log(`📥 Webhook Deliveries: ${stats[4]}`);

  console.log('\n🎯 Test URLs:');
  console.log('=============');
  console.log(`Confluence Webhook: http://localhost:3002/webhooks/${confluenceConfig.id}`);
  console.log(`Jira Webhook: http://localhost:3002/webhooks/${jiraConfig.id}`);
  console.log('Health Check: http://localhost:3002/health');
  console.log('Service Status: http://localhost:3002/api/status');
  console.log('Configurations API: http://localhost:3002/api/configurations');
  console.log('Events API: http://localhost:3002/api/events');

  console.log('\n🚀 Atlassian Sync Service database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
