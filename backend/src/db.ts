import { Pool } from 'pg';
import { config } from './config';

const isProduction = process.env.NODE_ENV === 'production';

let pool: Pool;

if (config.databaseUrl) {
    pool = new Pool({
        connectionString: config.databaseUrl,
        max: isProduction ? 1 : 10,
        ssl: isProduction && !config.databaseUrl?.includes('localhost') ? { rejectUnauthorized: false } : false,
    });
} else {
    console.warn("DATABASE_URL is missing. Database features will fail.");
    // Create a dummy pool or handle undefined in query
}

export const query = (text: string, params?: any[]) => {
    if (!pool) throw new Error("Database not configured (DATABASE_URL missing)");
    return pool.query(text, params);
};
export const getClient = () => {
    if (!pool) throw new Error("Database not configured (DATABASE_URL missing)");
    return pool.connect();
};

export default {
  query,
  getClient,
};

