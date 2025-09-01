"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// send-test-message.ts
const { ServiceBusClient } = require('@azure/service-bus');
const dotenv = require('dotenv');
dotenv.config();
async function main() {
    const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
    const topicName = process.env.SERVICE_BUS_TOPIC_NAME;
    if (!connectionString || !topicName) {
        throw new Error('Service Bus connection details not found in .env file.');
    }
    const serviceBusClient = new ServiceBusClient(connectionString);
    const sender = serviceBusClient.createSender(topicName);
    console.log('Producer script starting...');
    // --- Message to create a new Entity ---
    const createEntityMessage = {
        body: {
            messageType: 'CREATE_ENTITY',
            payload: {
                id: 'CONF-456',
                type: 'Page',
                name: 'Project Alpha Requirements',
                metadata: '{"author": "user-007", "space": "PROJALPHA"}'
            }
        },
        messageId: `msg-${Date.now()}`
    };
    // --- Message to link two existing Entities ---
    const linkEntitiesMessage = {
        body: {
            messageType: 'LINK_ENTITIES',
            payload: {
                sourceEntityId: 'CONF-456',
                targetEntityId: 'JIRA-123', // Assuming JIRA-123 was created via the API
                relationshipType: 'MENTIONS'
            }
        },
        messageId: `msg-${Date.now() + 1}`
    };
    try {
        console.log(`Sending message: ${createEntityMessage.body.messageType}`);
        await sender.sendMessages(createEntityMessage);
        console.log(`Sending message: ${linkEntitiesMessage.body.messageType}`);
        await sender.sendMessages(linkEntitiesMessage);
        console.log('Messages sent successfully!');
    }
    finally {
        await sender.close();
        await serviceBusClient.close();
        console.log('Producer script finished.');
    }
}
main().catch((err) => {
    console.error("Error occurred: ", err);
    process.exit(1);
});
//# sourceMappingURL=send-test-message.js.map