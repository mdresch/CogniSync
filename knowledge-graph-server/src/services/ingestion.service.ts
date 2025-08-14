// src/services/ingestion.service.ts
import { ServiceBusClient, ServiceBusReceiver, ServiceBusReceivedMessage } from '@azure/service-bus';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import { GraphService } from './graph.service';

dotenv.config();

export class IngestionService {
  private serviceBusClient: ServiceBusClient;
  private receiver: ServiceBusReceiver;
  private graphService: GraphService;

  constructor() {
    const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
    const topicName = process.env.SERVICE_BUS_TOPIC_NAME;
    const subscriptionName = process.env.SERVICE_BUS_SUBSCRIPTION_NAME;

    if (!connectionString || !topicName || !subscriptionName) {
      logger.error('Missing Azure Service Bus connection details in .env file');
      throw new Error('Missing Azure Service Bus connection details.');
    }

    this.serviceBusClient = new ServiceBusClient(connectionString);
    this.receiver = this.serviceBusClient.createReceiver(topicName, subscriptionName);
    this.graphService = new GraphService();

    logger.info('IngestionService initialized.');
  }

  /**
   * Starts the worker to listen for messages from the Service Bus subscription.
   */
  public start() {
    logger.info('Starting ingestion worker...');
    this.receiver.subscribe({
      processMessage: this.processMessage.bind(this),
      processError: this.processError.bind(this),
    });
  }

  /**
   * Gracefully stops the ingestion worker.
   */
  public async stop() {
    logger.info('Stopping ingestion worker...');
    await this.receiver.close();
    await this.serviceBusClient.close();
  }

  /**
   * The core handler for processing a single message from the queue.
   */
  private async processMessage(message: ServiceBusReceivedMessage, context: any) {
    logger.info({ messageId: message.messageId }, 'Received message from Service Bus.');

    try {
      // The message body is the 'input' for our GraphQL mutations
      const body = message.body;

      // A 'messageType' field tells us which operation to perform
      switch (body.messageType) {
        case 'CREATE_ENTITY':
          await this.graphService.createEntity(body.payload);
          break;
        case 'LINK_ENTITIES':
          await this.graphService.linkEntities(body.payload);
          break;
        default:
          throw new Error(`Unknown messageType: ${body.messageType}`);
      }

      // If successful, complete the message to remove it from the queue
      await this.receiver.completeMessage(message);
      logger.info({ messageId: message.messageId, type: body.messageType }, 'Message processed and completed.');

    } catch (error: any) {
      logger.error({ messageId: message.messageId, error: error.message }, 'Failed to process message. Moving to dead-letter queue.');
      // If any error occurs, move the message to the DLQ for manual inspection
      await this.receiver.deadLetterMessage(message, {
        deadLetterReason: 'ProcessingError',
        deadLetterErrorDescription: error.message
      });
    }
  }

  /**
   * The handler for logging any errors from the Service Bus client itself.
   */
  private async processError(args: any) {
    logger.error(args, 'Error received from Azure Service Bus.');
  }
}
