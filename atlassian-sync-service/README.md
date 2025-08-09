# Atlassian Sync Service

## API Key Authentication

All `/api` and `/webhooks` endpoints require a valid API key in the `Authorization` header:

```
Authorization: Bearer <your-api-key>
```

The list of valid API keys is set via the `VALID_API_KEYS` environment variable (comma-separated).

### Example .env
```
VALID_API_KEYS=2e7f8c1a-4b2e-4c9a-8e1d-7a6b2e9c1f3d,another-key-here
```

## Example Request (using curl)

```
curl -X GET http://localhost:3002/api/status \
  -H "Authorization: Bearer 2e7f8c1a-4b2e-4c9a-8e1d-7a6b2e9c1f3d"
```

## Testing

1. Start the Atlassian Sync Service with the `VALID_API_KEYS` environment variable set.
2. Make a request to any `/api` or `/webhooks` endpoint with a valid API key in the header.
3. You should receive a successful response. If the key is missing or invalid, you will get a 401 or 403 error.
