import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
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
  insertOemRoyaltyRuleSchema,
  insertOemRoyaltyCalculationSchema,
  commissionRules
} from "@shared/schema";
import { storage } from "./storage";
import { authService } from "./auth";
import { emailService } from "./services/email-service";
import { whatsappService } from "./services/whatsapp-service";
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

// Configure multer for image uploads (job card media) - save to disk
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads', 'job-cards');
      // Ensure directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Use timestamp and safe filename
      const timestamp = Date.now();
      const safeFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      cb(null, `${timestamp}-${safeFilename}`);
    }
  }),
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

  // User Routes
  app.get("/api/users", authenticate, requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']), async (req, res) => {
    try {
      const { dealershipId, oemId, showroomId, role } = req.query;
      
      const filters: any = {};
      if (dealershipId) filters.dealershipId = dealershipId as string;
      if (oemId) filters.oemId = oemId as string;
      if (showroomId) filters.showroomId = showroomId as string;
      if (role) filters.role = role as string;
      
      const users = await storage.getUsers(filters);
      res.json(users);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Create user (Super Admin only)
  app.post("/api/users",
    authenticate,
    requireRole(['SUPER_ADMIN']),
    auditLog('user', 'create'),
    async (req, res) => {
      try {
        const { password, ...userData } = req.body;

        // Check if email or phone number already exists
        if (userData.email) {
          const existingUser = await storage.getUserByEmail(userData.email);
          if (existingUser) {
            return res.status(400).json({ error: `Email ${userData.email} is already in use` });
          }
        }

        if (userData.phone) {
          const users = await storage.getUsers();
          const existingUserByPhone = users.find(u => u.phone === userData.phone);
          if (existingUserByPhone) {
            return res.status(400).json({ error: `Phone number ${userData.phone} is already in use` });
          }
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user
        const newUser = await storage.createUser({
          ...userData,
          passwordHash: hashedPassword,
        });

        console.log(`Created user: ${newUser.email} with role ${newUser.role}`);

        res.status(201).json(newUser);
      } catch (error) {
        console.error("Create user error:", error);
        res.status(500).json({ error: "Failed to create user" });
      }
    }
  );

  // Reset user password (Admin only)
  app.post("/api/users/:id/reset-password", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
    auditLog('user', 'reset_password'),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        // Get user to verify they exist
        const user = await storage.getUser(id);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        // Generate temporary password (8 characters: letters + numbers)
        const tempPassword = Math.random().toString(36).slice(-8).toUpperCase();
        
        // Hash the password
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        // Update user password
        await storage.updateUser(id, { passwordHash: hashedPassword });
        
        res.json({ 
          message: "Password reset successfully",
          tempPassword,
          userId: id,
          userEmail: user.email
        });
      } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ error: "Failed to reset password" });
      }
    }
  );

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
            // Check if email or phone number already exists
            if (adminUserData.email) {
              const existingUser = await storage.getUserByEmail(adminUserData.email);
              if (existingUser) {
                return res.status(400).json({ error: `Email ${adminUserData.email} is already in use` });
              }
            }
            
            if (adminUserData.phone) {
              const users = await storage.getUsers();
              const existingUserByPhone = users.find(u => u.phone === adminUserData.phone);
              if (existingUserByPhone) {
                return res.status(400).json({ error: `Phone number ${adminUserData.phone} is already in use` });
              }
            }
    
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
        const { resetPasswordData, ...bodyData } = req.body;
        const oemData = insertOemSchema.partial().parse(bodyData);
        
        // Update OEM data
        const oem = await storage.updateOem(id, oemData);
        
        if (!oem) {
          return res.status(404).json({ error: "OEM not found" });
        }
        
        // Handle password reset if requested
        if (resetPasswordData && resetPasswordData.newPassword) {
          try {
            const bcrypt = await import('bcryptjs');
            const hashedPassword = await bcrypt.hash(resetPasswordData.newPassword, 10);
            
            // Find and update the OEM admin user's password
            await storage.updateUserPasswordByOEM(id, hashedPassword);
            console.log(`Password reset for OEM admin of ${oem.name}`);
          } catch (passwordError) {
            console.error("Failed to reset OEM admin password:", passwordError);
            // Don't fail the OEM update if password reset fails
            return res.status(200).json({ 
              ...oem, 
              warning: "OEM updated but password reset failed" 
            });
          }
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
      
      // Add counts and OEM IDs for each dealership
      const dealershipsWithCounts = await Promise.all(
        dealerships.map(async (dealership) => {
          const showrooms = await storage.getShowrooms(dealership.id);
          const showroomsCount = showrooms.length;
          
          // Count sales staff for this dealership (users with SALES_PERSON role)
          const salesStaff = await storage.getUsers({ dealershipId: dealership.id, role: 'SALES_PERSON' });
          const salesStaffCount = salesStaff ? salesStaff.length : 0;
          
          // Fetch OEM IDs for this dealership
          const oemIds = await storage.getDealershipOems(dealership.id);
          
          return {
            ...dealership,
            oemIds,
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
      
      // Fetch associated OEM IDs
      const oemIds = await storage.getDealershipOems(id);
      
      res.json({ ...dealership, oemIds });
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
        // Extract createUser flag, admin user data, and oemIds
        const { createUser, adminUserData, oemIds, adminOemId, ...dealershipFields } = req.body;
        
        // Validate oemIds array is provided
        if (!oemIds || !Array.isArray(oemIds) || oemIds.length === 0) {
          return res.status(400).json({ error: "At least one OEM must be selected" });
        }
        
        // Add code field derived from dealership name
        const dealershipData = {
          ...dealershipFields,
          code: dealershipFields.name.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000)
        };
        
        // Create the dealership first (without oemId)
        const dealership = await storage.createDealership(dealershipData);
        
        // Create OEM mappings
        await storage.setDealershipOems(dealership.id, oemIds);
        
        // Create admin user if requested
        if (createUser && adminUserData) {
          try {
            // Check if email or phone number already exists
            if (adminUserData.email) {
              const existingUser = await storage.getUserByEmail(adminUserData.email);
              if (existingUser) {
                return res.status(400).json({ error: `Email ${adminUserData.email} is already in use` });
              }
            }
            
            if (adminUserData.phone) {
              const users = await storage.getUsers();
              const existingUserByPhone = users.find(u => u.phone === adminUserData.phone);
              if (existingUserByPhone) {
                return res.status(400).json({ error: `Phone number ${adminUserData.phone} is already in use` });
              }
            }
            
            const hashedPassword = await bcrypt.hash(adminUserData.password, 10);
            
            // Use adminOemId if provided, otherwise use the first OEM from the list
            const userOemId = adminOemId || oemIds[0];
            
            const adminData = {
              name: adminUserData.name,
              email: adminUserData.email,
              phone: adminUserData.phone || '',
              passwordHash: hashedPassword,
              role: 'DEALERSHIP_ADMIN' as const,
              oemId: userOemId, // Link to specified or first OEM
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
        
        // Return dealership with oemIds
        res.status(201).json({ ...dealership, oemIds });
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
        const { resetPasswordData, oemIds, adminOemId, ...dealershipData } = req.body;
        
        // Update dealership data
        const dealership = await storage.updateDealership(id, dealershipData);
        
        if (!dealership) {
          return res.status(404).json({ error: "Dealership not found" });
        }
        
        // Update OEM mappings if oemIds provided
        if (oemIds && Array.isArray(oemIds)) {
          if (oemIds.length === 0) {
            return res.status(400).json({ error: "At least one OEM must be selected" });
          }
          await storage.setDealershipOems(id, oemIds);
        }
        
        // Get current OEM mappings
        const currentOemIds = await storage.getDealershipOems(id);
        
        // Handle password reset if requested
        if (resetPasswordData && resetPasswordData.newPassword) {
          try {
            const bcrypt = await import('bcryptjs');
            const hashedPassword = await bcrypt.hash(resetPasswordData.newPassword, 10);
            
            // Find and update the dealership admin user's password
            await storage.updateUserPasswordByDealership(id, hashedPassword);
            console.log(`Password reset for dealership admin of ${dealership.name}`);
          } catch (passwordError) {
            console.error("Failed to reset dealership admin password:", passwordError);
            // Don't fail the dealership update if password reset fails
            return res.status(200).json({ 
              ...dealership,
              oemIds: currentOemIds,
              warning: "Dealership updated but password reset failed" 
            });
          }
        }
        
        // Handle creating admin user if requested
        if (req.body.createAdminUserData) {
          try {
            const bcrypt = await import('bcryptjs');
            const hashedPassword = await bcrypt.hash(req.body.createAdminUserData.password, 10);
            
            // Use adminOemId if provided, otherwise use the first OEM from current mappings
            const userOemId = adminOemId || currentOemIds[0];
            
            if (!userOemId) {
              return res.status(400).json({ error: "Cannot create admin user: No OEM mappings found" });
            }
            
            const adminData = {
              name: req.body.createAdminUserData.name,
              email: req.body.createAdminUserData.email,
              phone: req.body.createAdminUserData.phone || '',
              passwordHash: hashedPassword,
              role: 'DEALERSHIP_ADMIN' as const,
              oemId: userOemId,
              dealershipId: dealership.id,
              isActive: true
            };
            
            const createdUser = await storage.createUser(adminData);
            console.log(`Created dealership admin user: ${createdUser.email} for ${dealership.name}`);
          } catch (userError) {
            console.error("Failed to create dealership admin user:", userError);
            // Don't fail the dealership update if user creation fails
            return res.status(200).json({ 
              ...dealership,
              oemIds: currentOemIds,
              warning: "Dealership updated but admin user creation failed" 
            });
          }
        }
        
        res.json({ ...dealership, oemIds: currentOemIds });
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
        
        // Validate that the selected OEM exists in the dealership's OEM mappings
        if (showroomFields.dealershipId && showroomFields.oemId) {
          const isValid = await storage.checkDealershipOemMapping(
            showroomFields.dealershipId,
            showroomFields.oemId
          );
          
          if (!isValid) {
            return res.status(400).json({ 
              error: "Selected OEM is not associated with this dealership" 
            });
          }
        }
        
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
            // Check if email or phone number already exists
            if (adminUserData.email) {
              const existingUser = await storage.getUserByEmail(adminUserData.email);
              if (existingUser) {
                return res.status(400).json({ error: `Email ${adminUserData.email} is already in use` });
              }
            }
            
            if (adminUserData.phone) {
              const users = await storage.getUsers();
              const existingUserByPhone = users.find(u => u.phone === adminUserData.phone);
              if (existingUserByPhone) {
                return res.status(400).json({ error: `Phone number ${adminUserData.phone} is already in use` });
              }
            }
            
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

  app.put("/api/showrooms/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
    auditLog('showroom', 'update'),
    async (req, res) => {
      try {
        const { id } = req.params;
        console.log('UPDATE SHOWROOM - Request body:', JSON.stringify(req.body, null, 2));
        const { resetPasswordData, adminUserData, createUser, createAdminUserData, ...showroomData } = req.body;
        console.log('UPDATE SHOWROOM - createUser:', createUser, 'adminUserData:', adminUserData, 'createAdminUserData:', createAdminUserData);
        
        // If updating dealershipId or oemId, validate the mapping
        if ((showroomData.dealershipId || showroomData.oemId)) {
          // Get current showroom to have both values
          const currentShowroom = await storage.getShowroom(id);
          if (!currentShowroom) {
            return res.status(404).json({ error: "Showroom not found" });
          }
          
          const dealershipId = showroomData.dealershipId || currentShowroom.dealershipId;
          const oemId = showroomData.oemId || currentShowroom.oemId;
          
          const isValid = await storage.checkDealershipOemMapping(dealershipId, oemId);
          
          if (!isValid) {
            return res.status(400).json({ 
              error: "Selected OEM is not associated with this dealership" 
            });
          }
        }
        
        // Update showroom data
        const showroom = await storage.updateShowroom(id, showroomData);
        
        if (!showroom) {
          return res.status(404).json({ error: "Showroom not found" });
        }
        
        // Create admin user if requested (for creating new showroom with manager)
        if (createUser && adminUserData) {
          try {
            // Check if email or phone number already exists
            if (adminUserData.email) {
              const existingUser = await storage.getUserByEmail(adminUserData.email);
              if (existingUser) {
                return res.status(400).json({ error: `Email ${adminUserData.email} is already in use` });
              }
            }
            
            if (adminUserData.phone) {
              const users = await storage.getUsers();
              const existingUserByPhone = users.find(u => u.phone === adminUserData.phone);
              if (existingUserByPhone) {
                return res.status(400).json({ error: `Phone number ${adminUserData.phone} is already in use` });
              }
            }
            
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
            // Don't fail the showroom update if user creation fails
            return res.status(200).json({ 
              ...showroom, 
              warning: "Showroom updated but manager user creation failed" 
            });
          }
        }
        
        // Handle creating admin user if requested (for editing existing showrooms without manager)
        if (createAdminUserData) {
          try {
            // Check if email or phone number already exists
            if (createAdminUserData.email) {
              const existingUser = await storage.getUserByEmail(createAdminUserData.email);
              if (existingUser) {
                return res.status(400).json({ error: `Email ${createAdminUserData.email} is already in use` });
              }
            }
            
            if (createAdminUserData.phone) {
              const users = await storage.getUsers();
              const existingUserByPhone = users.find(u => u.phone === createAdminUserData.phone);
              if (existingUserByPhone) {
                return res.status(400).json({ error: `Phone number ${createAdminUserData.phone} is already in use` });
              }
            }
            
            const bcrypt = await import('bcryptjs');
            const hashedPassword = await bcrypt.hash(createAdminUserData.password, 10);
            
            const managerData = {
              name: createAdminUserData.name,
              email: createAdminUserData.email,
              phone: createAdminUserData.phone || '',
              passwordHash: hashedPassword,
              role: 'SHOWROOM_MANAGER' as const,
              oemId: showroom.oemId,
              dealershipId: showroom.dealershipId,
              showroomId: showroom.id,
              isActive: true
            };
            
            const createdUser = await storage.createUser(managerData);
            console.log(`Created showroom manager user: ${createdUser.email} for ${showroom.name}`);
          } catch (userError) {
            console.error("Failed to create showroom manager user:", userError);
            // Don't fail the showroom update if user creation fails
            return res.status(200).json({ 
              ...showroom, 
              warning: "Showroom updated but manager user creation failed" 
            });
          }
        }
        
        // Handle password reset if requested
        if (resetPasswordData && resetPasswordData.newPassword) {
          try {
            const bcrypt = await import('bcryptjs');
            const hashedPassword = await bcrypt.hash(resetPasswordData.newPassword, 10);
            
            // Find and update the showroom manager user's password
            await storage.updateUserPasswordByShowroom(id, hashedPassword);
            console.log(`Password reset for showroom manager of ${showroom.name}`);
          } catch (passwordError) {
            console.error("Failed to reset showroom manager password:", passwordError);
            // Don't fail the showroom update if password reset fails
            return res.status(200).json({ 
              ...showroom, 
              warning: "Showroom updated but password reset failed" 
            });
          }
        }
        
        res.json(showroom);
      } catch (error) {
        console.error("Update showroom error:", error);
        res.status(500).json({ error: "Failed to update showroom" });
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
  app.get("/api/dashboard/metrics", authenticate, async (req, res) => {
    try {
      
      // For partner users, use partner-specific dashboard
      if (req.user!.role === 'PARTNER_ADMIN' || req.user!.role === 'PARTNER_STAFF') {
        if (!req.user!.partnerId) {
          return res.status(400).json({ error: "Partner ID required" });
        }
        
        // Partner staff get metrics only for their assigned job cards
        if (req.user!.role === 'PARTNER_STAFF') {
          const metrics = await storage.getPartnerStaffDashboardMetrics(req.user!.partnerId, req.user!.id);
          return res.json(metrics);
        } else {
          // Partner admin gets all partner metrics
          const metrics = await storage.getPartnerDashboardMetrics(req.user!.partnerId);
          return res.json(metrics);
        }
      }
      
      // For SUPER_ADMIN, use the first available OEM or create aggregate metrics
      if (req.user!.role === 'SUPER_ADMIN') {
        // Get first available OEM for super admin
        const availableOems = await storage.getOems();
        if (availableOems.length === 0) {
          // No OEMs available, return zero metrics
          return res.json({
            activeWorkOrders: 0,
            pendingApprovals: 0,
            thisMonthRevenue: 0,
            avgTAT: 0,
            completedJobs: 0,
            inProgressJobs: 0,
            pendingJobs: 0,
            thisMonthEarnings: 0
          });
        }
        
        // Use first OEM for super admin dashboard
        const metrics = await storage.getDashboardMetrics(availableOems[0].id);
        return res.json(metrics);
      }
      
      // For other non-partner users, use their assigned OEM
      if (!req.user!.oemId) {
        return res.status(400).json({ error: "OEM ID required for this user role" });
      }
      
      const showroomId = req.user!.showroomId;
      const dealershipId = req.user!.role === 'DEALERSHIP_ADMIN' ? req.user!.dealershipId : undefined;
      
      console.log(`🎯 Dashboard metrics request for user: ${req.user!.email} (${req.user!.role})`);
      console.log(`📊 Filters: oemId=${req.user!.oemId}, showroomId=${showroomId}, dealershipId=${dealershipId}`);
      
      const metrics = await storage.getDashboardMetrics(req.user!.oemId, showroomId, dealershipId);
      
      console.log(`📈 Metrics result:`, metrics);
      
      res.json(metrics);
    } catch (error) {
      console.error("Dashboard metrics error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  app.get("/api/dashboard/charts/orders-trend", authenticate, async (req, res) => {
    try {
      let oemId: string;
      let showroomId: string | undefined;
      
      // Handle different user roles
      if (req.user!.role === 'SUPER_ADMIN') {
        const availableOems = await storage.getOems();
        if (availableOems.length === 0) return res.json([]);
        oemId = availableOems[0].id;
      } else {
        if (!req.user!.oemId) return res.status(400).json({ error: "OEM ID required" });
        oemId = req.user!.oemId;
        showroomId = req.user!.showroomId;
      }
      
      const data = await storage.getOrdersRevenueTrend(oemId, showroomId);
      res.json(data);
    } catch (error) {
      console.error("Orders trend error:", error);
      res.status(500).json({ error: "Failed to fetch orders trend data" });
    }
  });

  app.get("/api/dashboard/charts/dealership-performance", authenticate, async (req, res) => {
    try {
      let oemId: string;
      
      if (req.user!.role === 'SUPER_ADMIN') {
        const availableOems = await storage.getOems();
        if (availableOems.length === 0) return res.json([]);
        oemId = availableOems[0].id;
      } else {
        if (!req.user!.oemId) return res.status(400).json({ error: "OEM ID required" });
        oemId = req.user!.oemId;
      }
      
      const data = await storage.getDealershipPerformance(oemId);
      res.json(data);
    } catch (error) {
      console.error("Dealership performance error:", error);
      res.status(500).json({ error: "Failed to fetch dealership performance data" });
    }
  });

  app.get("/api/dashboard/charts/vehicle-upsells", authenticate, async (req, res) => {
    try {
      let oemId: string;
      
      if (req.user!.role === 'SUPER_ADMIN') {
        const availableOems = await storage.getOems();
        if (availableOems.length === 0) return res.json([]);
        oemId = availableOems[0].id;
      } else {
        if (!req.user!.oemId) return res.status(400).json({ error: "OEM ID required" });
        oemId = req.user!.oemId;
      }
      
      const data = await storage.getVehicleCategoryUpsells(oemId);
      res.json(data);
    } catch (error) {
      console.error("Vehicle upsells error:", error);
      res.status(500).json({ error: "Failed to fetch vehicle upsells data" });
    }
  });

  app.get("/api/dashboard/charts/territory-performance", authenticate, async (req, res) => {
    try {
      let oemId: string;
      
      if (req.user!.role === 'SUPER_ADMIN') {
        const availableOems = await storage.getOems();
        if (availableOems.length === 0) return res.json([]);
        oemId = availableOems[0].id;
      } else {
        if (!req.user!.oemId) return res.status(400).json({ error: "OEM ID required" });
        oemId = req.user!.oemId;
      }
      
      const data = await storage.getTerritoryPerformance(oemId);
      res.json(data);
    } catch (error) {
      console.error("Territory performance error:", error);
      res.status(500).json({ error: "Failed to fetch territory performance data" });
    }
  });

  app.get("/api/dashboard/charts/service-popularity", authenticate, async (req, res) => {
    try {
      let oemId: string;
      let showroomId: string | undefined;
      
      if (req.user!.role === 'SUPER_ADMIN') {
        const availableOems = await storage.getOems();
        if (availableOems.length === 0) return res.json([]);
        oemId = availableOems[0].id;
      } else {
        if (!req.user!.oemId) return res.status(400).json({ error: "OEM ID required" });
        oemId = req.user!.oemId;
        showroomId = req.user!.showroomId;
      }
      
      const data = await storage.getServicePopularity(oemId, showroomId);
      res.json(data);
    } catch (error) {
      console.error("Service popularity error:", error);
      res.status(500).json({ error: "Failed to fetch service popularity data" });
    }
  });

  app.get("/api/dashboard/charts/monthly-trends", authenticate, async (req, res) => {
    try {
      let oemId: string;
      let showroomId: string | undefined;
      
      if (req.user!.role === 'SUPER_ADMIN') {
        const availableOems = await storage.getOems();
        if (availableOems.length === 0) return res.json([]);
        oemId = availableOems[0].id;
      } else {
        if (!req.user!.oemId) return res.status(400).json({ error: "OEM ID required" });
        oemId = req.user!.oemId;
        showroomId = req.user!.showroomId;
      }
      
      const data = await storage.getMonthlyTrends(oemId, showroomId);
      res.json(data);
    } catch (error) {
      console.error("Monthly trends error:", error);
      res.status(500).json({ error: "Failed to fetch monthly trends data" });
    }
  });

  // Reports Metrics API
  app.get("/api/reports/metrics", authenticate, async (req, res) => {
    try {
      let oemId: string;
      let showroomId: string | undefined;
      let dealershipId: string | undefined;
      
      if (req.user!.role === 'SUPER_ADMIN') {
        const availableOems = await storage.getOems();
        if (availableOems.length === 0) {
          return res.json({
            totalWorkOrders: { thisMonth: 0, lastMonth: 0, change: 0, isPositive: true },
            avgTAT: { thisMonth: 0, lastMonth: 0, change: 0, isPositive: true },
            firstPassRate: { thisMonth: 0, lastMonth: 0, change: 0, isPositive: true },
            customerSatisfaction: { thisMonth: 0, lastMonth: 0, change: 0, isPositive: true }
          });
        }
        oemId = availableOems[0].id;
      } else {
        if (!req.user!.oemId) return res.status(400).json({ error: "OEM ID required" });
        oemId = req.user!.oemId;
        showroomId = req.user!.showroomId;
        dealershipId = req.user!.role === 'DEALERSHIP_ADMIN' ? req.user!.dealershipId : undefined;
      }
      
      const metrics = await storage.getReportsMetrics(oemId, showroomId, dealershipId);
      res.json(metrics);
    } catch (error) {
      console.error("Reports metrics error:", error);
      res.status(500).json({ error: "Failed to fetch reports metrics" });
    }
  });

  // Commission Summary Metrics API
  app.get("/api/commissions/summary", authenticate, async (req, res) => {
    try {
      let oemId: string;
      let showroomId: string | undefined;
      let dealershipId: string | undefined;
      
      if (req.user!.role === 'SUPER_ADMIN') {
        const availableOems = await storage.getOems();
        if (availableOems.length === 0) {
          return res.json({
            totalCommissionThisMonth: 0,
            activeSalesPersons: 0,
            avgCommissionRate: 0
          });
        }
        oemId = availableOems[0].id;
      } else {
        if (!req.user!.oemId) return res.status(400).json({ error: "OEM ID required" });
        oemId = req.user!.oemId;
        showroomId = req.user!.showroomId;
        dealershipId = req.user!.role === 'DEALERSHIP_ADMIN' ? req.user!.dealershipId : undefined;
      }
      
      const summary = await storage.getCommissionsSummary(oemId, showroomId, dealershipId);
      res.json(summary);
    } catch (error) {
      console.error("Commissions summary error:", error);
      res.status(500).json({ error: "Failed to fetch commissions summary" });
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

      // Add dealership-level filtering for DEALERSHIP_ADMIN users
      if (req.user!.role === 'DEALERSHIP_ADMIN' && req.user!.dealershipId) {
        filters.dealershipId = req.user!.dealershipId;
      }

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
    requireRole(['SHOWROOM_MANAGER', 'DEALERSHIP_ADMIN', 'SUPER_ADMIN', 'PARTNER_ADMIN']),
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

  // Bulk Work Orders endpoint to solve N+1 problem
  app.post("/api/work-orders/bulk", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Invalid IDs array" });
      }

      // Limit to reasonable batch size
      if (ids.length > 100) {
        return res.status(400).json({ error: "Too many IDs requested (max 100)" });
      }

      const workOrders = await storage.getWorkOrders({ 
        workOrderIds: ids,
        limit: 100 
      });

      // Filter based on user permissions
      const filteredWorkOrders = workOrders.filter(workOrder => {
        if (req.user!.role === 'SUPER_ADMIN') return true;
        if (req.user!.role === 'OEM_ADMIN') return workOrder.oemId === req.user!.oemId;
        if (req.user!.role === 'DEALERSHIP_ADMIN') return workOrder.dealershipId === req.user!.dealershipId;
        if (req.user!.role === 'SHOWROOM_MANAGER') return workOrder.showroomId === req.user!.showroomId;
        return false; // Partners handled separately
      });

      res.json(filteredWorkOrders);
    } catch (error) {
      console.error("Bulk work orders error:", error);
      res.status(500).json({ error: "Failed to fetch work orders" });
    }
  });

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
    requireRole(['SHOWROOM_MANAGER', 'DEALERSHIP_ADMIN', 'SUPER_ADMIN', 'PARTNER_ADMIN']),
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

        // If estimatedPrice was updated and there's an assigned job card, update its billing value
        if (updates.estimatedPrice !== undefined && workOrder.assignedJobCardId) {
          await storage.updateJobCard(workOrder.assignedJobCardId, {
            billingValue: updates.estimatedPrice
          });
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

  // Helper function to filter job card price based on partner permissions
  const filterJobCardPrice = (jobCard: any, partner: any) => {
    // Rule 1: Installer partners never see price
    if (partner?.type === 'INSTALLER') {
      const filtered = { ...jobCard };
      delete filtered.billingValue;
      delete filtered.estimatedPrice;
      delete filtered.actualPrice;
      return filtered;
    }
    
    // Rule 2: Studio (Detailer) partners see price only if admin grants permission
    if (partner?.type === 'STUDIO' && !partner.canViewJobCardPrice) {
      const filtered = { ...jobCard };
      delete filtered.billingValue;
      delete filtered.estimatedPrice;
      delete filtered.actualPrice;
      return filtered;
    }
    
    // All other cases: show price
    return jobCard;
  };

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
        
        // PARTNER_STAFF can only see job cards assigned to them personally
        if (req.user!.role === 'PARTNER_STAFF') {
          filters.assignedInstallerId = req.user!.id;
          console.log(`🔍 Partner Staff ${req.user!.id} requesting only their assigned job cards`);
        } else {
          console.log(`🔍 Partner Admin ${req.user!.partnerId} requesting all partner job cards with OEM filter: ${selectedOemId || 'NONE'}`);
        }
        
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
          console.log(`✅ No OEM filter - showing ${req.user!.role === 'PARTNER_STAFF' ? 'assigned' : 'ALL'} job cards for partner ${req.user!.partnerId}`);
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
      
      // 🔒 Filter price based on partner permissions (for partner users only)
      let filteredJobCards = jobCards;
      if (req.user!.role === 'PARTNER_ADMIN' || req.user!.role === 'PARTNER_STAFF') {
        const partner = await storage.getPartner(req.user!.partnerId!);
        if (partner) {
          filteredJobCards = jobCards.map(jc => filterJobCardPrice(jc, partner));
        }
      }
      
      res.json(filteredJobCards);
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
        let result: any = {
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

        // 🔒 Filter price based on partner permissions (for partner users only)
        if (req.user!.role === 'PARTNER_ADMIN' || req.user!.role === 'PARTNER_STAFF') {
          result = filterJobCardPrice(result, partner);
        }

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

        // Fetch work order to get billing value
        const workOrder = await storage.getWorkOrder(jobCardData.workOrderId);
        if (workOrder?.estimatedPrice) {
          jobCardData.billingValue = workOrder.estimatedPrice;
        }

        const jobCard = await storage.createJobCard(jobCardData);

        // 📱 WhatsApp Notification: Job Card Created
        if (workOrder && jobCard) {
          try {
            const partner = await storage.getPartner(jobCard.partnerId);
            const vehicleModel = await storage.getVehicleModel(workOrder.vehicleModelId);
            const service = await storage.getService(workOrder.serviceId);
            const showroom = await storage.getShowroom(workOrder.showroomId || '');
            
            const vehicleDetails = `${vehicleModel?.modelName || 'Vehicle'} - ${workOrder.color || 'N/A'}`;
            const partnerName = partner?.displayName || 'Partner';
            const serviceName = service?.name || 'Service';
            const showroomName = showroom?.name || 'Showroom';
            
            // Send to partner if phone available
            if (partner?.phone) {
              await whatsappService.sendJobCardCreated(
                partner.phone,
                partnerName,
                vehicleDetails,
                showroomName,
                serviceName,
                jobCard.id
              );
            }
          } catch (whatsappError) {
            console.error('WhatsApp notification failed:', whatsappError);
          }
        }

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

        // Update job card status to PENDING_SALES_INVOICE (after approval)
        const updatedJobCard = await storage.updateJobCard(jobCardId, {
          status: 'PENDING_SALES_INVOICE',
          approvedAt: new Date(),
          approvedByUserId: req.user!.id
        });

        // Sync work order status
        await storage.updateWorkOrder(jobCard.workOrderId, {
          status: 'APPROVED'
        });


        if (!updatedJobCard) {
          return res.status(500).json({ error: "Failed to approve job card" });
        }

        // 🔄 ENHANCED: Update existing payout with NEW UNIFIED pricing logic during approval
        let payoutAmount = '0.00';
        console.log(`🚀 APPROVAL STARTED: Processing payout for job card ${jobCardId}`);
        
        try {
          // Check for existing payout (should exist from completion step)
          const existingPayouts = await storage.getPayouts({ jobCardId });
          console.log(`📋 PAYOUT CHECK: Found ${existingPayouts.length} existing payouts for job card ${jobCardId}`);
          
          if (existingPayouts.length === 0) {
            console.error(`⚠️ CRITICAL: No payout found for job card ${jobCardId} during approval - creating emergency payout`);
            // Emergency payout creation if missing
            await storage.createPayout({
              jobCardId,
              partnerId: jobCard.partnerId,
              grossAmount: '0.00',
              netAmount: '0.00',
              status: 'pending_review'
            });
            const newPayouts = await storage.getPayouts({ jobCardId });
            console.log(`🆘 EMERGENCY: Created payout ${newPayouts[0]?.id} for job card ${jobCardId}`);
          }

          // Get the payout (either existing or newly created)
          const currentPayouts = await storage.getPayouts({ jobCardId });
          const existingPayout = currentPayouts[0];
          
          if (existingPayout) {
            console.log(`💰 PAYOUT FOUND: ${existingPayout.id} with current amount ₹${existingPayout.grossAmount} (status: ${existingPayout.status})`);
            
            // 🚀 APPLY NEW UNIFIED PRICING LOGIC
            const service = await storage.getService(workOrder.serviceId);
            const serviceCategoryId = service?.serviceCategoryId || null;
            console.log(`🔍 SERVICE LOOKUP: Service ${workOrder.serviceId} has category ${serviceCategoryId}`);

            if (serviceCategoryId) {
              console.log(`🎯 PRICING PARAMS: partnerId=${jobCard.partnerId}, serviceCategoryId=${serviceCategoryId}, vehicleModelId=${workOrder.vehicleModelId}`);
              
              const pricingResult = await storage.resolvePayoutPricing(
                jobCard.partnerId,       // partnerId (FIRST)
                serviceCategoryId,       // serviceCategoryId (SECOND)  
                workOrder.vehicleModelId // vehicleModelId (THIRD)
              );

              if (pricingResult) {
                payoutAmount = pricingResult.amount;
                console.log(`✅ PRICING SUCCESS: Found rule ${pricingResult.ruleId} → ₹${payoutAmount}`);
              } else {
                console.log(`❌ PRICING FAILED: No rule found for partner=${jobCard.partnerId}, category=${serviceCategoryId}, vehicle=${workOrder.vehicleModelId}`);
                payoutAmount = '0.00';
              }
            } else {
              console.log(`❌ SERVICE ERROR: No service category found for service ${workOrder.serviceId}`);
              payoutAmount = '0.00';
            }

            // Update existing payout with NEW status and correct pricing
            const newStatus = payoutAmount !== '0.00' ? 'due' : 'pending_review';
            console.log(`🔄 UPDATING PAYOUT: ${existingPayout.id} → ₹${payoutAmount} (${newStatus})`);
            
            await storage.updatePayout(existingPayout.id, {
              grossAmount: payoutAmount,
              netAmount: payoutAmount,
              status: newStatus
            });

            console.log(`✅ APPROVAL COMPLETE: Payout ${existingPayout.id} updated to ₹${payoutAmount} (${newStatus}) for job card ${jobCardId}`);
          }
        } catch (payoutError) {
          console.error(`❌ PAYOUT ERROR: Failed to update payout for job card ${jobCardId}:`, payoutError);
          // Don't fail the approval if payout update fails
        }

        // 💰 Calculate OEM Royalty automatically on job card approval
        try {
          // Get dealership pricing for royalty calculation base
          const { pricingService } = await import('./services/pricingService');
          const dealershipPricing = await pricingService.resolvePricing(
            jobCard.partnerId,
            'SHOWROOM',
            workOrder.showroomId,
            workOrder.vehicleModelId,
            workOrder.serviceId
          );
          
          const finalPrice = dealershipPricing?.priceAmount || workOrder.estimatedPrice || 0;
          
          const royaltyCalculation = await storage.calculateRoyaltyForWorkOrder(
            workOrder.id,
            Number(finalPrice),
            workOrder.oemId
          );
          
          if (royaltyCalculation) {
            console.log(`✅ OEM Royalty calculated: ₹${royaltyCalculation.royaltyAmount} (${royaltyCalculation.royaltyPercentage}%)`);
          } else {
            console.log(`ℹ️ No royalty rule found for OEM ${workOrder.oemId}`);
          }
        } catch (royaltyError) {
          console.error('❌ Error calculating OEM royalty:', royaltyError);
          // Don't fail approval if royalty calculation fails
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
          
          // Also notify stakeholders (Sales Person, Showroom Manager)
          const { notificationService } = await import('./services/notificationService');
          const stakeholders = await notificationService['getUsersByRole'](
            ['SALES_PERSON', 'SHOWROOM_MANAGER'],
            {
              oemId: workOrder.oemId,
              showroomId: workOrder.showroomId
            }
          );
          
          // Add sales person if assigned
          if (workOrder.salesPersonId) {
            const salesPerson = await storage.getUser(workOrder.salesPersonId);
            if (salesPerson && salesPerson.email && !stakeholders.find((s: any) => s.id === salesPerson.id)) {
              stakeholders.push(salesPerson);
            }
          }
          
          for (const stakeholder of stakeholders) {
            if (stakeholder.email) {
              await emailService.sendEmail({
                to: stakeholder.email,
                subject: `Job Card Approved - ${workOrder.workOrderNumber || workOrder.id.slice(0, 8)}`,
                html: `
                  <p>Job Card has been approved for ${workOrder.vehicleModel}.</p>
                  <p><strong>Approved by:</strong> ${req.user!.name || req.user!.email}</p>
                  <p><strong>Partner:</strong> ${partner?.displayName || 'N/A'}</p>
                  <p><strong>Payout Amount:</strong> ₹${payoutAmount}</p>
                `,
                text: `Job Card approved for ${workOrder.vehicleModel}. Approved by: ${req.user!.name || req.user!.email}`
              });
            }
          }
          console.log(`📧 Sent job card approval emails to ${stakeholders.length} stakeholders`);
        } catch (emailError) {
          console.error("Failed to send approval email:", emailError);
          // Don't fail the approval if email fails
        }

        // 📱 WhatsApp Notification: Job Card Approved
        try {
          const partner = await storage.getPartner(jobCard.partnerId);
          const vehicleModel = await storage.getVehicleModel(workOrder.vehicleModelId);
          
          const vehicleDetails = `${vehicleModel?.modelName || 'Vehicle'} - ${workOrder.color || 'N/A'}`;
          const approvedBy = req.user!.name || req.user!.email;
          
          if (partner?.phone) {
            await whatsappService.sendJobCardApproved(
              partner.phone,
              partner.displayName,
              vehicleDetails,
              approvedBy,
              updatedJobCard.id
            );
          }
        } catch (whatsappError) {
          console.error('WhatsApp notification failed:', whatsappError);
        }

        res.json({ message: "Job card approved successfully", jobCard: updatedJobCard });
      } catch (error) {
        console.error("Job card approval error:", error);
        res.status(500).json({ error: "Failed to approve job card" });
      }
    }
  );

  // Job Card Settlement - Settle Payment (Invoice Entry)
  app.post("/api/job-cards/:id/settle-payment",
    authenticate,
    auditLog('job_card', 'settle_payment'),
    async (req, res) => {
      try {
        const jobCardId = req.params.id;
        const { salesInvoiceNumber } = req.body;

        if (!salesInvoiceNumber || !salesInvoiceNumber.trim()) {
          return res.status(400).json({ error: "Sales invoice number is required" });
        }

        // Get job card to check status and billing info
        const jobCard = await storage.getJobCard(jobCardId);
        if (!jobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }

        if (jobCard.status !== 'PENDING_SALES_INVOICE') {
          return res.status(400).json({ error: "Job card must be in pending sales invoice status before entering invoice" });
        }

        // Get work order for permission checks
        const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
        if (!workOrder) {
          return res.status(404).json({ error: "Associated work order not found" });
        }

        // Permission check: Admin for Plus Nine One billing, Partner for partner direct billing
        const isPartnerDirectBilling = jobCard.partnerBilledDirectly === true;
        let hasAccess = false;

        if (isPartnerDirectBilling) {
          // Partner can settle their own direct billing
          if (req.user!.role === 'PARTNER_ADMIN' || req.user!.role === 'PARTNER_STAFF') {
            hasAccess = jobCard.partnerId === req.user!.partnerId;
          }
        } else {
          // Admin roles can settle Plus Nine One billing
          if (req.user!.role === 'SUPER_ADMIN') {
            hasAccess = true;
          } else if (req.user!.role === 'OEM_ADMIN') {
            hasAccess = workOrder.oemId === req.user!.oemId;
          } else if (req.user!.role === 'DEALERSHIP_ADMIN') {
            hasAccess = workOrder.dealershipId === req.user!.dealershipId;
          } else if (req.user!.role === 'SHOWROOM_MANAGER') {
            hasAccess = workOrder.showroomId === req.user!.showroomId;
          }
        }

        if (!hasAccess) {
          return res.status(403).json({ error: "Access denied - insufficient permissions" });
        }

        // Update job card with invoice info and set status to INVOICE_RAISED
        const updatedJobCard = await storage.updateJobCard(jobCardId, {
          paymentSettledAt: new Date(),
          salesInvoiceNumber: salesInvoiceNumber.trim(),
          status: 'INVOICE_RAISED'
        });

        if (!updatedJobCard) {
          return res.status(500).json({ error: "Failed to settle payment" });
        }

        // Note: Status is already set to INVOICE_RAISED above
        // Warranty will be applied separately via the apply-warranty endpoint

        const finalJobCard = await storage.getJobCard(jobCardId);
        res.json({ message: "Payment settled successfully", jobCard: finalJobCard });
      } catch (error) {
        console.error("Settle payment error:", error);
        res.status(500).json({ error: "Failed to settle payment" });
      }
    }
  );

  // Job Card Settlement - Apply Warranty
  app.post("/api/job-cards/:id/apply-warranty",
    authenticate,
    auditLog('job_card', 'apply_warranty'),
    async (req, res) => {
      try {
        const jobCardId = req.params.id;
        const { warrantyReferenceNumber } = req.body;

        if (!warrantyReferenceNumber || !warrantyReferenceNumber.trim()) {
          return res.status(400).json({ error: "Warranty reference number is required" });
        }

        // Get job card to check status and billing info
        const jobCard = await storage.getJobCard(jobCardId);
        if (!jobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }

        if (jobCard.status !== 'INVOICE_RAISED') {
          return res.status(400).json({ error: "Invoice must be raised before applying warranty" });
        }

        // Get work order for permission checks
        const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
        if (!workOrder) {
          return res.status(404).json({ error: "Associated work order not found" });
        }

        // Permission check: Admin for Plus Nine One billing, Partner for partner direct billing
        const isPartnerDirectBilling = jobCard.partnerBilledDirectly === true;
        let hasAccess = false;

        if (isPartnerDirectBilling) {
          // Partner can apply warranty for their own direct billing
          if (req.user!.role === 'PARTNER_ADMIN' || req.user!.role === 'PARTNER_STAFF') {
            hasAccess = jobCard.partnerId === req.user!.partnerId;
          }
        } else {
          // Admin roles can apply warranty for Plus Nine One billing
          if (req.user!.role === 'SUPER_ADMIN') {
            hasAccess = true;
          } else if (req.user!.role === 'OEM_ADMIN') {
            hasAccess = workOrder.oemId === req.user!.oemId;
          } else if (req.user!.role === 'DEALERSHIP_ADMIN') {
            hasAccess = workOrder.dealershipId === req.user!.dealershipId;
          } else if (req.user!.role === 'SHOWROOM_MANAGER') {
            hasAccess = workOrder.showroomId === req.user!.showroomId;
          }
        }

        if (!hasAccess) {
          return res.status(403).json({ error: "Access denied - insufficient permissions" });
        }

        // Update job card with warranty info and set status to WARRANTY_REGISTRATION
        const updatedJobCard = await storage.updateJobCard(jobCardId, {
          warrantyAppliedAt: new Date(),
          warrantyReferenceNumber: warrantyReferenceNumber.trim(),
          status: 'WARRANTY_REGISTRATION'
        });

        if (!updatedJobCard) {
          return res.status(500).json({ error: "Failed to apply warranty" });
        }

        // Sync work order status to CLOSED after warranty registration
        await storage.updateWorkOrder(jobCard.workOrderId, {
          status: 'CLOSED'
        });

        const finalJobCard = await storage.getJobCard(jobCardId);
        res.json({ message: "Warranty applied successfully", jobCard: finalJobCard });
      } catch (error) {
        console.error("Apply warranty error:", error);
        res.status(500).json({ error: "Failed to apply warranty" });
      }
    }
  );

  // REMOVED - Duplicate endpoint replaced by enhanced /request-rework below

  app.put("/api/job-cards/:id", 
    authenticate,
    requireRole(['PARTNER_ADMIN', 'PARTNER_STAFF', 'SHOWROOM_MANAGER', 'DEALERSHIP_ADMIN', 'SUPER_ADMIN']),
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

      // 📱 WhatsApp Notification: Job Card Scheduled
      try {
        const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
        const partner = await storage.getPartner(jobCard.partnerId);
        const vehicleModel = workOrder ? await storage.getVehicleModel(workOrder.vehicleModelId) : null;
        const showroom = workOrder ? await storage.getShowroom(workOrder.showroomId || '') : null;
        
        const vehicleDetails = `${vehicleModel?.modelName || 'Vehicle'} - ${workOrder?.color || 'N/A'}`;
        const showroomName = showroom?.name || 'Showroom';
        
        if (partner?.phone) {
          await whatsappService.sendJobCardScheduled(
            partner.phone,
            partner.displayName,
            scheduledAt.toLocaleDateString('en-IN'),
            vehicleDetails,
            showroomName,
            jobCard.id
          );
        }
      } catch (whatsappError) {
        console.error('WhatsApp notification failed:', whatsappError);
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

      // 📱 WhatsApp Notification: Job Card Started
      try {
        const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
        const partner = await storage.getPartner(jobCard.partnerId);
        
        if (workOrder) {
          const vehicleModel = await storage.getVehicleModel(workOrder.vehicleModelId);
          const service = await storage.getService(workOrder.serviceId);
          const showroom = await storage.getShowroom(workOrder.showroomId || '');
          
          const vehicleDetails = `${vehicleModel?.modelName || 'Vehicle'} - ${workOrder.color || 'N/A'}`;
          const serviceName = service?.name || 'Service';
          
          if (showroom?.contactPersonPhone) {
            await whatsappService.sendJobCardStarted(
              showroom.contactPersonPhone,
              partner?.displayName || 'Partner',
              vehicleDetails,
              serviceName,
              jobCard.id
            );
          }
        }
      } catch (whatsappError) {
        console.error('WhatsApp notification failed:', whatsappError);
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

      // 📧 Email Notification: Job Card Completed - Notify stakeholders
      try {
        const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
        if (workOrder) {
          const { notificationService } = await import('./services/notificationService');
          
          // Get stakeholders (Showroom Manager, OEM Admin, Dealership Admin)
          const stakeholders = await notificationService['getUsersByRole'](
            ['SHOWROOM_MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN'],
            {
              oemId: workOrder.oemId,
              dealershipId: workOrder.dealershipId,
              showroomId: workOrder.showroomId
            }
          );
          
          for (const stakeholder of stakeholders) {
            if (stakeholder.email) {
              await emailService.sendJobCardCompletionNotification(
                stakeholder.email,
                {
                  jobCardId: jobCard.id,
                  workOrderNumber: workOrder.workOrderNumber || workOrder.id.slice(0, 8),
                  vehicleDetails: `${workOrder.vehicleModel || 'Vehicle'} ${workOrder.vehicleVariant || ''}`.trim(),
                  completedAt: jobCard.completedAt || new Date(),
                  partnerName: (await storage.getPartner(jobCard.partnerId))?.displayName || 'Partner'
                }
              );
            }
          }
          console.log(`📧 Sent job card completion emails to ${stakeholders.length} stakeholders`);
        }
      } catch (emailError) {
        console.error("Failed to send completion email to stakeholders:", emailError);
      }

      // 📱 WhatsApp Notification: Job Card Completed
      try {
        const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
        if (workOrder) {
          const partner = await storage.getPartner(jobCard.partnerId);
          const vehicleModel = await storage.getVehicleModel(workOrder.vehicleModelId);
          const service = await storage.getService(workOrder.serviceId);
          const showroom = await storage.getShowroom(workOrder.showroomId || '');
          
          const vehicleDetails = `${vehicleModel?.modelName || 'Vehicle'} - ${workOrder.color || 'N/A'}`;
          const serviceName = service?.name || 'Service';
          
          if (showroom?.contactPersonPhone) {
            await whatsappService.sendJobCardCompleted(
              showroom.contactPersonPhone,
              partner?.displayName || 'Partner',
              vehicleDetails,
              serviceName,
              jobCard.id
            );
          }
        }
      } catch (whatsappError) {
        console.error('WhatsApp notification failed:', whatsappError);
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
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'SHOWROOM_MANAGER', 'DEALERSHIP_ADMIN']),
    auditLog('job_card', 'request_rework'),
    async (req, res) => {
      try {
        // Validate rework request data
        const reworkSchema = z.object({
          remarks: z.string().min(1, "Reason is required for rework requests")
        });
        
        const { remarks } = reworkSchema.parse(req.body);
        const jobCardId = req.params.id;
        
        // Get job card first to check status and access
        const jobCard = await storage.getJobCard(jobCardId);
        if (!jobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }

        // Only allow rework requests on PENDING_APPROVAL or COMPLETED jobs
        if (jobCard.status !== 'PENDING_APPROVAL' && jobCard.status !== 'COMPLETED') {
          return res.status(400).json({ 
            error: "Job card must be pending approval or completed to request rework",
            currentStatus: jobCard.status 
          });
        }

        // Get associated work order for access check
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
          return res.status(403).json({ error: "Access denied to this job card" });
        }

        // Update job card status to REWORK_REQUESTED
        const updatedJobCard = await storage.updateJobCard(jobCardId, {
          status: 'REWORK_REQUESTED',
          reworkReason: remarks,
          reworkRequestedAt: new Date(),
          reworkRequestedBy: req.user!.id
        });
        
        if (!updatedJobCard) {
          return res.status(500).json({ error: "Failed to request rework" });
        }

        // Update work order status as well
        await storage.updateWorkOrder(jobCard.workOrderId, {
          status: 'REWORK_REQUESTED'
        });

        // Create approval record for audit trail
        await storage.createApproval({
          jobCardId,
          approverUserId: req.user!.id,
          status: 'REWORK_REQUESTED',
          remarks
        });

        console.log(`🟡 Rework requested on ${jobCard.id} by ${req.user!.role}: '${remarks}'`);

        res.json({ 
          message: "Rework requested successfully", 
          jobCard: updatedJobCard,
          reason: remarks
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid rework request data", details: error.errors });
        }
        console.error("Request rework error:", error);
        res.status(500).json({ error: "Failed to request rework" });
      }
    }
  );

  // Job Card Mark as Fixed (for detailers after rework)
  app.post("/api/job-cards/:id/mark-fixed", 
    authenticate, 
    requireRole(['PARTNER_ADMIN', 'PARTNER_STAFF']),
    auditLog('job_card', 'mark_fixed'),
    async (req, res) => {
      try {
        const jobCardId = req.params.id;
        
        // Get job card first to check status and access
        const jobCard = await storage.getJobCard(jobCardId);
        if (!jobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }

        // Only allow marking as fixed if status is REWORK_REQUESTED
        if (jobCard.status !== 'REWORK_REQUESTED') {
          return res.status(400).json({ 
            error: "Job card must be in rework requested status to mark as fixed",
            currentStatus: jobCard.status 
          });
        }

        // Check if partner has access to this job card
        if (req.user!.role === 'PARTNER_ADMIN' || req.user!.role === 'PARTNER_STAFF') {
          if (jobCard.partnerId !== req.user!.partnerId) {
            return res.status(403).json({ error: "Access denied - this job card is not assigned to your partner" });
          }
        }

        // Update job card status back to PENDING_APPROVAL
        const updatedJobCard = await storage.updateJobCard(jobCardId, {
          status: 'PENDING_APPROVAL',
          reworkCompletedAt: new Date(),
          reworkCompletedBy: req.user!.id
        });
        
        if (!updatedJobCard) {
          return res.status(500).json({ error: "Failed to mark job card as fixed" });
        }

        // Update work order status as well
        await storage.updateWorkOrder(jobCard.workOrderId, {
          status: 'COMPLETED_PENDING_APPROVAL'
        });

        // Create approval record for audit trail
        await storage.createApproval({
          jobCardId,
          approverUserId: req.user!.id,
          status: 'REWORK_COMPLETED',
          remarks: 'Rework completed by detailer - resubmitted for approval'
        });

        console.log(`✅ Rework completed on ${jobCard.id} by ${req.user!.role} → resubmitted for approval`);

        res.json({ 
          message: "Job card marked as fixed and resubmitted for approval", 
          jobCard: updatedJobCard
        });
      } catch (error) {
        console.error("Mark fixed error:", error);
        res.status(500).json({ error: "Failed to mark job card as fixed" });
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

  // Bulk Partners endpoint
  app.post("/api/partners/bulk", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Invalid IDs array" });
      }

      if (ids.length > 100) {
        return res.status(400).json({ error: "Too many IDs requested (max 100)" });
      }

      const filters: any = { partnerIds: ids };
      
      // Add OEM filter for non-admin users
      if (req.user!.role !== 'SUPER_ADMIN' && req.user!.oemId) {
        filters.oemId = req.user!.oemId;
      }

      const partners = await storage.getPartners(filters);
      res.json(partners);
    } catch (error) {
      console.error("Bulk partners error:", error);
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
        
        // Check if email or phone number already exists
        if (validatedData.email) {
          const existingUser = await storage.getUserByEmail(validatedData.email);
          if (existingUser) {
            return res.status(400).json({ error: `Email ${validatedData.email} is already in use` });
          }
        }
        
        if (validatedData.phone) {
          // Check if phone number already exists in users table
          const users = await storage.getUsers();
          const existingUserByPhone = users.find(u => u.phone === validatedData.phone);
          
          if (existingUserByPhone) {
            return res.status(400).json({ error: `Phone number ${validatedData.phone} is already in use` });
          }
        }
        
        const partner = await storage.createPartner(validatedData);
        
        // Handle service category mappings if provided
        if (serviceCategoryIds && Array.isArray(serviceCategoryIds) && serviceCategoryIds.length > 0) {
          await storage.setPartnerServiceCategories(partner.id, serviceCategoryIds);
        }
        
        // Automatically create user account for the partner
        if (partner.email) {
          try {
            // Generate default password using phone number or "partner@123"
            const defaultPassword = partner.phone ? partner.phone.slice(-6) : "partner@123";
            const passwordHash = await bcrypt.hash(defaultPassword, 10);
            
            await storage.createUser({
              email: partner.email,
              phone: partner.phone || undefined,
              passwordHash,
              name: partner.displayName || partner.contactPersonName || 'Partner User',
              role: 'PARTNER_ADMIN',
              partnerId: partner.id,
              isActive: true
            });
            
            console.log(`✅ Auto-created user account for partner: ${partner.email} (password: ${defaultPassword})`);
          } catch (userError) {
            console.error("Failed to auto-create partner user account:", userError);
            // Don't fail the partner creation if user creation fails
          }
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
        
        // Get partner showrooms
        const showroomIds = await storage.getPartnerShowrooms(id);
        
        res.json({
          ...partner,
          showroomIds
        });
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
        const { serviceCategoryIds, brandIds, resetPasswordData, ...partnerData } = req.body;
        const validatedData = insertPartnerSchema.partial().parse(partnerData);
        
        const partner = await storage.updatePartner(id, validatedData);
        if (!partner) {
          return res.status(404).json({ error: "Partner not found" });
        }
        
        // Handle service category mappings if provided
        if (serviceCategoryIds !== undefined && Array.isArray(serviceCategoryIds)) {
          await storage.setPartnerServiceCategories(partner.id, serviceCategoryIds);
        }
        
        // Handle brand mappings if provided
        if (brandIds !== undefined && Array.isArray(brandIds)) {
          await storage.setPartnerBrands(partner.id, brandIds);
        }
        
        // Handle password reset if requested
        if (resetPasswordData && resetPasswordData.newPassword) {
          if (partner.email) {
            const user = await storage.getUserByEmail(partner.email);
            if (user) {
              const hashedPassword = await bcrypt.hash(resetPasswordData.newPassword, 10);
              await storage.updateUser(user.id, { passwordHash: hashedPassword });
              console.log(`✅ Password reset for partner admin: ${partner.email}`);
            }
          }
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

  app.delete("/api/partners/:id",
    authenticate,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    auditLog('partner', 'delete'),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        const deleted = await storage.deletePartner(id);
        if (!deleted) {
          return res.status(404).json({ error: "Partner not found" });
        }
        
        res.json({ message: "Partner deleted successfully" });
      } catch (error) {
        console.error("Delete partner error:", error);
        res.status(500).json({ error: "Failed to delete partner" });
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
        const brandIds = await storage.getPartnerBrands(id);
        res.json({ serviceCategoryIds: categoryIds, brandIds });
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
          password: z.string().min(6, "Password must be at least 6 characters").optional(),
          isActive: z.boolean().optional()
        });

        const validatedData = staffUpdateSchema.parse(req.body);
        
        // If password is provided, hash it before storage
        let dataForStorage: any = { ...validatedData };
        if (validatedData.password) {
          const hashedPassword = await bcrypt.hash(validatedData.password, 12);
          dataForStorage.passwordHash = hashedPassword;
          delete dataForStorage.password; // Remove plain text password
        }
        
        const updatedStaff = await storage.updatePartnerStaff(staffId, dataForStorage);
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
        
        // TODO: Implement pricing service
        res.status(501).json({ error: "Pricing resolution not yet implemented" });
      } catch (error) {
        console.error("Get dealership pricing error:", error);
        res.status(500).json({ error: "Failed to get dealership pricing" });
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
        
        // TODO: Implement pricing service
        res.status(501).json({ error: "Pricing resolution not yet implemented" });
      } catch (error) {
        console.error("Get detailer pricing error:", error);
        res.status(500).json({ error: "Failed to get detailer pricing" });
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
        // Check if email or phone number already exists
        if (req.body.email) {
          const existingUser = await storage.getUserByEmail(req.body.email);
          if (existingUser) {
            return res.status(400).json({ error: `Email ${req.body.email} is already in use` });
          }
        }
        
        if (req.body.phone) {
          const users = await storage.getUsers();
          const existingUserByPhone = users.find(u => u.phone === req.body.phone);
          if (existingUserByPhone) {
            return res.status(400).json({ error: `Phone number ${req.body.phone} is already in use` });
          }
        }
        
        // Generate default password using phone number or "sales@123"
        const phone = req.body.phone || '';
        const defaultPassword = phone ? phone.slice(-6) : "sales@123";
        const passwordHash = await bcrypt.hash(defaultPassword, 10);
        
        const salesPersonData = {
          name: req.body.name,
          email: req.body.email,
          phone: phone,
          passwordHash,
          role: 'SALES_PERSON' as const,
          showroomId: req.body.showroomId || null,
          isActive: req.body.active ?? true
        };
        
        const salesPerson = await storage.createUser(salesPersonData);
        console.log(`✅ Created sales person user account: ${salesPerson.email} (password: ${defaultPassword})`);
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
      if (oemId) {
        filters.oemId = oemId as string;
      } else if (dealershipId) {
        filters.dealershipId = dealershipId as string;
      } else if (req.user!.showroomId) {
        // For showroom users, get the showroom's OEM (check showroom BEFORE dealership)
        const showroom = await storage.getShowroom(req.user!.showroomId);
        if (showroom?.oemId) {
          filters.oemId = showroom.oemId;
        }
      } else if (req.user!.dealershipId) {
        filters.dealershipId = req.user!.dealershipId;
      } else if (req.user!.oemId) {
        filters.oemId = req.user!.oemId;
      }

      console.log('Services API - User:', req.user?.email, 'Role:', req.user?.role, 'Filters:', filters);

      const services = await storage.getServices(filters);
      
      console.log('Services API - Found', services.length, 'services:', services.map((s: any) => s.name).join(', '));
      
      // Fetch raw materials for each service
      const servicesWithMaterials = await Promise.all(
        services.map(async (service: any) => {
          const materials = await storage.getServiceRawMaterials(service.id);
          return {
            ...service,
            rawMaterials: materials
          };
        })
      );
      
      // Disable caching for this endpoint
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json(servicesWithMaterials);
    } catch (error) {
      console.error("Get services error:", error);
      res.status(500).json({ error: "Failed to fetch services" });
    }
  });

  // Bulk Services endpoint
  app.post("/api/services/bulk", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Invalid IDs array" });
      }

      if (ids.length > 100) {
        return res.status(400).json({ error: "Too many IDs requested (max 100)" });
      }

      const filters: any = { serviceIds: ids };
      
      // Add OEM filter for non-admin users
      if (req.user!.role !== 'SUPER_ADMIN' && req.user!.oemId) {
        filters.oemId = req.user!.oemId;
      }

      const services = await storage.getServices(filters);
      res.json(services);
    } catch (error) {
      console.error("Bulk services error:", error);
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

  // Get allocation brands
  app.get("/api/allocations/:id/brands", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    async (req, res) => {
      try {
        const { id } = req.params;
        const brandIds = await storage.getAllocationBrands(id);
        res.json({ brandIds });
      } catch (error) {
        console.error("Get allocation brands error:", error);
        res.status(500).json({ error: "Failed to fetch allocation brands" });
      }
    }
  );

  // Get allocated brands for a specific showroom/dealership
  app.get("/api/allocations/allocated-brands", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    async (req, res) => {
      try {
        const { level, levelId } = req.query;
        
        if (!level || !levelId) {
          return res.status(400).json({ error: "level and levelId are required" });
        }
        
        const allocatedBrands = await storage.getAllocatedBrands(level as string, levelId as string);
        res.json(allocatedBrands);
      } catch (error) {
        console.error("Get allocated brands error:", error);
        res.status(500).json({ error: "Failed to fetch allocated brands" });
      }
    }
  );

  app.post("/api/allocations", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
    auditLog('allocation', 'create'),
    async (req, res) => {
      try {
        const { brandIds, ...allocationData } = req.body;
        
        // Validate required fields
        if (!allocationData.level || !allocationData.levelId || !allocationData.partnerId) {
          return res.status(400).json({ 
            error: "Level, levelId, and partnerId are required" 
          });
        }

        const allocation = await storage.createAllocation(allocationData);
        
        // Handle brand mappings if provided
        if (brandIds !== undefined && Array.isArray(brandIds)) {
          await storage.setAllocationBrands(allocation.id, brandIds);
        }
        
        res.status(201).json(allocation);
      } catch (error) {
        console.error("Create allocation error:", error);
        const err = error as Error;
        if (err.message && (err.message.includes("already has an active allocation") || err.message.includes("Duplicate allocation detected"))) {
          return res.status(409).json({ error: err.message });
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
        const { id } = req.params;
        const { brandIds, ...allocationData } = req.body;
        
        const allocation = await storage.updateAllocation(id, allocationData);
        if (!allocation) {
          return res.status(404).json({ error: "Allocation not found" });
        }
        
        // Handle brand mappings if provided
        if (brandIds !== undefined && Array.isArray(brandIds)) {
          await storage.setAllocationBrands(allocation.id, brandIds);
        }
        
        res.json(allocation);
      } catch (error) {
        console.error("Update allocation error:", error);
        const err = error as Error;
        if (err.message && err.message.includes("Duplicate allocation detected")) {
          return res.status(409).json({ error: err.message });
        }
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
        
        // Check tenant access permissions (for now, skip this check as it expects full user object)
        // TODO: Implement proper tenant access check with AuthUser type
        
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
        
        // Check tenant access permissions (for now, skip this check as it expects full user object)
        // TODO: Implement proper tenant access check with AuthUser type
        
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
        
        // Check tenant access permissions (for now, skip this check as it expects full user object)
        // TODO: Implement proper tenant access check with AuthUser type
        
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

  // OEM Royalty Management API
  
  // Get royalty rules
  app.get("/api/oem-royalty-rules", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { oemId, isActive } = req.query;
      
      const filters: any = {};
      if (oemId) filters.oemId = oemId as string;
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      
      const rules = await storage.getOemRoyaltyRules(filters);
      res.json(rules);
    } catch (error) {
      console.error("Get royalty rules error:", error);
      res.status(500).json({ error: "Failed to fetch royalty rules" });
    }
  });

  // Get specific royalty rule
  app.get("/api/oem-royalty-rules/:id", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const rule = await storage.getOemRoyaltyRule(id);
      
      if (!rule) {
        return res.status(404).json({ error: "Royalty rule not found" });
      }
      
      res.json(rule);
    } catch (error) {
      console.error("Get royalty rule error:", error);
      res.status(500).json({ error: "Failed to fetch royalty rule" });
    }
  });

  // Get royalty rule by OEM
  app.get("/api/oems/:oemId/royalty-rule", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { oemId } = req.params;
      const rule = await storage.getOemRoyaltyRuleByOem(oemId);
      
      if (!rule) {
        return res.status(404).json({ error: "No active royalty rule found for this OEM" });
      }
      
      res.json(rule);
    } catch (error) {
      console.error("Get OEM royalty rule error:", error);
      res.status(500).json({ error: "Failed to fetch OEM royalty rule" });
    }
  });

  // Create royalty rule
  app.post("/api/oem-royalty-rules", 
    authenticate, 
    requireOEMAccess,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN']),
    auditLog('oem_royalty_rule', 'create'),
    async (req, res) => {
      try {
        const validatedData = insertOemRoyaltyRuleSchema.parse(req.body);
        const createdBy = req.user!.id;
        
        const newRule = await storage.createOemRoyaltyRule(validatedData, createdBy);
        res.status(201).json(newRule);
      } catch (error) {
        console.error("Create royalty rule error:", error);
        if (error instanceof Error && error.message.includes("ZodError")) {
          return res.status(400).json({ error: "Invalid royalty rule data" });
        }
        res.status(500).json({ error: "Failed to create royalty rule" });
      }
    }
  );

  // Update royalty rule
  app.put("/api/oem-royalty-rules/:id", 
    authenticate, 
    requireOEMAccess,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN']),
    auditLog('oem_royalty_rule', 'update'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const updatedBy = req.user!.id;
        
        const updateSchema = insertOemRoyaltyRuleSchema.partial();
        const validatedData = updateSchema.parse(req.body);
        
        const updatedRule = await storage.updateOemRoyaltyRule(id, validatedData, updatedBy);
        
        if (!updatedRule) {
          return res.status(404).json({ error: "Royalty rule not found" });
        }
        
        res.json(updatedRule);
      } catch (error) {
        console.error("Update royalty rule error:", error);
        if (error instanceof Error && error.message.includes("ZodError")) {
          return res.status(400).json({ error: "Invalid royalty rule data" });
        }
        res.status(500).json({ error: "Failed to update royalty rule" });
      }
    }
  );

  // Deactivate royalty rule
  app.delete("/api/oem-royalty-rules/:id", 
    authenticate, 
    requireOEMAccess,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN']),
    auditLog('oem_royalty_rule', 'deactivate'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const updatedBy = req.user!.id;
        
        const deactivated = await storage.deactivateOemRoyaltyRule(id, updatedBy);
        
        if (!deactivated) {
          return res.status(404).json({ error: "Royalty rule not found" });
        }
        
        res.json({ success: true, message: "Royalty rule deactivated successfully" });
      } catch (error) {
        console.error("Deactivate royalty rule error:", error);
        res.status(500).json({ error: "Failed to deactivate royalty rule" });
      }
    }
  );

  // Get royalty calculations
  app.get("/api/oem-royalty-calculations", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { oemId, workOrderId, status } = req.query;
      
      const filters: any = {};
      
      // For OEM Admins, automatically filter by their OEM
      if (req.user?.role === 'OEM_ADMIN' && req.user?.oemId) {
        filters.oemId = req.user.oemId;
      } else if (oemId) {
        // For Super Admins, allow filtering by any OEM
        filters.oemId = oemId as string;
      }
      
      if (workOrderId) filters.workOrderId = workOrderId as string;
      if (status) filters.status = status as string;
      
      const calculations = await storage.getOemRoyaltyCalculations(filters);
      res.json(calculations);
    } catch (error) {
      console.error("Get royalty calculations error:", error);
      res.status(500).json({ error: "Failed to fetch royalty calculations" });
    }
  });

  // Calculate royalty for work order
  app.post("/api/work-orders/:workOrderId/calculate-royalty", 
    authenticate, 
    requireOEMAccess,
    async (req, res) => {
      try {
        const { workOrderId } = req.params;
        const { workOrderValue } = req.body;
        
        if (!workOrderValue || isNaN(Number(workOrderValue))) {
          return res.status(400).json({ error: "Valid work order value is required" });
        }
        
        // Get work order to extract OEM ID
        const workOrder = await storage.getWorkOrder(workOrderId);
        if (!workOrder) {
          return res.status(404).json({ error: "Work order not found" });
        }
        
        const calculation = await storage.calculateRoyaltyForWorkOrder(
          workOrderId, 
          Number(workOrderValue), 
          workOrder.oemId
        );
        
        if (!calculation) {
          return res.json({ 
            message: "No royalty rule found for this OEM", 
            royaltyAmount: 0 
          });
        }
        
        res.json(calculation);
      } catch (error) {
        console.error("Calculate royalty error:", error);
        res.status(500).json({ error: "Failed to calculate royalty" });
      }
    }
  );

  // Update royalty calculation status
  app.put("/api/oem-royalty-calculations/:id", 
    authenticate, 
    requireOEMAccess,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN']),
    async (req, res) => {
      try {
        const { id } = req.params;
        const updateSchema = insertOemRoyaltyCalculationSchema.partial();
        const validatedData = updateSchema.parse(req.body);
        
        const updatedCalculation = await storage.updateOemRoyaltyCalculation(id, validatedData);
        
        if (!updatedCalculation) {
          return res.status(404).json({ error: "Royalty calculation not found" });
        }
        
        res.json(updatedCalculation);
      } catch (error) {
        console.error("Update royalty calculation error:", error);
        if (error instanceof Error && error.message.includes("ZodError")) {
          return res.status(400).json({ error: "Invalid calculation data" });
        }
        res.status(500).json({ error: "Failed to update royalty calculation" });
      }
    }
  );

  // General file upload endpoint for Knowledge Hub and other features
  const generalUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads', 'knowledge-hub');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const safeFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${timestamp}_${safeFilename}`);
      }
    }),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    }
  });

  app.post("/api/upload", 
    authenticate, 
    generalUpload.single('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        // Generate the URL to serve the file
        const url = `/api/media/knowledge-hub/${req.file.filename}`;
        
        res.json({ url });
      } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: "Failed to upload file" });
      }
    }
  );

  // Serve uploaded knowledge hub files
  app.get("/api/media/knowledge-hub/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      const fullPath = path.join(process.cwd(), 'uploads', 'knowledge-hub', filename);
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "File not found" });
      }

      res.sendFile(fullPath);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

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

        // Get the job card to verify access and get OEM ID
        const jobCard = await storage.getJobCard(jobCardId);
        if (!jobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }

        // For partner users, verify they have access to this job card
        if (req.user?.role === 'PARTNER_ADMIN' || req.user?.role === 'PARTNER_STAFF') {
          if (!req.user.partnerId) {
            return res.status(403).json({ error: "Partner ID not found in user context" });
          }
          
          // Check if this partner has access to the job card
          if (jobCard.partnerId !== req.user.partnerId) {
            return res.status(403).json({ error: "Access denied - job card belongs to different partner" });
          }
        } else {
          // For non-partner users, use existing OEM access validation
          const oemId = req.headers['x-oem-id'] as string;
          if (!oemId) {
            return res.status(400).json({ error: 'OEM ID required' });
          }
          
          // Verify the job card belongs to the specified OEM
          // TODO: Need to fetch work order to verify OEM ID
          // For now, skip this check
        }

        // File is already saved by multer to uploads/job-cards/
        // Generate the URL to serve the file
        const mediaUrl = `/api/media/job-cards/${req.file.filename}`;

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

  // Serve uploaded job card media files
  app.get("/api/media/job-cards/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      const fullPath = path.join(process.cwd(), 'uploads', 'job-cards', filename);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "Media file not found" });
      }
      
      // Serve the file with proper headers
      res.sendFile(fullPath);
    } catch (error) {
      console.error("Error serving media file:", error);
      res.status(500).json({ error: "Failed to serve media file" });
    }
  });

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

  // Test WhatsApp notification endpoint
  app.post("/api/test-whatsapp", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      const success = await whatsappService.sendJobCardCreated(
        phoneNumber,
        "Premium Detailing Studio",
        "Audi A4 - Silver",
        "City Auto Showroom",
        "PPF Full Body Protection",
        "test-job-card-123"
      );

      if (success) {
        res.json({ 
          message: "Test WhatsApp notification sent successfully",
          phoneNumber: phoneNumber,
          template: "job_card_created",
          sampleMessage: "Hey Premium Detailing Studio! A new job card has been assigned to you for Audi A4 - Silver at City Auto Showroom. Service: PPF Full Body Protection. Please acknowledge and start the work.",
          note: "This is a test notification. Ensure template 'job_card_created' is approved by Meta before production use."
        });
      } else {
        res.status(500).json({ error: "Failed to send WhatsApp notification" });
      }
    } catch (error) {
      console.error("Test WhatsApp error:", error);
      res.status(500).json({ error: "Failed to send test WhatsApp notification" });
    }
  });

  // Test brand-specific email addresses
  app.post("/api/test-brand-emails", async (req, res) => {
    try {
      const recipientEmail = req.body.to || "jaggi13js@gmail.com";
      
      // Test email from 3M brand
      const email3M = await emailService.sendEmail({
        to: recipientEmail,
        subject: "Test Email from 3M Brand",
        from: emailService.getFromEmailByBrand("3M"),
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #2563eb;">Test Email from 3M Brand</h2>
            <p>This is a test email sent from the <strong>3M brand</strong> email address.</p>
            <p><strong>From:</strong> ppfinstallation@justsigns.co.in</p>
            <p><strong>Brand:</strong> 3M</p>
            <hr style="margin: 20px 0;">
            <p style="color: #64748b; font-size: 14px;">This is a test of the dynamic "From Email" feature based on product brand.</p>
          </div>
        `
      });

      // Test email from STEK brand
      const emailSTEK = await emailService.sendEmail({
        to: recipientEmail,
        subject: "Test Email from STEK Brand",
        from: emailService.getFromEmailByBrand("STEK"),
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #10b981;">Test Email from STEK Brand</h2>
            <p>This is a test email sent from the <strong>STEK brand</strong> email address.</p>
            <p><strong>From:</strong> noreply@stek-india.in</p>
            <p><strong>Brand:</strong> STEK</p>
            <hr style="margin: 20px 0;">
            <p style="color: #64748b; font-size: 14px;">This is a test of the dynamic "From Email" feature based on product brand.</p>
          </div>
        `
      });

      // Test email from P91 brand
      const emailP91 = await emailService.sendEmail({
        to: recipientEmail,
        subject: "Test Email from P91 Brand",
        from: emailService.getFromEmailByBrand("P91"),
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #f59e0b;">Test Email from P91 Brand</h2>
            <p>This is a test email sent from the <strong>P91 brand</strong> email address.</p>
            <p><strong>From:</strong> noreply@p91india.com</p>
            <p><strong>Brand:</strong> P91</p>
            <hr style="margin: 20px 0;">
            <p style="color: #64748b; font-size: 14px;">This is a test of the dynamic "From Email" feature based on product brand.</p>
          </div>
        `
      });

      const results = {
        recipientEmail,
        results: {
          "3M": email3M ? "✅ Sent" : "❌ Failed",
          "STEK": emailSTEK ? "✅ Sent" : "❌ Failed",
          "P91": emailP91 ? "✅ Sent" : "❌ Failed"
        },
        fromEmails: {
          "3M": "ppfinstallation@justsigns.co.in",
          "STEK": "noreply@stek-india.in",
          "P91": "noreply@p91india.com"
        },
        note: "Check the email inbox to verify the 'From' addresses are correct for each brand."
      };

      console.log("📧 Brand-specific test emails sent:", results);
      res.json(results);
    } catch (error) {
      console.error("Test brand emails error:", error);
      res.status(500).json({ error: "Failed to send test brand emails" });
    }
  });

  // 🔥 CREATE COMMISSION FOR SPECIFIC WORK ORDER - Robust commission creation
  app.post("/api/work-orders/:workOrderId/commission", 
    authenticate, 
    requireOEMAccess,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    async (req, res) => {
      try {
        const { workOrderId } = req.params;
        
        console.log(`🔥 Manual commission creation requested for work order: ${workOrderId}`);
        
        // TODO: Implement commission service
        res.status(501).json({ error: "Commission creation not yet implemented" });
      } catch (error) {
        console.error("Commission creation error:", error);
        res.status(500).json({ error: "Failed to create commission" });
      }
    }
  );

  // 🔧 COMMISSION BACKFILL ENDPOINT - Admin only for running commission backfill
  app.post("/api/commissions/backfill", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN']),
    async (req, res) => {
      try {
        console.log(`🚀 Commission backfill requested by user ${req.user!.email}`);
        
        const { workOrderService } = await import('./services/workOrderService');
        const results = await workOrderService.backfillMissingCommissions();
        
        console.log(`✅ Backfill completed:`, results);
        res.json({
          success: true,
          ...results,
          message: `Successfully processed ${results.processed} work orders and created ${results.created} missing commissions`
        });
      } catch (error) {
        console.error("Commission backfill error:", error);
        res.status(500).json({ error: "Failed to run commission backfill" });
      }
    }
  );

  // 📚 KNOWLEDGE HUB ROUTES

  // Get all knowledge hub items (role-based filtering)
  app.get("/api/knowledge-hub", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { category, contentType, search } = req.query;
      const user = req.user!;

      // Map user role to applicable-to filter
      const roleMapping: { [key: string]: string } = {
        'PARTNER_ADMIN': 'INSTALLER',
        'PARTNER_STAFF': 'INSTALLER',
        'DEALERSHIP_ADMIN': 'DEALERSHIP',
        'SHOWROOM_MANAGER': 'SHOWROOM',
        'SALES_PERSON': 'SHOWROOM'
      };

      let applicableTo: string[] = ['ALL'];
      
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'OEM_ADMIN') {
        const mappedRole = roleMapping[user.role];
        if (mappedRole) {
          applicableTo.push(mappedRole);
        }
      }

      const filters: any = {
        oemId: user.oemId,
        applicableTo,
        isActive: true
      };

      if (category) filters.category = category;
      if (contentType) filters.contentType = contentType;
      if (search) filters.searchTerm = search;

      const items = await storage.getKnowledgeHubItems(filters);
      res.json(items);
    } catch (error) {
      console.error("Error fetching knowledge hub items:", error);
      res.status(500).json({ error: "Failed to fetch knowledge hub items" });
    }
  });

  // Get single knowledge hub item
  app.get("/api/knowledge-hub/:id", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const item = await storage.getKnowledgeHubItem(id);

      if (!item) {
        return res.status(404).json({ error: "Knowledge hub item not found" });
      }

      res.json(item);
    } catch (error) {
      console.error("Error fetching knowledge hub item:", error);
      res.status(500).json({ error: "Failed to fetch knowledge hub item" });
    }
  });

  // Create knowledge hub item (admin only)
  app.post("/api/knowledge-hub", 
    authenticate, 
    requireOEMAccess,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN']),
    async (req, res) => {
      try {
        const user = req.user!;
        const { title, category, contentType, fileUrl, externalLink, applicableTo, description, isActive } = req.body;

        // Validation
        if (!title || !category || !contentType || !applicableTo || applicableTo.length === 0) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        if (contentType === 'YOUTUBE' || contentType === 'LINK') {
          if (!externalLink) {
            return res.status(400).json({ error: "External link is required for this content type" });
          }
        } else if (!fileUrl && !externalLink) {
          return res.status(400).json({ error: "Either file or external link is required" });
        }

        const newItem = await storage.createKnowledgeHubItem({
          title,
          category,
          contentType,
          fileUrl,
          externalLink,
          applicableTo,
          description,
          isActive: isActive !== undefined ? isActive : true,
          createdBy: user.id,
          oemId: user.oemId
        });

        // Create audit log
        await storage.createAuditLog({
          actorUserId: user.id,
          entity: 'knowledge_hub',
          entityId: newItem.id,
          action: 'CREATE'
        });

        res.status(201).json(newItem);
      } catch (error) {
        console.error("Error creating knowledge hub item:", error);
        res.status(500).json({ error: "Failed to create knowledge hub item" });
      }
    }
  );

  // Update knowledge hub item (admin only)
  app.patch("/api/knowledge-hub/:id", 
    authenticate, 
    requireOEMAccess,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN']),
    async (req, res) => {
      try {
        const { id } = req.params;
        const user = req.user!;
        const updates = req.body;

        const existingItem = await storage.getKnowledgeHubItem(id);
        if (!existingItem) {
          return res.status(404).json({ error: "Knowledge hub item not found" });
        }

        const updatedItem = await storage.updateKnowledgeHubItem(id, updates);

        // Create audit log
        await storage.createAuditLog({
          actorUserId: user.id,
          entity: 'knowledge_hub',
          entityId: id,
          action: 'UPDATE',
          diffJson: updates
        });

        res.json(updatedItem);
      } catch (error) {
        console.error("Error updating knowledge hub item:", error);
        res.status(500).json({ error: "Failed to update knowledge hub item" });
      }
    }
  );

  // Delete knowledge hub item (admin only)
  app.delete("/api/knowledge-hub/:id", 
    authenticate, 
    requireOEMAccess,
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN']),
    async (req, res) => {
      try {
        const { id } = req.params;
        const user = req.user!;

        const existingItem = await storage.getKnowledgeHubItem(id);
        if (!existingItem) {
          return res.status(404).json({ error: "Knowledge hub item not found" });
        }

        const deleted = await storage.deleteKnowledgeHubItem(id);

        if (!deleted) {
          return res.status(500).json({ error: "Failed to delete knowledge hub item" });
        }

        // Create audit log
        await storage.createAuditLog({
          actorUserId: user.id,
          entity: 'knowledge_hub',
          entityId: id,
          action: 'DELETE'
        });

        res.json({ success: true, message: "Knowledge hub item deleted successfully" });
      } catch (error) {
        console.error("Error deleting knowledge hub item:", error);
        res.status(500).json({ error: "Failed to delete knowledge hub item" });
      }
    }
  );

  // Increment view count
  app.post("/api/knowledge-hub/:id/view", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.incrementViewCount(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error incrementing view count:", error);
      res.status(500).json({ error: "Failed to increment view count" });
    }
  });

  // 🏷️ BRANDS ROUTES

  // Get all brands
  app.get("/api/p91/brand", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const brands = await storage.getBrands();
      res.json(brands);
    } catch (error) {
      console.error("Error fetching brands:", error);
      res.status(500).json({ error: "Failed to fetch brands" });
    }
  });

  // Get single brand
  app.get("/api/p91/brand/:id", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const brand = await storage.getBrand(id);
      
      if (!brand) {
        return res.status(404).json({ error: "Brand not found" });
      }

      res.json(brand);
    } catch (error) {
      console.error("Error fetching brand:", error);
      res.status(500).json({ error: "Failed to fetch brand" });
    }
  });

  // Create brand
  app.post("/api/p91/brand", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      // Check if brand with same name exists
      const existing = await storage.getBrandByName(name);

      if (existing) {
        return res.status(400).json({ error: "A brand with this name already exists" });
      }

      // Create new brand
      const newBrand = await storage.createBrand({ name, description });
      
      // Audit log
      await storage.createAuditLog({
        actorUserId: req.user?.id,
        entity: 'brand',
        entityId: newBrand.id,
        action: 'CREATE'
      });

      res.json({ status: "success", message: "Brand created successfully", data: newBrand });
    } catch (error) {
      console.error("Error creating brand:", error);
      res.status(500).json({ error: "Failed to create brand" });
    }
  });

  // Update brand
  app.put("/api/p91/brand/:id", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      // Check if another brand with same name exists
      const existing = await storage.getBrandByName(name);
      if (existing && existing.id !== id) {
        return res.status(400).json({ error: "A brand with this name already exists" });
      }

      const updated = await storage.updateBrand(id, { name, description });

      if (!updated) {
        return res.status(404).json({ error: "Brand not found" });
      }

      // Audit log
      await storage.createAuditLog({
        actorUserId: req.user?.id,
        entity: 'brand',
        entityId: id,
        action: 'UPDATE'
      });

      res.json({ status: "success", message: "Brand updated successfully", data: updated });
    } catch (error) {
      console.error("Error updating brand:", error);
      res.status(500).json({ error: "Failed to update brand" });
    }
  });

  // Delete brand
  app.delete("/api/p91/brand/:id", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteBrand(id);

      if (!deleted) {
        return res.status(404).json({ error: "Brand not found" });
      }

      // Audit log
      await storage.createAuditLog({
        actorUserId: req.user?.id,
        entity: 'brand',
        entityId: id,
        action: 'DELETE'
      });

      res.json({ status: "success", message: "Brand deleted successfully" });
    } catch (error) {
      console.error("Error deleting brand:", error);
      res.status(500).json({ error: "Failed to delete brand" });
    }
  });

  // 🧪 RAW MATERIALS ROUTES

  // Get all raw materials
  app.get("/api/p91/raw_material", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const materials = await storage.getRawMaterials();
      res.json(materials);
    } catch (error) {
      console.error("Error fetching raw materials:", error);
      res.status(500).json({ error: "Failed to fetch raw materials" });
    }
  });

  // Get single raw material
  app.get("/api/p91/raw_material/:id", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const material = await storage.getRawMaterial(id);
      
      if (!material) {
        return res.status(404).json({ error: "Raw material not found" });
      }

      res.json(material);
    } catch (error) {
      console.error("Error fetching raw material:", error);
      res.status(500).json({ error: "Failed to fetch raw material" });
    }
  });

  // Add or update raw material (upsert by name)
  app.post("/api/p91/raw_material/add", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { name, brandId } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      // Check if material exists
      const existing = await storage.getRawMaterialByName(name);

      if (existing) {
        // Update if brand changed
        if (brandId && existing.brandId !== brandId) {
          await storage.updateRawMaterial(existing.id, { brandId });
        }
        return res.json({ status: "success", message: "Material updated", id: existing.id });
      } else {
        // Create new
        const newMaterial = await storage.createRawMaterial({ name, brandId });
        return res.json({ status: "success", message: "Material created", id: newMaterial.id });
      }
    } catch (error) {
      console.error("Error adding/updating raw material:", error);
      res.status(500).json({ error: "Failed to add/update raw material" });
    }
  });

  // Update raw material
  app.put("/api/p91/raw_material/update/:id", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, brandId } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const updated = await storage.updateRawMaterial(id, { name, brandId });

      if (!updated) {
        return res.status(404).json({ error: "Raw material not found" });
      }

      res.json({ status: "success", message: "Material updated" });
    } catch (error) {
      console.error("Error updating raw material:", error);
      res.status(500).json({ error: "Failed to update raw material" });
    }
  });

  // Delete raw material
  app.delete("/api/p91/raw_material/delete/:id", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteRawMaterial(id);

      if (!deleted) {
        return res.status(404).json({ error: "Raw material not found" });
      }

      res.json({ status: "success", message: "Material deleted" });
    } catch (error) {
      console.error("Error deleting raw material:", error);
      res.status(500).json({ error: "Failed to delete raw material" });
    }
  });

  // Get raw materials for a service
  app.get("/api/p91/service/:serviceId/raw_materials", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const materials = await storage.getServiceRawMaterials(serviceId);
      res.json(materials);
    } catch (error) {
      console.error("Error fetching service raw materials:", error);
      res.status(500).json({ error: "Failed to fetch service raw materials" });
    }
  });

  // Add raw material to service
  app.post("/api/p91/service/:serviceId/raw_materials", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const { rawMaterialId } = req.body;

      if (!rawMaterialId) {
        return res.status(400).json({ error: "rawMaterialId is required" });
      }

      const mapping = await storage.addServiceRawMaterial(serviceId, rawMaterialId);
      res.json({ success: true, mapping });
    } catch (error) {
      console.error("Error adding service raw material:", error);
      res.status(500).json({ error: "Failed to add service raw material" });
    }
  });

  // Remove raw material from service
  app.delete("/api/p91/service/:serviceId/raw_materials/:rawMaterialId", authenticate, requireOEMAccess, async (req, res) => {
    try {
      const { serviceId, rawMaterialId } = req.params;
      const deleted = await storage.removeServiceRawMaterial(serviceId, rawMaterialId);

      if (!deleted) {
        return res.status(404).json({ error: "Mapping not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing service raw material:", error);
      res.status(500).json({ error: "Failed to remove service raw material" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
