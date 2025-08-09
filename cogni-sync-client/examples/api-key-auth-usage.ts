// Example: Using API Key Authentication with Cogni-Sync Client Library
import { AtlassianSyncClient, KnowledgeGraphClient, LLMRagClient } from '../src';

// API keys are loaded from .env automatically via dotenv integration
// You can also override by passing apiKey in the options

const atlassian = new AtlassianSyncClient({ baseUrl: 'http://localhost:3001' });
const kg = new KnowledgeGraphClient({ baseUrl: 'http://localhost:3002' });
const llm = new LLMRagClient({ baseUrl: 'http://localhost:3003' });

async function main() {
  // Atlassian Sync example
  try {
    const syncConfig = await atlassian.getSyncConfiguration('config-id');
    console.log('Sync Config:', syncConfig);
  } catch (err) {
    console.error('Atlassian Sync error:', err);
  }

  // Knowledge Graph example
  try {
    const entity = await kg.getEntity('entity-id');
    console.log('Entity:', entity);
  } catch (err) {
    console.error('Knowledge Graph error:', err);
  }

  // LLM-RAG example
  try {
    const llmResult = await llm.queryLLM('What is the status of project X?');
    console.log('LLM Result:', llmResult);
  } catch (err) {
    console.error('LLM-RAG error:', err);
  }
}

main();
