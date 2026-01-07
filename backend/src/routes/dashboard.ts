import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/dashboard/today
// Returns events and todos for the current day
// Accepts optional ?timezone=... query param for client timezone (defaults to server timezone)
router.get('/today', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const now = new Date();
    
    // Calculate start and end of "today" in server timezone
    // For better UX, we could accept timezone from client, but for now use server timezone
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    // Fetch events for today (from start of day to end of day)
    // Also include events that started earlier today but haven't ended yet
    const eventsPromise = prisma.event.findMany({
      where: {
        userId,
        startTime: {
          gte: startOfToday,
          lte: endOfToday
        }
      },
      orderBy: { startTime: 'asc' }
    });

    // Fetch relevant todos:
    // 1. Overdue items (dueDate < now and not completed)
    // 2. Items due today (dueDate between startOfToday and endOfToday)
    // 3. Items with no due date (limit to 5 most recent to avoid flooding)
    const todosPromise = prisma.actionableItem.findMany({
      where: {
        userId,
        completed: false,
        OR: [
          { dueDate: { lte: endOfToday } }, // Overdue or due today
          { dueDate: null } // Items with no due date
        ]
      },
      orderBy: [
        { dueDate: 'asc' }, // Overdue first (nulls last), then due today, then no due date
        { createdAt: 'desc' } // For items with same due date, newest first
      ],
      take: 20 // Limit to 20 items to keep dashboard clean
    });

    const [events, todos] = await Promise.all([eventsPromise, todosPromise]);

    res.json({
      events,
      todos
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

