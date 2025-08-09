import { EntityData, RelationshipData, ValidationError, EntityType, RelationshipType, ConfidenceLevel, ImportanceLevel, ExtractionMethod } from './types';

/**
 * Validation utilities for Knowledge Graph Service
 */

const ENTITY_TYPES: EntityType[] = [
  'PERSON', 'DOCUMENT', 'TASK', 'API', 'ORGANIZATION', 'PROJECT',
  'CONCEPT', 'TECHNOLOGY', 'REQUIREMENT', 'DECISION', 'RISK', 'MILESTONE'
];

const RELATIONSHIP_TYPES: RelationshipType[] = [
  'AUTHORED_BY', 'ASSIGNED_TO', 'DEPENDS_ON', 'REFERENCES', 'IMPLEMENTS',
  'MANAGES', 'PARTICIPATES_IN', 'RELATES_TO', 'CONTAINS', 'USES'
];

const CONFIDENCE_LEVELS: ConfidenceLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const IMPORTANCE_LEVELS: ImportanceLevel[] = ['MINOR', 'MODERATE', 'SIGNIFICANT', 'CRITICAL'];
const EXTRACTION_METHODS: ExtractionMethod[] = ['MANUAL', 'NLP', 'LLM', 'PATTERN_MATCHING', 'API_INTEGRATION', 'INFERENCE'];

export function validateEntityData(data: Partial<EntityData>): EntityData {
  const errors: string[] = [];

  // Required fields
  if (!data.type) {
    errors.push('Entity type is required');
  } else if (!ENTITY_TYPES.includes(data.type)) {
    errors.push(`Invalid entity type: ${data.type}. Must be one of: ${ENTITY_TYPES.join(', ')}`);
  }

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Entity name is required and must be a non-empty string');
  }

  if (!data.metadata) {
    errors.push('Entity metadata is required');
  } else {
    // Validate metadata
    if (!data.metadata.confidence || !CONFIDENCE_LEVELS.includes(data.metadata.confidence)) {
      errors.push(`Invalid confidence level: ${data.metadata.confidence}. Must be one of: ${CONFIDENCE_LEVELS.join(', ')}`);
    }

    if (!data.metadata.importance || !IMPORTANCE_LEVELS.includes(data.metadata.importance)) {
      errors.push(`Invalid importance level: ${data.metadata.importance}. Must be one of: ${IMPORTANCE_LEVELS.join(', ')}`);
    }

    if (!data.metadata.source || typeof data.metadata.source !== 'string' || data.metadata.source.trim().length === 0) {
      errors.push('Entity metadata source is required and must be a non-empty string');
    }

    if (!data.metadata.extractionMethod || !EXTRACTION_METHODS.includes(data.metadata.extractionMethod)) {
      errors.push(`Invalid extraction method: ${data.metadata.extractionMethod}. Must be one of: ${EXTRACTION_METHODS.join(', ')}`);
    }

    if (!Array.isArray(data.metadata.tags)) {
      errors.push('Entity metadata tags must be an array');
    }

    if (!Array.isArray(data.metadata.aliases)) {
      errors.push('Entity metadata aliases must be an array');
    }
  }

  // Optional fields validation
  if (data.description !== undefined && (typeof data.description !== 'string' || data.description.length > 2000)) {
    errors.push('Entity description must be a string with maximum 2000 characters');
  }

  if (data.properties && typeof data.properties !== 'object') {
    errors.push('Entity properties must be an object');
  }

  if (data.tenantId !== undefined && (typeof data.tenantId !== 'string' || data.tenantId.trim().length === 0)) {
    errors.push('Tenant ID must be a non-empty string');
  }

  // Validate name length and format
  if (data.name && data.name.length > 255) {
    errors.push('Entity name must be 255 characters or less');
  }

  if (errors.length > 0) {
    throw new ValidationError(`Entity validation failed: ${errors.join(', ')}`);
  }

  return {
    type: data.type!,
    name: data.name!.trim(),
    description: data.description?.trim(),
    properties: data.properties || {},
    tenantId: data.tenantId || 'default',
    metadata: {
      confidence: data.metadata!.confidence,
      importance: data.metadata!.importance,
      source: data.metadata!.source.trim(),
      extractionMethod: data.metadata!.extractionMethod,
      tags: data.metadata!.tags || [],
      aliases: data.metadata!.aliases || []
    }
  };
}

