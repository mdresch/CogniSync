// API Key authentication middleware for Knowledge Graph Service
import { Request, Response, NextFunction } from 'express';

const VALID_API_KEYS = process.env.VALID_API_KEYS
  ? process.env.VALID_API_KEYS.split(',').map(k => k.trim())
  : [];

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  // Accept API key from either Authorization header or x-api-key header
  let apiKey: string | undefined;
  const authHeader = req.headers['authorization'];
  const xApiKeyHeader = req.headers['x-api-key'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.replace('Bearer ', '').trim();
  } else if (typeof xApiKeyHeader === 'string') {
    apiKey = xApiKeyHeader.trim();
  } else if (Array.isArray(xApiKeyHeader)) {
    apiKey = xApiKeyHeader[0].trim();
  }

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key (provide in Authorization or x-api-key header)' });
  }
  if (!VALID_API_KEYS.includes(apiKey)) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  return next();
}
