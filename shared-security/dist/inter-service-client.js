"use strict";
/**
 * Secure inter-service communication client
 * Handles authentication, encryption, and secure communication between microservices
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceRegistry = exports.InterServiceClient = void 0;
exports.createInterServiceClient = createInterServiceClient;
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
const jwt_utils_1 = require("./jwt-utils");
class InterServiceClient {
    constructor(options) {
        this.options = {
            timeout: 30000,
            retries: 3,
            enableMTLS: false,
            validateCertificate: true,
            ...options
        };
        this.jwtManager = new jwt_utils_1.JWTSecurityManager(options.serviceId);
        this.axios = this.createAxiosInstance();
    }
    /**
     * Create configured Axios instance with security settings
     */
    createAxiosInstance() {
        const config = {
            baseURL: this.options.baseURL,
            timeout: this.options.timeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': `${this.options.serviceId}/1.0`,
                ...this.options.customHeaders
            }
        };
        // Configure HTTPS agent for mTLS if enabled
        if (this.options.enableMTLS) {
            config.httpsAgent = this.createHTTPSAgent();
        }
        const instance = axios_1.default.create(config);
        // Add request interceptor for authentication
        instance.interceptors.request.use((config) => this.addAuthentication(config), (error) => Promise.reject(error));
        // Add response interceptor for error handling
        instance.interceptors.response.use((response) => this.validateResponse(response), (error) => this.handleResponseError(error));
        return instance;
    }
    /**
     * Create HTTPS agent for mTLS
     */
    createHTTPSAgent() {
        const agentOptions = {
            rejectUnauthorized: this.options.validateCertificate
        };
        // Add client certificates for mTLS
        if (this.options.clientCert && this.options.clientKey) {
            agentOptions.cert = this.options.clientCert;
            agentOptions.key = this.options.clientKey;
        }
        // Add CA certificate if provided
        if (this.options.caCert) {
            agentOptions.ca = this.options.caCert;
        }
        return new https_1.default.Agent(agentOptions);
    }
    /**
     * Add authentication to request
     */
    addAuthentication(config) {
        // Generate service token
        const scopes = config.metadata?.scopes || ['read'];
        const tenantId = config.metadata?.tenantId;
        const token = this.jwtManager.generateServiceToken(this.options.targetService, scopes, tenantId);
        // Add JWT token to Authorization header
        if (typeof config.headers?.set === 'function') {
            config.headers.set('Authorization', `Bearer ${token}`);
        }
        else if (config.headers) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        // Add request signature for additional security
        const { signature, timestamp } = this.jwtManager.createSignedRequest(this.options.targetService, config.method?.toUpperCase() || 'GET', config.url || '', config.data);
        config.headers['X-Request-Signature'] = signature;
        config.headers['X-Request-Timestamp'] = timestamp;
        config.headers['X-Service-ID'] = this.options.serviceId;
        return config;
    }
    /**
     * Validate response
     */
    validateResponse(response) {
        // Validate response signature if present
        const signature = response.headers['x-response-signature'];
        const timestamp = response.headers['x-response-timestamp'];
        if (signature && timestamp) {
            const isValid = this.jwtManager.verifySignedRequest(response.headers['authorization']?.replace('Bearer ', '') || '', signature, timestamp, 'RESPONSE', response.config.url || '', response.data);
            if (!isValid) {
                throw new Error('Response signature validation failed');
            }
        }
        return response;
    }
    /**
     * Handle response errors with retry logic
     */
    async handleResponseError(error) {
        const config = error.config;
        // Don't retry if we've already retried max times
        if (!config || config.__retryCount >= this.options.retries) {
            return Promise.reject(error);
        }
        // Increment retry count
        config.__retryCount = config.__retryCount || 0;
        config.__retryCount++;
        // Determine if we should retry
        if (this.shouldRetry(error)) {
            // Exponential backoff
            const delay = Math.pow(2, config.__retryCount) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.axios.request(config);
        }
        return Promise.reject(error);
    }
    /**
     * Determine if request should be retried
     */
    shouldRetry(error) {
        // Retry on network errors
        if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
            return true;
        }
        // Retry on 5xx errors
        if (error.response?.status >= 500) {
            return true;
        }
        // Retry on 429 (rate limited)
        if (error.response?.status === 429) {
            return true;
        }
        // Don't retry on 4xx errors (except 429)
        return false;
    }
    /**
     * Secure GET request
     */
    async get(url, options = {}) {
        return this.axios.get(url, {
            ...(options ? { metadata: options } : {}),
            timeout: options.timeout
        });
    }
    /**
     * Secure POST request
     */
    async post(url, data, options = {}) {
        return this.axios.post(url, data, {
            ...(options ? { metadata: options } : {}),
            timeout: options.timeout
        });
    }
    /**
     * Secure PUT request
     */
    async put(url, data, options = {}) {
        return this.axios.put(url, data, {
            ...(options ? { metadata: options } : {}),
            timeout: options.timeout
        });
    }
    /**
     * Secure DELETE request
     */
    async delete(url, options = {}) {
        return this.axios.delete(url, {
            ...(options ? { metadata: options } : {}),
            timeout: options.timeout
        });
    }
    /**
     * Secure PATCH request
     */
    async patch(url, data, options = {}) {
        return this.axios.patch(url, data, {
            ...(options ? { metadata: options } : {}),
            timeout: options.timeout
        });
    }
    /**
     * Health check with authentication
     */
    async healthCheck() {
        try {
            const response = await this.get('/health', { scopes: ['health'] });
            return response.status === 200;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Test connectivity and authentication
     */
    async testConnection() {
        const startTime = Date.now();
        try {
            const response = await this.get('/health', {
                scopes: ['health'],
                timeout: 5000
            });
            const latency = Date.now() - startTime;
            return {
                connected: true,
                authenticated: response.status === 200,
                latency
            };
        }
        catch (error) {
            const latency = Date.now() - startTime;
            let errorMsg = 'Unknown error';
            if (error && typeof error === 'object' && 'message' in error) {
                errorMsg = error.message;
            }
            return {
                connected: false,
                authenticated: false,
                latency,
                error: errorMsg
            };
        }
    }
    /**
     * Close client and cleanup resources
     */
    close() {
        // Cleanup any persistent connections
        if (this.axios.defaults.httpsAgent) {
            this.axios.defaults.httpsAgent.destroy();
        }
    }
}
exports.InterServiceClient = InterServiceClient;
/**
 * Factory function to create inter-service clients
 */
function createInterServiceClient(options) {
    return new InterServiceClient(options);
}
/**
 * Service registry for managing multiple service clients
 */
class ServiceRegistry {
    constructor(serviceId) {
        this.clients = new Map();
        this.serviceId = serviceId;
    }
    /**
     * Register a service client
     */
    register(serviceName, options) {
        const client = new InterServiceClient({
            ...options,
            serviceId: this.serviceId,
            targetService: serviceName
        });
        this.clients.set(serviceName, client);
    }
    /**
     * Get a service client
     */
    getClient(serviceName) {
        const client = this.clients.get(serviceName);
        if (!client) {
            throw new Error(`Service client for '${serviceName}' not registered`);
        }
        return client;
    }
    /**
     * Check health of all registered services
     */
    async healthCheckAll() {
        const results = {};
        for (const [serviceName, client] of this.clients) {
            results[serviceName] = await client.healthCheck();
        }
        return results;
    }
    /**
     * Close all clients
     */
    closeAll() {
        for (const client of this.clients.values()) {
            client.close();
        }
        this.clients.clear();
    }
}
exports.ServiceRegistry = ServiceRegistry;
//# sourceMappingURL=inter-service-client.js.map