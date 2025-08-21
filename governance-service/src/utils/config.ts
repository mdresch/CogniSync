import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface Config {
  // Server
  port: number;
  nodeEnv: string;
  
  // Database
  databaseUrl: string;
  
  // JWT
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  
  // Email
  emailHost?: string;
  emailPort?: number;
  emailSecure?: boolean;
  emailUser?: string;
  emailPassword?: string;
  emailFrom?: string;
  
  // Redis
  redisUrl?: string;
  
  // File Upload
  uploadPath: string;
  maxFileSize: number;
  
  // Security
  allowedOrigins: string[];
  
  // External Services
  atlassianSyncServiceUrl?: string;
  knowledgeGraphServiceUrl?: string;
  llmRagServiceUrl?: string;
}

export const config: Config = {
  // Server
  port: parseInt(process.env.PORT || '3004'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/governance_db',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // Email
  emailHost: process.env.EMAIL_HOST,
  emailPort: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : undefined,
  emailSecure: process.env.EMAIL_SECURE === 'true',
  emailUser: process.env.EMAIL_USER,
  emailPassword: process.env.EMAIL_PASSWORD,
  emailFrom: process.env.EMAIL_FROM || 'noreply@cogni-sync.com',
  
  // Redis
  redisUrl: process.env.REDIS_URL,
  
  // File Upload
  uploadPath: process.env.UPLOAD_PATH || './uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
  
  // Security
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  
  // External Services
  atlassianSyncServiceUrl: process.env.ATLASSIAN_SYNC_SERVICE_URL || 'http://localhost:3002',
  knowledgeGraphServiceUrl: process.env.KNOWLEDGE_GRAPH_SERVICE_URL || 'http://localhost:3001',
  llmRagServiceUrl: process.env.LLM_RAG_SERVICE_URL || 'http://localhost:3003',
};

// Validate required configuration
export function validateConfig(): void {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Environment helpers
export const isDevelopment = config.nodeEnv === 'development';
export const isProduction = config.nodeEnv === 'production';
export const isTest = config.nodeEnv === 'test';