import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Ensure the tenant exists
  await prisma.tenant.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', name: 'Default Tenant' }
  });

  // Create the configuration
  const config = await prisma.syncConfiguration.create({
    data: {
      tenantId: 'default',
      name: 'Default Jira Config',
      source: 'jira',
      webhookSecret: 'a-sample-secret',
      kgApiKey: 'a-sample-kg-key',
      mappingRules: {},
      enabled: true,
      kgServiceUrl: 'http://localhost:3001/api/v1',
      batchSize: 10,
      retryLimit: 3,
      retryDelay: 30000,
    }
  });
  console.log(config);
  await prisma.$disconnect();
}

main();