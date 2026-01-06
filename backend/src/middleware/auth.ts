import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';

const client = new OAuth2Client();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify token without enforcing a specific audience to allow both Web/Android client IDs
    const ticket = await client.verifyIdToken({
      idToken: token,
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
       res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
       return;
    }

    // Attach user to request
    (req as AuthRequest).user = {
      id: payload.sub, // Google User ID
      email: payload.email,
    };

    // Optional: Check X-User-Id header matches if sent (sanity check)
    // const headerUserId = req.headers['x-user-id'];
    // if (headerUserId && headerUserId !== payload.sub) {
    //    console.warn("User ID mismatch between Token and Header");
    // }

    next();
  } catch (error) {
    console.error('Auth verification failed:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

