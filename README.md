---

### Cross-Service Workflow Example

**Use Case:** End-to-end knowledge extraction, enrichment, and semantic search

**Workflow:**
1. **Atlassian Sync Service** receives webhooks from Jira/Confluence and creates or updates entities/relationships in the **Knowledge Graph Service**.
2. **Knowledge Graph Service** stores and manages the structured knowledge, making it available for queries and analytics.
3. **LLM-RAG Service** ingests documents/entities from the Knowledge Graph, generates embeddings, and enables advanced semantic search and Q&A over the enriched knowledge base.
4. Users can now query the system in natural language, leveraging both the structured graph and unstructured document context for intelligent answers.
- For search, either `query` or `vector` must be provided

---

## Example Use Cases and Workflows

### Atlassian Sync Service

**Use Case:** Automatically sync Jira issues and Confluence pages to the knowledge graph.

**Workflow:**
1. Create a sync configuration via `POST /api/configurations` with the required Atlassian and KG details.
2. Atlassian webhooks are configured to call `POST /webhooks/{configId}` on this service.
3. Incoming webhooks are processed, mapped, and relevant entities/relationships are created in the knowledge graph.
4. Monitor sync status and events via `GET /api/events` and retry failed events with `POST /api/events/{id}/retry`.

---

### Knowledge Graph Service

**Use Case:** Manage and query a multi-tenant knowledge graph for documents, people, and relationships.

**Workflow:**
1. Create entities (e.g., documents, people) with `POST /entities`.
2. Link entities using `POST /relationships`.
3. Search for entities with `GET /entities?search=...` and filter by type or metadata.
4. Retrieve relationships and neighborhoods for graph exploration with `GET /entities/{id}/relationships` and `GET /entities/{id}/neighborhood`.
5. Run analytics on the graph with `GET /analytics`.

---

### LLM-RAG Service

**Use Case:** Provide semantic search and natural language Q&A over indexed documents.

**Workflow:**
1. Ingest documents and generate embeddings with `POST /embeddings/documents` or bulk with `POST /embeddings/bulk`.
2. Query the system with `POST /query` for natural language answers, or use `POST /query/search` for semantic search.
3. Analyze queries with `POST /query/analyze` and get suggestions with `POST /query/suggestions`.
4. Track and review analytics with `GET /analytics/overview` and related endpoints.
5. Manage embeddings and documents as needed (update, delete, search similar, etc.).
# CogniSync Platform — Central API Overview

This document provides a central overview and API endpoint specification for all three core services in the CogniSync platform.

---

## 1. Atlassian Sync Service

**Base URL:** `/`

**Endpoints:**
- `GET /health` — Health check
- `GET /api/status` — Service status and statistics
- `POST /webhooks/:configId` — Receive Atlassian webhooks
- `GET /api/configurations` — List sync configurations
- `POST /api/configurations` — Create new sync configuration
- `PUT /api/configurations/:id` — Update sync configuration
- `DELETE /api/configurations/:id` — Delete sync configuration
- `GET /api/events` — List sync events
- `GET /api/events/:id` — Get sync event details
- `POST /api/events/:id/retry` — Retry failed sync event

---

## 2. Knowledge Graph Service

**Base URL:** `/`

**Endpoints:**
- `GET /health` — Health check
- `POST /entities` — Create entity
- `GET /entities/:id` — Get entity by ID
- `PUT /entities/:id` — Update entity
- `DELETE /entities/:id` — Delete entity
- `GET /entities` — Search entities
- `GET /entities/:id/relationships` — Get entity relationships
- `GET /entities/:id/neighborhood` — Get entity neighborhood
- `POST /relationships` — Create relationship
- `DELETE /relationships/:id` — Delete relationship
- `GET /analytics` — Graph analytics
- `POST /entities/bulk` — Bulk create entities
- `POST /relationships/bulk` — Bulk create relationships

---

## 3. LLM-RAG Service

**Base URL:** `/api`

**Query Endpoints:**
- `POST /query` — Process a single query
- `POST /query/search` — Semantic search
- `POST /query/analyze` — Query analysis
- `POST /query/suggestions` — Get search suggestions
- `GET /query/history` — Query history
- `DELETE /query/history/:sessionId` — Clear query history
- `POST /query/batch` — Batch search

