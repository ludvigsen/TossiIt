import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

// POST /api/auth/sync-token
// Save the refresh token obtained on the client (offline access)
router.post('/sync-token', async (req: Request, res: Response) => {
  try {
    const { user_id, refresh_token, email } = req.body;
    
    // Upsert user
    const upsertQuery = `
      INSERT INTO users (email, google_refresh_token)
      VALUES ($1, $2)
      ON CONFLICT (email) 
      DO UPDATE SET google_refresh_token = $2
      RETURNING *;
    `;
    // If we have user_id, we might want to update by ID, but for now email is unique.
    // If strictly following schema, we might need to handle user creation differently.
    
    const result = await query(upsertQuery, [email, refresh_token]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error syncing token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

