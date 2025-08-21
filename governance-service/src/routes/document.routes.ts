import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { AuthenticatedRequest, requirePermission } from '../middleware/auth.middleware';
import { enforceTenantIsolation } from '../middleware/tenant.middleware';
import { DocumentManagementService } from '../services/document-management.service';
import { NotificationService } from '../services/notification.service';
import { logger, logAudit } from '../utils/logger';
import { ValidationError, NotFoundError } from '../middleware/error-handler';
import { config } from '../utils/config';
import Joi from 'joi';

const router = Router();
const prisma = new PrismaClient();

// Initialize services
const notificationService = new NotificationService(prisma, {} as any); // WebSocket server would be injected
const documentService = new DocumentManagementService(prisma, notificationService);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Validation schemas
const createDocumentSchema = Joi.object({
  title: Joi.string().required().max(255),
  description: Joi.string().optional().max(1000),
  content: Joi.string().optional(),
  type: Joi.string().valid('POLICY', 'PROCEDURE', 'GUIDELINE', 'TEMPLATE', 'REPORT', 'CONTRACT', 'OTHER').required(),
  category: Joi.string().optional().max(100),
  tags: Joi.array().items(Joi.string()).optional(),
  approvers: Joi.array().items(Joi.string()).optional(),
});

const updateDocumentSchema = Joi.object({
  title: Joi.string().optional().max(255),
  description: Joi.string().optional().max(1000),
  content: Joi.string().optional(),
  category: Joi.string().optional().max(100),
  tags: Joi.array().items(Joi.string()).optional(),
  changes: Joi.string().optional().max(500),
});

const approvalSchema = Joi.object({
  status: Joi.string().valid('APPROVED', 'REJECTED').required(),
  comments: Joi.string().optional().max(1000),
});

// Apply middleware
router.use(enforceTenantIsolation);

// Get documents
router.get('/', requirePermission('documents:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, category, status, tags, search, createdBy, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
    
    const filters: any = {};
    
    if (type) filters.type = type;
    if (category) filters.category = category;
    if (status) filters.status = status;
    if (createdBy) filters.createdBy = createdBy;
    if (search) filters.search = search as string;
    if (tags) filters.tags = Array.isArray(tags) ? tags as string[] : [tags as string];
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);

    const result = await documentService.getDocuments(
      req.user!.tenantId,
      filters,
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error fetching documents:', error);
    throw error;
  }
});

// Create document
router.post('/', requirePermission('documents:write'), upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = createDocumentSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid document data', error.details);
    }

    const document = await documentService.createDocument({
      ...value,
      createdBy: req.user!.userId,
      tenantId: req.user!.tenantId,
    }, req.file);

    logAudit('document_created', req.user!.userId, 'document', document.id, {
      title: document.title,
      type: document.type,
    });

    res.status(201).json({
      success: true,
      data: document,
    });
  } catch (error) {
    logger.error('Error creating document:', error);
    throw error;
  }
});

// Get document by ID
router.get('/:id', requirePermission('documents:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const document = await documentService.getDocument(req.params.id, req.user!.tenantId);

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    logger.error('Error fetching document:', error);
    throw error;
  }
});

// Update document
router.put('/:id', requirePermission('documents:write'), upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = updateDocumentSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid document data', error.details);
    }

    const document = await documentService.updateDocument(
      req.params.id,
      value,
      req.user!.userId,
      req.user!.tenantId,
      req.file
    );

    logAudit('document_updated', req.user!.userId, 'document', req.params.id, {
      changes: value,
    });

    res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    logger.error('Error updating document:', error);
    throw error;
  }
});

// Delete document
router.delete('/:id', requirePermission('documents:delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await documentService.deleteDocument(req.params.id, req.user!.tenantId);

    logAudit('document_deleted', req.user!.userId, 'document', req.params.id);

    res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting document:', error);
    throw error;
  }
});

