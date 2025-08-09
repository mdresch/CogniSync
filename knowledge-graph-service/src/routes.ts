import { Router, Request, Response, NextFunction } from 'express';
import KnowledgeGraphService from './service';
import { validateEntityData, validateRelationshipData, validateUUID, validatePaginationParams, sanitizeSearchTerm } from './validation';
import { requirePermission } from './auth';
import { ValidationError, NotFoundError, KnowledgeGraphError } from './types';

const router = Router();

// Initialize service instance (in production, consider dependency injection)
const knowledgeGraphService = new KnowledgeGraphService();

/**
 * Error handler for async routes
 */
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * Health check endpoint
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const health = await knowledgeGraphService.healthCheck();
  res.status(health.status === 'healthy' ? 200 : 503).json({
    success: health.status === 'healthy',
    data: health,
    timestamp: new Date()
  });
}));

/**
 * Create a new entity
 * POST /entities
 */
router.post('/entities', requirePermission('write'), asyncHandler(async (req: Request, res: Response) => {
  const entityData = validateEntityData({
    ...req.body,
    tenantId: req.context?.tenantId
  });

  const entity = await knowledgeGraphService.createEntity(entityData);

  res.status(201).json({
    success: true,
    data: entity,
    message: 'Entity created successfully',
    timestamp: new Date()
  });
}));

/**
 * Get entity by ID
 * GET /entities/:id
 */
router.get('/entities/:id', requirePermission('read'), asyncHandler(async (req: Request, res: Response) => {
  validateUUID(req.params.id, 'Entity ID');

  const entity = await knowledgeGraphService.getEntity(
    req.params.id,
    req.context?.tenantId
  );

  if (!entity) {
    throw new NotFoundError('Entity', req.params.id);
  }

  res.json({
    success: true,
    data: entity,
    timestamp: new Date()
  });
}));

/**
 * Update entity
 * PUT /entities/:id
 */
router.put('/entities/:id', requirePermission('write'), asyncHandler(async (req: Request, res: Response) => {
  validateUUID(req.params.id, 'Entity ID');

  // Validate partial entity data for update
  const updates = validateEntityData({
    type: 'DOCUMENT', // Dummy type for validation, actual type won't be updated
    name: 'dummy', // Dummy name for validation
    metadata: {
      confidence: 'MEDIUM',
      importance: 'MODERATE',
      source: 'update',
      extractionMethod: 'MANUAL',
      tags: [],
      aliases: []
    },
    ...req.body
  });

  const entity = await knowledgeGraphService.updateEntity(
    req.params.id,
    updates,
    req.context?.tenantId
  );

  res.json({
    success: true,
    data: entity,
    message: 'Entity updated successfully',
    timestamp: new Date()
  });
}));

/**
 * Delete entity
 * DELETE /entities/:id
 */
router.delete('/entities/:id', requirePermission('write'), asyncHandler(async (req: Request, res: Response) => {
  validateUUID(req.params.id, 'Entity ID');

  await knowledgeGraphService.deleteEntity(
    req.params.id,
    req.context?.tenantId
  );

  res.json({
    success: true,
    message: 'Entity deleted successfully',
    timestamp: new Date()
  });
}));

/**
 * Search entities
 * GET /entities
 */
router.get('/entities', requirePermission('read'), asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = validatePaginationParams(
    req.query.page as string,
    req.query.limit as string
  );

  const searchTerm = sanitizeSearchTerm(req.query.search as string);
  const entityTypes = req.query.entityTypes ? 
    (Array.isArray(req.query.entityTypes) ? req.query.entityTypes : [req.query.entityTypes]) as string[] :
    undefined;

  const entities = await knowledgeGraphService.searchEntities({
    entityTypes: entityTypes as any,
    searchTerm,
    maxResults: limit,
    tenantId: req.context?.tenantId
  }, req.context?.tenantId);

  res.json({
    success: true,
    data: entities,
    pagination: {
      page,
      limit,
      total: entities.length,
      totalPages: Math.ceil(entities.length / limit)
    },
    timestamp: new Date()
  });
}));

/**
 * Get entity relationships
 * GET /entities/:id/relationships
 */
router.get('/entities/:id/relationships', requirePermission('read'), asyncHandler(async (req: Request, res: Response) => {
  validateUUID(req.params.id, 'Entity ID');

  const relationships = await knowledgeGraphService.getEntityRelationships(
    req.params.id,
    req.context?.tenantId
  );

  res.json({
    success: true,
    data: relationships,
    timestamp: new Date()
  });
}));

