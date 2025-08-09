// API Key authentication middleware for Atlassian Sync Service
import { Request, Response, NextFunction } from 'express';

const VALID_API_KEYS = process.env.VALID_API_KEYS
  ? process.env.VALID_API_KEYS.split(',').map(k => k.trim())
  : [];

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  console.log('[AUTH] Received Authorization header:', authHeader);
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[AUTH] Missing or invalid Authorization header');
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const apiKey = authHeader.replace('Bearer ', '').trim();
  const isValid = VALID_API_KEYS.includes(apiKey);
  console.log('[AUTH] Extracted API key:', apiKey, '| Valid:', isValid);
  if (!isValid) {
    console.warn('[AUTH] Invalid API key:', apiKey);
    return res.status(403).json({ error: 'Invalid API key' });
  }
  return next();
}
