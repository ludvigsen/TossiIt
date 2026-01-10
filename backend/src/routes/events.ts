import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const now = new Date();
    const filter = req.query.filter as string | undefined; // 'coming' or 'past'
    
    const where: any = { userId };
    
    if (filter === 'coming') {
      where.startTime = { gte: now };
    } else if (filter === 'past') {
      where.startTime = { lt: now };
    }
    // If no filter, return all events

    const events = await prisma.event.findMany({
      where,
      include: {
        originDump: {
          select: { id: true, contentText: true, mediaUrl: true, category: true }
        },
        people: { select: { id: true, name: true, relationship: true } }
      },
      orderBy: filter === 'past' 
        ? { startTime: 'desc' } // Most recent first for past events
        : { startTime: 'asc' }  // Soonest first for coming events
    });
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/events/:id - Delete an event (owned by user)
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event || event.userId !== userId) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    await prisma.event.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

