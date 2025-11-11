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
import { authService, AuthUser } from "./auth";
import { emailService } from "./services/email-service";
import { whatsappService } from "./services/whatsapp-service";
import smsService from "./services/sms-service";
import { notificationService } from "./services/notificationService";
import { authenticate, requireRole, requireOEMAccess, auditLog, blockAdminDelete, hasStateAccess } from "./middleware";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { generateOTP, hashOTP, verifyOTP, getOTPExpiry } from "./utils/otp";
import multer from "multer";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";

// Helper function to generate username from email
function generateUsernameFromEmail(email: string): string {
  // Extract the part before @ and convert to lowercase
  return email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Server-side cache for dashboard endpoints (1-minute TTL)
interface CacheEntry {
  data: any;
  timestamp: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL = 60000; // 1 minute

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // Periodic cleanup of expired entries
  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(key);
      }
    }
  }
}

const dashboardCache = new SimpleCache();
// Run cleanup every 5 minutes
setInterval(() => dashboardCache.cleanup(), 300000);

// Configure multer for file uploads (Excel and CSV for imports)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.mimetype === 'application/vnd.ms-excel' ||
        file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel and CSV files are allowed'));
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

      // Smart bi-directional contact sync: Organization values are source of truth
      if (result.user) {
        const user = result.user;
        
        // For DEALERSHIP_ADMIN, sync contact info bi-directionally
        if (user.role === 'DEALERSHIP_ADMIN' && user.dealershipId) {
          const dealership = await storage.getDealership(user.dealershipId);
          if (dealership) {
            // PRIORITY 1: If organization has contact info, sync TO user and mark as verified
            if (dealership.contactEmail || dealership.contactPhone) {
              const userDb = await storage.getUser(user.id);
              const needsSync = 
                (dealership.contactEmail && userDb?.email !== dealership.contactEmail) ||
                (dealership.contactPhone && userDb?.phone !== dealership.contactPhone) ||
                !userDb?.emailVerified || !userDb?.phoneVerified;
              
              if (needsSync) {
                await storage.updateUser(user.id, {
                  email: dealership.contactEmail || userDb?.email || null,
                  phone: dealership.contactPhone || userDb?.phone || null,
                  emailVerified: !!dealership.contactEmail,
                  phoneVerified: !!dealership.contactPhone,
                });
              }
            } 
            // PRIORITY 2: If organization doesn't have contact info, sync FROM user
            else if (user.email || user.phone) {
              await storage.updateDealership(user.dealershipId, {
                contactEmail: user.email || null,
                contactPhone: user.phone || '',
              });
            }
          }
        }
        
        // For SHOWROOM_MANAGER, sync contact info bi-directionally
        if (user.role === 'SHOWROOM_MANAGER' && user.showroomId) {
          const showroom = await storage.getShowroom(user.showroomId);
          if (showroom) {
            // PRIORITY 1: If organization has contact info, sync TO user and mark as verified
            if (showroom.contactEmail || showroom.contactPhone) {
              const userDb = await storage.getUser(user.id);
              const needsSync = 
                (showroom.contactEmail && userDb?.email !== showroom.contactEmail) ||
                (showroom.contactPhone && userDb?.phone !== showroom.contactPhone) ||
                !userDb?.emailVerified || !userDb?.phoneVerified;
              
              if (needsSync) {
                await storage.updateUser(user.id, {
                  email: showroom.contactEmail || userDb?.email || null,
                  phone: showroom.contactPhone || userDb?.phone || null,
                  emailVerified: !!showroom.contactEmail,
                  phoneVerified: !!showroom.contactPhone,
                });
              }
            }
            // PRIORITY 2: If organization doesn't have contact info, sync FROM user
            else if (user.email || user.phone) {
              await storage.updateShowroom(user.showroomId, {
                contactEmail: user.email || null,
                contactPhone: user.phone || '',
              });
            }
          }
        }
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

  app.get("/api/auth/me", authenticate, async (req, res) => {
    try {
      // Fetch fresh user data from database instead of relying on stale JWT data
      const freshUser = await storage.getUser(req.user!.id);
      
      if (!freshUser || !freshUser.isActive) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      // Build fresh auth user object with latest data
      const authUser: AuthUser = {
        id: freshUser.id,
        email: freshUser.email,
        role: freshUser.role,
        name: freshUser.name,
        username: freshUser.username,
        oemId: freshUser.oemId || undefined,
        dealershipId: freshUser.dealershipId || undefined,
        showroomId: freshUser.showroomId || undefined,
        partnerId: freshUser.partnerId || undefined,
        allowedOemIds: freshUser.allowedOemIds || undefined,
        profileCompleted: freshUser.profileCompleted,
        emailVerified: freshUser.emailVerified,
        phoneVerified: freshUser.phoneVerified,
        phone: freshUser.phone || undefined,
      };

      // Disable caching to ensure fresh user data after profile updates
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.json({ user: authUser });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user data' });
    }
  });

  // OTP Verification Routes
  app.post("/api/auth/send-email-otp", authenticate, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.email) {
        return res.status(400).json({ error: "Email not set for this user. Please provide an email first." });
      }

      // Generate OTP
      const otp = generateOTP(6);
      const hashedOtp = await hashOTP(otp);
      
      // Delete any existing OTP verifications for this user and type
      const existing = await storage.getOtpVerification(userId, 'EMAIL');
      if (existing) {
        await storage.deleteOtpVerification(existing.id);
      }

      // Create OTP verification record
      await storage.createOtpVerification({
        userId,
        type: 'EMAIL',
        code: hashedOtp,
        expiresAt: getOTPExpiry(10),
        verified: false,
        attempts: 0
      });

      // Send OTP via email
      const emailSent = await emailService.sendOTPEmail(user.email, otp, 'verification');
      
      if (!emailSent) {
        return res.status(500).json({ error: "Failed to send OTP email" });
      }

      res.json({ message: "OTP sent successfully to your email" });
    } catch (error) {
      console.error("Send email OTP error:", error);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  app.post("/api/auth/verify-email-otp", authenticate, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { otp } = req.body;

      if (!otp) {
        return res.status(400).json({ error: "OTP is required" });
      }

      // Get OTP verification record
      const verification = await storage.getOtpVerification(userId, 'EMAIL');
      
      if (!verification) {
        return res.status(404).json({ error: "No OTP verification found. Please request a new OTP." });
      }

      // Check if expired
      if (new Date() > verification.expiresAt) {
        await storage.deleteOtpVerification(verification.id);
        return res.status(400).json({ error: "OTP has expired. Please request a new one." });
      }

      // Check attempts
      if (verification.attempts >= 3) {
        await storage.deleteOtpVerification(verification.id);
        return res.status(400).json({ error: "Too many failed attempts. Please request a new OTP." });
      }

      // Verify OTP
      const isValid = await verifyOTP(otp, verification.code);
      
      if (!isValid) {
        // Increment attempts
        await storage.updateOtpVerification(verification.id, {
          attempts: verification.attempts + 1
        });
        return res.status(400).json({ error: "Invalid OTP" });
      }

      // Mark as verified and update user
      await storage.updateOtpVerification(verification.id, { verified: true });
      await storage.updateUser(userId, { emailVerified: true });
      
      res.json({ message: "Email verified successfully" });
    } catch (error) {
      console.error("Verify email OTP error:", error);
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  app.post("/api/auth/send-sms-otp", authenticate, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.phone) {
        return res.status(400).json({ error: "Phone number not set for this user. Please provide a phone number first." });
      }

      // Generate OTP
      const otp = generateOTP(6);
      const hashedOtp = await hashOTP(otp);
      
      // Delete any existing OTP verifications for this user and type
      const existing = await storage.getOtpVerification(userId, 'SMS');
      if (existing) {
        await storage.deleteOtpVerification(existing.id);
      }

      // Create OTP verification record
      await storage.createOtpVerification({
        userId,
        type: 'SMS',
        code: hashedOtp,
        expiresAt: getOTPExpiry(10),
        verified: false,
        attempts: 0
      });

      // Send OTP via SMS
      const smsSent = await smsService.sendOTP(user.phone, otp);
      
      if (!smsSent) {
        return res.status(500).json({ error: "Failed to send OTP SMS. MessageBird service may not be configured." });
      }

      res.json({ message: "OTP sent successfully to your phone" });
    } catch (error) {
      console.error("Send SMS OTP error:", error);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  app.post("/api/auth/verify-sms-otp", authenticate, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { otp } = req.body;

      if (!otp) {
        return res.status(400).json({ error: "OTP is required" });
      }

      // Get OTP verification record
      const verification = await storage.getOtpVerification(userId, 'SMS');
      
      if (!verification) {
        return res.status(404).json({ error: "No OTP verification found. Please request a new OTP." });
      }

      // Check if expired
      if (new Date() > verification.expiresAt) {
        await storage.deleteOtpVerification(verification.id);
        return res.status(400).json({ error: "OTP has expired. Please request a new one." });
      }

      // Check attempts
      if (verification.attempts >= 3) {
        await storage.deleteOtpVerification(verification.id);
        return res.status(400).json({ error: "Too many failed attempts. Please request a new OTP." });
      }

      // Verify OTP
      const isValid = await verifyOTP(otp, verification.code);
      
      if (!isValid) {
        // Increment attempts
        await storage.updateOtpVerification(verification.id, {
          attempts: verification.attempts + 1
        });
        return res.status(400).json({ error: "Invalid OTP" });
      }

      // Mark as verified and update user
      await storage.updateOtpVerification(verification.id, { verified: true });
      await storage.updateUser(userId, { phoneVerified: true });
      
      res.json({ message: "Phone number verified successfully" });
    } catch (error) {
      console.error("Verify SMS OTP error:", error);
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  app.post("/api/auth/complete-profile", authenticate, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { email, phone, contactPersonName, address, city, state, pincode, gstNumber, billToAddress } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Validate that email and phone are verified before allowing profile completion
      if (!user.emailVerified || !user.phoneVerified) {
        return res.status(400).json({ 
          error: "Please verify your email and phone number before completing your profile",
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified
        });
      }

      // Check if email is already used by another user (excluding placeholder emails)
      if (email && !email.includes('@placeholder.local')) {
        const existingEmailUser = await storage.getUserByEmail(email);
        if (existingEmailUser && existingEmailUser.id !== userId) {
          return res.status(400).json({ error: "This email is already registered with another account" });
        }
      }

      // Check if phone is already used by another user
      if (phone) {
        const existingPhoneUser = await storage.getUserByPhone(phone);
        if (existingPhoneUser && existingPhoneUser.id !== userId) {
          return res.status(400).json({ error: "This phone number is already registered with another account" });
        }
      }

      // Update profile as completed
      await storage.updateUser(userId, { 
        profileCompleted: true,
        email: email || user.email,
        phone: phone || user.phone
      });

      // Update dealership/showroom details if applicable
      if (user.role === 'DEALERSHIP_ADMIN' && user.dealershipId) {
        const updateData: any = {
          contactPersonName,
          address,
          city,
          state,
          pincode
        };
        
        // Add billing address if provided (includes GST in the JSON)
        if (billToAddress || gstNumber) {
          updateData.billToAddress = {
            ...(typeof billToAddress === 'object' ? billToAddress : {}),
            gstNumber: gstNumber || null
          };
        }
        
        await storage.updateDealership(user.dealershipId, updateData);
      } else if (user.role === 'SHOWROOM_MANAGER' && user.showroomId) {
        const updateData: any = {
          contactPersonName,
          address,
          city,
          state,
          pincode
        };
        
        // Add billing address if provided (includes GST in the JSON)
        if (billToAddress || gstNumber) {
          updateData.billToAddress = {
            ...(typeof billToAddress === 'object' ? billToAddress : {}),
            gstNumber: gstNumber || null
          };
        }
        
        await storage.updateShowroom(user.showroomId, updateData);
      }
      
      res.json({ message: "Profile completed successfully" });
    } catch (error) {
      console.error("Complete profile error:", error);
      res.status(500).json({ error: "Failed to complete profile" });
    }
  });

  app.post("/api/auth/update-profile-data", authenticate, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { email, phone } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Update email and/or phone (will need to verify after)
      const updates: any = {};
      if (email && email !== user.email) {
        updates.email = email;
        updates.emailVerified = false; // Reset verification if email changes
      }
      if (phone && phone !== user.phone) {
        updates.phone = phone;
        updates.phoneVerified = false; // Reset verification if phone changes
      }

      if (Object.keys(updates).length > 0) {
        await storage.updateUser(userId, updates);
      }
      
      res.json({ message: "Profile data updated successfully" });
    } catch (error) {
      console.error("Update profile data error:", error);
      res.status(500).json({ error: "Failed to update profile data" });
    }
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

  // Create user (Super Admin and Admin only)
  app.post("/api/users",
    authenticate,
    requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']),
    auditLog('user', 'create'),
    async (req, res) => {
      try {
        const { password, ...userData } = req.body;

        // For MANAGER role, validate that they can only create sales persons for dealerships in their allowed states
        if (req.user?.role === 'MANAGER') {
          // MANAGER can only create SALES_PERSON role
          if (userData.role !== 'SALES_PERSON') {
            return res.status(403).json({ error: 'MANAGER can only create sales persons' });
          }

          // Validate dealership is in allowed states
          if (userData.dealershipId) {
            const dealership = await storage.getDealership(userData.dealershipId);
            if (!dealership) {
              return res.status(404).json({ error: 'Dealership not found' });
            }

            const allowedStates = (req.user.allowedStates as string[]) || [];
            if (!dealership.state || !allowedStates.includes(dealership.state)) {
              return res.status(403).json({ error: 'You can only create sales persons for dealerships in your allowed states' });
            }
          }

          // Validate showroom is in allowed states (via dealership)
          if (userData.showroomId) {
            const showroom = await storage.getShowroom(userData.showroomId);
            if (!showroom) {
              return res.status(404).json({ error: 'Showroom not found' });
            }

            const dealership = await storage.getDealership(showroom.dealershipId);
            if (!dealership) {
              return res.status(404).json({ error: 'Dealership not found for this showroom' });
            }

            const allowedStates = (req.user.allowedStates as string[]) || [];
            if (!dealership.state || !allowedStates.includes(dealership.state)) {
              return res.status(403).json({ error: 'You can only create sales persons for showrooms in your allowed states' });
            }
          }
        }

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

        // Auto-generate username from email
        const username = generateUsernameFromEmail(userData.email);

        // Create the user
        const newUser = await storage.createUser({
          ...userData,
          username,
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
  app.get("/api/oems", authenticate, requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'PARTNER_ADMIN', 'PARTNER_STAFF']), async (req, res) => {
    try {
      let oems = await storage.getOems();
      
      // Filter OEMs based on user role and access
      // MANAGER can see ALL OEMs (no filtering), but dealerships/showrooms are filtered by allowedStates
      if (req.user?.role === 'PARTNER_ADMIN' || req.user?.role === 'PARTNER_STAFF') {
        // For partner users, only return OEMs they have access to
        const allowedOemIds = req.user.allowedOemIds || [];
        oems = oems.filter(oem => allowedOemIds.includes(oem.id));
      }
      
      // Get counts for each OEM (only for super admins)
      if (req.user?.role === 'SUPER_ADMIN') {
        // Optimize: Get all dealerships and showrooms in 2 queries instead of 2*N queries
        const dealershipsResponse = await storage.getDealerships();
        const showroomsResponse = await storage.getShowrooms();
        
        // Extract arrays from paginated response
        const allDealerships = dealershipsResponse.dealerships || [];
        const allShowrooms = showroomsResponse.showrooms || [];
        
        // Count by OEM ID in memory
        const dealershipCountByOem = allDealerships.reduce((acc: Record<string, number>, d: any) => {
          const oemIds = d.oemIds || (d.oemId ? [d.oemId] : []);
          oemIds.forEach((oemId: string) => {
            acc[oemId] = (acc[oemId] || 0) + 1;
          });
          return acc;
        }, {} as Record<string, number>);
        
        const showroomCountByOem = allShowrooms.reduce((acc: Record<string, number>, s: any) => {
          const oemIds = s.oemIds || (s.oemId ? [s.oemId] : []);
          oemIds.forEach((oemId: string) => {
            acc[oemId] = (acc[oemId] || 0) + 1;
          });
          return acc;
        }, {} as Record<string, number>);
        
        const oemsWithCounts = oems.map(oem => ({
          ...oem,
          dealershipsCount: dealershipCountByOem[oem.id] || 0,
          showroomsCount: showroomCountByOem[oem.id] || 0
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
  app.get("/api/oems/:id", authenticate, requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'PARTNER_ADMIN', 'PARTNER_STAFF']), async (req, res) => {
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
            
            // Auto-generate username from email
            const username = generateUsernameFromEmail(adminUserData.email);
            
            const adminData = {
              name: adminUserData.name,
              username,
              email: adminUserData.email,
              phone: adminUserData.phone || '',
              passwordHash: hashedPassword,
              role: 'OEM_ADMIN' as const,
              oemId: oem.id,
              isActive: true
            };
            
            const createdUser = await storage.createUser(adminData);
            console.log(`Created admin user for OEM: ${oem.name} - Username: ${createdUser.username}, Email: ${createdUser.email}`);
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
    requireRole(['SUPER_ADMIN', 'ADMIN']),
    blockAdminDelete,
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
  app.get("/api/dealerships/filter-options", authenticate, requireRole(['SUPER_ADMIN', 'OEM_ADMIN']), async (req, res) => {
    try {
      const filterOptions = await storage.getDealershipFilterOptions();
      res.json(filterOptions);
    } catch (error) {
      console.error("Get dealership filter options error:", error);
      res.status(500).json({ error: "Failed to fetch filter options" });
    }
  });

  app.get("/api/dealerships", authenticate, requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN']), async (req, res) => {
    try {
      const { oemId, state, city, search, limit, offset } = req.query;
      
      // For MANAGER role, only allow filtering within their allowed states
      let stateFilter = state as string;
      if (req.user?.role === 'MANAGER') {
        const allowedStates = (req.user.allowedStates as string[]) || [];
        
        // If a state filter is provided, validate it's in allowed states
        if (stateFilter && !allowedStates.includes(stateFilter)) {
          return res.json({ dealerships: [], total: 0 });
        }
        
        // If no state filter provided, we need to fetch ALL dealerships that match allowed states
        // Since we can't pass multiple states to getDealerships, we'll fetch all and filter in memory
        if (!stateFilter && allowedStates.length > 0) {
          // Don't use pagination for MANAGER - fetch all dealerships to filter by state
          const allResults = await storage.getDealerships({
            oemId: oemId as string,
            state: undefined,
            city: city as string,
            search: search as string,
            limit: 10000, // Fetch all
            offset: undefined
          });
          
          // Filter by allowed states
          const filteredDealerships = allResults.dealerships.filter(d => 
            d.state && allowedStates.includes(d.state)
          );
          
          // Get dealership IDs for the filtered set
          const dealershipIds = filteredDealerships.map(d => d.id);
          
          if (dealershipIds.length === 0) {
            return res.json({ dealerships: [], total: 0 });
          }
          
          // Fetch all related data in bulk
          const [allShowrooms, allSalesStaff, oemMappingsMap] = await Promise.all([
            storage.getShowrooms({ limit: 10000 }).then(result => result.showrooms),
            storage.getUsers({ role: 'SALES_PERSON' }),
            storage.getDealershipOemsBulk(dealershipIds)
          ]);
          
          // Count in memory
          const showroomsByDealership = new Map<string, number>();
          allShowrooms.forEach((showroom: any) => {
            const count = showroomsByDealership.get(showroom.dealershipId) || 0;
            showroomsByDealership.set(showroom.dealershipId, count + 1);
          });
          
          const salesStaffByDealership = new Map<string, number>();
          allSalesStaff.forEach((staff: any) => {
            if (staff.dealershipId) {
              const count = salesStaffByDealership.get(staff.dealershipId) || 0;
              salesStaffByDealership.set(staff.dealershipId, count + 1);
            }
          });
          
          // Attach counts and OEM IDs
          const dealershipsWithCounts = filteredDealerships.map((dealership) => ({
            ...dealership,
            oemIds: oemMappingsMap.get(dealership.id) || [],
            showroomsCount: showroomsByDealership.get(dealership.id) || 0,
            salesStaffCount: salesStaffByDealership.get(dealership.id) || 0
          }));
          
          return res.json({
            dealerships: dealershipsWithCounts,
            total: dealershipsWithCounts.length
          });
        }
      }
      
      const result = await storage.getDealerships({
        oemId: oemId as string,
        state: stateFilter,
        city: city as string,
        search: search as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined
      });
      
      // Extract all dealership IDs
      const dealershipIds = result.dealerships.map(d => d.id);
      
      if (dealershipIds.length === 0) {
        return res.json({ dealerships: [], total: 0 });
      }
      
      // Fetch all related data in bulk (3 queries instead of N*3)
      const [allShowrooms, allSalesStaff, oemMappingsMap] = await Promise.all([
        // Fetch all showrooms for these dealerships in one query
        storage.getShowrooms({ limit: 10000 }).then(result => result.showrooms),
        // Fetch all sales staff for these dealerships in one query
        storage.getUsers({ role: 'SALES_PERSON' }),
        // Fetch all OEM mappings for these dealerships in ONE BULK query
        storage.getDealershipOemsBulk(dealershipIds)
      ]);
      
      // Count in memory
      const showroomsByDealership = new Map<string, number>();
      allShowrooms.forEach((showroom: any) => {
        const count = showroomsByDealership.get(showroom.dealershipId) || 0;
        showroomsByDealership.set(showroom.dealershipId, count + 1);
      });
      
      const salesStaffByDealership = new Map<string, number>();
      allSalesStaff.forEach((staff: any) => {
        if (staff.dealershipId) {
          const count = salesStaffByDealership.get(staff.dealershipId) || 0;
          salesStaffByDealership.set(staff.dealershipId, count + 1);
        }
      });
      
      // Attach counts and OEM IDs to each dealership
      const dealershipsWithCounts = result.dealerships.map((dealership) => ({
        ...dealership,
        oemIds: oemMappingsMap.get(dealership.id) || [],
        showroomsCount: showroomsByDealership.get(dealership.id) || 0,
        salesStaffCount: salesStaffByDealership.get(dealership.id) || 0
      }));
      
      res.json({
        dealerships: dealershipsWithCounts,
        total: result.total
      });
    } catch (error) {
      console.error("Get dealerships error:", error);
      res.status(500).json({ error: "Failed to fetch dealerships" });
    }
  });

  app.get("/api/dealerships/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      
      // Allow SUPER_ADMIN, OEM_ADMIN, and DEALERSHIP_ADMIN (for their own dealership only)
      if (!['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN'].includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      // If DEALERSHIP_ADMIN, ensure they're fetching their own dealership
      if (user.role === 'DEALERSHIP_ADMIN' && user.dealershipId !== id) {
        return res.status(403).json({ error: 'You can only view your own dealership' });
      }
      
      const dealership = await storage.getDealership(id);
      
      if (!dealership) {
        return res.status(404).json({ error: "Dealership not found" });
      }
      
      // Fetch associated OEM IDs
      const oemIds = await storage.getDealershipOems(id);
      
      // Fetch admin user for this dealership to get username
      const adminUsers = await storage.getUsers({ 
        dealershipId: id, 
        role: 'DEALERSHIP_ADMIN' 
      });
      const adminUsername = adminUsers[0]?.username || null;
      
      res.json({ ...dealership, oemIds, adminUsername });
    } catch (error) {
      console.error("Get dealership error:", error);
      res.status(500).json({ error: "Failed to fetch dealership" });
    }
  });

  app.post("/api/dealerships", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'ADMIN', 'OEM_ADMIN']),
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
              username: adminUserData.username, // Save username for login
              email: adminUserData.email,
              phone: adminUserData.phone || '',
              passwordHash: hashedPassword,
              role: 'DEALERSHIP_ADMIN' as const,
              oemId: userOemId, // Link to specified or first OEM
              dealershipId: dealership.id,
              isActive: true
            };
            
            const createdUser = await storage.createUser(adminData);
            console.log(`Created dealership admin user: ${createdUser.username} (${createdUser.email}) for ${dealership.name}`);
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

  // Bulk Upload Dealerships from CSV/Excel
  app.post("/api/dealerships/bulk-upload",
    authenticate,
    requireRole(['SUPER_ADMIN']),
    upload.single('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const fileBuffer = req.file.buffer;
        let records: Record<string, string>[] = [];
        
        // Detect file type and parse accordingly
        const isExcel = req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                        req.file.mimetype === 'application/vnd.ms-excel' ||
                        req.file.originalname.endsWith('.xlsx') ||
                        req.file.originalname.endsWith('.xls');
        
        if (isExcel) {
          // Parse Excel file
          const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          records = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' }) as Record<string, string>[];
        } else {
          // Parse CSV with proper handling of quotes and commas
          const csvContent = fileBuffer.toString('utf-8');
          records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_quotes: true
          }) as Record<string, string>[];
        }
        
        if (records.length === 0) {
          return res.status(400).json({ error: "File is empty or has no data rows" });
        }
        
        const results = {
          success: 0,
          failed: 0,
          errors: [] as string[]
        };

        // Process each row
        for (let i = 0; i < records.length; i++) {
          const record = records[i];

          try {
            const username = record.username?.trim();
            const dealershipName = record.dealership_name?.trim();
            const oemName = record.oem_name?.trim();
            
            if (!username) {
              results.errors.push(`Row ${i + 2}: Username is required`);
              results.failed++;
              continue;
            }

            if (!dealershipName) {
              results.errors.push(`Row ${i + 2}: Dealership name is required`);
              results.failed++;
              continue;
            }

            // Normalize username to lowercase
            const normalizedUsername = username.toLowerCase();

            // Check if username already exists
            const existingUser = await storage.getUserByUsername(normalizedUsername);
            if (existingUser) {
              results.errors.push(`Row ${i + 2}: Username '${username}' already exists`);
              results.failed++;
              continue;
            }

            // Find or default to Hyundai OEM
            let oemId = 'd5da06c1-bc99-48e0-a907-e8fe279a9f93'; // Default Hyundai ID
            if (oemName && oemName.trim()) {
              const allOems = await storage.getOems();
              const foundOem = allOems.find(oem => 
                oem.name.toLowerCase() === oemName.toLowerCase()
              );
              if (foundOem) {
                oemId = foundOem.id;
              } else {
                results.errors.push(`Row ${i + 2}: OEM '${oemName}' not found, using default Hyundai`);
              }
            }

            // Generate auto password: username@123
            const autoPassword = `${normalizedUsername}@123`;
            const passwordHash = await bcrypt.hash(autoPassword, 10);

            // Generate dealership code
            const dealershipCode = `DEAL_${normalizedUsername.toUpperCase()}`;

            // Create dealership with proper name
            const dealership = await storage.createDealership({
              name: dealershipName, // Use dealership name from CSV
              code: dealershipCode,
              username: normalizedUsername, // Store username in dealership table for easy lookup
              contactPersonName: dealershipName,
              contactEmail: '', // Initialize as empty string to allow editing later
              contactPhone: '',
              city: '',
              state: '',
              pincode: ''
            });

            // Map dealership to OEM
            await storage.setDealershipOems(dealership.id, [oemId]);

            // Create DEALERSHIP_ADMIN user with username login
            const userData = {
              name: dealershipName, // Use dealership name for user's name
              email: `${normalizedUsername}@placeholder.local`, // Temporary email, will be updated during profile completion
              phone: '',
              passwordHash,
              username: normalizedUsername,
              role: 'DEALERSHIP_ADMIN' as const,
              oemId,
              dealershipId: dealership.id,
              isActive: true,
              profileCompleted: false
            };

            await storage.createUser(userData);
            
            results.success++;
          } catch (error: any) {
            console.error(`Error processing row ${i + 2}:`, error);
            results.errors.push(`Row ${i + 2}: ${error.message || 'Unknown error'}`);
            results.failed++;
          }
        }

        res.json(results);
      } catch (error: any) {
        console.error("Bulk upload error:", error);
        res.status(500).json({ error: "Failed to process bulk upload" });
      }
    }
  );

  app.put("/api/dealerships/:id", 
    authenticate,
    auditLog('dealership', 'update'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const user = req.user!;
        
        // Check permissions: SUPER_ADMIN and OEM_ADMIN can update any dealership
        // DEALERSHIP_ADMIN can only update their own dealership and only certain fields
        if (!['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN'].includes(user.role)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        // If DEALERSHIP_ADMIN, ensure they're updating their own dealership
        if (user.role === 'DEALERSHIP_ADMIN' && user.dealershipId !== id) {
          return res.status(403).json({ error: 'You can only update your own dealership' });
        }
        
        const { resetPasswordData, oemIds, adminOemId, ...dealershipData } = req.body;
        
        // Update dealership data
        const dealership = await storage.updateDealership(id, dealershipData);
        
        if (!dealership) {
          return res.status(404).json({ error: "Dealership not found" });
        }
        
        // Auto-sync contact info to dealership admin user and mark profile as complete if all details are filled
        try {
          // Find the dealership admin user
          const dealershipAdmins = await storage.getUsersByDealership(id);
          const dealershipAdmin = dealershipAdmins.find(u => u.role === 'DEALERSHIP_ADMIN');
          
          if (dealershipAdmin) {
            const updateData: any = {};
            
            // Sync contactEmail to user's email if provided
            if (dealershipData.contactEmail !== undefined) {
              updateData.email = dealershipData.contactEmail;
              updateData.emailVerified = !!dealershipData.contactEmail;
            }
            
            // Sync contactPhone to user's phone if provided
            if (dealershipData.contactPhone !== undefined) {
              updateData.phone = dealershipData.contactPhone;
              updateData.phoneVerified = !!dealershipData.contactPhone;
            }
            
            // Check if all required fields are now filled in the dealership
            const hasAllRequiredFields = 
              dealership.contactEmail && 
              dealership.contactPhone && 
              dealership.contactPersonName && 
              dealership.address && 
              dealership.city && 
              dealership.state && 
              dealership.pincode;
            
            // If all required fields are filled, mark profile as complete
            if (hasAllRequiredFields) {
              updateData.profileCompleted = true;
            }
            
            if (Object.keys(updateData).length > 0) {
              await storage.updateUser(dealershipAdmin.id, updateData);
              console.log(`Auto-synced contact info to dealership admin user: ${dealershipAdmin.username}`, 
                hasAllRequiredFields ? '(Profile marked as complete)' : '');
            }
          }
        } catch (syncError) {
          console.error("Failed to sync contact info to dealership admin:", syncError);
          // Don't fail the dealership update if sync fails
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
            
            // Auto-generate username from email
            const username = generateUsernameFromEmail(req.body.createAdminUserData.email);
            
            const adminData = {
              name: req.body.createAdminUserData.name,
              username,
              email: req.body.createAdminUserData.email,
              phone: req.body.createAdminUserData.phone || '',
              passwordHash: hashedPassword,
              role: 'DEALERSHIP_ADMIN' as const,
              oemId: userOemId,
              dealershipId: dealership.id,
              isActive: true
            };
            
            const createdUser = await storage.createUser(adminData);
            console.log(`Created dealership admin user: ${createdUser.username} (${createdUser.email}) for ${dealership.name}`);
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
    requireRole(['SUPER_ADMIN', 'ADMIN', 'OEM_ADMIN']),
    blockAdminDelete,
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
  app.get("/api/showrooms/filter-options", authenticate, requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']), async (req, res) => {
    try {
      const filterOptions = await storage.getShowroomFilterOptions();
      res.json(filterOptions);
    } catch (error) {
      console.error("Get showroom filter options error:", error);
      res.status(500).json({ error: "Failed to fetch filter options" });
    }
  });

  app.get("/api/showrooms", authenticate, requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']), async (req, res) => {
    try {
      const { dealershipId, oemId, state, city, search, limit, offset } = req.query;
      
      // For MANAGER role, only allow filtering within their allowed states
      let stateFilter = state as string;
      if (req.user?.role === 'MANAGER') {
        const allowedStates = (req.user.allowedStates as string[]) || [];
        
        // If a state filter is provided, validate it's in allowed states
        if (stateFilter && !allowedStates.includes(stateFilter)) {
          return res.json({ showrooms: [], total: 0 });
        }
      }
      
      const result = await storage.getShowrooms({
        dealershipId: dealershipId as string,
        oemId: oemId as string,
        state: stateFilter,
        city: city as string,
        search: search as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined
      });
      
      // For MANAGER role, filter showrooms by dealership's allowed states
      if (req.user?.role === 'MANAGER' && !stateFilter) {
        const allowedStates = (req.user.allowedStates as string[]) || [];
        
        // Get all dealerships to check their states
        const dealershipsResponse = await storage.getDealerships();
        const dealershipStates = new Map<string, string>();
        for (const d of dealershipsResponse.dealerships) {
          if (d.state) dealershipStates.set(d.id, d.state);
        }
        
        // Filter showrooms based on dealership state
        result.showrooms = result.showrooms.filter(showroom => {
          const dealershipState = dealershipStates.get(showroom.dealershipId);
          return dealershipState && allowedStates.includes(dealershipState);
        });
        
        result.total = result.showrooms.length;
      }
      
      res.json(result);
    } catch (error) {
      console.error("Get showrooms error:", error);
      res.status(500).json({ error: "Failed to fetch showrooms" });
    }
  });

  app.post("/api/showrooms", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
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
              username: adminUserData.username, // Save username for login
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
            console.log(`Created showroom manager user: ${createdUser.username} (${createdUser.email}) for ${showroom.name}`);
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

  // Bulk Upload Showrooms from CSV/Excel
  app.post("/api/showrooms/bulk-upload",
    authenticate,
    requireRole(['SUPER_ADMIN']),
    upload.single('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const fileBuffer = req.file.buffer;
        let records: Record<string, string>[] = [];
        
        // Detect file type and parse accordingly
        const isExcel = req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                        req.file.mimetype === 'application/vnd.ms-excel' ||
                        req.file.originalname.endsWith('.xlsx') ||
                        req.file.originalname.endsWith('.xls');
        
        if (isExcel) {
          // Parse Excel file
          const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          records = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' }) as Record<string, string>[];
        } else {
          // Parse CSV with proper handling of quotes and commas
          const csvContent = fileBuffer.toString('utf-8');
          records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_quotes: true
          }) as Record<string, string>[];
        }
        
        if (records.length === 0) {
          return res.status(400).json({ error: "File is empty or has no data rows" });
        }
        
        console.log(`📊 Bulk upload: Parsed ${records.length} showroom records`);
        console.log('📋 First record sample:', records[0]);
        console.log('📋 Column headers:', Object.keys(records[0] || {}));
        
        const results = {
          success: 0,
          failed: 0,
          errors: [] as string[]
        };

        // Process each row
        // CSV Format: username,showroom_name,dealership_code,manager_name,email,phone,address,city,state,pincode,oe_dealer_code,parent_code,oem_region,bill_directly_to_showroom,bill_to_address,bill_to_city,bill_to_state,bill_to_pincode,bill_to_gstin,ship_to_address,ship_to_city,ship_to_state,ship_to_pincode,ship_to_gstin
        for (let i = 0; i < records.length; i++) {
          const record = records[i];

          try {
            const username = record.username?.trim() || '';
            const showroomName = record.showroom_name?.trim() || '';
            const dealershipCode = record.dealership_code?.trim() || '';
            const managerName = record.manager_name?.trim() || '';
            const email = record.email?.trim() || '';
            const phone = record.phone?.trim() || '';
            const address = record.address?.trim() || '';
            const city = record.city?.trim() || '';
            const state = record.state?.trim() || '';
            const pincode = record.pincode?.trim() || '';
            const oeDealerCode = record.oe_dealer_code?.trim() || '';
            const parentCode = record.parent_code?.trim() || '';
            const oemRegion = record.oem_region?.trim() || '';
            const billDirectlyToShowroom = record.bill_directly_to_showroom?.trim() || '';
            const billToAddress = record.bill_to_address?.trim() || '';
            const billToCity = record.bill_to_city?.trim() || '';
            const billToState = record.bill_to_state?.trim() || '';
            const billToPincode = record.bill_to_pincode?.trim() || '';
            const billToGstin = record.bill_to_gstin?.trim() || '';
            const shipToAddress = record.ship_to_address?.trim() || '';
            const shipToCity = record.ship_to_city?.trim() || '';
            const shipToState = record.ship_to_state?.trim() || '';
            const shipToPincode = record.ship_to_pincode?.trim() || '';
            const shipToGstin = record.ship_to_gstin?.trim() || '';
            
            if (!username) {
              results.errors.push(`Row ${i + 2}: Username is required`);
              results.failed++;
              continue;
            }

            if (!showroomName) {
              results.errors.push(`Row ${i + 2}: Showroom name is required`);
              results.failed++;
              continue;
            }

            if (!dealershipCode) {
              results.errors.push(`Row ${i + 2}: Dealership code is required`);
              results.failed++;
              continue;
            }

            // Normalize username to lowercase
            const normalizedUsername = username.toLowerCase();
            const normalizedDealershipCode = dealershipCode.toLowerCase();

            // Check if username already exists
            const existingUser = await storage.getUserByUsername(normalizedUsername);
            if (existingUser) {
              results.errors.push(`Row ${i + 2}: Username '${username}' already exists`);
              results.failed++;
              continue;
            }

            // Find dealership by username (now stored in dealerships table)
            const dealerships = await storage.getDealerships();
            const dealership = dealerships.find(d => d.username === normalizedDealershipCode);
            if (!dealership) {
              results.errors.push(`Row ${i + 2}: Dealership with username '${dealershipCode}' not found`);
              results.failed++;
              continue;
            }

            const dealershipId = dealership.id;
            
            // Get OEM from dealership mapping
            const dealershipOems = await storage.getDealershipOems(dealershipId);
            if (dealershipOems.length === 0) {
              results.errors.push(`Row ${i + 2}: Dealership '${dealershipCode}' has no OEM mapping`);
              results.failed++;
              continue;
            }
            const oemId = dealershipOems[0];

            // Generate auto password: username@123
            const autoPassword = `${normalizedUsername}@123`;
            const passwordHash = await bcrypt.hash(autoPassword, 10);

            // Generate showroom code
            const showroomCode = `SHOW_${normalizedUsername.toUpperCase()}`;

            // Parse billDirectlyToShowroom
            const billDirectly = billDirectlyToShowroom?.toLowerCase() === 'true';

            // Prepare billToAddress object
            const billToAddressObj = (billToAddress || billToCity || billToState || billToPincode || billToGstin) ? {
              addressLine1: billToAddress || '',
              city: billToCity || '',
              state: billToState || '',
              pincode: billToPincode || '',
              gstin: billToGstin || ''
            } : null;

            // Prepare shipToAddress object
            const shipToAddressObj = (shipToAddress || shipToCity || shipToState || shipToPincode || shipToGstin) ? {
              addressLine1: shipToAddress || '',
              city: shipToCity || '',
              state: shipToState || '',
              pincode: shipToPincode || '',
              gstin: shipToGstin || ''
            } : null;

            // Create showroom with all provided fields
            const showroom = await storage.createShowroom({
              name: showroomName,
              code: showroomCode,
              dealershipId,
              oemId,
              oeDealerCode: oeDealerCode || null,
              parentCode: parentCode || null,
              oemRegion: oemRegion || null,
              managerName: managerName || showroomName,
              contactEmail: email || null,
              contactPhone: phone || '',
              address: address || '',
              city: city || '',
              state: state || '',
              pincode: pincode || '',
              billToAddress: billToAddressObj,
              shipToAddress: shipToAddressObj,
              billDirectlyToShowroom: billDirectly
            });

            // Create SHOWROOM_MANAGER user with username login
            const userData = {
              name: showroomName, // Use showroom name for user's name
              email: email || `${normalizedUsername}@placeholder.local`, // Use provided email or placeholder
              phone: phone || '',
              passwordHash,
              username: normalizedUsername,
              role: 'SHOWROOM_MANAGER' as const,
              oemId,
              dealershipId,
              showroomId: showroom.id,
              isActive: true,
              profileCompleted: false
            };

            await storage.createUser(userData);
            
            results.success++;
          } catch (error: any) {
            console.error(`Error processing row ${i + 2}:`, error);
            results.errors.push(`Row ${i + 2}: ${error.message || 'Unknown error'}`);
            results.failed++;
          }
        }

        console.log(`✅ Bulk upload complete: ${results.success} success, ${results.failed} failed`);
        if (results.errors.length > 0) {
          console.log('❌ Errors:', results.errors);
        }
        
        res.json(results);
      } catch (error: any) {
        console.error("Bulk upload error:", error);
        res.status(500).json({ error: "Failed to process bulk upload" });
      }
    }
  );

  app.get("/api/showrooms/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      
      // Allow SUPER_ADMIN, OEM_ADMIN, DEALERSHIP_ADMIN, and SHOWROOM_MANAGER (for their own showroom only)
      if (!['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER'].includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      // If SHOWROOM_MANAGER, ensure they're fetching their own showroom
      if (user.role === 'SHOWROOM_MANAGER' && user.showroomId !== id) {
        return res.status(403).json({ error: 'You can only view your own showroom' });
      }
      
      const showroom = await storage.getShowroom(id);
      
      if (!showroom) {
        return res.status(404).json({ error: "Showroom not found" });
      }
      
      // Fetch admin user for this showroom to get username
      const adminUsers = await storage.getUsers({ 
        showroomId: id, 
        role: 'SHOWROOM_MANAGER' 
      });
      const adminUsername = adminUsers[0]?.username || null;
      
      res.json({ ...showroom, adminUsername });
    } catch (error) {
      console.error("Get showroom error:", error);
      res.status(500).json({ error: "Failed to fetch showroom" });
    }
  });

  app.put("/api/showrooms/:id", 
    authenticate,
    auditLog('showroom', 'update'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const user = req.user!;
        
        // Check permissions: SUPER_ADMIN, OEM_ADMIN, DEALERSHIP_ADMIN can update any showroom
        // SHOWROOM_MANAGER can only update their own showroom and only certain fields
        if (!['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER'].includes(user.role)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        // If SHOWROOM_MANAGER, ensure they're updating their own showroom
        if (user.role === 'SHOWROOM_MANAGER' && user.showroomId !== id) {
          return res.status(403).json({ error: 'You can only update your own showroom' });
        }
        
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
        
        // Auto-sync contact info to showroom manager user and mark profile as complete if all details are filled
        try {
          // Find the showroom manager user
          const showroomManagers = await storage.getUsersByShowroom(id);
          const showroomManager = showroomManagers.find(u => u.role === 'SHOWROOM_MANAGER');
          
          if (showroomManager) {
            const updateData: any = {};
            
            // Sync contactEmail to user's email if provided
            if (showroomData.contactEmail !== undefined) {
              updateData.email = showroomData.contactEmail;
              updateData.emailVerified = !!showroomData.contactEmail;
            }
            
            // Sync contactPhone to user's phone if provided
            if (showroomData.contactPhone !== undefined) {
              updateData.phone = showroomData.contactPhone;
              updateData.phoneVerified = !!showroomData.contactPhone;
            }
            
            // Check if all required fields are now filled in the showroom
            const hasAllRequiredFields = 
              showroom.contactEmail && 
              showroom.contactPhone && 
              showroom.contactPersonName && 
              showroom.address && 
              showroom.city && 
              showroom.state && 
              showroom.pincode;
            
            // If all required fields are filled, mark profile as complete
            if (hasAllRequiredFields) {
              updateData.profileCompleted = true;
            }
            
            if (Object.keys(updateData).length > 0) {
              await storage.updateUser(showroomManager.id, updateData);
              console.log(`Auto-synced contact info to showroom manager user: ${showroomManager.username}`, 
                hasAllRequiredFields ? '(Profile marked as complete)' : '');
            }
          }
        } catch (syncError) {
          console.error("Failed to sync contact info to showroom manager:", syncError);
          // Don't fail the showroom update if sync fails
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
            
            // Auto-generate username from email
            const username = generateUsernameFromEmail(adminUserData.email);
            
            const managerData = {
              name: adminUserData.name,
              username,
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
            console.log(`Created showroom manager user: ${createdUser.username} (${createdUser.email}) for ${showroom.name}`);
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
            
            // Auto-generate username from email
            const username = generateUsernameFromEmail(createAdminUserData.email);
            
            const managerData = {
              name: createAdminUserData.name,
              username,
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
            console.log(`Created showroom manager user: ${createdUser.username} (${createdUser.email}) for ${showroom.name}`);
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

  app.delete("/api/showrooms/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'ADMIN', 'OEM_ADMIN']),
    blockAdminDelete,
    auditLog('showroom', 'delete'),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        // Check for dependencies before deletion
        const dependencies = [];
        
        // Check for sales staff
        const salesStaff = await storage.getUsers({ showroomId: id });
        if (salesStaff && salesStaff.length > 0) {
          dependencies.push(`${salesStaff.length} sales staff member(s)`);
        }
        
        // Check for work orders
        const workOrders = await storage.getWorkOrders({ showroomId: id });
        if (workOrders && workOrders.length > 0) {
          dependencies.push(`${workOrders.length} work order(s)`);
        }
        
        // Check for allocations
        const allocations = await storage.getAllocations({ level: 'SHOWROOM', levelId: id });
        if (allocations && allocations.length > 0) {
          dependencies.push(`${allocations.length} partner allocation(s)`);
        }
        
        // If dependencies exist, return error with details
        if (dependencies.length > 0) {
          return res.status(400).json({ 
            error: "Cannot delete showroom with existing dependencies",
            details: `This showroom has: ${dependencies.join(', ')}. Please remove these first.`
          });
        }
        
        const success = await storage.deleteShowroom(id);
        
        if (!success) {
          return res.status(404).json({ error: "Showroom not found" });
        }
        
        res.json({ message: "Showroom deleted successfully" });
      } catch (error) {
        console.error("Delete showroom error:", error);
        res.status(500).json({ error: "Failed to delete showroom" });
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
          vehicleType: model.vehicleType || null,
          ppfQtyConsumption: model.ppfQtyConsumption || null,
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
    requireRole(['SUPER_ADMIN', 'ADMIN']),
    blockAdminDelete,
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
      let dealershipId: string | undefined;
      
      // Handle different user roles
      if (req.user!.role === 'SUPER_ADMIN') {
        const availableOems = await storage.getOems();
        if (availableOems.length === 0) return res.json([]);
        oemId = availableOems[0].id;
      } else {
        if (!req.user!.oemId) return res.status(400).json({ error: "OEM ID required" });
        oemId = req.user!.oemId;
        dealershipId = req.user!.dealershipId;
        showroomId = req.user!.showroomId;
      }
      
      // Check cache first
      const cacheKey = `orders-trend:${oemId}:${showroomId || 'all'}:${dealershipId || 'all'}`;
      const cachedData = dashboardCache.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }
      
      const data = await storage.getOrdersRevenueTrend(oemId, showroomId, dealershipId);
      dashboardCache.set(cacheKey, data);
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
      
      // Check cache first
      const cacheKey = `dealership-performance:${oemId}`;
      const cachedData = dashboardCache.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }
      
      const data = await storage.getDealershipPerformance(oemId);
      dashboardCache.set(cacheKey, data);
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
      
      // Check cache first
      const cacheKey = `vehicle-upsells:${oemId}`;
      const cachedData = dashboardCache.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }
      
      const data = await storage.getVehicleCategoryUpsells(oemId);
      dashboardCache.set(cacheKey, data);
      res.json(data);
    } catch (error) {
      console.error("Vehicle upsells error:", error);
      res.status(500).json({ error: "Failed to fetch vehicle upsells data" });
    }
  });

  app.get("/api/dashboard/charts/territory-performance", authenticate, async (req, res) => {
    try {
      let oemId: string;
      let dealershipId: string | undefined;
      let showroomId: string | undefined;
      
      if (req.user!.role === 'SUPER_ADMIN') {
        const availableOems = await storage.getOems();
        if (availableOems.length === 0) return res.json([]);
        oemId = availableOems[0].id;
      } else {
        if (!req.user!.oemId) return res.status(400).json({ error: "OEM ID required" });
        oemId = req.user!.oemId;
        dealershipId = req.user!.dealershipId;
        showroomId = req.user!.showroomId;
      }
      
      // Check cache first
      const cacheKey = `territory-performance:${oemId}:${dealershipId || 'all'}:${showroomId || 'all'}`;
      const cachedData = dashboardCache.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }
      
      const data = await storage.getTerritoryPerformance(oemId, dealershipId, showroomId);
      dashboardCache.set(cacheKey, data);
      res.json(data);
    } catch (error) {
      console.error("Territory performance error:", error);
      res.status(500).json({ error: "Failed to fetch territory performance data" });
    }
  });

  app.get("/api/dashboard/charts/service-popularity", authenticate, async (req, res) => {
    try {
      let oemId: string;
      let dealershipId: string | undefined;
      let showroomId: string | undefined;
      
      if (req.user!.role === 'SUPER_ADMIN') {
        const availableOems = await storage.getOems();
        if (availableOems.length === 0) return res.json([]);
        oemId = availableOems[0].id;
      } else {
        if (!req.user!.oemId) return res.status(400).json({ error: "OEM ID required" });
        oemId = req.user!.oemId;
        dealershipId = req.user!.dealershipId;
        showroomId = req.user!.showroomId;
      }
      
      // Check cache first
      const cacheKey = `service-popularity:${oemId}:${showroomId || 'all'}:${dealershipId || 'all'}`;
      const cachedData = dashboardCache.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }
      
      const data = await storage.getServicePopularity(oemId, showroomId, dealershipId);
      dashboardCache.set(cacheKey, data);
      res.json(data);
    } catch (error) {
      console.error("Service popularity error:", error);
      res.status(500).json({ error: "Failed to fetch service popularity data" });
    }
  });

  app.get("/api/dashboard/charts/monthly-trends", authenticate, async (req, res) => {
    try {
      let oemId: string;
      let dealershipId: string | undefined;
      let showroomId: string | undefined;
      
      if (req.user!.role === 'SUPER_ADMIN') {
        const availableOems = await storage.getOems();
        if (availableOems.length === 0) return res.json([]);
        oemId = availableOems[0].id;
      } else {
        if (!req.user!.oemId) return res.status(400).json({ error: "OEM ID required" });
        oemId = req.user!.oemId;
        dealershipId = req.user!.dealershipId;
        showroomId = req.user!.showroomId;
      }
      
      // Check cache first
      const cacheKey = `monthly-trends:${oemId}:${showroomId || 'all'}:${dealershipId || 'all'}`;
      const cachedData = dashboardCache.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }
      
      const data = await storage.getMonthlyTrends(oemId, showroomId, dealershipId);
      dashboardCache.set(cacheKey, data);
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

      let workOrders = await storage.getWorkOrders(filters);
      
      // For MANAGER role, filter work orders by allowed states
      if (req.user!.role === 'MANAGER') {
        const allowedStates = (req.user!.allowedStates as string[]) || [];
        
        // Get showrooms and dealerships to check states
        const showroomIds = workOrders.map(wo => wo.showroomId).filter(Boolean);
        const showroomsResponse = await storage.getShowrooms({ limit: 10000 });
        const showroomDealershipMap = new Map<string, string>();
        showroomsResponse.showrooms.forEach(s => showroomDealershipMap.set(s.id, s.dealershipId));
        
        const dealershipIds = [...new Set([
          ...workOrders.map(wo => wo.dealershipId),
          ...showroomIds.map(sid => showroomDealershipMap.get(sid))
        ])].filter(Boolean);
        
        const dealershipsResponse = await storage.getDealerships();
        const dealershipStates = new Map<string, string>();
        dealershipsResponse.dealerships.forEach(d => {
          if (d.state) dealershipStates.set(d.id, d.state);
        });
        
        // Filter work orders based on dealership/showroom state
        workOrders = workOrders.filter(wo => {
          let dealershipId = wo.dealershipId;
          if (!dealershipId && wo.showroomId) {
            dealershipId = showroomDealershipMap.get(wo.showroomId) || '';
          }
          const state = dealershipStates.get(dealershipId);
          return state && allowedStates.includes(state);
        });
      }
      
      res.json(workOrders);
    } catch (error) {
      console.error("Get work orders error:", error);
      res.status(500).json({ error: "Failed to fetch work orders" });
    }
  });

  app.post("/api/work-orders", 
    authenticate, 
    requireRole(['SHOWROOM_MANAGER', 'DEALERSHIP_ADMIN', 'MANAGER', 'SUPER_ADMIN', 'PARTNER_ADMIN']),
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

        // ✅ NEW: MANAGER validation - ensure showroom/dealership is in allowed states
        if (req.user!.role === 'MANAGER') {
          const allowedStates = (req.user!.allowedStates as string[]) || [];
          
          if (workOrderData.showroomId) {
            // Validate showroom belongs to a dealership in allowed states
            const showroom = await storage.getShowroom(workOrderData.showroomId);
            if (!showroom) {
              return res.status(404).json({ error: "Showroom not found" });
            }
            
            const dealership = await storage.getDealership(showroom.dealershipId);
            if (!dealership || !dealership.state || !allowedStates.includes(dealership.state)) {
              return res.status(403).json({ error: "Access denied - showroom is not in your allowed states" });
            }
          } else if (workOrderData.dealershipId) {
            // Validate dealership is in allowed states
            const dealership = await storage.getDealership(workOrderData.dealershipId);
            if (!dealership || !dealership.state || !allowedStates.includes(dealership.state)) {
              return res.status(403).json({ error: "Access denied - dealership is not in your allowed states" });
            }
          }
        }

        // ✅ NEW: DEALERSHIP_ADMIN validation - ensure showroom belongs to their dealership
        if (req.user!.role === 'DEALERSHIP_ADMIN' && req.user!.dealershipId) {
          if (!workOrderData.showroomId) {
            return res.status(400).json({ error: "Showroom is required for dealership users" });
          }
          
          // Verify the showroom belongs to this dealership
          const showroom = await storage.getShowroom(workOrderData.showroomId);
          if (!showroom) {
            return res.status(404).json({ error: "Showroom not found" });
          }
          
          if (showroom.dealershipId !== req.user!.dealershipId) {
            return res.status(403).json({ error: "Access denied - showroom does not belong to your dealership" });
          }
          
          console.log(`✅ DEALERSHIP ACCESS: Dealership ${req.user!.dealershipId} creating work order for their showroom ${showroom.name}`);
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

  app.post("/api/work-orders/:id/cancel", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
    auditLog('work_order', 'cancel'),
    async (req, res) => {
      try {
        const { reason } = req.body;
        if (!reason || reason.trim().length === 0) {
          return res.status(400).json({ error: "Cancellation reason is required" });
        }

        const { workOrderService } = await import('./services/workOrderService');
        const workOrder = await workOrderService.cancelWorkOrder(req.params.id, req.user!.id, reason);
        res.json(workOrder);
      } catch (error: any) {
        console.error("Cancel work order error:", error);
        res.status(500).json({ error: error.message || "Failed to cancel work order" });
      }
    }
  );

  app.post("/api/work-orders/:id/allocate", 
    authenticate, 
    requireRole(['SUPER_ADMIN']),
    auditLog('work_order', 'manual_allocate'),
    async (req, res) => {
      try {
        const { partnerId } = req.body;
        if (!partnerId) {
          return res.status(400).json({ error: "Partner ID is required" });
        }

        const { workOrderService } = await import('./services/workOrderService');
        const workOrder = await workOrderService.allocatePartnerManually(req.params.id, partnerId, req.user!.id);
        res.json(workOrder);
      } catch (error: any) {
        console.error("Manual allocate work order error:", error);
        res.status(500).json({ error: error.message || "Failed to allocate partner" });
      }
    }
  );

  app.put("/api/work-orders/:id", 
    authenticate, 
    requireRole(['SHOWROOM_MANAGER', 'DEALERSHIP_ADMIN', 'SUPER_ADMIN', 'SALES_PERSON']),
    requireOEMAccess,
    auditLog('work_order', 'update'),
    async (req, res) => {
      try {
        // First fetch the work order to check its status
        const existingWorkOrder = await storage.getWorkOrder(req.params.id);
        
        if (!existingWorkOrder) {
          return res.status(404).json({ error: "Work order not found" });
        }

        // Only allow editing DRAFT work orders
        if (existingWorkOrder.status !== 'DRAFT') {
          return res.status(400).json({ error: "Only DRAFT work orders can be edited" });
        }

        const updates = req.body;
        delete updates.id; // Prevent ID modification
        delete updates.status; // Prevent status modification through this endpoint
        
        // Convert empty strings to null for UUID fields
        const uuidFields = ['salesPersonId', 'vehicleVariantId', 'assignedPartnerId', 'assignedJobCardId'];
        uuidFields.forEach(field => {
          if (updates[field] === '') {
            updates[field] = null;
          }
        });
        
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
        
        // Send WhatsApp & Email notification to the assigned installer
        notificationService.sendJobCardAssignedToInstaller(updatedJobCard, assignedInstallerId).catch(error => {
          console.error('Failed to send installer assignment notification:', error);
        });
        
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

        // ⚡ Respond immediately
        res.status(201).json(jobCard);

        // 🔥 Send WhatsApp notification in background (non-blocking)
        if (workOrder && jobCard) {
          setImmediate(async () => {
            try {
              const partner = await storage.getPartner(jobCard.partnerId);
              const vehicleModel = await storage.getVehicleModel(workOrder.vehicleModelId);
              const service = await storage.getService(workOrder.serviceId);
              const showroom = await storage.getShowroom(workOrder.showroomId || '');
              
              const vehicleDetails = `${vehicleModel?.modelName || 'Vehicle'} - ${workOrder.color || 'N/A'}`;
              const partnerName = partner?.displayName || 'Partner';
              const serviceName = service?.name || 'Service';
              const showroomName = showroom?.name || 'Showroom';
              const jobCardLink = `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/job-cards/${jobCard.id}`;
              
              // Send to partner if phone available
              if (partner?.phone) {
                await whatsappService.sendJobCardCreated(
                  whatsappService.formatPhoneNumber(partner.phone),
                  partnerName,
                  jobCard.id.slice(0, 8),
                  vehicleDetails,
                  showroomName,
                  serviceName,
                  jobCardLink
                );
                console.log(`✅ WhatsApp (Job Created) sent to partner ${partnerName}`);
              }
            } catch (whatsappError) {
              console.error('WhatsApp notification failed:', whatsappError);
            }
          });
        }
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

        // ⚡ RESPOND IMMEDIATELY - Don't wait for notifications!
        res.json({ message: "Job card approved successfully", jobCard: updatedJobCard });

        // 🔥 FIRE ALL SLOW OPERATIONS IN BACKGROUND (non-blocking)
        setImmediate(async () => {
          try {
            // 💰 Calculate OEM Royalty automatically on job card approval
            let finalPrice = 0;
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
              
              finalPrice = dealershipPricing?.priceAmount || workOrder.estimatedPrice || 0;
              
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
            }

            // 💰 Calculate and update Sales Commission on job card approval
            try {
              if (workOrder.salesPersonId) {
                const { commissionService } = await import('./services/commissionService');
                
                // Calculate commission amount using final dealership price
                const commission = await commissionService.calculateCommission(
                  workOrder.showroomId,
                  workOrder.salesPersonId,
                  workOrder.serviceId,
                  Number(finalPrice)
                );
                
                const commissionAmount = commission.amount;
                console.log(`💰 Commission calculated: ₹${commissionAmount} for sales person ${workOrder.salesPersonId}`);
                
                // Update existing commission instead of creating duplicate
                if (commissionAmount > 0) {
                  const existingCommissions = await storage.getCommissions({ workOrderId: workOrder.id });
                  
                  if (existingCommissions.commissions.length > 0) {
                    // Update existing commission with final amounts
                    await storage.updateCommission(existingCommissions.commissions[0].id, {
                      computedAmount: commissionAmount,
                      status: 'COMPUTED'
                    });
                    console.log(`✅ Updated existing commission to COMPUTED status with final amount: ₹${commissionAmount}`);
                  } else {
                    // Fallback: create commission if somehow none exists
                    if (commission.rule) {
                      await storage.createCommission({
                        workOrderId: workOrder.id,
                        showroomId: workOrder.showroomId,
                        salesPersonId: workOrder.salesPersonId,
                        basis: commission.rule.type,
                        value: Number(commission.rule.valueNumeric),
                        computedAmount: commissionAmount,
                        status: 'COMPUTED'
                      });
                      console.log(`⚠️ No existing commission found, created new COMPUTED commission: ₹${commissionAmount}`);
                    }
                  }
                }
              } else {
                console.log(`ℹ️ No sales person assigned, skipping commission calculation`);
              }
            } catch (commissionError) {
              console.error('❌ Error calculating/updating commission:', commissionError);
            }

            // 📧 Send email notifications in background
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
              
              // Get vehicle model details for email
              const vehicleModel = await storage.getVehicleModel(workOrder.vehicleModelId);
              const vehicleDetails = vehicleModel 
                ? `${vehicleModel.modelName}${workOrder.regNo ? ` (${workOrder.regNo})` : ''}`
                : `Vehicle ${workOrder.regNo || workOrder.customerName}`;
              
              // Send professional email to stakeholders using the same template
              for (const stakeholder of stakeholders) {
                if (stakeholder.email) {
                  await emailService.sendJobCardApprovalNotification(
                    stakeholder.email,
                    {
                      jobCardId: updatedJobCard.id,
                      workOrderNumber: workOrder.workOrderNumber || workOrder.id.slice(0, 8),
                      vehicleDetails: vehicleDetails,
                      approvedAt: updatedJobCard.approvedAt || new Date(),
                      approvedBy: req.user!.name || req.user!.email,
                      payoutAmount: payoutAmount
                    }
                  );
                }
              }
              console.log(`📧 Sent job card approval emails to ${stakeholders.length} stakeholders`);
            } catch (emailError) {
              console.error("Failed to send approval email:", emailError);
            }

            // 📱 WhatsApp Notification: Job Card Approved
            try {
              const partner = await storage.getPartner(jobCard.partnerId);
              const vehicleModel = await storage.getVehicleModel(workOrder.vehicleModelId);
              
              const vehicleDetails = `${vehicleModel?.modelName || 'Vehicle'} - ${workOrder.color || 'N/A'}`;
              const jobCardLink = `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/job-cards/${updatedJobCard.id}`;
              
              if (partner?.phone) {
                await whatsappService.sendJobCardApproved(
                  whatsappService.formatPhoneNumber(partner.phone),
                  partner.displayName,
                  updatedJobCard.id.slice(0, 8),
                  vehicleDetails,
                  payoutAmount,
                  jobCardLink
                );
                console.log(`✅ WhatsApp (Job Approved) sent to partner ${partner.displayName}`);
              }
            } catch (whatsappError) {
              console.error('❌ WhatsApp notification failed:', whatsappError);
            }
          } catch (bgError) {
            console.error('❌ Background task error:', bgError);
          }
        });
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

      // WhatsApp notification for scheduled not needed (no Meta-approved template)
      console.log(`ℹ️ Job card ${jobCard.id} scheduled for ${scheduledAt.toLocaleDateString('en-IN')}`);

      res.json(jobCard);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid schedule data", details: error.errors });
      }
      console.error("Schedule job card error:", error);
      res.status(500).json({ error: "Failed to schedule job card" });
    }
  });

  // Pre-installation photo upload endpoint
  app.post("/api/job-cards/:id/pre-installation", authenticate, async (req, res) => {
    try {
      const { photoFrontUrl, photoBackUrl, photoLeftUrl, photoRightUrl, remarks } = req.body;

      // Validate that all 4 photos are provided
      if (!photoFrontUrl || !photoBackUrl || !photoLeftUrl || !photoRightUrl) {
        return res.status(400).json({ error: "All 4 photos are required (Front, Back, Left, Right)" });
      }

      const objectStorageService = new ObjectStorageService();

      // Normalize and set ACL for all photos (public so they can be viewed by all stakeholders)
      const normalizedPhotoFront = await objectStorageService.trySetObjectEntityAclPolicy(
        photoFrontUrl,
        { visibility: "public", owner: req.user!.id }
      );
      const normalizedPhotoBack = await objectStorageService.trySetObjectEntityAclPolicy(
        photoBackUrl,
        { visibility: "public", owner: req.user!.id }
      );
      const normalizedPhotoLeft = await objectStorageService.trySetObjectEntityAclPolicy(
        photoLeftUrl,
        { visibility: "public", owner: req.user!.id }
      );
      const normalizedPhotoRight = await objectStorageService.trySetObjectEntityAclPolicy(
        photoRightUrl,
        { visibility: "public", owner: req.user!.id }
      );

      // Update job card with pre-installation data
      const jobCard = await storage.updateJobCard(req.params.id, {
        preInstallationPhotoFront: normalizedPhotoFront,
        preInstallationPhotoBack: normalizedPhotoBack,
        preInstallationPhotoLeft: normalizedPhotoLeft,
        preInstallationPhotoRight: normalizedPhotoRight,
        preInstallationRemarks: remarks || null,
        preInstallationCompletedAt: new Date(),
        preInstallationCompletedBy: req.user!.id
      });

      if (!jobCard) {
        return res.status(404).json({ error: "Job card not found" });
      }

      console.log(`✅ Pre-installation inspection completed for job card ${jobCard.id}`);

      res.json(jobCard);
    } catch (error) {
      console.error("Pre-installation upload error:", error);
      res.status(500).json({ error: "Failed to upload pre-installation photos" });
    }
  });

  app.post("/api/job-cards/:id/start", authenticate, async (req, res) => {
    try {
      // Check if pre-installation is completed
      const existingJobCard = await storage.getJobCard(req.params.id);
      if (!existingJobCard) {
        return res.status(404).json({ error: "Job card not found" });
      }

      // Verify pre-installation is completed before allowing start
      if (!existingJobCard.preInstallationCompletedAt) {
        return res.status(400).json({ error: "Pre-installation inspection must be completed before starting work" });
      }

      const jobCard = await storage.updateJobCard(req.params.id, {
        status: 'IN_PROGRESS',
        startedAt: new Date()
      });
      
      if (!jobCard) {
        return res.status(404).json({ error: "Job card not found" });
      }

      // 🔄 Update work order status to IN_PROGRESS when job card starts
      await storage.updateWorkOrder(jobCard.workOrderId, {
        status: 'IN_PROGRESS'
      });
      console.log(`🔄 Work order ${jobCard.workOrderId} status synced to IN_PROGRESS`);

      // WhatsApp notification for started not needed (no Meta-approved template)
      console.log(`ℹ️ Job card ${jobCard.id} started`);

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
          
          // Get vehicle model details
          const vehicleModel = await storage.getVehicleModel(workOrder.vehicleModelId);
          const jobCardLink = `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/job-cards/${jobCard.id}`;
          
          for (const stakeholder of stakeholders) {
            if (stakeholder.email) {
              await emailService.sendJobCardCompletionNotification(
                stakeholder.email,
                {
                  jobCardId: jobCard.id,
                  workOrderNumber: workOrder.workOrderNumber || workOrder.id.slice(0, 8),
                  vehicleDetails: {
                    modelName: vehicleModel?.modelName || 'Unknown Vehicle',
                    regNo: workOrder.regNo || 'N/A'
                  },
                  completedAt: jobCard.completedAt || new Date(),
                  partnerName: (await storage.getPartner(jobCard.partnerId))?.displayName || 'Partner',
                  jobCardLink
                }
              );
            }
          }
          console.log(`📧 Sent job card completion emails to ${stakeholders.length} stakeholders`);
        }
      } catch (emailError) {
        console.error("Failed to send completion email to stakeholders:", emailError);
      }

      // 📱 WhatsApp Notification: Job Card Completed - Send to order placer
      try {
        await notificationService.sendJobCardCompleted(jobCard);
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

  // E-Warranty Request Endpoint (Partner initiates warranty application)
  app.post("/api/job-cards/:id/request-e-warranty",
    authenticate,
    auditLog('job_card', 'request_e_warranty'),
    async (req, res) => {
      try {
        const jobCardId = req.params.id;
        
        // Get job card with validation
        const jobCard = await storage.getJobCard(jobCardId);
        if (!jobCard) {
          return res.status(404).json({ error: "Job card not found" });
        }

        // Validate job card is approved/completed and partner billed directly
        if (!['PENDING_SALES_INVOICE', 'APPROVED', 'INVOICE_RAISED', 'WARRANTY_REGISTRATION', 'PAYMENT_PENDING'].includes(jobCard.status)) {
          return res.status(400).json({ 
            error: "E-Warranty can only be applied for approved job cards",
            currentStatus: jobCard.status 
          });
        }

        if (!jobCard.partnerBilledDirectly) {
          return res.status(400).json({ 
            error: "E-Warranty application is only available when partner bills customer directly" 
          });
        }

        if (jobCard.eWarrantyApplied) {
          return res.status(400).json({ 
            error: "E-Warranty has already been applied for this job card" 
          });
        }

        // Update job card with e-warranty applied and change status
        const updatedJobCard = await storage.updateJobCard(jobCardId, {
          eWarrantyApplied: true,
          eWarrantyAppliedAt: new Date(),
          status: 'WARRANTY_REGISTRATION'
        });

        if (!updatedJobCard) {
          return res.status(500).json({ error: "Failed to apply e-warranty" });
        }

        // Sync work order status to match job card status
        await storage.updateWorkOrder(jobCard.workOrderId, {
          status: 'WARRANTY_REGISTRATION'
        });

        // Send e-warranty notification emails asynchronously
        setImmediate(async () => {
          try {
            const { emailService } = await import('./services/email-service');
            const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
            
            if (workOrder) {
              const vehicleModel = await storage.getVehicleModel(workOrder.vehicleModelId);
              const partner = await storage.getPartner(jobCard.partnerId);
              const oem = workOrder.oemId ? await storage.getOem(workOrder.oemId) : null;
              
              const jobCardDetails = {
                jobCardId: jobCard.id,
                workOrderNumber: workOrder.workOrderNumber || `WO-${workOrder.id.slice(-6)}`,
                customerName: workOrder.customerName || 'N/A',
                customerPhone: workOrder.customerPhone || 'N/A',
                customerEmail: workOrder.customerEmail || 'N/A',
                vehicleDetails: {
                  modelName: vehicleModel?.modelName || 'Unknown Vehicle',
                  brand: oem?.name || 'N/A',
                  regNo: workOrder.regNo || 'N/A'
                },
                serviceName: workOrder.serviceName || 'N/A',
                partnerName: partner?.displayName || 'Partner',
                completedAt: jobCard.completedAt || new Date(),
                approvedAt: jobCard.approvedAt || new Date(),
                eWarrantyAppliedAt: updatedJobCard.eWarrantyAppliedAt || new Date()
              };

              // Send to both recipients
              await Promise.all([
                emailService.sendEWarrantyNotification('justsignssocial@gmail.com', jobCardDetails),
                emailService.sendEWarrantyNotification('info@stek-india.in', jobCardDetails)
              ]);
              
              console.log(`✅ E-Warranty application emails sent for job card ${jobCardId}`);
            }
          } catch (emailError) {
            console.error("Failed to send e-warranty notification emails:", emailError);
          }
        });

        res.json(updatedJobCard);
      } catch (error) {
        console.error("Apply e-warranty error:", error);
        res.status(500).json({ error: "Failed to apply e-warranty" });
      }
    }
  );

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
      
      let partners = await storage.getPartners(filters);
      
      // For MANAGER role, filter partners based on allocations to allowed dealerships
      if (req.user!.role === 'MANAGER') {
        const allowedStates = (req.user!.allowedStates as string[]) || [];
        
        // Get allocations for all partners
        const allocations = await storage.getAllocations({});
        
        // Get dealerships to check states
        const dealershipsResponse = await storage.getDealerships();
        const dealershipStates = new Map<string, string>();
        dealershipsResponse.dealerships.forEach(d => {
          if (d.state) dealershipStates.set(d.id, d.state);
        });
        
        // Get showrooms to map to dealerships
        const showroomsResponse = await storage.getShowrooms({ limit: 10000 });
        const showroomDealershipMap = new Map<string, string>();
        showroomsResponse.showrooms.forEach(s => showroomDealershipMap.set(s.id, s.dealershipId));
        
        // Filter partners based on allocations
        const allowedPartnerIds = new Set<string>();
        for (const allocation of allocations) {
          let dealershipId = '';
          if (allocation.level === 'DEALERSHIP') {
            dealershipId = allocation.levelId;
          } else if (allocation.level === 'SHOWROOM') {
            dealershipId = showroomDealershipMap.get(allocation.levelId) || '';
          }
          
          const state = dealershipStates.get(dealershipId);
          if (state && allowedStates.includes(state)) {
            allowedPartnerIds.add(allocation.partnerId);
          }
        }
        
        partners = partners.filter(p => allowedPartnerIds.has(p.id));
      }
      
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
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
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
            
            // Auto-generate username from email
            const username = generateUsernameFromEmail(partner.email);
            
            await storage.createUser({
              email: partner.email,
              username,
              phone: partner.phone || undefined,
              passwordHash,
              name: partner.displayName || partner.contactPersonName || 'Partner User',
              role: 'PARTNER_ADMIN',
              partnerId: partner.id,
              isActive: true
            });
            
            console.log(`✅ Auto-created user account for partner: ${username} (${partner.email}) - password: ${defaultPassword}`);
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
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
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
    requireRole(['SUPER_ADMIN', 'ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
    blockAdminDelete,
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
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
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
    requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
    async (req, res) => {
      try {
        let partners = await storage.getPartnersWithCategories();
        
        // For MANAGER role, filter partners by state
        if (req.user?.role === 'MANAGER') {
          const allowedStates = (req.user.allowedStates as string[]) || [];
          
          // Filter partners based on their state
          partners = partners.filter(partner => 
            partner.state && allowedStates.includes(partner.state)
          );
        }
        
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
        
        // Auto-generate username from email
        const username = generateUsernameFromEmail(validatedData.email);
        
        // Prepare data for storage with hashed password
        const staffDataForStorage = {
          name: validatedData.name,
          username,
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

  // Pricing Rules Routes - SUPER_ADMIN ONLY
  app.get("/api/pricing-rules", authenticate, requireRole(['SUPER_ADMIN']), async (req, res) => {
    try {
      const { partnerId, scopeId, pricingType, dealershipId, detailerId, serviceCategoryId, oemId } = req.query;
      
      const filters: any = {};
      if (partnerId) filters.partnerId = partnerId as string;
      if (scopeId) filters.scopeId = scopeId as string;
      if (pricingType) filters.pricingType = pricingType as string;
      if (dealershipId) filters.dealershipId = dealershipId as string;
      if (detailerId) filters.detailerId = detailerId as string;
      if (serviceCategoryId) filters.serviceCategoryId = serviceCategoryId as string;
      if (oemId) filters.oemId = oemId as string;

      const rules = await storage.getPricingRules(filters);
      res.json(rules);
    } catch (error) {
      console.error("Get pricing rules error:", error);
      res.status(500).json({ error: "Failed to fetch pricing rules" });
    }
  });

  app.post("/api/pricing-rules", 
    authenticate, 
    requireRole(['SUPER_ADMIN']),
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
    requireRole(['SUPER_ADMIN', 'ADMIN']),
    blockAdminDelete,
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
    requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']), 
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
    requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']), 
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
    requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
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
        
        // For MANAGER role, validate showroom is in allowed states
        if (req.user?.role === 'MANAGER' && req.body.showroomId) {
          const showroom = await storage.getShowroom(req.body.showroomId);
          if (!showroom) {
            return res.status(404).json({ error: 'Showroom not found' });
          }

          const dealership = await storage.getDealership(showroom.dealershipId);
          if (!dealership) {
            return res.status(404).json({ error: 'Dealership not found for this showroom' });
          }

          const allowedStates = (req.user.allowedStates as string[]) || [];
          if (!dealership.state || !allowedStates.includes(dealership.state)) {
            return res.status(403).json({ error: 'You can only create sales persons for showrooms in your allowed states' });
          }
        }
        
        // Generate default password using phone number or "sales@123"
        const phone = req.body.phone || '';
        const defaultPassword = phone ? phone.slice(-6) : "sales@123";
        const passwordHash = await bcrypt.hash(defaultPassword, 10);
        
        // Auto-generate username from email
        const username = generateUsernameFromEmail(req.body.email);
        
        const salesPersonData = {
          name: req.body.name,
          username,
          email: req.body.email,
          phone: phone,
          passwordHash,
          role: 'SALES_PERSON' as const,
          showroomId: req.body.showroomId || null,
          isActive: req.body.active ?? true
        };
        
        const salesPerson = await storage.createUser(salesPersonData);
        console.log(`✅ Created sales person user account: ${salesPerson.username} (${salesPerson.email}) - password: ${defaultPassword}`);
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
    requireRole(['SUPER_ADMIN', 'ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    blockAdminDelete,
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
    requireRole(['SUPER_ADMIN', 'ADMIN']),
    blockAdminDelete,
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
          if (serviceData.availabilityScope === 'DEALERSHIP_SPECIFIC') {
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
    requireRole(['SUPER_ADMIN', 'ADMIN', 'OEM_ADMIN']),
    blockAdminDelete,
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
  app.get("/api/allocations", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN']),
    async (req, res) => {
      try {
        const { partnerId, level, levelId } = req.query;
        
        const filters: any = {};
        if (partnerId) filters.partnerId = partnerId as string;
        if (level) filters.level = level as string;
        if (levelId) filters.levelId = levelId as string;

        let allocations = await storage.getAllocations(filters);
        
        // For MANAGER role, filter allocations by allowed states
        if (req.user?.role === 'MANAGER') {
          const allowedStates = (req.user.allowedStates as string[]) || [];
          
          // Get all dealerships and showrooms to check states
          const dealershipsResponse = await storage.getDealerships({ limit: 10000 });
          const dealershipStates = new Map<string, string>();
          dealershipsResponse.dealerships.forEach(d => {
            if (d.state) dealershipStates.set(d.id, d.state);
          });
          
          const showroomsResponse = await storage.getShowrooms({ limit: 10000 });
          const showroomDealershipMap = new Map<string, string>();
          showroomsResponse.showrooms.forEach(s => showroomDealershipMap.set(s.id, s.dealershipId));
          
          // Filter allocations based on state
          allocations = allocations.filter(allocation => {
            if (allocation.level === 'DEALERSHIP') {
              const state = dealershipStates.get(allocation.levelId);
              return state && allowedStates.includes(state);
            } else if (allocation.level === 'SHOWROOM') {
              const dealershipId = showroomDealershipMap.get(allocation.levelId);
              if (!dealershipId) return false;
              const state = dealershipStates.get(dealershipId);
              return state && allowedStates.includes(state);
            }
            // For OEM level allocations, don't show to MANAGER
            return false;
          });
        }
        
        res.json(allocations);
      } catch (error) {
        console.error("Get allocations error:", error);
        res.status(500).json({ error: "Failed to fetch allocations" });
      }
    }
  );

  app.get("/api/allocations-with-categories", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN']),
    async (req, res) => {
      try {
        const { partnerId, level, levelId } = req.query;
        
        const filters: any = {};
        if (partnerId) filters.partnerId = partnerId as string;
        if (level) filters.level = level as string;
        if (levelId) filters.levelId = levelId as string;

        let allocations = await storage.getAllocationsWithCategories(filters);
        
        // For MANAGER role, filter allocations by allowed states
        if (req.user?.role === 'MANAGER') {
          const allowedStates = (req.user.allowedStates as string[]) || [];
          
          // Get all dealerships and showrooms to check states
          const dealershipsResponse = await storage.getDealerships({ limit: 10000 });
          const dealershipStates = new Map<string, string>();
          dealershipsResponse.dealerships.forEach(d => {
            if (d.state) dealershipStates.set(d.id, d.state);
          });
          
          const showroomsResponse = await storage.getShowrooms({ limit: 10000 });
          const showroomDealershipMap = new Map<string, string>();
          showroomsResponse.showrooms.forEach(s => showroomDealershipMap.set(s.id, s.dealershipId));
          
          // Filter allocations based on state
          allocations = allocations.filter(allocation => {
            if (allocation.level === 'DEALERSHIP') {
              const state = dealershipStates.get(allocation.levelId);
              return state && allowedStates.includes(state);
            } else if (allocation.level === 'SHOWROOM') {
              const dealershipId = showroomDealershipMap.get(allocation.levelId);
              if (!dealershipId) return false;
              const state = dealershipStates.get(dealershipId);
              return state && allowedStates.includes(state);
            }
            // For OEM level allocations, don't show to MANAGER
            return false;
          });
        }
        
        res.json(allocations);
      } catch (error) {
        console.error("Get allocations with categories error:", error);
        res.status(500).json({ error: "Failed to fetch allocations with categories" });
      }
    }
  );

  app.get("/api/allocations/:id", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN']),
    async (req, res) => {
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
    }
  );

  // Get allocation brands
  app.get("/api/allocations/:id/brands", 
    authenticate, 
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
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
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
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
    requireRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
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

        // MANAGER state validation - ensure allocation is in allowed states
        if (req.user!.role === 'MANAGER') {
          const allowedStates = (req.user!.allowedStates as string[]) || [];
          
          if (allocationData.level === 'DEALERSHIP') {
            const dealership = await storage.getDealership(allocationData.levelId);
            if (!dealership || !dealership.state || !allowedStates.includes(dealership.state)) {
              return res.status(403).json({ error: "Access denied - dealership is not in your allowed states" });
            }
          } else if (allocationData.level === 'SHOWROOM') {
            const showroom = await storage.getShowroom(allocationData.levelId);
            if (!showroom) {
              return res.status(404).json({ error: "Showroom not found" });
            }
            
            const dealership = await storage.getDealership(showroom.dealershipId);
            if (!dealership || !dealership.state || !allowedStates.includes(dealership.state)) {
              return res.status(403).json({ error: "Access denied - showroom is not in your allowed states" });
            }
          }
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
    requireRole(['SUPER_ADMIN', 'ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
    blockAdminDelete,
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
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
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
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
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
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
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
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
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
    requireRole(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']),
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
      // DEALERSHIP_ADMIN should only see rules for their dealership
      if (req.user!.role === 'DEALERSHIP_ADMIN' && req.user!.dealershipId && !filters.dealershipId) {
        filters.dealershipId = req.user!.dealershipId;
      }
      
      // SHOWROOM_MANAGER should only see rules for their showroom
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
    requireRole(['SUPER_ADMIN', 'ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']),
    blockAdminDelete,
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
    requireRole(['SUPER_ADMIN', 'ADMIN', 'OEM_ADMIN']),
    blockAdminDelete,
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

  // Serve object files (no authentication required - ACL is checked in downloadObject)
  app.get("/objects/*", async (req, res) => {
    try {
      const objectPath = req.path;
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      
      // Download/serve the file (ACL permissions are checked inside downloadObject)
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      console.error("Object download error:", error);
      res.status(500).json({ error: "Failed to download object" });
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

  // NOTE: Brand-specific email addresses removed - all emails now use unified noreply@p91india.com
  // This endpoint is deprecated as per the unified notification system requirements

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

      const filters: any = {
        oemId: user.oemId,
        isActive: true
      };

      // Admins see ALL resources regardless of applicableTo
      // Regular users only see resources applicable to their role
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'OEM_ADMIN') {
        const applicableTo: string[] = ['ALL'];
        const mappedRole = roleMapping[user.role];
        if (mappedRole) {
          applicableTo.push(mappedRole);
        }
        filters.applicableTo = applicableTo;
      }

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
    requireRole(['SUPER_ADMIN', 'ADMIN', 'OEM_ADMIN']),
    blockAdminDelete,
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
  app.delete("/api/p91/brand/:id", authenticate, requireOEMAccess, blockAdminDelete, async (req, res) => {
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

  // 🧪 RAW MATERIALS ROUTES - SUPER_ADMIN ONLY

  // Get all raw materials
  app.get("/api/p91/raw_material", authenticate, requireRole(['SUPER_ADMIN']), async (req, res) => {
    try {
      const materials = await storage.getRawMaterials();
      res.json(materials);
    } catch (error) {
      console.error("Error fetching raw materials:", error);
      res.status(500).json({ error: "Failed to fetch raw materials" });
    }
  });

  // Get single raw material
  app.get("/api/p91/raw_material/:id", authenticate, requireRole(['SUPER_ADMIN']), async (req, res) => {
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
  app.post("/api/p91/raw_material/add", authenticate, requireRole(['SUPER_ADMIN']), async (req, res) => {
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
  app.put("/api/p91/raw_material/update/:id", authenticate, requireRole(['SUPER_ADMIN']), async (req, res) => {
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
  app.delete("/api/p91/raw_material/delete/:id", authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), blockAdminDelete, async (req, res) => {
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
  app.get("/api/p91/service/:serviceId/raw_materials", authenticate, requireRole(['SUPER_ADMIN']), async (req, res) => {
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
  app.post("/api/p91/service/:serviceId/raw_materials", authenticate, requireRole(['SUPER_ADMIN']), async (req, res) => {
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
  app.delete("/api/p91/service/:serviceId/raw_materials/:rawMaterialId", authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), blockAdminDelete, async (req, res) => {
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

  // ========================================
  // EMAIL TEST ENDPOINT
  // ========================================
  
  /**
   * Test endpoint to send sample emails of all notification types
   * POST /api/test/send-all-emails
   */
  app.post("/api/test/send-all-emails", authenticate, requireRole(['SUPER_ADMIN']), async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email address required" });
      }

      const results: any[] = [];

      // 1. Job Card Completion
      try {
        await emailService.sendJobCardCompletionNotification(email, {
          jobCardId: "JC-TEST-001",
          workOrderNumber: "WO-2025-001",
          vehicleDetails: "BMW X5 - KA01AB1234",
          completedAt: new Date(),
          partnerName: "Premium Auto Care"
        });
        results.push({ type: "Job Card Completion", status: "sent" });
      } catch (error: any) {
        results.push({ type: "Job Card Completion", status: "failed", error: error.message });
      }

      // 2. Job Card Approval
      try {
        await emailService.sendJobCardApprovalNotification(email, {
          jobCardId: "JC-TEST-002",
          workOrderNumber: "WO-2025-002",
          vehicleDetails: "Audi Q7 - KA02CD5678",
          approvedAt: new Date(),
          approvedBy: "Admin User",
          payoutAmount: "45000"
        });
        results.push({ type: "Job Card Approval", status: "sent" });
      } catch (error: any) {
        results.push({ type: "Job Card Approval", status: "failed", error: error.message });
      }

      // 3. Password Reset
      try {
        await emailService.sendPasswordResetEmail(email, "test-reset-token-123", "Test User");
        results.push({ type: "Password Reset", status: "sent" });
      } catch (error: any) {
        results.push({ type: "Password Reset", status: "failed", error: error.message });
      }

      // 4. OTP Email
      try {
        await emailService.sendOTPEmail(email, "123456", "verification");
        results.push({ type: "OTP Verification", status: "sent" });
      } catch (error: any) {
        results.push({ type: "OTP Verification", status: "failed", error: error.message });
      }

      // 5. Work Order Created
      try {
        await emailService.sendWorkOrderCreatedNotification(email, {
          workOrderId: "wo-test-123",
          workOrderNumber: "WO-2025-003",
          vehicleDetails: "Mercedes GLC - KA03EF9012",
          serviceDetails: "Full Body PPF + Ceramic Coating",
          customerName: "John Doe",
          estimatedPrice: "85000"
        });
        results.push({ type: "Work Order Created", status: "sent" });
      } catch (error: any) {
        results.push({ type: "Work Order Created", status: "failed", error: error.message });
      }

      // 6. Work Order Updated
      try {
        await emailService.sendWorkOrderUpdatedNotification(email, {
          workOrderId: "wo-test-124",
          workOrderNumber: "WO-2025-004",
          status: "In Progress",
          updateDetails: "Job card assigned to partner and work has started"
        });
        results.push({ type: "Work Order Updated", status: "sent" });
      } catch (error: any) {
        results.push({ type: "Work Order Updated", status: "failed", error: error.message });
      }

      // 7. Work Order Completed
      try {
        await emailService.sendWorkOrderCompletedNotification(email, {
          workOrderId: "wo-test-125",
          workOrderNumber: "WO-2025-005",
          vehicleDetails: "Range Rover Sport - KA04GH3456",
          completedAt: new Date()
        });
        results.push({ type: "Work Order Completed", status: "sent" });
      } catch (error: any) {
        results.push({ type: "Work Order Completed", status: "failed", error: error.message });
      }

      // 8. Job Card Created
      try {
        await emailService.sendJobCardCreatedNotification(email, {
          jobCardId: "JC-TEST-003",
          workOrderNumber: "WO-2025-006",
          vehicleDetails: "Porsche Cayenne - KA05IJ7890",
          assignedTo: "Elite Detailing Studio"
        });
        results.push({ type: "Job Card Created", status: "sent" });
      } catch (error: any) {
        results.push({ type: "Job Card Created", status: "failed", error: error.message });
      }

      res.json({
        success: true,
        message: `Sent ${results.filter(r => r.status === 'sent').length} out of ${results.length} emails to ${email}`,
        results
      });
    } catch (error: any) {
      console.error("Test email error:", error);
      res.status(500).json({ error: error.message || "Failed to send test emails" });
    }
  });

  // ========================================
  // WHATSAPP TEST ENDPOINT
  // ========================================
  
  /**
   * Test endpoint to send sample WhatsApp notifications
   * POST /api/test/send-whatsapp
   */
  app.post("/api/test/send-whatsapp", authenticate, requireRole(['SUPER_ADMIN']), async (req, res) => {
    try {
      const { phone, templateType = 'job_card_created' } = req.body;
      
      if (!phone) {
        return res.status(400).json({ error: "Phone number required" });
      }

      const testJobCardId = "test-jc-001";
      const testJobCardLink = `${process.env.REPLIT_DEV_DOMAIN || 'https://yourapp.replit.app'}/job-cards/${testJobCardId}`;

      let result = false;
      let templateUsed = templateType;

      switch (templateType) {
        case 'job_card_created':
          result = await whatsappService.sendJobCardCreated(
            phone,
            "Test Partner Studio",
            testJobCardId,
            "BMW X5 - KA01AB1234",
            "Premium Showroom Delhi",
            "Full Body PPF",
            testJobCardLink
          );
          break;

        case 'job_card_pending_approval':
          result = await whatsappService.sendJobCardPendingApproval(
            phone,
            "Test User",
            testJobCardId,
            "Audi Q7 - KA02CD5678",
            "Elite Auto Care",
            testJobCardLink
          );
          break;

        case 'job_card_approved':
          result = await whatsappService.sendJobCardApproved(
            phone,
            "Test Partner Studio",
            testJobCardId,
            "Mercedes GLC - KA03EF9012",
            "45000",
            testJobCardLink
          );
          break;

        case 'job_card_rejected':
          result = await whatsappService.sendJobCardRejected(
            phone,
            "Test Partner Studio",
            testJobCardId,
            "Range Rover Sport - KA04GH3456",
            "Quality issues - please redo the installation",
            testJobCardLink
          );
          break;

        case 'job_card_completed':
          result = await whatsappService.sendJobCardCompleted(
            phone,
            "Test User",
            testJobCardId,
            "Porsche Cayenne - KA05IJ7890",
            "Premium Auto Detailing",
            testJobCardLink
          );
          break;

        default:
          return res.status(400).json({ error: `Unknown template type: ${templateType}` });
      }

      if (result) {
        res.json({
          success: true,
          message: `WhatsApp notification sent to ${phone}`,
          template: templateUsed,
          status: whatsappService.getStatus()
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to send WhatsApp notification",
          status: whatsappService.getStatus()
        });
      }
    } catch (error: any) {
      console.error("Test WhatsApp error:", error);
      res.status(500).json({ error: error.message || "Failed to send test WhatsApp" });
    }
  });

  // ========================================
  // PULSE WEBHOOK INTEGRATION
  // ========================================
  
  // Import pulse webhook service
  const { pulseWebhookService } = await import('./services/pulseWebhookService');

  /**
   * Pulse webhook endpoint for user access control
   * POST /api/webhooks/pulse/user-access
   */
  app.post("/api/webhooks/pulse/user-access", async (req, res) => {
    console.log('🔔 Pulse webhook received!');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    try {
      const signature = req.headers['x-pulse-signature'] as string;
      const payload = req.body;

      // Verify signature if webhook secret is configured
      if (process.env.PULSE_WEBHOOK_SECRET) {
        console.log('🔐 Verifying signature...');
        const payloadString = JSON.stringify(payload);
        const isValid = pulseWebhookService.verifySignature(payloadString, signature || '');

        if (!isValid) {
          console.error('❌ Invalid Pulse webhook signature');
          return res.status(401).json({
            success: false,
            error: 'Invalid signature'
          });
        }
        console.log('✅ Signature verified');
      } else {
        console.log('⚠️ Webhook secret not configured - skipping signature verification');
      }

      console.log('✅ Processing webhook...');

      // Process webhook
      const result = await pulseWebhookService.processWebhook(payload, req.user?.id);

      console.log('📤 Webhook result:', result);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      console.error('❌ Pulse webhook error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
