import { Router, Request, Response } from 'express';
import { query } from '../db';
import { config } from '../config';

const router = Router();

// POST /api/auth/sync-token
// Save the refresh token obtained on the client (offline access)
router.post('/sync-token', async (req: Request, res: Response) => {
  try {
    const { refresh_token, email, server_auth_code } = req.body;

    if (!email) {
      res.status(400).json({ error: 'email is required' });
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

    // Upsert user
    try {
      const upsertQuery = `
        INSERT INTO users (email, google_refresh_token)
        VALUES ($1, $2)
        ON CONFLICT (email) 
        DO UPDATE SET google_refresh_token = $2
        RETURNING *;
      `;
      const result = await query(upsertQuery, [email, tokenToStore]);
      res.json(result.rows[0]);
    } catch (dbError) {
      console.error('DB error syncing token, returning skip:', dbError);
      res.status(200).json({ status: 'skipped_db_error', error: 'DB unavailable, token not persisted' });
    }
  } catch (error) {
    console.error('Error syncing token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

