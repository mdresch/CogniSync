// atlassian-sync-service/src/logger.ts

import pino from 'pino';

// Create a logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty', // Makes logs human-readable in development
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:standard',
    },
  },
});

/**
 * Returns a logger instance with a specific service name.
 * @param serviceName The name of the service or module.
 * @returns A pino logger instance.
 */
export function getLogger(serviceName: string) {
  return logger.child({ service: serviceName });
}
