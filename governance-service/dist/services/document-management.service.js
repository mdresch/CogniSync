"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentManagementService = void 0;
const client_1 = require("@prisma/client");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
class DocumentManagementService {
    constructor(prisma, notificationService) {
        this.prisma = prisma;
        this.notificationService = notificationService;
        this.uploadPath = process.env.DOCUMENT_UPLOAD_PATH || './uploads/documents';
        this.ensureUploadDirectory();
    }
    // A063: Document Management
    async createDocument(documentData, file) {
        try {
            let filePath;
            let fileSize;
            let mimeType;
            // Handle file upload
            if (file) {
                const fileExtension = path_1.default.extname(file.originalname);
                const fileName = `${(0, uuid_1.v4)()}${fileExtension}`;
                filePath = path_1.default.join(this.uploadPath, fileName);
                await fs_1.promises.writeFile(filePath, file.buffer);
                fileSize = file.size;
                mimeType = file.mimetype;
            }
            // Create document
            const document = await this.prisma.document.create({
                data: {
                    title: documentData.title,
                    description: documentData.description,
                    content: documentData.content,
                    type: documentData.type,
                    category: documentData.category,
                    filePath,
                    fileSize,
                    mimeType,
                    createdBy: documentData.createdBy,
                    tenantId: documentData.tenantId,
                },
            });
            // Add tags
            if (documentData.tags && documentData.tags.length > 0) {
                await this.addTagsToDocument(document.id, documentData.tags, documentData.tenantId);
            }
            // Create initial version
            await this.createDocumentVersion(document.id, {
                version: '1.0',
                content: documentData.content,
                filePath,
                changes: 'Initial version',
                tenantId: documentData.tenantId,
            });
            // Set up approvals if approvers specified
            if (documentData.approvers && documentData.approvers.length > 0) {
                await this.setupDocumentApprovals(document.id, documentData.approvers, documentData.tenantId);
            }
            logger_1.logger.info(`Document created: ${document.id} (${document.title})`);
            return document;
        }
        catch (error) {
            logger_1.logger.error('Error creating document:', error);
            throw error;
        }
    }
    async updateDocument(documentId, updateData, userId, tenantId, file) {
        try {
            // Verify document exists and user has permission
            const existingDocument = await this.prisma.document.findFirst({
                where: { id: documentId, tenantId },
            });
            if (!existingDocument) {
                throw new Error('Document not found');
            }
            // Check if document is in editable state
            if (existingDocument.status === client_1.DocumentStatus.PUBLISHED) {
                throw new Error('Cannot edit published document. Create a new version instead.');
            }
            let filePath = existingDocument.filePath;
            let fileSize = existingDocument.fileSize;
            let mimeType = existingDocument.mimeType;
            // Handle file upload
            if (file) {
                // Delete old file if exists
                if (existingDocument.filePath) {
                    try {
                        await fs_1.promises.unlink(existingDocument.filePath);
                    }
                    catch (error) {
                        logger_1.logger.warn('Could not delete old file:', error);
                    }
                }
                const fileExtension = path_1.default.extname(file.originalname);
                const fileName = `${(0, uuid_1.v4)()}${fileExtension}`;
                filePath = path_1.default.join(this.uploadPath, fileName);
                await fs_1.promises.writeFile(filePath, file.buffer);
                fileSize = file.size;
                mimeType = file.mimetype;
            }
            // Update document
            const document = await this.prisma.document.update({
                where: { id: documentId },
                data: {
                    title: updateData.title,
                    description: updateData.description,
                    content: updateData.content,
                    category: updateData.category,
                    filePath,
                    fileSize,
                    mimeType,
                    updatedAt: new Date(),
                },
            });
            // Update tags
            if (updateData.tags !== undefined) {
                await this.updateDocumentTags(documentId, updateData.tags, tenantId);
            }
            // Create new version if content changed
            if (updateData.content || file) {
                const currentVersion = await this.getLatestDocumentVersion(documentId);
                const newVersionNumber = this.incrementVersion(currentVersion?.version || '1.0');
                await this.createDocumentVersion(documentId, {
                    version: newVersionNumber,
                    content: (updateData.content ?? undefined) || (existingDocument.content ?? undefined),
                    filePath: filePath ?? undefined,
                    changes: updateData.changes || 'Document updated',
                    tenantId,
                });
            }
            logger_1.logger.info(`Document updated: ${documentId}`);
            return document;
        }
        catch (error) {
            logger_1.logger.error('Error updating document:', error);
            throw error;
        }
    }
    async deleteDocument(documentId, tenantId) {
        try {
            const document = await this.prisma.document.findFirst({
                where: { id: documentId, tenantId },
            });
            if (!document) {
                throw new Error('Document not found');
            }
            // Delete file if exists
            if (document.filePath) {
                try {
                    await fs_1.promises.unlink(document.filePath);
                }
                catch (error) {
                    logger_1.logger.warn('Could not delete file:', error);
                }
            }
            // Delete document (cascade will handle related records)
            await this.prisma.document.delete({
                where: { id: documentId },
            });
            logger_1.logger.info(`Document deleted: ${documentId}`);
        }
        catch (error) {
            logger_1.logger.error('Error deleting document:', error);
            throw error;
        }
    }
    async getDocument(documentId, tenantId) {
        return this.prisma.document.findFirst({
            where: { id: documentId, tenantId },
            include: {
                creator: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
                versions: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
                approvals: {
                    include: {
                        approver: {
                            select: { id: true, firstName: true, lastName: true, email: true },
                        },
                    },
                },
                tags: true,
            },
        });
    }
    async getDocuments(tenantId, filters, page = 1, limit = 20) {
        const where = { tenantId };
        if (filters) {
            if (filters.type) {
                where.type = filters.type;
            }
            if (filters.category) {
                where.category = filters.category;
            }
            if (filters.status) {
                where.status = filters.status;
            }
            if (filters.createdBy) {
                where.createdBy = filters.createdBy;
            }
            if (filters.dateFrom || filters.dateTo) {
                where.createdAt = {};
                if (filters.dateFrom) {
                    where.createdAt.gte = filters.dateFrom;
                }
                if (filters.dateTo) {
                    where.createdAt.lte = filters.dateTo;
                }
            }
            if (filters.search) {
                where.OR = [
                    { title: { contains: filters.search, mode: 'insensitive' } },
                    { description: { contains: filters.search, mode: 'insensitive' } },
                    { content: { contains: filters.search, mode: 'insensitive' } },
                ];
            }
            if (filters.tags && filters.tags.length > 0) {
                where.tags = {
                    some: {
                        tag: { in: filters.tags },
                    },
                };
            }
        }
        const [documents, total] = await Promise.all([
            this.prisma.document.findMany({
                where,
                include: {
                    creator: {
                        select: { id: true, firstName: true, lastName: true, email: true },
                    },
                    tags: true,
                    approvals: {
                        include: {
                            approver: {
                                select: { id: true, firstName: true, lastName: true, email: true },
                            },
                        },
                    },
                },
                orderBy: { updatedAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.document.count({ where }),
        ]);
        return {
            documents,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    // A063: Version Control
    async createDocumentVersion(documentId, versionData) {
        return this.prisma.documentVersion.create({
            data: {
                documentId,
                version: versionData.version,
                content: versionData.content,
                filePath: versionData.filePath,
                changes: versionData.changes,
                tenantId: versionData.tenantId,
            },
        });
    }
    async getDocumentVersions(documentId, tenantId) {
        return this.prisma.documentVersion.findMany({
            where: { documentId, tenantId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getDocumentVersion(documentId, version, tenantId) {
        return this.prisma.documentVersion.findFirst({
            where: { documentId, version, tenantId },
        });
    }
    async getLatestDocumentVersion(documentId) {
        return this.prisma.documentVersion.findFirst({
            where: { documentId },
            orderBy: { createdAt: 'desc' },
        });
    }
    // A063: Approval Workflows
    async setupDocumentApprovals(documentId, approverIds, tenantId) {
        try {
            // Create approval records
            await this.prisma.documentApproval.createMany({
                data: approverIds.map(approverId => ({
                    documentId,
                    approverId,
                    tenantId,
                })),
            });
            // Send notifications to approvers
            for (const approverId of approverIds) {
                await this.notificationService.sendNotification({
                    userId: approverId,
                    type: 'DOCUMENT_APPROVAL',
                    title: 'Document Approval Required',
                    message: 'A document requires your approval',
                    data: { documentId },
                    tenantId,
                });
            }
            // Update document status
            await this.prisma.document.update({
                where: { id: documentId },
                data: { status: client_1.DocumentStatus.REVIEW },
            });
            logger_1.logger.info(`Approval workflow setup for document: ${documentId}`);
        }
        catch (error) {
            logger_1.logger.error('Error setting up document approvals:', error);
            throw error;
        }
    }
    async processApproval(approvalData, tenantId) {
        try {
            // Update approval
            const approval = await this.prisma.documentApproval.update({
                where: {
                    documentId_approverId: {
                        documentId: approvalData.documentId,
                        approverId: approvalData.approverId,
                    },
                },
                data: {
                    status: approvalData.status,
                    comments: approvalData.comments,
                    approvedAt: new Date(),
                },
            });
            // Check if all approvals are complete
            const allApprovals = await this.prisma.documentApproval.findMany({
                where: { documentId: approvalData.documentId },
            });
            const pendingApprovals = allApprovals.filter(a => a.status === client_1.ApprovalStatus.PENDING);
            const rejectedApprovals = allApprovals.filter(a => a.status === client_1.ApprovalStatus.REJECTED);
            let newDocumentStatus;
            if (rejectedApprovals.length > 0) {
                newDocumentStatus = client_1.DocumentStatus.DRAFT;
            }
            else if (pendingApprovals.length === 0) {
                newDocumentStatus = client_1.DocumentStatus.APPROVED;
            }
            // Update document status if needed
            if (newDocumentStatus) {
                await this.prisma.document.update({
                    where: { id: approvalData.documentId },
                    data: { status: newDocumentStatus },
                });
                // Notify document creator
                const document = await this.prisma.document.findUnique({
                    where: { id: approvalData.documentId },
                    include: { creator: true },
                });
                if (document) {
                    await this.notificationService.sendNotification({
                        userId: document.createdBy,
                        type: 'DOCUMENT_APPROVAL',
                        title: 'Document Approval Update',
                        message: `Document "${document.title}" has been ${newDocumentStatus.toLowerCase()}`,
                        data: { documentId: approvalData.documentId, status: newDocumentStatus },
                        tenantId,
                    });
                }
            }
            logger_1.logger.info(`Document approval processed: ${approvalData.documentId} by ${approvalData.approverId}`);
            return approval;
        }
        catch (error) {
            logger_1.logger.error('Error processing approval:', error);
            throw error;
        }
    }
    async getDocumentApprovals(documentId, tenantId) {
        return this.prisma.documentApproval.findMany({
            where: { documentId, tenantId },
            include: {
                approver: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });
    }
    async getPendingApprovals(userId, tenantId) {
        return this.prisma.documentApproval.findMany({
            where: {
                approverId: userId,
                status: client_1.ApprovalStatus.PENDING,
                tenantId,
            },
            include: {
                document: {
                    include: {
                        creator: {
                            select: { id: true, firstName: true, lastName: true, email: true },
                        },
                    },
                },
            },
            orderBy: { document: { createdAt: 'desc' } },
        });
    }
    // A063: Policy Management
    async publishDocument(documentId, tenantId) {
        try {
            const document = await this.prisma.document.findFirst({
                where: { id: documentId, tenantId },
            });
            if (!document) {
                throw new Error('Document not found');
            }
            if (document.status !== client_1.DocumentStatus.APPROVED) {
                throw new Error('Document must be approved before publishing');
            }
            const publishedDocument = await this.prisma.document.update({
                where: { id: documentId },
                data: {
                    status: client_1.DocumentStatus.PUBLISHED,
                    publishedAt: new Date(),
                },
            });
            logger_1.logger.info(`Document published: ${documentId}`);
            return publishedDocument;
        }
        catch (error) {
            logger_1.logger.error('Error publishing document:', error);
            throw error;
        }
    }
    async archiveDocument(documentId, tenantId) {
        try {
            const document = await this.prisma.document.update({
                where: { id: documentId },
                data: { status: client_1.DocumentStatus.ARCHIVED },
            });
            logger_1.logger.info(`Document archived: ${documentId}`);
            return document;
        }
        catch (error) {
            logger_1.logger.error('Error archiving document:', error);
            throw error;
        }
    }
    async setDocumentExpiry(documentId, expiresAt, tenantId) {
        try {
            const document = await this.prisma.document.update({
                where: { id: documentId },
                data: { expiresAt },
            });
            logger_1.logger.info(`Document expiry set: ${documentId} expires at ${expiresAt}`);
            return document;
        }
        catch (error) {
            logger_1.logger.error('Error setting document expiry:', error);
            throw error;
        }
    }
    async checkExpiredDocuments() {
        try {
            const expiredDocuments = await this.prisma.document.findMany({
                where: {
                    expiresAt: { lt: new Date() },
                    status: client_1.DocumentStatus.PUBLISHED,
                },
            });
            for (const document of expiredDocuments) {
                await this.prisma.document.update({
                    where: { id: document.id },
                    data: { status: client_1.DocumentStatus.EXPIRED },
                });
                // Notify document creator
                await this.notificationService.sendNotification({
                    userId: document.createdBy,
                    type: 'SYSTEM_ALERT',
                    title: 'Document Expired',
                    message: `Document "${document.title}" has expired`,
                    data: { documentId: document.id },
                    tenantId: document.tenantId,
                });
            }
            if (expiredDocuments.length > 0) {
                logger_1.logger.info(`Processed ${expiredDocuments.length} expired documents`);
            }
        }
        catch (error) {
            logger_1.logger.error('Error checking expired documents:', error);
        }
    }
    // Tag management
    async addTagsToDocument(documentId, tags, tenantId) {
        await this.prisma.documentTag.createMany({
            data: tags.map(tag => ({
                documentId,
                tag: tag.toLowerCase().trim(),
                tenantId,
            })),
            skipDuplicates: true,
        });
    }
    async updateDocumentTags(documentId, tags, tenantId) {
        // Remove existing tags
        await this.prisma.documentTag.deleteMany({
            where: { documentId },
        });
        // Add new tags
        if (tags.length > 0) {
            await this.addTagsToDocument(documentId, tags, tenantId);
        }
    }
    incrementVersion(currentVersion) {
        const parts = currentVersion.split('.');
        const major = parseInt(parts[0] || '1');
        const minor = parseInt(parts[1] || '0');
        return `${major}.${minor + 1}`;
    }
    async ensureUploadDirectory() {
        try {
            await fs_1.promises.mkdir(this.uploadPath, { recursive: true });
        }
        catch (error) {
            logger_1.logger.error('Error creating upload directory:', error);
        }
    }
    async getDocumentFile(documentId, tenantId) {
        const document = await this.prisma.document.findFirst({
            where: { id: documentId, tenantId },
        });
        if (!document || !document.filePath) {
            return null;
        }
        return {
            filePath: document.filePath,
            mimeType: document.mimeType || 'application/octet-stream',
            fileName: document.title,
        };
    }
}
exports.DocumentManagementService = DocumentManagementService;
//# sourceMappingURL=document-management.service.js.map