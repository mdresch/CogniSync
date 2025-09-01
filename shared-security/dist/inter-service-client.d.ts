/**
 * Secure inter-service communication client
 * Handles authentication, encryption, and secure communication between microservices
 */
import { AxiosResponse } from 'axios';
export interface ServiceClientOptions {
    serviceId: string;
    targetService: string;
    baseURL: string;
    timeout?: number;
    retries?: number;
    enableMTLS?: boolean;
    clientCert?: string;
    clientKey?: string;
    caCert?: string;
    validateCertificate?: boolean;
    customHeaders?: Record<string, string>;
}
export interface SecureRequestOptions {
    tenantId?: string;
    scopes?: string[];
    timeout?: number;
    retries?: number;
    validateResponse?: boolean;
}
export declare class InterServiceClient {
    private axios;
    private jwtManager;
    private options;
    constructor(options: ServiceClientOptions);
    /**
     * Create configured Axios instance with security settings
     */
    private createAxiosInstance;
    /**
     * Create HTTPS agent for mTLS
     */
    private createHTTPSAgent;
    /**
     * Add authentication to request
     */
    private addAuthentication;
    /**
     * Validate response
     */
    private validateResponse;
    /**
     * Handle response errors with retry logic
     */
    private handleResponseError;
    /**
     * Determine if request should be retried
     */
    private shouldRetry;
    /**
     * Secure GET request
     */
    get<T = any>(url: string, options?: SecureRequestOptions): Promise<AxiosResponse<T>>;
    /**
     * Secure POST request
     */
    post<T = any>(url: string, data?: any, options?: SecureRequestOptions): Promise<AxiosResponse<T>>;
    /**
     * Secure PUT request
     */
    put<T = any>(url: string, data?: any, options?: SecureRequestOptions): Promise<AxiosResponse<T>>;
    /**
     * Secure DELETE request
     */
    delete<T = any>(url: string, options?: SecureRequestOptions): Promise<AxiosResponse<T>>;
    /**
     * Secure PATCH request
     */
    patch<T = any>(url: string, data?: any, options?: SecureRequestOptions): Promise<AxiosResponse<T>>;
    /**
     * Health check with authentication
     */
    healthCheck(): Promise<boolean>;
    /**
     * Test connectivity and authentication
     */
    testConnection(): Promise<{
        connected: boolean;
        authenticated: boolean;
        latency: number;
        error?: string;
    }>;
    /**
     * Close client and cleanup resources
     */
    close(): void;
}
/**
 * Factory function to create inter-service clients
 */
export declare function createInterServiceClient(options: ServiceClientOptions): InterServiceClient;
/**
 * Service registry for managing multiple service clients
 */
export declare class ServiceRegistry {
    private clients;
    private serviceId;
    constructor(serviceId: string);
    /**
     * Register a service client
     */
    register(serviceName: string, options: Omit<ServiceClientOptions, 'serviceId'>): void;
    /**
     * Get a service client
     */
    getClient(serviceName: string): InterServiceClient;
    /**
     * Check health of all registered services
     */
    healthCheckAll(): Promise<Record<string, boolean>>;
    /**
     * Close all clients
     */
    closeAll(): void;
}
//# sourceMappingURL=inter-service-client.d.ts.map