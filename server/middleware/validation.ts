import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }
      
      return res.status(400).json({
        error: 'Invalid request data'
      });
    }
  };
};

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }
      
      return res.status(400).json({
        error: 'Invalid query parameters'
      });
    }
  };
};

export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid route parameters',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }
      
      return res.status(400).json({
        error: 'Invalid route parameters'
      });
    }
  };
};

// Common validation schemas
export const uuidSchema = z.string().uuid('Invalid UUID format');

export const paginationSchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50)
    .refine(val => val >= 1 && val <= 100, 'Limit must be between 1 and 100'),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0)
    .refine(val => val >= 0, 'Offset must be non-negative')
});

export const dateRangeSchema = z.object({
  startDate: z.string().optional().refine(
    val => !val || !isNaN(Date.parse(val)), 
    'Invalid start date format'
  ),
  endDate: z.string().optional().refine(
    val => !val || !isNaN(Date.parse(val)), 
    'Invalid end date format'
  )
}).refine(
  data => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  'End date must be after start date'
);

// Business validation helpers
export const validateWorkOrderStatus = (status: string): boolean => {
  const validStatuses = [
    'DRAFT', 'SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 
    'COMPLETED_PENDING_APPROVAL', 'APPROVED', 'CLOSED', 
    'CANCELLED', 'REWORK_REQUESTED'
  ];
  return validStatuses.includes(status);
};

export const validateJobCardStatus = (status: string): boolean => {
  const validStatuses = [
    'AWAITING_ACK', 'ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS',
    'COMPLETED', 'PENDING_APPROVAL', 'APPROVED', 'CLOSED',
    'NO_SHOW', 'CANCELLED_BY_CUSTOMER', 'PARTS_PENDING',
    'RESCHEDULED', 'REWORK_REQUESTED'
  ];
  return validStatuses.includes(status);
};

export const validateUserRole = (role: string): boolean => {
  const validRoles = [
    'SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN',
    'SHOWROOM_MANAGER', 'SALES_PERSON', 'PARTNER_ADMIN', 'PARTNER_STAFF'
  ];
  return validRoles.includes(role);
};

// Custom error handler for validation
export const handleValidationError = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.errors,
      path: req.path,
      method: req.method
    });
  }
  
  next(error);
};

// Idempotency validation
export const validateIdempotencyKey = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    
    if (!idempotencyKey) {
      return res.status(400).json({
        error: 'Idempotency-Key header is required for this operation'
      });
    }
    
    if (idempotencyKey.length < 16 || idempotencyKey.length > 255) {
      return res.status(400).json({
        error: 'Idempotency-Key must be between 16 and 255 characters'
      });
    }
    
    // Store the key for later use in the request
    req.idempotencyKey = idempotencyKey;
    next();
  };
};

// File upload validation
export const validateFileUpload = (options: {
  maxSize?: number;
  allowedTypes?: string[];
  required?: boolean;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { maxSize = 10 * 1024 * 1024, allowedTypes = [], required = false } = options;
    
    if (required && !req.file && !req.files) {
      return res.status(400).json({
        error: 'File upload is required'
      });
    }
    
    const files = req.files ? (Array.isArray(req.files) ? req.files : [req.file]) : (req.file ? [req.file] : []);
    
    for (const file of files) {
      if (!file) continue;
      
      if (file.size > maxSize) {
        return res.status(400).json({
          error: `File size exceeds maximum allowed size of ${maxSize} bytes`
        });
      }
      
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: `File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
        });
      }
    }
    
    next();
  };
};

// Request rate limiting validation
export const validateRateLimit = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean up old entries
    for (const [k, v] of requests.entries()) {
      if (v.resetTime < windowStart) {
        requests.delete(k);
      }
    }
    
    const current = requests.get(key) || { count: 0, resetTime: now + windowMs };
    
    if (current.count >= maxRequests && current.resetTime > now) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      });
    }
    
    current.count++;
    requests.set(key, current);
    
    next();
  };
};

// Add validation for tenant context
export const validateTenantAccess = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Super admin can access all tenants
    if (user.role === 'SUPER_ADMIN') {
      return next();
    }
    
    // Validate OEM access
    const requestedOemId = req.body?.oemId || req.query?.oemId || req.params?.oemId;
    if (requestedOemId && user.oemId !== requestedOemId) {
      return res.status(403).json({ 
        error: 'Access denied to this OEM',
        userOemId: user.oemId,
        requestedOemId
      });
    }
    
    next();
  };
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      idempotencyKey?: string;
    }
  }
}
