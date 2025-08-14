// src/services/indexing.service.ts
import { ServiceBusClient, ServiceBusReceiver, ServiceBusReceivedMessage } from '@azure/service-bus';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import { OpenAIService } from './openai.service';
import { PineconeService } from './pinecone.service';

dotenv.config();

export class IndexingService {
  private serviceBusClient: ServiceBusClient;
  private receiver: ServiceBusReceiver;
  private openaiService: OpenAIService;
  private pineconeService: PineconeService;

  constructor() {
    const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING!;
    const topicName = process.env.SERVICE_BUS_TOPIC_NAME!;
    // Use a DIFFERENT subscription name to receive a copy of all messages
    const subscriptionName = process.env.SERVICE_BUS_RAG_SUBSCRIPTION_NAME!;

    if (!connectionString || !topicName || !subscriptionName) {
      throw new Error('Missing Azure Service Bus details for RAG indexing.');
    }

    this.serviceBusClient = new ServiceBusClient(connectionString);
    this.receiver = this.serviceBusClient.createReceiver(topicName, subscriptionName);
    this.openaiService = new OpenAIService();
    this.pineconeService = new PineconeService();

    logger.info('IndexingService initialized.');
  }

  public start() {
    logger.info('Starting RAG indexing worker...');
    this.receiver.subscribe({
      processMessage: this.processMessage.bind(this),
  processError: async (args: any) => logger.error(args, 'Error from Service Bus in IndexingService'),
    });
  }

  public async stop() {
    logger.info('Stopping RAG indexing worker...');
    await this.receiver.close();
    await this.serviceBusClient.close();
  }

  private async processMessage(message: ServiceBusReceivedMessage) {
    try {
      const { messageType, payload } = message.body;

      // We only care about new entities that could be documents
      if (messageType !== 'CREATE_ENTITY' || !payload.metadata) {
        await this.receiver.completeMessage(message); // Acknowledge and ignore irrelevant messages
        return;
      }
      
      const textToEmbed = payload.name + ' ' + payload.metadata; // Combine title and content
      logger.info({ entityId: payload.id }, 'Processing entity for indexing.');

      // 1. Create embedding
      const embedding = await this.openaiService.createEmbedding(textToEmbed);

      // 2. Prepare vector for Pinecone
      const vector = {
        id: `doc-${payload.id}-chunk-0`, // Create a unique ID for the vector
        values: embedding,
        metadata: {
          source: payload.id,
          type: payload.type,
          text: textToEmbed,
        },
      };

      // 3. Upsert into Pinecone
      await this.pineconeService.upsert([vector]);

      logger.info({ vectorId: vector.id }, 'Successfully indexed and upserted vector.');

      await this.receiver.completeMessage(message);
    } catch (error: any) {
      logger.error({ messageId: message.messageId, error: error.message }, 'Failed to process indexing message.');
      await this.receiver.deadLetterMessage(message, {
        deadLetterReason: 'IndexingError',
        deadLetterErrorDescription: error?.message || 'Failed to process indexing message.'
      });
    }
  }
}
