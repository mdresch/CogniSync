"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentRoutes = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const tenant_middleware_1 = require("../middleware/tenant.middleware");
const document_management_service_1 = require("../services/document-management.service");
const notification_service_1 = require("../services/notification.service");
const logger_1 = require("../utils/logger");
const error_handler_1 = require("../middleware/error-handler");
const config_1 = require("../utils/config");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
exports.documentRoutes = router;
const prisma = new client_1.PrismaClient();
// Initialize services
const notificationService = new notification_service_1.NotificationService(prisma, {}); // WebSocket server would be injected
const documentService = new document_management_service_1.DocumentManagementService(prisma, notificationService);
// Configure multer for file uploads
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: config_1.config.maxFileSize,
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
        }
        else {
            cb(new Error('Invalid file type'));
        }
    },
});
// Validation schemas
const createDocumentSchema = joi_1.default.object({
    title: joi_1.default.string().required().max(255),
    description: joi_1.default.string().optional().max(1000),
    content: joi_1.default.string().optional(),
    type: joi_1.default.string().valid('POLICY', 'PROCEDURE', 'GUIDELINE', 'TEMPLATE', 'REPORT', 'CONTRACT', 'OTHER').required(),
    category: joi_1.default.string().optional().max(100),
    tags: joi_1.default.array().items(joi_1.default.string()).optional(),
    approvers: joi_1.default.array().items(joi_1.default.string()).optional(),
});
const updateDocumentSchema = joi_1.default.object({
    title: joi_1.default.string().optional().max(255),
    description: joi_1.default.string().optional().max(1000),
    content: joi_1.default.string().optional(),
    category: joi_1.default.string().optional().max(100),
    tags: joi_1.default.array().items(joi_1.default.string()).optional(),
    changes: joi_1.default.string().optional().max(500),
});
const approvalSchema = joi_1.default.object({
    status: joi_1.default.string().valid('APPROVED', 'REJECTED').required(),
    comments: joi_1.default.string().optional().max(1000),
});
// Apply middleware
router.use(tenant_middleware_1.enforceTenantIsolation);
// Get documents
router.get('/', (0, auth_middleware_1.requirePermission)('documents:read'), async (req, res) => {
    try {
        const { type, category, status, tags, search, createdBy, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
        const filters = {};
        if (type)
            filters.type = type;
        if (category)
            filters.category = category;
        if (status)
            filters.status = status;
        if (createdBy)
            filters.createdBy = createdBy;
        if (search)
            filters.search = search;
        if (tags)
            filters.tags = Array.isArray(tags) ? tags : [tags];
        if (dateFrom)
            filters.dateFrom = new Date(dateFrom);
        if (dateTo)
            filters.dateTo = new Date(dateTo);
        const result = await documentService.getDocuments(req.user.tenantId, filters, Number(page), Number(limit));
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching documents:', error);
        throw error;
    }
});
// Create document
router.post('/', (0, auth_middleware_1.requirePermission)('documents:write'), upload.single('file'), async (req, res) => {
    try {
        const { error, value } = createDocumentSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid document data', error.details);
        }
        const document = await documentService.createDocument({
            ...value,
            createdBy: req.user.userId,
            tenantId: req.user.tenantId,
        }, req.file);
        (0, logger_1.logAudit)('document_created', req.user.userId, 'document', document.id, {
            title: document.title,
            type: document.type,
        });
        res.status(201).json({
            success: true,
            data: document,
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating document:', error);
        throw error;
    }
});
// Get document by ID
router.get('/:id', (0, auth_middleware_1.requirePermission)('documents:read'), async (req, res) => {
    try {
        const document = await documentService.getDocument(req.params.id, req.user.tenantId);
        if (!document) {
            throw new error_handler_1.NotFoundError('Document not found');
        }
        res.json({
            success: true,
            data: document,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching document:', error);
        throw error;
    }
});
// Update document
router.put('/:id', (0, auth_middleware_1.requirePermission)('documents:write'), upload.single('file'), async (req, res) => {
    try {
        const { error, value } = updateDocumentSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid document data', error.details);
        }
        const document = await documentService.updateDocument(req.params.id, value, req.user.userId, req.user.tenantId, req.file);
        (0, logger_1.logAudit)('document_updated', req.user.userId, 'document', req.params.id, {
            changes: value,
        });
        res.json({
            success: true,
            data: document,
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating document:', error);
        throw error;
    }
});
// Delete document
router.delete('/:id', (0, auth_middleware_1.requirePermission)('documents:delete'), async (req, res) => {
    try {
        await documentService.deleteDocument(req.params.id, req.user.tenantId);
        (0, logger_1.logAudit)('document_deleted', req.user.userId, 'document', req.params.id);
        res.json({
            success: true,
            message: 'Document deleted successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Error deleting document:', error);
        throw error;
    }
});
// Download document file
router.get('/:id/download', (0, auth_middleware_1.requirePermission)('documents:read'), async (req, res) => {
    try {
        const fileInfo = await documentService.getDocumentFile(req.params.id, req.user.tenantId);
        if (!fileInfo) {
            throw new error_handler_1.NotFoundError('Document file not found');
        }
        res.download(fileInfo.filePath, fileInfo.fileName);
    }
    catch (error) {
        logger_1.logger.error('Error downloading document:', error);
        throw error;
    }
});
// Get document versions
router.get('/:id/versions', (0, auth_middleware_1.requirePermission)('documents:read'), async (req, res) => {
    try {
        const versions = await documentService.getDocumentVersions(req.params.id, req.user.tenantId);
        res.json({
            success: true,
            data: versions,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching document versions:', error);
        throw error;
    }
});
// Get specific document version
router.get('/:id/versions/:version', (0, auth_middleware_1.requirePermission)('documents:read'), async (req, res) => {
    try {
        const version = await documentService.getDocumentVersion(req.params.id, req.params.version, req.user.tenantId);
        if (!version) {
            throw new error_handler_1.NotFoundError('Document version not found');
        }
        res.json({
            success: true,
            data: version,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching document version:', error);
        throw error;
    }
});
// Publish document
router.post('/:id/publish', (0, auth_middleware_1.requirePermission)('documents:write'), async (req, res) => {
    try {
        const document = await documentService.publishDocument(req.params.id, req.user.tenantId);
        (0, logger_1.logAudit)('document_published', req.user.userId, 'document', req.params.id, {
            title: document.title,
        });
        res.json({
            success: true,
            data: document,
        });
    }
    catch (error) {
        logger_1.logger.error('Error publishing document:', error);
        throw error;
    }
});
// Archive document
router.post('/:id/archive', (0, auth_middleware_1.requirePermission)('documents:write'), async (req, res) => {
    try {
        const document = await documentService.archiveDocument(req.params.id, req.user.tenantId);
        (0, logger_1.logAudit)('document_archived', req.user.userId, 'document', req.params.id, {
            title: document.title,
        });
        res.json({
            success: true,
            data: document,
        });
    }
    catch (error) {
        logger_1.logger.error('Error archiving document:', error);
        throw error;
    }
});
// Set document expiry
router.post('/:id/expiry', (0, auth_middleware_1.requirePermission)('documents:write'), async (req, res) => {
    try {
        const { expiresAt } = req.body;
        if (!expiresAt) {
            throw new error_handler_1.ValidationError('Expiry date is required');
        }
        const document = await documentService.setDocumentExpiry(req.params.id, new Date(expiresAt), req.user.tenantId);
        (0, logger_1.logAudit)('document_expiry_set', req.user.userId, 'document', req.params.id, {
            expiresAt,
        });
        res.json({
            success: true,
            data: document,
        });
    }
    catch (error) {
        logger_1.logger.error('Error setting document expiry:', error);
        throw error;
    }
});
// Get document approvals
router.get('/:id/approvals', (0, auth_middleware_1.requirePermission)('documents:read'), async (req, res) => {
    try {
        const approvals = await documentService.getDocumentApprovals(req.params.id, req.user.tenantId);
        res.json({
            success: true,
            data: approvals,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching document approvals:', error);
        throw error;
    }
});
// Process approval
router.post('/:id/approve', (0, auth_middleware_1.requirePermission)('documents:write'), async (req, res) => {
    try {
        const { error, value } = approvalSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid approval data', error.details);
        }
        const approval = await documentService.processApproval({
            documentId: req.params.id,
            approverId: req.user.userId,
            status: value.status,
            comments: value.comments,
        }, req.user.tenantId);
        (0, logger_1.logAudit)('document_approval_processed', req.user.userId, 'document', req.params.id, {
            status: value.status,
            comments: value.comments,
        });
        res.json({
            success: true,
            data: approval,
        });
    }
    catch (error) {
        logger_1.logger.error('Error processing approval:', error);
        throw error;
    }
});
// Get pending approvals for current user
router.get('/approvals/pending', (0, auth_middleware_1.requirePermission)('documents:read'), async (req, res) => {
    try {
        const approvals = await documentService.getPendingApprovals(req.user.userId, req.user.tenantId);
        res.json({
            success: true,
            data: approvals,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching pending approvals:', error);
        throw error;
    }
});
// Setup document approvals
router.post('/:id/setup-approvals', (0, auth_middleware_1.requirePermission)('documents:write'), async (req, res) => {
    try {
        const { approverIds } = req.body;
        if (!approverIds || !Array.isArray(approverIds)) {
            throw new error_handler_1.ValidationError('Approver IDs array is required');
        }
        await documentService.setupDocumentApprovals(req.params.id, approverIds, req.user.tenantId);
        (0, logger_1.logAudit)('document_approvals_setup', req.user.userId, 'document', req.params.id, {
            approverIds,
        });
        res.json({
            success: true,
            message: 'Document approvals setup successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Error setting up document approvals:', error);
        throw error;
    }
});
//# sourceMappingURL=document.routes.js.map