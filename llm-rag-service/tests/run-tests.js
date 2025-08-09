#!/usr/bin/env node

/**
 * Master Test Suite Runner
 * Runs all tests in sequence with proper error handling and cleanup
 */

const { testHealthCheck } = require('./health-check.test.js');
const { runAllEmbeddingTests } = require('./embeddings.test.js');
const { runAllLLMTests } = require('./llm-query.test.js');
const { runAllAnalyticsTests } = require('./analytics.test.js');

async function runAllTests() {
  console.log('🧪 LLM/RAG Service Test Suite');
  console.log('===============================\n');
  
  const results = {
    health: null,
    embeddings: null,
    llm: null,
    analytics: null,
    errors: []
  };
  
  const startTime = Date.now();
  
  try {
    // 1. Health Check (always run first)
    console.log('1️⃣ Health Check');
    console.log('================');
    results.health = await testHealthCheck();
    
    // 2. Embeddings Tests
    console.log('\n2️⃣ Embeddings Service');
    console.log('=====================');
    try {
      results.embeddings = await runAllEmbeddingTests();
    } catch (error) {
      results.errors.push({ service: 'embeddings', error: error.message });
      console.warn('⚠️  Embeddings tests failed, continuing with other tests...');
    }
    
    // 3. LLM Query Tests
    console.log('\n3️⃣ LLM Query Service');
    console.log('====================');
    try {
      results.llm = await runAllLLMTests();
    } catch (error) {
      results.errors.push({ service: 'llm', error: error.message });
      console.warn('⚠️  LLM tests failed, continuing with other tests...');
    }
    
    // 4. Analytics Tests
    console.log('\n4️⃣ Analytics Service');
    console.log('====================');
    try {
      results.analytics = await runAllAnalyticsTests();
    } catch (error) {
      results.errors.push({ service: 'analytics', error: error.message });
      console.warn('⚠️  Analytics tests failed, continuing with other tests...');
    }
    
  } catch (error) {
    console.error('💥 Critical test failure:', error.message);
    results.errors.push({ service: 'critical', error: error.message });
  }
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  // Print Summary
  console.log('\n📋 Test Summary');
  console.log('===============');
  console.log(`⏱️  Total time: ${totalTime}ms`);
  console.log(`✅ Successful: ${Object.values(results).filter(r => r !== null && typeof r === 'object').length - 1}`); // -1 for errors array
  console.log(`❌ Failed: ${results.errors.length}`);
  
  if (results.health) {
    console.log('\n🏥 Service Status:');
    Object.entries(results.health.services).forEach(([service, status]) => {
      const icon = status === 'up' ? '✅' : '❌';
      console.log(`  ${icon} ${service}: ${status}`);
    });
  }
  
  if (results.errors.length > 0) {
    console.log('\n🚨 Errors Encountered:');
    results.errors.forEach(err => {
      console.log(`  ❌ ${err.service}: ${err.error}`);
    });
  }
  
  console.log('\n🎭 Test Results:');
  console.log(`  🏥 Health: ${results.health ? '✅' : '❌'}`);
  console.log(`  🧠 Embeddings: ${results.embeddings ? '✅' : '❌'}`);
  console.log(`  🤖 LLM: ${results.llm ? '✅' : '❌'}`);
  console.log(`  📊 Analytics: ${results.analytics ? '✅' : '❌'}`);
  
  return results;
}

async function runIndividualTest(testName) {
  console.log(`🧪 Running individual test: ${testName}\n`);
  
  switch (testName.toLowerCase()) {
    case 'health':
      return await testHealthCheck();
    case 'embeddings':
      return await runAllEmbeddingTests();
    case 'llm':
    case 'query':
      return await runAllLLMTests();
    case 'analytics':
      return await runAllAnalyticsTests();
    default:
      console.error('❌ Unknown test name. Available tests: health, embeddings, llm, analytics');
      process.exit(1);
  }
}

// Command line interface
if (require.main === module) {
  const testName = process.argv[2];
  
  if (testName) {
    // Run individual test
    runIndividualTest(testName)
      .then(() => {
        console.log(`\n🎉 ${testName} test completed!`);
        process.exit(0);
      })
      .catch((error) => {
        console.error(`\n💥 ${testName} test failed:`, error.message);
        process.exit(1);
      });
  } else {
    // Run all tests
    runAllTests()
      .then((results) => {
        const hasErrors = results.errors.length > 0;
        console.log(`\n🏁 Test suite ${hasErrors ? 'completed with errors' : 'completed successfully'}!`);
        process.exit(hasErrors ? 1 : 0);
      })
      .catch((error) => {
        console.error('\n💥 Test suite failed:', error.message);
        process.exit(1);
      });
  }
}

module.exports = { runAllTests, runIndividualTest };
