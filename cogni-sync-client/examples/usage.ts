// Example usage of Cogni-Sync Client Library
import { AtlassianSyncClient, KnowledgeGraphClient, LLMRagClient } from '../src';

const atlassian = new AtlassianSyncClient({ baseUrl: 'http://localhost:3001', apiKey: 'YOUR_API_KEY' });
const kg = new KnowledgeGraphClient({ baseUrl: 'http://localhost:3002', apiKey: 'YOUR_API_KEY' });
const llm = new LLMRagClient({ baseUrl: 'http://localhost:3003', apiKey: 'YOUR_API_KEY' });

async function main() {
  // Atlassian Sync example
  const syncConfig = await atlassian.getSyncConfiguration('config-id');
  console.log('Sync Config:', syncConfig);

  // Knowledge Graph example
  const entity = await kg.getEntity('entity-id');
  console.log('Entity:', entity);

  // LLM-RAG example
  const llmResult = await llm.queryLLM('What is the status of project X?');
  console.log('LLM Result:', llmResult);
}

main().catch(console.error);
