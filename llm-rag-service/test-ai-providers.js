// Simple test script to verify AI provider configuration
const { AIProviderService } = require('./dist/services/AIProviderService');

async function testAIProviders() {
  console.log('Testing AI Provider Service...');
  
  try {
    const aiProviderService = new AIProviderService();
    
    // Test getting provider configurations
    const configs = aiProviderService.getProviderConfigurations();
    console.log('Provider configurations:', configs.length);
    
    // Test getting health status
    const health = aiProviderService.getProviderHealth();
    console.log('Provider health status:', health.length);
    
    console.log('✅ AI Provider Service test completed successfully');
  } catch (error) {
    console.error('❌ AI Provider Service test failed:', error.message);
  }
}

testAIProviders();