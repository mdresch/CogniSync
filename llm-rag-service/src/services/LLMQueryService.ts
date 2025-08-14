import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import {
  QueryRequest,
  QueryResponse,
  EnhancedQueryContext,
  ProcessingError,
  ExpandedQuery,
  AdvancedEntity
} from '../types';
import { EmbeddingService } from './EmbeddingService';
import { SemanticSearchService } from './SemanticSearchService';

// Type for direct LLM completion parameters
export interface LLMCompletionParams {
  prompt: string;
  context?: any[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export class LLMQueryService {
  private openai: OpenAI;
  private prisma: PrismaClient;
  private embeddingService: EmbeddingService;
  private searchService: SemanticSearchService;

  constructor() {
    console.log('Initializing LLMQueryService...');
    if (process.env.AI_PROVIDER === 'azure') {
      console.log('AI_PROVIDER=azure');
      console.log('Azure OpenAI config:', {
        apiKey: process.env.AZURE_OPENAI_API_KEY ? '***' : undefined,
        baseURL: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION,
        chatDeployment: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT,
        embeddingDeployment: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT
      });
      this.openai = new OpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        baseURL: process.env.AZURE_OPENAI_ENDPOINT, // endpoint root only
        defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION },
        defaultHeaders: {
          'api-key': process.env.AZURE_OPENAI_API_KEY,
        },
      });
    } else {
      console.log('AI_PROVIDER=openai');
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || '',
      });
    }
    this.prisma = new PrismaClient();
    this.embeddingService = new EmbeddingService();
    this.searchService = new SemanticSearchService();
  }

  /**
   * Direct LLM completion (used only by /api/llm/completion endpoint)
   */
  public async llmCompletion(params: LLMCompletionParams): Promise<{ model: string; prompt: string; completion: string; usage?: any }> {
    const { prompt, context = [], model, temperature = 0.7, max_tokens = 1000 } = params;
    const modelName = model || (process.env.AI_PROVIDER === 'azure' ? process.env.AZURE_OPENAI_CHAT_DEPLOYMENT! : 'gpt-4');
    const response = await this.openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: 'You are an AI assistant.' },
        ...(Array.isArray(context) ? context : []),
        { role: 'user', content: prompt }
      ],
      temperature,
      max_tokens
    });
    return {
      model: modelName,
      prompt,
  completion: response.choices[0].message.content ?? '',
      usage: response.usage
    };
  }

  // ...existing methods (analyzeQuery, enhanceQueryContext, generateResponse, getQueryHistory, getQueryAnalytics, disconnect)...

  /**
   * Legacy processQuery method for compatibility with /api/query and related endpoints.
   * Throws an error to enforce routing all LLM calls through /api/llm/completion.
   */
  public async processQuery(_request: any): Promise<any> {
    throw new Error('Direct LLM usage is disabled. Use the /api/llm/completion endpoint.');
  }

}
// Type for direct LLM completion parameters
export interface LLMCompletionParams {
  prompt: string;
  context?: any[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

// Duplicate imports removed above. Only one set should exist at the top of the file.

// ...existing code for LLMQueryService class goes here (only one definition, all methods inside)...
