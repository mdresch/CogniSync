export interface Config {
    port: number;
    nodeEnv: string;
    databaseUrl: string;
    jwtSecret: string;
    jwtExpiresIn: string;
    jwtRefreshSecret: string;
    jwtRefreshExpiresIn: string;
    emailHost?: string;
    emailPort?: number;
    emailSecure?: boolean;
    emailUser?: string;
    emailPassword?: string;
    emailFrom?: string;
    redisUrl?: string;
    uploadPath: string;
    maxFileSize: number;
    allowedOrigins: string[];
    atlassianSyncServiceUrl?: string;
    knowledgeGraphServiceUrl?: string;
    llmRagServiceUrl?: string;
}
export declare const config: Config;
export declare function validateConfig(): void;
export declare const isDevelopment: boolean;
export declare const isProduction: boolean;
export declare const isTest: boolean;
//# sourceMappingURL=config.d.ts.map