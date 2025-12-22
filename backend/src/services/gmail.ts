import { query } from '../db';
import { processRawDump } from './processor';

export const ingestEmails = async (userId: string) => {
  try {
    console.log(`Checking emails for user ${userId}...`);
    // 1. Get refresh token
    const userRes = await query('SELECT google_refresh_token FROM users WHERE id = $1', [userId]);
    const refreshToken = userRes.rows[0]?.google_refresh_token;

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
        const insertQuery = `
            INSERT INTO raw_dumps (user_id, content_text, source_type)
            VALUES ($1, $2, 'gmail_forward')
            RETURNING id;
        `;
        const result = await query(insertQuery, [userId, email.snippet]);
        const newDumpId = result.rows[0].id;

        // Process
        processRawDump(newDumpId);
    }

  } catch (error) {
    console.error('Error ingesting emails:', error);
  }
};

