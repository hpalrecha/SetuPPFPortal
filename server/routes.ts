import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { 
  insertWorkOrderSchema,
  insertJobCardSchema,
  insertPartnerSchema,
  insertPricingRuleSchema,
  insertCommissionRuleSchema 
} from "@shared/schema";
import { storage } from "./storage";
import { authService } from "./auth";
import { authenticate, requireRole, requireOEMAccess, auditLog } from "./middleware";
import { ObjectStorageService } from "./objectStorage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication Routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password, oemId } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const result = await authService.login({ email, password, oemId });
      
      if (!result) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      res.json(result);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", authenticate, (req, res) => {
    res.json({ message: "Logged out successfully" });
  });

  app.get("/api/auth/me", authenticate, (req, res) => {
    res.json({ user: req.user });
  });

  // OEM Routes
  app.get("/api/oems", authenticate, requireRole(['SUPER_ADMIN']), async (req, res) => {
    try {
      const oems = await storage.getOems();
      res.json(oems);
    } catch (error) {
      console.error("Get OEMs error:", error);
      res.status(500).json({ error: "Failed to fetch OEMs" });
    }
  });

  // Dashboard Routes
  app.get("/api/dashboard/metrics", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const oemId = req.user!.oemId!;
      const showroomId = req.user!.showroomId;
      
      const metrics = await storage.getDashboardMetrics(oemId, showroomId);
      res.json(metrics);
    } catch (error) {
      console.error("Dashboard metrics error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  // Work Order Routes
  app.get("/api/work-orders", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { status, partnerId, limit = 50, offset = 0 } = req.query;
      
      const filters: any = {
        oemId: req.user!.oemId,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      };

      if (req.user!.showroomId) {
        filters.showroomId = req.user!.showroomId;
      }
      if (status) filters.status = status as string;
      if (partnerId) filters.partnerId = partnerId as string;

      const workOrders = await storage.getWorkOrders(filters);
      res.json(workOrders);
    } catch (error) {
      console.error("Get work orders error:", error);
      res.status(500).json({ error: "Failed to fetch work orders" });
    }
  });

  app.post("/api/work-orders", 
    authenticate, 
    requireRole(['SHOWROOM_MANAGER', 'DEALERSHIP_ADMIN', 'OEM_ADMIN']),
    auditLog('work_order', 'create'),
    async (req, res) => {
      try {
        const workOrderData = insertWorkOrderSchema.parse(req.body);
        
        // Ensure user can only create for their OEM/showroom
        workOrderData.oemId = req.user!.oemId!;
        workOrderData.createdByUserId = req.user!.id;
        
        if (req.user!.showroomId) {
          workOrderData.showroomId = req.user!.showroomId;
        }

        const workOrder = await storage.createWorkOrder(workOrderData);
        res.status(201).json(workOrder);
      } catch (error) {
        console.error("Create work order error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid work order data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to create work order" });
      }
    }
  );

  app.get("/api/work-orders/:id", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const workOrder = await storage.getWorkOrder(req.params.id);
      
      if (!workOrder) {
        return res.status(404).json({ error: "Work order not found" });
      }

      // Check access permissions
      if (workOrder.oemId !== req.user!.oemId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(workOrder);
    } catch (error) {
      console.error("Get work order error:", error);
      res.status(500).json({ error: "Failed to fetch work order" });
    }
  });

  app.put("/api/work-orders/:id", 
    authenticate, 
    requireOEMAccess,
    auditLog('work_order', 'update'),
    async (req, res) => {
      try {
        const updates = req.body;
        delete updates.id; // Prevent ID modification
        
        const workOrder = await storage.updateWorkOrder(req.params.id, updates);
        
        if (!workOrder) {
          return res.status(404).json({ error: "Work order not found" });
        }

        res.json(workOrder);
      } catch (error) {
        console.error("Update work order error:", error);
        res.status(500).json({ error: "Failed to update work order" });
      }
    }
  );

  // Job Card Routes
  app.get("/api/job-cards", authenticate, async (req, res) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      
      const filters: any = {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      };

      // Partner users can only see their own job cards
      if (req.user!.partnerId) {
        filters.partnerId = req.user!.partnerId;
      }
      if (status) filters.status = status as string;

      const jobCards = await storage.getJobCards(filters);
      res.json(jobCards);
    } catch (error) {
      console.error("Get job cards error:", error);
      res.status(500).json({ error: "Failed to fetch job cards" });
    }
  });

  app.post("/api/job-cards", 
    authenticate, 
    requireRole(['PARTNER_ADMIN', 'PARTNER_STAFF', 'SHOWROOM_MANAGER']),
    auditLog('job_card', 'create'),
    async (req, res) => {
      try {
        const jobCardData = insertJobCardSchema.parse(req.body);
        
        // Partner users can only create for their own partner
        if (req.user!.partnerId) {
          jobCardData.partnerId = req.user!.partnerId;
        }

        const jobCard = await storage.createJobCard(jobCardData);
        res.status(201).json(jobCard);
      } catch (error) {
        console.error("Create job card error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid job card data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to create job card" });
      }
    }
  );

  app.put("/api/job-cards/:id", 
    authenticate,
    auditLog('job_card', 'update'),
    async (req, res) => {
      try {
        const updates = req.body;
        delete updates.id; // Prevent ID modification
        
        const jobCard = await storage.updateJobCard(req.params.id, updates);
        
        if (!jobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }

        res.json(jobCard);
      } catch (error) {
        console.error("Update job card error:", error);
        res.status(500).json({ error: "Failed to update job card" });
      }
    }
  );

  // Job Card Actions
  app.post("/api/job-cards/:id/acknowledge", authenticate, async (req, res) => {
    try {
      const jobCard = await storage.updateJobCard(req.params.id, {
        status: 'ACKNOWLEDGED'
      });
      
      if (!jobCard) {
        return res.status(404).json({ error: "Job card not found" });
      }

      res.json(jobCard);
    } catch (error) {
      console.error("Acknowledge job card error:", error);
      res.status(500).json({ error: "Failed to acknowledge job card" });
    }
  });

  app.post("/api/job-cards/:id/schedule", authenticate, async (req, res) => {
    try {
      const { scheduledAt } = req.body;
      
      if (!scheduledAt) {
        return res.status(400).json({ error: "Scheduled time required" });
      }

      const jobCard = await storage.updateJobCard(req.params.id, {
        status: 'SCHEDULED',
        scheduledAt: new Date(scheduledAt)
      });
      
      if (!jobCard) {
        return res.status(404).json({ error: "Job card not found" });
      }

      res.json(jobCard);
    } catch (error) {
      console.error("Schedule job card error:", error);
      res.status(500).json({ error: "Failed to schedule job card" });
    }
  });

  app.post("/api/job-cards/:id/start", authenticate, async (req, res) => {
    try {
      const jobCard = await storage.updateJobCard(req.params.id, {
        status: 'IN_PROGRESS',
        startedAt: new Date()
      });
      
      if (!jobCard) {
        return res.status(404).json({ error: "Job card not found" });
      }

      res.json(jobCard);
    } catch (error) {
      console.error("Start job card error:", error);
      res.status(500).json({ error: "Failed to start job card" });
    }
  });

  app.post("/api/job-cards/:id/complete", authenticate, async (req, res) => {
    try {
      const { remarks, checklistJson } = req.body;
      
      const jobCard = await storage.updateJobCard(req.params.id, {
        status: 'COMPLETED',
        completedAt: new Date(),
        remarks,
        checklistJson
      });
      
      if (!jobCard) {
        return res.status(404).json({ error: "Job card not found" });
      }

      res.json(jobCard);
    } catch (error) {
      console.error("Complete job card error:", error);
      res.status(500).json({ error: "Failed to complete job card" });
    }
  });

  app.post("/api/job-cards/:id/request-approval", authenticate, async (req, res) => {
    try {
      const jobCard = await storage.updateJobCard(req.params.id, {
        status: 'PENDING_APPROVAL',
        approvalRequestedAt: new Date()
      });
      
      if (!jobCard) {
        return res.status(404).json({ error: "Job card not found" });
      }

      res.json(jobCard);
    } catch (error) {
      console.error("Request approval error:", error);
      res.status(500).json({ error: "Failed to request approval" });
    }
  });

  app.post("/api/job-cards/:id/approve", 
    authenticate, 
    requireRole(['SHOWROOM_MANAGER', 'DEALERSHIP_ADMIN']),
    async (req, res) => {
      try {
        const { remarks } = req.body;
        
        const jobCard = await storage.updateJobCard(req.params.id, {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedByUserId: req.user!.id
        });
        
        if (!jobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }

        // TODO: Trigger payout and commission calculation

        res.json(jobCard);
      } catch (error) {
        console.error("Approve job card error:", error);
        res.status(500).json({ error: "Failed to approve job card" });
      }
    }
  );

  // Partner Routes
  app.get("/api/partners", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const partners = await storage.getPartners({ oemId: req.user!.oemId });
      res.json(partners);
    } catch (error) {
      console.error("Get partners error:", error);
      res.status(500).json({ error: "Failed to fetch partners" });
    }
  });

  app.post("/api/partners", 
    authenticate, 
    requireRole(['OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    auditLog('partner', 'create'),
    async (req, res) => {
      try {
        const partnerData = insertPartnerSchema.parse(req.body);
        const partner = await storage.createPartner(partnerData);
        res.status(201).json(partner);
      } catch (error) {
        console.error("Create partner error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid partner data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to create partner" });
      }
    }
  );

  // Pricing Rules Routes
  app.get("/api/pricing-rules", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { partnerId, scopeId } = req.query;
      
      const filters: any = {};
      if (partnerId) filters.partnerId = partnerId as string;
      if (scopeId) filters.scopeId = scopeId as string;

      const rules = await storage.getPricingRules(filters);
      res.json(rules);
    } catch (error) {
      console.error("Get pricing rules error:", error);
      res.status(500).json({ error: "Failed to fetch pricing rules" });
    }
  });

  app.post("/api/pricing-rules", 
    authenticate, 
    requireRole(['OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    auditLog('pricing_rule', 'create'),
    async (req, res) => {
      try {
        const ruleData = insertPricingRuleSchema.parse(req.body);
        const rule = await storage.createPricingRule(ruleData);
        res.status(201).json(rule);
      } catch (error) {
        console.error("Create pricing rule error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid pricing rule data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to create pricing rule" });
      }
    }
  );

  // Commission Rules Routes
  app.get("/api/commission-rules", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { showroomId } = req.query;
      
      const filters: any = {};
      if (showroomId) filters.showroomId = showroomId as string;
      else if (req.user!.showroomId) filters.showroomId = req.user!.showroomId;

      const rules = await storage.getCommissionRules(filters);
      res.json(rules);
    } catch (error) {
      console.error("Get commission rules error:", error);
      res.status(500).json({ error: "Failed to fetch commission rules" });
    }
  });

  app.post("/api/commission-rules", 
    authenticate, 
    requireRole(['SHOWROOM_MANAGER', 'DEALERSHIP_ADMIN']),
    auditLog('commission_rule', 'create'),
    async (req, res) => {
      try {
        const ruleData = insertCommissionRuleSchema.parse(req.body);
        
        // Ensure user can only create rules for their showroom
        if (req.user!.showroomId) {
          ruleData.showroomId = req.user!.showroomId;
        }

        const rule = await storage.createCommissionRule(ruleData);
        res.status(201).json(rule);
      } catch (error) {
        console.error("Create commission rule error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid commission rule data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to create commission rule" });
      }
    }
  );

  // File Upload Routes for Job Card Media
  app.post("/api/objects/upload", authenticate, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Get upload URL error:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.post("/api/job-cards/:id/media", authenticate, async (req, res) => {
    try {
      const { mediaUrls } = req.body;
      
      if (!mediaUrls || !Array.isArray(mediaUrls)) {
        return res.status(400).json({ error: "Media URLs required" });
      }

      // TODO: Save media URLs to job_card_media table
      // For now, just return success
      res.json({ message: "Media uploaded successfully", urls: mediaUrls });
    } catch (error) {
      console.error("Upload job card media error:", error);
      res.status(500).json({ error: "Failed to upload media" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
