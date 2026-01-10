import { Router, Request, Response } from 'express';
import multer from 'multer';
import { storageService } from '../services/storage';
import { prisma } from '../db';

import { processRawDump } from '../services/processor';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
}); // Store in memory for processing/upload

// Middleware to conditionally use multer only for multipart/form-data
const conditionalMulter = (req: Request, res: Response, next: any) => {
  const contentType = req.headers['content-type'] || '';
  console.log('Request Content-Type:', contentType);
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  
  if (contentType.includes('multipart/form-data')) {
    console.log('Using multer for multipart/form-data');
    // Use multer for file uploads
    upload.single('file')(req, res, (err: any) => {
      if (err) {
        console.error('Multer error:', err);
        console.error('Multer error code:', err.code);
        console.error('Multer error message:', err.message);
        return res.status(400).json({ 
          error: 'File upload error', 
          details: err.message 
        });
      }
      next();
    });
  } else {
    console.log('Skipping multer for non-multipart request');
    // Skip multer for JSON requests
    next();
  }
};

router.post('/', authenticate, conditionalMulter, async (req: Request, res: Response, next: any): Promise<void> => {
  try {
    const { source_type, content_text, file_base64, file_name, file_mime } = req.body;
    const user_id = (req as AuthRequest).user?.id; // Get from token
    const user_email = (req as AuthRequest).user?.email; // Get from token
    const file = req.file;
    
    console.log('Dump request received:', {
      hasFile: !!file,
      hasBase64: !!file_base64,
      fileSize: file?.size || (file_base64 ? Math.ceil((file_base64.length * 3) / 4) : 0),
      sourceType: source_type,
      hasContentText: !!content_text,
      contentTextLength: content_text?.length,
      userId: user_id
    });

    // Validate inputs
    if (!user_id) {
       res.status(401).json({ error: 'User ID missing from token' });
       return;
    }
    if (!source_type) {
       res.status(400).json({ error: 'source_type is required' });
       return;
    }
    if (!file && !content_text && !file_base64) {
       res.status(400).json({ error: 'Either file, file_base64, or content_text is required' });
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
    } else if (file_base64) {
      // Handle base64 upload
      try {
        // Enforce a hard limit similar to multer (10MB raw file size)
        // Note: base64 length isn't exact bytes; decode and check buffer length.
        const buffer = Buffer.from(file_base64, 'base64');
        if (buffer.length > 10 * 1024 * 1024) {
          res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
          return;
        }
        const simulatedFile: Express.Multer.File = {
          fieldname: 'file',
          originalname: (typeof file_name === 'string' && file_name.trim()) ? file_name.trim() : 'upload.bin',
          encoding: '7bit',
          mimetype: (typeof file_mime === 'string' && file_mime.trim()) ? file_mime.trim() : 'application/octet-stream',
          buffer: buffer,
          size: buffer.length,
          stream: null as any,
          destination: '',
          filename: '',
          path: '',
        };
        media_url = await storageService.uploadFile(simulatedFile);
      } catch (e) {
        console.error('Error processing base64 file:', e);
        res.status(400).json({ error: 'Invalid base64 file data' });
        return;
      }
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
  } catch (error: any) {
    console.error('Error processing dump:', error);
    console.error('Error stack:', error?.stack);
    console.error('Error message:', error?.message);
    
    // Provide more specific error messages
    if (error?.message?.includes('Unexpected end of form') || error?.message?.includes('busboy')) {
      res.status(400).json({ 
        error: 'Invalid form data. The request may be incomplete or corrupted. Please ensure you are using the latest app version.',
        details: error.message 
      });
      return;
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Error handler middleware for multer errors (must be after the route)
router.use((err: any, req: Request, res: Response, next: any) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: 'File upload error', details: err.message });
  }
  if (err && (err.message?.includes('Unexpected end of form') || err.message?.includes('busboy'))) {
    console.error('Busboy/Multer parsing error:', err);
    return res.status(400).json({ 
      error: 'Invalid form data. The request may be incomplete or corrupted.',
      details: err.message 
    });
  }
  next(err);
});

export default router;

