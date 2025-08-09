# Authentication

The client library uses API keys for authentication with each service. Set the following environment variables in `.env`:

```
ATLASSIAN_SYNC_API_KEY=as-dev-key-12345
KNOWLEDGE_GRAPH_API_KEY=kg-dev-key-12345
LLM_RAG_API_KEY=rag-dev-key-12345
```

**Usage Example:**

```
npx ts-node examples/api-key-auth-usage.ts
```

This will run the example script, which demonstrates authenticated requests to all services. Ensure the services are running and the API keys match those in each service's `.env` file.
# Cogni-Sync Client Library

Node.js client for integrating with the Cogni-Sync platform APIs (Atlassian Sync, Knowledge Graph, LLM-RAG).

## Features
- Easy API integration for all core services
- TypeScript support
- Built-in authentication handling
- Example usage and integration tests

## Installation
```
npm install cogni-sync-client
```

## Usage
See example usage in the `examples/` directory (to be added).

## Development
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Format: `npm run format`
