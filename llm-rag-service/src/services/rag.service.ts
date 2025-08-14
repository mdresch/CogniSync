import { WebSocket } from 'ws';
import { logger } from '../utils/logger';
import { OpenAIService } from './openai.service';
import { PineconeService } from './pinecone.service';

export class RAGService {
	private openaiService: OpenAIService;
	private pineconeService: PineconeService;

	constructor() {
		this.openaiService = new OpenAIService();
		this.pineconeService = new PineconeService();
		logger.info('RAGService initialized with dependencies.');
	}

	/**
	 * Processes a query and streams the response back to the client via WebSocket.
	 * @param query The user's query string.
	 * @param ws The WebSocket connection to stream the response to.
	 */
	public async processQueryStream(query: string, ws: WebSocket) {
		try {
			logger.info({ query }, 'Executing FINAL RAG pipeline...');

			// Step 1: Create an embedding from the user's query
			const queryEmbedding = await this.openaiService.createEmbedding(query);

			// Step 2: Query Pinecone to retrieve relevant document chunks
			const retrievedDocs = await this.pineconeService.query(queryEmbedding);
			logger.info({ count: retrievedDocs.length }, 'Retrieved documents from Pinecone.');

			// Step 3: Augment - Construct the final prompt for the LLM
			const systemPrompt = "You are an expert AI assistant. Answer the user's question based ONLY on the following documents. Cite the sources you use using the format [Source: document_id]. Do not use any outside knowledge.";
			const context = retrievedDocs
				.map(doc => `Source: ${doc.metadata?.source}\nContent: ${doc.metadata?.text}`)
				.join('\n\n---\n\n');
			const userPrompt = `CONTEXT DOCUMENTS:\n${context}\n\nUSER QUESTION:\n${query}`;

			// Step 4: Generate - Get a streaming response from the LLM
			const stream = await this.openaiService.getStreamingCompletion(systemPrompt, userPrompt);

			// Step 5: Stream the response back to the client
			for await (const chunk of stream) {
				const content = chunk.choices[0]?.delta?.content || '';
				if (ws.readyState === WebSocket.OPEN && content) {
					ws.send(JSON.stringify({ type: 'chunk', payload: content }));
				}
			}

			// Finally, send the list of sources used for citation
			const sources = retrievedDocs.map(doc => doc.metadata?.source);
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: 'final', payload: { sources }}));
			}

			logger.info({ query }, 'RAG pipeline finished successfully.');

		} catch (error) {
			logger.error(error, 'Error in RAG pipeline');
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: 'error', message: 'An error occurred during generation.' }));
			}
		}
	}
}
