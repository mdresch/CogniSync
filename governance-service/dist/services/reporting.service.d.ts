import { PrismaClient, Report, ReportExecution, ReportType, ReportFormat } from '@prisma/client';
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
    dateRange?: {
        start: Date;
        end: Date;
    };
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
export declare class ReportingService {
    private prisma;
    private notificationService;
    private reportsPath;
    private cronJobs;
    constructor(prisma: PrismaClient, notificationService: NotificationService);
    start(): Promise<void>;
    stop(): Promise<void>;
    createReport(reportData: CreateReportRequest): Promise<Report>;
    updateReport(reportId: string, updateData: Partial<CreateReportRequest>, tenantId: string): Promise<Report>;
    deleteReport(reportId: string, tenantId: string): Promise<void>;
    generateReport(reportId: string, tenantId: string, parameters?: any): Promise<ReportExecution>;
    getReports(tenantId: string, filters?: {
        type?: ReportType;
        isActive?: boolean;
        search?: string;
    }): Promise<Report[]>;
    getReportExecutions(reportId: string, tenantId: string): Promise<ReportExecution[]>;
    getReportFile(executionId: string, tenantId: string): Promise<{
        filePath: string;
        fileName: string;
    } | null>;
    subscribeToReport(reportId: string, userId: string, email: string, tenantId: string): Promise<void>;
    unsubscribeFromReport(reportId: string, userId: string, tenantId: string): Promise<void>;
    getStandardReports(tenantId: string): Promise<any[]>;
    buildCustomReport(query: ReportQuery, tenantId: string): Promise<ReportData>;
    private executeReportQuery;
    private executeWorkflowQuery;
    private executeUserQuery;
    private executeDocumentQuery;
    private executeTaskQuery;
    private executeNotificationQuery;
    private generateReportFile;
    private generatePDFReport;
    private generateExcelReport;
    private generateCSVReport;
    private generateJSONReport;
    private getFileExtension;
    private scheduleReport;
    private loadScheduledReports;
    private ensureReportsDirectory;
}
//# sourceMappingURL=reporting.service.d.ts.map