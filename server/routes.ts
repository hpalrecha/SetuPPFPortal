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
  insertOemSchema,
  insertServiceCategorySchema
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
        // Extract createUser flag and admin user data
        const { createUser, adminUserData, ...oemData } = req.body;
        
        // Create the OEM first
        const oem = await storage.createOem(oemData);
        
        // Create admin user if requested
        if (createUser && adminUserData) {
          try {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(adminUserData.password, 10);
            
            const adminData = {
              name: adminUserData.name,
              email: adminUserData.email,
              phone: adminUserData.phone || '',
              passwordHash: hashedPassword,
              role: 'OEM_ADMIN' as const,
              oemId: oem.id,
              isActive: true
            };
            
            const createdUser = await storage.createUser(adminData);
            console.log(`Created admin user for OEM: ${oem.name} - Email: ${createdUser.email}`);
          } catch (userError) {
            console.error("Failed to create admin user:", userError);
            // Don't fail the whole request if user creation fails
          }
        }
        
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
      
      // Add counts for each dealership
      const dealershipsWithCounts = await Promise.all(
        dealerships.map(async (dealership) => {
          const showrooms = await storage.getShowrooms(dealership.id);
          const showroomsCount = showrooms.length;
          
          // Count sales staff for this dealership (users with SALES_PERSON role)
          const salesStaff = await storage.getUsers({ dealershipId: dealership.id, role: 'SALES_PERSON' });
          const salesStaffCount = salesStaff ? salesStaff.length : 0;
          
          return {
            ...dealership,
            showroomsCount,
            salesStaffCount
          };
        })
      );
      
      res.json(dealershipsWithCounts);
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
        // Extract createUser flag and admin user data
        const { createUser, adminUserData, ...dealershipFields } = req.body;
        
        // Add code field derived from dealership name
        const dealershipData = {
          ...dealershipFields,
          code: dealershipFields.name.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000)
        };
        
        // Create the dealership first
        const dealership = await storage.createDealership(dealershipData);
        
        // Create admin user if requested
        if (createUser && adminUserData) {
          try {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(adminUserData.password, 10);
            
            const adminData = {
              name: adminUserData.name,
              email: adminUserData.email,
              phone: adminUserData.phone || '',
              passwordHash: hashedPassword,
              role: 'DEALERSHIP_ADMIN' as const,
              oemId: dealership.oemId, // Link to the same OEM
              dealershipId: dealership.id,
              isActive: true
            };
            
            const createdUser = await storage.createUser(adminData);
            console.log(`Created dealership admin user: ${createdUser.email} for ${dealership.name}`);
          } catch (userError) {
            console.error("Failed to create dealership admin user:", userError);
            // Don't fail the whole request if user creation fails
          }
        }
        
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
        // Extract createUser flag and admin user data
        const { createUser, adminUserData, ...showroomFields } = req.body;
        
        // Add code field derived from showroom name
        const showroomData = {
          ...showroomFields,
          code: showroomFields.name.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000)
        };
        
        // Create the showroom first
        const showroom = await storage.createShowroom(showroomData);
        
        // Create manager user if requested
        if (createUser && adminUserData) {
          try {
            const bcrypt = await import('bcryptjs');
            const hashedPassword = await bcrypt.hash(adminUserData.password, 10);
            
            const managerData = {
              name: adminUserData.name,
              email: adminUserData.email,
              phone: adminUserData.phone || '',
              passwordHash: hashedPassword,
              role: 'SHOWROOM_MANAGER' as const,
              oemId: showroom.oemId, // Link to the same OEM
              dealershipId: showroom.dealershipId,
              showroomId: showroom.id,
              isActive: true
            };
            
            const createdUser = await storage.createUser(managerData);
            console.log(`Created showroom manager user: ${createdUser.email} for ${showroom.name}`);
          } catch (userError) {
            console.error("Failed to create showroom manager user:", userError);
            // Don't fail the whole request if user creation fails
          }
        }
        
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
  app.get("/api/vehicle-models", authenticate, requireOEMAccess, async (req, res) => {
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
            // Extract fields - model_name, vehicle_type, and variant_name (OEM is already specified)
            const modelName = originalRow.model_name?.toString().trim();
            const vehicleType = originalRow.vehicle_type?.toString().trim() || '';
            const variantName = originalRow.variant_name?.toString().trim() || '';

            // Create a clean row object
            const cleanRowData = {
              model_name: modelName || '',
              vehicle_type: vehicleType || '',
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
                vehicleType: vehicleType || null, // Add vehicle type from Excel
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
                vehicle_type: originalRow.vehicle_type || '',
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
    requireRole(['SHOWROOM_MANAGER', 'DEALERSHIP_ADMIN', 'OEM_ADMIN', 'SUPER_ADMIN']),
    auditLog('work_order', 'create'),
    async (req, res) => {
      try {
        // First get the request data without validation  
        const requestData = req.body;
        
        // Set required system fields and clean optional fields
        const workOrderData = {
          ...requestData,
          createdByUserId: req.user!.id,
          // Handle optional fields - set to null if empty string
          salesPersonId: requestData.salesPersonId && requestData.salesPersonId.trim() !== '' ? requestData.salesPersonId : null,
          vehicleVariantId: requestData.vehicleVariantId && requestData.vehicleVariantId.trim() !== '' ? requestData.vehicleVariantId : null,
          regNo: requestData.regNo && requestData.regNo.trim() !== '' ? requestData.regNo : null,
          notes: requestData.notes && requestData.notes.trim() !== '' ? requestData.notes : null,
          customerEmail: requestData.customerEmail && requestData.customerEmail.trim() !== '' ? requestData.customerEmail : null,
          customerAddress: requestData.customerAddress && requestData.customerAddress.trim() !== '' ? requestData.customerAddress : null
        };
        
        // Ensure user can only create for their OEM/showroom (except Super Admin)
        if (req.user!.role !== 'SUPER_ADMIN') {
          workOrderData.oemId = req.user!.oemId!;
          if (req.user!.showroomId) {
            workOrderData.showroomId = req.user!.showroomId;
          }
        }

        // Now validate the complete data including createdByUserId
        const validatedData = insertWorkOrderSchema.extend({
          createdByUserId: z.string()
        }).parse(workOrderData);

        // Use WorkOrderService for proper business logic
        const { workOrderService } = await import('./services/workOrderService');
        const workOrder = await workOrderService.createWorkOrder(validatedData, req.user!.id);
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
      if (!req.user!.oemId || workOrder.oemId !== req.user!.oemId) {
        console.log(`Access denied: workOrder.oemId=${workOrder.oemId}, user.oemId=${req.user!.oemId}`);
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(workOrder);
    } catch (error) {
      console.error("Get work order error:", error);
      res.status(500).json({ error: "Failed to fetch work order" });
    }
  });

  app.post("/api/work-orders/:id/submit", 
    authenticate, 
    requireOEMAccess,
    auditLog('work_order', 'submit'),
    async (req, res) => {
      try {
        const { workOrderService } = await import('./services/workOrderService');
        const workOrder = await workOrderService.submitWorkOrder(req.params.id, req.user!.id);
        res.json(workOrder);
      } catch (error) {
        console.error("Submit work order error:", error);
        res.status(500).json({ error: "Failed to submit work order" });
      }
    }
  );

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
      const { type } = req.query;
      const filters: any = { oemId: req.user!.oemId };
      
      if (type) {
        filters.type = type as string;
      }
      
      const partners = await storage.getPartners(filters);
      res.json(partners);
    } catch (error) {
      console.error("Get partners error:", error);
      res.status(500).json({ error: "Failed to fetch partners" });
    }
  });

  app.post("/api/partners", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
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
      const { partnerId, scopeId, pricingType, dealershipId, detailerId } = req.query;
      
      const filters: any = {};
      if (partnerId) filters.partnerId = partnerId as string;
      if (scopeId) filters.scopeId = scopeId as string;
      if (pricingType) filters.pricingType = pricingType as string;
      if (dealershipId) filters.dealershipId = dealershipId as string;
      if (detailerId) filters.detailerId = detailerId as string;

      const rules = await storage.getPricingRules(filters);
      res.json(rules);
    } catch (error) {
      console.error("Get pricing rules error:", error);
      res.status(500).json({ error: "Failed to fetch pricing rules" });
    }
  });

  app.post("/api/pricing-rules", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
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

  app.delete("/api/pricing-rules/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    auditLog('pricing_rule', 'delete'),
    async (req, res) => {
      try {
        const deleted = await storage.deletePricingRule(req.params.id);
        if (!deleted) {
          return res.status(404).json({ error: "Pricing rule not found" });
        }
        res.status(200).json({ message: "Pricing rule deleted successfully" });
      } catch (error) {
        console.error("Delete pricing rule error:", error);
        res.status(500).json({ error: "Failed to delete pricing rule" });
      }
    }
  );

  // Dealership Pricing Resolution
  app.get("/api/pricing/dealership/:dealershipId/service/:serviceId", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    async (req, res) => {
      try {
        const { dealershipId, serviceId } = req.params;
        const { vehicleModelId } = req.query;
        
        const pricingService = require('./services/pricing').pricingService;
        const pricing = await pricingService.getDealershipPricing({
          dealershipId,
          serviceId,
          vehicleModelId: vehicleModelId as string
        });
        
        res.json(pricing);
      } catch (error) {
        console.error("Get dealership pricing error:", error);
        res.status(404).json({ error: error.message || "Pricing not found" });
      }
    }
  );

  // Detailer Pricing Resolution
  app.get("/api/pricing/detailer/:detailerId/service/:serviceId", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'PARTNER_ADMIN', 'PARTNER_STAFF']),
    async (req, res) => {
      try {
        const { detailerId, serviceId } = req.params;
        const { vehicleModelId } = req.query;
        
        const pricingService = require('./services/pricing').pricingService;
        const pricing = await pricingService.getDetailerPricing({
          detailerId,
          serviceId,
          vehicleModelId: vehicleModelId as string
        });
        
        res.json(pricing);
      } catch (error) {
        console.error("Get detailer pricing error:", error);
        res.status(404).json({ error: error.message || "Pricing not found" });
      }
    }
  );

  // Sales Persons Routes
  app.get("/api/sales-persons", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']), 
    async (req, res) => {
      try {
        const { showroomId } = req.query;
        const salesPersons = await storage.getSalesPersons(showroomId as string);
        res.json(salesPersons);
      } catch (error) {
        console.error("Get sales persons error:", error);
        res.status(500).json({ error: "Failed to fetch sales persons" });
      }
    }
  );

  app.get("/api/sales-persons/:id/metrics", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']), 
    async (req, res) => {
      try {
        const metrics = await storage.getSalesPersonMetrics(req.params.id);
        res.json(metrics);
      } catch (error) {
        console.error("Get sales person metrics error:", error);
        res.status(500).json({ error: "Failed to fetch sales person metrics" });
      }
    }
  );

  app.post("/api/sales-persons", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    auditLog('sales_person', 'create'),
    async (req, res) => {
      try {
        const salesPersonData = {
          name: req.body.name,
          email: req.body.email,
          phone: req.body.phone || '',
          passwordHash: '',
          role: 'SALES_PERSON' as const,
          showroomId: req.body.showroomId || null,
          isActive: req.body.active ?? true
        };
        
        const salesPerson = await storage.createUser(salesPersonData);
        res.status(201).json(salesPerson);
      } catch (error) {
        console.error("Create sales person error:", error);
        res.status(500).json({ error: "Failed to create sales person" });
      }
    }
  );

  app.put("/api/sales-persons/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    auditLog('sales_person', 'update'),
    async (req, res) => {
      try {
        const updateData = {
          name: req.body.name,
          email: req.body.email,
          phone: req.body.phone,
          showroomId: req.body.showroomId || null,
          isActive: req.body.active
        };
        
        const salesPerson = await storage.updateUser(req.params.id, updateData);
        if (!salesPerson) {
          return res.status(404).json({ error: "Sales person not found" });
        }
        res.json(salesPerson);
      } catch (error) {
        console.error("Update sales person error:", error);
        res.status(500).json({ error: "Failed to update sales person" });
      }
    }
  );

  app.delete("/api/sales-persons/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    auditLog('sales_person', 'delete'),
    async (req, res) => {
      try {
        const result = await storage.deleteUser(req.params.id);
        if (!result) {
          return res.status(404).json({ error: "Sales person not found" });
        }
        res.json({ message: "Sales person deleted successfully" });
      } catch (error) {
        console.error("Delete sales person error:", error);
        res.status(500).json({ error: "Failed to delete sales person" });
      }
    }
  );

  // Service Categories Routes
  app.get("/api/service-categories", authenticate, async (req, res) => {
    try {
      const categories = await storage.getServiceCategories();
      res.json(categories);
    } catch (error) {
      console.error("Get service categories error:", error);
      res.status(500).json({ error: "Failed to fetch service categories" });
    }
  });

  app.get("/api/service-categories/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const category = await storage.getServiceCategory(id);
      
      if (!category) {
        return res.status(404).json({ error: "Service category not found" });
      }
      
      res.json(category);
    } catch (error) {
      console.error("Get service category error:", error);
      res.status(500).json({ error: "Failed to fetch service category" });
    }
  });

  app.post("/api/service-categories", 
    authenticate, 
    requireRole(['SUPER_ADMIN']),
    auditLog('service_category', 'create'),
    async (req, res) => {
      try {
        const categoryData = insertServiceCategorySchema.parse(req.body);
        const category = await storage.createServiceCategory(categoryData);
        res.status(201).json(category);
      } catch (error: any) {
        console.error("Create service category error:", error);
        
        if (error?.name === 'ZodError') {
          return res.status(400).json({ 
            error: "Validation failed",
            details: error.errors 
          });
        }
        
        if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
          return res.status(409).json({ 
            error: "A service category with this name or code already exists" 
          });
        }
        
        res.status(500).json({ error: "Failed to create service category" });
      }
    }
  );

  app.put("/api/service-categories/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN']),
    auditLog('service_category', 'update'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const updates = insertServiceCategorySchema.partial().parse(req.body);
        
        const category = await storage.updateServiceCategory(id, updates);
        if (!category) {
          return res.status(404).json({ error: "Service category not found" });
        }
        
        res.json(category);
      } catch (error: any) {
        console.error("Update service category error:", error);
        
        if (error?.name === 'ZodError') {
          return res.status(400).json({ 
            error: "Validation failed",
            details: error.errors 
          });
        }
        
        if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
          return res.status(409).json({ 
            error: "A service category with this name or code already exists" 
          });
        }
        
        res.status(500).json({ error: "Failed to update service category" });
      }
    }
  );

  app.delete("/api/service-categories/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN']),
    auditLog('service_category', 'delete'),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        const success = await storage.deleteServiceCategory(id);
        if (!success) {
          return res.status(404).json({ error: "Service category not found" });
        }
        
        res.json({ message: "Service category deleted successfully" });
      } catch (error) {
        console.error("Delete service category error:", error);
        res.status(500).json({ error: "Failed to delete service category" });
      }
    }
  );

  // Services Routes
  app.get("/api/services", authenticate, async (req, res) => {
    try {
      const { oemId, dealershipId } = req.query;
      
      // If user is not Super Admin, filter by their context
      const filters: any = {};
      if (oemId) filters.oemId = oemId as string;
      else if (dealershipId) filters.dealershipId = dealershipId as string;
      else if (req.user!.dealershipId) filters.dealershipId = req.user!.dealershipId;
      else if (req.user!.oemId) filters.oemId = req.user!.oemId;

      const services = await storage.getServices(filters);
      res.json(services);
    } catch (error) {
      console.error("Get services error:", error);
      res.status(500).json({ error: "Failed to fetch services" });
    }
  });

  app.get("/api/services/:id", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const service = await storage.getService(id);
      
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }
      
      res.json(service);
    } catch (error) {
      console.error("Get service error:", error);
      res.status(500).json({ error: "Failed to fetch service" });
    }
  });

  app.post("/api/services", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN']),
    auditLog('service', 'create'),
    async (req, res) => {
      try {
        const serviceData = req.body;
        
        // Set user context if not Super Admin
        if (req.user!.role !== 'SUPER_ADMIN') {
          serviceData.oemId = req.user!.oemId;
          if (serviceData.availabilityScope === 'DEALERSHIP') {
            serviceData.dealershipId = req.user!.dealershipId;
          }
        }
        
        const service = await storage.createService(serviceData);
        res.status(201).json(service);
      } catch (error) {
        console.error("Create service error:", error);
        res.status(500).json({ error: "Failed to create service" });
      }
    }
  );

  app.put("/api/services/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN']),
    auditLog('service', 'update'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;
        
        // Prevent unauthorized updates
        const existingService = await storage.getService(id);
        if (!existingService) {
          return res.status(404).json({ error: "Service not found" });
        }
        
        if (req.user!.role !== 'SUPER_ADMIN' && existingService.oemId !== req.user!.oemId) {
          return res.status(403).json({ error: "Unauthorized to update this service" });
        }
        
        const service = await storage.updateService(id, updates);
        res.json(service);
      } catch (error) {
        console.error("Update service error:", error);
        res.status(500).json({ error: "Failed to update service" });
      }
    }
  );

  app.delete("/api/services/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN']),
    auditLog('service', 'delete'),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        // Prevent unauthorized deletion
        const existingService = await storage.getService(id);
        if (!existingService) {
          return res.status(404).json({ error: "Service not found" });
        }
        
        if (req.user!.role !== 'SUPER_ADMIN' && existingService.oemId !== req.user!.oemId) {
          return res.status(403).json({ error: "Unauthorized to delete this service" });
        }
        
        const success = await storage.deleteService(id);
        if (!success) {
          return res.status(404).json({ error: "Service not found" });
        }
        
        res.json({ message: "Service deleted successfully" });
      } catch (error) {
        console.error("Delete service error:", error);
        res.status(500).json({ error: "Failed to delete service" });
      }
    }
  );

  // Allocation Routes
  app.get("/api/allocations", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { partnerId, level, levelId } = req.query;
      
      const filters: any = {};
      if (partnerId) filters.partnerId = partnerId as string;
      if (level) filters.level = level as string;
      if (levelId) filters.levelId = levelId as string;

      const allocations = await storage.getAllocations(filters);
      res.json(allocations);
    } catch (error) {
      console.error("Get allocations error:", error);
      res.status(500).json({ error: "Failed to fetch allocations" });
    }
  });

  app.get("/api/allocations/:id", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const allocation = await storage.getAllocation(req.params.id);
      if (!allocation) {
        return res.status(404).json({ error: "Allocation not found" });
      }
      res.json(allocation);
    } catch (error) {
      console.error("Get allocation error:", error);
      res.status(500).json({ error: "Failed to fetch allocation" });
    }
  });

  app.post("/api/allocations", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
    auditLog('allocation', 'create'),
    async (req, res) => {
      try {
        const allocationData = req.body;
        
        // Validate required fields
        if (!allocationData.level || !allocationData.levelId || !allocationData.partnerId) {
          return res.status(400).json({ 
            error: "Level, levelId, and partnerId are required" 
          });
        }

        const allocation = await storage.createAllocation(allocationData);
        res.status(201).json(allocation);
      } catch (error) {
        console.error("Create allocation error:", error);
        if (error.message.includes("already has an active allocation")) {
          return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: "Failed to create allocation" });
      }
    }
  );

  app.put("/api/allocations/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
    auditLog('allocation', 'update'),
    async (req, res) => {
      try {
        const allocation = await storage.updateAllocation(req.params.id, req.body);
        if (!allocation) {
          return res.status(404).json({ error: "Allocation not found" });
        }
        res.json(allocation);
      } catch (error) {
        console.error("Update allocation error:", error);
        res.status(500).json({ error: "Failed to update allocation" });
      }
    }
  );

  app.delete("/api/allocations/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
    auditLog('allocation', 'delete'),
    async (req, res) => {
      try {
        const deleted = await storage.deleteAllocation(req.params.id);
        if (!deleted) {
          return res.status(404).json({ error: "Allocation not found" });
        }
        res.status(200).json({ message: "Allocation deleted successfully" });
      } catch (error) {
        console.error("Delete allocation error:", error);
        res.status(500).json({ error: "Failed to delete allocation" });
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
