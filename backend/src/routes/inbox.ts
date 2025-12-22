import { Router, Request, Response } from 'express';
import { query } from '../db';
import { createCalendarEvent } from '../services/calendar';

const router = Router();

// GET /api/inbox - Fetch pending items
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string; // Temporary auth
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized: Missing X-User-Id' });
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
router.post('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id, title, start_time, end_time, category, location } = req.body;
    
    // Validate required fields
    if (!title || !start_time) {
        res.status(400).json({ error: 'Missing required fields (title, start_time)' });
        return;
    }

    // 1. Mark inbox item as approved
    await query(`UPDATE smart_inbox SET status = 'approved' WHERE id = $1`, [id]);

    // 2. Get the dump_id from the inbox item (optional, for linking)
    const inboxRes = await query('SELECT dump_id FROM smart_inbox WHERE id = $1', [id]);
    const dumpId = inboxRes.rows[0]?.dump_id;

    // 3. Create Google Calendar Event
    const eventData = { title, start_time, end_time, location, category };
    const gcalEventId = await createCalendarEvent(user_id, eventData);

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

