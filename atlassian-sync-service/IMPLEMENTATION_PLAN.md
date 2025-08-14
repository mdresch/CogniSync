# Atlassian Integration: Implementation Plan

**Objective:** To securely connect this service to the Atlassian Cloud, handle live webhooks, and validate the end-to-end data flow for the entire platform.

This plan is divided into three phases. Each phase must be completed and validated before proceeding to the next.

---

## Phase 1: Implement Webhook Security

**Goal:** Harden the `POST /webhooks/:configId` endpoint to ensure it only accepts legitimate, secure requests from Atlassian. This is a critical security requirement.

### **Task 1.1: Modify the Webhook Endpoint Logic**

1.  **File to Modify:** `atlassian-sync-service/src/server.ts`
2.  **Logic to Implement:**
    *   Inside the `app.post('/webhooks/:configId', ...)` handler, before any other logic, you must retrieve the signature from the request header. The standard Atlassian signature header is `x-atlassian-webhook-signature`.
    *   Fetch the corresponding `SyncConfiguration` from the database using the `configId` from the URL.
    *   Retrieve the `webhookSecret` from that configuration record.

### **Task 1.2: Implement Signature Validation**

1.  **File to Modify:** Create a new utility file, e.g., `atlassian-sync-service/src/utils/security.ts`.
2.  **Logic to Implement:**
    *   Create a function `validateSignature(secret, requestBody, signature)`.
    *   This function must use the Node.js `crypto` module to compute an HMAC-SHA256 hash of the raw `requestBody`. The key for the HMAC function is the `secret` from your database.
    *   Compare your computed hash (in hexadecimal format) with the `signature` provided in the request header.
    *   The function should return `true` if they match, and `false` otherwise.
    *   **Crucially, this comparison must be done using a timing-safe method** to prevent timing attacks (e.g., `crypto.timingSafeEqual`).

### **Task 1.3: Enforce Security in the Endpoint**

1.  **File to Modify:** `atlassian-sync-service/src/server.ts`
2.  **Logic to Implement:**
    *   Call your new `validateSignature` function.
    *   **If validation fails:** Immediately stop processing and return a `401 Unauthorized` HTTP status code. Log the failure.
    *   **If validation succeeds:** Proceed with the existing logic to enqueue the event for processing.

**Validation:** After this phase, any `curl` request sent without a valid signature must be rejected.

---

## Phase 2: Set Up Live Development Environment

**Goal:** Create a secure tunnel to allow Atlassian's cloud servers to send webhooks to your local development machine.

### **Task 2.1: Install and Run `ngrok`**

1.  **Action:** Install `ngrok` (if not already installed).
2.  **Action:** Run the following command in a new, dedicated terminal:
    ```bash
    ngrok http 3002
    ```
3.  **Action:** Copy the public HTTPS "Forwarding" URL provided by `ngrok`. It will look like `https://<random-string>.ngrok.io`.

### **Task 2.2: Configure the Atlassian Webhook**

1.  **Action:** In your Jira or Confluence Cloud instance, navigate to `Settings > Webhooks`.
2.  **Action:** Create a new webhook.
    *   **URL:** Paste your `ngrok` forwarding URL, followed by the path to your endpoint.
        *   Example: `https://<random-string>.ngrok.io/webhooks/your-config-id`
    *   **Secret:** Enter the **exact same secret** that is stored in the `webhookSecret` field of the corresponding `SyncConfiguration` record in your database.
    *   **Events:** Configure the webhook to trigger for "Issue > created".

**Validation:** The webhook configuration page in Atlassian should show a successful "ping" to your `ngrok` URL, which should be visible in your `ngrok` terminal.

---

## Phase 3: Execute and Validate End-to-End Live Test

**Goal:** To perform the first live test of the entire platform, triggered by a real user action in Jira.

### **Task 3.1: Start the Platform**

1.  **Action:** In a single VS Code window, open three named terminals.
2.  **Action:** Start each of the three services in its respective terminal:
    *   `atlassian-sync-service`
    *   `knowledge-graph-server`
    *   `llm-rag-service`

### **Task 3.2: Trigger the Event**

1.  **Action:** Go to your Jira Cloud instance.
2.  **Action:** Create a new Jira issue in the project you configured for the webhook.

### **Task 3.3: Observe and Validate the Autonomous Cascade**

1.  **Observe the `ngrok` terminal:** You should see a `202 Accepted` response for the `POST` request to your webhook URL.
2.  **Observe the `atlassian-sync-service` terminal:**
    *   It should log a successful signature validation.
    *   It should then log that it has successfully published `CREATE_ENTITY` and `LINK_ENTITIES` events to the message bus.
3.  **Observe the `knowledge-graph-server` terminal:** It should log that it received the events and successfully wrote the new data to Neo4j.
4.  **Observe the `llm-rag-service` terminal:** It should log that it received the `CREATE_ENTITY` event and successfully indexed the new document in Pinecone.
5.  **Final Proof:** Use the `wscat` client to query the `llm-rag-service` about the new Jira issue you just created. You must receive a correct, cited answer.

---

This implementation plan provides a clear, sequential path to move from a validated internal system to a fully integrated, production-ready platform.
