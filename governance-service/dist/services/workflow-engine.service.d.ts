import { PrismaClient, Workflow, WorkflowInstance, WorkflowTask, TaskStatus } from '@prisma/client';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
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
export declare class WorkflowEngine extends EventEmitter {
    private prisma;
    private notificationService;
    private activeInstances;
    private cronJobs;
    private wsConnections;
    constructor(prisma: PrismaClient, notificationService: NotificationService);
    start(): Promise<void>;
    stop(): Promise<void>;
    createWorkflow(workflowData: {
        name: string;
        description?: string;
        definition: WorkflowDefinition;
        createdBy: string;
        tenantId: string;
    }): Promise<Workflow>;
    startWorkflowInstance(workflowId: string, data?: any, tenantId?: string): Promise<WorkflowInstance>;
    completeTask(taskId: string, completedBy: string, data?: any): Promise<WorkflowTask>;
    assignTask(taskId: string, assigneeId: string): Promise<WorkflowTask>;
    getWorkflowInstances(workflowId: string, tenantId: string): Promise<WorkflowInstance[]>;
    getTasksForUser(userId: string, tenantId: string, status?: TaskStatus): Promise<WorkflowTask[]>;
    subscribeToUpdates(ws: WebSocket, workflowId: string): Promise<void>;
    private loadActiveInstances;
    private startTaskMonitoring;
    private checkOverdueTasks;
    private createInitialTasks;
    private createTask;
    private processNextSteps;
    private evaluateConditions;
    private processEscalation;
    private notifyWorkflowUpdate;
}
//# sourceMappingURL=workflow-engine.service.d.ts.map