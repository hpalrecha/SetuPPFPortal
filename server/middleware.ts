import { Request, Response, NextFunction } from 'express';
import { authService, type AuthUser } from './auth';

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

export const requireOEMAccess = (req: Request, res: Response, next: NextFunction) => {
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
