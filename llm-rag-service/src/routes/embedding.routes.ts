import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requireTenant, requireScope } from '../middleware/auth.middleware.js';
import { EmbeddingService } from '../services/EmbeddingService';
import { Document, BulkEmbeddingRequest } from '../types.js';
import { PrismaClient } from '@prisma/client';

const router = Router();

// Apply authentication middleware
router.use(requireTenant);

// Create single embedding
router.post('/create', requireScope('write'), asyncHandler(async (req: any, res: any) => {
  const embeddingService: EmbeddingService = req.app.locals.embeddingService;
  
  const { document } = req.body;

  // Validate input
  if (!document || typeof document !== 'object') {
    return res.status(400).json({
      error: 'Document is required and must be an object',
      code: 'INVALID_DOCUMENT',
    });
  }

  if (!document.id || typeof document.id !== 'string') {
    return res.status(400).json({
      error: 'Document ID is required and must be a string',
      code: 'MISSING_DOCUMENT_ID',
    });
  }

  if (!document.text || typeof document.text !== 'string') {
    return res.status(400).json({
      error: 'Document text is required and must be a string',
      code: 'MISSING_DOCUMENT_TEXT',
    });
  }

  if (document.text.length > 50000) {
    return res.status(400).json({
      error: 'Document text too long (max 50,000 characters)',
      code: 'DOCUMENT_TOO_LONG',
    });
  }

  const startTime = Date.now();

  try {
    const embedding = await embeddingService.createDocumentEmbedding({
      ...document,
      tenantId: req.tenantId,
    });
    
    res.json({
      id: embedding.id,
      documentId: document.id,
      dimensions: embedding.vector?.length || 0,
      metadata: {
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    throw error;
  }
}));

// Create or update a document and generate embeddings for it
router.post('/documents', requireScope('write'), asyncHandler(async (req: any, res: any) => {
  const embeddingService: EmbeddingService = req.app.locals.embeddingService;
  const prisma: PrismaClient = req.app.locals.prisma;

  const { id, text, title, url, source, metadata } = req.body || {};

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Document id is required', code: 'MISSING_DOCUMENT_ID' });
  }
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Document text is required', code: 'MISSING_DOCUMENT_TEXT' });
  }

  const startTime = Date.now();
  const tenantId = req.tenantId;

  // Upsert the document record
  await prisma.document.upsert({
    where: { id },
    update: {
      title: title || undefined,
      content: text,
      source: source || undefined,
      url: url || undefined,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    },
    create: {
      id,
      tenantId,
      title: title || (text.slice(0, 80) || 'Untitled Document'),
      content: text,
      source: source || 'api',
      url: url || null,
      type: 'document',
      hasEmbeddings: false,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    }
  });

  const result = await embeddingService.createDocumentEmbeddings(id, tenantId, text);
  if (!result.success) {
    return res.status(500).json({ error: result.error?.message || 'Embedding failed', code: result.error?.code || 'EMBEDDING_ERROR' });
  }

  res.json({
    documentId: id,
    chunksCreated: result.chunks?.length || 0,
    embeddingsGenerated: result.chunks?.length || 0,
    metadata: {
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    }
  });
}));

// Bulk create embeddings
router.post('/bulk', requireScope('write'), asyncHandler(async (req: any, res: any) => {
  const embeddingService: EmbeddingService = req.app.locals.embeddingService;
  
  const bulkRequest: BulkEmbeddingRequest = {
    documents: req.body.documents,
    tenantId: req.tenantId,
    options: req.body.options || {},
  };

  // Validate input
  if (!Array.isArray(bulkRequest.documents)) {
    return res.status(400).json({
      error: 'Documents must be an array',
      code: 'INVALID_DOCUMENTS',
    });
  }

  if (bulkRequest.documents.length === 0) {
    return res.status(400).json({
      error: 'At least one document is required',
      code: 'EMPTY_DOCUMENTS',
    });
  }

  if (bulkRequest.documents.length > 100) {
    return res.status(400).json({
      error: 'Maximum 100 documents allowed per batch',
      code: 'TOO_MANY_DOCUMENTS',
    });
  }

  // Validate each document
  for (let i = 0; i < bulkRequest.documents.length; i++) {
    const doc = bulkRequest.documents[i];
    
    if (!doc || typeof doc !== 'object') {
      return res.status(400).json({
        error: `Document at index ${i} is invalid`,
        code: 'INVALID_DOCUMENT_IN_BATCH',
      });
    }

    if (!doc.id || typeof doc.id !== 'string') {
      return res.status(400).json({
        error: `Document at index ${i} is missing ID`,
        code: 'MISSING_DOCUMENT_ID_IN_BATCH',
      });
    }

    if (!doc.text || typeof doc.text !== 'string') {
      return res.status(400).json({
        error: `Document at index ${i} is missing text`,
        code: 'MISSING_DOCUMENT_TEXT_IN_BATCH',
      });
    }

    if (doc.text.length > 50000) {
      return res.status(400).json({
        error: `Document at index ${i} text too long (max 50,000 characters)`,
        code: 'DOCUMENT_TOO_LONG_IN_BATCH',
      });
    }
  }

  const startTime = Date.now();

  try {
    const response = await embeddingService.createBulkEmbeddings(bulkRequest);
    
    res.json({
      ...response,
      metadata: {
        ...response,
        totalProcessingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    throw error;
  }
}));

// Get embedding by ID
router.get('/:id', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const embeddingService: EmbeddingService = req.app.locals.embeddingService;
  const { id } = req.params;
  const { includeVector = false } = req.query;

  if (!id) {
    return res.status(400).json({
      error: 'Embedding ID is required',
      code: 'MISSING_EMBEDDING_ID',
    });
  }

  try {
    const embedding = await embeddingService.getEmbedding(id, {
      tenantId: req.tenantId,
    });

    if (!embedding) {
      return res.status(404).json({
        error: 'Embedding not found',
        code: 'EMBEDDING_NOT_FOUND',
      });
    }

    res.json({
      id: embedding.id,
      documentId: embedding.documentId,
      dimensions: embedding.vector?.length || 0,
      metadata: embedding.metadata,
      createdAt: embedding.createdAt,
      ...(includeVector === 'true' && { vector: embedding.vector }),
    });
  } catch (error) {
    throw error;
  }
}));

// List embeddings for tenant
router.get('/', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const embeddingService: EmbeddingService = req.app.locals.embeddingService;
  
  const {
    limit = 50,
    offset = 0,
    documentId,
    source,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  try {
    const result = await embeddingService.listEmbeddings({
      tenantId: req.tenantId,
      limit: Math.min(parseInt(limit as string) || 50, 500),
      offset: parseInt(offset as string) || 0,
      documentId: documentId as string,
    });

    res.json({
      embeddings: result.embeddings,
      metadata: {
        total: result.total,
        limit: Math.min(parseInt(limit as string) || 50, 500),
        offset: parseInt(offset as string) || 0,
        hasMore: result.hasMore,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    throw error;
  }
}));

// Update embedding metadata
router.patch('/:id', requireScope('write'), asyncHandler(async (req: any, res: any) => {
  const embeddingService: EmbeddingService = req.app.locals.embeddingService;
  const { id } = req.params;
  const { title, source, metadata } = req.body;

  if (!id) {
    return res.status(400).json({
      error: 'Embedding ID is required',
      code: 'MISSING_EMBEDDING_ID',
    });
  }

  // Validate that at least one field is being updated
  if (!title && !source && !metadata) {
    return res.status(400).json({
      error: 'At least one field must be updated (title, source, or metadata)',
      code: 'NO_UPDATES_PROVIDED',
    });
  }

  try {
    const embedding = await embeddingService.updateEmbedding(id, {
      tenantId: req.tenantId,
      metadata,
    });

    if (!embedding) {
      return res.status(404).json({
        error: 'Embedding not found',
        code: 'EMBEDDING_NOT_FOUND',
      });
    }

    res.json({
      id: embedding.id,
      vector: embedding.vector,
      metadata: embedding.metadata,
      updatedAt: embedding.updatedAt,
    });
  } catch (error) {
    throw error;
  }
}));

// Delete embedding
router.delete('/:id', requireScope('write'), asyncHandler(async (req: any, res: any) => {
  const embeddingService: EmbeddingService = req.app.locals.embeddingService;
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      error: 'Embedding ID is required',
      code: 'MISSING_EMBEDDING_ID',
    });
  }

  try {
    const deleted = await embeddingService.deleteEmbedding(id, {
      tenantId: req.tenantId,
    });

    if (!deleted) {
      return res.status(404).json({
        error: 'Embedding not found',
        code: 'EMBEDDING_NOT_FOUND',
      });
    }

    res.json({
      message: 'Embedding deleted successfully',
      id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    throw error;
  }
}));

// Bulk delete embeddings
router.post('/bulk-delete', requireScope('write'), asyncHandler(async (req: any, res: any) => {
  const embeddingService: EmbeddingService = req.app.locals.embeddingService;
  const { ids, documentIds } = req.body;

  // Validate input - either IDs or documentIds must be provided
  if (!ids && !documentIds) {
    return res.status(400).json({
      error: 'Either ids array or documentIds array must be provided',
      code: 'MISSING_DELETE_CRITERIA',
    });
  }

  if (ids && !Array.isArray(ids)) {
    return res.status(400).json({
      error: 'IDs must be an array',
      code: 'INVALID_IDS',
    });
  }

  if (ids && ids.length > 1000) {
    return res.status(400).json({
      error: 'Maximum 1000 IDs allowed per batch delete',
      code: 'TOO_MANY_IDS',
    });
  }

  try {
    const result = await embeddingService.bulkDeleteEmbeddings({
      tenantId: req.tenantId,
      ids,
      documentIds,
    });

    res.json({
      message: 'Bulk delete completed',
      deletedCount: result.deletedCount,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    throw error;
  }
}));

// Search similar embeddings
router.post('/search', requireScope('read'), asyncHandler(async (req: any, res: any) => {
  const embeddingService: EmbeddingService = req.app.locals.embeddingService;
  const { query, vector, limit = 10, threshold = 0.7 } = req.body;

  // Validate input - either query or vector must be provided
  if (!query && !vector) {
    return res.status(400).json({
      error: 'Either query string or vector array must be provided',
      code: 'MISSING_SEARCH_INPUT',
    });
  }

  if (query && typeof query !== 'string') {
    return res.status(400).json({
      error: 'Query must be a string',
      code: 'INVALID_QUERY',
    });
  }

  if (vector && !Array.isArray(vector)) {
    return res.status(400).json({
      error: 'Vector must be an array',
      code: 'INVALID_VECTOR',
    });
  }

  const startTime = Date.now();

  try {
    const results = await embeddingService.searchSimilar({
      tenantId: req.tenantId,
      query,
      limit: Math.min(limit, 100),
      threshold,
    });

    res.json({
      results: results.results.map(r => ({
        ...r,
        text: r.content,
      })),
      metadata: {
        count: results.results.length,
        limit,
        threshold,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    throw error;
  }
}));

export default router;
