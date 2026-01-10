import express, { Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// GET /api/documents - List all documents for the user
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user_id = (req as any).user_id;
    
    const documents = await prisma.rawDump.findMany({
      where: { userId: user_id },
      include: {
        people: { select: { id: true, name: true, relationship: true } },
        events: { select: { id: true, title: true, startTime: true } },
        actionItems: { 
          select: { id: true, title: true, completed: true, dueDate: true },
          where: { archivedAt: null }
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/documents/:id - Get document detail
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user_id = (req as any).user_id;
    const { id } = req.params;

    const document = await prisma.rawDump.findFirst({
      where: { id, userId: user_id },
      include: {
        people: { select: { id: true, name: true, relationship: true, category: true, metadata: true } },
        events: { 
          select: { 
            id: true, 
            title: true, 
            startTime: true, 
            endTime: true, 
            location: true,
            category: true 
          },
          orderBy: { startTime: 'asc' }
        },
        actionItems: { 
          select: { 
            id: true, 
            title: true, 
            description: true,
            completed: true, 
            dueDate: true,
            priority: true,
            category: true,
            people: { select: { id: true, name: true, relationship: true } }
          },
          where: { archivedAt: null },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
        },
      },
    });

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json(document);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/documents/:id - Update document (category, infoContext)
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user_id = (req as any).user_id;
    const { id } = req.params;
    const { category, infoContext } = req.body;

    const updateData: any = {};
    if (category !== undefined) {
      updateData.category = category || null;
    }
    if (infoContext !== undefined) {
      updateData.infoContext = infoContext || null;
    }

    const document = await prisma.rawDump.update({
      where: { id, userId: user_id },
      data: updateData,
    });

    res.json(document);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

