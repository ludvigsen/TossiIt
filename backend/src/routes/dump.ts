import { Router, Request, Response } from 'express';
import multer from 'multer';
import { storageService } from '../services/storage';
import { prisma } from '../db';

import { processRawDump } from '../services/processor';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() }); // Store in memory for processing/upload

router.post('/', authenticate, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { source_type, content_text } = req.body;
    const user_id = (req as AuthRequest).user?.id; // Get from token
    const user_email = (req as AuthRequest).user?.email; // Get from token
    const file = req.file;

    // Validate inputs
    if (!user_id) {
       res.status(401).json({ error: 'User ID missing from token' });
       return;
    }
    if (!source_type) {
       res.status(400).json({ error: 'source_type is required' });
       return;
    }
    if (!file && !content_text) {
       res.status(400).json({ error: 'Either file or content_text is required' });
       return;
    }

    // Ensure user exists in database (auto-create if needed)
    const existingUser = await prisma.user.findUnique({
      where: { id: user_id }
    });

    if (!existingUser) {
      // User doesn't exist, create them
      if (!user_email) {
        res.status(400).json({ error: 'User email missing from token' });
        return;
      }
      
      // Check if user exists with this email but different ID (migration case)
      const userByEmail = await prisma.user.findUnique({
        where: { email: user_email }
      });
      
      if (userByEmail) {
        // Delete old user and create new one with Google User ID
        console.log(`Migrating user ${user_email} from ${userByEmail.id} to ${user_id}`);
        await prisma.user.delete({
          where: { email: user_email }
        });
      }
      
      // Create new user
      await prisma.user.create({
        data: {
          id: user_id,
          email: user_email,
          googleRefreshToken: null // Will be set when /auth/sync-token is called
        }
      });
    }

    let media_url = null;
    if (file) {
      media_url = await storageService.uploadFile(file);
    }

    // Insert into DB
    const newDump = await prisma.rawDump.create({
      data: {
        userId: user_id,
        sourceType: source_type,
        contentText: content_text || null,
        mediaUrl: media_url
      }
    });

    // Trigger async processing
    processRawDump(newDump.id);

    res.status(201).json(newDump);
  } catch (error) {
    console.error('Error processing dump:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

