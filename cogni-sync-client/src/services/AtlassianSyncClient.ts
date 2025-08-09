
import axios, { AxiosInstance } from 'axios';
import { ClientOptions } from '../types';
import { getApiKey } from '../auth';

/**
 * Client for interacting with the Atlassian Sync Service API.
 * Handles authentication and provides methods for API integration.
 */
export class AtlassianSyncClient {
  private axios: AxiosInstance;

  /**
   * Create a new AtlassianSyncClient instance.
   * @param options - Client configuration options (baseUrl, apiKey)
   */
  constructor(private options: ClientOptions) {
    const apiKey = getApiKey('atlassian', options.apiKey);
    this.axios = axios.create({
      baseURL: options.baseUrl,
      headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
    });
  }

  /**
   * Fetch a sync configuration by ID.
   * @param id - The configuration ID
   * @returns The sync configuration data
   */
  async getSyncConfiguration(id: string) {
    const res = await this.axios.get(`/sync/configurations/${id}`);
    return res.data;
  }

  /**
   * Health check endpoint
   */
  async health() {
    // Atlassian Sync Service does not expose /health, use /api/status
    const res = await this.axios.get('/api/status');
    return res.data;
  }

  /**
   * Service status endpoint
   */
  async getStatus() {
    const res = await this.axios.get('/api/status');
    return res.data;
  }

  /**
   * List all sync configurations
   */
  async listSyncConfigurations(params?: any) {
    const res = await this.axios.get('/api/configurations', { params });
    return res.data;
  }

  /**
   * Create a new sync configuration
   */
  async createSyncConfiguration(data: any) {
    const res = await this.axios.post('/api/configurations', data);
    return res.data;
  }

  /**
   * Update a sync configuration
   */
  async updateSyncConfiguration(id: string, data: any) {
    const res = await this.axios.put(`/api/configurations/${id}`, data);
    return res.data;
  }

  /**
   * Delete a sync configuration
   */
  async deleteSyncConfiguration(id: string) {
    const res = await this.axios.delete(`/api/configurations/${id}`);
    return res.data;
  }

  /**
   * List sync events
   */
  async listSyncEvents(params?: any) {
    const res = await this.axios.get('/api/events', { params });
    return res.data;
  }

  /**
   * Get a specific sync event
   */
  async getSyncEvent(id: string) {
    const res = await this.axios.get(`/api/events/${id}`);
    return res.data;
  }

  /**
   * Retry a failed sync event
   */
  async retrySyncEvent(id: string) {
    const res = await this.axios.post(`/api/events/${id}/retry`);
    return res.data;
  }

  /**
   * Generic webhook endpoint
   */
  async postWebhook(configId: string, body: any, headers?: any) {
    const res = await this.axios.post(`/webhooks/${configId}`, body, { headers });
    return res.data;
  }
}
