import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting LLM/RAG service database seeding...');

  // Clean existing data
  await prisma.queryAnalytics.deleteMany();
  await prisma.queryResult.deleteMany();
  await prisma.querySession.deleteMany();
  await prisma.semanticIndex.deleteMany();
  await prisma.documentEmbedding.deleteMany();
  await prisma.lLMConfiguration.deleteMany();

  console.log('📋 Creating LLM configurations...');
  
  // Create LLM configurations for different tenants
  const llmConfig1 = await prisma.lLMConfiguration.create({
    data: {
      name: 'OpenAI GPT-3.5 Configuration',
      tenantId: 'tenant-1',
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      apiKey: 'sk-test-key-1',
      endpoint: 'https://api.openai.com/v1',
      embeddingProvider: 'openai',
      embeddingModel: 'text-embedding-ada-002',
      vectorProvider: 'pinecone',
      vectorConfig: {
        provider: 'pinecone',
        indexName: 'tenant-1-embeddings',
        namespace: 'default',
        apiKey: 'test-key',
        environment: 'us-west1-gcp'
      },
      maxTokens: 4000,
      temperature: 0.7,
      chunkSize: 1000,
      chunkOverlap: 200,
      maxResults: 20,
      similarityThreshold: 0.7,
      rerankingEnabled: true,
      isActive: true,
    },
  });

  const llmConfig2 = await prisma.lLMConfiguration.create({
    data: {
      name: 'OpenAI GPT-4 Configuration',
      tenantId: 'tenant-2',
      provider: 'openai',
      model: 'gpt-4',
      apiKey: 'sk-test-key-2',
      endpoint: 'https://api.openai.com/v1',
      embeddingProvider: 'openai',
      embeddingModel: 'text-embedding-ada-002',
      vectorProvider: 'pinecone',
      vectorConfig: {
        provider: 'pinecone',
        indexName: 'tenant-2-embeddings',
        namespace: 'default',
        apiKey: 'test-key-2',
        environment: 'us-west1-gcp'
      },
      maxTokens: 8000,
      temperature: 0.5,
      chunkSize: 1000,
      chunkOverlap: 200,
      maxResults: 50,
      similarityThreshold: 0.75,
      rerankingEnabled: true,
      isActive: true,
    },
  });

  console.log('📄 Creating document embeddings...');
  
  // Create sample document embeddings
  const embedding1 = await prisma.documentEmbedding.create({
    data: {
      tenantId: 'tenant-1',
      sourceType: 'confluence',
      sourceId: 'page-123456',
      sourceUrl: 'https://company.atlassian.net/wiki/spaces/API/pages/123456',
      title: 'API Documentation Guidelines',
      content: 'This document outlines the best practices for creating comprehensive API documentation...',
      contentHash: 'abc123def456',
      embedding: Array.from({length: 1536}, () => Math.random()).join(','),
      embeddingModel: 'text-embedding-ada-002',
      embeddingDimensions: 1536,
      contentType: 'page',
      metadata: {
        spaceKey: 'API',
        pageId: '123456',
        lastModified: '2024-01-15T10:00:00Z',
        labels: ['api', 'documentation', 'guidelines']
      },
      tags: ['getting-started', 'api-management', 'setup']
    },
  });

  const embedding2 = await prisma.documentEmbedding.create({
    data: {
      tenantId: 'tenant-1',
      sourceType: 'jira',
      sourceId: 'issue-API-123',
      sourceUrl: 'https://company.atlassian.net/browse/API-123',
      title: 'Implement OAuth 2.0 Authentication',
      content: 'As a developer, I want to implement OAuth 2.0 authentication to secure API endpoints...',
      contentHash: 'xyz789uvw456',
      embedding: Array.from({length: 1536}, () => Math.random()).join(','),
      embeddingModel: 'text-embedding-ada-002',
      embeddingDimensions: 1536,
      contentType: 'issue',
      metadata: {
        issueType: 'Story',
        priority: 'High',
        status: 'In Progress',
        assignee: 'john.doe@company.com'
      },
      tags: ['oauth', 'security', 'authentication']
    },
  });

  console.log('🔍 Creating semantic indexes...');
  
  // Create semantic indexes
  const index1 = await prisma.semanticIndex.create({
    data: {
      tenantId: 'tenant-1',
      indexName: 'api-documentation-index',
      indexType: 'pinecone',
      dimensions: 1536,
      metric: 'cosine',
      totalVectors: 2,
      isActive: true,
      config: {
        namespace: 'api-docs',
        replicas: 1
      }
    },
  });

  console.log('💬 Creating query sessions...');
  
  // Create sample query sessions
  const session1 = await prisma.querySession.create({
    data: {
      sessionId: 'session-demo-1',
      tenantId: 'tenant-1',
      userId: 'user-demo-1',
      originalQuery: 'How do I integrate the API Management Platform?',
      processedQuery: 'API Management Platform integration guide setup configuration',
      intent: 'technical',
      complexity: 'moderate',
      resultsCount: 2,
      responseTime: 1250.5,
      status: 'completed',
      context: {
        userAgent: 'LLM-RAG-Service/1.0.0',
        source: 'web-interface'
      },
      queryMetadata: {
        processingSteps: ['query_analysis', 'entity_extraction', 'semantic_search'],
        entitiesFound: ['API Management', 'Integration', 'Platform'],
        confidenceScore: 0.92
      }
    },
  });

  console.log('📊 Creating query results...');
  
  // Create sample query results
  const result1 = await prisma.queryResult.create({
    data: {
      sessionId: session1.id,
      source: 'confluence',
      sourceId: 'page-123456',
      sourceUrl: 'https://company.atlassian.net/wiki/spaces/API/pages/123456',
      title: 'API Documentation Guidelines',
      content: 'This document outlines the best practices for creating comprehensive API documentation...',
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
    },
  });

  console.log('📈 Creating query analytics...');
  
  // Create sample analytics data
  const analytics1 = await prisma.queryAnalytics.create({
    data: {
      tenantId: 'tenant-1',
      date: new Date('2024-08-01'),
      totalQueries: 45,
      successfulQueries: 43,
      failedQueries: 2,
      avgResponseTime: 1150.5,
      minResponseTime: 250,
      maxResponseTime: 4500,
      businessQueries: 18,
      technicalQueries: 22,
      projectQueries: 3,
      requirementsQueries: 2,
      statusQueries: 0,
      confluenceResults: 28,
      jiraResults: 35,
      kgResults: 15,
      externalResults: 2,
      avgRelevanceScore: 0.87,
      avgSemanticScore: 0.84,
      uniqueUsers: 12,
      repeatUsers: 8,
      peakHour: 14
    },
  });

  console.log('✅ Database seeding completed successfully!');
  console.log(`
📊 Seeded Data Summary:
  - 2 LLM Configurations (tenant-1, tenant-2)
  - 2 Document Embeddings (Confluence page, Jira issue)
  - 1 Semantic Index
  - 1 Query Session with user context
  - 1 Query Result with semantic scoring
  - 1 Analytics Record for performance tracking

🎯 Sample Data Includes:
  - Multi-tenant configurations
  - Realistic API documentation and Jira issues
  - Query sessions with LLM analysis
  - Search results with relevance scoring
  - Analytics data for dashboards

🚀 Ready for testing and development!
  `);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
