// atlassian-sync-service/src/atlassian-sync.service.spec.ts

// We use jest-mock-extended to create a deep mock of the PrismaClient
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, ProcessingStatus, SyncConfiguration } from '@prisma/client';

// We explicitly mock each dependency with a factory function. This is the most robust pattern.
jest.mock('../logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../metrics', () => ({
  getMetrics: jest.fn(() => ({
    incrementEventsReceived: jest.fn(),
    incrementEventsSucceeded: jest.fn(),
    incrementEventsRetried: jest.fn(),
    incrementEventsDlq: jest.fn(),
  })),
}));

// We mock the PrismaClient at the module level BEFORE importing the service
const prismaMock = mockDeep<PrismaClient>();
jest.mock('@prisma/client', () => ({
  __esModule: true,
  PrismaClient: jest.fn(() => prismaMock),
  ProcessingStatus: { // Provide the real enum values for type safety
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    RETRYING: 'RETRYING',
    DEAD_LETTER: 'DEAD_LETTER',
    COMPLETED: 'COMPLETED',
  },
}));

// NOW we can safely import the service. It will receive the mocks above.
import { AtlassianSyncService } from './services/atlassian-sync.service';

describe('AtlassianSyncService', () => {
  let service: AtlassianSyncService;

  // Mock data can be defined once
  const mockConfig: SyncConfiguration = {
    id: 'config-123', name: 'Test Config', tenantId: 'default', source: 'jira',
    enabled: true, webhookSecret: 'secret', webhookUrl: null, kgServiceUrl: 'http://mock-kg',
    kgApiKey: 'kg-key', mappingRules: {}, filters: null, batchSize: 10,
    retryLimit: 2, retryDelay: 100,
    createdAt: new Date(), updatedAt: new Date(),
  };

  const mockWebhookPayload = {
    webhookEvent: 'jira:issue_created',
    issue: { id: 'issue-456', fields: { summary: 'Test Issue' } },
  };

  beforeEach(() => {
    // Clear all mock history before each test to prevent cross-contamination
    jest.clearAllMocks();
    // Instantiate the service. It will automatically use the mocked PrismaClient.
    service = new AtlassianSyncService();
  });

  test('should be instantiated correctly', () => {
    // A simple test to ensure the service constructor runs without error
    expect(service).toBeInstanceOf(AtlassianSyncService);
  });

  test('should enqueue a webhook event successfully', async () => {
    prismaMock.syncEvent.create.mockResolvedValueOnce({} as any);
    await service.enqueueWebhookEvent(mockConfig.id, mockWebhookPayload);
    expect(prismaMock.syncEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStatus: ProcessingStatus.PENDING,
      }),
    );
  });
  
  test('should place an event in RETRYING status after a failure', async () => {
    const eventToProcess = { id: 'event-2', retryCount: 0, configId: mockConfig.id } as any;
    prismaMock.syncConfiguration.findUnique.mockResolvedValue(mockConfig);
    prismaMock.entityMapping.findUnique.mockRejectedValue(new Error("KG is down"));

    await (service as any).processSingleEvent(eventToProcess);

    expect(prismaMock.syncEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event-2' },
        data: expect.objectContaining({
          processingStatus: ProcessingStatus.RETRYING,
        }),
      }),
    );
  });
  
  test('should move an event to DEAD_LETTER status after exceeding retry limit', async () => {
    const eventToProcess = { id: 'event-3', retryCount: mockConfig.retryLimit, configId: mockConfig.id } as any;
    prismaMock.syncConfiguration.findUnique.mockResolvedValue(mockConfig);
    prismaMock.entityMapping.findUnique.mockRejectedValue(new Error("Permanent failure"));
    
    await (service as any).processSingleEvent(eventToProcess);

    expect(prismaMock.syncEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event-3' },
        data: expect.objectContaining({
          processingStatus: ProcessingStatus.DEAD_LETTER,
        }),
      }),
    );
  });
  
  test('should create a new entity mapping if one does not exist and complete the event', async () => {
    const eventToProcess = { id: 'event-4', externalId: 'new-issue-789', configId: mockConfig.id, source: 'jira', tenantId: 'default', type: 'jira:issue_created', payload: {} } as any;
    prismaMock.syncConfiguration.findUnique.mockResolvedValue(mockConfig);
    prismaMock.entityMapping.findUnique.mockResolvedValue(null);
    prismaMock.entityMapping.create.mockResolvedValue({} as any);

    await (service as any).processSingleEvent(eventToProcess);

    expect(prismaMock.entityMapping.create).toHaveBeenCalled();
    expect(prismaMock.syncEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
            where: { id: 'event-4' },
            data: expect.objectContaining({ processingStatus: ProcessingStatus.COMPLETED })
        })
    );
  });
});
