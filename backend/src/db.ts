import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from './config';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/nextjs-best-practices

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

// Create a PostgreSQL pool
const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: config.databaseUrl,
    max: process.env.NODE_ENV === 'production' ? 1 : 10,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.pool = pool;

// Create Prisma adapter
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Test connection on startup
prisma.$connect()
  .then(() => {
    console.log('✓ Database connection successful');
  })
  .catch((err) => {
    console.error('✗ Database connection failed:', err.message);
  });

export default prisma;
