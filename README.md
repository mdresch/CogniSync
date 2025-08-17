
# CogniSync Platform - System Architecture and Autonomous Operation Blueprint

This document outlines the architectural principles and phased approach used to design, deploy, and maintain the autonomous systems within this monorepo. Our goal is to build resilient, scalable, and self-healing services that operate with a clearly defined level of autonomy.

## 📋 Architecture Documentation

- **[Modular Architecture Blueprint](MODULAR_ARCHITECTURE_BLUEPRINT.md)** - Comprehensive modular architecture design for scalability, maintainability, and adaptability
- **[Module Interface Specifications](MODULE_INTERFACE_SPECIFICATIONS.md)** - Detailed interface contracts between all modules
- **[Implementation Guide](MODULAR_ARCHITECTURE_IMPLEMENTATION_GUIDE.md)** - Step-by-step guide for implementing the modular architecture
- **[Phase 2 Architecture Blueprint](PHASE-2-ARCHITECTURE-BLUEPRINT.md)** - Interface and protocol specifications
- **[Inter-Service Communication](INTER_SERVICE_COMMUNICATION.md)** - Communication patterns and contracts
- **[Message Queue Architecture](MESSAGE_QUEUE_ARCHITECTURE.md)** - Event-driven messaging specifications

---

## High-Level Service Overviews

### **Atlassian Sync Service — Autonomous Event Ingestion & Processing**

A fully autonomous, resilient event pipeline for Atlassian webhooks. It features API key authentication, asynchronous event ingestion into a durable queue, a background worker for self-healing processing, and built-in retry/DLQ logic for robust error handling.
**See [`atlassian-sync-service/README.md`](atlassian-sync-service/README.md) for full details.**

### **Knowledge Graph Service — Centralized Knowledge Hub**

A high-performance service for storing, managing, and querying connected data. It features a flexible GraphQL API for complex queries, a Neo4j (AuraDB) backend for native graph performance, and an autonomous ingestion worker that processes events from a message bus to keep the graph updated in near real-time.

### **LLM-RAG Service — AI-Powered Insight Engine**

The primary user-facing intelligence layer of the platform. It provides accurate, context-aware, and strictly cited answers to natural language questions. It features a streaming WebSocket API for a real-time user experience, and an advanced RAG pipeline that enriches user queries with structured data from the Knowledge Graph before performing semantic search against a vector database (Pinecone).

---

## The Three-Phase Approach

We followed a structured, three-phase approach to ensure a solid foundation for all systems.

### **Phase 1: Defining the Mission - Objectives & Requirements**

**Goal:** To achieve absolute clarity on what each system must accomplish, its operational boundaries, and its desired level of autonomy.

📋 **[Complete Requirements Document](PHASE-1-REQUIREMENTS.md)** - Detailed functional and non-functional requirements for all services.

| Service / Project | Core Objectives | Key Constraints & Performance Targets | Desired Level of Autonomy |
| :--- | :--- | :--- | :--- |
| **LLM-RAG Service** | 1. Answer natural language questions using information strictly grounded in the Knowledge Graph.<br>2. **Enrich context** by analyzing queries to fetch and use structured metadata (e.g., time, authority, status) from the KG in the final prompt.<br>3. Provide a **cited answer** including the generated text, a list of source documents, and confidence scores. | **Accuracy:** Zero tolerance for uncited/fabricated info. <br>**Freshness:** KG changes reflected in < 15 mins. <br>**Performance:** Time-to-first-token < 1s; p99 latency < 3s. <br>**Concurrency:** Support 100+ concurrent queries. | **Query Understanding:** Autonomously rephrase and decompose complex user queries.<br>**Source Selection:** Autonomously filter data sources in the KG based on query context.<br>**Self-Correction:** Log user feedback (thumbs up/down) for offline analysis and periodic retraining. No initial requirement for online learning. |
| **Knowledge Graph** | Store, manage, and query entities and relationships to enable rich semantic queries and analytics. <br><br> Support basic, traceable relationship inference (e.g., co-authorship). <br><br> **Queries:** Find related entities, traverse paths, search by properties, and retrieve subgraphs. | **Data Scale:** 10M entities & 100M relationships in Year 1. <br><br> **Ingestion Rate:** Handle >= 100 new entities/relationships per second. <br><br> **Query Latency:** p99 latency < 500ms for primary queries. | **Semi-Autonomous:** <br> - Autonomously infer new, flagged relationships from ingested data. <br> - Dynamically accept new entity and relationship types. <br> - Require manual review and approval for major schema changes (e.g., new required fields). |
| **Atlassian Sync** | Asynchronously ingest Atlassian webhook events into a durable queue, process them autonomously to create/update entities in the Knowledge Graph, and handle failures with a resilient retry/DLQ mechanism. | Ingestion latency < 1s. Guarantee no data loss on transient API failures. Respect Atlassian API rate limits. | Fully autonomous event ingestion, processing, and transient failure recovery. Manual intervention is required only for events in the Dead-Letter Queue. |

