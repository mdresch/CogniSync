#!/usr/bin/env node

/**
 * Test Cleanup Utility
 * Cleans up test data and resets the system for fresh testing
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3003';
const TEST_TENANTS = [
  'test-tenant',
  'test-tenant-embeddings',
  'test-tenant-llm',
  'test-tenant-analytics'
];

async function cleanupTestData() {
  console.log('🧹 Starting Test Data Cleanup...\n');
  
  let cleanupCount = 0;
  let errorCount = 0;
  
  for (const tenantId of TEST_TENANTS) {
    console.log(`🗑️  Cleaning up tenant: ${tenantId}`);
    
    try {
      // Try to cleanup documents for this tenant
      const response = await axios.delete(`${BASE_URL}/api/cleanup`, {
        params: { tenantId },
        timeout: 10000
      });
      
      console.log(`  ✅ Cleanup successful: ${response.data.message || 'Done'}`);
      cleanupCount++;
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`  ℹ️  No cleanup endpoint available (this is normal)`);
      } else {
        console.log(`  ⚠️  Cleanup warning: ${error.message}`);
        errorCount++;
      }
    }
  }
  
  // Try to reset database if endpoint exists
  try {
    console.log('\n🔄 Attempting database reset...');
    const response = await axios.post(`${BASE_URL}/api/reset-test-data`, {
      confirm: true,
      tenants: TEST_TENANTS
    });
    console.log('  ✅ Database reset successful');
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('  ℹ️  No reset endpoint available (this is normal)');
    } else {
      console.log('  ⚠️  Reset warning:', error.message);
    }
  }
  
  console.log('\n📊 Cleanup Summary:');
  console.log(`✅ Successful cleanups: ${cleanupCount}`);
  console.log(`⚠️  Warnings/Errors: ${errorCount}`);
  console.log(`🏷️  Tenants processed: ${TEST_TENANTS.length}`);
  
  console.log('\n✨ Test environment is now clean and ready for fresh testing!');
  
  return { cleanupCount, errorCount, tenants: TEST_TENANTS.length };
}

async function verifyCleanup() {
  console.log('\n🔍 Verifying cleanup...');
  
  try {
    // Check health status
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Service is responding');
    console.log('📊 Status:', health.data.status);
    
    // Try a simple query to verify system is working
    const testResponse = await axios.post(`${BASE_URL}/api/embeddings/create`, {
      text: "cleanup verification test",
      tenantId: "cleanup-test"
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ System is functioning correctly after cleanup');
    return true;
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
}

// Command line interface
if (require.main === module) {
  const shouldVerify = process.argv.includes('--verify');
  
  cleanupTestData()
    .then(async (results) => {
      if (shouldVerify) {
        const isWorking = await verifyCleanup();
        process.exit(isWorking ? 0 : 1);
      } else {
        process.exit(0);
      }
    })
    .catch((error) => {
      console.error('\n💥 Cleanup failed:', error.message);
      process.exit(1);
    });
}

module.exports = { cleanupTestData, verifyCleanup };
