import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

declare global {
  namespace Express {
    interface Request {
      tenant?: {
        oemId?: string;
        dealershipId?: string;
        showroomId?: string;
        partnerId?: string;
      };
    }
  }
}

export const tenancyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required for tenant context' });
  }

  // Initialize tenant context based on user role and hierarchy
  req.tenant = {};

  switch (user.role) {
    case 'SUPER_ADMIN':
      // Super admin can access all tenants - no restrictions
      break;
      
    case 'OEM_ADMIN':
      req.tenant.oemId = user.oemId;
      break;
      
    case 'DEALERSHIP_ADMIN':
      req.tenant.oemId = user.oemId;
      req.tenant.dealershipId = user.dealershipId;
      break;
      
    case 'SHOWROOM_MANAGER':
    case 'SALES_PERSON':
      req.tenant.oemId = user.oemId;
      req.tenant.dealershipId = user.dealershipId;
      req.tenant.showroomId = user.showroomId;
      break;
      
    case 'PARTNER_ADMIN':
    case 'PARTNER_STAFF':
      req.tenant.partnerId = user.partnerId;
      break;
      
    default:
      return res.status(403).json({ error: 'Invalid user role for tenant access' });
  }

  next();
};

export const enforceTenantIsolation = (entityType: 'work_order' | 'job_card' | 'partner' | 'pricing_rule') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const tenant = req.tenant;
    
    if (!user || !tenant) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    // Super admin bypasses all tenant isolation
    if (user.role === 'SUPER_ADMIN') {
      return next();
    }

    try {
      const entityId = req.params.id;
      let hasAccess = false;

      switch (entityType) {
        case 'work_order':
          if (entityId) {
            const workOrder = await storage.getWorkOrder(entityId);
            if (workOrder) {
              hasAccess = await validateWorkOrderAccess(user, tenant, workOrder);
            }
          } else {
            // For list operations, tenant filtering is applied in query
            hasAccess = true;
          }
          break;

        case 'job_card':
          if (entityId) {
            const jobCard = await storage.getJobCard(entityId);
            if (jobCard) {
              hasAccess = await validateJobCardAccess(user, tenant, jobCard);
            }
          } else {
            hasAccess = true;
          }
          break;

        case 'partner':
          if (entityId) {
            const partner = await storage.getPartner(entityId);
            if (partner) {
              hasAccess = validatePartnerAccess(user, tenant, partner);
            }
          } else {
            hasAccess = true;
          }
          break;

        case 'pricing_rule':
          if (entityId) {
            const pricingRule = await storage.getPricingRule(entityId);
            if (pricingRule) {
              hasAccess = await validatePricingRuleAccess(user, tenant, pricingRule);
            }
          } else {
            hasAccess = true;
          }
          break;

        default:
          hasAccess = false;
      }

      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Access denied to this resource',
          entityType,
          entityId
        });
      }

      next();
    } catch (error) {
      console.error('Tenant isolation error:', error);
      return res.status(500).json({ error: 'Internal server error during tenant validation' });
    }
  };
};

async function validateWorkOrderAccess(user: any, tenant: any, workOrder: any): Promise<boolean> {
  switch (user.role) {
    case 'OEM_ADMIN':
      return workOrder.oemId === tenant.oemId;
      
    case 'DEALERSHIP_ADMIN':
      return workOrder.oemId === tenant.oemId && workOrder.dealershipId === tenant.dealershipId;
      
    case 'SHOWROOM_MANAGER':
    case 'SALES_PERSON':
      return workOrder.oemId === tenant.oemId && 
             workOrder.dealershipId === tenant.dealershipId && 
             workOrder.showroomId === tenant.showroomId;
             
    case 'PARTNER_ADMIN':
    case 'PARTNER_STAFF':
      return workOrder.assignedPartnerId === tenant.partnerId;
      
    default:
      return false;
  }
}

async function validateJobCardAccess(user: any, tenant: any, jobCard: any): Promise<boolean> {
  switch (user.role) {
    case 'PARTNER_ADMIN':
    case 'PARTNER_STAFF':
      return jobCard.partnerId === tenant.partnerId;
      
    default:
      // For other roles, validate via work order access
      const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
      if (!workOrder) return false;
      return validateWorkOrderAccess(user, tenant, workOrder);
  }
}

function validatePartnerAccess(user: any, tenant: any, partner: any): boolean {
  switch (user.role) {
    case 'OEM_ADMIN':
    case 'DEALERSHIP_ADMIN':
    case 'SHOWROOM_MANAGER':
      // These roles can access partners that are allocated to their scope
      return true; // Additional allocation-based validation would go here
      
    case 'PARTNER_ADMIN':
    case 'PARTNER_STAFF':
      return partner.id === tenant.partnerId;
      
    default:
      return false;
  }
}

