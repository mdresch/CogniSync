# LLM-RAG Service

## Authentication

All API endpoints under `/api` require an API key for authentication.

**How to use:**

1. Obtain a valid API key (see `.env` file, `VALID_API_KEYS`).
2. Include the API key in the `Authorization` header as follows:
   ```
   Authorization: Bearer <your-api-key>
   ```

**Example with curl:**

```
curl -X POST http://localhost:3003/api/query/search \
  -H "Authorization: Bearer rag-dev-key-12345" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the status of project X?"}'
```

If the API key is missing or invalid, the server will respond with 401 or 403 errors.
