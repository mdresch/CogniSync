#!/usr/bin/env node

/**
 * LLM Query Service Test
 * Tests Azure OpenAI chat completion functionality
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3003';
const TEST_TENANT = 'test-tenant-llm';

async function testSimpleQuery() {
  console.log('\n🤖 Testing Simple LLM Query...');
  
  try {
    const queryData = {
      query: "What is an API management platform?",
      tenantId: TEST_TENANT,
      context: {
        source: "test",
        requestType: "information"
      }
    };
    
    const response = await axios.post(`${BASE_URL}/api/query`, queryData, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Simple query successful');
    console.log('💬 Response length:', response.data.response.length, 'characters');
    console.log('🎯 Confidence:', response.data.confidence);
    console.log('⏱️ Processing time:', response.data.processingTime, 'ms');
    console.log('📄 Sources used:', response.data.sources?.length || 0);
    console.log('\n📝 Response preview:');
    console.log(response.data.response.substring(0, 200) + '...');
    
    return response.data;
  } catch (error) {
    console.error('❌ Simple query failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testContextualQuery() {
  console.log('\n📚 Testing Contextual Query...');
  
  try {
    const queryData = {
      query: "How do I implement rate limiting in my API?",
      tenantId: TEST_TENANT,
      context: {
        source: "developer-portal",
        requestType: "technical-guidance",
        userRole: "developer",
        previousContext: "API security implementation"
      },
      includeContext: true,
      maxSources: 5
    };
    
    const response = await axios.post(`${BASE_URL}/api/query`, queryData, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Contextual query successful');
    console.log('🧠 Enhanced context:', response.data.enhancedContext ? '✓' : '✗');
    console.log('📊 Query complexity:', response.data.analysis?.complexity || 'N/A');
    console.log('🎯 Intent detected:', response.data.analysis?.intent || 'N/A');
    console.log('🔍 Entities found:', response.data.analysis?.entities?.length || 0);
    console.log('📄 Knowledge sources:', response.data.sources?.length || 0);
    
    return response.data;
  } catch (error) {
    console.error('❌ Contextual query failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testAnalyticsQuery() {
  console.log('\n📈 Testing Analytics Query...');
  
  try {
    const queryData = {
      query: "Show me API usage trends and performance metrics",
      tenantId: TEST_TENANT,
      context: {
        source: "analytics-dashboard",
        requestType: "data-analysis",
        userRole: "analyst"
      },
      requireAnalytics: true
    };
    
    const response = await axios.post(`${BASE_URL}/api/query`, queryData, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Analytics query successful');
    console.log('📊 Analytics included:', response.data.analytics ? '✓' : '✗');
    console.log('📈 Metrics provided:', response.data.metrics ? Object.keys(response.data.metrics).length : 0);
    
    return response.data;
  } catch (error) {
    console.error('❌ Analytics query failed:', error.response?.data || error.message);
    throw error;
  }
}

async function runAllLLMTests() {
  console.log('🚀 Starting LLM Query Service Tests...');
  
  const results = {};
  
  try {
    results.simple = await testSimpleQuery();
    
    console.log('\n⏳ Waiting 1 second between requests...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    results.contextual = await testContextualQuery();
    
    console.log('\n⏳ Waiting 1 second between requests...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    results.analytics = await testAnalyticsQuery();
    
    console.log('\n🎉 All LLM tests completed successfully!');
    return results;
  } catch (error) {
    console.error('\n💥 LLM tests failed:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runAllLLMTests()
    .then(() => {
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = { 
  testSimpleQuery,
  testContextualQuery,
  testAnalyticsQuery,
  runAllLLMTests 
};
