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

  // Super admin, Admin, and Manager can access any OEM
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN' || req.user.role === 'MANAGER') {
    return next();
  }

  // For OEM-based roles (OEM_ADMIN, DEALERSHIP_ADMIN, SHOWROOM_MANAGER, SALES_PERSON), use their assigned oemId
  if (['OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER', 'SALES_PERSON'].includes(req.user.role)) {
    if (!req.user.oemId) {
      return res.status(400).json({ error: 'OEM ID required for this user role' });
    }
    return next();
  }

  // For partner users, check if they have access to this OEM through partner-OEM mappings
  if (req.user.role === 'PARTNER_ADMIN' || req.user.role === 'PARTNER_STAFF') {
    if (!req.user.partnerId) {
      return res.status(400).json({ error: 'Partner user must have partnerId' });
    }
    
    // Check tenant isolation for partner requests
    const oemId = req.headers['x-oem-id'] || req.params.oemId || req.body.oemId;
    
    if (!oemId) {
      return res.status(400).json({ error: 'OEM ID required' });
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

  // Fallback for any other roles - should not normally reach here
  return res.status(403).json({ error: 'Access denied' });
};

// Helper function to check if Manager has access to a specific state
export const hasStateAccess = (user: AuthUser, state: string | null | undefined): boolean => {
  if (!state) return false;
  
  // SUPER_ADMIN and ADMIN have access to all states
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
    return true;
  }
  
  // MANAGER must check allowedStates
  if (user.role === 'MANAGER') {
    const allowedStates = user.allowedStates as string[] | undefined;
    return allowedStates ? allowedStates.includes(state) : false;
  }
  
  // Other roles have access to their specific state via their entities
  return true;
};

// Middleware to check if Manager can access a specific dealership
export const checkDealershipAccess = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // SUPER_ADMIN and ADMIN have full access
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
    return next();
  }

  // MANAGER must check state access
  if (req.user.role === 'MANAGER') {
    const dealershipId = req.params.id || req.body.dealershipId;
    if (!dealershipId) {
      return res.status(400).json({ error: 'Dealership ID required' });
    }

    try {
      const dealership = await storage.getDealership(dealershipId);
      if (!dealership) {
        return res.status(404).json({ error: 'Dealership not found' });
      }

      if (!hasStateAccess(req.user, dealership.state)) {
        return res.status(403).json({ error: 'Access denied: State not in your allowed states' });
      }

      return next();
    } catch (error) {
      console.error('Error checking dealership access:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  next();
};

// Middleware to block ADMIN from delete operations
export const blockAdminDelete = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role === 'ADMIN') {
    return res.status(403).json({ error: 'Admin users cannot perform delete operations' });
  }

  next();
};

export const auditLog = (entity: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(body) {
      // Log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        let entityId = req.params.id;
        
        // Safely parse body if it's a string
        if (!entityId && typeof body === 'string') {
          try {
            const parsedBody = JSON.parse(body);
            entityId = parsedBody?.id;
          } catch (error) {
            // If JSON parsing fails, skip audit logging for this response
            console.warn('Audit log: Failed to parse response body as JSON:', error);
          }
        } else if (!entityId && body) {
          entityId = body?.id;
        }
        
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
