import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { 
  insertWorkOrderSchema,
  insertJobCardSchema,
  insertPartnerSchema,
  insertPricingRuleSchema,
  insertCommissionRuleSchema,
  insertVehicleModelSchema,
  insertVehicleVariantSchema,
  insertOemSchema
} from "@shared/schema";
import { storage } from "./storage";
import { authService } from "./auth";
import { authenticate, requireRole, requireOEMAccess, auditLog } from "./middleware";
import { ObjectStorageService } from "./objectStorage";
import multer from "multer";
import * as XLSX from "xlsx";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  }
});

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
      
      // Get counts for each OEM
      const oemsWithCounts = await Promise.all(oems.map(async (oem) => {
        const dealerships = await storage.getDealerships(oem.id);
        const showrooms = await storage.getShowrooms(undefined, oem.id);
        
        return {
          ...oem,
          dealershipsCount: dealerships.length,
          showroomsCount: showrooms.length
        };
      }));
      
      res.json(oemsWithCounts);
    } catch (error) {
      console.error("Get OEMs error:", error);
      res.status(500).json({ error: "Failed to fetch OEMs" });
    }
  });

  app.post("/api/oems", 
    authenticate, 
    requireRole(['SUPER_ADMIN']),
    auditLog('oem', 'create'),
    async (req, res) => {
      try {
        const oemData = insertOemSchema.parse(req.body);
        const oem = await storage.createOem(oemData);
        res.status(201).json(oem);
      } catch (error) {
        console.error("Create OEM error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid OEM data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to create OEM" });
      }
    }
  );

  app.put("/api/oems/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN']),
    auditLog('oem', 'update'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const oemData = insertOemSchema.partial().parse(req.body);
        const oem = await storage.updateOem(id, oemData);
        
        if (!oem) {
          return res.status(404).json({ error: "OEM not found" });
        }
        
        res.json(oem);
      } catch (error) {
        console.error("Update OEM error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid OEM data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to update OEM" });
      }
    }
  );

  app.delete("/api/oems/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN']),
    auditLog('oem', 'delete'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const success = await storage.deleteOem(id);
        
        if (!success) {
          return res.status(404).json({ error: "OEM not found" });
        }
        
        res.json({ message: "OEM deleted successfully" });
      } catch (error) {
        console.error("Delete OEM error:", error);
        res.status(500).json({ error: "Failed to delete OEM" });
      }
    }
  );

  // Dealership Routes
  app.get("/api/dealerships", authenticate, requireRole(['SUPER_ADMIN', 'OEM_ADMIN']), async (req, res) => {
    try {
      const { oemId } = req.query;
      const dealerships = await storage.getDealerships(oemId as string);
      res.json(dealerships);
    } catch (error) {
      console.error("Get dealerships error:", error);
      res.status(500).json({ error: "Failed to fetch dealerships" });
    }
  });

  app.get("/api/dealerships/:id", authenticate, requireRole(['SUPER_ADMIN', 'OEM_ADMIN']), async (req, res) => {
    try {
      const { id } = req.params;
      const dealership = await storage.getDealership(id);
      
      if (!dealership) {
        return res.status(404).json({ error: "Dealership not found" });
      }
      
      res.json(dealership);
    } catch (error) {
      console.error("Get dealership error:", error);
      res.status(500).json({ error: "Failed to fetch dealership" });
    }
  });

  app.post("/api/dealerships", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN']),
    auditLog('dealership', 'create'),
    async (req, res) => {
      try {
        // Add brandCode field derived from dealership name
        const dealershipData = {
          ...req.body,
          code: req.body.name.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000)
        };
        
        const dealership = await storage.createDealership(dealershipData);
        res.status(201).json(dealership);
      } catch (error) {
        console.error("Create dealership error:", error);
        res.status(500).json({ error: "Failed to create dealership" });
      }
    }
  );

  app.put("/api/dealerships/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN']),
    auditLog('dealership', 'update'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const dealership = await storage.updateDealership(id, req.body);
        
        if (!dealership) {
          return res.status(404).json({ error: "Dealership not found" });
        }
        
        res.json(dealership);
      } catch (error) {
        console.error("Update dealership error:", error);
        res.status(500).json({ error: "Failed to update dealership" });
      }
    }
  );

  app.delete("/api/dealerships/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN']),
    auditLog('dealership', 'delete'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const success = await storage.deleteDealership(id);
        
        if (!success) {
          return res.status(404).json({ error: "Dealership not found" });
        }
        
        res.json({ message: "Dealership deleted successfully" });
      } catch (error) {
        console.error("Delete dealership error:", error);
        res.status(500).json({ error: "Failed to delete dealership" });
      }
    }
  );

  // Showroom Routes
  app.get("/api/showrooms", authenticate, requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']), async (req, res) => {
    try {
      const { dealershipId, oemId } = req.query;
      const showrooms = await storage.getShowrooms(dealershipId as string, oemId as string);
      res.json(showrooms);
    } catch (error) {
      console.error("Get showrooms error:", error);
      res.status(500).json({ error: "Failed to fetch showrooms" });
    }
  });

  app.post("/api/showrooms", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
    auditLog('showroom', 'create'),
    async (req, res) => {
      try {
        // Add code field derived from showroom name
        const showroomData = {
          ...req.body,
          code: req.body.name.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000)
        };
        
        const showroom = await storage.createShowroom(showroomData);
        res.status(201).json(showroom);
      } catch (error) {
        console.error("Create showroom error:", error);
        res.status(500).json({ error: "Failed to create showroom" });
      }
    }
  );

  // Vehicle Data Display Route (OEM = Brand structure)
  app.get("/api/vehicle-data/:oemId", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { oemId } = req.params;
      
      // Get OEM info
      const oem = await storage.getOem(oemId);
      if (!oem) {
        return res.status(404).json({ error: "OEM not found" });
      }

      // Get all models for this OEM with their variants
      const models = await storage.getVehicleModels({ oemId });
      const vehicleData = [];

      // Since OEM = Brand, create a single brand entry with OEM's name
      const brandData = {
        id: oem.id,
        name: oem.name,
        models: []
      };

      for (const model of models) {
        const variants = await storage.getVehicleVariants({ modelId: model.id });
        (brandData.models as any[]).push({
          id: model.id,
          name: model.modelName,
          variants: variants.map(v => ({
            id: v.id,
            name: v.variantName,
            fuelType: v.fuelType || null,
            transmission: v.transmission || null,
            engineCapacity: v.engineCapacity || null
          }))
        });
      }

      vehicleData.push(brandData);
      res.json(vehicleData);
    } catch (error) {
      console.error("Vehicle data fetch error:", error);
      res.status(500).json({ error: "Failed to fetch vehicle data" });
    }
  });

  // Note: Brand endpoints removed - OEM serves as Brand directly



  // Vehicle Model Routes (now using oemId instead of brandId)
  app.get("/api/vehicle-models", authenticate, requireRole(['SUPER_ADMIN']), async (req, res) => {
    try {
      const { oemId } = req.query;
      
      const filters: any = {};
      if (oemId) filters.oemId = oemId as string;

      const models = await storage.getVehicleModels(filters);
      res.json(models);
    } catch (error) {
      console.error("Get vehicle models error:", error);
      res.status(500).json({ error: "Failed to fetch vehicle models" });
    }
  });

  app.post("/api/vehicle-models", 
    authenticate, 
    requireRole(['SUPER_ADMIN']),
    auditLog('vehicle_model', 'create'),
    async (req, res) => {
      try {
        const modelData = insertVehicleModelSchema.parse(req.body);
        const model = await storage.createVehicleModel(modelData);
        res.status(201).json(model);
      } catch (error) {
        console.error("Create vehicle model error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid vehicle model data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to create vehicle model" });
      }
    }
  );

  app.put("/api/vehicle-models/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN']),
    auditLog('vehicle_model', 'update'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const modelData = insertVehicleModelSchema.partial().parse(req.body);
        const model = await storage.updateVehicleModel(id, modelData);
        
        if (!model) {
          return res.status(404).json({ error: "Model not found" });
        }
        
        res.json(model);
      } catch (error) {
        console.error("Update vehicle model error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid vehicle model data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to update vehicle model" });
      }
    }
  );

  app.delete("/api/vehicle-models/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN']),
    auditLog('vehicle_model', 'delete'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const success = await storage.deleteVehicleModel(id);
        
        if (!success) {
          return res.status(404).json({ error: "Model not found" });
        }
        
        res.json({ message: "Model deleted successfully" });
      } catch (error) {
        console.error("Delete vehicle model error:", error);
        res.status(500).json({ error: "Failed to delete vehicle model" });
      }
    }
  );


  // Vehicle Variant Routes
  app.get("/api/vehicle-variants", authenticate, requireRole(['SUPER_ADMIN']), async (req, res) => {
    try {
      const { modelId } = req.query;
      
      const filters: any = {};
      if (modelId) filters.modelId = modelId as string;

      const variants = await storage.getVehicleVariants(filters);
      res.json(variants);
    } catch (error) {
      console.error("Get vehicle variants error:", error);
      res.status(500).json({ error: "Failed to fetch vehicle variants" });
    }
  });

  app.post("/api/vehicle-variants", 
    authenticate, 
    requireRole(['SUPER_ADMIN']),
    auditLog('vehicle_variant', 'create'),
    async (req, res) => {
      try {
        const variantData = insertVehicleVariantSchema.parse(req.body);
        const variant = await storage.createVehicleVariant(variantData);
        res.status(201).json(variant);
      } catch (error) {
        console.error("Create vehicle variant error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid vehicle variant data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to create vehicle variant" });
      }
    }
  );

  app.put("/api/vehicle-variants/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN']),
    auditLog('vehicle_variant', 'update'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const variantData = insertVehicleVariantSchema.partial().parse(req.body);
        const variant = await storage.updateVehicleVariant(id, variantData);
        
        if (!variant) {
          return res.status(404).json({ error: "Variant not found" });
        }
        
        res.json(variant);
      } catch (error) {
        console.error("Update vehicle variant error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid vehicle variant data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to update vehicle variant" });
      }
    }
  );

  app.delete("/api/vehicle-variants/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN']),
    auditLog('vehicle_variant', 'delete'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const success = await storage.deleteVehicleVariant(id);
        
        if (!success) {
          return res.status(404).json({ error: "Variant not found" });
        }
        
        res.json({ message: "Variant deleted successfully" });
      } catch (error) {
        console.error("Delete vehicle variant error:", error);
        res.status(500).json({ error: "Failed to delete vehicle variant" });
      }
    }
  );

  app.post("/api/vehicle-variants", 
    authenticate, 
    requireRole(['SUPER_ADMIN']),
    auditLog('vehicle_variant', 'create'),
    async (req, res) => {
      try {
        const variantData = insertVehicleVariantSchema.parse(req.body);
        const variant = await storage.createVehicleVariant(variantData);
        res.status(201).json(variant);
      } catch (error) {
        console.error("Create vehicle variant error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid vehicle variant data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to create vehicle variant" });
      }
    }
  );

  app.put("/api/vehicle-variants/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN']),
    auditLog('vehicle_variant', 'update'),
    async (req, res) => {
      try {
        const updates = req.body;
        delete updates.id;
        
        const variant = await storage.updateVehicleVariant(req.params.id, updates);
        
        if (!variant) {
          return res.status(404).json({ error: "Vehicle variant not found" });
        }

        res.json(variant);
      } catch (error) {
        console.error("Update vehicle variant error:", error);
        res.status(500).json({ error: "Failed to update vehicle variant" });
      }
    }
  );

  app.delete("/api/vehicle-variants/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN']),
    auditLog('vehicle_variant', 'delete'),
    async (req, res) => {
      try {
        const success = await storage.deleteVehicleVariant(req.params.id);
        
        if (!success) {
          return res.status(404).json({ error: "Vehicle variant not found" });
        }

        res.json({ message: "Vehicle variant deleted successfully" });
      } catch (error) {
        console.error("Delete vehicle variant error:", error);
        res.status(500).json({ error: "Failed to delete vehicle variant" });
      }
    }
  );

  // Vehicle Excel Upload Route (OEM-Model-Variant structure)
  app.post("/api/vehicle-data/upload-excel",
    authenticate,
    requireRole(['SUPER_ADMIN']),
    upload.single('file'),
    auditLog('vehicle_data', 'bulk_upload'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const { oemId } = req.body;
        if (!oemId) {
          return res.status(400).json({ error: "OEM ID is required" });
        }

        // Verify OEM exists
        const oem = await storage.getOem(oemId);
        if (!oem) {
          return res.status(400).json({ error: "Invalid OEM ID" });
        }

        // Parse Excel file
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const results = {
          success: 0,
          errors: [] as Array<{ row: number; error: string; data: any }>,
          created: [] as Array<{ oem: string; models: string[]; variants: Array<{ model: string; variant: string }> }>
        };

        // Initialize results with OEM name
        results.created.push({ oem: oem.name, models: [], variants: [] });

        // Process each row
        for (let i = 0; i < data.length; i++) {
          const originalRow = data[i] as any;
          const rowNum = i + 2; // Excel row number (starting from 2, assuming row 1 is headers)

          try {
            // Extract fields - now only model_name and variant_name (OEM is already specified)
            const modelName = originalRow.model_name?.toString().trim();
            const variantName = originalRow.variant_name?.toString().trim() || '';

            // Create a clean row object
            const cleanRowData = {
              model_name: modelName || '',
              variant_name: variantName || ''
            };

            // Validate required fields
            if (!modelName) {
              results.errors.push({
                row: rowNum,
                error: 'Model name is required', 
                data: cleanRowData
              });
              continue;
            }

            // Check if model already exists for this OEM
            let model = (await storage.getVehicleModels({ oemId }))
              .find(m => m.modelName.toLowerCase() === modelName.toLowerCase());

            // Create model if it doesn't exist
            if (!model) {
              const modelData = {
                oemId: oemId,
                modelName: modelName,
                active: true
              };
              model = await storage.createVehicleModel(modelData);

              const oemResult = results.created.find(r => r.oem === oem.name);
              if (oemResult && !oemResult.models.includes(modelName)) {
                oemResult.models.push(modelName);
              }
            }

            // Create variant if specified and doesn't exist
            if (variantName) {
              const existingVariant = (await storage.getVehicleVariants({ modelId: model.id }))
                .find(v => v.variantName.toLowerCase() === variantName.toLowerCase());

              if (!existingVariant) {
                const variantData = {
                  modelId: model.id,
                  variantName: variantName,
                  active: true
                };
                await storage.createVehicleVariant(variantData);

                const oemResult = results.created.find(r => r.oem === oem.name);
                if (oemResult) {
                  oemResult.variants.push({ model: modelName, variant: variantName });
                }
              }
            }

            results.success++;

          } catch (error) {
            results.errors.push({
              row: rowNum,
              error: error instanceof Error ? error.message : 'Unknown error',
              data: {
                model_name: originalRow.model_name || '',
                variant_name: originalRow.variant_name || ''
              }
            });
          }
        }

        res.json({
          message: `Upload completed. ${results.success} records processed successfully.`,
          results
        });

      } catch (error) {
        console.error("Excel upload error:", error);
        res.status(500).json({ 
          error: "Failed to process Excel file",
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

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
