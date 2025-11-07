import { Request, Response, NextFunction } from 'express';
import * as db from '../database';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: db.User;
    }
  }
}

// Wrapper to handle async middleware
function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

async function requireAuthHandler(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '') || 
                req.query.token as string;
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = await db.getUserByToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.user = user;
  next();
}

export const requireAuth = asyncHandler(requireAuthHandler);

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '') || 
                req.query.token as string;
  
  if (token) {
    const user = await db.getUserByToken(token);
    if (user) {
      req.user = user;
    }
  }
  
  next();
}

