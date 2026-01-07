import { Router, Request, Response } from 'express';
import { prisma } from '../db';
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

    const inboxItems = await prisma.smartInbox.findMany({
      where: {
        userId,
        status: { 
          notIn: ['approved', 'rejected', 'dismissed']
        }
      },
      include: {
        dump: {
          select: {
            id: true,
            contentText: true,
            mediaUrl: true,
            sourceType: true,
            createdAt: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(inboxItems);
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
    const inboxItem = await prisma.smartInbox.findUnique({
      where: { id },
      select: { dumpId: true, userId: true }
    });
    
    if (!inboxItem) {
        res.status(404).json({ error: 'Inbox item not found' });
        return;
    }
    
    // Verify ownership
    if (inboxItem.userId !== user_id) {
        res.status(403).json({ error: 'Forbidden: Not your item' });
        return;
    }

    const dumpId = inboxItem.dumpId;

    // 2. Create Google Calendar Event FIRST to ensure external sync works
    const eventData = { title, start_time, end_time, location, category };
    const gcalEventId = await createCalendarEvent(user_id, eventData);

    if (!gcalEventId && process.env.NODE_ENV === 'production') {
         // In production we might want to fail hard, or just log warning
         // For now, proceeding but noting it could be an issue
    }

    // 3. Mark inbox item as approved
    await prisma.smartInbox.update({
      where: { id },
      data: { status: 'approved' }
    });

    // 4. Insert into Events
    const event = await prisma.event.create({
      data: {
        userId: user_id,
        title,
        startTime: new Date(start_time),
        endTime: end_time ? new Date(end_time) : null,
        location: location || null,
        category: category || null,
        gcalEventId: gcalEventId,
        originDumpId: dumpId
      }
    });

    res.status(201).json(event);

  } catch (error) {
    console.error('Error confirming inbox item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inbox/:id/dismiss - Dismiss/Reject item (don't create event)
router.post('/:id/dismiss', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user_id = (req as AuthRequest).user?.id;

    if (!user_id) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    
    // 1. Get the inbox item first to verify existence
    const inboxItem = await prisma.smartInbox.findUnique({
      where: { id },
      select: { userId: true }
    });
    
    if (!inboxItem) {
        res.status(404).json({ error: 'Inbox item not found' });
        return;
    }
    
    // Verify ownership
    if (inboxItem.userId !== user_id) {
        res.status(403).json({ error: 'Forbidden: Not your item' });
        return;
    }

    // 2. Mark inbox item as dismissed/rejected
    await prisma.smartInbox.update({
      where: { id },
      data: { status: 'dismissed' }
    });

    res.status(200).json({ message: 'Item dismissed' });

  } catch (error) {
    console.error('Error dismissing inbox item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

