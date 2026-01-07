import { prisma } from '../src/db';
import * as fs from 'fs';
import * as path from 'path';

async function setupDatabase() {
  try {
    console.log('Setting up database schema...');
    console.log('Note: For Prisma, use "npm run prisma:migrate" to create and apply migrations.');
    console.log('This script will set up the vector extension and verify the schema...\n');
    
    // Enable vector extension (if not already enabled)
      try {
      await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
      console.log('✓ Vector extension enabled');
      } catch (error: any) {
      if (error.code === '42704') {
          console.log('⚠️  Vector extension not available. If using Supabase, enable pgvector in Dashboard > Database > Extensions');
        } else {
        console.log('⚠️  Could not enable vector extension:', error.message);
      }
    }
    
    // Verify tables exist by trying to query them
    try {
      await prisma.user.findFirst();
      await prisma.rawDump.findFirst();
      await prisma.smartInbox.findFirst();
      await prisma.event.findFirst();
      console.log('✓ All tables exist');
    } catch (error: any) {
      console.error('✗ Error verifying tables:', error.message);
      console.error('   Run "npm run prisma:migrate" to create the database schema');
      process.exit(1);
    }
    
    console.log('\n✓ Database schema setup complete!');
    console.log('💡 Tip: Use "npm run prisma:studio" to view and edit your database');
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Failed to setup database:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

setupDatabase();

