import { PrismaClient, Document, DocumentVersion, DocumentApproval, DocumentStatus, ApprovalStatus } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
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

export class DocumentManagementService {
  private prisma: PrismaClient;
  private notificationService: NotificationService;
  private uploadPath: string;

  constructor(prisma: PrismaClient, notificationService: NotificationService) {
    this.prisma = prisma;
    this.notificationService = notificationService;
    this.uploadPath = process.env.DOCUMENT_UPLOAD_PATH || './uploads/documents';
    this.ensureUploadDirectory();
  }

  // A063: Document Management
  async createDocument(documentData: CreateDocumentRequest, file?: Express.Multer.File): Promise<Document> {
    try {
      let filePath: string | undefined;
      let fileSize: number | undefined;
      let mimeType: string | undefined;

      // Handle file upload
      if (file) {
        const fileExtension = path.extname(file.originalname);
        const fileName = `${uuidv4()}${fileExtension}`;
        filePath = path.join(this.uploadPath, fileName);
        
        await fs.writeFile(filePath, file.buffer);
        fileSize = file.size;
        mimeType = file.mimetype;
      }

      // Create document
      const document = await this.prisma.document.create({
        data: {
          title: documentData.title,
          description: documentData.description,
          content: documentData.content,
          type: documentData.type as any,
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

      logger.info(`Document created: ${document.id} (${document.title})`);
      return document;
    } catch (error) {
      logger.error('Error creating document:', error);
      throw error;
    }
  }

  async updateDocument(documentId: string, updateData: UpdateDocumentRequest, userId: string, tenantId: string, file?: Express.Multer.File): Promise<Document> {
    try {
      // Verify document exists and user has permission
      const existingDocument = await this.prisma.document.findFirst({
        where: { id: documentId, tenantId },
      });

      if (!existingDocument) {
        throw new Error('Document not found');
      }

      // Check if document is in editable state
      if (existingDocument.status === DocumentStatus.PUBLISHED) {
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
            await fs.unlink(existingDocument.filePath);
          } catch (error) {
            logger.warn('Could not delete old file:', error);
          }
        }

        const fileExtension = path.extname(file.originalname);
        const fileName = `${uuidv4()}${fileExtension}`;
        filePath = path.join(this.uploadPath, fileName);
        
        await fs.writeFile(filePath, file.buffer);
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

      logger.info(`Document updated: ${documentId}`);
      return document;
    } catch (error) {
      logger.error('Error updating document:', error);
      throw error;
    }
  }

  async deleteDocument(documentId: string, tenantId: string): Promise<void> {
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
          await fs.unlink(document.filePath);
        } catch (error) {
          logger.warn('Could not delete file:', error);
        }
      }

      // Delete document (cascade will handle related records)
      await this.prisma.document.delete({
        where: { id: documentId },
      });

      logger.info(`Document deleted: ${documentId}`);
    } catch (error) {
      logger.error('Error deleting document:', error);
      throw error;
    }
  }

  async getDocument(documentId: string, tenantId: string): Promise<Document | null> {
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

  async getDocuments(tenantId: string, filters?: DocumentSearchFilters, page = 1, limit = 20): Promise<{
    documents: Document[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const where: any = { tenantId };

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
  async createDocumentVersion(documentId: string, versionData: {
    version: string;
    content?: string;
    filePath?: string;
    changes?: string;
    tenantId: string;
  }): Promise<DocumentVersion> {
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

  async getDocumentVersions(documentId: string, tenantId: string): Promise<DocumentVersion[]> {
    return this.prisma.documentVersion.findMany({
      where: { documentId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDocumentVersion(documentId: string, version: string, tenantId: string): Promise<DocumentVersion | null> {
    return this.prisma.documentVersion.findFirst({
      where: { documentId, version, tenantId },
    });
  }

  async getLatestDocumentVersion(documentId: string): Promise<DocumentVersion | null> {
    return this.prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // A063: Approval Workflows
  async setupDocumentApprovals(documentId: string, approverIds: string[], tenantId: string): Promise<void> {
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
        data: { status: DocumentStatus.REVIEW },
      });

      logger.info(`Approval workflow setup for document: ${documentId}`);
    } catch (error) {
      logger.error('Error setting up document approvals:', error);
      throw error;
    }
  }

  async processApproval(approvalData: ApprovalRequest, tenantId: string): Promise<DocumentApproval> {
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

      const pendingApprovals = allApprovals.filter(a => a.status === ApprovalStatus.PENDING);
      const rejectedApprovals = allApprovals.filter(a => a.status === ApprovalStatus.REJECTED);

      let newDocumentStatus: DocumentStatus | undefined;

      if (rejectedApprovals.length > 0) {
        newDocumentStatus = DocumentStatus.DRAFT;
      } else if (pendingApprovals.length === 0) {
        newDocumentStatus = DocumentStatus.APPROVED;
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

      logger.info(`Document approval processed: ${approvalData.documentId} by ${approvalData.approverId}`);
      return approval;
    } catch (error) {
      logger.error('Error processing approval:', error);
      throw error;
    }
  }

  async getDocumentApprovals(documentId: string, tenantId: string): Promise<DocumentApproval[]> {
    return this.prisma.documentApproval.findMany({
      where: { documentId, tenantId },
      include: {
        approver: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async getPendingApprovals(userId: string, tenantId: string): Promise<DocumentApproval[]> {
    return this.prisma.documentApproval.findMany({
      where: {
        approverId: userId,
        status: ApprovalStatus.PENDING,
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
  async publishDocument(documentId: string, tenantId: string): Promise<Document> {
    try {
      const document = await this.prisma.document.findFirst({
        where: { id: documentId, tenantId },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      if (document.status !== DocumentStatus.APPROVED) {
        throw new Error('Document must be approved before publishing');
      }

      const publishedDocument = await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      });

      logger.info(`Document published: ${documentId}`);
      return publishedDocument;
    } catch (error) {
      logger.error('Error publishing document:', error);
      throw error;
    }
  }

  async archiveDocument(documentId: string, tenantId: string): Promise<Document> {
    try {
      const document = await this.prisma.document.update({
        where: { id: documentId },
        data: { status: DocumentStatus.ARCHIVED },
      });

      logger.info(`Document archived: ${documentId}`);
      return document;
    } catch (error) {
      logger.error('Error archiving document:', error);
      throw error;
    }
  }

  async setDocumentExpiry(documentId: string, expiresAt: Date, tenantId: string): Promise<Document> {
    try {
      const document = await this.prisma.document.update({
        where: { id: documentId },
        data: { expiresAt },
      });

      logger.info(`Document expiry set: ${documentId} expires at ${expiresAt}`);
      return document;
    } catch (error) {
      logger.error('Error setting document expiry:', error);
      throw error;
    }
  }

  async checkExpiredDocuments(): Promise<void> {
    try {
      const expiredDocuments = await this.prisma.document.findMany({
        where: {
          expiresAt: { lt: new Date() },
          status: DocumentStatus.PUBLISHED,
        },
      });

      for (const document of expiredDocuments) {
        await this.prisma.document.update({
          where: { id: document.id },
          data: { status: DocumentStatus.EXPIRED },
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
        logger.info(`Processed ${expiredDocuments.length} expired documents`);
      }
    } catch (error) {
      logger.error('Error checking expired documents:', error);
    }
  }

  // Tag management
  private async addTagsToDocument(documentId: string, tags: string[], tenantId: string): Promise<void> {
    await this.prisma.documentTag.createMany({
      data: tags.map(tag => ({
        documentId,
        tag: tag.toLowerCase().trim(),
        tenantId,
      })),
      skipDuplicates: true,
    });
  }

  private async updateDocumentTags(documentId: string, tags: string[], tenantId: string): Promise<void> {
    // Remove existing tags
    await this.prisma.documentTag.deleteMany({
      where: { documentId },
    });

    // Add new tags
    if (tags.length > 0) {
      await this.addTagsToDocument(documentId, tags, tenantId);
    }
  }

  private incrementVersion(currentVersion: string): string {
    const parts = currentVersion.split('.');
    const major = parseInt(parts[0] || '1');
    const minor = parseInt(parts[1] || '0');
    
    return `${major}.${minor + 1}`;
  }

  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.uploadPath, { recursive: true });
    } catch (error) {
      logger.error('Error creating upload directory:', error);
    }
  }

  async getDocumentFile(documentId: string, tenantId: string): Promise<{ filePath: string; mimeType: string; fileName: string } | null> {
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