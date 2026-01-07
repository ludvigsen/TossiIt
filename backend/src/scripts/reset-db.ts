import { prisma } from '../db';

async function resetDatabase() {
  try {
    console.log('Resetting database...');
    
    // Delete all data in the correct order (respecting foreign key constraints)
    console.log('Deleting events...');
    await prisma.event.deleteMany();
    
    console.log('Deleting smart_inbox...');
    await prisma.smartInbox.deleteMany();
    
    console.log('Deleting raw_dumps...');
    await prisma.rawDump.deleteMany();
    
    console.log('Deleting users...');
    await prisma.user.deleteMany();
    
    console.log('✓ Database reset complete!');
    console.log('All tables have been cleared.');
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Failed to reset database:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

resetDatabase();