**Embedding Endpoints:**
- `POST /embeddings/create` — Create single embedding
- `POST /embeddings/documents` — Create/update document and generate embeddings
- `POST /embeddings/bulk` — Bulk create embeddings
- `GET /embeddings/:id` — Get embedding by ID
- `GET /embeddings` — List embeddings
- `PATCH /embeddings/:id` — Update embedding metadata
- `DELETE /embeddings/:id` — Delete embedding
- `POST /embeddings/bulk-delete` — Bulk delete embeddings
- `POST /embeddings/search` — Search similar embeddings

**Analytics Endpoints:**
- `GET /analytics/overview` — Analytics overview
- `GET /analytics/queries` — Query analytics
- `GET /analytics/performance` — Performance metrics
- `GET /analytics/engagement` — User engagement
- `GET /analytics/export` — Export analytics data
- `GET /analytics/realtime` — Real-time statistics

**Health Endpoints:**
- `GET /health` — Health check
- `GET /health/detailed` — Detailed health check
- `GET /health/ready` — Readiness probe
- `GET /health/live` — Liveness probe

---

For detailed OpenAPI/Swagger specifications, see the respective service documentation or request a generated spec for any service.

---

## Data Models and Validation Rules

### 1. Atlassian Sync Service

**SyncConfiguration**
- `id`: string (UUID)
- `name`: string (required)
- `tenantId`: string (required)
- `source`: string (required, e.g., 'jira', 'confluence')
- `webhookSecret`: string (required)
- `webhookUrl`: string
- `kgServiceUrl`: string
- `kgApiKey`: string (required)
- `mappingRules`: object (required)
- `filters`: object
- `batchSize`: integer (default: 10)
- `retryLimit`: integer (default: 3)
- `retryDelay`: integer (ms, default: 30000)
- `enabled`: boolean

**SyncEvent**
- `id`: string (UUID)
- `type`: string
- `source`: string
- `timestamp`: string (ISO date)
- `actorId`: string
- `entityId`: string
- `externalId`: string
- `processingStatus`: string ('completed', 'failed', 'pending')
- `errorMessage`: string
- `retryCount`: integer
- `tenantId`: string
- `kgEntityId`: string

**Validation Rules:**
- Required: `name`, `tenantId`, `source`, `webhookSecret`, `kgApiKey`, `mappingRules`
- `enabled` must be boolean
- `batchSize`, `retryLimit`, `retryDelay` must be positive integers

---

### 2. Knowledge Graph Service

**Entity**
- `id`: string (UUID)
- `type`: string (required, e.g., 'DOCUMENT', 'PERSON')
- `name`: string (required)
- `metadata`: object (optional, e.g., confidence, importance, tags)
- `tenantId`: string (required)

**Relationship**
- `id`: string (UUID)
- `sourceId`: string (UUID, required)
- `targetId`: string (UUID, required)
- `type`: string (required)
- `metadata`: object (optional)
- `tenantId`: string (required)

**Validation Rules:**
- `id`, `sourceId`, `targetId` must be valid UUIDs
- `type` and `name` are required strings
- `metadata` must be an object if present
- Bulk operations: max 100 entities/relationships per request

---

### 3. LLM-RAG Service

**QueryRequest**
- `query`: string (required, non-empty, max 5000 chars)
- `tenantId`: string (required)
- `sessionId`: string
- `userId`: string
- `context`: object
- `maxResults`: integer (default: 5, max: 20)
- `options`: object (e.g., includeAnalysis, includeSuggestions)

**Document**
- `id`: string (required)
- `text`: string (required, max 50,000 chars)
- `title`: string
- `url`: string
- `source`: string
- `metadata`: object

**Embedding**
- `id`: string
- `documentId`: string
- `vector`: array of numbers
- `metadata`: object
- `createdAt`: string (ISO date)

**Validation Rules:**
- `query` must be a non-empty string, max 5000 chars
- `document.id` and `document.text` are required, text max 50,000 chars
- Bulk embedding: max 100 documents per request
- For search, either `query` or `vector` must be provided
