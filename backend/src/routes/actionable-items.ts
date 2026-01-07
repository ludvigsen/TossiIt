import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/actionable-items - Get all actionable items for the user
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { completed, due_date } = req.query;

    const where: any = { userId };
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
        completedAt: completed !== false ? new Date() : null
      }
    });

    res.json(item);
  } catch (error) {
    console.error('Error updating actionable item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

