import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding LLM/RAG Service database...');

  // Create sample LLM configurations for different tenants
  console.log('Creating LLM configurations...');
  
  const defaultConfig = await prisma.lLMConfiguration.create({
    data: {
      name: 'Default OpenAI Configuration',
      tenantId: 'default-tenant',
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      apiKey: 'sk-example-key-placeholder',
      endpoint: 'https://api.openai.com/v1',
      embeddingProvider: 'openai',
      embeddingModel: 'text-embedding-ada-002',
      embeddingApiKey: 'sk-example-key-placeholder',
      vectorProvider: 'pinecone',
      vectorConfig: {
        apiKey: 'your-pinecone-api-key',
        environment: 'us-west1-gcp',
        indexName: 'llm-rag-embeddings',
        namespace: 'default-tenant',
        dimensions: 1536
      },
      maxTokens: 4000,
      temperature: 0.7,
      chunkSize: 1000,
      chunkOverlap: 200,
      maxResults: 20,
      similarityThreshold: 0.7,
      rerankingEnabled: true,
      isActive: true
    }
  });

  const enterpriseConfig = await prisma.lLMConfiguration.create({
    data: {
      name: 'Enterprise GPT-4 Configuration',
      tenantId: 'enterprise-tenant',
      provider: 'openai',
      model: 'gpt-4',
      apiKey: 'sk-enterprise-key-placeholder',
      endpoint: 'https://api.openai.com/v1',
      embeddingProvider: 'openai',
      embeddingModel: 'text-embedding-ada-002',
      embeddingApiKey: 'sk-enterprise-key-placeholder',
      vectorProvider: 'pinecone',
      vectorConfig: {
        apiKey: 'your-enterprise-pinecone-api-key',
        environment: 'us-west1-gcp',
        indexName: 'enterprise-rag-embeddings',
        namespace: 'enterprise-tenant',
        dimensions: 1536
      },
      maxTokens: 8000,
      temperature: 0.5,
      chunkSize: 1000,
      chunkOverlap: 200,
      maxResults: 50,
      similarityThreshold: 0.75,
      rerankingEnabled: true,
      isActive: true
    }
  });

  // Create sample query sessions
  console.log('Creating query sessions...');
  
  const session1 = await prisma.querySession.create({
    data: {
      sessionId: 'session-demo-1',
      tenantId: 'default-tenant',
      userId: 'user-demo-1',
      originalQuery: 'How do I integrate the API Management Platform?',
      processedQuery: 'API Management Platform integration guide setup configuration',
      intent: 'technical',
      complexity: 'moderate',
      resultsCount: 8,
      responseTime: 1250.5,
      status: 'completed',
      context: {
        userAgent: 'LLM-RAG-Service/1.0.0',
        source: 'web-interface',
        context: 'product-documentation'
      },
      queryMetadata: {
        processingSteps: ['query_analysis', 'entity_extraction', 'semantic_search'],
        entitiesFound: ['API Management', 'Integration', 'Platform'],
        confidenceScore: 0.92
      }
    }
  });

  const session2 = await prisma.querySession.create({
    data: {
      sessionId: 'session-demo-2',
      tenantId: 'enterprise-tenant',
      userId: 'user-enterprise-1',
      originalQuery: 'Show me the latest performance metrics',
      processedQuery: 'performance metrics production APIs monitoring dashboard',
      intent: 'status',
      complexity: 'simple',
      resultsCount: 5,
      responseTime: 750.3,
      status: 'completed',
      context: {
        userAgent: 'Enterprise-App/2.1.0',
        source: 'api-integration',
        context: 'technical-support'
      },
      queryMetadata: {
        processingSteps: ['query_analysis', 'metrics_query'],
        entitiesFound: ['Performance', 'Metrics', 'Production'],
        confidenceScore: 0.95
      }
    }
  });

  // Create sample query results
  console.log('Creating query results...');
  
  await prisma.queryResult.create({
    data: {
      sessionId: session1.id,
      source: 'confluence',
      sourceId: 'page-123456',
      sourceUrl: 'https://confluence.company.com/spaces/API/pages/123456',
      title: 'API Management Platform - Getting Started Guide',
      content: 'This comprehensive guide covers the fundamentals of using the API Management Platform...',
      excerpt: 'Complete setup and configuration guide for API Management Platform integration...',
      relevanceScore: 0.92,
      semanticScore: 0.89,
      rankPosition: 1,
      contentType: 'page',
      metadata: {
        author: 'Technical Writing Team',
        lastModified: '2024-08-01T10:00:00Z',
        tags: ['getting-started', 'api-management', 'setup']
      }
    }
  });

  await prisma.queryResult.create({
    data: {
      sessionId: session2.id,
      source: 'knowledge_graph',
      sourceId: 'entity-performance-001',
      sourceUrl: 'http://localhost:3001/api/v1/entities/performance-001',
      title: 'Production API Performance Metrics',
      content: 'Current performance metrics for production APIs including response times, throughput...',
      excerpt: 'Latest performance data shows average response time of 180ms with 99.9% uptime...',
      relevanceScore: 0.95,
      semanticScore: 0.93,
      rankPosition: 1,
      contentType: 'entity',
      metadata: {
        entityType: 'performance_metric',
        lastUpdated: '2024-08-07T08:00:00Z',
        source: 'monitoring_system'
      }
    }
  });

  // Create sample document embeddings
  console.log('Creating document embeddings...');
  
  await prisma.documentEmbedding.create({
    data: {
      tenantId: 'default-tenant',
      sourceType: 'confluence',
      sourceId: 'page-123456',
      sourceUrl: 'https://confluence.company.com/spaces/API/pages/123456',
      title: 'API Management Platform - Getting Started Guide',
      content: 'This comprehensive guide covers the fundamentals of using the API Management Platform, including setup, configuration, and basic operations.',
      contentHash: 'abc123def456',
      embedding: JSON.stringify(Array(1536).fill(0).map(() => Math.random() * 2 - 1)),
      embeddingModel: 'text-embedding-ada-002',
      embeddingDimensions: 1536,
      contentType: 'page',
      metadata: {
        author: 'Technical Writing Team',
        spaceKey: 'API'
      },
      tags: ['getting-started', 'api-management', 'setup']
    }
  });

  await prisma.documentEmbedding.create({
    data: {
      tenantId: 'default-tenant',
      sourceType: 'confluence',
      sourceId: 'page-789012',
      sourceUrl: 'https://confluence.company.com/spaces/SEC/pages/789012',
      title: 'Security Policies and Authentication Methods',
      content: 'Detailed documentation covering security implementation, authentication methods, OAuth flows, and best practices for API security.',
      contentHash: 'xyz789uvw456',
      embedding: JSON.stringify(Array(1536).fill(0).map(() => Math.random() * 2 - 1)),
      embeddingModel: 'text-embedding-ada-002',
      embeddingDimensions: 1536,
      contentType: 'page',
      metadata: {
        author: 'Security Team',
        spaceKey: 'SEC'
      },
      tags: ['security', 'authentication', 'oauth', 'best-practices']
    }
  });

  // Create sample semantic indices
  console.log('Creating semantic indices...');
  
  await prisma.semanticIndex.create({
    data: {
      tenantId: 'default-tenant',
      indexName: 'api-documentation-index',
      indexType: 'pinecone',
      dimensions: 1536,
      metric: 'cosine',
      totalVectors: 45,
      isActive: true,
      config: {
        namespace: 'api-docs',
        replicas: 1,
        pods: 1
      }
    }
  });

  await prisma.semanticIndex.create({
    data: {
      tenantId: 'enterprise-tenant',
      indexName: 'enterprise-knowledge-index',
      indexType: 'pinecone',
      dimensions: 1536,
      metric: 'cosine',
      totalVectors: 156,
      isActive: true,
      config: {
        namespace: 'enterprise',
        replicas: 2,
        pods: 2
      }
    }
  });

  // Create sample query analytics
  console.log('Creating query analytics...');
  
  await prisma.queryAnalytics.create({
    data: {
      tenantId: 'default-tenant',
      date: new Date('2024-08-01'),
      totalQueries: 145,
      successfulQueries: 132,
      failedQueries: 13,
      avgResponseTime: 1150,
      minResponseTime: 250,
      maxResponseTime: 4500,
      businessQueries: 45,
      technicalQueries: 67,
      projectQueries: 12,
      requirementsQueries: 8,
      statusQueries: 13,
      confluenceResults: 89,
      jiraResults: 34,
      kgResults: 78,
      externalResults: 23,
      avgRelevanceScore: 0.84,
      avgSemanticScore: 0.78,
      uniqueUsers: 23,
      repeatUsers: 18,
      peakHour: 14
    }
  });

  await prisma.queryAnalytics.create({
    data: {
      tenantId: 'enterprise-tenant',
      date: new Date('2024-08-01'),
      totalQueries: 324,
      successfulQueries: 318,
      failedQueries: 6,
      avgResponseTime: 890,
      minResponseTime: 180,
      maxResponseTime: 3200,
      businessQueries: 89,
      technicalQueries: 156,
      projectQueries: 45,
      requirementsQueries: 23,
      statusQueries: 11,
      confluenceResults: 187,
      jiraResults: 98,
      kgResults: 234,
      externalResults: 45,
      avgRelevanceScore: 0.91,
      avgSemanticScore: 0.87,
      uniqueUsers: 67,
      repeatUsers: 45,
      peakHour: 10
    }
  });
  console.log('   - 2 semantic indices for different tenants');
  console.log('   - 2 daily analytics records');
  console.log('');
  console.log('🔍 You can explore the data using:');
  console.log('   npx prisma studio');
  console.log('');
  console.log('🚀 Service is ready for testing!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
