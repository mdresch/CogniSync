"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRoutes = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const tenant_middleware_1 = require("../middleware/tenant.middleware");
const reporting_service_1 = require("../services/reporting.service");
const notification_service_1 = require("../services/notification.service");
const logger_1 = require("../utils/logger");
const error_handler_1 = require("../middleware/error-handler");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
exports.reportRoutes = router;
const prisma = new client_1.PrismaClient();
// Initialize services
const notificationService = new notification_service_1.NotificationService(prisma, {});
const reportingService = new reporting_service_1.ReportingService(prisma, notificationService);
// Validation schemas
const createReportSchema = joi_1.default.object({
    name: joi_1.default.string().required().max(255),
    description: joi_1.default.string().optional().max(1000),
    type: joi_1.default.string().valid('STANDARD', 'CUSTOM', 'SCHEDULED', 'AD_HOC').required(),
    query: joi_1.default.object().required(),
    schedule: joi_1.default.string().optional(),
    format: joi_1.default.string().valid('PDF', 'EXCEL', 'CSV', 'JSON').required(),
});
// Apply middleware
router.use(tenant_middleware_1.enforceTenantIsolation);
// A067: Standard and Custom Reporting Functions
// Get reports
router.get('/', (0, auth_middleware_1.requirePermission)('reports:read'), async (req, res) => {
    try {
        const { type, isActive, search } = req.query;
        const filters = {};
        if (type)
            filters.type = type;
        if (isActive !== undefined)
            filters.isActive = isActive === 'true';
        if (search)
            filters.search = search;
        const reports = await reportingService.getReports(req.user.tenantId, filters);
        res.json({
            success: true,
            data: reports,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching reports:', error);
        throw error;
    }
});
// Create report
router.post('/', (0, auth_middleware_1.requirePermission)('reports:write'), async (req, res) => {
    try {
        const { error, value } = createReportSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid report data', error.details);
        }
        const report = await reportingService.createReport({
            ...value,
            tenantId: req.user.tenantId,
        });
        (0, logger_1.logAudit)('report_created', req.user.userId, 'report', report.id, {
            name: report.name,
            type: report.type,
        });
        res.status(201).json({
            success: true,
            data: report,
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating report:', error);
        throw error;
    }
});
// Update report
router.put('/:id', (0, auth_middleware_1.requirePermission)('reports:write'), async (req, res) => {
    try {
        const { error, value } = createReportSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid report data', error.details);
        }
        const report = await reportingService.updateReport(req.params.id, value, req.user.tenantId);
        (0, logger_1.logAudit)('report_updated', req.user.userId, 'report', req.params.id, {
            changes: value,
        });
        res.json({
            success: true,
            data: report,
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating report:', error);
        throw error;
    }
});
// Delete report
router.delete('/:id', (0, auth_middleware_1.requirePermission)('reports:delete'), async (req, res) => {
    try {
        await reportingService.deleteReport(req.params.id, req.user.tenantId);
        (0, logger_1.logAudit)('report_deleted', req.user.userId, 'report', req.params.id);
        res.json({
            success: true,
            message: 'Report deleted successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Error deleting report:', error);
        throw error;
    }
});
// Generate report
router.post('/:id/generate', (0, auth_middleware_1.requirePermission)('reports:read'), async (req, res) => {
    try {
        const { parameters } = req.body;
        const execution = await reportingService.generateReport(req.params.id, req.user.tenantId, parameters);
        (0, logger_1.logAudit)('report_generated', req.user.userId, 'report', req.params.id, {
            executionId: execution.id,
        });
        res.json({
            success: true,
            data: execution,
        });
    }
    catch (error) {
        logger_1.logger.error('Error generating report:', error);
        throw error;
    }
});
// Get report executions
router.get('/:id/executions', (0, auth_middleware_1.requirePermission)('reports:read'), async (req, res) => {
    try {
        const executions = await reportingService.getReportExecutions(req.params.id, req.user.tenantId);
        res.json({
            success: true,
            data: executions,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching report executions:', error);
        throw error;
    }
});
// Download report file
router.get('/executions/:executionId/download', (0, auth_middleware_1.requirePermission)('reports:read'), async (req, res) => {
    try {
        const fileInfo = await reportingService.getReportFile(req.params.executionId, req.user.tenantId);
        if (!fileInfo) {
            throw new error_handler_1.NotFoundError('Report file not found');
        }
        res.download(fileInfo.filePath, fileInfo.fileName);
    }
    catch (error) {
        logger_1.logger.error('Error downloading report:', error);
        throw error;
    }
});
// Subscribe to report
router.post('/:id/subscribe', (0, auth_middleware_1.requirePermission)('reports:read'), async (req, res) => {
    try {
        const { email } = req.body;
        await reportingService.subscribeToReport(req.params.id, req.user.userId, email || req.user.email, req.user.tenantId);
        (0, logger_1.logAudit)('report_subscribed', req.user.userId, 'report', req.params.id);
        res.json({
            success: true,
            message: 'Subscribed to report successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Error subscribing to report:', error);
        throw error;
    }
});
// Unsubscribe from report
router.delete('/:id/subscribe', (0, auth_middleware_1.requirePermission)('reports:read'), async (req, res) => {
    try {
        await reportingService.unsubscribeFromReport(req.params.id, req.user.userId, req.user.tenantId);
        (0, logger_1.logAudit)('report_unsubscribed', req.user.userId, 'report', req.params.id);
        res.json({
            success: true,
            message: 'Unsubscribed from report successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Error unsubscribing from report:', error);
        throw error;
    }
});
// Get standard reports
router.get('/standard', (0, auth_middleware_1.requirePermission)('reports:read'), async (req, res) => {
    try {
        const standardReports = await reportingService.getStandardReports(req.user.tenantId);
        res.json({
            success: true,
            data: standardReports,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching standard reports:', error);
        throw error;
    }
});
// Build custom report
router.post('/custom/build', (0, auth_middleware_1.requirePermission)('reports:read'), async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            throw new error_handler_1.ValidationError('Query is required');
        }
        const reportData = await reportingService.buildCustomReport(query, req.user.tenantId);
        res.json({
            success: true,
            data: reportData,
        });
    }
    catch (error) {
        logger_1.logger.error('Error building custom report:', error);
        throw error;
    }
});
//# sourceMappingURL=report.routes.js.map