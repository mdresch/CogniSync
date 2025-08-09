/*
  Warnings:

  - You are about to drop the column `originalQuery` on the `query_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `queryMetadata` on the `query_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `responseTime` on the `query_sessions` table. All the data in the column will be lost.
  - Added the required column `query` to the `query_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "type" TEXT NOT NULL DEFAULT 'document',
    "url" TEXT,
    "hasEmbeddings" BOOLEAN NOT NULL DEFAULT false,
    "lastProcessed" DATETIME,
    "metadata" TEXT,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "embedding" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "query" TEXT,
    "documentId" TEXT,
    "processingTime" INTEGER,
    "errorCode" TEXT,
    "metadata" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_llm_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "model" TEXT NOT NULL DEFAULT 'gpt-3.5-turbo',
    "apiKey" TEXT NOT NULL,
    "endpoint" TEXT,
    "maxTokens" INTEGER DEFAULT 2000,
    "temperature" REAL DEFAULT 0.7,
    "systemPrompt" TEXT,
    "embeddingProvider" TEXT NOT NULL DEFAULT 'openai',
    "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-ada-002',
    "embeddingApiKey" TEXT,
    "vectorProvider" TEXT NOT NULL DEFAULT 'pinecone',
    "vectorConfig" TEXT NOT NULL,
    "chunkSize" INTEGER NOT NULL DEFAULT 1000,
    "chunkOverlap" INTEGER NOT NULL DEFAULT 200,
    "maxResults" INTEGER NOT NULL DEFAULT 20,
    "similarityThreshold" REAL NOT NULL DEFAULT 0.7,
    "rerankingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTested" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_llm_configurations" ("apiKey", "chunkOverlap", "chunkSize", "createdAt", "embeddingApiKey", "embeddingModel", "embeddingProvider", "endpoint", "id", "isActive", "lastTested", "maxResults", "maxTokens", "model", "name", "provider", "rerankingEnabled", "similarityThreshold", "temperature", "tenantId", "updatedAt", "vectorConfig", "vectorProvider") SELECT "apiKey", "chunkOverlap", "chunkSize", "createdAt", "embeddingApiKey", "embeddingModel", "embeddingProvider", "endpoint", "id", "isActive", "lastTested", "maxResults", "maxTokens", "model", "name", "provider", "rerankingEnabled", "similarityThreshold", "temperature", "tenantId", "updatedAt", "vectorConfig", "vectorProvider" FROM "llm_configurations";
DROP TABLE "llm_configurations";
ALTER TABLE "new_llm_configurations" RENAME TO "llm_configurations";
CREATE INDEX "llm_configurations_tenantId_idx" ON "llm_configurations"("tenantId");
CREATE INDEX "llm_configurations_provider_idx" ON "llm_configurations"("provider");
CREATE INDEX "llm_configurations_isActive_idx" ON "llm_configurations"("isActive");
CREATE UNIQUE INDEX "llm_configurations_tenantId_name_key" ON "llm_configurations"("tenantId", "name");
CREATE TABLE "new_query_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "sessionId" TEXT,
    "userId" TEXT,
    "query" TEXT NOT NULL DEFAULT '',
    "response" TEXT,
    "processedQuery" TEXT,
    "intent" TEXT,
    "complexity" TEXT NOT NULL DEFAULT 'simple',
    "context" TEXT,
    "metadata" TEXT,
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "processingTime" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "parentQueryId" TEXT,
    CONSTRAINT "query_sessions_parentQueryId_fkey" FOREIGN KEY ("parentQueryId") REFERENCES "query_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Migrate existing data with proper column mapping
INSERT INTO "new_query_sessions" (
  "id", "tenantId", "sessionId", "userId", "query", "processedQuery", 
  "intent", "complexity", "context", "metadata", "resultsCount", 
  "processingTime", "status", "errorMessage", "createdAt", "updatedAt", "parentQueryId"
) 
SELECT 
  "id", "tenantId", "sessionId", "userId", 
  COALESCE("originalQuery", 'migrated query') as "query", -- Map originalQuery to query
  "processedQuery", "intent", "complexity", "context", 
  "queryMetadata" as "metadata", -- Map queryMetadata to metadata
  "resultsCount",
  CAST("responseTime" as INTEGER) as "processingTime", -- Convert responseTime to processingTime
  "status", "errorMessage", "createdAt", "updatedAt", "parentQueryId"
FROM "query_sessions";

DROP TABLE "query_sessions";
ALTER TABLE "new_query_sessions" RENAME TO "query_sessions";

-- Remove default value after migration
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "final_query_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "sessionId" TEXT,
    "userId" TEXT,
    "query" TEXT NOT NULL,
    "response" TEXT,
    "processedQuery" TEXT,
    "intent" TEXT,
    "complexity" TEXT NOT NULL DEFAULT 'simple',
    "context" TEXT,
    "metadata" TEXT,
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "processingTime" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "parentQueryId" TEXT,
    CONSTRAINT "query_sessions_parentQueryId_fkey" FOREIGN KEY ("parentQueryId") REFERENCES "query_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "final_query_sessions" SELECT * FROM "query_sessions";
DROP TABLE "query_sessions";
ALTER TABLE "final_query_sessions" RENAME TO "query_sessions";

CREATE INDEX "query_sessions_tenantId_idx" ON "query_sessions"("tenantId");
CREATE INDEX "query_sessions_sessionId_idx" ON "query_sessions"("sessionId");
CREATE INDEX "query_sessions_userId_idx" ON "query_sessions"("userId");
CREATE INDEX "query_sessions_intent_idx" ON "query_sessions"("intent");
CREATE INDEX "query_sessions_createdAt_idx" ON "query_sessions"("createdAt");
CREATE INDEX "query_sessions_status_idx" ON "query_sessions"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "type" TEXT NOT NULL DEFAULT 'document',
    "url" TEXT,
    "hasEmbeddings" BOOLEAN NOT NULL DEFAULT false,
    "lastProcessed" DATETIME,
    "metadata" JSONB,
    "tags" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "embedding" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "query" TEXT,
    "documentId" TEXT,
    "processingTime" INTEGER,
    "errorCode" TEXT,
    "metadata" JSONB,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_llm_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "model" TEXT NOT NULL DEFAULT 'gpt-3.5-turbo',
    "apiKey" TEXT NOT NULL,
    "endpoint" TEXT,
    "maxTokens" INTEGER DEFAULT 2000,
    "temperature" REAL DEFAULT 0.7,
    "systemPrompt" TEXT,
    "embeddingProvider" TEXT NOT NULL DEFAULT 'openai',
    "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-ada-002',
    "embeddingApiKey" TEXT,
    "vectorProvider" TEXT NOT NULL DEFAULT 'pinecone',
    "vectorConfig" JSONB NOT NULL,
    "chunkSize" INTEGER NOT NULL DEFAULT 1000,
    "chunkOverlap" INTEGER NOT NULL DEFAULT 200,
    "maxResults" INTEGER NOT NULL DEFAULT 20,
    "similarityThreshold" REAL NOT NULL DEFAULT 0.7,
    "rerankingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTested" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_llm_configurations" ("apiKey", "chunkOverlap", "chunkSize", "createdAt", "embeddingApiKey", "embeddingModel", "embeddingProvider", "endpoint", "id", "isActive", "lastTested", "maxResults", "maxTokens", "model", "name", "provider", "rerankingEnabled", "similarityThreshold", "temperature", "tenantId", "updatedAt", "vectorConfig", "vectorProvider") SELECT "apiKey", "chunkOverlap", "chunkSize", "createdAt", "embeddingApiKey", "embeddingModel", "embeddingProvider", "endpoint", "id", "isActive", "lastTested", "maxResults", "maxTokens", "model", "name", "provider", "rerankingEnabled", "similarityThreshold", "temperature", "tenantId", "updatedAt", "vectorConfig", "vectorProvider" FROM "llm_configurations";
DROP TABLE "llm_configurations";
ALTER TABLE "new_llm_configurations" RENAME TO "llm_configurations";
CREATE INDEX "llm_configurations_tenantId_idx" ON "llm_configurations"("tenantId");
CREATE INDEX "llm_configurations_provider_idx" ON "llm_configurations"("provider");
CREATE INDEX "llm_configurations_isActive_idx" ON "llm_configurations"("isActive");
CREATE UNIQUE INDEX "llm_configurations_tenantId_name_key" ON "llm_configurations"("tenantId", "name");
CREATE TABLE "new_query_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "sessionId" TEXT,
    "userId" TEXT,
    "query" TEXT NOT NULL,
    "response" TEXT,
    "processedQuery" TEXT,
    "intent" TEXT,
    "complexity" TEXT NOT NULL DEFAULT 'simple',
    "context" JSONB,
    "metadata" JSONB,
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "processingTime" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "parentQueryId" TEXT,
    CONSTRAINT "query_sessions_parentQueryId_fkey" FOREIGN KEY ("parentQueryId") REFERENCES "query_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_query_sessions" ("complexity", "context", "createdAt", "errorMessage", "id", "intent", "parentQueryId", "processedQuery", "resultsCount", "sessionId", "status", "tenantId", "updatedAt", "userId") SELECT "complexity", "context", "createdAt", "errorMessage", "id", "intent", "parentQueryId", "processedQuery", "resultsCount", "sessionId", "status", "tenantId", "updatedAt", "userId" FROM "query_sessions";
DROP TABLE "query_sessions";
ALTER TABLE "new_query_sessions" RENAME TO "query_sessions";
CREATE INDEX "query_sessions_tenantId_idx" ON "query_sessions"("tenantId");
CREATE INDEX "query_sessions_sessionId_idx" ON "query_sessions"("sessionId");
CREATE INDEX "query_sessions_userId_idx" ON "query_sessions"("userId");
CREATE INDEX "query_sessions_intent_idx" ON "query_sessions"("intent");
CREATE INDEX "query_sessions_createdAt_idx" ON "query_sessions"("createdAt");
CREATE INDEX "query_sessions_status_idx" ON "query_sessions"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "documents_tenantId_idx" ON "documents"("tenantId");

-- CreateIndex
CREATE INDEX "documents_source_idx" ON "documents"("source");

-- CreateIndex
CREATE INDEX "documents_hasEmbeddings_idx" ON "documents"("hasEmbeddings");

-- CreateIndex
CREATE INDEX "document_chunks_tenantId_idx" ON "document_chunks"("tenantId");

-- CreateIndex
CREATE INDEX "document_chunks_documentId_idx" ON "document_chunks"("documentId");

-- CreateIndex
CREATE INDEX "document_chunks_chunkIndex_idx" ON "document_chunks"("chunkIndex");

-- CreateIndex
CREATE INDEX "analytics_events_tenantId_idx" ON "analytics_events"("tenantId");

-- CreateIndex
CREATE INDEX "analytics_events_sessionId_idx" ON "analytics_events"("sessionId");

-- CreateIndex
CREATE INDEX "analytics_events_eventType_idx" ON "analytics_events"("eventType");

-- CreateIndex
CREATE INDEX "analytics_events_timestamp_idx" ON "analytics_events"("timestamp");
