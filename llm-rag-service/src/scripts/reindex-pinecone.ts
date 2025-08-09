#!/usr/bin/env tsx
/**
 * Bulk upsert all existing document chunks into Pinecone.
 *
 * Usage examples:
 *  - tsx src/scripts/reindex-pinecone.ts
 *  - tsx src/scripts/reindex-pinecone.ts --tenant my-tenant --batch 200
 *  - tsx src/scripts/reindex-pinecone.ts --limit 5000
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pinecone } from '@pinecone-database/pinecone';

type Args = {
  tenant?: string;
  batch?: number;
  limit?: number;
  dryRun?: boolean;
};

function parseArgs(): Args {
  const args: Args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--tenant' && process.argv[i + 1]) args.tenant = process.argv[++i];
    else if (a === '--batch' && process.argv[i + 1]) args.batch = Number(process.argv[++i]);
    else if (a === '--limit' && process.argv[i + 1]) args.limit = Number(process.argv[++i]);
    else if (a === '--dry-run') args.dryRun = true;
  }
  return args;
}

async function main() {
  const { tenant, batch = 200, limit, dryRun = false } = parseArgs();

  const provider = process.env.VECTOR_DB_PROVIDER || process.env.SEMANTIC_INDEX_PROVIDER;
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME;

  if (!provider || provider !== 'pinecone') {
    console.error('Vector DB provider is not set to pinecone. Set VECTOR_DB_PROVIDER=pinecone');
    process.exit(1);
  }
  if (!apiKey || !indexName) {
    console.error('Missing PINECONE_API_KEY or PINECONE_INDEX_NAME in environment.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const pinecone = new Pinecone({ apiKey });

  // Ensure index exists; create if env allows
  let index = pinecone.Index(indexName);
  try {
    await pinecone.describeIndex(indexName);
  } catch (e: any) {
    if (dryRun) {
      console.warn(
        `Index '${indexName}' not found. Dry-run mode: would create index. Skipping creation to avoid side effects.`
      );
      await prisma.$disconnect();
      process.exit(0);
    }
    const dimsEnv = process.env.PINECONE_DIMENSIONS;
    const cloud = process.env.PINECONE_CLOUD as 'aws' | 'gcp' | undefined;
    const region = process.env.PINECONE_REGION;
    if (!dimsEnv || !cloud || !region) {
      console.error(
        `Index '${indexName}' not found. Set PINECONE_DIMENSIONS, PINECONE_CLOUD (aws|gcp), and PINECONE_REGION (e.g., us-east-1) to allow auto-create, or create the index manually in the Pinecone Console.`
      );
      process.exit(1);
    }

    const dimension = Number(dimsEnv);
    if (!Number.isFinite(dimension) || dimension <= 0) {
      console.error(`Invalid PINECONE_DIMENSIONS='${dimsEnv}'. It must be a positive number (e.g., 1536).`);
      process.exit(1);
    }

    console.log(`Index '${indexName}' not found. Creating (dimension=${dimension}, cloud=${cloud}, region=${region})...`);
    await pinecone.createIndex({
      name: indexName,
      dimension,
      metric: 'cosine',
      spec: { serverless: { cloud, region } },
    } as any);

    // Wait briefly for the index to be ready
    const startWait = Date.now();
    const timeoutMs = 60_000;
    while (true) {
      try {
        const info: any = await pinecone.describeIndex(indexName);
        if ((info?.status?.ready ?? false) === true) break;
      } catch {}
      if (Date.now() - startWait > timeoutMs) {
        console.warn('Index creation is taking longer than expected; continuing.');
        break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    index = pinecone.Index(indexName);
    console.log(`Index '${indexName}' is ready or initializing. Proceeding with upserts...`);
  }

  console.log('Reindex starting with config:', {
    provider,
    indexName,
    tenant: tenant || '(all tenants)',
    batch,
    limit: limit || '(no limit)'
  });

  let offset = 0;
  let totalProcessed = 0;
  let totalUpserted = 0;
  const start = Date.now();

  try {
    // Simple paging using skip/take
    while (true) {
      if (limit && totalProcessed >= limit) break;

      const take = Math.min(batch, limit ? Math.max(0, limit - totalProcessed) : batch);
      if (take === 0) break;

      const chunks = await prisma.documentChunk.findMany({
        where: tenant ? { tenantId: tenant } : {},
        include: { document: { select: { title: true, source: true } } },
        orderBy: { createdAt: 'asc' },
        skip: offset,
        take,
      });

      if (chunks.length === 0) break;

      totalProcessed += chunks.length;
      offset += chunks.length;

      const vectors = chunks.map((c) => ({
        id: c.id,
        values: JSON.parse(c.embedding as any) as number[],
        metadata: {
          tenantId: (c as any).tenantId,
          documentId: c.documentId,
          chunkIndex: c.chunkIndex,
          source: (c as any).document?.source || 'api',
          title: (c as any).document?.title || 'Untitled',
        },
      }));

      if (dryRun) {
        console.log(`Dry-run: would upsert ${vectors.length} vectors (processed: ${totalProcessed})`);
      } else {
        await index.upsert(vectors as any);
        totalUpserted += vectors.length;
        console.log(`Upserted ${vectors.length} vectors (processed: ${totalProcessed})`);
      }
    }

    console.log('Reindex completed:', {
      totalProcessed,
      totalUpserted: dryRun ? 0 : totalUpserted,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    console.error('Reindex failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