async function validatePricingRuleAccess(user: any, tenant: any, pricingRule: any): Promise<boolean> {
  switch (user.role) {
    case 'OEM_ADMIN':
      // Can access all pricing rules within their OEM
      if (pricingRule.scope === 'DEALERSHIP') {
        const dealership = await storage.getDealership(pricingRule.scopeId);
        return dealership?.oemId === tenant.oemId;
      } else if (pricingRule.scope === 'SHOWROOM') {
        const showroom = await storage.getShowroom(pricingRule.scopeId);
        if (!showroom) return false;
        const dealership = await storage.getDealership(showroom.dealershipId);
        return dealership?.oemId === tenant.oemId;
      }
      return false;
      
    case 'DEALERSHIP_ADMIN':
      if (pricingRule.scope === 'DEALERSHIP') {
        return pricingRule.scopeId === tenant.dealershipId;
      } else if (pricingRule.scope === 'SHOWROOM') {
        const showroom = await storage.getShowroom(pricingRule.scopeId);
        return showroom?.dealershipId === tenant.dealershipId;
      }
      return false;
      
    case 'SHOWROOM_MANAGER':
      return pricingRule.scope === 'SHOWROOM' && pricingRule.scopeId === tenant.showroomId;
      
    default:
      return false;
  }
}

export const applyTenantFilters = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  const tenant = req.tenant;

  if (!user || !tenant) {
    return next();
  }

  // Apply tenant filters to query parameters based on user role
  switch (user.role) {
    case 'SUPER_ADMIN':
      // No filters applied
      break;
      
    case 'OEM_ADMIN':
      req.query.oemId = tenant.oemId;
      break;
      
    case 'DEALERSHIP_ADMIN':
      req.query.oemId = tenant.oemId;
      req.query.dealershipId = tenant.dealershipId;
      break;
      
    case 'SHOWROOM_MANAGER':
    case 'SALES_PERSON':
      req.query.oemId = tenant.oemId;
      req.query.dealershipId = tenant.dealershipId;
      req.query.showroomId = tenant.showroomId;
      break;
      
    case 'PARTNER_ADMIN':
    case 'PARTNER_STAFF':
      req.query.partnerId = tenant.partnerId;
      break;
  }

  next();
};

export const validateTenantPermissions = (
  requiredLevel: 'OEM' | 'DEALERSHIP' | 'SHOWROOM' | 'PARTNER'
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (user.role === 'SUPER_ADMIN') {
      return next();
    }

    const hasPermission = checkTenantPermission(user.role, requiredLevel);
    
    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Insufficient tenant permissions',
        required: requiredLevel,
        userRole: user.role
      });
    }

    next();
  };
};

function checkTenantPermission(userRole: string, requiredLevel: string): boolean {
  const roleHierarchy = {
    'OEM_ADMIN': ['OEM'],
    'DEALERSHIP_ADMIN': ['OEM', 'DEALERSHIP'],
    'SHOWROOM_MANAGER': ['OEM', 'DEALERSHIP', 'SHOWROOM'],
    'SALES_PERSON': ['OEM', 'DEALERSHIP', 'SHOWROOM'],
    'PARTNER_ADMIN': ['PARTNER'],
    'PARTNER_STAFF': ['PARTNER']
  };

  return roleHierarchy[userRole as keyof typeof roleHierarchy]?.includes(requiredLevel) || false;
}

// Middleware to log tenant access for audit purposes
export const auditTenantAccess = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  const tenant = req.tenant;
  
  if (user && tenant) {
    console.log(`Tenant access: User ${user.id} (${user.role}) accessing ${req.method} ${req.path}`, {
      tenantContext: tenant,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }
  
  next();
};

// Helper function to get tenant context for database queries
export function getTenantFilters(user: any): Record<string, any> {
  const filters: Record<string, any> = {};

  switch (user?.role) {
    case 'SUPER_ADMIN':
      // No filters - can access all data
      break;
      
    case 'OEM_ADMIN':
      filters.oemId = user.oemId;
      break;
      
    case 'DEALERSHIP_ADMIN':
      filters.oemId = user.oemId;
      filters.dealershipId = user.dealershipId;
      break;
      
    case 'SHOWROOM_MANAGER':
    case 'SALES_PERSON':
      filters.oemId = user.oemId;
      filters.dealershipId = user.dealershipId;
      filters.showroomId = user.showroomId;
      break;
      
    case 'PARTNER_ADMIN':
    case 'PARTNER_STAFF':
      filters.partnerId = user.partnerId;
      break;
  }

  return filters;
}
