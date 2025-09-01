"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowRoutes = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const tenant_middleware_1 = require("../middleware/tenant.middleware");
const workflow_engine_service_1 = require("../services/workflow-engine.service");
const notification_service_1 = require("../services/notification.service");
const logger_1 = require("../utils/logger");
const error_handler_1 = require("../middleware/error-handler");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
exports.workflowRoutes = router;
const prisma = new client_1.PrismaClient();
// Initialize services
const ws_1 = require("ws");
// ... other imports
// Initialize WebSocketServer (ensure this is properly configured for your app)
// Initialize WebSocketServer (ensure this is properly configured for your app)
const wss = new ws_1.WebSocketServer({ noServer: true });
// Pass required arguments to constructors
const notificationService = new notification_service_1.NotificationService(prisma, wss);
const workflowEngine = new workflow_engine_service_1.WorkflowEngine(prisma, notificationService);
// Validation schemas
const createWorkflowSchema = joi_1.default.object({
    name: joi_1.default.string().required().min(1).max(255),
    description: joi_1.default.string().optional().max(1000),
    definition: joi_1.default.object({
        steps: joi_1.default.array().items(joi_1.default.object({
            id: joi_1.default.string().required(),
            name: joi_1.default.string().required(),
            type: joi_1.default.string().valid('approval', 'review', 'automation', 'notification', 'data_entry', 'custom').required(),
            assignee: joi_1.default.alternatives().try(joi_1.default.string(), joi_1.default.array().items(joi_1.default.string())).optional(),
            config: joi_1.default.object().optional(),
            nextSteps: joi_1.default.array().items(joi_1.default.string()).optional(),
            conditions: joi_1.default.array().optional(),
        })).required(),
        conditions: joi_1.default.array().optional(),
        settings: joi_1.default.object().optional(),
    }).required(),
});
const updateWorkflowSchema = joi_1.default.object({
    name: joi_1.default.string().optional().min(1).max(255),
    description: joi_1.default.string().optional().max(1000),
    definition: joi_1.default.object().optional(),
    isActive: joi_1.default.boolean().optional(),
});
const startInstanceSchema = joi_1.default.object({
    data: joi_1.default.object().optional(),
});
const completeTaskSchema = joi_1.default.object({
    data: joi_1.default.object().optional(),
});
const assignTaskSchema = joi_1.default.object({
    assigneeId: joi_1.default.string().required(),
});
// Apply middleware
router.use(tenant_middleware_1.enforceTenantIsolation);
// A061: Create workflow
router.post('/', (0, auth_middleware_1.requirePermission)('workflows:write'), async (req, res) => {
    try {
        const { error, value } = createWorkflowSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid workflow data', error.details);
        }
        const workflow = await workflowEngine.createWorkflow({
            name: value.name,
            description: value.description,
            definition: value.definition,
            createdBy: req.user.userId,
            tenantId: req.user.tenantId,
        });
        (0, logger_1.logAudit)('workflow_created', req.user.userId, 'workflow', workflow.id, {
            workflowName: workflow.name,
        });
        res.status(201).json({
            success: true,
            data: workflow,
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating workflow:', error);
        throw error;
    }
});
// Get workflows
router.get('/', (0, auth_middleware_1.requirePermission)('workflows:read'), async (req, res) => {
    try {
        const { status, search, page = 1, limit = 20 } = req.query;
        const where = { tenantId: req.user.tenantId };
        if (status) {
            where.status = status;
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [workflows, total] = await Promise.all([
            prisma.workflow.findMany({
                where,
                include: {
                    creator: {
                        select: { id: true, firstName: true, lastName: true, email: true },
                    },
                    _count: {
                        select: { instances: true },
                    },
                },
                orderBy: { updatedAt: 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
            }),
            prisma.workflow.count({ where }),
        ]);
        res.json({
            success: true,
            data: {
                workflows,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    totalPages: Math.ceil(total / Number(limit)),
                },
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching workflows:', error);
        throw error;
    }
});
// Get workflow by ID
router.get('/:id', (0, auth_middleware_1.requirePermission)('workflows:read'), async (req, res) => {
    try {
        const workflow = await prisma.workflow.findFirst({
            where: {
                id: req.params.id,
                tenantId: req.user.tenantId,
            },
            include: {
                creator: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
                instances: {
                    include: {
                        tasks: {
                            include: {
                                assignee: {
                                    select: { id: true, firstName: true, lastName: true, email: true },
                                },
                            },
                        },
                    },
                    orderBy: { startedAt: 'desc' },
                    take: 10,
                },
            },
        });
        if (!workflow) {
            throw new error_handler_1.NotFoundError('Workflow not found');
        }
        res.json({
            success: true,
            data: workflow,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching workflow:', error);
        throw error;
    }
});
// Update workflow
router.put('/:id', (0, auth_middleware_1.requirePermission)('workflows:write'), async (req, res) => {
    try {
        const { error, value } = updateWorkflowSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid workflow data', error.details);
        }
        const existingWorkflow = await prisma.workflow.findFirst({
            where: {
                id: req.params.id,
                tenantId: req.user.tenantId,
            },
        });
        if (!existingWorkflow) {
            throw new error_handler_1.NotFoundError('Workflow not found');
        }
        const workflow = await prisma.workflow.update({
            where: { id: req.params.id },
            data: {
                name: value.name,
                description: value.description,
                definition: value.definition,
                isActive: value.isActive,
                updatedAt: new Date(),
            },
        });
        (0, logger_1.logAudit)('workflow_updated', req.user.userId, 'workflow', workflow.id, {
            workflowName: workflow.name,
            changes: value,
        });
        res.json({
            success: true,
            data: workflow,
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating workflow:', error);
        throw error;
    }
});
// Delete workflow
router.delete('/:id', (0, auth_middleware_1.requirePermission)('workflows:delete'), async (req, res) => {
    try {
        const workflow = await prisma.workflow.findFirst({
            where: {
                id: req.params.id,
                tenantId: req.user.tenantId,
            },
        });
        if (!workflow) {
            throw new error_handler_1.NotFoundError('Workflow not found');
        }
        // Check if workflow has active instances
        const activeInstances = await prisma.workflowInstance.count({
            where: {
                workflowId: req.params.id,
                status: { in: ['PENDING', 'RUNNING'] },
            },
        });
        if (activeInstances > 0) {
            throw new error_handler_1.ValidationError('Cannot delete workflow with active instances');
        }
        await prisma.workflow.delete({
            where: { id: req.params.id },
        });
        (0, logger_1.logAudit)('workflow_deleted', req.user.userId, 'workflow', req.params.id, {
            workflowName: workflow.name,
        });
        res.json({
            success: true,
            message: 'Workflow deleted successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Error deleting workflow:', error);
        throw error;
    }
});
// Start workflow instance
router.post('/:id/instances', (0, auth_middleware_1.requirePermission)('workflows:write'), async (req, res) => {
    try {
        const { error, value } = startInstanceSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid instance data', error.details);
        }
        const instance = await workflowEngine.startWorkflowInstance(req.params.id, value.data, req.user.tenantId);
        (0, logger_1.logAudit)('workflow_instance_started', req.user.userId, 'workflow_instance', instance.id, {
            workflowId: req.params.id,
        });
        res.status(201).json({
            success: true,
            data: instance,
        });
    }
    catch (error) {
        logger_1.logger.error('Error starting workflow instance:', error);
        throw error;
    }
});
// Get workflow instances
router.get('/:id/instances', (0, auth_middleware_1.requirePermission)('workflows:read'), async (req, res) => {
    try {
        const instances = await workflowEngine.getWorkflowInstances(req.params.id, req.user.tenantId);
        res.json({
            success: true,
            data: instances,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching workflow instances:', error);
        throw error;
    }
});
// Get user tasks
router.get('/tasks/assigned', (0, auth_middleware_1.requirePermission)('workflows:read'), async (req, res) => {
    try {
        const { status } = req.query;
        const tasks = await workflowEngine.getTasksForUser(req.user.userId, req.user.tenantId, status);
        res.json({
            success: true,
            data: tasks,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching user tasks:', error);
        throw error;
    }
});
// Complete task
router.post('/tasks/:taskId/complete', (0, auth_middleware_1.requirePermission)('workflows:write'), async (req, res) => {
    try {
        const { error, value } = completeTaskSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid task completion data', error.details);
        }
        const task = await workflowEngine.completeTask(req.params.taskId, req.user.userId, value.data);
        (0, logger_1.logAudit)('task_completed', req.user.userId, 'workflow_task', req.params.taskId, {
            workflowId: task.workflowId,
            instanceId: task.instanceId,
        });
        res.json({
            success: true,
            data: task,
        });
    }
    catch (error) {
        logger_1.logger.error('Error completing task:', error);
        throw error;
    }
});
// Assign task
router.post('/tasks/:taskId/assign', (0, auth_middleware_1.requirePermission)('workflows:write'), async (req, res) => {
    try {
        const { error, value } = assignTaskSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid task assignment data', error.details);
        }
        const task = await workflowEngine.assignTask(req.params.taskId, value.assigneeId);
        (0, logger_1.logAudit)('task_assigned', req.user.userId, 'workflow_task', req.params.taskId, {
            assigneeId: value.assigneeId,
            workflowId: task.workflowId,
            instanceId: task.instanceId,
        });
        res.json({
            success: true,
            data: task,
        });
    }
    catch (error) {
        logger_1.logger.error('Error assigning task:', error);
        throw error;
    }
});
// Get task details
router.get('/tasks/:taskId', (0, auth_middleware_1.requirePermission)('workflows:read'), async (req, res) => {
    try {
        const task = await prisma.workflowTask.findFirst({
            where: {
                id: req.params.taskId,
                tenantId: req.user.tenantId,
            },
            include: {
                workflow: {
                    select: { id: true, name: true, description: true },
                },
                instance: {
                    select: { id: true, status: true, startedAt: true, data: true },
                },
                assignee: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
                completer: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });
        if (!task) {
            throw new error_handler_1.NotFoundError('Task not found');
        }
        res.json({
            success: true,
            data: task,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching task:', error);
        throw error;
    }
});
//# sourceMappingURL=workflow.routes.js.map