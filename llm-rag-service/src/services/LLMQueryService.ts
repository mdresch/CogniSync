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
import { AIProviderService } from './AIProviderService';

// Type for direct LLM completion parameters
export interface LLMCompletionParams {
  prompt: string;
  context?: any[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export class LLMQueryService {
  private aiProviderService: AIProviderService;
  private prisma: PrismaClient;
  private embeddingService: EmbeddingService;
  private searchService: SemanticSearchService;

  constructor() {
    console.log('Initializing LLMQueryService with AI Provider Service...');
    this.aiProviderService = new AIProviderService();
    this.prisma = new PrismaClient();
    this.embeddingService = new EmbeddingService();
    this.searchService = new SemanticSearchService();
  }

  /**
   * Direct LLM completion (used only by /api/llm/completion endpoint)
   */
  public async llmCompletion(params: LLMCompletionParams): Promise<{ model: string; prompt: string; completion: string; usage?: any; provider?: string; responseTime?: number; retryCount?: number }> {
    const { prompt, context = [], model, temperature = 0.7, max_tokens = 1000 } = params;
    
    const messages = [
      { role: 'system', content: 'You are an AI assistant.' },
      ...(Array.isArray(context) ? context : []),
      { role: 'user', content: prompt }
    ];

    const response = await this.aiProviderService.createChatCompletion({
      messages,
      model,
      temperature,
      maxTokens: max_tokens
    });

    if (!response.success) {
      throw new Error(`LLM completion failed: ${response.error}`);
    }

    return {
      model: model || 'auto-selected',
      prompt,
      completion: response.data.choices[0].message.content ?? '',
      usage: response.data.usage,
      provider: response.provider,
      responseTime: response.responseTime,
      retryCount: response.retryCount
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
