import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { config } from '../config';

const router = Router();

// POST /api/auth/sync-token
// Save the refresh token obtained on the client (offline access)
router.post('/sync-token', async (req: Request, res: Response) => {
  try {
    const { refresh_token, email, server_auth_code, user_id } = req.body;

    if (!email) {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    if (!user_id) {
      res.status(400).json({ error: 'user_id (Google User ID) is required' });
      return;
    }

    // We accept either a refresh_token or a server_auth_code (to be exchanged later)
    const tokenToStore = refresh_token || server_auth_code || null;
    if (!tokenToStore) {
      res.status(400).json({ error: 'refresh_token or server_auth_code is required' });
      return;
    }

    // If database is not configured, gracefully skip persistence
    if (!config.databaseUrl) {
      res.status(200).json({ status: 'skipped', reason: 'DATABASE_URL missing; token not persisted.' });
      return;
    }

    // Upsert user - use Google User ID as primary key
    try {
      // First, check if user exists by email (might have old UUID ID)
      const existingUserByEmail = await prisma.user.findUnique({
        where: { email }
      });

      let user;
      if (existingUserByEmail) {
        // User exists with this email
        if (existingUserByEmail.id === user_id) {
          // Same ID, just update token
          user = await prisma.user.update({
            where: { id: user_id },
            data: { googleRefreshToken: tokenToStore }
          });
        } else {
          // Different ID - need to migrate: delete old user and create new one
          // This will cascade delete all related data (dumps, inbox, events)
          console.log(`Migrating user ${email} from ${existingUserByEmail.id} to ${user_id}`);
          await prisma.user.delete({
            where: { email }
          });
          // Create new user with Google User ID
          user = await prisma.user.create({
            data: {
              id: user_id,
              email,
              googleRefreshToken: tokenToStore
            }
          });
        }
      } else {
        // Check if user exists with this Google User ID (shouldn't happen, but just in case)
        const existingUserById = await prisma.user.findUnique({
          where: { id: user_id }
        });
        
        if (existingUserById) {
          // User exists with this ID but different email - update email and token
          user = await prisma.user.update({
            where: { id: user_id },
            data: {
              email,
              googleRefreshToken: tokenToStore
            }
          });
        } else {
          // User doesn't exist, create with Google User ID
          user = await prisma.user.create({
            data: {
              id: user_id,
              email,
              googleRefreshToken: tokenToStore
            }
          });
        }
      }
      res.json(user);
    } catch (dbError: any) {
      console.error('DB error syncing token:', dbError);
      res.status(500).json({ error: 'Failed to sync token', details: dbError.message });
    }
  } catch (error) {
    console.error('Error syncing token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

