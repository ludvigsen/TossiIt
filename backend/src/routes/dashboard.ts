import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getDayRangeFromTzOffsetMinutes } from '../utils/time';
import { enforceArchiveRules } from '../services/archive';

const router = Router();

// GET /api/dashboard/today
// Returns events and todos for the current day
// Accepts optional ?tzOffsetMinutes=... (JS Date.getTimezoneOffset()) to compute "today" in client timezone.
router.get('/today', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await enforceArchiveRules(userId);

    const now = new Date();
    const tzOffsetMinutes = req.query.tzOffsetMinutes ? Number(req.query.tzOffsetMinutes) : undefined;
    const { startUtc: startOfToday, endUtc: endOfToday, localDateISO } = getDayRangeFromTzOffsetMinutes(now, tzOffsetMinutes);

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
      include: {
        people: { select: { id: true, name: true, relationship: true, category: true } },
        originDump: {
          select: { id: true, category: true }
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
        archivedAt: null,
        completed: false,
        OR: [
          { dueDate: { lte: endOfToday } }, // Overdue or due today
          { dueDate: null } // Items with no due date
        ]
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        completed: true,
        priority: true,
        category: true,
        createdAt: true,
        people: { select: { id: true, name: true, relationship: true, category: true } },
      },
      orderBy: [
        { dueDate: 'asc' }, // Overdue first (nulls last), then due today, then no due date
        { createdAt: 'desc' } // For items with same due date, newest first
      ],
      take: 20 // Limit to 20 items to keep dashboard clean
    });

    // Fetch upcoming events (next 7 days)
    const endOfWeek = new Date(endOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingEventsPromise = prisma.event.findMany({
      where: {
        userId,
        startTime: {
          gt: endOfToday,
          lte: endOfWeek
        }
      },
      include: {
        people: { select: { id: true, name: true, relationship: true, category: true } },
        originDump: {
          select: { id: true, category: true }
        }
      },
      orderBy: { startTime: 'asc' },
      take: 5 // Limit to 5 upcoming events
    });

    // Fetch upcoming todos (next 7 days)
    const upcomingTodosPromise = prisma.actionableItem.findMany({
      where: {
        userId,
        archivedAt: null,
        completed: false,
        dueDate: {
          gt: endOfToday,
          lte: endOfWeek
        }
      },
      include: {
        people: { select: { id: true, name: true, relationship: true, category: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 5 // Limit to 5 upcoming todos
    });

    const [events, todos, upcomingEvents, upcomingTodos] = await Promise.all([
      eventsPromise, 
      todosPromise, 
      upcomingEventsPromise, 
      upcomingTodosPromise
    ]);

    res.json({
      date: localDateISO,
      events,
      todos,
      upcomingEvents,
      upcomingTodos
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

