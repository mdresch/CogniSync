import { SyncEvent } from '@prisma/client';
export declare class AtlassianSyncService {
    private workerInterval;
    constructor();
    enqueueWebhookEvent(configId: string, payload: any): Promise<SyncEvent>;
    startProcessing(): void;
    stopProcessing(): void;
    private processPendingEvents;
    private leaseEvents;
    private processSingleEvent;
    private publishKnowledgeGraphEvents;
    private markEventAsCompleted;
    private handleProcessingFailure;
}
//# sourceMappingURL=atlassian-sync.service.d.ts.map