"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportingService = void 0;
const client_1 = require("@prisma/client");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const cron_1 = __importDefault(require("cron"));
// @ts-ignore
const pdfkit_1 = __importDefault(require("pdfkit"));
const XLSX = __importStar(require("xlsx"));
const logger_1 = require("../utils/logger");
class ReportingService {
    constructor(prisma, notificationService) {
        this.cronJobs = new Map();
        this.prisma = prisma;
        this.notificationService = notificationService;
        this.reportsPath = process.env.REPORTS_PATH || './reports';
        this.ensureReportsDirectory();
    }
    async start() {
        logger_1.logger.info('Starting Reporting Service...');
        // Load and schedule existing reports
        await this.loadScheduledReports();
        logger_1.logger.info('Reporting Service started successfully');
    }
    async stop() {
        logger_1.logger.info('Stopping Reporting Service...');
        // Stop all cron jobs
        this.cronJobs.forEach(job => job.stop());
        this.cronJobs.clear();
        logger_1.logger.info('Reporting Service stopped');
    }
    // A067: Create Report
    async createReport(reportData) {
        try {
            const report = await this.prisma.report.create({
                data: {
                    name: reportData.name,
                    description: reportData.description,
                    type: reportData.type,
                    query: reportData.query,
                    schedule: reportData.schedule,
                    format: reportData.format,
                    tenantId: reportData.tenantId,
                },
            });
            // Schedule report if it has a schedule
            if (reportData.schedule) {
                await this.scheduleReport(report);
            }
            logger_1.logger.info(`Report created: ${report.id} (${report.name})`);
            return report;
        }
        catch (error) {
            logger_1.logger.error('Error creating report:', error);
            throw error;
        }
    }
    async updateReport(reportId, updateData, tenantId) {
        try {
            const existingReport = await this.prisma.report.findFirst({
                where: { id: reportId, tenantId },
            });
            if (!existingReport) {
                throw new Error('Report not found');
            }
            // Stop existing schedule if it exists
            if (this.cronJobs.has(reportId)) {
                this.cronJobs.get(reportId).stop();
                this.cronJobs.delete(reportId);
            }
            const report = await this.prisma.report.update({
                where: { id: reportId },
                data: {
                    name: updateData.name,
                    description: updateData.description,
                    type: updateData.type,
                    query: updateData.query,
                    schedule: updateData.schedule,
                    format: updateData.format,
                    updatedAt: new Date(),
                },
            });
            // Reschedule if needed
            if (updateData.schedule) {
                await this.scheduleReport(report);
            }
            logger_1.logger.info(`Report updated: ${reportId}`);
            return report;
        }
        catch (error) {
            logger_1.logger.error('Error updating report:', error);
            throw error;
        }
    }
    async deleteReport(reportId, tenantId) {
        try {
            const report = await this.prisma.report.findFirst({
                where: { id: reportId, tenantId },
            });
            if (!report) {
                throw new Error('Report not found');
            }
            // Stop scheduled job if exists
            if (this.cronJobs.has(reportId)) {
                this.cronJobs.get(reportId).stop();
                this.cronJobs.delete(reportId);
            }
            // Delete report files
            const executions = await this.prisma.reportExecution.findMany({
                where: { reportId },
            });
            for (const execution of executions) {
                if (execution.filePath) {
                    try {
                        await fs_1.promises.unlink(execution.filePath);
                    }
                    catch (error) {
                        logger_1.logger.warn('Could not delete report file:', error);
                    }
                }
            }
            // Delete report
            await this.prisma.report.delete({
                where: { id: reportId },
            });
            logger_1.logger.info(`Report deleted: ${reportId}`);
        }
        catch (error) {
            logger_1.logger.error('Error deleting report:', error);
            throw error;
        }
    }
    // A067: Generate Report
    async generateReport(reportId, tenantId, parameters) {
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
                    status: client_1.ReportExecutionStatus.RUNNING,
                    tenantId,
                },
            });
            try {
                // Generate report data
                const reportData = await this.executeReportQuery(report, parameters);
                // Generate file based on format
                const filePath = await this.generateReportFile(report, reportData, execution.id);
                // Get file size
                const stats = await fs_1.promises.stat(filePath);
                // Update execution with success
                const completedExecution = await this.prisma.reportExecution.update({
                    where: { id: execution.id },
                    data: {
                        status: client_1.ReportExecutionStatus.COMPLETED,
                        completedAt: new Date(),
                        filePath,
                        fileSize: stats.size,
                    },
                });
                logger_1.logger.info(`Report generated: ${reportId} (execution: ${execution.id})`);
                return completedExecution;
            }
            catch (error) {
                // Update execution with failure
                await this.prisma.reportExecution.update({
                    where: { id: execution.id },
                    data: {
                        status: client_1.ReportExecutionStatus.FAILED,
                        completedAt: new Date(),
                        error: (error instanceof Error ? error.message : String(error)),
                    },
                });
                throw error;
            }
        }
        catch (error) {
            logger_1.logger.error('Error generating report:', error);
            throw error;
        }
    }
    async getReports(tenantId, filters) {
        const where = { tenantId };
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
                    orderBy: [{ startedAt: 'desc' }],
                    take: 5,
                },
            },
            orderBy: [{ updatedAt: 'desc' }],
        });
    }
    async getReportExecutions(reportId, tenantId) {
        return this.prisma.reportExecution.findMany({
            where: { reportId, tenantId },
            orderBy: [{ startedAt: 'desc' }],
        });
    }
    async getReportFile(executionId, tenantId) {
        const execution = await this.prisma.reportExecution.findFirst({
            where: { id: executionId, tenantId },
            include: { report: true },
        });
        if (!execution || !execution.filePath) {
            return null;
        }
        // Use execution.createdAt if available, else fallback to report.createdAt
        // Use execution.createdAt if available, else fallback to report.createdAt
        let createdAt;
        if ('createdAt' in execution && execution.createdAt) {
            createdAt = execution.createdAt;
        }
        else if (execution.report && 'createdAt' in execution.report && execution.report.createdAt) {
            createdAt = execution.report.createdAt;
        }
        else {
            createdAt = new Date();
        }
        return {
            filePath: execution.filePath,
            fileName: `${execution.report.name}_${createdAt.toISOString().split('T')[0]}.${this.getFileExtension(execution.report.format)}`,
        };
    }
    // A067: Report Subscriptions
    async subscribeToReport(reportId, userId, email, tenantId) {
        try {
            await this.prisma.reportSubscription.create({
                data: {
                    reportId,
                    userId,
                    email,
                    tenantId,
                },
            });
            logger_1.logger.info(`User ${userId} subscribed to report ${reportId}`);
        }
        catch (error) {
            logger_1.logger.error('Error subscribing to report:', error);
            throw error;
        }
    }
    async unsubscribeFromReport(reportId, userId, tenantId) {
        try {
            await this.prisma.reportSubscription.delete({
                where: {
                    reportId_userId: { reportId, userId },
                    tenantId,
                },
            });
            logger_1.logger.info(`User ${userId} unsubscribed from report ${reportId}`);
        }
        catch (error) {
            logger_1.logger.error('Error unsubscribing from report:', error);
            throw error;
        }
    }
    // A067: Standard Reports
    async getStandardReports(tenantId) {
        const standardReports = [
            {
                id: 'workflow-performance',
                name: 'Workflow Performance Report',
                description: 'Analysis of workflow completion times and success rates',
                type: client_1.ReportType.STANDARD,
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
                type: client_1.ReportType.STANDARD,
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
                type: client_1.ReportType.STANDARD,
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
                type: client_1.ReportType.STANDARD,
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
    async buildCustomReport(query, tenantId) {
        try {
            const reportData = await this.executeReportQuery({ query });
            return reportData;
        }
        catch (error) {
            logger_1.logger.error('Error building custom report:', error);
            throw error;
        }
    }
    async executeReportQuery(report, parameters) {
        const query = typeof report.query === 'object' && report.query !== null && 'dataSource' in report.query
            ? report.query
            : { dataSource: '', filters: {}, groupBy: [], aggregations: {}, dateRange: undefined, limit: 1000 };
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
    async executeWorkflowQuery(query) {
        // Build Prisma query for workflows
        const where = {};
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
                ? completedWithTime.reduce((sum, i) => sum + (i.completedAt.getTime() - i.startedAt.getTime()), 0) / completedWithTime.length / (1000 * 60 * 60)
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
    async executeUserQuery(query) {
        const where = {};
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
    async executeDocumentQuery(query) {
        const where = {};
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
    async executeTaskQuery(query) {
        const where = {};
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
    async executeNotificationQuery(query) {
        const where = {};
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
    async generateReportFile(report, data, executionId) {
        const fileName = `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}_${executionId}.${this.getFileExtension(report.format)}`;
        const filePath = path_1.default.join(this.reportsPath, fileName);
        switch (report.format) {
            case client_1.ReportFormat.PDF:
                await this.generatePDFReport(data, filePath, report.name);
                break;
            case client_1.ReportFormat.EXCEL:
                await this.generateExcelReport(data, filePath, report.name);
                break;
            case client_1.ReportFormat.CSV:
                await this.generateCSVReport(data, filePath);
                break;
            case client_1.ReportFormat.JSON:
                await this.generateJSONReport(data, filePath);
                break;
            default:
                throw new Error(`Unsupported report format: ${report.format}`);
        }
        return filePath;
    }
    async generatePDFReport(data, filePath, reportName) {
        const doc = new pdfkit_1.default();
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
    async generateExcelReport(data, filePath, reportName) {
        const workbook = XLSX.utils.book_new();
        // Create worksheet data
        const wsData = [data.headers, ...data.rows];
        const worksheet = XLSX.utils.aoa_to_sheet(wsData);
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Report Data');
        // Write file
        XLSX.writeFile(workbook, filePath);
    }
    async generateCSVReport(data, filePath) {
        const csvContent = [
            data.headers.join(','),
            ...data.rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        await fs_1.promises.writeFile(filePath, csvContent, 'utf8');
    }
    async generateJSONReport(data, filePath) {
        const jsonData = {
            metadata: data.metadata,
            headers: data.headers,
            data: data.rows.map(row => {
                const obj = {};
                data.headers.forEach((header, index) => {
                    obj[header] = row[index];
                });
                return obj;
            }),
        };
        await fs_1.promises.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
    }
    getFileExtension(format) {
        switch (format) {
            case client_1.ReportFormat.PDF:
                return 'pdf';
            case client_1.ReportFormat.EXCEL:
                return 'xlsx';
            case client_1.ReportFormat.CSV:
                return 'csv';
            case client_1.ReportFormat.JSON:
                return 'json';
            default:
                return 'txt';
        }
    }
    async scheduleReport(report) {
        if (!report.schedule)
            return;
        try {
            const job = new cron_1.default.CronJob(report.schedule, async () => {
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
                    logger_1.logger.info(`Scheduled report generated: ${report.id}`);
                }
                catch (error) {
                    logger_1.logger.error(`Error generating scheduled report ${report.id}:`, error);
                }
            });
            job.start();
            this.cronJobs.set(report.id, job);
            logger_1.logger.info(`Report scheduled: ${report.id} with schedule: ${report.schedule}`);
        }
        catch (error) {
            logger_1.logger.error('Error scheduling report:', error);
            throw error;
        }
    }
    async loadScheduledReports() {
        const scheduledReports = await this.prisma.report.findMany({
            where: {
                schedule: { not: null },
                isActive: true,
            },
        });
        for (const report of scheduledReports) {
            await this.scheduleReport(report);
        }
        logger_1.logger.info(`Loaded ${scheduledReports.length} scheduled reports`);
    }
    async ensureReportsDirectory() {
        try {
            await fs_1.promises.mkdir(this.reportsPath, { recursive: true });
        }
        catch (error) {
            logger_1.logger.error('Error creating reports directory:', error);
        }
    }
}
exports.ReportingService = ReportingService;
//# sourceMappingURL=reporting.service.js.map