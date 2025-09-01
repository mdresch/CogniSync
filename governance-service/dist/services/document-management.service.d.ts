import { PrismaClient, Document, DocumentVersion, DocumentApproval, DocumentStatus, ApprovalStatus } from '@prisma/client';
import { NotificationService } from './notification.service';
export interface CreateDocumentRequest {
    title: string;
    description?: string;
    content?: string;
    type: string;
    category?: string;
    createdBy: string;
    tenantId: string;
    tags?: string[];
    approvers?: string[];
}
export interface UpdateDocumentRequest {
    title?: string;
    description?: string;
    content?: string;
    category?: string;
    tags?: string[];
    changes?: string;
}
export interface DocumentSearchFilters {
    type?: string;
    category?: string;
    status?: DocumentStatus;
    tags?: string[];
    search?: string;
    createdBy?: string;
    dateFrom?: Date;
    dateTo?: Date;
}
export interface ApprovalRequest {
    documentId: string;
    approverId: string;
    status: ApprovalStatus;
    comments?: string;
}
export declare class DocumentManagementService {
    private prisma;
    private notificationService;
    private uploadPath;
    constructor(prisma: PrismaClient, notificationService: NotificationService);
    createDocument(documentData: CreateDocumentRequest, file?: Express.Multer.File): Promise<Document>;
    updateDocument(documentId: string, updateData: UpdateDocumentRequest, userId: string, tenantId: string, file?: Express.Multer.File): Promise<Document>;
    deleteDocument(documentId: string, tenantId: string): Promise<void>;
    getDocument(documentId: string, tenantId: string): Promise<Document | null>;
    getDocuments(tenantId: string, filters?: DocumentSearchFilters, page?: number, limit?: number): Promise<{
        documents: Document[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    createDocumentVersion(documentId: string, versionData: {
        version: string;
        content?: string;
        filePath?: string;
        changes?: string;
        tenantId: string;
    }): Promise<DocumentVersion>;
    getDocumentVersions(documentId: string, tenantId: string): Promise<DocumentVersion[]>;
    getDocumentVersion(documentId: string, version: string, tenantId: string): Promise<DocumentVersion | null>;
    getLatestDocumentVersion(documentId: string): Promise<DocumentVersion | null>;
    setupDocumentApprovals(documentId: string, approverIds: string[], tenantId: string): Promise<void>;
    processApproval(approvalData: ApprovalRequest, tenantId: string): Promise<DocumentApproval>;
    getDocumentApprovals(documentId: string, tenantId: string): Promise<DocumentApproval[]>;
    getPendingApprovals(userId: string, tenantId: string): Promise<DocumentApproval[]>;
    publishDocument(documentId: string, tenantId: string): Promise<Document>;
    archiveDocument(documentId: string, tenantId: string): Promise<Document>;
    setDocumentExpiry(documentId: string, expiresAt: Date, tenantId: string): Promise<Document>;
    checkExpiredDocuments(): Promise<void>;
    private addTagsToDocument;
    private updateDocumentTags;
    private incrementVersion;
    private ensureUploadDirectory;
    getDocumentFile(documentId: string, tenantId: string): Promise<{
        filePath: string;
        mimeType: string;
        fileName: string;
    } | null>;
}
//# sourceMappingURL=document-management.service.d.ts.map