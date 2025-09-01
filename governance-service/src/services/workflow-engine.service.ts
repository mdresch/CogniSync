import { CronJob } from 'cron';
import { PrismaClient, Workflow, WorkflowInstance, WorkflowTask, TaskStatus, WorkflowInstanceStatus } from '@prisma/client';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import cron from 'cron';
import { logger } from '../utils/logger';
import { NotificationService } from './notification.service';

export interface WorkflowDefinition {
  steps: WorkflowStep[];
  conditions?: WorkflowCondition[];
  settings?: WorkflowSettings;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'approval' | 'review' | 'automation' | 'notification' | 'data_entry' | 'custom';
  assignee?: string | string[];
  config?: any;
  nextSteps?: string[];
  conditions?: WorkflowCondition[];
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'exists';
  value: any;
  nextStep?: string;
}

export interface WorkflowSettings {
  autoStart?: boolean;
  timeout?: number;
  retryAttempts?: number;
  escalation?: EscalationRule[];
}

export interface EscalationRule {
  afterHours: number;
  assignTo: string | string[];
  notificationType: string;
}

export class WorkflowEngine extends EventEmitter {
  private prisma: PrismaClient;
  private notificationService: NotificationService;
  private activeInstances: Map<string, WorkflowInstance> = new Map();
  private cronJobs: Map<string, CronJob> = new Map();
  private wsConnections: Map<string, WebSocket[]> = new Map();

  constructor(prisma: PrismaClient, notificationService: NotificationService) {
    super();
    this.prisma = prisma;
    this.notificationService = notificationService;
  }

  async start(): Promise<void> {
    logger.info('Starting Workflow Engine...');
    
    // Load active workflow instances
    await this.loadActiveInstances();
    
    // Start monitoring for overdue tasks
    this.startTaskMonitoring();
    
    logger.info('Workflow Engine started successfully');
  }

  async stop(): Promise<void> {
    logger.info('Stopping Workflow Engine...');
    
    // Stop all cron jobs
    this.cronJobs.forEach(job => job.stop());
    this.cronJobs.clear();
    
    // Clear active instances
    this.activeInstances.clear();
    
    logger.info('Workflow Engine stopped');
  }

  // A061: Create and manage workflows
  async createWorkflow(workflowData: {
    name: string;
    description?: string;
    definition: WorkflowDefinition;
    createdBy: string;
    tenantId: string;
  }): Promise<Workflow> {
    try {
      const workflow = await this.prisma.workflow.create({
        data: {
          name: workflowData.name,
          description: workflowData.description,
          definition: workflowData.definition as any,
          createdBy: workflowData.createdBy,
          tenantId: workflowData.tenantId,
        },
      });

      logger.info(`Workflow created: ${workflow.id}`);
      return workflow;
    } catch (error) {
      logger.error('Error creating workflow:', error);
      throw error;
    }
  }

