import { PrismaClient, Report, ReportExecution, ReportType, ReportFormat, ReportExecutionStatus } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import cron from 'cron';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { logger } from '../utils/logger';
import { NotificationService } from './notification.service';

export interface CreateReportRequest {
  name: string;
  description?: string;
  type: ReportType;
  query: any;
  schedule?: string;
  format: ReportFormat;
  tenantId: string;
}

export interface ReportQuery {
  dataSource: string;
  filters?: any;
  groupBy?: string[];
  aggregations?: any;
  dateRange?: { start: Date; end: Date };
  limit?: number;
}

export interface ReportData {
  headers: string[];
  rows: any[][];
  metadata: {
    totalRecords: number;
    generatedAt: Date;
    filters: any;
  };
}

export class ReportingService {
  private prisma: PrismaClient;
  private notificationService: NotificationService;
  private reportsPath: string;
  private cronJobs: Map<string, cron.CronJob> = new Map();

  constructor(prisma: PrismaClient, notificationService: NotificationService) {
    this.prisma = prisma;
    this.notificationService = notificationService;
    this.reportsPath = process.env.REPORTS_PATH || './reports';
    this.ensureReportsDirectory();
  }

  async start(): Promise<void> {
    logger.info('Starting Reporting Service...');
    
    // Load and schedule existing reports
    await this.loadScheduledReports();
    
    logger.info('Reporting Service started successfully');
  }

  async stop(): Promise<void> {
    logger.info('Stopping Reporting Service...');
    
    // Stop all cron jobs
    this.cronJobs.forEach(job => job.stop());
    this.cronJobs.clear();
    
    logger.info('Reporting Service stopped');
  }

  // A067: Create Report
  async createReport(reportData: CreateReportRequest): Promise<Report> {
    try {
      const report = await this.prisma.report.create({
        data: {
          name: reportData.name,
          description: reportData.description,
          type: reportData.type,
          query: reportData.query as any,
          schedule: reportData.schedule,
          format: reportData.format,
          tenantId: reportData.tenantId,
        },
      });

      // Schedule report if it has a schedule
      if (reportData.schedule) {
        await this.scheduleReport(report);
      }

      logger.info(`Report created: ${report.id} (${report.name})`);
      return report;
    } catch (error) {
      logger.error('Error creating report:', error);
      throw error;
    }
  }

  async updateReport(reportId: string, updateData: Partial<CreateReportRequest>, tenantId: string): Promise<Report> {
    try {
      const existingReport = await this.prisma.report.findFirst({
        where: { id: reportId, tenantId },
      });

      if (!existingReport) {
        throw new Error('Report not found');
      }

      // Stop existing schedule if it exists
      if (this.cronJobs.has(reportId)) {
        this.cronJobs.get(reportId)!.stop();
        this.cronJobs.delete(reportId);
      }

      const report = await this.prisma.report.update({
        where: { id: reportId },
        data: {
          name: updateData.name,
          description: updateData.description,
          type: updateData.type,
          query: updateData.query as any,
          schedule: updateData.schedule,
          format: updateData.format,
          updatedAt: new Date(),
        },
      });

      // Reschedule if needed
      if (updateData.schedule) {
        await this.scheduleReport(report);
      }

      logger.info(`Report updated: ${reportId}`);
      return report;
    } catch (error) {
      logger.error('Error updating report:', error);
      throw error;
    }
  }

  async deleteReport(reportId: string, tenantId: string): Promise<void> {
    try {
      const report = await this.prisma.report.findFirst({
        where: { id: reportId, tenantId },
      });

      if (!report) {
        throw new Error('Report not found');
      }

      // Stop scheduled job if exists
      if (this.cronJobs.has(reportId)) {
        this.cronJobs.get(reportId)!.stop();
        this.cronJobs.delete(reportId);
      }

      // Delete report files
      const executions = await this.prisma.reportExecution.findMany({
        where: { reportId },
      });

      for (const execution of executions) {
        if (execution.filePath) {
          try {
            await fs.unlink(execution.filePath);
          } catch (error) {
            logger.warn('Could not delete report file:', error);
          }
        }
      }

      // Delete report
      await this.prisma.report.delete({
        where: { id: reportId },
      });

      logger.info(`Report deleted: ${reportId}`);
    } catch (error) {
      logger.error('Error deleting report:', error);
      throw error;
    }
  }

