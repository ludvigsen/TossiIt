import { prisma } from '../db';
import { Prisma } from '@prisma/client';

export const searchSimilarDumps = async (embedding: number[], limit: number = 3) => {
    if (!embedding || embedding.length === 0) return [];

    // Format embedding as vector string for pgvector: '[1.0, 2.0, ...]'
    const vectorString = `[${embedding.join(',')}]`;
    
    // Use raw SQL for pgvector operations since Prisma doesn't natively support it
    // Using Prisma.sql for safer parameterization, but we need to cast to vector type
    try {
        const result = await prisma.$queryRaw<Array<{ content_text: string; similarity: number }>>`
            SELECT content_text, 1 - (embedding <=> ${Prisma.raw(`${vectorString}::vector`)}) as similarity
            FROM raw_dumps
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> ${Prisma.raw(`${vectorString}::vector`)}
            LIMIT ${limit}
        `;
        return result;
    } catch (error) {
        console.error("Error searching similar dumps:", error);
        return [];
    }
};

