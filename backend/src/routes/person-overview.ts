import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { enforceArchiveRules } from '../services/archive';

const router = Router();

// GET /api/person-overview/:personId
// Returns explicitly linked context for a person: todos, infos, events, inbox items, recent dumps.
router.get('/:personId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { personId } = req.params;
    const windowDays = req.query.windowDays ? Number(req.query.windowDays) : 7;
    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

    await enforceArchiveRules(userId);

    const [person, todos, infos, events, inbox, dumps] = await Promise.all([
      prisma.person.findFirst({ where: { id: personId, userId } }),
      prisma.actionableItem.findMany({
        where: { userId, kind: 'todo', archivedAt: null, completed: false, people: { some: { id: personId } } },
        include: { people: true },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.actionableItem.findMany({
        where: { userId, kind: 'info', archivedAt: null, people: { some: { id: personId } } },
        include: { people: true },
        orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.event.findMany({
        where: {
          userId,
          startTime: { gte: now, lte: windowEnd },
          people: { some: { id: personId } },
        },
        include: { people: true },
        orderBy: { startTime: 'asc' },
      }),
      prisma.smartInbox.findMany({
        where: { userId, status: { notIn: ['approved', 'rejected', 'dismissed'] }, people: { some: { id: personId } } },
        include: { people: true, dump: { select: { id: true, contentText: true, mediaUrl: true, sourceType: true, createdAt: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.rawDump.findMany({
        where: { userId, people: { some: { id: personId } } },
        select: { id: true, contentText: true, mediaUrl: true, sourceType: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    if (!person) {
      res.status(404).json({ error: 'Person not found' });
      return;
    }

    res.json({ person, todos, infos, events, inbox, dumps });
  } catch (error) {
    console.error('Error fetching person overview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