  // A067: Generate Report
  async generateReport(reportId: string, tenantId: string, parameters?: any): Promise<ReportExecution> {
    try {
      const report = await this.prisma.report.findFirst({
        where: { id: reportId, tenantId },
      });

      if (!report) {
        throw new Error('Report not found');
      }

      // Create execution record
      const execution = await this.prisma.reportExecution.create({
        data: {
          reportId,
          status: ReportExecutionStatus.RUNNING,
          tenantId,
        },
      });

      try {
        // Generate report data
        const reportData = await this.executeReportQuery(report, parameters);

        // Generate file based on format
        const filePath = await this.generateReportFile(report, reportData, execution.id);

        // Get file size
        const stats = await fs.stat(filePath);

        // Update execution with success
        const completedExecution = await this.prisma.reportExecution.update({
          where: { id: execution.id },
          data: {
            status: ReportExecutionStatus.COMPLETED,
            completedAt: new Date(),
            filePath,
            fileSize: stats.size,
          },
        });

        logger.info(`Report generated: ${reportId} (execution: ${execution.id})`);
        return completedExecution;
      } catch (error) {
        // Update execution with failure
        await this.prisma.reportExecution.update({
          where: { id: execution.id },
          data: {
            status: ReportExecutionStatus.FAILED,
            completedAt: new Date(),
            error: error.message,
          },
        });

        throw error;
      }
    } catch (error) {
      logger.error('Error generating report:', error);
      throw error;
    }
  }

