import { Router, Request, Response } from 'express';
import { query } from '../db';
import { createCalendarEvent } from '../services/calendar';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/inbox - Fetch pending items
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized: Missing User ID' });
        return;
    }

    const result = await query(
      `SELECT * FROM smart_inbox WHERE user_id = $1 AND status != 'approved' ORDER BY created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inbox:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inbox/:id/confirm - Confirm/Edit item -> Move to events
router.post('/:id/confirm', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, start_time, end_time, category, location } = req.body;
    const user_id = (req as AuthRequest).user?.id;

    if (!user_id) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    
    // Validate required fields
    if (!title || !start_time) {
        res.status(400).json({ error: 'Missing required fields (title, start_time)' });
        return;
    }
    
    // 1. Get the inbox item first to verify existence and get dump_id
    const inboxRes = await query('SELECT dump_id, user_id FROM smart_inbox WHERE id = $1', [id]);
    if (inboxRes.rows.length === 0) {
        res.status(404).json({ error: 'Inbox item not found' });
        return;
    }
    
    // Verify ownership
    if (inboxRes.rows[0].user_id !== user_id) {
        res.status(403).json({ error: 'Forbidden: Not your item' });
        return;
    }

    const dumpId = inboxRes.rows[0].dump_id;

    // 2. Create Google Calendar Event FIRST to ensure external sync works
    const eventData = { title, start_time, end_time, location, category };
    const gcalEventId = await createCalendarEvent(user_id, eventData);

    if (!gcalEventId && process.env.NODE_ENV === 'production') {
         // In production we might want to fail hard, or just log warning
         // For now, proceeding but noting it could be an issue
    }

    // 3. Mark inbox item as approved
    await query(`UPDATE smart_inbox SET status = 'approved' WHERE id = $1`, [id]);

    // 4. Insert into Events
    const insertEventQuery = `
      INSERT INTO events (user_id, title, start_time, end_time, location, category, gcal_event_id, origin_dump_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    
    const result = await query(insertEventQuery, [
      user_id, title, start_time, end_time, location, category, gcalEventId, dumpId
    ]);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Error confirming inbox item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