// Download document file
router.get('/:id/download', requirePermission('documents:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileInfo = await documentService.getDocumentFile(req.params.id, req.user!.tenantId);

    if (!fileInfo) {
      throw new NotFoundError('Document file not found');
    }

    res.download(fileInfo.filePath, fileInfo.fileName);
  } catch (error) {
    logger.error('Error downloading document:', error);
    throw error;
  }
});

// Get document versions
router.get('/:id/versions', requirePermission('documents:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const versions = await documentService.getDocumentVersions(req.params.id, req.user!.tenantId);

    res.json({
      success: true,
      data: versions,
    });
  } catch (error) {
    logger.error('Error fetching document versions:', error);
    throw error;
  }
});

// Get specific document version
router.get('/:id/versions/:version', requirePermission('documents:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const version = await documentService.getDocumentVersion(
      req.params.id,
      req.params.version,
      req.user!.tenantId
    );

    if (!version) {
      throw new NotFoundError('Document version not found');
    }

    res.json({
      success: true,
      data: version,
    });
  } catch (error) {
    logger.error('Error fetching document version:', error);
    throw error;
  }
});

// Publish document
router.post('/:id/publish', requirePermission('documents:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const document = await documentService.publishDocument(req.params.id, req.user!.tenantId);

    logAudit('document_published', req.user!.userId, 'document', req.params.id, {
      title: document.title,
    });

    res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    logger.error('Error publishing document:', error);
    throw error;
  }
});

// Archive document
router.post('/:id/archive', requirePermission('documents:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const document = await documentService.archiveDocument(req.params.id, req.user!.tenantId);

    logAudit('document_archived', req.user!.userId, 'document', req.params.id, {
      title: document.title,
    });

    res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    logger.error('Error archiving document:', error);
    throw error;
  }
});

// Set document expiry
router.post('/:id/expiry', requirePermission('documents:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { expiresAt } = req.body;

    if (!expiresAt) {
      throw new ValidationError('Expiry date is required');
    }

    const document = await documentService.setDocumentExpiry(
      req.params.id,
      new Date(expiresAt),
      req.user!.tenantId
    );

    logAudit('document_expiry_set', req.user!.userId, 'document', req.params.id, {
      expiresAt,
    });

    res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    logger.error('Error setting document expiry:', error);
    throw error;
  }
});

// Get document approvals
router.get('/:id/approvals', requirePermission('documents:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const approvals = await documentService.getDocumentApprovals(req.params.id, req.user!.tenantId);

    res.json({
      success: true,
      data: approvals,
    });
  } catch (error) {
    logger.error('Error fetching document approvals:', error);
    throw error;
  }
});

// Process approval
router.post('/:id/approve', requirePermission('documents:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = approvalSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid approval data', error.details);
    }

    const approval = await documentService.processApproval({
      documentId: req.params.id,
      approverId: req.user!.userId,
      status: value.status as any,
      comments: value.comments,
    }, req.user!.tenantId);

    logAudit('document_approval_processed', req.user!.userId, 'document', req.params.id, {
      status: value.status,
      comments: value.comments,
    });

    res.json({
      success: true,
      data: approval,
    });
  } catch (error) {
    logger.error('Error processing approval:', error);
    throw error;
  }
});

// Get pending approvals for current user
router.get('/approvals/pending', requirePermission('documents:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const approvals = await documentService.getPendingApprovals(req.user!.userId, req.user!.tenantId);

    res.json({
      success: true,
      data: approvals,
    });
  } catch (error) {
    logger.error('Error fetching pending approvals:', error);
    throw error;
  }
});

// Setup document approvals
router.post('/:id/setup-approvals', requirePermission('documents:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { approverIds } = req.body;

    if (!approverIds || !Array.isArray(approverIds)) {
      throw new ValidationError('Approver IDs array is required');
    }

    await documentService.setupDocumentApprovals(req.params.id, approverIds, req.user!.tenantId);

    logAudit('document_approvals_setup', req.user!.userId, 'document', req.params.id, {
      approverIds,
    });

    res.json({
      success: true,
      message: 'Document approvals setup successfully',
    });
  } catch (error) {
    logger.error('Error setting up document approvals:', error);
    throw error;
  }
});

export { router as documentRoutes };