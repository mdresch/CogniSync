/**
 * Mutual TLS (mTLS) configuration for secure inter-service communication
 * Provides certificate management and validation for service-to-service authentication
 */
import { TLSSocket } from 'tls';
export interface MTLSConfig {
    enabled: boolean;
    certPath: string;
    keyPath: string;
    caPath: string;
    validateCertificate: boolean;
    allowedServices: string[];
    certificateRotationInterval?: number;
}
export interface ServiceCertificate {
    serviceId: string;
    cert: string;
    key: string;
    ca: string;
    fingerprint: string;
    expiresAt: Date;
    createdAt: Date;
}
export declare class MTLSManager {
    private config;
    private certificates;
    private rotationTimer?;
    constructor(config: MTLSConfig);
    /**
     * Load certificates from filesystem
     */
    private loadCertificates;
    /**
     * Calculate certificate fingerprint
     */
    private calculateCertificateFingerprint;
    /**
     * Extract certificate expiry date
     */
    private extractCertificateExpiry;
    /**
     * Setup automatic certificate rotation
     */
    private setupCertificateRotation;
    /**
     * Check and rotate certificates if needed
     */
    private checkAndRotateCertificates;
    /**
     * Get TLS options for client connections
     */
    getClientTLSOptions(targetService: string): any;
    /**
     * Get TLS options for server connections
     */
    getServerTLSOptions(): any;
    /**
     * Validate server certificate
     */
    private validateServerCertificate;
    /**
     * Validate client certificate
     */
    private validateClientCertificate;
    /**
     * Extract service ID from certificate
     */
    private extractServiceIdFromCertificate;
    /**
     * Get expected fingerprint for a service
     */
    private getExpectedFingerprint;
    /**
     * Verify peer certificate in TLS connection
     */
    verifyPeerCertificate(socket: TLSSocket): boolean;
    /**
     * Generate certificate signing request for service
     */
    generateCSR(serviceId: string, keySize?: number): {
        csr: string;
        privateKey: string;
    };
    /**
     * Create Certificate Signing Request
     */
    private createCSR;
    /**
     * Cleanup resources
     */
    cleanup(): void;
    /**
     * Get certificate information
     */
    getCertificateInfo(serviceId?: string): ServiceCertificate | null;
    /**
     * Check if mTLS is enabled
     */
    isEnabled(): boolean;
}
/**
 * Factory function to create mTLS manager
 */
export declare function createMTLSManager(config: MTLSConfig): MTLSManager;
/**
 * Default mTLS configuration
 */
export declare function getDefaultMTLSConfig(): MTLSConfig;
//# sourceMappingURL=mtls-config.d.ts.map