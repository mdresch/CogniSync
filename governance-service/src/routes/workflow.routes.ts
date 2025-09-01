import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, requirePermission } from '../middleware/auth.middleware';
import { enforceTenantIsolation } from '../middleware/tenant.middleware';
import { WorkflowEngine } from '../services/workflow-engine.service';
import { NotificationService } from '../services/notification.service';
import { logger, logAudit } from '../utils/logger';
import { ValidationError, NotFoundError } from '../middleware/error-handler';
import Joi from 'joi';

const router = Router();
const prisma = new PrismaClient();

// Initialize services
import { WebSocketServer } from 'ws';
// ... other imports

// Initialize WebSocketServer (ensure this is properly configured for your app)

// Initialize WebSocketServer (ensure this is properly configured for your app)
const wss = new WebSocketServer({ noServer: true });

// Pass required arguments to constructors
const notificationService = new NotificationService(prisma, wss);
const workflowEngine = new WorkflowEngine(prisma, notificationService);

// Validation schemas
const createWorkflowSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  description: Joi.string().optional().max(1000),
  definition: Joi.object({
    steps: Joi.array().items(Joi.object({
      id: Joi.string().required(),
      name: Joi.string().required(),
      type: Joi.string().valid('approval', 'review', 'automation', 'notification', 'data_entry', 'custom').required(),
      assignee: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
      config: Joi.object().optional(),
      nextSteps: Joi.array().items(Joi.string()).optional(),
      conditions: Joi.array().optional(),
    })).required(),
    conditions: Joi.array().optional(),
    settings: Joi.object().optional(),
  }).required(),
});

const updateWorkflowSchema = Joi.object({
  name: Joi.string().optional().min(1).max(255),
  description: Joi.string().optional().max(1000),
  definition: Joi.object().optional(),
  isActive: Joi.boolean().optional(),
});

const startInstanceSchema = Joi.object({
  data: Joi.object().optional(),
});

const completeTaskSchema = Joi.object({
  data: Joi.object().optional(),
});

const assignTaskSchema = Joi.object({
  assigneeId: Joi.string().required(),
});

// Apply middleware
router.use(enforceTenantIsolation);

// A061: Create workflow
router.post('/', requirePermission('workflows:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = createWorkflowSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid workflow data', error.details);
    }

    const workflow = await workflowEngine.createWorkflow({
      name: value.name,
      description: value.description,
      definition: value.definition,
      createdBy: req.user!.userId,
      tenantId: req.user!.tenantId,
    });

    logAudit('workflow_created', req.user!.userId, 'workflow', workflow.id, {
      workflowName: workflow.name,
    });

    res.status(201).json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    logger.error('Error creating workflow:', error);
    throw error;
  }
});

// Get workflows
router.get('/', requirePermission('workflows:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    
    const where: any = { tenantId: req.user!.tenantId };
    
    if (status) {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
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
  } catch (error) {
    logger.error('Error fetching workflows:', error);
    throw error;
  }
});

// Get workflow by ID
router.get('/:id', requirePermission('workflows:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workflow = await prisma.workflow.findFirst({
      where: { 
        id: req.params.id,
        tenantId: req.user!.tenantId,
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
      throw new NotFoundError('Workflow not found');
    }

    res.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    logger.error('Error fetching workflow:', error);
    throw error;
  }
});

// Update workflow
router.put('/:id', requirePermission('workflows:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = updateWorkflowSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid workflow data', error.details);
    }

    const existingWorkflow = await prisma.workflow.findFirst({
      where: { 
        id: req.params.id,
        tenantId: req.user!.tenantId,
      },
    });

    if (!existingWorkflow) {
      throw new NotFoundError('Workflow not found');
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

    logAudit('workflow_updated', req.user!.userId, 'workflow', workflow.id, {
      workflowName: workflow.name,
      changes: value,
    });

    res.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    logger.error('Error updating workflow:', error);
    throw error;
  }
});

// Delete workflow
router.delete('/:id', requirePermission('workflows:delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workflow = await prisma.workflow.findFirst({
      where: { 
        id: req.params.id,
        tenantId: req.user!.tenantId,
      },
    });

    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    // Check if workflow has active instances
    const activeInstances = await prisma.workflowInstance.count({
      where: {
        workflowId: req.params.id,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });

    if (activeInstances > 0) {
      throw new ValidationError('Cannot delete workflow with active instances');
    }

    await prisma.workflow.delete({
      where: { id: req.params.id },
    });

    logAudit('workflow_deleted', req.user!.userId, 'workflow', req.params.id, {
      workflowName: workflow.name,
    });

    res.json({
      success: true,
      message: 'Workflow deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting workflow:', error);
    throw error;
  }
});

// Start workflow instance
router.post('/:id/instances', requirePermission('workflows:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = startInstanceSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid instance data', error.details);
    }

    const instance = await workflowEngine.startWorkflowInstance(
      req.params.id,
      value.data,
      req.user!.tenantId
    );

    logAudit('workflow_instance_started', req.user!.userId, 'workflow_instance', instance.id, {
      workflowId: req.params.id,
    });

    res.status(201).json({
      success: true,
      data: instance,
    });
  } catch (error) {
    logger.error('Error starting workflow instance:', error);
    throw error;
  }
});

// Get workflow instances
router.get('/:id/instances', requirePermission('workflows:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const instances = await workflowEngine.getWorkflowInstances(req.params.id, req.user!.tenantId);

    res.json({
      success: true,
      data: instances,
    });
  } catch (error) {
    logger.error('Error fetching workflow instances:', error);
    throw error;
  }
});

// Get user tasks
router.get('/tasks/assigned', requirePermission('workflows:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.query;
    
    const tasks = await workflowEngine.getTasksForUser(
      req.user!.userId,
      req.user!.tenantId,
      status as any
    );

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    logger.error('Error fetching user tasks:', error);
    throw error;
  }
});

// Complete task
router.post('/tasks/:taskId/complete', requirePermission('workflows:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = completeTaskSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid task completion data', error.details);
    }

    const task = await workflowEngine.completeTask(
      req.params.taskId,
      req.user!.userId,
      value.data
    );

    logAudit('task_completed', req.user!.userId, 'workflow_task', req.params.taskId, {
      workflowId: task.workflowId,
      instanceId: task.instanceId,
    });

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    logger.error('Error completing task:', error);
    throw error;
  }
});

// Assign task
router.post('/tasks/:taskId/assign', requirePermission('workflows:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = assignTaskSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid task assignment data', error.details);
    }

    const task = await workflowEngine.assignTask(req.params.taskId, value.assigneeId);

    logAudit('task_assigned', req.user!.userId, 'workflow_task', req.params.taskId, {
      assigneeId: value.assigneeId,
      workflowId: task.workflowId,
      instanceId: task.instanceId,
    });

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    logger.error('Error assigning task:', error);
    throw error;
  }
});

// Get task details
router.get('/tasks/:taskId', requirePermission('workflows:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const task = await prisma.workflowTask.findFirst({
      where: {
        id: req.params.taskId,
        tenantId: req.user!.tenantId,
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
      throw new NotFoundError('Task not found');
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    logger.error('Error fetching task:', error);
    throw error;
  }
});

export { router as workflowRoutes };