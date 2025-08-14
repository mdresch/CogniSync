import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../utils/logger';

export function setupWebSocket(server: any) {
	const wss = new WebSocketServer({ server });

	wss.on('connection', (ws: WebSocket) => {
		logger.info('Client connected to WebSocket server.');

		// Send a welcome message to the newly connected client
		ws.send(JSON.stringify({
			type: 'connection_ack',
			message: 'Successfully connected to LLM-RAG Service.'
		}));

		ws.on('message', (message: string) => {
			logger.info({ receivedMessage: message.toString() }, 'Received message from client.');

			// For this minimal setup, we just echo the message back
			// In the real app, this is where we would trigger the RAG pipeline
			try {
				const parsedMessage = JSON.parse(message.toString());
				ws.send(JSON.stringify({
					type: 'echo',
					payload: parsedMessage.query
				}));
			} catch (error) {
				ws.send(JSON.stringify({
					type: 'error',
					message: 'Invalid JSON format.'
				}));
			}
		});

		ws.on('close', () => {
			logger.info('Client disconnected.');
		});

		ws.on('error', (error) => {
			logger.error(error, 'WebSocket error occurred.');
		});
	});

	logger.info('WebSocket server is set up and listening for connections.');
	return wss;
}
