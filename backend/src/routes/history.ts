import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { config } from '../config';

const router = Router();

// GET /api/history - Fetch all dumps with their outcomes
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Fetch all raw dumps for the user
    const dumps = await prisma.rawDump.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        smartInbox: {
          select: {
            id: true,
            status: true,
            proposedData: true,
            aiConfidenceScore: true,
            flagReason: true,
            createdAt: true,
          }
        },
        events: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            category: true,
            location: true,
          }
        }
      }
    });

    // Format the response to show outcomes clearly
    const history = dumps.map(dump => {
      let outcome = null;
      let outcomeType = null;

      // Check if it became an event
      if (dump.events && dump.events.length > 0) {
        outcome = dump.events[0];
        outcomeType = 'event';
      }
      // Check if it's in the inbox
      else if (dump.smartInbox) {
        outcome = {
          status: dump.smartInbox.status,
          proposedData: dump.smartInbox.proposedData,
          confidenceScore: dump.smartInbox.aiConfidenceScore,
          flagReason: dump.smartInbox.flagReason,
        };
        outcomeType = 'inbox';
      }
      // Check if it's still processing
      else if (!dump.processedAt) {
        outcomeType = 'processing';
      }
      // Otherwise it was processed but didn't result in anything
      else {
        outcomeType = 'processed';
      }

      // Convert local file URLs to absolute URLs for mobile app
      let mediaUrl = dump.mediaUrl;
      if (mediaUrl && !mediaUrl.startsWith('http')) {
        // If it's a local file path (starts with /uploads/), convert to absolute URL
        if (mediaUrl.startsWith('/uploads/')) {
          const baseUrl = process.env.RUN_LOCAL === 'true' 
            ? `http://localhost:${config.port}` 
            : process.env.API_BASE_URL || `http://localhost:${config.port}`;
          mediaUrl = `${baseUrl}${mediaUrl}`;
        }
      }

      return {
        id: dump.id,
        contentText: dump.contentText,
        mediaUrl,
        sourceType: dump.sourceType,
        createdAt: dump.createdAt,
        processedAt: dump.processedAt,
        outcome,
        outcomeType,
      };
    });

    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

