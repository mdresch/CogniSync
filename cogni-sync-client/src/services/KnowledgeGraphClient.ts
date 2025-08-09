
import axios, { AxiosInstance } from 'axios';
import { ClientOptions } from '../types';
import { getApiKey } from '../auth';

/**
 * Client for interacting with the Knowledge Graph Service API.
 * Handles authentication and provides methods for API integration.
 */
export class KnowledgeGraphClient {
  private axios: AxiosInstance;

  /**
   * Create a new KnowledgeGraphClient instance.
   * @param options - Client configuration options (baseUrl, apiKey)
   */
  constructor(private options: ClientOptions) {
    const apiKey = getApiKey('knowledgeGraph', options.apiKey);
    this.axios = axios.create({
      baseURL: options.baseUrl,
      headers: apiKey
        ? {
            'Authorization': `Bearer ${apiKey}`,
            'x-api-key': apiKey
          }
        : {},
    });
  }

  /**
   * Fetch an entity by ID from the knowledge graph.
   * @param id - The entity ID
   * @returns The entity data
   */
  async getEntity(id: string) {
  const res = await this.axios.get(`/api/v1/entities/${id}`);
    return res.data;
  }

  /**
   * Health check endpoint
   */
  async health() {
  const res = await this.axios.get('/api/v1/health');
    return res.data;
  }

  /**
   * List all entities
   */
  async listEntities(params?: any) {
  const res = await this.axios.get('/api/v1/entities', { params });
    return res.data;
  }

  /**
   * Create a new entity
   */
  async createEntity(data: any) {
  const res = await this.axios.post('/api/v1/entities', data);
    return res.data;
  }

  /**
   * Update an entity
   */
  async updateEntity(id: string, data: any) {
  const res = await this.axios.put(`/api/v1/entities/${id}`, data);
    return res.data;
  }

  /**
   * Delete an entity
   */
  async deleteEntity(id: string) {
  const res = await this.axios.delete(`/api/v1/entities/${id}`);
    return res.data;
  }

  /**
   * Get relationships for an entity
   */
  async getEntityRelationships(id: string) {
  const res = await this.axios.get(`/api/v1/entities/${id}/relationships`);
    return res.data;
  }

  /**
   * Get neighborhood for an entity
   */
  async getEntityNeighborhood(id: string) {
  const res = await this.axios.get(`/api/v1/entities/${id}/neighborhood`);
    return res.data;
  }

  /**
   * Bulk create entities
   */
  async bulkCreateEntities(data: any) {
  const res = await this.axios.post('/api/v1/entities/bulk', data);
    return res.data;
  }

  /**
   * Create a relationship
   */
  async createRelationship(data: any) {
  const res = await this.axios.post('/api/v1/relationships', data);
    return res.data;
  }

  /**
   * Delete a relationship
   */
  async deleteRelationship(id: string) {
  const res = await this.axios.delete(`/api/v1/relationships/${id}`);
    return res.data;
  }

  /**
   * Bulk create relationships
   */
  async bulkCreateRelationships(data: any) {
  const res = await this.axios.post('/api/v1/relationships/bulk', data);
    return res.data;
  }

  /**
   * Get analytics
   */
  async getAnalytics(params?: any) {
  const res = await this.axios.get('/api/v1/analytics', { params });
    return res.data;
  }
}
