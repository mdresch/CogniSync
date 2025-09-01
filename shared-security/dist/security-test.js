"use strict";
/**
 * Comprehensive security test suite for CogniSync platform
 * Tests authentication, authorization, encryption, and inter-service communication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityTestSuite = void 0;
const jwt_utils_1 = require("./jwt-utils");
const service_auth_middleware_1 = require("./service-auth.middleware");
const inter_service_client_1 = require("./inter-service-client");
const mtls_config_1 = require("./mtls-config");
const security_config_1 = require("./security-config");
class SecurityTestSuite {
    constructor() {
        this.results = [];
    }
    async runAllTests() {
        console.log('🔐 Starting CogniSync Security Test Suite...\n');
        await this.testJWTSecurity();
        await this.testAuthenticationMiddleware();
        await this.testInterServiceCommunication();
        await this.testMTLSConfiguration();
        await this.testSecurityConfiguration();
        this.printResults();
    }
    async runTest(name, testFn) {
        const startTime = Date.now();
        try {
            await testFn();
            this.results.push({
                name,
                passed: true,
                duration: Date.now() - startTime
            });
            console.log(`✅ ${name}`);
        }
        catch (error) {
            let errorMsg = 'Unknown error';
            if (error && typeof error === 'object' && 'message' in error) {
                errorMsg = error.message;
            }
            this.results.push({
                name,
                passed: false,
                error: errorMsg,
                duration: Date.now() - startTime
            });
            console.log(`❌ ${name}: ${errorMsg}`);
        }
    }
    async testJWTSecurity() {
        console.log('🔑 Testing JWT Security...');
        await this.runTest('JWT Manager Initialization', async () => {
            const jwtManager = new jwt_utils_1.JWTSecurityManager('test-service');
            if (!jwtManager) {
                throw new Error('Failed to initialize JWT manager');
            }
        });
        await this.runTest('Service Token Generation', async () => {
            const jwtManager = new jwt_utils_1.JWTSecurityManager('test-service');
            const token = jwtManager.generateServiceToken('target-service', ['read', 'write']);
            if (!token || typeof token !== 'string') {
                throw new Error('Failed to generate service token');
            }
        });
        await this.runTest('Service Token Validation', async () => {
            const jwtManager = new jwt_utils_1.JWTSecurityManager('test-service');
            const token = jwtManager.generateServiceToken('target-service', ['read']);
            const decoded = jwtManager.validateServiceToken(token);
            if (decoded.serviceId !== 'test-service') {
                throw new Error('Token validation failed');
            }
        });
        await this.runTest('User Token Generation', async () => {
            const jwtManager = new jwt_utils_1.JWTSecurityManager('test-service');
            const token = jwtManager.generateUserToken('user123', 'tenant123', ['user'], ['read']);
            if (!token || typeof token !== 'string') {
                throw new Error('Failed to generate user token');
            }
        });
        await this.runTest('User Token Validation', async () => {
            const jwtManager = new jwt_utils_1.JWTSecurityManager('test-service');
            const token = jwtManager.generateUserToken('user123', 'tenant123', ['user'], ['read']);
            const decoded = jwtManager.validateUserToken(token);
            if (decoded.userId !== 'user123' || decoded.tenantId !== 'tenant123') {
                throw new Error('User token validation failed');
            }
        });
        await this.runTest('Request Signing', async () => {
            const jwtManager = new jwt_utils_1.JWTSecurityManager('test-service');
            const signed = jwtManager.createSignedRequest('target-service', 'POST', '/api/test', { data: 'test' });
            if (!signed.token || !signed.signature || !signed.timestamp) {
                throw new Error('Request signing failed');
            }
        });
        await this.runTest('Request Signature Verification', async () => {
            const jwtManager = new jwt_utils_1.JWTSecurityManager('test-service');
            const signed = jwtManager.createSignedRequest('target-service', 'POST', '/api/test', { data: 'test' });
            const isValid = jwtManager.verifySignedRequest(signed.token, signed.signature, signed.timestamp, 'POST', '/api/test', { data: 'test' });
            if (!isValid) {
                throw new Error('Request signature verification failed');
            }
        });
        await this.runTest('Invalid Token Rejection', async () => {
            const jwtManager = new jwt_utils_1.JWTSecurityManager('test-service');
            try {
                jwtManager.validateServiceToken('invalid-token');
                throw new Error('Should have rejected invalid token');
            }
            catch (error) {
                let errorMsg = 'Unknown error';
                if (error && typeof error === 'object' && 'message' in error) {
                    errorMsg = error.message;
                }
                if (!errorMsg.includes('Token validation failed')) {
                    throw error;
                }
            }
        });
        console.log('');
    }
    async testAuthenticationMiddleware() {
        console.log('🛡️ Testing Authentication Middleware...');
        await this.runTest('Middleware Initialization', async () => {
            const middleware = new service_auth_middleware_1.ServiceAuthMiddleware({
                serviceId: 'test-service',
                allowedServices: ['other-service']
            });
            if (!middleware) {
                throw new Error('Failed to initialize middleware');
            }
        });
        await this.runTest('API Key Validation', async () => {
            // Set up test environment
            process.env.VALID_API_KEYS = 'test-key-1,test-key-2';
            const middleware = new service_auth_middleware_1.ServiceAuthMiddleware({
                serviceId: 'test-service'
            });
            // Mock request/response
            const req = {
                headers: { 'x-api-key': 'test-key-1' },
                path: '/api/test'
            };
            const res = {
                status: (code) => ({ json: (data) => ({ code, data }) })
            };
            let nextCalled = false;
            const next = () => { nextCalled = true; };
            await new Promise((resolve) => {
                middleware.authenticate(req, res, () => {
                    nextCalled = true;
                    resolve();
                });
            });
            if (!nextCalled) {
                throw new Error('Authentication should have succeeded');
            }
        });
        console.log('');
    }
    async testInterServiceCommunication() {
        console.log('🌐 Testing Inter-Service Communication...');
        await this.runTest('Client Initialization', async () => {
            const client = new inter_service_client_1.InterServiceClient({
                serviceId: 'test-service',
                targetService: 'target-service',
                baseURL: 'https://example.com',
                timeout: 5000
            });
            if (!client) {
                throw new Error('Failed to initialize inter-service client');
            }
        });
        await this.runTest('Client Configuration', async () => {
            const client = new inter_service_client_1.InterServiceClient({
                serviceId: 'test-service',
                targetService: 'target-service',
                baseURL: 'https://example.com',
                enableMTLS: false,
                validateCertificate: false
            });
            // Test that client is properly configured
            if (!client) {
                throw new Error('Client configuration failed');
            }
        });
        console.log('');
    }
    async testMTLSConfiguration() {
        console.log('🔒 Testing mTLS Configuration...');
        await this.runTest('mTLS Config Loading', async () => {
            const config = (0, mtls_config_1.getDefaultMTLSConfig)();
            if (!config) {
                throw new Error('Failed to load mTLS configuration');
            }
        });
        await this.runTest('mTLS Manager Initialization (Disabled)', async () => {
            const config = (0, mtls_config_1.getDefaultMTLSConfig)();
            config.enabled = false; // Disable for testing
            const manager = new mtls_config_1.MTLSManager(config);
            if (!manager) {
                throw new Error('Failed to initialize mTLS manager');
            }
        });
        await this.runTest('Certificate Info Retrieval', async () => {
            const config = (0, mtls_config_1.getDefaultMTLSConfig)();
            config.enabled = false;
            const manager = new mtls_config_1.MTLSManager(config);
            const info = manager.getCertificateInfo();
            // Should return null when disabled
            if (info !== null) {
                throw new Error('Should return null when mTLS is disabled');
            }
        });
        console.log('');
    }
    async testSecurityConfiguration() {
        console.log('⚙️ Testing Security Configuration...');
        await this.runTest('Security Config Loading', async () => {
            const config = (0, security_config_1.getServiceSecurityConfig)('test-service');
            if (!config || config.serviceId !== 'test-service') {
                throw new Error('Failed to load security configuration');
            }
        });
        await this.runTest('Environment Detection', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'test';
            const config = (0, security_config_1.getServiceSecurityConfig)('test-service');
            if (config.environment != 'test') {
                throw new Error('Environment detection failed');
            }
            process.env.NODE_ENV = originalEnv;
        });
        await this.runTest('JWT Secret Validation', async () => {
            const originalSecret = process.env.JWT_SECRET;
            process.env.JWT_SECRET = 'short'; // Too short
            try {
                (0, security_config_1.getServiceSecurityConfig)('test-service');
                throw new Error('Should have failed with short JWT secret');
            }
            catch (error) {
                let errorMsg = 'Unknown error';
                if (error && typeof error === 'object' && 'message' in error) {
                    errorMsg = error.message;
                }
                if (!errorMsg.includes('JWT secret must be at least 32 characters')) {
                    throw error;
                }
            }
            finally {
                process.env.JWT_SECRET = originalSecret;
            }
        });
        console.log('');
    }
    printResults() {
        console.log('📊 Test Results Summary');
        console.log('========================');
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const total = this.results.length;
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed} ✅`);
        console.log(`Failed: ${failed} ❌`);
        console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results
                .filter(r => !r.passed)
                .forEach(r => {
                console.log(`  - ${r.name}: ${r.error}`);
            });
        }
        const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
        console.log(`\nTotal Duration: ${totalDuration}ms`);
        if (failed === 0) {
            console.log('\n🎉 All security tests passed!');
        }
        else {
            console.log('\n⚠️ Some security tests failed. Please review and fix issues.');
            process.exit(1);
        }
    }
}
exports.SecurityTestSuite = SecurityTestSuite;
// Run tests if this file is executed directly
if (require.main === module) {
    const testSuite = new SecurityTestSuite();
    testSuite.runAllTests().catch(error => {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=security-test.js.map