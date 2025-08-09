#!/usr/bin/env node

/**
 * Analytics Service Test
 * Tests analytics endpoints and metrics collection
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3003';
const TEST_TENANT = 'test-tenant-analytics';

async function testGetMetrics() {
  console.log('\n📊 Testing Get Analytics Metrics...');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/analytics/metrics`, {
      params: { tenantId: TEST_TENANT }
    });
    
    console.log('✅ Metrics retrieval successful');
    console.log('📈 Total queries:', response.data.totalQueries || 0);
    console.log('⚡ Average response time:', response.data.averageResponseTime || 0, 'ms');
    console.log('🎯 Success rate:', response.data.successRate || 0, '%');
    console.log('📅 Time period:', response.data.timePeriod || 'N/A');
    
    return response.data;
  } catch (error) {
    console.error('❌ Metrics retrieval failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testGetUsageStats() {
  console.log('\n📈 Testing Usage Statistics...');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/analytics/usage`, {
      params: { 
        tenantId: TEST_TENANT,
        period: '24h',
        granularity: 'hour'
      }
    });
    
    console.log('✅ Usage statistics successful');
    console.log('📊 Data points:', response.data.dataPoints?.length || 0);
    console.log('📅 Period covered:', response.data.period || 'N/A');
    console.log('🔍 Granularity:', response.data.granularity || 'N/A');
    
    if (response.data.dataPoints && response.data.dataPoints.length > 0) {
      const latest = response.data.dataPoints[response.data.dataPoints.length - 1];
      console.log('📋 Latest data point:', latest);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Usage statistics failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testCreateAnalyticsEvent() {
  console.log('\n📝 Testing Create Analytics Event...');
  
  try {
    const eventData = {
      tenantId: TEST_TENANT,
      eventType: 'query_processed',
      metadata: {
        queryLength: 25,
        responseTime: 1500,
        success: true,
        source: 'test-suite',
        timestamp: new Date().toISOString()
      }
    };
    
    const response = await axios.post(`${BASE_URL}/api/analytics/events`, eventData, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Analytics event creation successful');
    console.log('🆔 Event ID:', response.data.eventId);
    console.log('📅 Timestamp:', response.data.timestamp);
    console.log('🏷️  Event type:', response.data.eventType);
    
    return response.data;
  } catch (error) {
    console.error('❌ Analytics event creation failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testPopularQueries() {
  console.log('\n🔥 Testing Popular Queries...');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/analytics/popular-queries`, {
      params: { 
        tenantId: TEST_TENANT,
        limit: 10,
        period: '7d'
      }
    });
    
    console.log('✅ Popular queries retrieval successful');
    console.log('📋 Queries found:', response.data.queries?.length || 0);
    
    if (response.data.queries && response.data.queries.length > 0) {
      console.log('\n🔝 Top queries:');
      response.data.queries.slice(0, 3).forEach((query, index) => {
        console.log(`  ${index + 1}. "${query.query}" (${query.count} times)`);
      });
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Popular queries failed:', error.response?.data || error.message);
    throw error;
  }
}

async function runAllAnalyticsTests() {
  console.log('🚀 Starting Analytics Service Tests...');
  
  const results = {};
  
  try {
    // Create some test events first
    await testCreateAnalyticsEvent();
    
    console.log('\n⏳ Waiting 1 second for event processing...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    results.metrics = await testGetMetrics();
    results.usage = await testGetUsageStats();
    results.popular = await testPopularQueries();
    
    console.log('\n🎉 All analytics tests completed successfully!');
    return results;
  } catch (error) {
    console.error('\n💥 Analytics tests failed:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runAllAnalyticsTests()
    .then(() => {
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = { 
  testGetMetrics,
  testGetUsageStats,
  testCreateAnalyticsEvent,
  testPopularQueries,
  runAllAnalyticsTests 
};
