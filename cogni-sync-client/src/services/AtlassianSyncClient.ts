
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ClientOptions } from '../types';
import { getApiKey } from '../auth';
import { 
  ServiceCommunicator, 
  HttpRequestConfig, 
  TraceContext, 
  TenantContext,
  HealthStatus,
  DEFAULT_RETRY_POLICY,
  generateRequestId,
  createTraceHeaders,
  calculateRetryDelay,
  shouldRetry
} from '../../../shared-types/communication-protocols';

/**
 * Enhanced client for interacting with the Atlassian Sync Service API.
 * Implements standardized communication protocols with retry logic,
 * tracing, and comprehensive error handling.
 */
export class AtlassianSyncClient implements ServiceCommunicator {
  private axios: AxiosInstance;
  private tenantContext?: TenantContext;
  private traceContext?: TraceContext;

  /**
   * Create a new AtlassianSyncClient instance.
   * @param options - Client configuration options (baseUrl, apiKey)
   */
  constructor(private options: ClientOptions) {
    const apiKey = getApiKey('atlassian', options.apiKey);
    this.axios = axios.create({
      baseURL: options.baseUrl,
      headers: {
        'x-api-key': apiKey || options.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    // Add request interceptor for tracing
    this.axios.interceptors.request.use((config) => {
      if (this.traceContext) {
        Object.assign(config.headers, createTraceHeaders(this.traceContext));
      }
      config.headers['X-Request-Id'] = generateRequestId();
      return config;
    });
  }

  // ============================================================================
  // ServiceCommunicator Interface Implementation
  // ============================================================================

  /**
   * Generic GET request with retry logic
   */
  async get<T>(endpoint: string, config?: Partial<HttpRequestConfig>): Promise<T> {
    return this.makeRequest<T>('GET', endpoint, undefined, config);
  }

  /**
   * Generic POST request with retry logic
   */
  async post<T>(endpoint: string, data?: any, config?: Partial<HttpRequestConfig>): Promise<T> {
    return this.makeRequest<T>('POST', endpoint, data, config);
  }

  /**
   * Generic PUT request with retry logic
   */
  async put<T>(endpoint: string, data?: any, config?: Partial<HttpRequestConfig>): Promise<T> {
    return this.makeRequest<T>('PUT', endpoint, data, config);
  }

  /**
   * Generic DELETE request with retry logic
   */
  async delete<T>(endpoint: string, config?: Partial<HttpRequestConfig>): Promise<T> {
    return this.makeRequest<T>('DELETE', endpoint, undefined, config);
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<HealthStatus> {
    const response = await this.get<any>('/health');
    return {
      status: response.status === 'healthy' ? 'healthy' : 'unhealthy',
      timestamp: response.timestamp,
      service: response.service,
      version: response.version
    };
  }

  /**
   * Set API key for authentication
   */
  setApiKey(apiKey: string): void {
    this.axios.defaults.headers['x-api-key'] = apiKey;
  }

  /**
   * Set tenant context for requests
   */
  setTenantContext(context: TenantContext): void {
    this.tenantContext = context;
  }

  /**
   * Set trace context for distributed tracing
   */
  setTraceContext(context: TraceContext): void {
    this.traceContext = context;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Make HTTP request with retry logic and error handling
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: any,
    config?: Partial<HttpRequestConfig>
  ): Promise<T> {
    const retryPolicy = config?.retryPolicy || DEFAULT_RETRY_POLICY;
    let lastError: Error;

    for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
      try {
        const axiosConfig: AxiosRequestConfig = {
          method: method.toLowerCase() as any,
          url: endpoint,
          data,
          timeout: config?.timeout || 30000,
          ...config
        };

        const response = await this.axios.request(axiosConfig);
        return response.data;
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on client errors (4xx) except specific cases
        if (error.response?.status && !shouldRetry(error.response.status, retryPolicy)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === retryPolicy.maxAttempts) {
          throw error;
        }

        // Calculate delay and wait before retry
        const delay = calculateRetryDelay(attempt, retryPolicy);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  // ============================================================================
  // Atlassian Sync Service Specific Methods
  // ============================================================================

  /**
   * Fetch a sync configuration by ID.
   * @param id - The configuration ID
   * @returns The sync configuration data
   */
  async getSyncConfiguration(id: string) {
    return this.get(`/api/configurations/${id}`);
  }

  /**
   * Service status endpoint with detailed information
   */
  async getStatus() {
    return this.get('/api/status');
  }

  /**
   * List all sync configurations
   */
  async listSyncConfigurations(params?: any) {
    return this.get('/api/configurations', { url: '/api/configurations', method: 'GET', body: params });
  }

  /**
   * Create a new sync configuration
   */
  async createSyncConfiguration(data: any) {
    return this.post('/api/configurations', data);
  }

  /**
   * Update a sync configuration
   */
  async updateSyncConfiguration(id: string, data: any) {
    return this.put(`/api/configurations/${id}`, data);
  }

  /**
   * Delete a sync configuration
   */
  async deleteSyncConfiguration(id: string) {
    return this.delete(`/api/configurations/${id}`);
  }

  /**
   * List sync events with filtering and pagination
   */
  async listSyncEvents(params?: {
    tenantId?: string;
    source?: string;
    type?: string;
    status?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const endpoint = `/api/events${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.get(endpoint);
  }

  /**
   * Get a specific sync event with full details
   */
  async getSyncEvent(id: string) {
    return this.get(`/api/events/${id}`);
  }

  /**
   * Retry a failed sync event
   */
  async retrySyncEvent(id: string) {
    return this.post(`/api/events/${id}/retry`);
  }

  /**
   * Send webhook data to a specific configuration
   */
  async postWebhook(configId: string, body: any, signature?: string) {
    const headers: Record<string, string> = {};
    if (signature) {
      headers['X-Hub-Signature-256'] = signature;
    }
    
    return this.post(`/webhooks/${configId}`, body, { headers });
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(`sha256=${expectedSignature}`)
    );
  }
}
