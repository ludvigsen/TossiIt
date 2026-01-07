import { prisma } from '../db';
import { Prisma } from '@prisma/client';

export const searchSimilarDumps = async (
    embedding: number[], 
    userId: string, 
    excludeDumpId?: string,
    limit: number = 3
) => {
    if (!embedding || embedding.length === 0) return [];

    // Format embedding as vector string for pgvector: '[1.0, 2.0, ...]'
    const vectorString = `[${embedding.join(',')}]`;
    
    // Use raw SQL for pgvector operations since Prisma doesn't natively support it
    // CRITICAL: Filter by user_id to avoid scanning all users' data
    // Also exclude the current dump to avoid self-matching
    try {
        const result = await prisma.$queryRaw<Array<{ content_text: string; similarity: number }>>`
            SELECT content_text, 1 - (embedding <=> ${Prisma.raw(`${vectorString}::vector`)}) as similarity
        FROM raw_dumps
        WHERE embedding IS NOT NULL
              AND user_id = ${userId}
              ${excludeDumpId ? Prisma.raw(`AND id != '${excludeDumpId}'::uuid`) : Prisma.empty}
            ORDER BY embedding <=> ${Prisma.raw(`${vectorString}::vector`)}
            LIMIT ${limit}
        `;
        return result;
    } catch (error) {
        console.error("Error searching similar dumps:", error);
        return [];
    }
};