  async startWorkflowInstance(workflowId: string, data?: any, tenantId?: string): Promise<WorkflowInstance> {
    try {
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        include: { creator: true },
      });

      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }

      if (!workflow.isActive) {
        throw new Error(`Workflow is not active: ${workflowId}`);
      }

      const instance = await this.prisma.workflowInstance.create({
        data: {
          workflowId,
          data: data || {},
          tenantId: tenantId || workflow.tenantId,
        },
      });

      // Add to active instances
      this.activeInstances.set(instance.id, instance);

      // Create initial tasks
      await this.createInitialTasks(workflow, instance);

      // Emit event
      this.emit('instanceStarted', { workflow, instance });

      // Notify via WebSocket
      this.notifyWorkflowUpdate(workflowId, {
        type: 'instance_started',
        instanceId: instance.id,
        status: instance.status,
      });

      logger.info(`Workflow instance started: ${instance.id}`);
      return instance;
    } catch (error) {
      logger.error('Error starting workflow instance:', error);
      throw error;
    }
  }

  async completeTask(taskId: string, completedBy: string, data?: any): Promise<WorkflowTask> {
    try {
      const task = await this.prisma.workflowTask.findUnique({
        where: { id: taskId },
        include: {
          workflow: true,
          instance: true,
          assignee: true,
        },
      });

      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.IN_PROGRESS) {
        throw new Error(`Task cannot be completed in current status: ${task.status}`);
      }

      // Update task
      const updatedTask = await this.prisma.workflowTask.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.COMPLETED,
          completedBy,
          completedAt: new Date(),
          data: (data && typeof task.data === 'object' && task.data !== null) ? { ...task.data, ...data } : task.data,
        },
      });

      // Process next steps
      await this.processNextSteps(task.workflow, task.instance, updatedTask);

      // Send notification
      if (task.assignee) {
        await this.notificationService.sendNotification({
          userId: task.assignee.id,
          type: 'TASK_COMPLETED',
          title: 'Task Completed',
          message: `Task "${task.name}" has been completed`,
          data: { taskId, workflowId: task.workflowId, instanceId: task.instanceId },
          tenantId: task.tenantId,
        });
      }

      // Emit event
      this.emit('taskCompleted', { task: updatedTask });

      // Notify via WebSocket
      this.notifyWorkflowUpdate(task.workflowId, {
        type: 'task_completed',
        taskId,
        instanceId: task.instanceId,
        status: updatedTask.status,
      });

      logger.info(`Task completed: ${taskId}`);
      return updatedTask;
    } catch (error) {
      logger.error('Error completing task:', error);
      throw error;
    }
  }

  async assignTask(taskId: string, assigneeId: string): Promise<WorkflowTask> {
    try {
      const task = await this.prisma.workflowTask.update({
        where: { id: taskId },
        data: {
          assigneeId,
          status: TaskStatus.IN_PROGRESS,
        },
        include: {
          assignee: true,
          workflow: true,
        },
      });

      // Send notification
      if (task.assignee) {
        await this.notificationService.sendNotification({
          userId: task.assignee.id,
          type: 'TASK_ASSIGNED',
          title: 'New Task Assigned',
          message: `You have been assigned task "${task.name}"`,
          data: { taskId, workflowId: task.workflowId, instanceId: task.instanceId },
          tenantId: task.tenantId,
        });
      }

      // Emit event
      this.emit('taskAssigned', { task });

      // Notify via WebSocket
      this.notifyWorkflowUpdate(task.workflowId, {
        type: 'task_assigned',
        taskId,
        assigneeId,
        status: task.status,
      });

      logger.info(`Task assigned: ${taskId} to ${assigneeId}`);
      return task;
    } catch (error) {
      logger.error('Error assigning task:', error);
      throw error;
    }
  }

  async getWorkflowInstances(workflowId: string, tenantId: string): Promise<WorkflowInstance[]> {
    return this.prisma.workflowInstance.findMany({
      where: {
        workflowId,
        tenantId,
      },
      include: {
        tasks: {
          include: {
            assignee: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            completer: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
      orderBy: [ { startedAt: 'desc' } ],
    });
  }

  async getTasksForUser(userId: string, tenantId: string, status?: TaskStatus): Promise<WorkflowTask[]> {
    const where: any = {
      assigneeId: userId,
      tenantId,
    };

    if (status) {
      where.status = status;
    }

    return this.prisma.workflowTask.findMany({
      where,
      include: {
        workflow: {
          select: { id: true, name: true, description: true },
        },
        instance: {
          select: { id: true, status: true, startedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // WebSocket subscription for real-time updates
  async subscribeToUpdates(ws: WebSocket, workflowId: string): Promise<void> {
    if (!this.wsConnections.has(workflowId)) {
      this.wsConnections.set(workflowId, []);
    }
    this.wsConnections.get(workflowId)!.push(ws);

    ws.on('close', () => {
      const connections = this.wsConnections.get(workflowId);
      if (connections) {
        const index = connections.indexOf(ws);
        if (index > -1) {
          connections.splice(index, 1);
        }
      }
    });
  }

  private async loadActiveInstances(): Promise<void> {
    const instances = await this.prisma.workflowInstance.findMany({
      where: {
        status: {
          in: [WorkflowInstanceStatus.PENDING, WorkflowInstanceStatus.RUNNING],
        },
      },
    });

    instances.forEach(instance => {
      this.activeInstances.set(instance.id, instance);
    });

    logger.info(`Loaded ${instances.length} active workflow instances`);
  }

  private startTaskMonitoring(): void {
    // Check for overdue tasks every hour
    const job = new CronJob('0 * * * *', async () => {
      await this.checkOverdueTasks();
    });

    job.start();
    this.cronJobs.set('task-monitoring', job);
  }

  private async checkOverdueTasks(): Promise<void> {
    try {
      const overdueTasks = await this.prisma.workflowTask.findMany({
        where: {
          status: {
            in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS],
          },
          dueDate: {
            lt: new Date(),
          },
        },
        include: {
          assignee: true,
          workflow: true,
        },
      });

      for (const task of overdueTasks) {
        // Update task status
        await this.prisma.workflowTask.update({
          where: { id: task.id },
          data: { status: TaskStatus.OVERDUE },
        });

        // Send notification
        if (task.assignee) {
          await this.notificationService.sendNotification({
            userId: task.assignee.id,
            type: 'REMINDER',
            title: 'Task Overdue',
            message: `Task "${task.name}" is overdue`,
            priority: 'HIGH',
            data: { taskId: task.id, workflowId: task.workflowId },
            tenantId: task.tenantId,
          });
        }

        // Process escalation rules
        await this.processEscalation(task);
      }

      if (overdueTasks.length > 0) {
        logger.info(`Processed ${overdueTasks.length} overdue tasks`);
      }
    } catch (error) {
      logger.error('Error checking overdue tasks:', error);
    }
  }

  private async createInitialTasks(workflow: Workflow, instance: WorkflowInstance): Promise<void> {
  const definition = (workflow.definition as unknown) as WorkflowDefinition;
    const initialSteps = definition.steps.filter(step => 
      !definition.steps.some(s => s.nextSteps?.includes(step.id))
    );

    for (const step of initialSteps) {
      await this.createTask(workflow, instance, step);
    }
  }

  private async createTask(workflow: Workflow, instance: WorkflowInstance, step: WorkflowStep): Promise<WorkflowTask> {
    const dueDate = step.config?.dueInHours 
      ? new Date(Date.now() + step.config.dueInHours * 60 * 60 * 1000)
      : undefined;

    return this.prisma.workflowTask.create({
      data: {
        workflowId: workflow.id,
        instanceId: instance.id,
        name: step.name,
        description: step.config?.description,
        type: step.type.toUpperCase() as any,
        assigneeId: Array.isArray(step.assignee) ? step.assignee[0] : step.assignee,
        data: step.config || {},
        dueDate,
        tenantId: instance.tenantId,
      },
    });
  }

  private async processNextSteps(workflow: Workflow, instance: WorkflowInstance, completedTask: WorkflowTask): Promise<void> {
  const definition = (workflow.definition as unknown) as WorkflowDefinition;
    const currentStep = definition.steps.find(s => s.name === completedTask.name);

    if (!currentStep?.nextSteps) {
      // Check if this was the last task
      const pendingTasks = await this.prisma.workflowTask.count({
        where: {
          instanceId: instance.id,
          status: {
            in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS],
          },
        },
      });

      if (pendingTasks === 0) {
        // Complete the workflow instance
        await this.prisma.workflowInstance.update({
          where: { id: instance.id },
          data: {
            status: WorkflowInstanceStatus.COMPLETED,
            completedAt: new Date(),
          },
        });

        this.activeInstances.delete(instance.id);
        this.emit('instanceCompleted', { workflow, instance });
      }
      return;
    }

    // Create next tasks
    for (const nextStepId of currentStep.nextSteps) {
      const nextStep = definition.steps.find(s => s.id === nextStepId);
      if (nextStep) {
        // Check conditions if any
        if (this.evaluateConditions(nextStep.conditions, completedTask.data)) {
          await this.createTask(workflow, instance, nextStep);
        }
      }
    }
  }

  private evaluateConditions(conditions?: WorkflowCondition[], data?: any): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    return conditions.every(condition => {
      const value = data?.[condition.field];
      
      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'not_equals':
          return value !== condition.value;
        case 'greater_than':
          return value > condition.value;
        case 'less_than':
          return value < condition.value;
        case 'contains':
          return Array.isArray(value) ? value.includes(condition.value) : 
                 typeof value === 'string' ? value.includes(condition.value) : false;
        case 'exists':
          return value !== undefined && value !== null;
        default:
          return false;
      }
    });
  }

  private async processEscalation(task: WorkflowTask): Promise<void> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: task.workflowId },
    });

    if (!workflow) return;

  const definition = (workflow.definition as unknown) as WorkflowDefinition;
    const escalationRules = definition.settings?.escalation;

    if (!escalationRules) return;

    const taskAge = Date.now() - task.createdAt.getTime();
    const hoursOverdue = Math.floor(taskAge / (1000 * 60 * 60));

    for (const rule of escalationRules) {
      if (hoursOverdue >= rule.afterHours) {
        const assignees = Array.isArray(rule.assignTo) ? rule.assignTo : [rule.assignTo];
        
        for (const assigneeId of assignees) {
          await this.notificationService.sendNotification({
            userId: assigneeId,
            type: 'SYSTEM_ALERT',
            title: 'Task Escalation',
            message: `Task "${task.name}" has been escalated due to being overdue`,
            priority: 'HIGH',
            data: { taskId: task.id, workflowId: task.workflowId, originalAssignee: task.assigneeId },
            tenantId: task.tenantId,
          });
        }
      }
    }
  }

  private notifyWorkflowUpdate(workflowId: string, update: any): void {
    const connections = this.wsConnections.get(workflowId);
    if (connections) {
      const message = JSON.stringify({
        type: 'workflow_update',
        workflowId,
        ...update,
      });

      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }
}