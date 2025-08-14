import { Pinecone } from '@pinecone-database/pinecone';
import { logger } from '../utils/logger';

// Logic for interacting with Pinecone Vector DB
export class PineconeService {
  private pinecone: Pinecone;

  constructor() {
    this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!,
    });
    logger.info('PineconeService initialized.');
  }

  /**
   * Upserts (inserts or updates) vectors into the Pinecone index.
   * @param vectors An array of vectors to upsert.
   */
  async upsert(vectors: any[]) {
    if (vectors.length === 0) return;
    const indexName = process.env.PINECONE_INDEX_NAME || 'llm-rag-embeddings';
    const index = this.pinecone.index(indexName).namespace('default');
    logger.info({ count: vectors.length }, 'Upserting vectors into Pinecone...');
    await index.upsert(vectors);
    logger.info('Upsert complete.');
  }

  async query(embedding: number[], topK: number = 5) {
    const indexName = process.env.PINECONE_INDEX_NAME || 'llm-rag-embeddings';
    const index = this.pinecone.index(indexName).namespace('default');
    logger.info('Querying Pinecone for top matching vectors...');
    const queryResponse = await index.query({
      topK,
      vector: embedding,
      includeMetadata: true,
    });
    return queryResponse.matches || [];
  }
}
