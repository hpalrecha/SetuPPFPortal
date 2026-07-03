import type { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

export const rbacMiddleware = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await storage.getUser(req.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: allowedRoles,
          current: user.role
        });
      }

      // Add user to request for further use
      req.user = user;
      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

export const tenantMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Ensure tenant isolation based on user role
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ error: 'User context required' });
  }

  // Super admin can access all tenants
  if (user.role === 'SUPER_ADMIN') {
    return next();
  }

  // Set tenant context based on user role
  if (user.oemId) {
    req.oemId = user.oemId;
  }

  next();
};

export const resourceOwnershipMiddleware = (resourceType: 'work_order' | 'job_card' | 'partner' | 'pricing_rule') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resourceId = req.params.id;
      const user = req.user;

      if (!resourceId || !user) {
        return res.status(400).json({ error: 'Invalid request' });
      }

      let hasAccess = false;

      switch (resourceType) {
        case 'work_order':
          const workOrder = await storage.getWorkOrder(resourceId);
          if (workOrder) {
            hasAccess = canUserAccessWorkOrder(user, workOrder);
          }
          break;

        case 'job_card':
          const jobCard = await storage.getJobCard(resourceId);
          if (jobCard) {
            hasAccess = canUserAccessJobCard(user, jobCard);
          }
          break;

        case 'partner':
          const partner = await storage.getPartner(resourceId);
          if (partner) {
            hasAccess = canUserAccessPartner(user, partner);
          }
          break;

        default:
          hasAccess = true; // Default allow for now
      }

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this resource' });
      }

      next();
    } catch (error) {
      console.error('Resource ownership middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

function canUserAccessWorkOrder(user: any, workOrder: any): boolean {
  switch (user.role) {
    case 'SUPER_ADMIN':
      return true;
    case 'OEM_ADMIN':
      return user.oemId === workOrder.oemId;
    case 'DEALERSHIP_ADMIN':
      return user.dealershipId === workOrder.dealershipId;
    case 'SHOWROOM_MANAGER':
    case 'SALES_PERSON':
      return user.showroomId === workOrder.showroomId;
    case 'PARTNER_ADMIN':
    case 'PARTNER_STAFF':
      return user.partnerId === workOrder.assignedPartnerId;
    case 'DETAILING_PARTNER':
      // Showroom-level check is done at the route layer via getDetailingPartnerShowroomIds
      return user.partnerId === workOrder.assignedPartnerId;
    default:
      return false;
  }
}

function canUserAccessJobCard(user: any, jobCard: any): boolean {
  switch (user.role) {
    case 'SUPER_ADMIN':
      return true;
    case 'PARTNER_ADMIN':
    case 'PARTNER_STAFF':
      return user.partnerId === jobCard.partnerId;
    case 'DETAILING_PARTNER':
      // Showroom-level check is done at the route layer
      return user.partnerId === jobCard.partnerId;
    default:
      return true; // Will be validated at work order level
  }
}

function canUserAccessPartner(user: any, partner: any): boolean {
  switch (user.role) {
    case 'SUPER_ADMIN':
    case 'OEM_ADMIN':
    case 'DEALERSHIP_ADMIN':
    case 'SHOWROOM_MANAGER':
      return true;
    case 'PARTNER_ADMIN':
    case 'PARTNER_STAFF':
    case 'DETAILING_PARTNER':
      return user.partnerId === partner.id;
    default:
      return false;
  }
}