/**
 * Get entity neighborhood
 * GET /entities/:id/neighborhood
 */
router.get('/entities/:id/neighborhood', requirePermission('read'), asyncHandler(async (req: Request, res: Response) => {
  validateUUID(req.params.id, 'Entity ID');

  const depth = req.query.depth ? parseInt(req.query.depth as string, 10) : 2;
  if (isNaN(depth) || depth < 1 || depth > 5) {
    throw new ValidationError('Depth must be a number between 1 and 5');
  }

  const neighborhood = await knowledgeGraphService.getEntityNeighborhood(
    req.params.id,
    depth,
    req.context?.tenantId
  );

  res.json({
    success: true,
    data: neighborhood,
    timestamp: new Date()
  });
}));

/**
 * Create a new relationship
 * POST /relationships
 */
router.post('/relationships', requirePermission('write'), asyncHandler(async (req: Request, res: Response) => {
  const relationshipData = validateRelationshipData({
    ...req.body,
    tenantId: req.context?.tenantId
  });

  const relationship = await knowledgeGraphService.createRelationship(relationshipData);

  res.status(201).json({
    success: true,
    data: relationship,
    message: 'Relationship created successfully',
    timestamp: new Date()
  });
}));

/**
 * Delete relationship
 * DELETE /relationships/:id
 */
router.delete('/relationships/:id', requirePermission('write'), asyncHandler(async (req: Request, res: Response) => {
  validateUUID(req.params.id, 'Relationship ID');

  await knowledgeGraphService.deleteRelationship(
    req.params.id,
    req.context?.tenantId
  );

  res.json({
    success: true,
    message: 'Relationship deleted successfully',
    timestamp: new Date()
  });
}));

/**
 * Get graph analytics
 * GET /analytics
 */
router.get('/analytics', requirePermission('read'), asyncHandler(async (req: Request, res: Response) => {
  const analytics = await knowledgeGraphService.calculateGraphAnalytics(
    req.context?.tenantId
  );

  res.json({
    success: true,
    data: analytics,
    timestamp: new Date()
  });
}));

/**
 * Bulk operations
 */

/**
 * Create multiple entities
 * POST /entities/bulk
 */
router.post('/entities/bulk', requirePermission('write'), asyncHandler(async (req: Request, res: Response) => {
  if (!Array.isArray(req.body.entities)) {
    throw new ValidationError('Request body must contain an array of entities');
  }

  if (req.body.entities.length > 100) {
    throw new ValidationError('Maximum 100 entities can be created in a single bulk operation');
  }

  const results = [];
  const errors = [];

  for (let i = 0; i < req.body.entities.length; i++) {
    try {
      const entityData = validateEntityData({
        ...req.body.entities[i],
        tenantId: req.context?.tenantId
      });
      
      const entity = await knowledgeGraphService.createEntity(entityData);
      results.push({ index: i, success: true, data: entity });
    } catch (error) {
      errors.push({
        index: i,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  res.status(201).json({
    success: errors.length === 0,
    data: {
      created: results.length,
      failed: errors.length,
      results,
      errors
    },
    message: `Bulk operation completed: ${results.length} created, ${errors.length} failed`,
    timestamp: new Date()
  });
}));

/**
 * Create multiple relationships
 * POST /relationships/bulk
 */
router.post('/relationships/bulk', requirePermission('write'), asyncHandler(async (req: Request, res: Response) => {
  if (!Array.isArray(req.body.relationships)) {
    throw new ValidationError('Request body must contain an array of relationships');
  }

  if (req.body.relationships.length > 100) {
    throw new ValidationError('Maximum 100 relationships can be created in a single bulk operation');
  }

  const results = [];
  const errors = [];

  for (let i = 0; i < req.body.relationships.length; i++) {
    try {
      const relationshipData = validateRelationshipData({
        ...req.body.relationships[i],
        tenantId: req.context?.tenantId
      });
      
      const relationship = await knowledgeGraphService.createRelationship(relationshipData);
      results.push({ index: i, success: true, data: relationship });
    } catch (error) {
      errors.push({
        index: i,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  res.status(201).json({
    success: errors.length === 0,
    data: {
      created: results.length,
      failed: errors.length,
      results,
      errors
    },
    message: `Bulk operation completed: ${results.length} created, ${errors.length} failed`,
    timestamp: new Date()
  });
}));

export default router;
