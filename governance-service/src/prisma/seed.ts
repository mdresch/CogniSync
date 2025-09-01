import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Create default tenant
  const defaultTenantId = 'default-tenant-001';

  // Create default roles
  const superAdminRole = await prisma.role.upsert({
  where: { name_tenantId: { name: 'Super Admin', tenantId: defaultTenantId } },
    update: {},
    create: {
      name: 'Super Admin',
      description: 'Full system access',
      permissions: ['*'],
      isSystem: true,
      tenantId: defaultTenantId,
    },
  });

  const adminRole = await prisma.role.upsert({
  where: { name_tenantId: { name: 'Admin', tenantId: defaultTenantId } },
    update: {},
    create: {
      name: 'Admin',
      description: 'Administrative access',
      permissions: [
        'users:read', 'users:write', 'users:delete',
        'roles:read', 'roles:write', 'roles:delete',
        'workflows:read', 'workflows:write', 'workflows:delete',
        'documents:read', 'documents:write', 'documents:delete',
        'dashboards:read', 'dashboards:write',
        'reports:read', 'reports:write',
        'analytics:read', 'analytics:write',
        'notifications:read', 'notifications:write',
        'data:read', 'data:write',
      ],
      isSystem: true,
      tenantId: defaultTenantId,
    },
  });

  const managerRole = await prisma.role.upsert({
  where: { name_tenantId: { name: 'Manager', tenantId: defaultTenantId } },
    update: {},
    create: {
      name: 'Manager',
      description: 'Management access',
      permissions: [
        'users:read',
        'workflows:read', 'workflows:write',
        'documents:read', 'documents:write',
        'dashboards:read',
        'reports:read', 'reports:write',
        'analytics:read',
        'notifications:read',
        'data:read',
      ],
      isSystem: true,
      tenantId: defaultTenantId,
    },
  });

  const userRole = await prisma.role.upsert({
  where: { name_tenantId: { name: 'User', tenantId: defaultTenantId } },
    update: {},
    create: {
      name: 'User',
      description: 'Basic user access',
      permissions: [
        'workflows:read',
        'documents:read',
        'dashboards:read',
        'reports:read',
        'notifications:read',
      ],
      isSystem: true,
      tenantId: defaultTenantId,
    },
  });

  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  const adminUser = await prisma.user.upsert({
  where: { email_tenantId: { email: 'admin@cogni-sync.com', tenantId: defaultTenantId } },
    update: {},
    create: {
      email: 'admin@cogni-sync.com',
      username: 'admin',
      firstName: 'System',
      lastName: 'Administrator',
      password: hashedPassword,
      isActive: true,
      tenantId: defaultTenantId,
    },
  });

  // Assign super admin role to admin user
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
    },
  });

  // Create sample workflow
  const sampleWorkflow = await prisma.workflow.upsert({
  where: { name_tenantId: { name: 'Document Approval Workflow', tenantId: defaultTenantId } },
    update: {},
    create: {
      name: 'Document Approval Workflow',
      description: 'Standard document approval process',
      definition: {
        steps: [
          {
            id: 'review',
            name: 'Document Review',
            type: 'review',
            assignee: adminUser.id,
            config: {
              dueInHours: 24,
              description: 'Review document for accuracy and compliance',
            },
            nextSteps: ['approve'],
          },
          {
            id: 'approve',
            name: 'Document Approval',
            type: 'approval',
            assignee: adminUser.id,
            config: {
              dueInHours: 48,
              description: 'Approve or reject the document',
            },
          },
        ],
        settings: {
          autoStart: false,
          timeout: 72,
          retryAttempts: 3,
        },
      },
      version: 1,
      status: 'ACTIVE',
      isActive: true,
      createdBy: adminUser.id,
      tenantId: defaultTenantId,
    },
  });

  // Create sample notification templates
  await prisma.notificationTemplate.upsert({
  where: { name_tenantId: { name: 'Task Assignment', tenantId: defaultTenantId } },
    update: {},
    create: {
      name: 'Task Assignment',
      type: 'TASK_ASSIGNED',
      subject: 'New Task Assigned: {{title}}',
      template: `
        <h2>New Task Assigned</h2>
        <p>Hello {{userName}},</p>
        <p>You have been assigned a new task: <strong>{{title}}</strong></p>
        <p>{{message}}</p>
        <p>Priority: {{priority}}</p>
        <p>Please log in to the system to view and complete this task.</p>
      `,
      isActive: true,
      tenantId: defaultTenantId,
    },
  });

  await prisma.notificationTemplate.upsert({
  where: { name_tenantId: { name: 'Document Approval', tenantId: defaultTenantId } },
    update: {},
    create: {
      name: 'Document Approval',
      type: 'DOCUMENT_APPROVAL',
      subject: 'Document Approval Required: {{title}}',
      template: `
        <h2>Document Approval Required</h2>
        <p>Hello {{userName}},</p>
        <p>A document requires your approval: <strong>{{title}}</strong></p>
        <p>{{message}}</p>
        <p>Please review and approve or reject the document in the system.</p>
      `,
      isActive: true,
      tenantId: defaultTenantId,
    },
  });

  // Create sample standard reports
  await prisma.report.upsert({
  where: { name_tenantId: { name: 'Workflow Performance Report', tenantId: defaultTenantId } },
    update: {},
    create: {
      name: 'Workflow Performance Report',
      description: 'Analysis of workflow completion times and success rates',
      type: 'STANDARD',
      query: {
        dataSource: 'workflows',
        aggregations: ['completion_time', 'success_rate'],
        groupBy: ['workflow_name'],
      },
      format: 'PDF',
      isActive: true,
      tenantId: defaultTenantId,
    },
  });

  await prisma.report.upsert({
  where: { name_tenantId: { name: 'User Activity Report', tenantId: defaultTenantId } },
    update: {},
    create: {
      name: 'User Activity Report',
      description: 'User login and activity statistics',
      type: 'STANDARD',
      query: {
        dataSource: 'users',
        aggregations: ['login_count', 'task_completion_count'],
        groupBy: ['user_id'],
      },
      format: 'EXCEL',
      isActive: true,
      tenantId: defaultTenantId,
    },
  });

  // Create sample analytics model
  await prisma.analyticsModel.upsert({
  where: { name_tenantId: { name: 'Task Completion Predictor', tenantId: defaultTenantId } },
    update: {},
    create: {
      name: 'Task Completion Predictor',
      description: 'Predicts task completion time based on historical data',
      type: 'REGRESSION',
      config: {
        algorithm: 'linear_regression',
        features: ['task_type', 'assignee_experience', 'task_complexity'],
        target: 'completion_time',
      },
      status: 'TRAINED',
      accuracy: 0.85,
      tenantId: defaultTenantId,
    },
  });

  // Create sample dashboard
  await prisma.dashboard.upsert({
  where: { name_tenantId: { name: 'Executive Dashboard', tenantId: defaultTenantId } },
    update: {},
    create: {
      name: 'Executive Dashboard',
      description: 'High-level overview of governance metrics',
      type: 'EXECUTIVE',
      config: {
        refreshInterval: 300, // 5 minutes
        autoRefresh: true,
      },
      layout: {
        widgets: [
          { id: 'workflow-metrics', type: 'chart', position: { x: 0, y: 0, w: 6, h: 4 } },
          { id: 'user-activity', type: 'metric', position: { x: 6, y: 0, w: 3, h: 2 } },
          { id: 'document-status', type: 'table', position: { x: 0, y: 4, w: 9, h: 4 } },
        ],
      },
      isPublic: false,
      tenantId: defaultTenantId,
    },
  });

  console.log('Database seeding completed successfully!');
  console.log('Default admin user created:');
  console.log('  Email: admin@cogni-sync.com');
  console.log('  Password: admin123');
  console.log('  Tenant ID:', defaultTenantId);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });