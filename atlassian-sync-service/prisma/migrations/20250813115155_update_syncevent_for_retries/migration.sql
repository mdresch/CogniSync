-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_sync_configurations" (
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sync_configurations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_sync_configurations" ("batchSize", "createdAt", "enabled", "filters", "id", "kgApiKey", "kgServiceUrl", "mappingRules", "name", "retryDelay", "retryLimit", "source", "tenantId", "updatedAt", "webhookSecret", "webhookUrl") SELECT "batchSize", "createdAt", "enabled", "filters", "id", "kgApiKey", "kgServiceUrl", "mappingRules", "name", "retryDelay", "retryLimit", "source", "tenantId", "updatedAt", "webhookSecret", "webhookUrl" FROM "sync_configurations";
DROP TABLE "sync_configurations";
ALTER TABLE "new_sync_configurations" RENAME TO "sync_configurations";
CREATE INDEX "sync_configurations_tenantId_idx" ON "sync_configurations"("tenantId");
CREATE INDEX "sync_configurations_source_idx" ON "sync_configurations"("source");
CREATE INDEX "sync_configurations_enabled_idx" ON "sync_configurations"("enabled");
CREATE UNIQUE INDEX "sync_configurations_tenantId_source_name_key" ON "sync_configurations"("tenantId", "source", "name");
CREATE TABLE "new_sync_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "entityId" TEXT,
    "externalId" TEXT,
    "changes" JSONB,
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "dlqPayload" JSONB,
    "dlqError" TEXT,
    "dlqFailedAt" DATETIME,
    "dlqAttempts" INTEGER,
    "metadata" JSONB,
    "tenantId" TEXT NOT NULL,
    "configId" TEXT,
    "kgEntityId" TEXT,
    "kgRelationshipIds" JSONB,
    CONSTRAINT "sync_events_configId_fkey" FOREIGN KEY ("configId") REFERENCES "sync_configurations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sync_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_sync_events" ("actorId", "changes", "configId", "entityId", "errorMessage", "externalId", "id", "kgEntityId", "kgRelationshipIds", "metadata", "processingStatus", "retryCount", "source", "tenantId", "timestamp", "type") SELECT "actorId", "changes", "configId", "entityId", "errorMessage", "externalId", "id", "kgEntityId", "kgRelationshipIds", "metadata", "processingStatus", "retryCount", "source", "tenantId", "timestamp", "type" FROM "sync_events";
DROP TABLE "sync_events";
ALTER TABLE "new_sync_events" RENAME TO "sync_events";
CREATE INDEX "sync_events_timestamp_idx" ON "sync_events"("timestamp");
CREATE INDEX "sync_events_type_idx" ON "sync_events"("type");
CREATE INDEX "sync_events_source_idx" ON "sync_events"("source");
CREATE INDEX "sync_events_actorId_idx" ON "sync_events"("actorId");
CREATE INDEX "sync_events_entityId_idx" ON "sync_events"("entityId");
CREATE INDEX "sync_events_externalId_idx" ON "sync_events"("externalId");
CREATE INDEX "sync_events_processingStatus_idx" ON "sync_events"("processingStatus");
CREATE INDEX "sync_events_tenantId_idx" ON "sync_events"("tenantId");
CREATE INDEX "sync_events_configId_idx" ON "sync_events"("configId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_name_key" ON "Tenant"("name");
