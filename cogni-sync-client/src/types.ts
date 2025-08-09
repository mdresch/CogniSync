// Shared types for Cogni-Sync Client Library

/**
 * Configuration options for all service clients.
 */
export interface ClientOptions {
  /**
   * The base URL of the service API (e.g., http://localhost:3001)
   */
  baseUrl: string;
  /**
   * Optional API key to override the default from environment variables.
   */
  apiKey?: string;
}
