// atlassian-sync-service/src/server.e2e-spec.ts

import request from 'supertest';
import app from './server'; // Import your Express app
import { AtlassianSyncService } from './services/atlassian-sync.service';
import { PrismaClient } from '@prisma/client';

// Mock the entire service to isolate the server/route logic
jest.mock('./atlassian-sync.service');
const MockAtlassianSyncService = AtlassianSyncService as jest.MockedClass<typeof AtlassianSyncService>;

// Mock Prisma client for endpoints that use it directly (like the retry endpoint)
const prismaMock = {
  syncEvent: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => prismaMock),
  ProcessingStatus: { // Provide the enum for the retry endpoint test
      DEAD_LETTER: 'DEAD_LETTER',
      PENDING: 'PENDING'
  }
}));

describe('Server E2E Tests', () => {

  beforeEach(() => {
    // Clear all mocks before each test
    MockAtlassianSyncService.mockClear();
    prismaMock.syncEvent.findUnique.mockClear();
    prismaMock.syncEvent.update.mockClear();
  });

  // Test 1: Test the webhook enqueueing endpoint
  test('POST /webhooks/:configId should return 202 and enqueue the event', async () => {
    const mockEnqueue = jest.fn().mockResolvedValue({});
    MockAtlassianSyncService.prototype.enqueueWebhookEvent = mockEnqueue;

    const response = await request(app)
      .post('/webhooks/config-123')
      .set('Authorization', 'Bearer your-api-key-1')
      .send({ data: 'some-webhook-data' });

    expect(response.status).toBe(202);
    expect(response.body.message).toBe('Event accepted for processing.');
    // Verify our service method was called correctly
    expect(mockEnqueue).toHaveBeenCalledWith('config-123', { data: 'some-webhook-data' });
  });

  // Test 2: Test the manual retry endpoint
  test('POST /api/events/:id/retry should re-queue a dead-letter event', async () => {
    // Arrange: Mock a DLQ event found in the database
    const deadLetterEvent = { id: 'event-dlq-1', processingStatus: 'DEAD_LETTER' };
    prismaMock.syncEvent.findUnique.mockResolvedValue(deadLetterEvent as any);
    prismaMock.syncEvent.update.mockResolvedValue({} as any);

    const response = await request(app)
      .post('/api/events/event-dlq-1/retry')
      .set('Authorization', 'Bearer your-api-key-1')
      .send();

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Event has been re-queued for processing.');
    
    // Verify the status was updated back to PENDING
    expect(prismaMock.syncEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event-dlq-1' },
        data: expect.objectContaining({ processingStatus: 'PENDING' }),
      }),
    );
  });

  // Test 3: Test health check endpoint
  test('GET /health should return a healthy status', async () => {
    const response = await request(app)
      .get('/health')
      .set('Authorization', 'Bearer your-api-key-1');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });
});
