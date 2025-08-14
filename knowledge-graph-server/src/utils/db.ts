// Neo4j database connection logic will be implemented here
import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

const {
	NEO4J_URI,
	NEO4J_USERNAME,
	NEO4J_PASSWORD,
} = process.env;

if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
	throw new Error('Missing Neo4j connection details in .env file');
}

const driver = neo4j.driver(
	NEO4J_URI,
	neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
);

export async function connectToDatabase() {
	try {
		await driver.verifyConnectivity();
		logger.info('Successfully connected to Neo4j database.');
	} catch (error) {
		logger.error(error, 'Failed to connect to Neo4j database.');
		process.exit(1);
	}
}

export default driver;
