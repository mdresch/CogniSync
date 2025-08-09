-- CreateTable
CREATE TABLE "query_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "sessionId" TEXT,
    "userId" TEXT,
    "originalQuery" TEXT NOT NULL,
    "processedQuery" TEXT,
    "intent" TEXT,
    "complexity" TEXT NOT NULL DEFAULT 'simple',
    "context" JSONB,
    "queryMetadata" JSONB,
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "responseTime" REAL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "parentQueryId" TEXT,
    CONSTRAINT "query_sessions_parentQueryId_fkey" FOREIGN KEY ("parentQueryId") REFERENCES "query_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "query_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "relevanceScore" REAL NOT NULL DEFAULT 0.0,
    "semanticScore" REAL,
    "rankPosition" INTEGER NOT NULL,
    "metadata" JSONB,
    "lastModified" DATETIME,
    "contentType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "query_results_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "query_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "document_embeddings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-ada-002',
    "embeddingDimensions" INTEGER NOT NULL DEFAULT 1536,
    "metadata" JSONB,
    "tags" JSONB,
    "contentType" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastEmbedded" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastModified" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "semantic_indexes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "indexName" TEXT NOT NULL,
    "indexType" TEXT NOT NULL DEFAULT 'pinecone',
    "dimensions" INTEGER NOT NULL DEFAULT 1536,
    "metric" TEXT NOT NULL DEFAULT 'cosine',
    "totalVectors" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSync" DATETIME,
    "config" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "query_analytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalQueries" INTEGER NOT NULL DEFAULT 0,
    "successfulQueries" INTEGER NOT NULL DEFAULT 0,
    "failedQueries" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" REAL,
    "minResponseTime" REAL,
    "maxResponseTime" REAL,
    "businessQueries" INTEGER NOT NULL DEFAULT 0,
    "technicalQueries" INTEGER NOT NULL DEFAULT 0,
    "projectQueries" INTEGER NOT NULL DEFAULT 0,
    "requirementsQueries" INTEGER NOT NULL DEFAULT 0,
    "statusQueries" INTEGER NOT NULL DEFAULT 0,
    "confluenceResults" INTEGER NOT NULL DEFAULT 0,
    "jiraResults" INTEGER NOT NULL DEFAULT 0,
    "kgResults" INTEGER NOT NULL DEFAULT 0,
    "externalResults" INTEGER NOT NULL DEFAULT 0,
    "avgRelevanceScore" REAL,
    "avgSemanticScore" REAL,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
    "repeatUsers" INTEGER NOT NULL DEFAULT 0,
    "peakHour" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "llm_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "model" TEXT NOT NULL DEFAULT 'gpt-3.5-turbo',
    "apiKey" TEXT NOT NULL,
    "endpoint" TEXT,
    "embeddingProvider" TEXT NOT NULL DEFAULT 'openai',
    "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-ada-002',
    "embeddingApiKey" TEXT,
    "vectorProvider" TEXT NOT NULL DEFAULT 'pinecone',
    "vectorConfig" JSONB NOT NULL,
    "maxTokens" INTEGER NOT NULL DEFAULT 4000,
    "temperature" REAL NOT NULL DEFAULT 0.7,
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

-- CreateIndex
CREATE INDEX "query_sessions_tenantId_idx" ON "query_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "query_sessions_sessionId_idx" ON "query_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "query_sessions_userId_idx" ON "query_sessions"("userId");

-- CreateIndex
CREATE INDEX "query_sessions_intent_idx" ON "query_sessions"("intent");

-- CreateIndex
CREATE INDEX "query_sessions_createdAt_idx" ON "query_sessions"("createdAt");

-- CreateIndex
CREATE INDEX "query_sessions_status_idx" ON "query_sessions"("status");

-- CreateIndex
CREATE INDEX "query_results_sessionId_idx" ON "query_results"("sessionId");

-- CreateIndex
CREATE INDEX "query_results_source_idx" ON "query_results"("source");

-- CreateIndex
CREATE INDEX "query_results_relevanceScore_idx" ON "query_results"("relevanceScore");

-- CreateIndex
CREATE INDEX "query_results_rankPosition_idx" ON "query_results"("rankPosition");

-- CreateIndex
CREATE INDEX "document_embeddings_tenantId_idx" ON "document_embeddings"("tenantId");

-- CreateIndex
CREATE INDEX "document_embeddings_sourceType_idx" ON "document_embeddings"("sourceType");

-- CreateIndex
CREATE INDEX "document_embeddings_sourceId_idx" ON "document_embeddings"("sourceId");

-- CreateIndex
CREATE INDEX "document_embeddings_contentHash_idx" ON "document_embeddings"("contentHash");

-- CreateIndex
CREATE INDEX "document_embeddings_isActive_idx" ON "document_embeddings"("isActive");

-- CreateIndex
CREATE INDEX "document_embeddings_lastEmbedded_idx" ON "document_embeddings"("lastEmbedded");

-- CreateIndex
CREATE UNIQUE INDEX "document_embeddings_tenantId_sourceType_sourceId_key" ON "document_embeddings"("tenantId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "semantic_indexes_tenantId_idx" ON "semantic_indexes"("tenantId");

-- CreateIndex
CREATE INDEX "semantic_indexes_indexType_idx" ON "semantic_indexes"("indexType");

-- CreateIndex
CREATE INDEX "semantic_indexes_isActive_idx" ON "semantic_indexes"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "semantic_indexes_tenantId_indexName_key" ON "semantic_indexes"("tenantId", "indexName");

-- CreateIndex
CREATE INDEX "query_analytics_tenantId_idx" ON "query_analytics"("tenantId");

-- CreateIndex
CREATE INDEX "query_analytics_date_idx" ON "query_analytics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "query_analytics_tenantId_date_key" ON "query_analytics"("tenantId", "date");

-- CreateIndex
CREATE INDEX "llm_configurations_tenantId_idx" ON "llm_configurations"("tenantId");

-- CreateIndex
CREATE INDEX "llm_configurations_provider_idx" ON "llm_configurations"("provider");

-- CreateIndex
CREATE INDEX "llm_configurations_isActive_idx" ON "llm_configurations"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "llm_configurations_tenantId_name_key" ON "llm_configurations"("tenantId", "name");
