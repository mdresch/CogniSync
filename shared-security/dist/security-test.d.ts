/**
 * Comprehensive security test suite for CogniSync platform
 * Tests authentication, authorization, encryption, and inter-service communication
 */
declare class SecurityTestSuite {
    private results;
    runAllTests(): Promise<void>;
    private runTest;
    private testJWTSecurity;
    private testAuthenticationMiddleware;
    private testInterServiceCommunication;
    private testMTLSConfiguration;
    private testSecurityConfiguration;
    private printResults;
}
export { SecurityTestSuite };
//# sourceMappingURL=security-test.d.ts.map