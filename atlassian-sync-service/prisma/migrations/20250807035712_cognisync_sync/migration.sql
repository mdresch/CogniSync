-- CreateTable
CREATE TABLE "sync_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "entityId" TEXT,
    "externalId" TEXT,
    "changes" JSONB,
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "configId" TEXT,
    "kgEntityId" TEXT,
    "kgRelationshipIds" JSONB,
    CONSTRAINT "sync_events_configId_fkey" FOREIGN KEY ("configId") REFERENCES "sync_configurations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sync_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "webhookSecret" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "kgServiceUrl" TEXT NOT NULL DEFAULT 'http://localhost:3001/api/v1',
    "kgApiKey" TEXT NOT NULL,
    "mappingRules" JSONB NOT NULL,
    "filters" JSONB,
    "batchSize" INTEGER NOT NULL DEFAULT 10,
    "retryLimit" INTEGER NOT NULL DEFAULT 3,
    "retryDelay" INTEGER NOT NULL DEFAULT 30000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_mappings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "atlassianAccountId" TEXT NOT NULL,
    "atlassianEmail" TEXT,
    "displayName" TEXT NOT NULL,
    "kgEntityId" TEXT,
    "profile" JSONB,
    "lastSyncAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "entity_mappings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalType" TEXT NOT NULL,
    "kgEntityId" TEXT NOT NULL,
    "lastSyncAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncVersion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "externalData" JSONB,
    "mappingRules" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "source" TEXT NOT NULL,
    "webhookId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'received',
    "errorMessage" TEXT,
    "syncEventId" TEXT,
    CONSTRAINT "webhook_deliveries_syncEventId_fkey" FOREIGN KEY ("syncEventId") REFERENCES "sync_events" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "sync_events_timestamp_idx" ON "sync_events"("timestamp");

-- CreateIndex
CREATE INDEX "sync_events_type_idx" ON "sync_events"("type");

-- CreateIndex
CREATE INDEX "sync_events_source_idx" ON "sync_events"("source");

-- CreateIndex
CREATE INDEX "sync_events_actorId_idx" ON "sync_events"("actorId");

-- CreateIndex
CREATE INDEX "sync_events_entityId_idx" ON "sync_events"("entityId");

-- CreateIndex
CREATE INDEX "sync_events_externalId_idx" ON "sync_events"("externalId");

-- CreateIndex
CREATE INDEX "sync_events_processingStatus_idx" ON "sync_events"("processingStatus");

-- CreateIndex
CREATE INDEX "sync_events_tenantId_idx" ON "sync_events"("tenantId");

-- CreateIndex
CREATE INDEX "sync_events_configId_idx" ON "sync_events"("configId");

-- CreateIndex
CREATE INDEX "sync_configurations_tenantId_idx" ON "sync_configurations"("tenantId");

-- CreateIndex
CREATE INDEX "sync_configurations_source_idx" ON "sync_configurations"("source");

-- CreateIndex
CREATE INDEX "sync_configurations_enabled_idx" ON "sync_configurations"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "sync_configurations_tenantId_source_name_key" ON "sync_configurations"("tenantId", "source", "name");

-- CreateIndex
CREATE INDEX "user_mappings_tenantId_idx" ON "user_mappings"("tenantId");

-- CreateIndex
CREATE INDEX "user_mappings_atlassianAccountId_idx" ON "user_mappings"("atlassianAccountId");

-- CreateIndex
CREATE INDEX "user_mappings_kgEntityId_idx" ON "user_mappings"("kgEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "user_mappings_tenantId_atlassianAccountId_key" ON "user_mappings"("tenantId", "atlassianAccountId");

-- CreateIndex
CREATE INDEX "entity_mappings_tenantId_idx" ON "entity_mappings"("tenantId");

-- CreateIndex
CREATE INDEX "entity_mappings_source_idx" ON "entity_mappings"("source");

-- CreateIndex
CREATE INDEX "entity_mappings_kgEntityId_idx" ON "entity_mappings"("kgEntityId");

-- CreateIndex
CREATE INDEX "entity_mappings_externalId_idx" ON "entity_mappings"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "entity_mappings_tenantId_source_externalId_key" ON "entity_mappings"("tenantId", "source", "externalId");

-- CreateIndex
CREATE INDEX "webhook_deliveries_tenantId_idx" ON "webhook_deliveries"("tenantId");

-- CreateIndex
CREATE INDEX "webhook_deliveries_source_idx" ON "webhook_deliveries"("source");

-- CreateIndex
CREATE INDEX "webhook_deliveries_eventType_idx" ON "webhook_deliveries"("eventType");

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_idx" ON "webhook_deliveries"("status");

-- CreateIndex
CREATE INDEX "webhook_deliveries_receivedAt_idx" ON "webhook_deliveries"("receivedAt");
