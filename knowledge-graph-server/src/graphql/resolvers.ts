
// src/graphql/resolvers.ts
import { IResolvers } from '@graphql-tools/utils';
import { GraphService } from '../services/graph.service';
import { logger } from '../utils/logger'; // Import the logger

const graphService = new GraphService();

export const resolvers: IResolvers = {
	Query: {
		getEntityById: async (_: any, { id }: { id: string }) => {
			// Log the incoming query and arguments
			logger.info({ query: 'getEntityById', id }, 'Resolver received getEntityById query.');
			try {
				const result = await graphService.getEntityById(id);
				logger.info({ query: 'getEntityById', result }, 'Successfully executed getEntityById.');
				return result;
			} catch (error) {
				logger.error({ query: 'getEntityById', error }, 'Error in getEntityById resolver.');
				// Re-throw the error to let GraphQL client know something went wrong
				throw error;
			}
		},
	},
	Mutation: {
		createEntity: async (_: any, { input }: { input: any }) => {
			// Log the incoming mutation and arguments
			logger.info({ mutation: 'createEntity', input }, 'Resolver received createEntity mutation.');
			try {
				const result = await graphService.createEntity(input);
				logger.info({ mutation: 'createEntity', result }, 'Successfully executed createEntity.');
				return result;
			} catch (error) {
				logger.error({ mutation: 'createEntity', error }, 'Error in createEntity resolver.');
				throw error;
			}
		},
		linkEntities: async (_: any, { input }: { input: any }) => {
			// Log the incoming mutation and arguments
			logger.info({ mutation: 'linkEntities', input }, 'Resolver received linkEntities mutation.');
			try {
				const result = await graphService.linkEntities(input);
				logger.info({ mutation: 'linkEntities', result }, 'Successfully executed linkEntities.');
				return result;
			} catch (error) {
				logger.error({ mutation: 'linkEntities', error }, 'Error in linkEntities resolver.');
				throw error;
			}
		},
	},
};
