import { Router, Request, Response } from 'express';
import { generateDailySummary } from '../services/summary';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const summary = await generateDailySummary(userId);
    res.json({ summary });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