### **Phase 2: Architecting the System - Blueprint & Principles**

**Goal:** To design a modular, robust, and adaptable architecture based on modern best practices.

| Service / Project | Architectural Patterns & Integration | Perception & Decision-Making | Learning & Adaptation |
| :--- | :--- | :--- | :--- |
| **LLM-RAG Service** | **Architectural Patterns:**<br>- **Pipeline:** RAG pipeline orchestrated by a framework (e.g., LlamaIndex).<br>- **API:** WebSocket/SSE for streaming, cited responses.<br>- **Indexing:** Near real-time via an event-driven worker.<br><br>**Integration:**<br>- Consumes document data via a message bus from the KG service.<br>- Queries the KG's GraphQL API for structured metadata.<br>- Queries a Vector DB (e.g., Pinecone) for semantic search.<br>- Uses a managed LLM service (e.g., Azure OpenAI) for generation. | **Current state:** <br>- **Perception:** User's natural language query.<br>- **Decision:** Uses an orchestration framework to execute a multi-step RAG pipeline:<br>  1. Decompose the query.<br>  2. Fetch structured context from the Knowledge Graph.<br>  3. Retrieve relevant text chunks from the Vector DB.<br>  4. Synthesize context and generate a cited answer using an LLM. | **Planned:**<br>- User feedback (thumbs up/down) is logged for offline analysis.<br>- This data will be used for periodic, manual fine-tuning of the retrieval/generation models to improve accuracy over time. |
| **Knowledge Graph** | **Architectural Patterns:**<br>- **API:** GraphQL for flexible, efficient data querying.<br>- **Ingestion:** Event-driven via a message bus (e.g., Azure Service Bus) with a dedicated ingestion worker performing batch operations.<br><br>**Integration:**<br>- Consumes events from the Atlassian Sync Service via the message bus.<br>- Provides graph data to the LLM-RAG Service via its GraphQL API.<br><br>**Database:**<br>- Neo4j (AuraDB) selected as the native graph database. | **Current state:** <br>- **Perception:** Structured event data from the message bus.<br>- **Decision:** Uses Cypher queries with `UNWIND` and `MERGE` clauses for idempotent, batch creation/updating of entities and relationships. Applies predefined rules for inferring new, flagged relationships. | **Planned:**<br>- Models can be retrained based on feedback on inferred relationships.<br>- The system can adapt to new entity/relationship types in the data stream, with major schema changes requiring manual approval. |
| **Atlassian Sync** | **Current state:** Event-driven architecture using a persistent database queue. API-first for webhook ingestion. Idempotent service logic for KG updates. | **Current state:** Perception = webhook payload. Decision = Rule-based mapping of payload to KG entities and relationships (upsert logic). | **Current state:** Static mapping rules. (No dynamic learning implemented yet). |

### **Phase 3: Resilient Infrastructure & Self-Healing**

**Goal:** To ensure systems can automatically detect, tolerate, and recover from failures without human intervention.

