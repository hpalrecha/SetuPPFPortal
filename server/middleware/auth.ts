import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../auth';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: any;
      oemId?: string;
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Let the route decide if auth is required
    }

    const token = authHeader.substring(7);
    const payload = AuthService.verifyToken(token);
    
    req.userId = payload.userId;
    req.user = payload;
    req.oemId = payload.oemId;
    
    next();
  } catch (error) {
    return next(); // Let the route decide if auth is required
  }
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

export const requireOemAccess = (req: Request, res: Response, next: NextFunction) => {
  const oemId = req.headers['x-oem-id'] as string;
  
  if (!oemId) {
    return res.status(400).json({ error: 'OEM ID header required' });
  }

  if (req.user?.role !== 'SUPER_ADMIN' && req.user?.oemId !== oemId) {
    return res.status(403).json({ error: 'Access denied for this OEM' });
  }

  req.oemId = oemId;
  next();
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  // Auth is optional - just continue
  next();
};
