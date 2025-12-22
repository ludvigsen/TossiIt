import { query } from '../db';

export const searchSimilarDumps = async (embedding: number[], limit: number = 3) => {
    if (!embedding || embedding.length === 0) return [];

    // Format embedding as vector string for pgvector: '[1.0, 2.0, ...]'
    const vectorString = `[${embedding.join(',')}]`;
    
    const sql = `
        SELECT content_text, 1 - (embedding <=> $1) as similarity
        FROM raw_dumps
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1
        LIMIT $2;
    `;
    
    try {
        const result = await query(sql, [vectorString, limit]);
        return result.rows;
    } catch (error) {
        console.error("Error searching similar dumps:", error);
        return [];
    }
};

