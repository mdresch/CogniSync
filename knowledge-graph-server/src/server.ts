// Main server entry point will be implemented here
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { readFileSync } = require('fs');
const { join } = require('path');
const { resolvers } = require('./graphql/resolvers');
const { connectToDatabase } = require('./utils/db');
const { logger } = require('./utils/logger');
const { IngestionService } = require('./services/ingestion.service');

const PORT = process.env.PORT || 4001;

async function startServer() {
	const app = express();

	// Load GraphQL schema
	const typeDefs = readFileSync(join(__dirname, './graphql/schema.graphql'), 'utf-8');

		const server = new ApolloServer({
			typeDefs,
			resolvers,
			context: ({ req }: { req: any }) => {
				// In the future, we can add auth context, etc. here
				return {};
			},
		});

	// Instantiate and start the ingestion worker
			let ingestionService: any;
	try {
		ingestionService = new IngestionService();
		ingestionService.start();
		logger.info('👂 Ingestion worker is listening to Azure Service Bus.');
	} catch (err) {
		logger.error('Failed to start IngestionService:', err);
	}

	await server.start();
	server.applyMiddleware({ app });

	// Connect to the database
	await connectToDatabase();

	app.listen(PORT, () => {
		logger.info(`🚀 Knowledge Graph Service ready at http://localhost:${PORT}${server.graphqlPath}`);
	});

	// Handle graceful shutdown
	process.on('SIGTERM', async () => {
		if (ingestionService) await ingestionService.stop();
		process.exit(0);
	});
	process.on('SIGINT', async () => {
		if (ingestionService) await ingestionService.stop();
		process.exit(0);
	});
}

startServer();
