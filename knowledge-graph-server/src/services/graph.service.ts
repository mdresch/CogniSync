const driver = require('../utils/db').default;
const { v4: uuidv4 } = require('uuid');

class GraphService {
  async createEntity(input: { id?: string; type: string; name: string; metadata?: string }) {
      const session = driver.session();
      try {
        const entityId = input.id || uuidv4();
        const result = await session.run(
          `MERGE (e:Entity {id: $id})
           ON CREATE SET e.type = $type, e.name = $name, e.metadata = $metadata, e.createdAt = timestamp()
           ON MATCH SET e.name = $name, e.metadata = $metadata, e.updatedAt = timestamp()
           RETURN e`,
          {
            id: entityId,
            type: input.type,
            name: input.name,
            metadata: input.metadata || '{}',
          }
        );
        if (!result.records || result.records.length === 0) {
          console.error('[createEntity] No records returned from Neo4j for input:', input);
          return { error: 'Entity creation failed: No records returned.' };
        }
        const singleRecord = result.records[0];
        if (!singleRecord) {
          console.error('[createEntity] Single record is undefined for input:', input);
          return { error: 'Entity creation failed: Record undefined.' };
        }
        const node = singleRecord.get('e');
        if (!node) {
          console.error('[createEntity] Node is undefined for input:', input);
          return { error: 'Entity creation failed: Node undefined.' };
        }
        return { ...node.properties };
      } catch (err) {
        console.error('[createEntity] Exception:', err, 'Input:', input);
        return { error: 'Entity creation failed: Exception occurred.' };
      } finally {
        await session.close();
      }
  }

  async getEntityById(id: string) {
    const session = driver.session();
    try {
      const result = await session.run(
        'MATCH (e:Entity {id: $id}) RETURN e',
        { id }
      );
      if (!result.records || result.records.length === 0) {
        return null;
      }
      const singleRecord = result.records[0];
      if (!singleRecord) return null;
      const node = singleRecord.get('e');
      return { ...node.properties };
    } finally {
      await session.close();
    }
  }

  async linkEntities(input: { sourceEntityId: string; targetEntityId: string; relationshipType: string }) {
    const session = driver.session();
    try {
      await session.run(
        `MATCH (source:Entity {id: $sourceId})
         MATCH (target:Entity {id: $targetId})
         MERGE (source)-[r:${input.relationshipType}]->(target)
         RETURN type(r)`,
        {
          sourceId: input.sourceEntityId,
          targetId: input.targetEntityId,
        }
      );
      return "Relationship created successfully.";
    } finally {
      await session.close();
    }
  }
}

module.exports = { GraphService };
