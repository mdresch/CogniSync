import { PrismaClient } from '@prisma/client';
import { EntityData, RelationshipData, GraphQuery, GraphAnalytics } from './types';

export class KnowledgeGraphService {
  private prisma: PrismaClient;

  constructor(tenantId: string = 'default') {
    // Multi-tenant support through connection configuration
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL + (process.env.TENANT_ISOLATION_ENABLED === 'true' ? `?schema=${tenantId}` : '')
        }
      }
    });
    console.log(`🕸️ Knowledge Graph Service initialized for tenant: ${tenantId}`);
  }

  /**
   * Create a new entity in the knowledge graph
   */
  async createEntity(entityData: EntityData): Promise<any> {
    try {
      console.log(`📝 Creating entity: ${entityData.name} (${entityData.type})`);
      
      const entity = await this.prisma.knowledgeEntity.create({
        data: {
          type: entityData.type,
          name: entityData.name,
          description: entityData.description,
          properties: entityData.properties as any,
          metadata: entityData.metadata as any,
          tenantId: entityData.tenantId || 'default'
        }
      });

      console.log(`✅ Created entity: ${entity.name} (ID: ${entity.id})`);
      return entity;
    } catch (error) {
      console.error('Failed to create entity:', error);
      throw new Error(`Failed to create entity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new relationship between entities
   */
  async createRelationship(relationshipData: RelationshipData): Promise<any> {
    try {
      console.log(`🔗 Creating relationship: ${relationshipData.sourceEntityId} -[${relationshipData.type}]-> ${relationshipData.targetEntityId}`);
      
      // Verify entities exist
      const sourceEntity = await this.prisma.knowledgeEntity.findUnique({
        where: { id: relationshipData.sourceEntityId }
      });
      
      const targetEntity = await this.prisma.knowledgeEntity.findUnique({
        where: { id: relationshipData.targetEntityId }
      });

      if (!sourceEntity || !targetEntity) {
        throw new Error('One or both entities not found');
      }

      const relationship = await this.prisma.knowledgeRelationship.create({
        data: {
          sourceEntityId: relationshipData.sourceEntityId,
          targetEntityId: relationshipData.targetEntityId,
          type: relationshipData.type,
          weight: relationshipData.weight || 1.0,
          confidence: relationshipData.confidence,
          properties: relationshipData.properties || {},
          metadata: relationshipData.metadata as any,
          tenantId: relationshipData.tenantId || 'default'
        }
      });

      console.log(`✅ Created relationship: ${relationship.type} (ID: ${relationship.id})`);
      return relationship;
    } catch (error) {
      console.error('Failed to create relationship:', error);
      throw new Error(`Failed to create relationship: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get entity by ID
   */
  async getEntity(entityId: string, tenantId: string = 'default'): Promise<any> {
    try {
      const entity = await this.prisma.knowledgeEntity.findFirst({
        where: { 
          id: entityId,
          tenantId: tenantId
        }
      });
      
      return entity;
    } catch (error) {
      console.error('Failed to get entity:', error);
      throw new Error(`Failed to get entity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search entities based on criteria
   */
  async searchEntities(query: GraphQuery, tenantId: string = 'default'): Promise<any[]> {
    try {
      const where: any = { tenantId };
      
      if (query.entityTypes && query.entityTypes.length > 0) {
        where.type = { in: query.entityTypes };
      }

      if (query.searchTerm) {
        where.OR = [
          { name: { contains: query.searchTerm, mode: 'insensitive' } },
          { description: { contains: query.searchTerm, mode: 'insensitive' } }
        ];
      }

      const entities = await this.prisma.knowledgeEntity.findMany({
        where,
        take: query.maxResults || 50,
        orderBy: { createdAt: 'desc' }
      });

      return entities;
    } catch (error) {
      console.error('Failed to search entities:', error);
      throw new Error(`Failed to search entities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get relationships for an entity
   */
  async getEntityRelationships(entityId: string, tenantId: string = 'default'): Promise<any[]> {
    try {
      const relationships = await this.prisma.knowledgeRelationship.findMany({
        where: {
          tenantId,
          OR: [
            { sourceEntityId: entityId },
            { targetEntityId: entityId }
          ]
        },
        include: {
          sourceEntity: true,
          targetEntity: true
        }
      });

      return relationships;
    } catch (error) {
      console.error('Failed to get entity relationships:', error);
      throw new Error(`Failed to get entity relationships: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get entity neighborhood (entities within N degrees)
   */
  async getEntityNeighborhood(entityId: string, depth: number = 2, tenantId: string = 'default'): Promise<{
    entities: any[];
    relationships: any[];
  }> {
    try {
      // Simple implementation - get direct connections
      const relationships = await this.getEntityRelationships(entityId, tenantId);
      
      const connectedEntityIds = new Set<string>();
      relationships.forEach(rel => {
        connectedEntityIds.add(rel.sourceEntityId);
        connectedEntityIds.add(rel.targetEntityId);
      });

      const entities = await this.prisma.knowledgeEntity.findMany({
        where: {
          tenantId,
          id: { in: Array.from(connectedEntityIds) }
        }
      });

      return {
        entities,
        relationships: relationships.map(rel => ({
          id: rel.id,
          sourceEntityId: rel.sourceEntityId,
          targetEntityId: rel.targetEntityId,
          type: rel.type,
          weight: rel.weight,
          confidence: rel.confidence,
          properties: rel.properties,
          metadata: rel.metadata,
          createdAt: rel.createdAt,
          updatedAt: rel.updatedAt
        }))
      };
    } catch (error) {
      console.error('Failed to get entity neighborhood:', error);
      throw new Error(`Failed to get entity neighborhood: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate graph analytics
   */
  async calculateGraphAnalytics(tenantId: string = 'default'): Promise<GraphAnalytics> {
    try {
      console.log('📊 Calculating graph analytics...');
      
      const nodeCount = await this.prisma.knowledgeEntity.count({
        where: { tenantId }
      });
      
      const edgeCount = await this.prisma.knowledgeRelationship.count({
        where: { tenantId }
      });
      
      // Calculate density: actual edges / possible edges
      const possibleEdges = nodeCount * (nodeCount - 1);
      const density = possibleEdges > 0 ? edgeCount / possibleEdges : 0;

      // Generate basic insights
      const insights: Array<{
        type: string;
        description: string;
        importance: 'MINOR' | 'MODERATE' | 'SIGNIFICANT' | 'CRITICAL';
        metrics: Record<string, number>;
      }> = [
        {
          type: 'GRAPH_SIZE',
          description: `The knowledge graph contains ${nodeCount} entities and ${edgeCount} relationships`,
          importance: 'MODERATE',
          metrics: { nodes: nodeCount, edges: edgeCount, size: nodeCount + edgeCount }
        },
        {
          type: 'DENSITY',
          description: `Graph density is ${(density * 100).toFixed(2)}%`,
          importance: density > 0.1 ? 'SIGNIFICANT' : 'MODERATE',
          metrics: { density: density, percentage: density * 100 }
        }
      ];

      console.log(`✅ Analytics calculated: ${nodeCount} nodes, ${edgeCount} edges, density: ${density.toFixed(3)}`);

      return {
        nodeCount,
        edgeCount,
        density,
        insights,
        lastCalculated: new Date()
      };
    } catch (error) {
      console.error('Failed to calculate analytics:', error);
      throw new Error(`Failed to calculate analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update entity
   */
  async updateEntity(entityId: string, updates: Partial<EntityData>, tenantId: string = 'default'): Promise<any> {
    try {
      const entity = await this.prisma.knowledgeEntity.update({
        where: { 
          id: entityId,
          tenantId 
        },
        data: {
          ...(updates.name && { name: updates.name }),
          ...(updates.description && { description: updates.description }),
          ...(updates.properties && { properties: updates.properties as any }),
          ...(updates.metadata && { metadata: updates.metadata as any })
        }
      });

      console.log(`✅ Updated entity: ${entity.name} (ID: ${entity.id})`);
      return entity;
    } catch (error) {
      console.error('Failed to update entity:', error);
      throw new Error(`Failed to update entity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete entity and its relationships
   */
  async deleteEntity(entityId: string, tenantId: string = 'default'): Promise<void> {
    try {
      // Delete relationships first
      await this.prisma.knowledgeRelationship.deleteMany({
        where: {
          tenantId,
          OR: [
            { sourceEntityId: entityId },
            { targetEntityId: entityId }
          ]
        }
      });

      // Delete entity
      await this.prisma.knowledgeEntity.delete({
        where: { 
          id: entityId,
          tenantId 
        }
      });

      console.log(`✅ Deleted entity: ${entityId}`);
    } catch (error) {
      console.error('Failed to delete entity:', error);
      throw new Error(`Failed to delete entity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete relationship
   */
  async deleteRelationship(relationshipId: string, tenantId: string = 'default'): Promise<void> {
    try {
      await this.prisma.knowledgeRelationship.delete({
        where: { 
          id: relationshipId,
          tenantId 
        }
      });

      console.log(`✅ Deleted relationship: ${relationshipId}`);
    } catch (error) {
      console.error('Failed to delete relationship:', error);
      throw new Error(`Failed to delete relationship: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; message: string; timestamp: Date }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        message: 'Knowledge Graph Service is operational',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Cleanup and disconnect
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export default KnowledgeGraphService;
