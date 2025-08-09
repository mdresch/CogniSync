#!/usr/bin/env node

/**
 * Health Check Test
 * Tests the basic health endpoint and service status
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3003';

async function testHealthCheck() {
  console.log('\n🏥 Testing Health Check...');
  
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    
    console.log('✅ Health check successful');
    console.log('📊 Status:', response.data.status);
    console.log('🕒 Uptime:', response.data.metrics.uptime, 'seconds');
    console.log('💾 Memory usage:', response.data.metrics.memoryUsage, 'MB');
    console.log('\n📋 Service Status:');
    
    Object.entries(response.data.services).forEach(([service, status]) => {
      const icon = status === 'up' ? '✅' : '❌';
      console.log(`  ${icon} ${service}: ${status}`);
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  testHealthCheck()
    .then(() => {
      console.log('\n🎉 Health check test completed!');
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = { testHealthCheck };
