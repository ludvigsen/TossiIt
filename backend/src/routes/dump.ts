import { Router, Request, Response } from 'express';
import multer from 'multer';
import { storageService } from '../services/storage';
import { query } from '../db';

import { processRawDump } from '../services/processor';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() }); // Store in memory for processing/upload

router.post('/', authenticate, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { source_type, content_text } = req.body;
    const user_id = (req as AuthRequest).user?.id; // Get from token
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

    let media_url = null;
    if (file) {
      media_url = await storageService.uploadFile(file);
    }

    // Insert into DB
    const insertQuery = `
      INSERT INTO raw_dumps (user_id, source_type, content_text, media_url)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [user_id, source_type, content_text, media_url];
    
    const result = await query(insertQuery, values);
    const newDump = result.rows[0];

    // Trigger async processing
    processRawDump(newDump.id);

    res.status(201).json(newDump);
  } catch (error) {
    console.error('Error processing dump:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

