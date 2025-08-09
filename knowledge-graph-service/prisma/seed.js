"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Seeding database...');
    // Create sample entities
    const personEntity = await prisma.knowledgeEntity.create({
        data: {
            type: 'PERSON',
            name: 'John Smith',
            description: 'Senior Software Engineer',
            properties: {
                email: 'john.smith@example.com',
                department: 'Engineering',
                role: 'Senior Developer'
            },
            metadata: {
                confidence: 'HIGH',
                importance: 'SIGNIFICANT',
                source: 'HR_System',
                extractionMethod: 'API_INTEGRATION',
                tags: ['developer', 'senior', 'engineering'],
                aliases: ['J. Smith', 'John']
            },
            tenantId: 'default'
        }
    });
    const documentEntity = await prisma.knowledgeEntity.create({
        data: {
            type: 'DOCUMENT',
            name: 'API Design Guidelines',
            description: 'Company-wide API design standards and best practices',
            properties: {
                format: 'markdown',
                version: '2.1',
                lastUpdated: '2024-01-15',
                url: 'https://docs.company.com/api-guidelines'
            },
            metadata: {
                confidence: 'HIGH',
                importance: 'CRITICAL',
                source: 'Documentation_System',
                extractionMethod: 'MANUAL',
                tags: ['api', 'guidelines', 'standards', 'documentation'],
                aliases: ['API Guidelines', 'Design Standards']
            },
            tenantId: 'default'
        }
    });
    const projectEntity = await prisma.knowledgeEntity.create({
        data: {
            type: 'PROJECT',
            name: 'CogniSync Platform',
            description: 'Knowledge management and synchronization platform',
            properties: {
                status: 'active',
                startDate: '2024-01-01',
                team: 'Platform Engineering',
                budget: 500000
            },
            metadata: {
                confidence: 'HIGH',
                importance: 'CRITICAL',
                source: 'Project_Management_System',
                extractionMethod: 'API_INTEGRATION',
                tags: ['platform', 'knowledge-management', 'sync'],
                aliases: ['CogniSync', 'Platform']
            },
            tenantId: 'default'
        }
    });
    const apiEntity = await prisma.knowledgeEntity.create({
        data: {
            type: 'API',
            name: 'Knowledge Graph API',
            description: 'REST API for knowledge graph operations',
            properties: {
                version: 'v1',
                baseUrl: 'https://api.cognisync.com/kg/v1',
                methods: ['GET', 'POST', 'PUT', 'DELETE'],
                authentication: 'API_KEY'
            },
            metadata: {
                confidence: 'HIGH',
                importance: 'SIGNIFICANT',
                source: 'API_Registry',
                extractionMethod: 'MANUAL',
                tags: ['api', 'knowledge-graph', 'rest'],
                aliases: ['KG API', 'Graph API']
            },
            tenantId: 'default'
        }
    });
    const conceptEntity = await prisma.knowledgeEntity.create({
        data: {
            type: 'CONCEPT',
            name: 'Knowledge Graph',
            description: 'A knowledge representation that stores information in nodes and edges',
            properties: {
                definition: 'A graph-based data structure that represents knowledge as entities and relationships',
                domain: 'Computer Science',
                applications: ['Semantic Search', 'AI', 'Data Integration']
            },
            metadata: {
                confidence: 'HIGH',
                importance: 'CRITICAL',
                source: 'Knowledge_Base',
                extractionMethod: 'MANUAL',
                tags: ['concept', 'graph', 'knowledge', 'semantic'],
                aliases: ['KG', 'Semantic Graph', 'Entity Graph']
            },
            tenantId: 'default'
        }
    });
    console.log(`✅ Created ${personEntity.name} (Person)`);
    console.log(`✅ Created ${documentEntity.name} (Document)`);
    console.log(`✅ Created ${projectEntity.name} (Project)`);
    console.log(`✅ Created ${apiEntity.name} (API)`);
    console.log(`✅ Created ${conceptEntity.name} (Concept)`);
    // Create sample relationships
    const relationships = [
        {
            sourceEntityId: personEntity.id,
            targetEntityId: projectEntity.id,
            type: 'PARTICIPATES_IN',
            weight: 1.0,
            confidence: 'HIGH',
            properties: {
                role: 'Lead Developer',
                startDate: '2024-01-01'
            },
            metadata: {
                source: 'Project_Management_System',
                extractionMethod: 'API_INTEGRATION',
                evidenceCount: 3,
                isInferred: false,
                context: 'John Smith is assigned as lead developer on CogniSync Platform'
            },
            tenantId: 'default'
        },
        {
            sourceEntityId: personEntity.id,
            targetEntityId: documentEntity.id,
            type: 'AUTHORED_BY',
            weight: 0.9,
            confidence: 'HIGH',
            properties: {
                authorshipDate: '2024-01-10',
                contributionLevel: 'primary'
            },
            metadata: {
                source: 'Documentation_System',
                extractionMethod: 'MANUAL',
                evidenceCount: 1,
                isInferred: false,
                context: 'John Smith authored the API Design Guidelines document'
            },
            tenantId: 'default'
        },
        {
            sourceEntityId: documentEntity.id,
            targetEntityId: apiEntity.id,
            type: 'REFERENCES',
            weight: 0.8,
            confidence: 'MEDIUM',
            properties: {
                referenceType: 'specification',
                relevance: 'high'
            },
            metadata: {
                source: 'Document_Analysis',
                extractionMethod: 'NLP',
                evidenceCount: 5,
                isInferred: true,
                context: 'API Design Guidelines document references Knowledge Graph API specifications'
            },
            tenantId: 'default'
        },
        {
            sourceEntityId: apiEntity.id,
            targetEntityId: conceptEntity.id,
            type: 'IMPLEMENTS',
            weight: 1.0,
            confidence: 'HIGH',
            properties: {
                implementationType: 'REST_API',
                completeness: 'full'
            },
            metadata: {
                source: 'Technical_Documentation',
                extractionMethod: 'MANUAL',
                evidenceCount: 1,
                isInferred: false,
                context: 'Knowledge Graph API implements knowledge graph concepts'
            },
            tenantId: 'default'
        },
        {
            sourceEntityId: projectEntity.id,
            targetEntityId: conceptEntity.id,
            type: 'USES',
            weight: 0.9,
            confidence: 'HIGH',
            properties: {
                usage: 'core_technology',
                importance: 'critical'
            },
            metadata: {
                source: 'Project_Architecture',
                extractionMethod: 'MANUAL',
                evidenceCount: 2,
                isInferred: false,
                context: 'CogniSync Platform uses knowledge graph as core technology'
            },
            tenantId: 'default'
        }
    ];
    for (const relationshipData of relationships) {
        const relationship = await prisma.knowledgeRelationship.create({
            data: relationshipData
        });
        console.log(`🔗 Created relationship: ${relationshipData.type} (${relationship.id})`);
    }
    // Create a graph snapshot for analytics
    await prisma.graphSnapshot.create({
        data: {
            name: 'Initial Seed Snapshot',
            description: 'Graph snapshot created during database seeding',
            createdBy: 'seed_script',
            tenantId: 'default',
            analytics: {
                totalNodes: 5,
                totalEdges: 5,
                mostConnectedEntity: personEntity.name,
                graphDensity: 0.5,
                entityTypes: ['PERSON', 'DOCUMENT', 'PROJECT', 'API', 'CONCEPT'],
                relationshipTypes: ['PARTICIPATES_IN', 'AUTHORED_BY', 'REFERENCES', 'IMPLEMENTS', 'USES']
            },
            metadata: {
                createdBy: 'seed_script',
                version: '1.0',
                algorithm: 'basic_analytics'
            }
        }
    });
    console.log('📊 Created graph snapshot');
    console.log('🌱 Database seeded successfully!');
    console.log('');
    console.log('📝 Sample data created:');
    console.log('   - 5 entities (Person, Document, Project, API, Concept)');
    console.log('   - 5 relationships connecting the entities');
    console.log('   - 1 graph snapshot for analytics');
    console.log('');
    console.log('🚀 You can now start the service and explore the API:');
    console.log('   npm run dev');
    console.log('   http://localhost:3001/api/v1/docs');
}
main()
    .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map