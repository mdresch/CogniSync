"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const supertest_1 = tslib_1.__importDefault(require("supertest"));
const server_1 = tslib_1.__importDefault(require("./server"));
const atlassian_sync_service_1 = require("./services/atlassian-sync.service");
jest.mock('./atlassian-sync.service');
const MockAtlassianSyncService = atlassian_sync_service_1.AtlassianSyncService;
const prismaMock = {
    syncEvent: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
};
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn(() => prismaMock),
    ProcessingStatus: {
        DEAD_LETTER: 'DEAD_LETTER',
        PENDING: 'PENDING'
    }
}));
describe('Server E2E Tests', () => {
    beforeEach(() => {
        MockAtlassianSyncService.mockClear();
        prismaMock.syncEvent.findUnique.mockClear();
        prismaMock.syncEvent.update.mockClear();
    });
    test('POST /webhooks/:configId should return 202 and enqueue the event', async () => {
        const mockEnqueue = jest.fn().mockResolvedValue({});
        MockAtlassianSyncService.prototype.enqueueWebhookEvent = mockEnqueue;
        const response = await (0, supertest_1.default)(server_1.default)
            .post('/webhooks/config-123')
            .send({ data: 'some-webhook-data' });
        expect(response.status).toBe(202);
        expect(response.body.message).toBe('Event accepted for processing.');
        expect(mockEnqueue).toHaveBeenCalledWith('config-123', { data: 'some-webhook-data' });
    });
    test('POST /api/events/:id/retry should re-queue a dead-letter event', async () => {
        const deadLetterEvent = { id: 'event-dlq-1', processingStatus: 'DEAD_LETTER' };
        prismaMock.syncEvent.findUnique.mockResolvedValue(deadLetterEvent);
        prismaMock.syncEvent.update.mockResolvedValue({});
        const response = await (0, supertest_1.default)(server_1.default)
            .post('/api/events/event-dlq-1/retry')
            .send();
        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Event has been re-queued for processing.');
        expect(prismaMock.syncEvent.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'event-dlq-1' },
            data: expect.objectContaining({ processingStatus: 'PENDING' }),
        }));
    });
    test('GET /health should return a healthy status', async () => {
        const response = await (0, supertest_1.default)(server_1.default).get('/health');
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
    });
});
//# sourceMappingURL=server.e2e-spec.js.map