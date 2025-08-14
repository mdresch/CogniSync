// atlassian-sync-service/src/services/message-bus.service.ts
import { ServiceBusClient } from '@azure/service-bus';
import dotenv from 'dotenv';
import { getLogger } from '../logger';

dotenv.config();

class MessageBusService {
  private logger;
  private serviceBusClient: ServiceBusClient;
  private sender;

  constructor() {
    const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING!;
    const topicName = process.env.SERVICE_BUS_TOPIC_NAME!;

    if (!connectionString || !topicName) {
      throw new Error('Missing Azure Service Bus connection details for producer.');
    }

    this.serviceBusClient = new ServiceBusClient(connectionString);
    this.sender = this.serviceBusClient.createSender(topicName);
      this.logger = getLogger('MessageBusService');
      this.logger.info('MessageBusService initialized as a producer.');
  }

  /**
   * Sends a single message to the configured Service Bus topic.
   * @param message The message object to send.
   */
  async sendMessage(message: { body: any, messageId?: string }) {
    try {
        this.logger.info({ messageType: message.body.messageType }, 'Publishing message to Service Bus.');
      await this.sender.sendMessages(message);
    } catch (err) {
        this.logger.error(err, 'Error publishing message to Service Bus.');
      throw err; // Re-throw the error to let the caller handle it
    }
  }

  async close() {
    await this.sender.close();
    await this.serviceBusClient.close();
  }
}

// Export a singleton instance
export const messageBusService = new MessageBusService();
