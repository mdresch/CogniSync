import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { PrismaClient } from '@prisma/client';
import { Document, DocumentChunk, EmbeddingMetrics, ProcessingError } from '../types';

export class EmbeddingService {
  private openai: OpenAI;
  private prisma: PrismaClient;
  private pinecone?: Pinecone;
  private pineconeIndex?: ReturnType<Pinecone['Index']>;
  private vectorProvider?: string;
  private vectorIndexName?: string;

  constructor() {
    // Configure for Azure OpenAI or regular OpenAI
    const aiProvider = process.env.AI_PROVIDER || 'openai';
    
    if (aiProvider === 'azure') {
      this.openai = new OpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY || '',
        baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT}`,
        defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview' },
        defaultHeaders: {
          'api-key': process.env.AZURE_OPENAI_API_KEY || '',
        },
      });
    } else {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || '',
      });
    }
    
    this.prisma = new PrismaClient();

    // Optional Vector DB (Pinecone) setup for upserts
    this.vectorProvider = process.env.VECTOR_DB_PROVIDER || process.env.SEMANTIC_INDEX_PROVIDER || 'pinecone';
    this.vectorIndexName = process.env.PINECONE_INDEX_NAME;
    const apiKey = process.env.PINECONE_API_KEY;

    if (this.vectorProvider === 'pinecone' && apiKey && this.vectorIndexName) {
      try {
        this.pinecone = new Pinecone({ apiKey });
        this.pineconeIndex = this.pinecone.Index(this.vectorIndexName);
      } catch (err) {
        console.warn('[VectorDB] Pinecone initialization failed in EmbeddingService:', err);
      }
    }
  }

  /**
   * Create embedding for a single document (alias for createDocumentEmbeddings)
   */
  async createDocumentEmbedding(params: {
    id: string;
    text: string;
    title?: string;
    url?: string;
    source?: string;
    metadata?: Record<string, any>;
    tenantId: string;
  }): Promise<{ id: string; vector?: number[]; metadata?: any }> {
    const result = await this.createDocumentEmbeddings(
      params.id,
      params.tenantId,
      params.text
    );

    if (result.success && result.chunks && result.chunks.length > 0) {
      return {
        id: result.chunks[0].id,
        vector: result.chunks[0].embedding,
        metadata: result.chunks[0].metadata
      };
    } else {
      throw new Error(result.error?.message || 'Failed to create embedding');
    }
  }

  /**
   * Create bulk embeddings
   */
  async createBulkEmbeddings(params: {
    documents: Array<{
      id: string;
      text: string;
      title?: string;
      url?: string;
      source?: string;
      metadata?: Record<string, any>;
    }>;
    tenantId: string;
    options?: {
      batchSize?: number;
      overwrite?: boolean;
    };
  }): Promise<{
    processed: number;
    skipped: number;
    errors: number;
    processingTime: number;
    details: {
      successful: string[];
      failed: Array<{
        id: string;
        error: string;
      }>;
    };
  }> {
    const startTime = Date.now();
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of params.documents) {
      try {
        const result = await this.createDocumentEmbeddings(
          doc.id,
          params.tenantId,
          doc.text
        );

        if (result.success) {
          successful.push(doc.id);
          processed++;
        } else {
          failed.push({
            id: doc.id,
            error: result.error?.message || 'Unknown error'
          });
          errors++;
        }
      } catch (error) {
        failed.push({
          id: doc.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        errors++;
      }
    }

    return {
      processed,
      skipped,
      errors,
      processingTime: Date.now() - startTime,
      details: {
        successful,
        failed
      }
    };
  }

  /**
   * Get a single embedding
   */
  async getEmbedding(id: string, options: { tenantId: string }): Promise<{
    id: string;
    documentId: string;
    vector: number[];
    metadata: any;
    createdAt: Date;
  } | null> {
    try {
      const chunk = await this.prisma.documentChunk.findFirst({
        where: {
          id,
          tenantId: options.tenantId
        },
        include: {
          document: true
        }
      });

      if (!chunk) {
        return null;
      }

      return {
        id: chunk.id,
        documentId: chunk.documentId,
        vector: JSON.parse(chunk.embedding),
        metadata: JSON.parse(chunk.metadata as string || '{}'),
        createdAt: chunk.createdAt
      };
    } catch (error) {
      console.error('Error getting embedding:', error);
      throw error;
    }
  }

  /**
   * List embeddings for a tenant
   */
  async listEmbeddings(params: {
    tenantId: string;
    limit?: number;
    offset?: number;
    documentId?: string;
  }): Promise<{
    embeddings: Array<{
      id: string;
      documentId: string;
      chunkIndex: number;
      metadata: any;
      createdAt: Date;
    }>;
    total: number;
    hasMore: boolean;
  }> {
    try {
      const where: any = { tenantId: params.tenantId };
      if (params.documentId) {
        where.documentId = params.documentId;
      }

      const [embeddings, total] = await Promise.all([
        this.prisma.documentChunk.findMany({
          where,
          skip: params.offset || 0,
          take: params.limit || 50,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            documentId: true,
            chunkIndex: true,
            metadata: true,
            createdAt: true
          }
        }),
        this.prisma.documentChunk.count({ where })
      ]);

      return {
        embeddings: embeddings.map(chunk => ({
          ...chunk,
          metadata: JSON.parse(chunk.metadata as string || '{}')
        })),
        total,
        hasMore: (params.offset || 0) + (params.limit || 50) < total
      };
    } catch (error) {
      console.error('Error listing embeddings:', error);
      throw error;
    }
  }

  /**
   * Update an embedding
   */
  async updateEmbedding(id: string, params: {
    tenantId: string;
    text?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    id: string;
    vector: number[];
    metadata: any;
    updatedAt: Date;
  }> {
    try {
      const chunk = await this.prisma.documentChunk.findFirst({
        where: { id, tenantId: params.tenantId }
      });

      if (!chunk) {
        throw new Error('Embedding not found');
      }

      let newEmbedding = JSON.parse(chunk.embedding);
      let newContent = chunk.content;

      if (params.text) {
        newEmbedding = await this.createEmbedding(params.text);
        newContent = params.text;
      }

      const updatedChunk = await this.prisma.documentChunk.update({
        where: { id },
        data: {
          content: newContent,
          embedding: JSON.stringify(newEmbedding),
          metadata: params.metadata ? JSON.stringify(params.metadata) : (chunk.metadata as string)
        }
      });

      return {
        id: updatedChunk.id,
        vector: newEmbedding,
        metadata: JSON.parse(updatedChunk.metadata as string || '{}'),
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('Error updating embedding:', error);
      throw error;
    }
  }

  /**
   * Delete an embedding
   */
  async deleteEmbedding(id: string, options: { tenantId: string }): Promise<{ success: boolean }> {
    try {
      await this.prisma.documentChunk.deleteMany({
        where: {
          id,
          tenantId: options.tenantId
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting embedding:', error);
      throw error;
    }
  }

  /**
   * Bulk delete embeddings
   */
  async bulkDeleteEmbeddings(params: {
    tenantId: string;
    documentIds?: string[];
    ids?: string[];
  }): Promise<{
    deletedCount: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    try {
      const where: any = { tenantId: params.tenantId };

      if (params.ids) {
        where.id = { in: params.ids };
      } else if (params.documentIds) {
        where.documentId = { in: params.documentIds };
      }

      const result = await this.prisma.documentChunk.deleteMany({ where });

      return {
        deletedCount: result.count,
        errors: []
      };
    } catch (error) {
      console.error('Error bulk deleting embeddings:', error);
      throw error;
    }
  }

  /**
   * Search for similar embeddings
   */
  async searchSimilar(params: {
    query: string;
    tenantId: string;
    limit?: number;
    threshold?: number;
  }): Promise<{
    results: Array<{
      id: string;
      documentId: string;
      content: string;
      similarity: number;
      metadata: any;
    }>;
    processingTime: number;
  }> {
    const startTime = Date.now();

    try {
      const queryEmbedding = await this.createEmbedding(params.query);
      const similarChunks = await this.findSimilarDocuments(
        queryEmbedding,
        params.tenantId,
        params.limit || 10,
        params.threshold || 0.7
      );

      return {
        results: similarChunks.map(chunk => ({
          id: chunk.id,
          documentId: chunk.documentId,
          content: chunk.content,
          similarity: chunk.similarity || 0,
          metadata: chunk.metadata
        })),
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Error searching similar embeddings:', error);
      throw error;
    }
  }

  /**
   * Create embeddings for a document
   */
  async createDocumentEmbeddings(
    documentId: string,
    tenantId: string,
    content: string
  ): Promise<{ success: boolean; chunks?: DocumentChunk[]; error?: ProcessingError }> {
    try {
      // Check if document exists
      let document = await this.prisma.document.findFirst({
        where: { id: documentId, tenantId }
      });

      // Auto-create document if it does not exist (dev-friendly behavior)
      if (!document) {
        document = await this.prisma.document.create({
          data: {
            id: documentId,
            tenantId,
            title: content.slice(0, 80) || 'Untitled Document',
            content,
            source: 'api',
            type: 'document',
            url: null,
            hasEmbeddings: false,
            metadata: undefined,
            tags: undefined,
          }
        });
      }

      // Split content into chunks
      const chunks = this.chunkContent(content);
      const documentChunks: DocumentChunk[] = [];

      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Create embedding
        const embedding = await this.createEmbedding(chunk);
        
        // Save to database
        const savedChunk = await this.prisma.documentChunk.create({
          data: {
            id: `${documentId}_chunk_${i}`,
            documentId,
            tenantId,
            content: chunk,
            embedding: JSON.stringify(embedding),
            chunkIndex: i,
            metadata: JSON.stringify({
              length: chunk.length,
              wordCount: chunk.split(' ').length,
              processingTime: Date.now()
            })
          }
        });

        // Best-effort upsert to Pinecone if configured
        try {
          if (this.pineconeIndex) {
            await this.pineconeIndex.upsert([
              {
                id: savedChunk.id,
                values: embedding,
                metadata: {
                  tenantId,
                  documentId,
                  chunkIndex: i,
                  source: document.source || 'api',
                  title: document.title || 'Untitled',
                },
              },
            ] as any);
          }
        } catch (upsertErr) {
          console.warn('[VectorDB] Pinecone upsert failed for chunk', savedChunk.id, upsertErr);
        }

        documentChunks.push({
          id: savedChunk.id,
          documentId,
          content: chunk,
          embedding,
          chunkIndex: i,
          metadata: {
            length: chunk.length,
            wordCount: chunk.split(' ').length,
            processingTime: Date.now()
          }
        });
      }

      // Update document with embedding status
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          hasEmbeddings: true,
          lastProcessed: new Date(),
          metadata: JSON.stringify({
            totalChunks: chunks.length,
            embeddingModel: process.env.AI_PROVIDER === 'azure' 
              ? (process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'azure-deployment')
              : 'text-embedding-ada-002',
            processedAt: new Date().toISOString()
          })
        }
      });

      return { success: true, chunks: documentChunks };
    } catch (error) {
      console.error('Error creating document embeddings:', error);
      return {
        success: false,
        error: {
          type: 'processing',
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'EMBEDDING_ERROR'
        }
      };
    }
  }

  /**
   * Create embedding for a single text
   */
  async createEmbedding(text: string): Promise<number[]> {
    try {
      const model = process.env.AI_PROVIDER === 'azure' 
        ? process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!
        : 'text-embedding-ada-002';
        
      const response = await this.openai.embeddings.create({
        model: model,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error creating embedding:', error);
      throw error;
    }
  }

  /**
   * Find similar documents using embeddings
   */
  async findSimilarDocuments(
    queryEmbedding: number[],
    tenantId: string,
    limit: number = 10,
    threshold: number = 0.8
  ): Promise<DocumentChunk[]> {
    try {
      // Get all document chunks for the tenant
      const chunks = await this.prisma.documentChunk.findMany({
        where: { tenantId },
        include: {
          document: true
        }
      });

      // Calculate similarities
      const similarities = chunks.map(chunk => {
        const chunkEmbedding = JSON.parse(chunk.embedding);
        const similarity = this.cosineSimilarity(queryEmbedding, chunkEmbedding);
        
        return {
          chunk,
          similarity
        };
      });

      // Filter and sort by similarity
      return similarities
        .filter(item => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(item => ({
          id: item.chunk.id,
          documentId: item.chunk.documentId,
          content: item.chunk.content,
          embedding: JSON.parse(item.chunk.embedding),
          chunkIndex: item.chunk.chunkIndex,
          metadata: JSON.parse((item.chunk.metadata as string) || '{}'),
          similarity: item.similarity
        }));
    } catch (error) {
      console.error('Error finding similar documents:', error);
      throw error;
    }
  }

  /**
   * Get embedding metrics for a tenant
   */
  async getEmbeddingMetrics(tenantId: string): Promise<EmbeddingMetrics> {
    try {
      const totalDocuments = await this.prisma.document.count({
        where: { tenantId }
      });

      const embeddedDocuments = await this.prisma.document.count({
        where: { tenantId, hasEmbeddings: true }
      });

      const totalChunks = await this.prisma.documentChunk.count({
        where: { tenantId }
      });

      const averageChunksPerDoc = embeddedDocuments > 0 
        ? Math.round(totalChunks / embeddedDocuments) 
        : 0;

      return {
        totalDocuments,
        embeddedDocuments,
        totalChunks,
        averageChunksPerDocument: averageChunksPerDoc,
        embeddingCoverage: totalDocuments > 0 
          ? Math.round((embeddedDocuments / totalDocuments) * 100) 
          : 0
      };
    } catch (error) {
      console.error('Error getting embedding metrics:', error);
      throw error;
    }
  }

  /**
   * Split content into chunks
   */
  private chunkContent(content: string, maxChunkSize: number = 1000): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (currentChunk.length + trimmedSentence.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = trimmedSentence;
        } else {
          // Sentence is too long, split it
          chunks.push(trimmedSentence.substring(0, maxChunkSize));
          currentChunk = trimmedSentence.substring(maxChunkSize);
        }
      } else {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Clean up resources
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
