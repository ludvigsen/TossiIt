import { Router, Request, Response } from 'express';
import { generateDailySummary } from '../services/summary';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const tzOffsetMinutes = req.query.tzOffsetMinutes ? Number(req.query.tzOffsetMinutes) : undefined;
    const summary = await generateDailySummary(userId, tzOffsetMinutes);
    res.json({ summary });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

