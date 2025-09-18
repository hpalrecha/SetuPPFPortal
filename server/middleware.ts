import { Request, Response, NextFunction } from 'express';
import { authService, type AuthUser } from './auth';
import { storage } from './storage.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const user = await authService.verifyToken(token);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

export const requireOEMAccess = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Super admin can access any OEM
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  // Check tenant isolation
  const oemId = req.headers['x-oem-id'] || req.params.oemId || req.body.oemId;
  
  if (!oemId) {
    return res.status(400).json({ error: 'OEM ID required' });
  }

  // For partner users, check if they have access to this OEM through partner-OEM mappings
  if (req.user.role === 'PARTNER_ADMIN' || req.user.role === 'PARTNER_STAFF') {
    if (!req.user.partnerId) {
      return res.status(400).json({ error: 'Partner user must have partnerId' });
    }
    
    try {
      const hasOemAccess = await storage.checkPartnerOemAccess(req.user.partnerId, oemId);
      if (!hasOemAccess) {
        return res.status(403).json({ error: 'Access denied to this OEM' });
      }
      return next();
    } catch (error) {
      console.error('Error checking partner OEM access:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // For other roles, check direct OEM membership
  if (req.user.oemId !== oemId) {
    return res.status(403).json({ error: 'Access denied to this OEM' });
  }

  next();
};

export const auditLog = (entity: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(body) {
      // Log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entityId = req.params.id || (typeof body === 'string' ? JSON.parse(body)?.id : body?.id);
        
        if (entityId && req.user) {
          // Async log without blocking response
          setImmediate(async () => {
            try {
              await storage.createAuditLog({
                actorUserId: req.user!.id,
                entity,
                entityId,
                action,
                diffJson: {
                  method: req.method,
                  path: req.path,
                  body: req.body,
                  timestamp: new Date().toISOString()
                }
              });
            } catch (error) {
              console.error('Audit log failed:', error);
            }
          });
        }
      }
      
      return originalSend.call(this, body);
    };
    
    next();
  };
};
