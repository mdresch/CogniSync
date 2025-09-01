"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageBusService = void 0;
const tslib_1 = require("tslib");
const service_bus_1 = require("@azure/service-bus");
const dotenv_1 = tslib_1.__importDefault(require("dotenv"));
const logger_1 = require("../logger");
dotenv_1.default.config();
class MessageBusService {
    constructor() {
        const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
        const topicName = process.env.SERVICE_BUS_TOPIC_NAME;
        if (!connectionString || !topicName) {
            throw new Error('Missing Azure Service Bus connection details for producer.');
        }
        this.serviceBusClient = new service_bus_1.ServiceBusClient(connectionString);
        this.sender = this.serviceBusClient.createSender(topicName);
        this.logger = (0, logger_1.getLogger)('MessageBusService');
        this.logger.info('MessageBusService initialized as a producer.');
    }
    async sendMessage(message) {
        try {
            this.logger.info({ messageType: message.body.messageType }, 'Publishing message to Service Bus.');
            await this.sender.sendMessages(message);
        }
        catch (err) {
            this.logger.error(err, 'Error publishing message to Service Bus.');
            throw err;
        }
    }
    async close() {
        await this.sender.close();
        await this.serviceBusClient.close();
    }
}
exports.messageBusService = new MessageBusService();
//# sourceMappingURL=message-bus.service.js.map