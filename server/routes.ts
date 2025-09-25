import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { 
  insertWorkOrderSchema,
  insertJobCardSchema,
  insertPartnerSchema,
  insertPricingRuleSchema,
  insertCommissionRuleSchema,
  insertVehicleModelSchema,
  insertVehicleVariantSchema,
  insertOemSchema,
  insertServiceCategorySchema,
  payoutSettlementSchema,
  commissionRules
} from "@shared/schema";
import { storage } from "./storage";
import { authService } from "./auth";
import { emailService } from "./services/email-service";
import { authenticate, requireRole, requireOEMAccess, auditLog } from "./middleware";
import { ObjectStorageService } from "./objectStorage";
import multer from "multer";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";

// Configure multer for file uploads (Excel for imports)
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

// Configure multer for image uploads (job card media)
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for images
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
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
  app.get("/api/oems", authenticate, requireRole(['SUPER_ADMIN', 'PARTNER_ADMIN', 'PARTNER_STAFF']), async (req, res) => {
    try {
      let oems = await storage.getOems();
      
      // Filter OEMs based on user role and access
      if (req.user?.role === 'PARTNER_ADMIN' || req.user?.role === 'PARTNER_STAFF') {
        // For partner users, only return OEMs they have access to
        const allowedOemIds = req.user.allowedOemIds || [];
        oems = oems.filter(oem => allowedOemIds.includes(oem.id));
      }
      
      // Get counts for each OEM (only for super admins)
      if (req.user?.role === 'SUPER_ADMIN') {
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
      } else {
        // For partner users, return basic OEM info without counts
        res.json(oems);
      }
    } catch (error) {
      console.error("Get OEMs error:", error);
      res.status(500).json({ error: "Failed to fetch OEMs" });
    }
  });

  // Get individual OEM by ID
  app.get("/api/oems/:id", authenticate, requireRole(['SUPER_ADMIN', 'PARTNER_ADMIN', 'PARTNER_STAFF']), async (req, res) => {
    try {
      const { id } = req.params;
      const oem = await storage.getOem(id);
      
      if (!oem) {
        return res.status(404).json({ error: "OEM not found" });
      }
      
      // Check access for partner users
      if (req.user?.role === 'PARTNER_ADMIN' || req.user?.role === 'PARTNER_STAFF') {
        const allowedOemIds = req.user.allowedOemIds || [];
        if (!allowedOemIds.includes(id)) {
          return res.status(403).json({ error: "Access denied to this OEM" });
        }
      }
      
      res.json(oem);
    } catch (error) {
      console.error("Get OEM error:", error);
      res.status(500).json({ error: "Failed to fetch OEM" });
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
      // Disable caching to ensure fresh data
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
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

  app.get("/api/work-orders/:id", authenticate, async (req, res) => {
    try {
      // Disable caching to ensure fresh data
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const workOrder = await storage.getWorkOrder(req.params.id);
      
      if (!workOrder) {
        return res.status(404).json({ error: "Work order not found" });
      }

      // Check access permissions based on user role with proper OEM tenant isolation
      const selectedOemId = req.headers['x-oem-id'] as string;
      let hasAccess = false;
      
      // SUPER_ADMIN can access any work order
      if (req.user!.role === 'SUPER_ADMIN') {
        hasAccess = true;
      } else if (req.user!.role === 'PARTNER_ADMIN' || req.user!.role === 'PARTNER_STAFF') {
        // Partner users can access work orders for job cards assigned to them
        // Check if there's a job card for this work order assigned to their partner
        const jobCards = await storage.getJobCards({ 
          workOrderId: req.params.id, 
          partnerId: req.user!.partnerId 
        });
        hasAccess = jobCards.length > 0;
      } else if (req.user!.role === 'OEM_ADMIN') {
        // OEM admins can access work orders within their OEM
        hasAccess = workOrder.oemId === req.user!.oemId;
      } else if (req.user!.role === 'DEALERSHIP_ADMIN') {
        // Dealership admins can access work orders from their dealership
        hasAccess = workOrder.dealershipId === req.user!.dealershipId;
      } else if (req.user!.role === 'SHOWROOM_MANAGER' || req.user!.role === 'SALES_PERSON') {
        // Showroom staff can access work orders from their showroom
        hasAccess = workOrder.showroomId === req.user!.showroomId;
      }

      if (!hasAccess) {
        console.log(`Access denied: workOrder.oemId=${workOrder.oemId}, user.oemId=${req.user!.oemId}, user.role=${req.user!.role}, user.partnerId=${req.user!.partnerId}`);
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

  // Job Card Assignment Route
  app.put("/api/job-cards/:id/assign", 
    authenticate, 
    requireRole(['PARTNER_ADMIN', 'PARTNER_STAFF']),
    auditLog('job_card', 'assign'),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        // Validate request body
        const bodySchema = z.object({
          assignedInstallerId: z.string().uuid()
        });
        const { assignedInstallerId } = bodySchema.parse(req.body);
        
        // Fetch the job card first to verify ownership
        const jobCard = await storage.getJobCard(id);
        if (!jobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }
        
        // Multi-tenant security: Ensure user can only assign job cards from their partner
        if (req.user!.partnerId !== jobCard.partnerId) {
          return res.status(403).json({ error: "Access denied" });
        }
        
        // Verify assigned installer belongs to the same partner and is active
        const assignedInstaller = await storage.getUser(assignedInstallerId);
        if (!assignedInstaller || assignedInstaller.partnerId !== req.user!.partnerId || !assignedInstaller.isActive || assignedInstaller.role !== 'PARTNER_STAFF') {
          return res.status(400).json({ error: "Invalid installer assignment" });
        }
        
        const updatedJobCard = await storage.updateJobCard(id, { assignedInstallerId });
        res.json(updatedJobCard);
      } catch (error) {
        console.error("Assign job card error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid request data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to assign job card" });
      }
    }
  );

  // Job Card Routes
  app.get("/api/job-cards", 
    authenticate, 
    requireRole(['PARTNER_ADMIN', 'PARTNER_STAFF', 'SHOWROOM_MANAGER', 'SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SALES_PERSON']),
    async (req, res) => {
    try {
      // Disable HTTP caching for real-time job card updates
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const { status, limit = 50, offset = 0 } = req.query;
      
      const filters: any = {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      };

      // Apply role-based filtering with proper OEM tenant isolation
      const selectedOemId = req.headers['x-oem-id'] as string;
      
      if (req.user!.role === 'PARTNER_ADMIN' || req.user!.role === 'PARTNER_STAFF') {
        // Partner users can only see their own job cards
        if (!req.user!.partnerId) {
          return res.status(400).json({ error: "Partner user must have partnerId" });
        }
        filters.partnerId = req.user!.partnerId;
        
        console.log(`🔍 Partner ${req.user!.partnerId} requesting job cards with OEM filter: ${selectedOemId || 'NONE'}`);
        console.log(`🔍 Current filters:`, filters);
        
        // Validate OEM access for partners using partner-OEM mappings
        if (selectedOemId) {
          // Check if partner has access to this OEM
          const hasOemAccess = await storage.checkPartnerOemAccess(req.user!.partnerId, selectedOemId);
          if (!hasOemAccess) {
            return res.status(403).json({ error: "Access denied to this OEM" });
          }
          filters.oemId = selectedOemId;
        } else {
          // NEW: If no OEM selected, show ALL partner job cards without OEM filtering
          console.log(`✅ No OEM filter - showing ALL job cards for partner ${req.user!.partnerId}`);
          // Don't add any oemId filter - let partner see all their allocated job cards
        }
      } else if (req.user!.role === 'SHOWROOM_MANAGER' || req.user!.role === 'SALES_PERSON') {
        // Showroom managers and sales persons see job cards for their showroom
        if (!req.user!.showroomId) {
          return res.status(400).json({ error: "User must have showroomId" });
        }
        filters.showroomId = req.user!.showroomId;
        
        // Always enforce user's OEM for single-OEM roles
        filters.oemId = req.user!.oemId;
        
        // Validate if selected OEM header matches user's OEM
        if (selectedOemId && selectedOemId !== req.user!.oemId) {
          return res.status(400).json({ error: "OEM mismatch: user belongs to different OEM" });
        }
      } else if (req.user!.role === 'DEALERSHIP_ADMIN') {
        // Dealership admins see job cards for their dealership
        if (!req.user!.dealershipId) {
          return res.status(400).json({ error: "Dealership admin must have dealershipId" });
        }
        filters.dealershipId = req.user!.dealershipId;
        
        // Always enforce user's OEM for single-OEM roles
        filters.oemId = req.user!.oemId;
        
        // Validate if selected OEM header matches user's OEM
        if (selectedOemId && selectedOemId !== req.user!.oemId) {
          return res.status(400).json({ error: "OEM mismatch: user belongs to different OEM" });
        }
      } else if (req.user!.role === 'OEM_ADMIN') {
        // OEM admins see job cards only for their OEM
        filters.oemId = req.user!.oemId;
      } else if (req.user!.role === 'SUPER_ADMIN') {
        // Super admins see all job cards within the selected OEM context
        if (selectedOemId) {
          filters.oemId = selectedOemId;
        }
        // If no OEM selected, they see all job cards (global view)
      }
      
      if (status) filters.status = status as string;

      console.log(`🎯 Final filters for job cards query:`, filters);
      const jobCards = await storage.getJobCards(filters);
      console.log(`📋 Returned ${jobCards.length} job cards for partner`);
      res.json(jobCards);
    } catch (error) {
      console.error("Get job cards error:", error);
      res.status(500).json({ error: "Failed to fetch job cards" });
    }
  });

  // Get individual job card with related data (workOrder, partner)
  app.get("/api/job-cards/:id", 
    authenticate,
    requireRole(['PARTNER_ADMIN', 'PARTNER_STAFF', 'SHOWROOM_MANAGER', 'SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SALES_PERSON']),
    async (req, res) => {
      try {
        // Disable caching to ensure fresh data
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
        const jobCardId = req.params.id;
        
        // Get basic job card first
        const jobCard = await storage.getJobCard(jobCardId);
        if (!jobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }

        // Check access permissions first
        const selectedOemId = req.headers['x-oem-id'] as string;
        let hasAccess = false;
        
        // SUPER_ADMIN can access any job card
        if (req.user!.role === 'SUPER_ADMIN') {
          hasAccess = true;
        } else if (req.user!.role === 'PARTNER_ADMIN' || req.user!.role === 'PARTNER_STAFF') {
          // Partner users can access job cards assigned to them
          hasAccess = jobCard.partnerId === req.user!.partnerId;
        } else {
          // For other roles, get work order to check access
          const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
          if (workOrder) {
            if (req.user!.role === 'OEM_ADMIN') {
              hasAccess = workOrder.oemId === req.user!.oemId;
            } else if (req.user!.role === 'DEALERSHIP_ADMIN') {
              hasAccess = workOrder.dealershipId === req.user!.dealershipId;
            } else if (req.user!.role === 'SHOWROOM_MANAGER' || req.user!.role === 'SALES_PERSON') {
              hasAccess = workOrder.showroomId === req.user!.showroomId;
            }
          }
        }

        if (!hasAccess) {
          console.log(`Access denied: job card ${jobCardId}, user.role=${req.user!.role}, user.partnerId=${req.user!.partnerId}`);
          return res.status(403).json({ error: "Access denied" });
        }

        // Get related data
        const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
        const partner = await storage.getPartner(jobCard.partnerId);
        
        if (!workOrder || !partner) {
          return res.status(404).json({ error: "Related data not found" });
        }

        // Get additional related data
        const vehicleModel = await storage.getVehicleModel(workOrder.vehicleModelId);
        const service = await storage.getService(workOrder.serviceId);
        const showroom = await storage.getShowroom(workOrder.showroomId);
        const oem = await storage.getOem(workOrder.oemId);
        
        // Get job card media
        const media = await storage.getJobCardMedia({ jobCardId: jobCard.id });

        // Build the response with the expected structure
        const result = {
          ...jobCard,
          workOrder: {
            ...workOrder,
            vehicleModel: vehicleModel ? {
              modelName: vehicleModel.modelName,
              brand: { name: oem?.name || 'Unknown' }
            } : { modelName: 'Unknown', brand: { name: 'Unknown' } },
            service: service ? {
              name: service.name,
              description: service.description
            } : { name: 'Unknown', description: '' },
            showroom: showroom ? {
              name: showroom.name,
              address: showroom.address,
              city: showroom.city,
              state: showroom.state,
              contactPerson: showroom.contactPersonName,
              phone: showroom.contactPersonPhone,
              email: showroom.contactPersonEmail
            } : { name: 'Unknown' }
          },
          partner: {
            id: partner.id,
            displayName: partner.displayName
          },
          media: media || []
        };

        res.json(result);
      } catch (error) {
        console.error("Get job card error:", error);
        res.status(500).json({ error: "Failed to fetch job card" });
      }
    }
  );

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



  // Job Card Approval endpoint
  app.post("/api/job-cards/:id/approve",
    authenticate,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'SHOWROOM_MANAGER', 'DEALERSHIP_ADMIN']),
    auditLog('job_card', 'approve'),
    async (req, res) => {
      try {
        const jobCardId = req.params.id;
        
        // Get job card first to check access
        const jobCard = await storage.getJobCard(jobCardId);
        if (!jobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }

        // Get work order to verify access permissions
        const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
        if (!workOrder) {
          return res.status(404).json({ error: "Associated work order not found" });
        }

        // Check if user has permission to approve this job card
        let hasAccess = false;
        if (req.user!.role === 'SUPER_ADMIN') {
          hasAccess = true;
        } else if (req.user!.role === 'OEM_ADMIN') {
          hasAccess = workOrder.oemId === req.user!.oemId;
        } else if (req.user!.role === 'DEALERSHIP_ADMIN') {
          hasAccess = workOrder.dealershipId === req.user!.dealershipId;
        } else if (req.user!.role === 'SHOWROOM_MANAGER') {
          hasAccess = workOrder.showroomId === req.user!.showroomId;
        }

        if (!hasAccess) {
          return res.status(403).json({ error: "Access denied - insufficient permissions" });
        }

        // Update job card status to COMPLETED
        const updatedJobCard = await storage.updateJobCard(jobCardId, {
          status: 'COMPLETED',
          completedAt: new Date()
        });


        if (!updatedJobCard) {
          return res.status(500).json({ error: "Failed to approve job card" });
        }

        // Update existing payout with NEW UNIFIED pricing logic during approval
        let payoutAmount = '0.00';
        try {
          // Check for existing payout (should exist from completion step)
          const existingPayouts = await storage.getPayouts({ jobCardId });
          
          if (existingPayouts.length === 0) {
            console.error(`⚠️ No payout found for job card ${jobCardId} during approval - this should not happen`);
            // Don't create here - payout should have been created during completion
          } else {
            // 🚀 FIXED: Use NEW UNIFIED PRICING LOGIC (same as JobCardService)
            // Get service details for category-based pricing
            const service = await storage.getService(workOrder.serviceId);
            const serviceCategoryId = service?.serviceCategoryId || null;

            if (serviceCategoryId) {
              const pricingResult = await storage.resolvePayoutPricing(
                jobCard.partnerId,       // partnerId (FIRST)
                serviceCategoryId,       // serviceCategoryId (SECOND)  
                workOrder.vehicleModelId // vehicleModelId (THIRD)
              );

              if (pricingResult) {
                payoutAmount = pricingResult.amount;
                console.log(`🚀 NEW UNIFIED APPROVAL PRICING: ₹${payoutAmount} using rule ${pricingResult.ruleId}`);
              } else {
                console.log(`⚠️ No pricing rule found with NEW logic - payout marked as pending review`);
                payoutAmount = '0.00';
              }
            } else {
              console.log(`⚠️ No service category found for pricing calculation`);
              payoutAmount = '0.00';
            }

            // Update existing payout with NEW status and correct pricing
            const existingPayout = existingPayouts[0];
            await storage.updatePayout(existingPayout.id, {
              grossAmount: payoutAmount,
              netAmount: payoutAmount,
              status: payoutAmount !== '0.00' ? 'due' : 'pending_review'  // NEW STATUS PROGRESSION
            });

            console.log(`✅ UNIFIED APPROVAL: Updated payout to ₹${payoutAmount} (${payoutAmount !== '0.00' ? 'due' : 'pending_review'}) for job card ${jobCardId}`);
          }
        } catch (payoutError) {
          console.error("Failed to update payout for job card:", payoutError);
          // Don't fail the approval if payout update fails
        }

        // Send email notification to partner about approval
        try {
          const partner = await storage.getPartner(jobCard.partnerId);
          if (partner?.email) {
            await emailService.sendJobCardApprovalNotification(
              partner.email,
              {
                jobCardId: updatedJobCard.id,
                workOrderNumber: workOrder.workOrderNumber || workOrder.id.slice(0, 8),
                vehicleDetails: `${workOrder.vehicleModel || 'Vehicle'} ${workOrder.vehicleVariant || ''}`.trim(),
                approvedAt: updatedJobCard.approvedAt || new Date(),
                approvedBy: req.user!.name || req.user!.email,
                payoutAmount: payoutAmount
              }
            );
          }
        } catch (emailError) {
          console.error("Failed to send approval email:", emailError);
          // Don't fail the approval if email fails
        }

        res.json({ message: "Job card approved successfully", jobCard: updatedJobCard });
      } catch (error) {
        console.error("Job card approval error:", error);
        res.status(500).json({ error: "Failed to approve job card" });
      }
    }
  );

  // Job Card Rework Request endpoint
  app.post("/api/job-cards/:id/rework",
    authenticate,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'SHOWROOM_MANAGER', 'DEALERSHIP_ADMIN']),
    auditLog('job_card', 'request_rework'),
    async (req, res) => {
      try {
        const jobCardId = req.params.id;
        const { reason } = req.body;
        
        // Get job card first to check access
        const jobCard = await storage.getJobCard(jobCardId);
        if (!jobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }

        // Get work order to verify access permissions
        const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
        if (!workOrder) {
          return res.status(404).json({ error: "Associated work order not found" });
        }

        // Check if user has permission to request rework for this job card
        let hasAccess = false;
        if (req.user!.role === 'SUPER_ADMIN') {
          hasAccess = true;
        } else if (req.user!.role === 'OEM_ADMIN') {
          hasAccess = workOrder.oemId === req.user!.oemId;
        } else if (req.user!.role === 'DEALERSHIP_ADMIN') {
          hasAccess = workOrder.dealershipId === req.user!.dealershipId;
        } else if (req.user!.role === 'SHOWROOM_MANAGER') {
          hasAccess = workOrder.showroomId === req.user!.showroomId;
        }

        if (!hasAccess) {
          return res.status(403).json({ error: "Access denied - insufficient permissions" });
        }

        // Update job card status to REWORK_REQUIRED
        const updatedJobCard = await storage.updateJobCard(jobCardId, {
          status: 'REWORK_REQUIRED',
          reworkReason: reason || 'Rework requested by admin',
          reworkRequestedAt: new Date()
        });

        if (!updatedJobCard) {
          return res.status(500).json({ error: "Failed to request rework" });
        }

        res.json({ message: "Rework requested successfully", jobCard: updatedJobCard });
      } catch (error) {
        console.error("Job card rework request error:", error);
        res.status(500).json({ error: "Failed to request rework" });
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
      // Validate schedule data
      const scheduleSchema = z.object({
        scheduledAt: z.string().transform((val) => new Date(val))
      });
      
      const { scheduledAt } = scheduleSchema.parse(req.body);

      const jobCard = await storage.updateJobCard(req.params.id, {
        status: 'SCHEDULED',
        scheduledAt
      });
      
      if (!jobCard) {
        return res.status(404).json({ error: "Job card not found" });
      }

      res.json(jobCard);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid schedule data", details: error.errors });
      }
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
      // Validate completion data
      const completionSchema = z.object({
        remarks: z.string().optional(),
        partnerRemarks: z.string().optional(), 
        batchNumbers: z.string().optional(),
        materialConsumptionJson: z.any().optional(), // JSONB field
        checklistJson: z.any().optional() // JSONB field
      });
      
      const validatedData = completionSchema.parse(req.body);
      
      const jobCard = await storage.updateJobCard(req.params.id, {
        status: 'PENDING_APPROVAL',
        completedAt: new Date(),
        approvalRequestedAt: new Date(),
        ...validatedData
      });
      
      if (!jobCard) {
        return res.status(404).json({ error: "Job card not found" });
      }

      // 🚀 AUTO-CREATE DETAILER PAYOUT when job card is completed
      try {
        // Get work order for pricing calculation
        const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
        if (workOrder) {
          // Use the proper detailer pricing resolution
          const pricingResult = await storage.resolveDetailerPricing(
            jobCard.partnerId,        // detailerId
            workOrder.serviceId,      // serviceId
            null,                     // serviceCategoryId
            workOrder.vehicleModelId, // vehicleModelId
            workOrder.dealershipId,   // dealershipId
            workOrder.showroomId      // showroomId
          );

          let payoutAmount = '0.00';
          let payoutStatus: 'pending_review' | 'due' | 'paid' = 'pending_review';

          if (pricingResult) {
            payoutAmount = pricingResult.amount;
            console.log(`✅ Resolved detailer pricing: ₹${payoutAmount} using rule ${pricingResult.ruleId} (${pricingResult.context})`);
          } else {
            console.log(`⚠️ No pricing rule found for detailer payout - marked as pending_review`);
          }

          // Check for existing payout to prevent duplicates
          const existingPayouts = await storage.getPayouts({ jobCardId: req.params.id });
          
          if (existingPayouts.length === 0) {
            // Create detailer payout with resolved pricing
            await storage.createPayout({
              jobCardId: req.params.id,
              partnerId: jobCard.partnerId,
              grossAmount: payoutAmount,
              netAmount: payoutAmount,
              status: payoutStatus
            });
            
            console.log(`✅ Auto-created detailer payout: ₹${payoutAmount} (${payoutStatus}) for job card ${req.params.id}`);
          } else {
            console.log(`⚠️ Payout already exists for job card ${req.params.id}, skipping creation`);
          }
        }
      } catch (payoutError) {
        console.error(`❌ Failed to auto-create detailer payout for job card ${req.params.id}:`, payoutError);
        // Don't fail the completion if payout creation fails
      }

      res.json(jobCard);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid completion data", details: error.errors });
      }
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


  app.post("/api/job-cards/:id/request-rework", 
    authenticate, 
    requireRole(['SHOWROOM_MANAGER', 'DEALERSHIP_ADMIN']),
    async (req, res) => {
      try {
        // Validate rework request data
        const reworkSchema = z.object({
          remarks: z.string().min(1, "Remarks are required for rework requests")
        });
        
        const { remarks } = reworkSchema.parse(req.body);
        
        const jobCard = await storage.updateJobCard(req.params.id, {
          status: 'REWORK_REQUESTED',
          remarks
        });
        
        if (!jobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }

        res.json(jobCard);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid rework request data", details: error.errors });
        }
        console.error("Request rework error:", error);
        res.status(500).json({ error: "Failed to request rework" });
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
        const { serviceCategoryIds, ...partnerData } = req.body;
        const validatedData = insertPartnerSchema.parse(partnerData);
        
        const partner = await storage.createPartner(validatedData);
        
        // Handle service category mappings if provided
        if (serviceCategoryIds && Array.isArray(serviceCategoryIds) && serviceCategoryIds.length > 0) {
          await storage.setPartnerServiceCategories(partner.id, serviceCategoryIds);
        }
        
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

  // Get single partner by ID
  app.get("/api/partners/:id", 
    authenticate, 
    async (req, res) => {
      try {
        const { id } = req.params;
        const selectedOemId = req.headers['x-oem-id'] as string;
        
        const partner = await storage.getPartner(id);
        
        if (!partner) {
          return res.status(404).json({ error: "Partner not found" });
        }
        
        // Role-based access control with OEM tenant isolation
        let hasAccess = false;
        
        if (req.user!.role === 'SUPER_ADMIN') {
          hasAccess = true; // Super admin can access all partners
        } else if (req.user!.role === 'PARTNER_ADMIN' || req.user!.role === 'PARTNER_STAFF') {
          // Partner users can only access their own partner data
          hasAccess = req.user!.partnerId === id;
        } else if (req.user!.role === 'OEM_ADMIN' || req.user!.role === 'DEALERSHIP_ADMIN' || 
                   req.user!.role === 'SHOWROOM_MANAGER' || req.user!.role === 'SALES_PERSON') {
          // OEM stakeholders can access partner data within their OEM context
          if (selectedOemId) {
            // Verify partner has access to this OEM
            hasAccess = await storage.checkPartnerOemAccess(id, selectedOemId);
          } else {
            // Default to user's OEM for single-OEM roles
            const userOemId = req.user!.oemId;
            if (userOemId) {
              hasAccess = await storage.checkPartnerOemAccess(id, userOemId);
            }
          }
        }
        
        if (!hasAccess) {
          return res.status(403).json({ error: "Access denied to this partner" });
        }
        
        res.json(partner);
      } catch (error) {
        console.error("Get partner error:", error);
        res.status(500).json({ error: "Failed to fetch partner" });
      }
    }
  );

  app.put("/api/partners/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    auditLog('partner', 'update'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { serviceCategoryIds, ...partnerData } = req.body;
        const validatedData = insertPartnerSchema.partial().parse(partnerData);
        
        const partner = await storage.updatePartner(id, validatedData);
        if (!partner) {
          return res.status(404).json({ error: "Partner not found" });
        }
        
        // Handle service category mappings if provided
        if (serviceCategoryIds !== undefined && Array.isArray(serviceCategoryIds)) {
          await storage.setPartnerServiceCategories(partner.id, serviceCategoryIds);
        }
        
        res.json(partner);
      } catch (error) {
        console.error("Update partner error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid partner data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to update partner" });
      }
    }
  );

  // Partner service categories routes
  app.get("/api/partners/:id/service-categories", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    async (req, res) => {
      try {
        const { id } = req.params;
        const categoryIds = await storage.getPartnerServiceCategories(id);
        res.json({ serviceCategoryIds: categoryIds });
      } catch (error) {
        console.error("Get partner service categories error:", error);
        res.status(500).json({ error: "Failed to fetch partner service categories" });
      }
    }
  );

  app.get("/api/partners-with-categories", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    async (req, res) => {
      try {
        const partners = await storage.getPartnersWithCategories();
        res.json(partners);
      } catch (error) {
        console.error("Get partners with categories error:", error);
        res.status(500).json({ error: "Failed to fetch partners with categories" });
      }
    }
  );

  // Partner Staff Management Routes
  app.get("/api/partners/:partnerId/staff", 
    authenticate, 
    requireRole(['PARTNER_ADMIN']),
    async (req, res) => {
      try {
        const { partnerId } = req.params;
        
        // Ensure partner admin can only access their own partner's staff
        if (req.user!.role === 'PARTNER_ADMIN' && req.user!.partnerId !== partnerId) {
          return res.status(403).json({ error: "Access denied" });
        }
        
        const staff = await storage.getPartnerStaff(partnerId);
        res.json(staff);
      } catch (error) {
        console.error("Get partner staff error:", error);
        res.status(500).json({ error: "Failed to fetch partner staff" });
      }
    }
  );

  app.post("/api/partners/:partnerId/staff",
    authenticate,
    requireRole(['PARTNER_ADMIN']),
    auditLog('partner_staff', 'create'),
    async (req, res) => {
      try {
        const { partnerId } = req.params;
        
        // Ensure partner admin can only add staff to their own partner
        if (req.user!.role === 'PARTNER_ADMIN' && req.user!.partnerId !== partnerId) {
          return res.status(403).json({ error: "Access denied" });
        }

        // Basic validation schema for staff
        const staffSchema = z.object({
          name: z.string().min(1, "Name is required"),
          email: z.string().email("Valid email is required"),
          phone: z.string().optional(),
          password: z.string().min(6, "Password must be at least 6 characters")
        });

        const validatedData = staffSchema.parse(req.body);
        
        // Hash the password securely before storing

        const hashedPassword = await bcrypt.hash(validatedData.password, 12);
        
        // Prepare data for storage with hashed password
        const staffDataForStorage = {
          name: validatedData.name,
          email: validatedData.email,
          phone: validatedData.phone,
          passwordHash: hashedPassword
        };
        
        const newStaff = await storage.createPartnerStaff(partnerId, staffDataForStorage);
        res.status(201).json(newStaff);
      } catch (error) {
        console.error("Create partner staff error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid staff data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to create staff member" });
      }
    }
  );

  app.put("/api/partners/:partnerId/staff/:staffId",
    authenticate,
    requireRole(['PARTNER_ADMIN']),
    auditLog('partner_staff', 'update'),
    async (req, res) => {
      try {
        const { partnerId, staffId } = req.params;
        
        // Ensure partner admin can only update their own partner's staff
        if (req.user!.role === 'PARTNER_ADMIN' && req.user!.partnerId !== partnerId) {
          return res.status(403).json({ error: "Access denied" });
        }

        // Basic validation schema for staff updates
        const staffUpdateSchema = z.object({
          name: z.string().min(1).optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          isActive: z.boolean().optional()
        });

        const validatedData = staffUpdateSchema.parse(req.body);
        
        const updatedStaff = await storage.updatePartnerStaff(staffId, validatedData);
        if (!updatedStaff) {
          return res.status(404).json({ error: "Staff member not found" });
        }
        
        res.json(updatedStaff);
      } catch (error) {
        console.error("Update partner staff error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid staff data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to update staff member" });
      }
    }
  );

  app.delete("/api/partners/:partnerId/staff/:staffId",
    authenticate,
    requireRole(['PARTNER_ADMIN']),
    auditLog('partner_staff', 'delete'),
    async (req, res) => {
      try {
        const { partnerId, staffId } = req.params;
        
        // Ensure partner admin can only delete their own partner's staff
        if (req.user!.role === 'PARTNER_ADMIN' && req.user!.partnerId !== partnerId) {
          return res.status(403).json({ error: "Access denied" });
        }
        
        const deleted = await storage.deletePartnerStaff(staffId);
        if (!deleted) {
          return res.status(404).json({ error: "Staff member not found" });
        }
        
        res.json({ message: "Staff member deleted successfully" });
      } catch (error) {
        console.error("Delete partner staff error:", error);
        res.status(500).json({ error: "Failed to delete staff member" });
      }
    }
  );

  // Payout & Earnings Management for Partner Staff
  app.get("/api/partner-staff/payouts",
    authenticate,
    requireRole(['PARTNER_STAFF', 'PARTNER_ADMIN']),
    async (req, res) => {
      try {
        const user = req.user!;
        let partnerId = user.partnerId;

        // For partner staff, get their own partner's payouts
        // For partner admin, they can see all their partner's payouts
        if (!partnerId) {
          return res.status(400).json({ error: "Partner ID required" });
        }

        const payouts = await storage.getPartnerPayouts(partnerId);
        res.json(payouts);
      } catch (error) {
        console.error("Get partner payouts error:", error);
        res.status(500).json({ error: "Failed to fetch payouts" });
      }
    }
  );

  app.get("/api/partner-staff/earnings-summary",
    authenticate,
    requireRole(['PARTNER_STAFF', 'PARTNER_ADMIN']),
    async (req, res) => {
      try {
        const user = req.user!;
        let partnerId = user.partnerId;

        if (!partnerId) {
          return res.status(400).json({ error: "Partner ID required" });
        }

        const summary = await storage.getPartnerEarningsSummary(partnerId);
        res.json(summary);
      } catch (error) {
        console.error("Get earnings summary error:", error);
        res.status(500).json({ error: "Failed to fetch earnings summary" });
      }
    }
  );

  app.get("/api/partner-staff/service-rates",
    authenticate,
    requireRole(['PARTNER_STAFF', 'PARTNER_ADMIN']),
    async (req, res) => {
      try {
        const user = req.user!;
        let partnerId = user.partnerId;

        if (!partnerId) {
          return res.status(400).json({ error: "Partner ID required" });
        }

        const serviceRates = await storage.getPartnerServiceRates(partnerId);
        res.json(serviceRates);
      } catch (error) {
        console.error("Get service rates error:", error);
        res.status(500).json({ error: "Failed to fetch service rates" });
      }
    }
  );

  // Partner Payout Settlement - Allow partners to settle their own payouts  
  app.post("/api/partner-staff/payouts/:id/settle",
    authenticate,
    requireRole(['PARTNER_STAFF', 'PARTNER_ADMIN']),
    async (req, res) => {
      try {
        const { id } = req.params;
        const user = req.user!;
        
        // Get payment reference from request body
        const { paymentReference } = req.body;
        
        // Verify the payout exists and belongs to this partner
        const payout = await storage.getPayout(id);
        if (!payout) {
          return res.status(404).json({ error: "Payout not found" });
        }
        
        // Security check: Partner can only settle their own payouts
        if (payout.partnerId !== user.partnerId) {
          return res.status(403).json({ error: "Access denied - you can only settle your own payouts" });
        }
        
        // Check if already settled
        if (payout.status === 'paid') {
          return res.json({ message: "Payout already settled", payout });
        }
        
        // Check if payout is due (can only settle due payouts)
        if (payout.status !== 'due') {
          return res.status(400).json({ error: "Payout must be in 'due' status to be settled" });
        }
        
        // Settle the payout
        const success = await storage.settlePayout(id, {
          paymentReference: paymentReference || `PAY-${Date.now()}`,
          settledAt: new Date(),
          settledBy: user.id
        });
        
        if (success) {
          res.json({ message: "Payout settled successfully" });
        } else {
          res.status(500).json({ error: "Failed to settle payout" });
        }
      } catch (error) {
        console.error("Partner settle payout error:", error);
        res.status(500).json({ error: "Failed to settle payout" });
      }
    }
  );

  // Pricing Rules Routes
  app.get("/api/pricing-rules", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { partnerId, scopeId, pricingType, dealershipId, detailerId, serviceCategoryId } = req.query;
      
      const filters: any = {};
      if (partnerId) filters.partnerId = partnerId as string;
      if (scopeId) filters.scopeId = scopeId as string;
      if (pricingType) filters.pricingType = pricingType as string;
      if (dealershipId) filters.dealershipId = dealershipId as string;
      if (detailerId) filters.detailerId = detailerId as string;
      if (serviceCategoryId) filters.serviceCategoryId = serviceCategoryId as string;

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
        
        // Note: pricingService import would need to be added at top if needed
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
        
        // Note: pricingService import would need to be added at top if needed
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

  app.get("/api/allocations-with-categories", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { partnerId, level, levelId } = req.query;
      
      const filters: any = {};
      if (partnerId) filters.partnerId = partnerId as string;
      if (level) filters.level = level as string;
      if (levelId) filters.levelId = levelId as string;

      const allocations = await storage.getAllocationsWithCategories(filters);
      res.json(allocations);
    } catch (error) {
      console.error("Get allocations with categories error:", error);
      res.status(500).json({ error: "Failed to fetch allocations with categories" });
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

  // Payout Settlement Routes
  app.get("/api/payouts", 
    authenticate, 
    requireOEMAccess,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    async (req, res) => {
      try {
        const { status, partnerId } = req.query;
        const payouts = await storage.getPayouts({ 
          status: status as string,
          partnerId: partnerId as string,
          oemId: req.user!.oemId, // Add tenant scoping
          dealershipId: req.user!.dealershipId,
          showroomId: req.user!.showroomId
        });
        res.json(payouts);
      } catch (error) {
        console.error("Get payouts error:", error);
        res.status(500).json({ error: "Failed to fetch payouts" });
      }
    }
  );

  app.get("/api/commissions-for-settlement", 
    authenticate, 
    requireOEMAccess,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    async (req, res) => {
      try {
        const { status, salesPersonId, showroomId } = req.query;
        const commissions = await storage.getCommissions({ 
          status: status as string,
          salesPersonId: salesPersonId as string,
          showroomId: showroomId as string,
          oemId: req.user!.oemId, // Add tenant scoping
          dealershipId: req.user!.dealershipId
        });
        res.json(commissions);
      } catch (error) {
        console.error("Get commissions error:", error);
        res.status(500).json({ error: "Failed to fetch commissions" });
      }
    }
  );

  // NEW: Payout approval endpoint (pending_review → due)
  app.post("/api/payouts/:id/approve", 
    authenticate, 
    requireOEMAccess,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    auditLog('payout', 'approve'),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        // Get payout to verify status
        const payout = await storage.getPayout(id);
        if (!payout) {
          return res.status(404).json({ error: "Payout not found" });
        }
        
        // Check tenant access permissions
        if (!storage.canUserAccessPayout(req.user!, payout)) {
          return res.status(403).json({ error: "Access denied - insufficient permissions" });
        }
        
        // Update status to 'due'
        const updatedPayout = await storage.updatePayout(id, {
          status: 'due'
        });
        
        res.json(updatedPayout);
      } catch (error) {
        console.error("Approve payout error:", error);
        res.status(500).json({ error: "Failed to approve payout" });
      }
    }
  );

  app.post("/api/payouts/:id/settle", 
    authenticate, 
    requireOEMAccess,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    auditLog('payout', 'settle'),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        // Validate request body using Zod schema
        const validatedData = payoutSettlementSchema.parse(req.body);
        
        // Verify ownership before settlement
        const payout = await storage.getPayout(id);
        if (!payout) {
          return res.status(404).json({ error: "Payout not found" });
        }
        
        // Check tenant access permissions
        if (!storage.canUserAccessPayout(req.user!, payout)) {
          return res.status(403).json({ error: "Access denied - insufficient permissions" });
        }
        
        // Check if already settled (idempotent operation)
        if (payout.status === 'PAID') {
          return res.json({ message: "Payout already settled", payout });
        }
        
        const success = await storage.settlePayout(id, {
          paymentReference: validatedData.paymentReference,
          settledAt: validatedData.settledAt,
          settledBy: req.user!.id
        });
        
        if (success) {
          res.json({ message: "Payout settled successfully" });
        } else {
          res.status(404).json({ error: "Payout not found" });
        }
      } catch (error) {
        console.error("Settle payout error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid settlement data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to settle payout" });
      }
    }
  );

  app.post("/api/commissions/:id/settle", 
    authenticate, 
    requireOEMAccess,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    auditLog('commission', 'settle'),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        // Validate request body using Zod schema
        const validatedData = payoutSettlementSchema.parse(req.body);
        
        // Verify ownership before settlement
        const commission = await storage.getCommission(id);
        if (!commission) {
          return res.status(404).json({ error: "Commission not found" });
        }
        
        // Check tenant access permissions
        if (!storage.canUserAccessCommission(req.user!, commission)) {
          return res.status(403).json({ error: "Access denied - insufficient permissions" });
        }
        
        // Check if already settled (idempotent operation)
        if (commission.status === 'PAID') {
          return res.json({ message: "Commission already settled", commission });
        }
        
        const success = await storage.settleCommission(id, {
          paymentReference: validatedData.paymentReference,
          settledAt: validatedData.settledAt,
          settledBy: req.user!.id
        });
        
        if (success) {
          res.json({ message: "Commission settled successfully" });
        } else {
          res.status(404).json({ error: "Commission not found" });
        }
      } catch (error) {
        console.error("Settle commission error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid settlement data", details: error.errors });
        }
        res.status(500).json({ error: "Failed to settle commission" });
      }
    }
  );

  // Commission Rules Routes
  app.get("/api/commission-rules", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { oemId, dealershipId, showroomId, salesPersonId } = req.query;
      
      const filters: any = {};
      if (oemId) filters.oemId = oemId as string;
      if (dealershipId) filters.dealershipId = dealershipId as string;
      if (showroomId) filters.showroomId = showroomId as string;
      if (salesPersonId) filters.salesPersonId = salesPersonId as string;
      
      // Apply user context filtering based on role
      if (req.user!.showroomId && !filters.showroomId) {
        filters.showroomId = req.user!.showroomId;
      }

      const rules = await storage.getCommissionRulesWithContext(filters);
      res.json(rules);
    } catch (error) {
      console.error("Get commission rules error:", error);
      res.status(500).json({ error: "Failed to fetch commission rules" });
    }
  });

  app.post("/api/commission-rules", 
    authenticate, 
    requireOEMAccess,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    auditLog('commission_rule', 'create'),
    async (req, res) => {
      try {
        // Convert date strings to Date objects before validation
        const bodyData = { ...req.body };
        if (bodyData.effectiveFrom) {
          bodyData.effectiveFrom = new Date(bodyData.effectiveFrom);
        }
        if (bodyData.effectiveTo) {
          bodyData.effectiveTo = new Date(bodyData.effectiveTo);
        }
        
        const ruleData = insertCommissionRuleSchema.parse(bodyData);
        
        // Strict tenant boundary validation and role-based scoping
        const userRole = req.user!.role;
        
        if (userRole === 'SHOWROOM_MANAGER' && req.user!.showroomId) {
          // Showroom managers can only create showroom-level rules for their showroom
          ruleData.oemId = undefined;
          ruleData.dealershipId = undefined;
          ruleData.showroomId = req.user!.showroomId;
        } else if (userRole === 'DEALERSHIP_ADMIN' && req.user!.dealershipId) {
          // Dealership admins can only create rules within their dealership
          ruleData.oemId = undefined;
          
          // Validate showroom belongs to their dealership if specified
          if (ruleData.showroomId) {
            const showroom = await storage.getShowroom(ruleData.showroomId);
            if (!showroom || showroom.dealershipId !== req.user!.dealershipId) {
              return res.status(403).json({ error: "Cannot create rules for showrooms outside your dealership" });
            }
          } else if (!ruleData.dealershipId) {
            ruleData.dealershipId = req.user!.dealershipId;
          } else if (ruleData.dealershipId !== req.user!.dealershipId) {
            return res.status(403).json({ error: "Cannot create rules for other dealerships" });
          }
        } else if (userRole === 'OEM_ADMIN' && req.user!.oemId) {
          // OEM admins can only create rules within their OEM
          
          // Validate dealership belongs to their OEM if specified
          if (ruleData.dealershipId) {
            const dealership = await storage.getDealership(ruleData.dealershipId);
            if (!dealership || dealership.oemId !== req.user!.oemId) {
              return res.status(403).json({ error: "Cannot create rules for dealerships outside your OEM" });
            }
          }
          
          // Validate showroom belongs to their OEM if specified
          if (ruleData.showroomId) {
            const showroom = await storage.getShowroom(ruleData.showroomId);
            if (!showroom) {
              return res.status(403).json({ error: "Showroom not found" });
            }
            const dealership = await storage.getDealership(showroom.dealershipId);
            if (!dealership || dealership.oemId !== req.user!.oemId) {
              return res.status(403).json({ error: "Cannot create rules for showrooms outside your OEM" });
            }
          }
          
          // Default to OEM level if no specific level provided
          if (!ruleData.oemId && !ruleData.dealershipId && !ruleData.showroomId) {
            ruleData.oemId = req.user!.oemId;
          } else if (ruleData.oemId && ruleData.oemId !== req.user!.oemId) {
            return res.status(403).json({ error: "Cannot create rules for other OEMs" });
          }
        }
        // SUPER_ADMIN has no restrictions but still needs tenant validation in storage layer

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

  // Update commission rule
  app.put("/api/commission-rules/:id", 
    authenticate, 
    requireOEMAccess,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    auditLog('commission_rule', 'update'),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        // Convert date strings to Date objects before validation
        const bodyData = { ...req.body };
        if (bodyData.effectiveFrom) {
          bodyData.effectiveFrom = new Date(bodyData.effectiveFrom);
        }
        if (bodyData.effectiveTo) {
          bodyData.effectiveTo = new Date(bodyData.effectiveTo);
        }
        
        // Create a partial schema for updates (without refinements since they may not apply to partial data)
        const baseUpdateSchema = createInsertSchema(commissionRules).omit({
          id: true,
          createdAt: true,
          updatedAt: true
        }).partial();
        
        const updates = baseUpdateSchema.parse(bodyData);
        const updatedRule = await storage.updateCommissionRule(id, updates);
        
        if (!updatedRule) {
          return res.status(404).json({ error: "Commission rule not found" });
        }
        
        res.json(updatedRule);
      } catch (error) {
        console.error("Update commission rule error:", error);
        if (error instanceof Error && error.message.includes("ZodError")) {
          return res.status(400).json({ error: "Invalid commission rule data" });
        }
        res.status(500).json({ error: "Failed to update commission rule" });
      }
    }
  );

  // Delete commission rule
  app.delete("/api/commission-rules/:id", 
    authenticate, 
    requireOEMAccess,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    auditLog('commission_rule', 'delete'),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        const deleted = await storage.deleteCommissionRule(id);
        
        if (!deleted) {
          return res.status(404).json({ error: "Commission rule not found" });
        }
        
        res.json({ success: true, message: "Commission rule deleted successfully" });
      } catch (error) {
        console.error("Delete commission rule error:", error);
        res.status(500).json({ error: "Failed to delete commission rule" });
      }
    }
  );

  // Commission Resolution API
  app.post("/api/commissions/resolve", 
    authenticate, 
    requireOEMAccess,
    async (req, res) => {
      try {
        const { grossAmount, oemId, dealershipId, showroomId, salesPersonId, serviceId, serviceCategoryId } = req.body;
        
        if (!grossAmount || !oemId || !dealershipId || !showroomId) {
          return res.status(400).json({ 
            error: "grossAmount, oemId, dealershipId, and showroomId are required" 
          });
        }

        const result = await storage.calculateCommission(
          Number(grossAmount),
          oemId,
          dealershipId,
          showroomId,
          salesPersonId,
          serviceId,
          serviceCategoryId
        );

        res.json(result);
      } catch (error) {
        console.error("Commission resolution error:", error);
        res.status(500).json({ error: "Failed to resolve commission" });
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

  app.post("/api/job-cards/:id/media", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { mediaUrls, mediaData } = req.body;
      
      // Support both simple URL array and detailed media data array
      if (!mediaUrls && !mediaData) {
        return res.status(400).json({ error: "Media URLs or media data required" });
      }

      const jobCardId = req.params.id;
      const savedMedia = [];

      if (mediaUrls && Array.isArray(mediaUrls)) {
        // Simple URL array for backward compatibility
        for (const mediaUrl of mediaUrls) {
          const media = await storage.insertJobCardMedia({
            jobCardId,
            type: 'IMAGE',
            url: mediaUrl,
            caption: ''
          });
          savedMedia.push(media);
        }
      } else if (mediaData && Array.isArray(mediaData)) {
        // Enhanced media data with captions for 4-side car images
        const validAngles = ['front', 'back', 'left', 'right'];
        
        for (const data of mediaData) {
          // Validate required fields
          if (!data.url) {
            return res.status(400).json({ error: "URL is required for each media item" });
          }
          
          // Validate angle if provided
          if (data.angle && !validAngles.includes(data.angle.toLowerCase())) {
            return res.status(400).json({ 
              error: `Invalid angle. Must be one of: ${validAngles.join(', ')}` 
            });
          }
          
          const media = await storage.insertJobCardMedia({
            jobCardId,
            type: data.type || 'IMAGE',
            url: data.url,
            caption: data.angle || data.caption || ''
          });
          savedMedia.push(media);
        }
      }
      
      res.json({ message: "Media uploaded successfully", media: savedMedia });
    } catch (error) {
      console.error("Upload job card media error:", error);
      res.status(500).json({ error: "Failed to upload media" });
    }
  });

  // File upload route for job cards (using image upload middleware)
  app.post("/api/job-cards/upload-media", 
    authenticate,
    requireOEMAccess,
    imageUpload.single('file'),
    auditLog('job_card_media', 'upload'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const { jobCardId, type = 'IMAGE', caption = '' } = req.body;

        if (!jobCardId) {
          return res.status(400).json({ error: "Job card ID is required" });
        }

        // Generate a safe filename for object storage
        const timestamp = Date.now();
        const safeFilename = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `job-card-media/${jobCardId}/${timestamp}-${safeFilename}`;
        
        // For now, store in a temporary location and return a URL
        // In production, this would upload to object storage via presigned URL
        const mediaUrl = `/api/media/job-cards/${fileName}`;

        // Save media record to database
        const media = await storage.insertJobCardMedia({
          jobCardId,
          type: type.toUpperCase(),
          url: mediaUrl,
          caption
        });

        res.json({ 
          message: "Media uploaded successfully", 
          media,
          url: mediaUrl 
        });
      } catch (error) {
        console.error("Upload job card media error:", error);
        res.status(500).json({ error: "Failed to upload media" });
      }
    }
  );

  // Test route for payout recalculation (development/testing only - SUPER_ADMIN access only)
  if (process.env.NODE_ENV !== 'production') {
    app.post("/api/test/recalculate-payout/:jobCardId", 
      authenticate, 
      requireRole(['SUPER_ADMIN']), // Restrict to SUPER_ADMIN only for security
      auditLog('payout', 'recalculate'),
      async (req, res) => {
        try {
          const { jobCardId } = req.params;
          
          if (!jobCardId) {
            return res.status(400).json({ error: "Job card ID is required" });
          }

          // Validate access to the job card first
          const jobCard = await storage.getJobCard(jobCardId);
          if (!jobCard) {
            return res.status(404).json({ error: "Job card not found" });
          }

          const result = await storage.recalculatePayoutWithPricing(jobCardId);
          res.json(result);
        } catch (error) {
          console.error("Recalculate payout error:", error);
          res.status(500).json({ error: "Failed to recalculate payout" });
        }
      }
    );
  }

  // Password Reset Routes
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      await authService.requestPasswordReset(email);
      
      // Send password reset email
      try {
        const user = await storage.getUserByEmail(email);
        if (user && user.isActive && user.resetToken) {
          await emailService.sendPasswordResetEmail(
            user.email,
            user.resetToken,
            user.name
          );
        }
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
      }

      // Always return success to prevent email enumeration
      res.json({ message: "If that email address is in our database, we will send you a password reset link." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long" });
      }

      const success = await authService.resetPassword(token, newPassword);
      
      if (!success) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.get("/api/auth/validate-reset-token/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      const isValid = await authService.validateResetToken(token);
      
      res.json({ valid: isValid });
    } catch (error) {
      console.error("Validate reset token error:", error);
      res.status(500).json({ error: "Failed to validate token" });
    }
  });

  // Test email endpoint
  app.post("/api/test-email", authenticate, async (req, res) => {
    try {
      const { to, subject, message } = req.body;
      
      if (!to || !subject || !message) {
        return res.status(400).json({ error: "Missing required fields: to, subject, message" });
      }

      const success = await emailService.sendEmail({
        to,
        subject,
        html: `<p>${message}</p>`,
        text: message
      });

      if (success) {
        res.json({ message: "Email sent successfully" });
      } else {
        res.status(500).json({ error: "Failed to send email" });
      }
    } catch (error) {
      console.error("Test email error:", error);
      res.status(500).json({ error: "Failed to send test email" });
    }
  });

  // Send test password reset email directly to jaggi13js@gmail.com
  app.post("/api/test-password-reset", async (req, res) => {
    try {
      const testEmail = "jaggi13js@gmail.com";
      const testToken = "test_token_123456789abcdef";
      
      const success = await emailService.sendPasswordResetEmail(
        testEmail,
        testToken,
        "Test User"
      );

      if (success) {
        res.json({ 
          message: "Test password reset email sent successfully to " + testEmail,
          testToken: testToken,
          note: "This is a test email with test data. In production, use /api/auth/forgot-password"
        });
      } else {
        res.status(500).json({ error: "Failed to send test password reset email" });
      }
    } catch (error) {
      console.error("Test password reset email error:", error);
      res.status(500).json({ error: "Failed to send test password reset email" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
