# Atlassian Sync Service


## Overview

The Atlassian Sync Service is a resilient, autonomous event ingestion and processing pipeline for Atlassian webhooks. It features:

- **API Key Authentication** for all endpoints
- **Asynchronous event ingestion** with durable queueing
- **Autonomous background worker** for self-healing event processing
- **DLQ (Dead Letter Queue)** and retry logic for robust error handling
- **Metrics and logging** for full observability

## Architecture & Workflow

1. **Webhook/API Request**: Incoming requests are authenticated via API key (`Authorization: Bearer <your-api-key>`).
2. **Event Ingestion**: Events are stored in the database with `PENDING` status and immediately acknowledged (`202 Accepted`).
3. **Autonomous Worker**: A background worker periodically leases and processes pending events, updating their status (`PROCESSING`, `COMPLETED`, `FAILED`, `RETRYING`, `DEAD_LETTER`).
4. **DLQ & Retries**: Failed events are retried up to the configured limit, then moved to the DLQ for inspection.
5. **Metrics**: Key metrics are emitted for every stage (received, succeeded, failed, DLQ).

## Setup

1. **Install dependencies**
  ```sh
  pnpm install
  ```
2. **Configure environment**
  - Set `VALID_API_KEYS` in your `.env` file:
    ```
    VALID_API_KEYS=AS-SYNC-KEY-1234,another-key-here
    ```
  - Ensure your database is migrated and seeded with a default tenant and configuration.
3. **Start the service**
  ```sh
  pnpm dev
  ```

## Example Webhook Request (Windows CMD)

```
curl --location --request POST "http://localhost:3002/webhooks/<configId>" ^
--header "Content-Type: application/json" ^
--header "Authorization: Bearer AS-SYNC-KEY-1234" ^
--data-raw "{\"timestamp\":1675888478000,\"webhookEvent\":\"jira:issue_created\",\"issue\":{\"id\":\"10024\",\"self\":\"http://localhost:8080/rest/api/2/issue/10024\",\"key\":\"KAN-25\",\"fields\":{\"summary\":\"This is a test with the correct auth header\",\"issuetype\":{\"name\":\"Bug\"},\"project\":{\"key\":\"KAN\",\"name\":\"Kanban Project\"},\"status\":{\"name\":\"Backlog\"}}},\"user\":{\"accountId\":\"aaid:12345-67890-fedcba\",\"displayName\":\"Auth User\"}}"
```

## Metrics

- `events_received_total`: Incremented when an event is received
- `events_succeeded_total`: Incremented when an event is processed successfully
- `events_failed_total`: Incremented on processing failure
- `events_dlq_total`: Incremented when an event is moved to DLQ

## Testing

1. Start the service with a valid API key and configuration.
2. POST a webhook event as shown above.
3. Check logs for authentication, event ingestion, worker processing, and metrics.

## Observability

All key actions and errors are logged. Metrics are emitted for monitoring and alerting.