  async getReports(tenantId: string, filters?: {
    type?: ReportType;
    isActive?: boolean;
    search?: string;
  }): Promise<Report[]> {
    const where: any = { tenantId };

    if (filters) {
      if (filters.type) {
        where.type = filters.type;
      }

      if (filters.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }
    }

    return this.prisma.report.findMany({
      where,
      include: {
        subscriptions: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getReportExecutions(reportId: string, tenantId: string): Promise<ReportExecution[]> {
    return this.prisma.reportExecution.findMany({
      where: { reportId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReportFile(executionId: string, tenantId: string): Promise<{ filePath: string; fileName: string } | null> {
    const execution = await this.prisma.reportExecution.findFirst({
      where: { id: executionId, tenantId },
      include: { report: true },
    });

    if (!execution || !execution.filePath) {
      return null;
    }

    return {
      filePath: execution.filePath,
      fileName: `${execution.report.name}_${execution.createdAt.toISOString().split('T')[0]}.${this.getFileExtension(execution.report.format)}`,
    };
  }

  // A067: Report Subscriptions
  async subscribeToReport(reportId: string, userId: string, email: string, tenantId: string): Promise<void> {
    try {
      await this.prisma.reportSubscription.create({
        data: {
          reportId,
          userId,
          email,
          tenantId,
        },
      });

      logger.info(`User ${userId} subscribed to report ${reportId}`);
    } catch (error) {
      logger.error('Error subscribing to report:', error);
      throw error;
    }
  }

  async unsubscribeFromReport(reportId: string, userId: string, tenantId: string): Promise<void> {
    try {
      await this.prisma.reportSubscription.delete({
        where: {
          reportId_userId: { reportId, userId },
          tenantId,
        },
      });

      logger.info(`User ${userId} unsubscribed from report ${reportId}`);
    } catch (error) {
      logger.error('Error unsubscribing from report:', error);
      throw error;
    }
  }

  // A067: Standard Reports
  async getStandardReports(tenantId: string): Promise<any[]> {
    const standardReports = [
      {
        id: 'workflow-performance',
        name: 'Workflow Performance Report',
        description: 'Analysis of workflow completion times and success rates',
        type: ReportType.STANDARD,
        query: {
          dataSource: 'workflows',
          aggregations: ['completion_time', 'success_rate'],
          groupBy: ['workflow_name'],
        },
      },
      {
        id: 'user-activity',
        name: 'User Activity Report',
        description: 'User login and activity statistics',
        type: ReportType.STANDARD,
        query: {
          dataSource: 'users',
          aggregations: ['login_count', 'task_completion_count'],
          groupBy: ['user_id'],
        },
      },
      {
        id: 'document-compliance',
        name: 'Document Compliance Report',
        description: 'Document approval status and compliance metrics',
        type: ReportType.STANDARD,
        query: {
          dataSource: 'documents',
          aggregations: ['approval_rate', 'compliance_score'],
          groupBy: ['document_type'],
        },
      },
      {
        id: 'system-usage',
        name: 'System Usage Report',
        description: 'Overall system usage and performance metrics',
        type: ReportType.STANDARD,
        query: {
          dataSource: 'system',
          aggregations: ['api_calls', 'response_time', 'error_rate'],
          groupBy: ['service'],
        },
      },
    ];

    return standardReports;
  }

  // A067: Custom Report Builder
  async buildCustomReport(query: ReportQuery, tenantId: string): Promise<ReportData> {
    try {
      const reportData = await this.executeReportQuery({ query } as any);
      return reportData;
    } catch (error) {
      logger.error('Error building custom report:', error);
      throw error;
    }
  }

  private async executeReportQuery(report: Report, parameters?: any): Promise<ReportData> {
    const query = report.query as ReportQuery;
    
    // Apply parameters to query
    const finalQuery = { ...query };
    if (parameters) {
      finalQuery.filters = { ...finalQuery.filters, ...parameters };
    }

    // Execute query based on data source
    switch (finalQuery.dataSource) {
      case 'workflows':
        return this.executeWorkflowQuery(finalQuery);
      case 'users':
        return this.executeUserQuery(finalQuery);
      case 'documents':
        return this.executeDocumentQuery(finalQuery);
      case 'tasks':
        return this.executeTaskQuery(finalQuery);
      case 'notifications':
        return this.executeNotificationQuery(finalQuery);
      default:
        throw new Error(`Unsupported data source: ${finalQuery.dataSource}`);
    }
  }

  private async executeWorkflowQuery(query: ReportQuery): Promise<ReportData> {
    // Build Prisma query for workflows
    const where: any = {};
    
    if (query.filters) {
      Object.assign(where, query.filters);
    }

    if (query.dateRange) {
      where.createdAt = {
        gte: query.dateRange.start,
        lte: query.dateRange.end,
      };
    }

    const workflows = await this.prisma.workflow.findMany({
      where,
      include: {
        instances: {
          include: {
            tasks: true,
          },
        },
        creator: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      take: query.limit || 1000,
    });

    // Process data based on groupBy and aggregations
    const headers = ['Workflow Name', 'Creator', 'Total Instances', 'Completed Instances', 'Success Rate', 'Avg Completion Time'];
    const rows = workflows.map(workflow => {
      const totalInstances = workflow.instances.length;
      const completedInstances = workflow.instances.filter(i => i.status === 'COMPLETED').length;
      const successRate = totalInstances > 0 ? (completedInstances / totalInstances * 100).toFixed(2) + '%' : '0%';
      
      // Calculate average completion time
      const completedWithTime = workflow.instances.filter(i => i.completedAt);
      const avgCompletionTime = completedWithTime.length > 0 
        ? completedWithTime.reduce((sum, i) => sum + (i.completedAt!.getTime() - i.startedAt.getTime()), 0) / completedWithTime.length / (1000 * 60 * 60)
        : 0;

      return [
        workflow.name,
        `${workflow.creator.firstName} ${workflow.creator.lastName}`,
        totalInstances,
        completedInstances,
        successRate,
        `${avgCompletionTime.toFixed(2)} hours`,
      ];
    });

    return {
      headers,
      rows,
      metadata: {
        totalRecords: workflows.length,
        generatedAt: new Date(),
        filters: query.filters || {},
      },
    };
  }

  private async executeUserQuery(query: ReportQuery): Promise<ReportData> {
    const where: any = {};
    
    if (query.filters) {
      Object.assign(where, query.filters);
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        assignedTasks: true,
        completedTasks: true,
        roles: {
          include: { role: true },
        },
      },
      take: query.limit || 1000,
    });

    const headers = ['Name', 'Email', 'Roles', 'Assigned Tasks', 'Completed Tasks', 'Last Login', 'Status'];
    const rows = users.map(user => [
      `${user.firstName} ${user.lastName}`,
      user.email,
      user.roles.map(r => r.role.name).join(', '),
      user.assignedTasks.length,
      user.completedTasks.length,
      user.lastLogin ? user.lastLogin.toISOString().split('T')[0] : 'Never',
      user.isActive ? 'Active' : 'Inactive',
    ]);

    return {
      headers,
      rows,
      metadata: {
        totalRecords: users.length,
        generatedAt: new Date(),
        filters: query.filters || {},
      },
    };
  }

  private async executeDocumentQuery(query: ReportQuery): Promise<ReportData> {
    const where: any = {};
    
    if (query.filters) {
      Object.assign(where, query.filters);
    }

    const documents = await this.prisma.document.findMany({
      where,
      include: {
        creator: {
          select: { firstName: true, lastName: true, email: true },
        },
        approvals: true,
        versions: true,
      },
      take: query.limit || 1000,
    });

    const headers = ['Title', 'Type', 'Status', 'Creator', 'Version', 'Approvals', 'Created', 'Last Updated'];
    const rows = documents.map(doc => {
      const pendingApprovals = doc.approvals.filter(a => a.status === 'PENDING').length;
      const approvedApprovals = doc.approvals.filter(a => a.status === 'APPROVED').length;
      const approvalStatus = `${approvedApprovals}/${doc.approvals.length} approved`;

      return [
        doc.title,
        doc.type,
        doc.status,
        `${doc.creator.firstName} ${doc.creator.lastName}`,
        doc.version,
        approvalStatus,
        doc.createdAt.toISOString().split('T')[0],
        doc.updatedAt.toISOString().split('T')[0],
      ];
    });

    return {
      headers,
      rows,
      metadata: {
        totalRecords: documents.length,
        generatedAt: new Date(),
        filters: query.filters || {},
      },
    };
  }

  private async executeTaskQuery(query: ReportQuery): Promise<ReportData> {
    const where: any = {};
    
    if (query.filters) {
      Object.assign(where, query.filters);
    }

    const tasks = await this.prisma.workflowTask.findMany({
      where,
      include: {
        workflow: {
          select: { name: true },
        },
        assignee: {
          select: { firstName: true, lastName: true, email: true },
        },
        completer: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      take: query.limit || 1000,
    });

    const headers = ['Task Name', 'Workflow', 'Type', 'Status', 'Assignee', 'Due Date', 'Completed By', 'Completion Time'];
    const rows = tasks.map(task => {
      const completionTime = task.completedAt && task.createdAt 
        ? `${((task.completedAt.getTime() - task.createdAt.getTime()) / (1000 * 60 * 60)).toFixed(2)} hours`
        : 'N/A';

      return [
        task.name,
        task.workflow.name,
        task.type,
        task.status,
        task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : 'Unassigned',
        task.dueDate ? task.dueDate.toISOString().split('T')[0] : 'No due date',
        task.completer ? `${task.completer.firstName} ${task.completer.lastName}` : 'N/A',
        completionTime,
      ];
    });

    return {
      headers,
      rows,
      metadata: {
        totalRecords: tasks.length,
        generatedAt: new Date(),
        filters: query.filters || {},
      },
    };
  }

  private async executeNotificationQuery(query: ReportQuery): Promise<ReportData> {
    const where: any = {};
    
    if (query.filters) {
      Object.assign(where, query.filters);
    }

    const notifications = await this.prisma.notification.findMany({
      where,
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      take: query.limit || 1000,
    });

    const headers = ['Title', 'Type', 'Priority', 'User', 'Status', 'Created', 'Read At'];
    const rows = notifications.map(notification => [
      notification.title,
      notification.type,
      notification.priority,
      `${notification.user.firstName} ${notification.user.lastName}`,
      notification.status,
      notification.createdAt.toISOString().split('T')[0],
      notification.readAt ? notification.readAt.toISOString().split('T')[0] : 'Unread',
    ]);

    return {
      headers,
      rows,
      metadata: {
        totalRecords: notifications.length,
        generatedAt: new Date(),
        filters: query.filters || {},
      },
    };
  }

  private async generateReportFile(report: Report, data: ReportData, executionId: string): Promise<string> {
    const fileName = `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}_${executionId}.${this.getFileExtension(report.format)}`;
    const filePath = path.join(this.reportsPath, fileName);

    switch (report.format) {
      case ReportFormat.PDF:
        await this.generatePDFReport(data, filePath, report.name);
        break;
      case ReportFormat.EXCEL:
        await this.generateExcelReport(data, filePath, report.name);
        break;
      case ReportFormat.CSV:
        await this.generateCSVReport(data, filePath);
        break;
      case ReportFormat.JSON:
        await this.generateJSONReport(data, filePath);
        break;
      default:
        throw new Error(`Unsupported report format: ${report.format}`);
    }

    return filePath;
  }

  private async generatePDFReport(data: ReportData, filePath: string, reportName: string): Promise<void> {
    const doc = new PDFDocument();
    const stream = require('fs').createWriteStream(filePath);
    doc.pipe(stream);

    // Title
    doc.fontSize(20).text(reportName, 50, 50);
    doc.fontSize(12).text(`Generated: ${data.metadata.generatedAt.toISOString()}`, 50, 80);
    doc.text(`Total Records: ${data.metadata.totalRecords}`, 50, 100);

    // Table headers
    let y = 140;
    const columnWidth = 80;
    data.headers.forEach((header, index) => {
      doc.text(header, 50 + index * columnWidth, y, { width: columnWidth - 5 });
    });

    // Table rows
    y += 20;
    data.rows.forEach(row => {
      row.forEach((cell, index) => {
        doc.text(String(cell), 50 + index * columnWidth, y, { width: columnWidth - 5 });
      });
      y += 15;
      
      // Add new page if needed
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
    });

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  private async generateExcelReport(data: ReportData, filePath: string, reportName: string): Promise<void> {
    const workbook = XLSX.utils.book_new();
    
    // Create worksheet data
    const wsData = [data.headers, ...data.rows];
    const worksheet = XLSX.utils.aoa_to_sheet(wsData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report Data');
    
    // Write file
    XLSX.writeFile(workbook, filePath);
  }

  private async generateCSVReport(data: ReportData, filePath: string): Promise<void> {
    const csvContent = [
      data.headers.join(','),
      ...data.rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    await fs.writeFile(filePath, csvContent, 'utf8');
  }

  private async generateJSONReport(data: ReportData, filePath: string): Promise<void> {
    const jsonData = {
      metadata: data.metadata,
      headers: data.headers,
      data: data.rows.map(row => {
        const obj: any = {};
        data.headers.forEach((header, index) => {
          obj[header] = row[index];
        });
        return obj;
      }),
    };

    await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
  }

  private getFileExtension(format: ReportFormat): string {
    switch (format) {
      case ReportFormat.PDF:
        return 'pdf';
      case ReportFormat.EXCEL:
        return 'xlsx';
      case ReportFormat.CSV:
        return 'csv';
      case ReportFormat.JSON:
        return 'json';
      default:
        return 'txt';
    }
  }

  private async scheduleReport(report: Report): Promise<void> {
    if (!report.schedule) return;

    try {
      const job = new cron.CronJob(report.schedule, async () => {
        try {
          const execution = await this.generateReport(report.id, report.tenantId);
          
          // Notify subscribers
          const subscriptions = await this.prisma.reportSubscription.findMany({
            where: { reportId: report.id, isActive: true },
            include: { user: true },
          });

          for (const subscription of subscriptions) {
            await this.notificationService.sendNotification({
              userId: subscription.userId,
              type: 'CUSTOM',
              title: 'Scheduled Report Generated',
              message: `Your scheduled report "${report.name}" has been generated`,
              data: { reportId: report.id, executionId: execution.id },
              tenantId: report.tenantId,
            });
          }

          logger.info(`Scheduled report generated: ${report.id}`);
        } catch (error) {
          logger.error(`Error generating scheduled report ${report.id}:`, error);
        }
      });

      job.start();
      this.cronJobs.set(report.id, job);

      logger.info(`Report scheduled: ${report.id} with schedule: ${report.schedule}`);
    } catch (error) {
      logger.error('Error scheduling report:', error);
      throw error;
    }
  }

  private async loadScheduledReports(): Promise<void> {
    const scheduledReports = await this.prisma.report.findMany({
      where: {
        schedule: { not: null },
        isActive: true,
      },
    });

    for (const report of scheduledReports) {
      await this.scheduleReport(report);
    }

    logger.info(`Loaded ${scheduledReports.length} scheduled reports`);
  }

  private async ensureReportsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.reportsPath, { recursive: true });
    } catch (error) {
      logger.error('Error creating reports directory:', error);
    }
  }
}