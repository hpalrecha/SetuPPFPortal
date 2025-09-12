import type { Request, Response, NextFunction } from 'express';
import { authService } from '../auth';

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
    const payload = await authService.verifyToken(token);
    
    if (!payload) {
      return next(); // Let route decide if auth is required
    }
    
    req.userId = payload.id;
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

export const requireOemAccess = async (req: Request, res: Response, next: NextFunction) => {
  const oemId = req.headers['x-oem-id'] as string;
  
  if (!oemId) {
    return res.status(400).json({ error: 'OEM ID required' });
  }

  // Super admin can access any OEM
  if (req.user?.role === 'SUPER_ADMIN') {
    req.oemId = oemId;
    return next();
  }

  // For partner roles (PARTNER_ADMIN, PARTNER_STAFF), check allowedOemIds from database
  if (req.user?.role === 'PARTNER_ADMIN' || req.user?.role === 'PARTNER_STAFF') {
    try {
      // Get the database connection - we'll need to import storage here
      const { storage } = await import('../storage');
      
      if (!req.user.partnerId) {
        return res.status(403).json({ error: 'Partner ID not found in user context' });
      }

      // Check if this partner has access to the requested OEM
      const hasAccess = await storage.checkPartnerOemAccess(req.user.partnerId, oemId);
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied for this OEM' });
      }

      req.oemId = oemId;
      return next();
    } catch (error) {
      console.error('Error checking partner OEM access:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // For other roles (OEM_ADMIN, DEALERSHIP_ADMIN, etc.), check user.oemId
  if (req.user?.oemId !== oemId) {
    return res.status(403).json({ error: 'Access denied for this OEM' });
  }

  req.oemId = oemId;
  next();
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  // Auth is optional - just continue
  next();
};