| Service / Project | Health Checks & Monitoring | Redundancy & Failover | Automated Recovery |
| :--- | :--- | :--- | :--- |
| **LLM-RAG Service** | **Current Status:**<br>- Deep `/health` endpoint checks KG API, Vector DB, and LLM service connectivity.<br>- Prometheus metrics for query count, pipeline latency, retrieval score, LLM time-to-first-token, and user feedback. | **Current Status:**<br>- **Dependencies:** High-availability managed services (Pinecone, Azure OpenAI) provide built-in redundancy.<br>- **Service:** Stateless containerized design enables horizontal scaling and instant failover. | **Current Status:**<br>- **Circuit Breaker:** All external dependencies wrapped in circuit breaker logic.<br>- **Graceful Degradation:** If KG API is down, system skips enrichment and notifies user.<br>- **Idempotent Indexing:** RAG Indexing Worker uses upsert for vector DB.<br>- **Connectivity:** Exponential backoff for all external connections. |
| **Knowledge Graph** | **Current Status:**<br>- Deep `/health` endpoint to check connectivity to Neo4j & Service Bus.<br>- Prometheus metrics for batch processing latency, GraphQL query latency, and total entities/relationships created. | **Current Status:**<br>- **Database:** High availability provided by managed AuraDB cluster.<br>- **Message Bus:** Geo-redundancy provided by Azure Service Bus (Standard/Premium).<br>- **Service:** Stateless containerized design enables horizontal scaling and instant replacement. | **Current Status:**<br>- **Ingestion:** Uses the built-in dead-lettering of Azure Service Bus for poison messages.<br>- **Idempotency:** Ingestion worker uses idempotent Cypher queries (`MERGE`) to prevent data duplication.<br>- **Connectivity:** Implements exponential backoff for database and message bus connections. |
| **Atlassian Sync** | **Current Status:** Implemented `/health` endpoint and structured JSON logging. Emits Prometheus-style metrics for events received, succeeded, retried, and DLQ'd. | **Current Status:** Stateless service design allows for horizontal scaling (e.g., via Kubernetes replicas). | **Current Status:** Implemented an autonomous background worker with event leasing. Failed events are automatically retried. A DLQ is implemented by flagging events after a retry limit. Manual retry is supported via an API endpoint. |

---

### Cross-Service Workflow Example

**Use Case:** End-to-end knowledge extraction, enrichment, and semantic search

**Workflow:**
1.  **Atlassian Sync Service** receives webhooks from Jira/Confluence and publishes structured events to a message bus.
2.  The **Knowledge Graph Service** consumes these events, creating and linking entities in its Neo4j database. It then publishes a `DocumentToIndex` event.
3.  The **LLM-RAG Service**'s indexing worker consumes the `DocumentToIndex` event, generates embeddings, and upserts them into a Pinecone vector database.
4.  Users can now query the **LLM-RAG Service** in natural language. The service leverages both the Knowledge Graph and the Pinecone index to provide intelligent, cited, and streaming answers.

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


### LLM-RAG Service

**Use Case:** Provide semantic search and natural language Q&A over indexed documents.

**Workflow:**
1. Ingest documents and generate embeddings with `POST /embeddings/documents` or bulk with `POST /embeddings/bulk`.
2. Query the system with `POST /query` for natural language answers, or use `POST /query/search` for semantic search.
3. Analyze queries with `POST /query/analyze` and get suggestions with `POST /query/suggestions`.
4. Track and review analytics with `GET /analytics/overview` and related endpoints.
5. Manage embeddings and documents as needed (update, delete, search similar, etc.).
# CogniSync Python Client Library

## Installation

## Usage Example

```python
from cogni_sync_client.client import CogniSyncClient
import os

BASE_URL = os.getenv('COGNISYNC_KG_BASE_URL', 'http://localhost:3002')
API_KEY = os.getenv('COGNISYNC_KG_API_KEY', 'YOUR_API_KEY')

client = CogniSyncClient(BASE_URL, API_KEY)
health = client.health()
print('Health:', health)
entities = client.list_entities()
print('Entities:', entities)
```

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
