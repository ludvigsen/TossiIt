import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/people - Get all people for the user
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const people = await prisma.person.findMany({
      where: { userId },
      orderBy: { name: 'asc' }
    });

    res.json(people);
  } catch (error) {
    console.error('Error fetching people:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/people - Create a new person
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id, name, relationship, category, notes, metadata, isImportant, pinnedOrder } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    // If id is provided, update that record (prevents duplicate when renaming)
    if (id) {
      const existing = await prisma.person.findFirst({
        where: { id, userId }
      });
      if (!existing) {
        res.status(404).json({ error: 'Person not found' });
        return;
      }

      try {
        const updated = await prisma.person.update({
          where: { id },
          data: {
            name,
            relationship: relationship ?? undefined,
            category: category ?? undefined,
            notes: notes ?? undefined,
            metadata: metadata ?? undefined,
            isImportant: typeof isImportant === 'boolean' ? isImportant : undefined,
            pinnedOrder: typeof pinnedOrder === 'number' ? pinnedOrder : undefined,
          }
        });
        res.json(updated);
        return;
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          res.status(409).json({ error: 'Another person with this name already exists' });
          return;
        }
        throw err;
      }
    }

    // Otherwise, upsert by name (keeps current behavior)
    const person = await prisma.person.upsert({
      where: {
        userId_name: {
          userId,
          name
        }
      },
      update: {
        relationship: relationship || undefined,
        category: category || undefined,
        notes: notes || undefined,
        metadata: metadata || undefined,
        isImportant: typeof isImportant === 'boolean' ? isImportant : undefined,
        pinnedOrder: typeof pinnedOrder === 'number' ? pinnedOrder : undefined,
      },
      create: {
        userId,
        name,
        relationship: relationship || null,
        category: category || null,
        notes: notes || null,
        metadata: metadata || null,
        isImportant: typeof isImportant === 'boolean' ? isImportant : false,
        pinnedOrder: typeof pinnedOrder === 'number' ? pinnedOrder : null,
      }
    });

    res.json(person);
  } catch (error) {
    console.error('Error creating person:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/people/:id - Delete a person (owned by user)
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const person = await prisma.person.findUnique({
      where: { id }
    });

    if (!person || person.userId !== userId) {
      res.status(404).json({ error: 'Person not found' });
      return;
    }

    await prisma.person.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting person:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

