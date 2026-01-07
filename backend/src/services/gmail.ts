import { prisma } from '../db';
import { processRawDump } from './processor';

export const ingestEmails = async (userId: string) => {
  try {
    console.log(`Checking emails for user ${userId}...`);
    // 1. Get refresh token
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleRefreshToken: true }
    });
    
    const refreshToken = user?.googleRefreshToken;

    if (!refreshToken) {
      console.warn(`No refresh token for user ${userId}, skipping email sync.`);
      return;
    }

    // 2. Mock Gmail Fetch
    // const gmail = google.gmail({ version: 'v1', auth });
    // const res = await gmail.users.messages.list({ userId: 'me', q: 'is:unread' });
    
    // MOCK: Simulate finding an email
    const mockEmails: any[] = []; 
    // mockEmails.push({ id: 'msg123', snippet: 'Soccer practice tomorrow at 5pm' });

    for (const email of mockEmails) {
        // Check if already processed (deduplication logic needed in real app)
        
        // Save to raw_dumps
        const newDump = await prisma.rawDump.create({
          data: {
            userId: userId,
            contentText: email.snippet,
            sourceType: 'gmail_forward'
          }
        });

        // Process
        processRawDump(newDump.id);
    }

  } catch (error) {
    console.error('Error ingesting emails:', error);
  }
};

