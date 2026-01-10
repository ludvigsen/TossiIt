import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { enforceArchiveRules } from '../services/archive';

const router = Router();

// GET /api/actionable-items - Get all actionable items for the user
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await enforceArchiveRules(userId);

    const { completed, due_date, kind, includeArchived } = req.query;

    const where: any = { userId };
    if (!includeArchived || includeArchived === 'false') {
      where.archivedAt = null;
    }
    if (kind) {
      where.kind = String(kind);
    }
    if (completed !== undefined) {
      where.completed = completed === 'true';
    }
    if (due_date) {
      where.dueDate = { lte: new Date(due_date as string) };
    }

    const items = await prisma.actionableItem.findMany({
      where,
      include: {
        people: true,
        dump: {
          select: {
            id: true,
            contentText: true,
            mediaUrl: true,
          }
        }
      },
      orderBy: [
        { archivedAt: 'asc' },
        { completed: 'asc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(items);
  } catch (error) {
    console.error('Error fetching actionable items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/actionable-items/archive - Get archived items
router.get('/archive', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await enforceArchiveRules(userId);

    const { kind } = req.query;
    const where: any = { userId, archivedAt: { not: null } };
    if (kind) where.kind = String(kind);

    const items = await prisma.actionableItem.findMany({
      where,
      include: { people: true, dump: { select: { id: true, contentText: true, mediaUrl: true } } },
      orderBy: [{ archivedAt: 'desc' }, { createdAt: 'desc' }],
    });

    res.json(items);
  } catch (error) {
    console.error('Error fetching archived items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/actionable-items - Create a new actionable item (todo/info)
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await enforceArchiveRules(userId);

    const { title, description, kind, dueDate, expiresAt, priority, category, peopleIds } = req.body || {};
    if (!title || !String(title).trim()) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const k = kind === 'info' ? 'info' : 'todo';
    const data: any = {
      userId,
      title: String(title).trim(),
      description: description ? String(description) : null,
      kind: k,
      dueDate: k === 'todo' && dueDate ? new Date(dueDate) : null,
      expiresAt: k === 'info' && expiresAt ? new Date(expiresAt) : null,
      priority: priority ? String(priority) : null,
      category: category ? String(category) : null,
    };

    if (Array.isArray(peopleIds)) {
      data.people = { connect: peopleIds.filter((id: any) => typeof id === 'string').map((id: string) => ({ id })) };
    }

    const item = await prisma.actionableItem.create({
      data,
      include: { people: true },
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Error creating actionable item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/actionable-items/:id - Update an actionable item (todo/info)
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { title, description, dueDate, expiresAt, priority, category, peopleIds } = req.body || {};

    const existing = await prisma.actionableItem.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const data: any = {};
    if (title !== undefined) data.title = String(title).trim();
    if (description !== undefined) data.description = description ? String(description) : null;
    if (priority !== undefined) data.priority = priority ? String(priority) : null;
    if (category !== undefined) data.category = category ? String(category) : null;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;

    if (Array.isArray(peopleIds)) {
      data.people = {
        set: peopleIds.filter((pid: any) => typeof pid === 'string').map((pid: string) => ({ id: pid })),
      };
    }

    const item = await prisma.actionableItem.update({
      where: { id },
      data,
      include: { people: true },
    });

    res.json(item);
  } catch (error) {
    console.error('Error updating actionable item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/actionable-items/:id/archive - Manually archive an item
router.patch('/:id/archive', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;

    const existing = await prisma.actionableItem.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const item = await prisma.actionableItem.update({
      where: { id },
      data: { archivedAt: new Date(), archivedReason: 'user_archived' },
      include: { people: true },
    });
    res.json(item);
  } catch (error) {
    console.error('Error archiving item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/actionable-items/:id/unarchive - Unarchive an item
router.patch('/:id/unarchive', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;

    const existing = await prisma.actionableItem.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const item = await prisma.actionableItem.update({
      where: { id },
      data: { archivedAt: null, archivedReason: null },
      include: { people: true },
    });
    res.json(item);
  } catch (error) {
    console.error('Error unarchiving item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/actionable-items/:id/complete - Mark item as completed
router.patch('/:id/complete', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { completed } = req.body;

    const item = await prisma.actionableItem.update({
      where: { id },
      data: {
        completed: completed !== undefined ? completed : true,
        completedAt: completed !== false ? new Date() : null,
        archivedAt: completed !== false ? new Date() : null,
        archivedReason: completed !== false ? 'user_completed' : null,
      },
      include: { people: true },
    });

    res.json(item);
  } catch (error) {
    console.error('Error updating actionable item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

