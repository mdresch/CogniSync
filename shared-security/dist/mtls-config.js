"use strict";
/**
 * Mutual TLS (mTLS) configuration for secure inter-service communication
 * Provides certificate management and validation for service-to-service authentication
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MTLSManager = void 0;
exports.createMTLSManager = createMTLSManager;
exports.getDefaultMTLSConfig = getDefaultMTLSConfig;
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
class MTLSManager {
    constructor(config) {
        this.certificates = new Map();
        this.config = {
            certificateRotationInterval: 24, // 24 hours default
            ...config
        };
        if (this.config.enabled) {
            this.loadCertificates();
            this.setupCertificateRotation();
        }
    }
    /**
     * Load certificates from filesystem
     */
    loadCertificates() {
        try {
            const cert = fs_1.default.readFileSync(this.config.certPath, 'utf8');
            const key = fs_1.default.readFileSync(this.config.keyPath, 'utf8');
            const ca = fs_1.default.readFileSync(this.config.caPath, 'utf8');
            const fingerprint = this.calculateCertificateFingerprint(cert);
            const expiresAt = this.extractCertificateExpiry(cert);
            const serviceCert = {
                serviceId: 'self',
                cert,
                key,
                ca,
                fingerprint,
                expiresAt,
                createdAt: new Date()
            };
            this.certificates.set('self', serviceCert);
        }
        catch (error) {
            let errorMsg = 'Unknown error';
            if (error && typeof error === 'object' && 'message' in error) {
                errorMsg = error.message;
            }
            throw new Error(`Failed to load mTLS certificates: ${errorMsg}`);
        }
    }
    /**
     * Calculate certificate fingerprint
     */
    calculateCertificateFingerprint(cert) {
        // Remove PEM headers and whitespace
        const certData = cert
            .replace(/-----BEGIN CERTIFICATE-----/, '')
            .replace(/-----END CERTIFICATE-----/, '')
            .replace(/\s/g, '');
        return crypto_1.default
            .createHash('sha256')
            .update(Buffer.from(certData, 'base64'))
            .digest('hex');
    }
    /**
     * Extract certificate expiry date
     */
    extractCertificateExpiry(cert) {
        // This is a simplified implementation
        // In production, use a proper X.509 certificate parser
        try {
            const certBuffer = Buffer.from(cert.replace(/-----BEGIN CERTIFICATE-----/, '')
                .replace(/-----END CERTIFICATE-----/, '')
                .replace(/\s/g, ''), 'base64');
            // This is a placeholder - implement proper ASN.1 parsing
            // For now, return a date 1 year from now
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            return expiryDate;
        }
        catch (error) {
            let errorMsg = 'Unknown error';
            if (error && typeof error === 'object' && 'message' in error) {
                errorMsg = error.message;
            }
            throw new Error(`Failed to parse certificate expiry: ${errorMsg}`);
        }
    }
    /**
     * Setup automatic certificate rotation
     */
    setupCertificateRotation() {
        if (!this.config.certificateRotationInterval)
            return;
        const intervalMs = this.config.certificateRotationInterval * 60 * 60 * 1000;
        this.rotationTimer = setInterval(() => {
            this.checkAndRotateCertificates();
        }, intervalMs);
    }
    /**
     * Check and rotate certificates if needed
     */
    async checkAndRotateCertificates() {
        for (const [serviceId, cert] of this.certificates) {
            const daysUntilExpiry = Math.floor((cert.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            // Rotate if certificate expires within 30 days
            if (daysUntilExpiry <= 30) {
                console.warn(`Certificate for ${serviceId} expires in ${daysUntilExpiry} days. Rotation needed.`);
                // In production, implement automatic certificate renewal
                // This could integrate with Let's Encrypt, internal CA, etc.
            }
        }
    }
    /**
     * Get TLS options for client connections
     */
    getClientTLSOptions(targetService) {
        if (!this.config.enabled) {
            return {};
        }
        const cert = this.certificates.get('self');
        if (!cert) {
            throw new Error('Client certificate not available');
        }
        return {
            cert: cert.cert,
            key: cert.key,
            ca: cert.ca,
            rejectUnauthorized: this.config.validateCertificate,
            checkServerIdentity: (hostname, cert) => {
                return this.validateServerCertificate(targetService, hostname, cert);
            }
        };
    }
    /**
     * Get TLS options for server connections
     */
    getServerTLSOptions() {
        if (!this.config.enabled) {
            return {};
        }
        const cert = this.certificates.get('self');
        if (!cert) {
            throw new Error('Server certificate not available');
        }
        return {
            cert: cert.cert,
            key: cert.key,
            ca: cert.ca,
            requestCert: true,
            rejectUnauthorized: this.config.validateCertificate,
            checkClientIdentity: (cert) => {
                return this.validateClientCertificate(cert);
            }
        };
    }
    /**
     * Validate server certificate
     */
    validateServerCertificate(targetService, hostname, cert) {
        if (!this.config.validateCertificate) {
            return undefined;
        }
        // Check if service is allowed
        if (!this.config.allowedServices.includes(targetService)) {
            return new Error(`Service ${targetService} not in allowed services list`);
        }
        // Validate certificate fingerprint
        const fingerprint = cert.fingerprint256?.replace(/:/g, '').toLowerCase();
        const expectedFingerprint = this.getExpectedFingerprint(targetService);
        if (expectedFingerprint && fingerprint !== expectedFingerprint) {
            return new Error(`Certificate fingerprint mismatch for ${targetService}`);
        }
        // Additional custom validation can be added here
        return undefined;
    }
    /**
     * Validate client certificate
     */
    validateClientCertificate(cert) {
        if (!this.config.validateCertificate) {
            return true;
        }
        // Extract service ID from certificate subject
        const serviceId = this.extractServiceIdFromCertificate(cert);
        if (!serviceId) {
            return false;
        }
        // Check if service is allowed
        if (!this.config.allowedServices.includes(serviceId)) {
            return false;
        }
        // Validate certificate fingerprint
        const fingerprint = cert.fingerprint256?.replace(/:/g, '').toLowerCase();
        const expectedFingerprint = this.getExpectedFingerprint(serviceId);
        if (expectedFingerprint && fingerprint !== expectedFingerprint) {
            return false;
        }
        return true;
    }
    /**
     * Extract service ID from certificate
     */
    extractServiceIdFromCertificate(cert) {
        try {
            // Extract from certificate subject CN (Common Name)
            const subject = cert.subject;
            if (subject && subject.CN) {
                return subject.CN;
            }
            // Extract from certificate subject alternative names
            const altNames = cert.subjectaltname;
            if (altNames) {
                const serviceMatch = altNames.match(/DNS:([^,]+)/);
                if (serviceMatch) {
                    return serviceMatch[1];
                }
            }
            return null;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Get expected fingerprint for a service
     */
    getExpectedFingerprint(serviceId) {
        // In production, this would come from a secure certificate registry
        // For now, return null to skip fingerprint validation
        return null;
    }
    /**
     * Verify peer certificate in TLS connection
     */
    verifyPeerCertificate(socket) {
        if (!this.config.enabled || !this.config.validateCertificate) {
            return true;
        }
        const cert = socket.getPeerCertificate();
        if (!cert) {
            return false;
        }
        return this.validateClientCertificate(cert);
    }
    /**
     * Generate certificate signing request for service
     */
    generateCSR(serviceId, keySize = 2048) {
        const { privateKey, publicKey } = crypto_1.default.generateKeyPairSync('rsa', {
            modulusLength: keySize,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });
        // Create CSR (simplified - in production use proper CSR generation)
        const csr = this.createCSR(serviceId, publicKey, privateKey);
        return { csr, privateKey };
    }
    /**
     * Create Certificate Signing Request
     */
    createCSR(serviceId, publicKey, privateKey) {
        // This is a placeholder implementation
        // In production, use a proper CSR generation library
        const csrTemplate = `-----BEGIN CERTIFICATE REQUEST-----
${Buffer.from(`CN=${serviceId},O=CogniSync,C=US`).toString('base64')}
-----END CERTIFICATE REQUEST-----`;
        return csrTemplate;
    }
    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.rotationTimer) {
            clearInterval(this.rotationTimer);
        }
    }
    /**
     * Get certificate information
     */
    getCertificateInfo(serviceId = 'self') {
        return this.certificates.get(serviceId) || null;
    }
    /**
     * Check if mTLS is enabled
     */
    isEnabled() {
        return this.config.enabled;
    }
}
exports.MTLSManager = MTLSManager;
/**
 * Factory function to create mTLS manager
 */
function createMTLSManager(config) {
    return new MTLSManager(config);
}
/**
 * Default mTLS configuration
 */
function getDefaultMTLSConfig() {
    return {
        enabled: process.env.MTLS_ENABLED === 'true',
        certPath: process.env.MTLS_CERT_PATH || '/etc/ssl/certs/service.crt',
        keyPath: process.env.MTLS_KEY_PATH || '/etc/ssl/private/service.key',
        caPath: process.env.MTLS_CA_PATH || '/etc/ssl/certs/ca.crt',
        validateCertificate: process.env.MTLS_VALIDATE !== 'false',
        allowedServices: (process.env.MTLS_ALLOWED_SERVICES || '').split(',').filter(s => s.trim()),
        certificateRotationInterval: parseInt(process.env.MTLS_ROTATION_INTERVAL || '24')
    };
}
//# sourceMappingURL=mtls-config.js.map