export function validateRelationshipData(data: Partial<RelationshipData>): RelationshipData {
  const errors: string[] = [];

  // Required fields
  if (!data.sourceEntityId || typeof data.sourceEntityId !== 'string' || data.sourceEntityId.trim().length === 0) {
    errors.push('Source entity ID is required and must be a non-empty string');
  }

  if (!data.targetEntityId || typeof data.targetEntityId !== 'string' || data.targetEntityId.trim().length === 0) {
    errors.push('Target entity ID is required and must be a non-empty string');
  }

  if (data.sourceEntityId === data.targetEntityId) {
    errors.push('Source and target entity IDs cannot be the same');
  }

  if (!data.type) {
    errors.push('Relationship type is required');
  } else if (!RELATIONSHIP_TYPES.includes(data.type)) {
    errors.push(`Invalid relationship type: ${data.type}. Must be one of: ${RELATIONSHIP_TYPES.join(', ')}`);
  }

  if (!data.confidence || !CONFIDENCE_LEVELS.includes(data.confidence)) {
    errors.push(`Invalid confidence level: ${data.confidence}. Must be one of: ${CONFIDENCE_LEVELS.join(', ')}`);
  }

  if (!data.metadata) {
    errors.push('Relationship metadata is required');
  } else {
    if (!data.metadata.source || typeof data.metadata.source !== 'string' || data.metadata.source.trim().length === 0) {
      errors.push('Relationship metadata source is required and must be a non-empty string');
    }

    if (!data.metadata.extractionMethod || !EXTRACTION_METHODS.includes(data.metadata.extractionMethod)) {
      errors.push(`Invalid extraction method: ${data.metadata.extractionMethod}. Must be one of: ${EXTRACTION_METHODS.join(', ')}`);
    }

    if (typeof data.metadata.evidenceCount !== 'number' || data.metadata.evidenceCount < 0) {
      errors.push('Evidence count must be a non-negative number');
    }

    if (typeof data.metadata.isInferred !== 'boolean') {
      errors.push('isInferred must be a boolean value');
    }
  }

  // Optional fields validation
  if (data.weight !== undefined && (typeof data.weight !== 'number' || data.weight < 0 || data.weight > 10)) {
    errors.push('Relationship weight must be a number between 0 and 10');
  }

  if (data.properties && typeof data.properties !== 'object') {
    errors.push('Relationship properties must be an object');
  }

  if (data.tenantId !== undefined && (typeof data.tenantId !== 'string' || data.tenantId.trim().length === 0)) {
    errors.push('Tenant ID must be a non-empty string');
  }

  if (errors.length > 0) {
    throw new ValidationError(`Relationship validation failed: ${errors.join(', ')}`);
  }

  return {
    sourceEntityId: data.sourceEntityId!.trim(),
    targetEntityId: data.targetEntityId!.trim(),
    type: data.type!,
    weight: data.weight || 1.0,
    confidence: data.confidence!,
    properties: data.properties || {},
    tenantId: data.tenantId || 'default',
    metadata: {
      source: data.metadata!.source.trim(),
      extractionMethod: data.metadata!.extractionMethod,
      evidenceCount: data.metadata!.evidenceCount,
      isInferred: data.metadata!.isInferred,
      context: data.metadata!.context?.trim()
    }
  };
}

export function validateUUID(id: string, fieldName: string = 'ID'): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!id || typeof id !== 'string') {
    throw new ValidationError(`${fieldName} is required and must be a string`);
  }

  if (!uuidRegex.test(id)) {
    throw new ValidationError(`${fieldName} must be a valid UUID`);
  }
}

export function validateTenantId(tenantId: string): void {
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new ValidationError('Tenant ID is required and must be a non-empty string');
  }

  // Basic tenant ID validation - alphanumeric and underscores only
  const tenantIdRegex = /^[a-zA-Z0-9_]+$/;
  if (!tenantIdRegex.test(tenantId)) {
    throw new ValidationError('Tenant ID must contain only letters, numbers, and underscores');
  }

  if (tenantId.length > 50) {
    throw new ValidationError('Tenant ID must be 50 characters or less');
  }
}

export function validatePaginationParams(page?: string, limit?: string): { page: number; limit: number } {
  let pageNum = 1;
  let limitNum = 50;

  if (page) {
    pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      throw new ValidationError('Page must be a positive integer');
    }
  }

  if (limit) {
    limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      throw new ValidationError('Limit must be a positive integer between 1 and 1000');
    }
  }

  return { page: pageNum, limit: limitNum };
}

export function sanitizeSearchTerm(searchTerm?: string): string | undefined {
  if (!searchTerm || typeof searchTerm !== 'string') {
    return undefined;
  }

  const sanitized = searchTerm.trim();
  if (sanitized.length === 0) {
    return undefined;
  }

  if (sanitized.length > 255) {
    throw new ValidationError('Search term must be 255 characters or less');
  }

  return sanitized;
}
