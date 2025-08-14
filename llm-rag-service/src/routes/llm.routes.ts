import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requireTenant, requireScope } from '../middleware/auth.middleware.js';
import { LLMQueryService } from '../services/LLMQueryService';

const router = Router();

// POST /api/llm/completion - Direct LLM completion endpoint
// Removed duplicate and broken route handler code above. Only the correct, middleware-protected, asyncHandler-wrapped POST /completion route remains below.
router.post('/completion', requireTenant, requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const llmQueryService: LLMQueryService = req.app.locals.llmQueryService;
  const { prompt, context = [], model, temperature = 0.7, max_tokens = 1000 } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Prompt is required and must be a non-empty string', code: 'INVALID_PROMPT' });
  }

  try {
    const result = await llmQueryService.llmCompletion({ prompt, context, model, temperature, max_tokens });
    res.json(result);
  } catch (error) {
    console.error('LLM direct completion error:', error);
    const errAny = error as any;
    res.status(500).json({
      error: errAny?.message || 'LLM completion failed',
      code: errAny?.code || 'LLM_COMPLETION_ERROR',
      details: errAny?.response?.data || null
    });
  }
}));

export default router;
