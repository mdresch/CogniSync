
import axios, { AxiosInstance } from 'axios';
import { ClientOptions } from '../types';
import { getApiKey } from '../auth';

/**
 * Client for interacting with the LLM-RAG Service API.
 * Handles authentication and provides methods for API integration.
 */
export class LLMRagClient {
  private axios: AxiosInstance;

  /**
   * Create a new LLMRagClient instance.
   * @param options - Client configuration options (baseUrl, apiKey)
   */
  constructor(private options: ClientOptions) {
    const apiKey = getApiKey('llmRag', options.apiKey);
    this.axios = axios.create({
      baseURL: options.baseUrl,
      headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
    });
  }

  /**
   * Query the LLM-RAG service with a natural language query.
   * @param query - The query string
   * @returns The LLM response data
   */
  async queryLLM(query: string) {
  const res = await this.axios.post('/api/llm/query', { query });
    return res.data;
  }

  /**
   * Get analytics overview
   */
  async getAnalyticsOverview() {
  const res = await this.axios.get('/api/analytics/overview');
    return res.data;
  }

  /**
   * Get analytics queries
   */
  async getAnalyticsQueries() {
  const res = await this.axios.get('/api/analytics/queries');
    return res.data;
  }

  /**
   * Get analytics performance
   */
  async getAnalyticsPerformance() {
  const res = await this.axios.get('/api/analytics/performance');
    return res.data;
  }

  /**
   * Get analytics engagement
   */
  async getAnalyticsEngagement() {
  const res = await this.axios.get('/api/analytics/engagement');
    return res.data;
  }

  /**
   * Get analytics export
   */
  async getAnalyticsExport() {
  const res = await this.axios.get('/api/analytics/export');
    return res.data;
  }

  /**
   * Get analytics realtime
   */
  async getAnalyticsRealtime() {
  const res = await this.axios.get('/api/analytics/realtime');
    return res.data;
  }

  /**
   * Get analytics metrics
   */
  async getAnalyticsMetrics() {
  const res = await this.axios.get('/api/analytics/metrics');
    return res.data;
  }

  /**
   * Get analytics usage
   */
  async getAnalyticsUsage() {
  const res = await this.axios.get('/api/analytics/usage');
    return res.data;
  }

  /**
   * Post analytics event
   */
  async postAnalyticsEvent(data: any) {
  const res = await this.axios.post('/api/analytics/events', data);
    return res.data;
  }

  /**
   * Get analytics popular queries
   */
  async getAnalyticsPopularQueries() {
  const res = await this.axios.get('/api/analytics/popular-queries');
    return res.data;
  }

  /**
   * Query endpoint (POST /query/)
   */
  async query(query: string) {
  const res = await this.axios.post('/api/query/', { query });
    return res.data;
  }

  /**
   * Semantic search (POST /query/search)
   */
  async semanticSearch(data: any) {
  const res = await this.axios.post('/api/query/search', data);
    return res.data;
  }
}
