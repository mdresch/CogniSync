#!/usr/bin/env node

/**
 * Embeddings Service Test
 * Tests Azure OpenAI embedding functionality
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3003';
const TEST_TENANT = 'test-tenant-embeddings';

async function testCreateEmbedding() {
  console.log('\n🧠 Testing Create Embedding...');
  
  try {
    const testData = {
      document: {
        id: `test-embed-${Date.now()}`,
        text: "This is a test document about API management and knowledge graphs.",
        title: "Test Document",
        source: "test-suite"
      },
      tenantId: TEST_TENANT
    };
    
    const response = await axios.post(`${BASE_URL}/api/embeddings/create`, testData, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Embedding creation successful');
    console.log('� Document ID:', response.data.documentId);
    console.log('📏 Embedding dimensions:', response.data.dimensions);
    console.log('⏱️ Processing time:', response.data.metadata?.processingTime, 'ms');
    
    return response.data;
  } catch (error) {
    console.error('❌ Embedding creation failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

async function testDocumentEmbedding() {
  console.log('\n📄 Testing Document Embedding...');
  
  try {
    const testDocument = {
      id: `test-doc-${Date.now()}`,
      text: "API Management Platform provides comprehensive tools for managing APIs, including authentication, rate limiting, monitoring, and analytics. The platform supports multiple deployment models and integrates with existing infrastructure.",
      title: "API Management Platform Overview",
      url: "https://example.com/docs/api-platform",
      source: "documentation",
      metadata: {
        category: "platform",
        tags: ["api", "management", "documentation"],
        version: "1.0.0"
      },
      tenantId: TEST_TENANT
    };
    
    const response = await axios.post(`${BASE_URL}/api/embeddings/documents`, testDocument, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Document embedding successful');
    console.log('📄 Document ID:', response.data.documentId);
    console.log('🧩 Chunks created:', response.data.chunksCreated);
    console.log('📊 Total embeddings:', response.data.embeddingsGenerated);
    
    return response.data;
  } catch (error) {
    console.error('❌ Document embedding failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testSearchEmbeddings() {
  console.log('\n🔍 Testing Embedding Search...');
  
  try {
    const searchQuery = {
      query: "API management tools and features",
      tenantId: TEST_TENANT,
      limit: 3,
      threshold: 0.7
    };
    
    const response = await axios.post(`${BASE_URL}/api/embeddings/search`, searchQuery, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Embedding search successful');
    console.log('📋 Results found:', response.data.results.length);
    
    response.data.results.forEach((result, index) => {
      console.log(`\n📄 Result ${index + 1}:`);
      console.log(`  📊 Similarity: ${result.similarity.toFixed(4)}`);
      console.log(`  📝 Text: ${result.text.substring(0, 100)}...`);
      console.log(`  🏷️  Source: ${result.metadata?.source || 'N/A'}`);
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Embedding search failed:', error.response?.data || error.message);
    throw error;
  }
}

async function runAllEmbeddingTests() {
  console.log('🚀 Starting Embedding Service Tests...');
  
  const results = {};
  
  try {
    results.embedding = await testCreateEmbedding();
    results.document = await testDocumentEmbedding();
    
    // Wait a bit for indexing
    console.log('\n⏳ Waiting 2 seconds for indexing...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    results.search = await testSearchEmbeddings();
    
    console.log('\n🎉 All embedding tests completed successfully!');
    return results;
  } catch (error) {
    console.error('\n💥 Embedding tests failed:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runAllEmbeddingTests()
    .then(() => {
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = { 
  testCreateEmbedding,
  testDocumentEmbedding, 
  testSearchEmbeddings,
  runAllEmbeddingTests 
};
