-- CreateTable
CREATE TABLE "knowledge_entities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "properties" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "tenantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "knowledge_relationships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceEntityId" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "confidence" TEXT NOT NULL,
    "properties" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "tenantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "knowledge_relationships_sourceEntityId_fkey" FOREIGN KEY ("sourceEntityId") REFERENCES "knowledge_entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "knowledge_relationships_targetEntityId_fkey" FOREIGN KEY ("targetEntityId") REFERENCES "knowledge_entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "graph_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "tenantId" TEXT,
    "analytics" JSONB,
    "metadata" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "graph_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "entityId" TEXT,
    "relationshipId" TEXT,
    "changes" JSONB,
    "metadata" JSONB,
    "tenantId" TEXT
);

-- CreateTable
CREATE TABLE "graph_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "configKey" TEXT NOT NULL,
    "configValue" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "api_usage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apiKeyId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "requestSize" INTEGER,
    "responseSize" INTEGER,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "_SnapshotEntities" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_SnapshotEntities_A_fkey" FOREIGN KEY ("A") REFERENCES "graph_snapshots" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_SnapshotEntities_B_fkey" FOREIGN KEY ("B") REFERENCES "knowledge_entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "knowledge_entities_type_idx" ON "knowledge_entities"("type");

-- CreateIndex
CREATE INDEX "knowledge_entities_name_idx" ON "knowledge_entities"("name");

-- CreateIndex
CREATE INDEX "knowledge_entities_tenantId_idx" ON "knowledge_entities"("tenantId");

-- CreateIndex
CREATE INDEX "knowledge_entities_createdAt_idx" ON "knowledge_entities"("createdAt");

-- CreateIndex
CREATE INDEX "knowledge_relationships_sourceEntityId_idx" ON "knowledge_relationships"("sourceEntityId");

-- CreateIndex
CREATE INDEX "knowledge_relationships_targetEntityId_idx" ON "knowledge_relationships"("targetEntityId");

-- CreateIndex
CREATE INDEX "knowledge_relationships_type_idx" ON "knowledge_relationships"("type");

-- CreateIndex
CREATE INDEX "knowledge_relationships_weight_idx" ON "knowledge_relationships"("weight");

-- CreateIndex
CREATE INDEX "knowledge_relationships_tenantId_idx" ON "knowledge_relationships"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_relationships_sourceEntityId_targetEntityId_type_key" ON "knowledge_relationships"("sourceEntityId", "targetEntityId", "type");

-- CreateIndex
CREATE INDEX "graph_snapshots_createdAt_idx" ON "graph_snapshots"("createdAt");

-- CreateIndex
CREATE INDEX "graph_snapshots_createdBy_idx" ON "graph_snapshots"("createdBy");

-- CreateIndex
CREATE INDEX "graph_snapshots_tenantId_idx" ON "graph_snapshots"("tenantId");

-- CreateIndex
CREATE INDEX "graph_events_timestamp_idx" ON "graph_events"("timestamp");

-- CreateIndex
CREATE INDEX "graph_events_type_idx" ON "graph_events"("type");

-- CreateIndex
CREATE INDEX "graph_events_actorId_idx" ON "graph_events"("actorId");

-- CreateIndex
CREATE INDEX "graph_events_entityId_idx" ON "graph_events"("entityId");

-- CreateIndex
CREATE INDEX "graph_events_tenantId_idx" ON "graph_events"("tenantId");

-- CreateIndex
CREATE INDEX "graph_configs_tenantId_idx" ON "graph_configs"("tenantId");

-- CreateIndex
CREATE INDEX "graph_configs_configKey_idx" ON "graph_configs"("configKey");

-- CreateIndex
CREATE UNIQUE INDEX "graph_configs_tenantId_configKey_key" ON "graph_configs"("tenantId", "configKey");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_tenantId_idx" ON "api_keys"("tenantId");

-- CreateIndex
CREATE INDEX "api_keys_isActive_idx" ON "api_keys"("isActive");

-- CreateIndex
CREATE INDEX "api_usage_apiKeyId_idx" ON "api_usage"("apiKeyId");

-- CreateIndex
CREATE INDEX "api_usage_timestamp_idx" ON "api_usage"("timestamp");

-- CreateIndex
CREATE INDEX "api_usage_endpoint_idx" ON "api_usage"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "_SnapshotEntities_AB_unique" ON "_SnapshotEntities"("A", "B");

-- CreateIndex
CREATE INDEX "_SnapshotEntities_B_index" ON "_SnapshotEntities"("B");
