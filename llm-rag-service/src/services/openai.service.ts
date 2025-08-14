// ...existing code...
import axios from 'axios';
import { logger } from '../utils/logger';

// Logic for interacting with Azure OpenAI
export class OpenAIService {
  private endpoint: string;
  private embeddingDeployment: string;
  private chatDeployment: string;
  private apiVersion: string;
  private apiKey: string;

  constructor() {
    this.endpoint = process.env.AZURE_OPENAI_ENDPOINT!;
    this.embeddingDeployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!;
    this.chatDeployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT!;
    this.apiVersion = process.env.AZURE_OPENAI_API_VERSION!;
    this.apiKey = process.env.AZURE_OPENAI_API_KEY!;
    logger.info('OpenAIService (Azure) initialized.');
  }

  async createEmbedding(text: string): Promise<number[]> {
    logger.info({ text: text.substring(0, 50) + '...' }, 'Creating embedding...');
    const url = `${this.endpoint}/openai/deployments/${this.embeddingDeployment}/embeddings?api-version=${this.apiVersion}`;
    const headers = {
      'api-key': this.apiKey,
      'Content-Type': 'application/json',
    };
    const body = { input: text };
    const response = await axios.post(url, body, { headers });
    // Azure returns: { data: [{ embedding: [...] }] }
    return response.data.data[0].embedding;
  }

  /**
   * Generates a streaming chat completion from the LLM using Azure OpenAI REST API.
   * @param systemPrompt The instructions for the AI.
   * @param userPrompt The user's query combined with retrieved context.
   * @returns An async generator yielding response chunks.
   */
  async *getStreamingCompletion(systemPrompt: string, userPrompt: string) {
    logger.info('Sending prompt to LLM for generation...');
    const url = `${this.endpoint}/openai/deployments/${this.chatDeployment}/chat/completions?api-version=${this.apiVersion}`;
    const headers = {
      'api-key': this.apiKey,
      'Content-Type': 'application/json',
    };
    const body = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: true,
    };
    const response = await axios.post(url, body, { headers, responseType: 'stream' });
    const stream = response.data;
    let buffer = '';
    for await (const chunk of stream) {
      buffer += chunk.toString();
      let lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim().startsWith('data:')) {
          const jsonStr = line.trim().slice(5).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const data = JSON.parse(jsonStr);
            yield data;
          } catch (err) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
  }
}
