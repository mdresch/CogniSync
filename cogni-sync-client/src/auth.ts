// Auth module for Cogni-Sync Client Library
import dotenv from 'dotenv';
dotenv.config();

/**
 * Retrieve the API key for a given service.
 * Looks for an override first, then falls back to environment variables.
 * @param service - The service name ('atlassian', 'knowledgeGraph', 'llmRag')
 * @param overrideKey - Optional override API key
 * @returns The API key string, or undefined if not found
 */
export function getApiKey(service: 'atlassian' | 'knowledgeGraph' | 'llmRag', overrideKey?: string): string | undefined {
  if (overrideKey) return overrideKey;
  switch (service) {
    case 'atlassian':
      return process.env.ATLASSIAN_SYNC_API_KEY;
    case 'knowledgeGraph':
      return process.env.KNOWLEDGE_GRAPH_API_KEY;
    case 'llmRag':
      return process.env.LLM_RAG_API_KEY;
    default:
      return undefined;
  }
}
