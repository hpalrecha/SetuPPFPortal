import { 
  users, 
  oems,
  dealerships,
  dealershipOemMapping,
  showrooms,
  salesPersons,
  partners,
  partnerOems,
  partnerShowroomMapping,
  allocations,
  allocationBrands,
  vehicleModels,
  vehicleVariants,
  services,
  serviceCategories,
  partnerServiceCategories,
  partnerBrands,
  brands,
  rawMaterials,
  serviceRawMaterials,
  whatsappTemplates,
  pricingRules,
  commissionRules,
  workOrders,
  jobCards,
  jobCardMedia,
  approvals,
  payouts,
  commissions,
  oemRoyaltyRules,
  oemRoyaltyCalculations,
  auditLogs,
  knowledgeHub,
  otpVerifications,
  type User, 
  type InsertUser,
  type OtpVerification,
  type InsertOtpVerification,
  type Oem,
  type InsertOem,
  type Dealership,
  type InsertDealership,
  type DealershipOemMapping,
  type InsertDealershipOemMapping,
  type Showroom,
  type InsertShowroom,
  type WorkOrder,
  type InsertWorkOrder,
  type JobCard,
  type InsertJobCard,
  type Partner,
  type InsertPartner,
  type PricingRule,
  type InsertPricingRule,
  type CommissionRule,
  type InsertCommissionRule,
  type VehicleModel,
  type InsertVehicleModel,
  type VehicleVariant,
  type InsertVehicleVariant,
  type ServiceCategory,
  type InsertServiceCategory,
  type PartnerServiceCategory,
  type InsertPartnerServiceCategory,
  type Brand,
  type InsertBrand,
  type RawMaterial,
  type InsertRawMaterial,
  type ServiceRawMaterial,
  type InsertServiceRawMaterial,
  type OemRoyaltyRule,
  type InsertOemRoyaltyRule,
  type OemRoyaltyCalculation,
  type InsertOemRoyaltyCalculation,
  type KnowledgeHub,
  type InsertKnowledgeHub,
  type WhatsappTemplate,
  type InsertWhatsappTemplate
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, count, avg, sum, lte, gte, or, isNull, isNotNull, asc, inArray, ne, like, notInArray } from "drizzle-orm";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(filters?: { oemId?: string; dealershipId?: string; showroomId?: string; role?: string }): Promise<User[]>;
  getSalesPersons(showroomId?: string): Promise<User[]>;
  getSalesPersonMetrics(salesPersonId: string): Promise<{
    activeOrders: number;
    thisMonthRevenue: number;
    thisMonthOrders: number;
  }>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  updateUserPasswordByDealership(dealershipId: string, hashedPassword: string): Promise<boolean>;
  updateUserPasswordByOEM(oemId: string, hashedPassword: string): Promise<boolean>;
  updateUserPasswordByShowroom(showroomId: string, hashedPassword: string): Promise<boolean>;
  deleteUser(id: string): Promise<boolean>;

  // OTP Verification management
  createOtpVerification(otp: any): Promise<any>;
  getOtpVerification(userId: string, type: string): Promise<any | undefined>;
  updateOtpVerification(id: string, updates: any): Promise<any | undefined>;
  deleteOtpVerification(id: string): Promise<boolean>;

  // Service Categories management
  getServiceCategories(): Promise<ServiceCategory[]>;
  getServiceCategory(id: string): Promise<ServiceCategory | undefined>;
  createServiceCategory(category: InsertServiceCategory): Promise<ServiceCategory>;
  updateServiceCategory(id: string, updates: Partial<InsertServiceCategory>): Promise<ServiceCategory | undefined>;
  deleteServiceCategory(id: string): Promise<boolean>;

  // Services management
  getServices(filters?: { oemId?: string; dealershipId?: string; serviceIds?: string[] }): Promise<any[]>;
  getService(id: string): Promise<any>;
  createService(service: any): Promise<any>;
  updateService(id: string, updates: any): Promise<any>;
  deleteService(id: string): Promise<boolean>;

  // OEM management
  getOems(): Promise<Oem[]>;
  getOem(id: string): Promise<Oem | undefined>;
  createOem(oem: InsertOem): Promise<Oem>;
  updateOem(id: string, updates: Partial<InsertOem>): Promise<Oem | undefined>;
  deleteOem(id: string): Promise<boolean>;

  // Dealership management
  getDealerships(filters?: { oemId?: string; state?: string; city?: string; limit?: number; offset?: number }): Promise<{ dealerships: any[]; total: number }>;
  getDealershipFilterOptions(): Promise<{ states: Array<{ value: string; count: number }>; cities: Array<{ value: string; count: number }> }>;
  getDealership(id: string): Promise<any | undefined>;
  createDealership(dealership: any): Promise<any>;
  updateDealership(id: string, updates: any): Promise<any | undefined>;
  deleteDealership(id: string): Promise<boolean>;

  // Dealership-OEM Mapping
  getDealershipOems(dealershipId: string): Promise<string[]>; // Returns array of OEM IDs
  addDealershipOemMapping(dealershipId: string, oemId: string): Promise<any>;
  removeDealershipOemMapping(dealershipId: string, oemId: string): Promise<boolean>;
  setDealershipOems(dealershipId: string, oemIds: string[]): Promise<void>; // Replace all mappings
  checkDealershipOemMapping(dealershipId: string, oemId: string): Promise<boolean>; // Check if mapping exists

  // Showroom management
  getShowrooms(filters?: { dealershipId?: string; oemId?: string; state?: string; city?: string; limit?: number; offset?: number }): Promise<{ showrooms: any[]; total: number }>;
  getShowroomFilterOptions(): Promise<{ states: Array<{ value: string; count: number }>; cities: Array<{ value: string; count: number }> }>;
  getShowroom(id: string): Promise<any | undefined>;
  createShowroom(showroom: any): Promise<any>;
  updateShowroom(id: string, updates: any): Promise<any | undefined>;
  deleteShowroom(id: string): Promise<boolean>;

  // Work Order management
  getWorkOrders(filters?: { 
    oemId?: string; 
    dealershipId?: string;
    showroomId?: string; 
    partnerId?: string; 
    status?: string;
    workOrderIds?: string[];  // Add bulk support
    limit?: number;
    offset?: number;
  }): Promise<WorkOrder[]>;
  getWorkOrder(id: string): Promise<WorkOrder | undefined>;
  getWorkOrdersWithoutCommissions(): Promise<any[]>;
  createWorkOrder(workOrder: InsertWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(id: string, updates: Partial<InsertWorkOrder>): Promise<WorkOrder | undefined>;
  submitWorkOrder(id: string, userId: string): Promise<{ success: boolean; workOrder?: WorkOrder; jobCard?: JobCard; error?: string }>;
  cancelWorkOrder(id: string, userId: string, reason: string): Promise<{ success: boolean; error?: string }>;
  allocatePartnerManually(workOrderId: string, partnerId: string, userId: string): Promise<{ success: boolean; workOrder?: WorkOrder; jobCard?: JobCard; error?: string }>;

  // Job Card management
  getJobCards(filters?: { 
    partnerId?: string; 
    workOrderId?: string;
    showroomId?: string;
    dealershipId?: string;
    oemId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<JobCard[]>;
  getJobCard(id: string): Promise<JobCard | undefined>;
  createJobCard(jobCard: InsertJobCard): Promise<JobCard>;
  updateJobCard(id: string, updates: Partial<InsertJobCard>): Promise<JobCard | undefined>;
  
  // Job Card Media management
  insertJobCardMedia(media: { jobCardId: string; type: string; url: string; caption?: string }): Promise<any>;
  getJobCardMedia(filters: { jobCardId: string }): Promise<any[]>;

  // Approval management  
  createApproval(approval: { jobCardId: string; approverUserId: string; status: string; remarks?: string }): Promise<any>;
  getApprovals(filters?: { jobCardId?: string }): Promise<any[]>;

  // Partner management
  getPartners(filters?: { oemId?: string; type?: string; partnerIds?: string[] }): Promise<Partner[]>;
  getPartner(id: string): Promise<Partner | undefined>;
  createPartner(partner: InsertPartner): Promise<Partner>;
  updatePartner(id: string, updates: Partial<InsertPartner>): Promise<Partner | undefined>;
  deletePartner(id: string): Promise<boolean>;

  // Partner Service Categories
  getPartnerServiceCategories(partnerId: string): Promise<string[]>;
  getPartnersWithCategories(): Promise<(Partner & { serviceCategories?: ServiceCategory[] })[]>;
  setPartnerServiceCategories(partnerId: string, serviceCategoryIds: string[]): Promise<void>;

  // Partner Brands
  getPartnerBrands(partnerId: string): Promise<string[]>;
  setPartnerBrands(partnerId: string, brandIds: string[]): Promise<void>;

  // Allocation Brands
  getAllocationBrands(allocationId: string): Promise<string[]>;
  setAllocationBrands(allocationId: string, brandIds: string[]): Promise<void>;

  // Partner Staff Management
  getPartnerStaff(partnerId: string): Promise<User[]>;
  createPartnerStaff(partnerId: string, staffData: Omit<InsertUser, 'partnerId' | 'role'>): Promise<User>;
  updatePartnerStaff(staffId: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deletePartnerStaff(staffId: string): Promise<boolean>;

  // Partner Payout & Earnings Management
  getPartnerPayouts(partnerId: string): Promise<any[]>;
  getPartnerEarningsSummary(partnerId: string): Promise<{
    totalEarnings: number;
    paidAmount: number;
    pendingAmount: number;
    thisMonthEarnings: number;
    completedJobs: number;
    pendingJobs: number;
  }>;
  getPartnerServiceRates(partnerId: string): Promise<any[]>;

  // Pricing Rules
  getPricingRules(filters?: { 
    partnerId?: string; 
    scopeId?: string; 
    pricingType?: string;
    dealershipId?: string;
    detailerId?: string;
    oemId?: string;
  }): Promise<PricingRule[]>;
  createPricingRule(rule: InsertPricingRule): Promise<PricingRule>;
  updatePricingRule(id: string, updates: Partial<InsertPricingRule>): Promise<PricingRule | undefined>;
  deletePricingRule(id: string): Promise<boolean>;

  // Commission Rules
  getCommissionRules(filters?: { oemId?: string; dealershipId?: string; showroomId?: string; salesPersonId?: string }): Promise<CommissionRule[]>;
  getCommissionRulesWithContext(filters?: { oemId?: string; dealershipId?: string; showroomId?: string; salesPersonId?: string }): Promise<{
    id: string;
    oemId: string | null;
    dealershipId: string | null;
    showroomId: string | null;
    salesPersonId: string | null;
    serviceId: string | null;
    serviceCategoryId: string | null;
    type: "PERCENT" | "AMOUNT";
    valueNumeric: string;
    capAmount: string | null;
    floorAmount: string | null;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    oem: any;
    dealership: any;
    showroom: any;
    salesPerson: any;
    service: any;
    serviceCategory: any;
  }[]>;
  createCommissionRule(rule: InsertCommissionRule): Promise<CommissionRule>;
  updateCommissionRule(id: string, updates: Partial<InsertCommissionRule>): Promise<CommissionRule | undefined>;
  deleteCommissionRule(id: string): Promise<boolean>;
  resolveCommissionRule(oemId: string, dealershipId: string, showroomId: string, salesPersonId?: string, serviceId?: string, serviceCategoryId?: string): Promise<any | null>;
  calculateCommission(grossAmount: number, oemId: string, dealershipId: string, showroomId: string, salesPersonId?: string, serviceId?: string, serviceCategoryId?: string): Promise<any>;
  
  // Payout settlement
  getPayouts(filters?: { status?: string; partnerId?: string; oemId?: string; dealershipId?: string; showroomId?: string; jobCardId?: string }): Promise<any[]>;
  getPayout(id: string): Promise<any | undefined>;
  createPayout(payout: any): Promise<any>;
  updatePayout(id: string, updates: any): Promise<any>;
  getCommissions(filters?: { status?: string; salesPersonId?: string; showroomId?: string; oemId?: string; dealershipId?: string; workOrderId?: string }): Promise<{ commissions: any[] }>;
  getCommission(id: string): Promise<any | undefined>;
  createCommission(commission: any): Promise<any>;
  updateCommission(id: string, updates: any): Promise<any>;
  canUserAccessPayout(user: User, payout: any): boolean;
  canUserAccessCommission(user: User, commission: any): boolean;

  // OEM Royalty Management
  getOemRoyaltyRules(filters?: { oemId?: string; isActive?: boolean }): Promise<OemRoyaltyRule[]>;
  getOemRoyaltyRule(id: string): Promise<OemRoyaltyRule | undefined>;
  getOemRoyaltyRuleByOem(oemId: string): Promise<OemRoyaltyRule | undefined>;
  createOemRoyaltyRule(rule: InsertOemRoyaltyRule, createdBy: string): Promise<OemRoyaltyRule>;
  updateOemRoyaltyRule(id: string, updates: Partial<InsertOemRoyaltyRule>, updatedBy: string): Promise<OemRoyaltyRule | undefined>;
  deactivateOemRoyaltyRule(id: string, updatedBy: string): Promise<boolean>;
  
  // OEM Royalty Calculations
  getOemRoyaltyCalculations(filters?: { oemId?: string; workOrderId?: string; status?: string }): Promise<OemRoyaltyCalculation[]>;
  createOemRoyaltyCalculation(calculation: InsertOemRoyaltyCalculation): Promise<OemRoyaltyCalculation>;
  updateOemRoyaltyCalculation(id: string, updates: Partial<InsertOemRoyaltyCalculation>): Promise<OemRoyaltyCalculation | undefined>;
  calculateRoyaltyForWorkOrder(workOrderId: string, workOrderValue: number, oemId: string): Promise<OemRoyaltyCalculation | null>;
  settlePayout(id: string, settlement: { paymentReference: string; settledAt: Date; settledBy: string }): Promise<boolean>;
  settleCommission(id: string, settlement: { paymentReference: string; settledAt: Date; settledBy: string }): Promise<boolean>;
  recalculatePayoutWithPricing(jobCardId: string): Promise<{ success: boolean; message: string; amount?: string }>;

  // Pricing resolution
  resolvePricingRule(partnerId: string, vehicleModelId: string, serviceId: string, dealershipId?: string, showroomId?: string): Promise<PricingRule | null>;
  
  // Notifications
  createNotification(notification: any): Promise<any>;


  // Vehicle Model management
  getVehicleModels(filters?: { oemId?: string }): Promise<VehicleModel[]>;
  getVehicleModel(id: string): Promise<VehicleModel | undefined>;
  createVehicleModel(model: InsertVehicleModel): Promise<VehicleModel>;
  updateVehicleModel(id: string, updates: Partial<InsertVehicleModel>): Promise<VehicleModel | undefined>;
  deleteVehicleModel(id: string): Promise<boolean>;

  // Vehicle Variant management
  getVehicleVariants(filters?: { modelId?: string }): Promise<VehicleVariant[]>;
  getVehicleVariant(id: string): Promise<VehicleVariant | undefined>;
  createVehicleVariant(variant: InsertVehicleVariant): Promise<VehicleVariant>;
  updateVehicleVariant(id: string, updates: Partial<InsertVehicleVariant>): Promise<VehicleVariant | undefined>;
  deleteVehicleVariant(id: string): Promise<boolean>;

  // Allocation management
  getAllocations(filters?: { oemId?: string; partnerId?: string; level?: string; levelId?: string }): Promise<any[]>;
  getAllocationsWithCategories(filters?: { oemId?: string; partnerId?: string; level?: string; levelId?: string }): Promise<any[]>;
  getAllocation(id: string): Promise<any | undefined>;
  getAllocatedBrands(level: string, levelId: string): Promise<{ brandId: string; partnerId: string; partnerName: string }[]>;
  createAllocation(allocation: any): Promise<any>;
  updateAllocation(id: string, updates: any): Promise<any | undefined>;
  deleteAllocation(id: string): Promise<boolean>;

  // Dashboard metrics
  getPartnerDashboardMetrics(partnerId: string): Promise<{
    activeWorkOrders: number;
    pendingApprovals: number;
    thisMonthRevenue: number;
    avgTAT: number;
    completedJobs: number;
    inProgressJobs: number;
    pendingJobs: number;
    thisMonthEarnings: number;
  }>;
  getDashboardMetrics(oemId: string, showroomId?: string, dealershipId?: string): Promise<{
    activeWorkOrders: number;
    pendingApprovals: number;
    thisMonthRevenue: number;
    avgTAT: number;
    completedJobs?: number;
    inProgressJobs?: number;
    pendingJobs?: number;
    thisMonthEarnings?: number;
  }>;

  // Dashboard chart data
  getOrdersRevenueTrend(oemId: string, showroomId?: string, dealershipId?: string): Promise<{
    month: string;
    orders: number;
    revenue: number;
  }[]>;
  
  getDealershipPerformance(oemId: string): Promise<{
    name: string;
    orders: number;
    revenue: number;
    growth: number;
  }[]>;
  
  getVehicleCategoryUpsells(oemId: string): Promise<{
    category: string;
    upsells: number;
    upsellRate: number;
    avgValue: number;
  }[]>;
  
  getTerritoryPerformance(oemId: string, dealershipId?: string, showroomId?: string): Promise<{
    territory: string;
    orders: number;
    upsells: number;
    upsellRate: number;
    revenue: number;
  }[]>;
  
  getServicePopularity(oemId: string, showroomId?: string, dealershipId?: string): Promise<{
    name: string;
    value: number;
    color: string;
  }[]>;
  
  getMonthlyTrends(oemId: string, showroomId?: string, dealershipId?: string): Promise<{
    month: string;
    completedOrders: number;
    avgTAT: number;
    customerSatisfaction: number;
  }[]>;

  // Reports metrics
  getReportsMetrics(oemId: string, showroomId?: string, dealershipId?: string): Promise<{
    totalWorkOrders: { thisMonth: number; lastMonth: number; change: number; isPositive: boolean };
    avgTAT: { thisMonth: number; lastMonth: number; change: number; isPositive: boolean };
    firstPassRate: { thisMonth: number; lastMonth: number; change: number; isPositive: boolean };
    customerSatisfaction: { thisMonth: number; lastMonth: number; change: number; isPositive: boolean };
  }>;

  // Commissions summary
  getCommissionsSummary(oemId: string, showroomId?: string, dealershipId?: string): Promise<{
    totalCommissionThisMonth: number;
    activeSalesPersons: number;
    avgCommissionRate: number;
  }>;

  // Partner OEM access control
  checkPartnerOemAccess(partnerId: string, oemId: string): Promise<boolean>;
  getPartnerOems(partnerId: string): Promise<string[]>;

  // Audit logging
  createAuditLog(log: {
    actorUserId?: string;
    entity: string;
    entityId: string;
    action: string;
    diffJson?: any;
  }): Promise<void>;

  // Raw Material management
  getRawMaterials(): Promise<RawMaterial[]>;
  getRawMaterial(id: string): Promise<RawMaterial | undefined>;
  getRawMaterialByName(name: string): Promise<RawMaterial | undefined>;
  createRawMaterial(material: InsertRawMaterial): Promise<RawMaterial>;
  updateRawMaterial(id: string, updates: Partial<InsertRawMaterial>): Promise<RawMaterial | undefined>;
  deleteRawMaterial(id: string): Promise<boolean>;
  getServiceRawMaterials(serviceId: string): Promise<RawMaterial[]>;
  addServiceRawMaterial(serviceId: string, rawMaterialId: string): Promise<ServiceRawMaterial>;
  removeServiceRawMaterial(serviceId: string, rawMaterialId: string): Promise<boolean>;

  // Brand management
  getBrands(): Promise<Brand[]>;
  getBrand(id: string): Promise<Brand | undefined>;
  getBrandByName(name: string): Promise<Brand | undefined>;
  createBrand(brand: InsertBrand): Promise<Brand>;
  updateBrand(id: string, updates: Partial<InsertBrand>): Promise<Brand | undefined>;
  deleteBrand(id: string): Promise<boolean>;

  // WhatsApp Template management
  getWhatsappTemplates(filters?: { brandId?: string; eventType?: string }): Promise<any[]>;
  getWhatsappTemplate(id: string): Promise<any | undefined>;
  getWhatsappTemplateByBrandAndEvent(brandId: string, eventType: string): Promise<any | undefined>;
  createWhatsappTemplate(template: any): Promise<any>;
  updateWhatsappTemplate(id: string, updates: any): Promise<any | undefined>;
  deleteWhatsappTemplate(id: string): Promise<boolean>;

  // Knowledge Hub management
  getKnowledgeHubItems(filters?: { 
    oemId?: string; 
    applicableTo?: string[];
    category?: string;
    contentType?: string;
    isActive?: boolean;
    searchTerm?: string;
  }): Promise<any[]>;
  getKnowledgeHubItem(id: string): Promise<any | undefined>;
  createKnowledgeHubItem(item: any): Promise<any>;
  updateKnowledgeHubItem(id: string, updates: any): Promise<any | undefined>;
  deleteKnowledgeHubItem(id: string): Promise<boolean>;
  incrementViewCount(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Case-insensitive username lookup
    const [user] = await db.select().from(users).where(sql`LOWER(${users.username}) = LOWER(${username})`);
    return user || undefined;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Normalize username to lowercase for consistency (if provided)
    const normalizedUser = {
      ...insertUser,
      username: insertUser.username ? insertUser.username.toLowerCase() : insertUser.username
    };
    const [user] = await db
      .insert(users)
      .values(normalizedUser)
      .returning();
    return user;
  }

  async getUsers(filters?: { oemId?: string; dealershipId?: string; showroomId?: string; role?: string }): Promise<User[]> {
    let query = db.select().from(users);
    
    if (filters) {
      const conditions = [];
      if (filters.oemId) conditions.push(eq(users.oemId, filters.oemId));
      if (filters.dealershipId) conditions.push(eq(users.dealershipId, filters.dealershipId));
      if (filters.showroomId) conditions.push(eq(users.showroomId, filters.showroomId));
      if (filters.role) conditions.push(eq(users.role, filters.role as any));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    return await query;
  }

  async getSalesPersons(showroomId?: string): Promise<User[]> {
    let query = db.select().from(users);
    
    if (showroomId) {
      query = query.where(and(eq(users.role, 'SALES_PERSON'), eq(users.showroomId, showroomId)));
    } else {
      query = query.where(eq(users.role, 'SALES_PERSON'));
    }
    
    return await query;
  }

  async getSalesPersonMetrics(salesPersonId: string): Promise<{
    activeOrders: number;
    thisMonthRevenue: number;
    thisMonthOrders: number;
  }> {
    // Simplified implementation returning zero values to avoid database schema issues
    // TODO: Implement proper metrics once database schema is fixed
    return {
      activeOrders: 0,
      thisMonthRevenue: 0,
      thisMonthOrders: 0
    };
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async updateUserPasswordByDealership(dealershipId: string, hashedPassword: string): Promise<boolean> {
    const result = await db
      .update(users)
      .set({ 
        passwordHash: hashedPassword, 
        updatedAt: new Date(),
        // Clear any existing reset tokens when password is manually reset
        resetToken: null,
        resetTokenExpiry: null
      })
      .where(and(
        eq(users.dealershipId, dealershipId),
        eq(users.role, 'DEALERSHIP_ADMIN')
      ));
    return (result.rowCount ?? 0) > 0;
  }

  async updateUserPasswordByOEM(oemId: string, hashedPassword: string): Promise<boolean> {
    const result = await db
      .update(users)
      .set({ 
        passwordHash: hashedPassword, 
        updatedAt: new Date(),
        // Clear any existing reset tokens when password is manually reset
        resetToken: null,
        resetTokenExpiry: null
      })
      .where(and(
        eq(users.oemId, oemId),
        eq(users.role, 'OEM_ADMIN')
      ));
    return (result.rowCount ?? 0) > 0;
  }

  async updateUserPasswordByShowroom(showroomId: string, hashedPassword: string): Promise<boolean> {
    const result = await db
      .update(users)
      .set({ 
        passwordHash: hashedPassword, 
        updatedAt: new Date(),
        // Clear any existing reset tokens when password is manually reset
        resetToken: null,
        resetTokenExpiry: null
      })
      .where(and(
        eq(users.showroomId, showroomId),
        eq(users.role, 'SHOWROOM_MANAGER')
      ));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createOtpVerification(otp: InsertOtpVerification): Promise<OtpVerification> {
    const [verification] = await db
      .insert(otpVerifications)
      .values(otp)
      .returning();
    return verification;
  }

  async getOtpVerification(userId: string, type: string): Promise<OtpVerification | undefined> {
    const [verification] = await db
      .select()
      .from(otpVerifications)
      .where(and(
        eq(otpVerifications.userId, userId),
        eq(otpVerifications.type, type as any),
        eq(otpVerifications.verified, false)
      ))
      .orderBy(desc(otpVerifications.createdAt))
      .limit(1);
    return verification || undefined;
  }

  async updateOtpVerification(id: string, updates: Partial<InsertOtpVerification>): Promise<OtpVerification | undefined> {
    const [verification] = await db
      .update(otpVerifications)
      .set(updates)
      .where(eq(otpVerifications.id, id))
      .returning();
    return verification || undefined;
  }

  async deleteOtpVerification(id: string): Promise<boolean> {
    const result = await db
      .delete(otpVerifications)
      .where(eq(otpVerifications.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Service Categories management
  async getServiceCategories(): Promise<ServiceCategory[]> {
    const categories = await db.select()
      .from(serviceCategories)
      .where(eq(serviceCategories.active, true))
      .orderBy(serviceCategories.name);
    return categories;
  }

  async getServiceCategory(id: string): Promise<ServiceCategory | undefined> {
    const [category] = await db.select()
      .from(serviceCategories)
      .where(and(eq(serviceCategories.id, id), eq(serviceCategories.active, true)));
    return category || undefined;
  }

  async createServiceCategory(category: InsertServiceCategory): Promise<ServiceCategory> {
    const [newCategory] = await db.insert(serviceCategories)
      .values({
        ...category,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return newCategory;
  }

  async updateServiceCategory(id: string, updates: Partial<InsertServiceCategory>): Promise<ServiceCategory | undefined> {
    const [updatedCategory] = await db.update(serviceCategories)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(serviceCategories.id, id))
      .returning();
    return updatedCategory || undefined;
  }

  async deleteServiceCategory(id: string): Promise<boolean> {
    // Soft delete by setting active to false
    const result = await db.update(serviceCategories)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(serviceCategories.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Services management
  async getServices(filters?: { oemId?: string; dealershipId?: string; serviceIds?: string[] }): Promise<any[]> {
    let query = db.select().from(services);
    
    // Handle bulk service IDs query
    if (filters?.serviceIds && filters.serviceIds.length > 0) {
      query = query.where(
        and(
          eq(services.active, true),
          inArray(services.id, filters.serviceIds)
        )
      );
      return await query;
    }
    
    if (filters?.dealershipId) {
      // For dealership-specific services, include GLOBAL, OEM-specific, dealership-specific, and MULTIPLE
      // Note: Dealerships use many-to-many OEM relationship via dealership_oem_mapping table
      query = query.where(
        and(
          eq(services.active, true),
          sql`(
            ${services.availabilityScope} = 'GLOBAL' OR 
            (${services.availabilityScope} = 'DEALERSHIP_SPECIFIC' AND ${services.dealershipId}::text = ${filters.dealershipId}) OR
            (${services.availabilityScope} = 'OEM_SPECIFIC' AND ${services.oemId}::text IN (
              SELECT oem_id::text FROM dealership_oem_mapping WHERE dealership_id::text = ${filters.dealershipId}
            )) OR
            (${services.availabilityScope} = 'MULTIPLE_DEALERSHIPS' AND ${filters.dealershipId} = ANY(${services.dealershipIds}::text[])) OR
            (${services.availabilityScope} = 'MULTIPLE_OEMS' AND EXISTS (
              SELECT 1 FROM dealership_oem_mapping dom
              WHERE dom.dealership_id::text = ${filters.dealershipId}
              AND dom.oem_id::text = ANY(${services.oemIds}::text[])
            ))
          )`
        )
      );
    } else if (filters?.oemId) {
      // For OEM-specific services, include GLOBAL, OEM-specific, and MULTIPLE_OEMS with matching OEMs
      query = query.where(
        and(
          eq(services.active, true),
          sql`(
            ${services.availabilityScope} = 'GLOBAL' OR 
            (${services.availabilityScope} = 'OEM_SPECIFIC' AND ${services.oemId}::text = ${filters.oemId}) OR
            (${services.availabilityScope} = 'MULTIPLE_OEMS' AND ${filters.oemId} = ANY(${services.oemIds}::text[]))
          )`
        )
      );
    } else {
      query = query.where(eq(services.active, true));
    }
    
    return await query.orderBy(services.name);
  }

  async getService(id: string): Promise<any> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async createService(serviceData: any): Promise<any> {
    const [service] = await db.insert(services).values(serviceData).returning();
    return service;
  }

  async updateService(id: string, updates: any): Promise<any> {
    const [service] = await db
      .update(services)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(services.id, id))
      .returning();
    return service;
  }

  async deleteService(id: string): Promise<boolean> {
    const result = await db
      .update(services)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(services.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getOems(): Promise<Oem[]> {
    return await db.select().from(oems).where(eq(oems.active, true));
  }

  async getOem(id: string): Promise<Oem | undefined> {
    const [oem] = await db.select().from(oems).where(eq(oems.id, id));
    return oem || undefined;
  }

  async createOem(insertOem: InsertOem): Promise<Oem> {
    const [oem] = await db
      .insert(oems)
      .values(insertOem)
      .returning();
    return oem;
  }

  async updateOem(id: string, updates: Partial<InsertOem>): Promise<Oem | undefined> {
    const [oem] = await db
      .update(oems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(oems.id, id))
      .returning();
    return oem || undefined;
  }

  async deleteOem(id: string): Promise<boolean> {
    // Comprehensive cascading delete for OEM and all related data
    
    // 1. Delete work orders for this OEM
    await db.delete(workOrders).where(eq(workOrders.oemId, id));
    
    // 2. Delete showrooms for this OEM
    await db.delete(showrooms).where(eq(showrooms.oemId, id));
    
    // 3. Update users to remove OEM association (preserve user accounts)
    await db.update(users)
      .set({ oemId: null, dealershipId: null, showroomId: null })
      .where(eq(users.oemId, id));
    
    // 4. Delete dealership-OEM mappings for this OEM (will cascade automatically)
    await db.delete(dealershipOemMapping).where(eq(dealershipOemMapping.oemId, id));
    
    // 5. Delete all vehicle models and their variants for this OEM
    const oemModels = await db.select({ id: vehicleModels.id }).from(vehicleModels).where(eq(vehicleModels.oemId, id));
    for (const model of oemModels) {
      await db.delete(vehicleVariants).where(eq(vehicleVariants.modelId, model.id));
    }
    await db.delete(vehicleModels).where(eq(vehicleModels.oemId, id));
    
    // 6. Finally delete the OEM itself
    const result = await db
      .delete(oems)
      .where(eq(oems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Dealership Management
  async getDealerships(filters?: { oemId?: string; state?: string; city?: string; search?: string; limit?: number; offset?: number }): Promise<{ dealerships: any[]; total: number }> {
    const conditions = [];
    
    // Build filter conditions
    if (filters?.state) {
      conditions.push(eq(dealerships.state, filters.state));
    }
    if (filters?.city) {
      conditions.push(eq(dealerships.city, filters.city));
    }
    
    // Add search filter (searches in name, city, and state)
    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        sql`(${dealerships.name} ILIKE ${searchPattern} OR ${dealerships.city} ILIKE ${searchPattern} OR ${dealerships.state} ILIKE ${searchPattern})`
      );
    }
    
    if (filters?.oemId) {
      // Get dealerships mapped to this OEM
      const mappings = await db
        .select({ dealershipId: dealershipOemMapping.dealershipId })
        .from(dealershipOemMapping)
        .where(and(
          eq(dealershipOemMapping.oemId, filters.oemId),
          eq(dealershipOemMapping.status, 'active')
        ));
      
      if (mappings.length === 0) {
        return { dealerships: [], total: 0 };
      }
      
      const dealershipIds = mappings.map(m => m.dealershipId);
      conditions.push(inArray(dealerships.id, dealershipIds));
    }
    
    // Get total count
    const countQuery = conditions.length > 0
      ? db.select({ count: sql<number>`count(*)::int` }).from(dealerships).where(and(...conditions))
      : db.select({ count: sql<number>`count(*)::int` }).from(dealerships);
    
    const [{ count: total }] = await countQuery;
    
    // Get paginated results
    let query = conditions.length > 0
      ? db.select().from(dealerships).where(and(...conditions))
      : db.select().from(dealerships);
    
    // Add pagination
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }
    
    const dealershipsList = await query;
    
    return { dealerships: dealershipsList, total };
  }

  async getDealershipFilterOptions(): Promise<{ states: Array<{ value: string; count: number }>; cities: Array<{ value: string; count: number }> }> {
    // Get unique states with counts
    const statesResult = await db
      .select({
        value: dealerships.state,
        count: sql<number>`count(*)::int`
      })
      .from(dealerships)
      .where(sql`${dealerships.state} IS NOT NULL AND ${dealerships.state} != ''`)
      .groupBy(dealerships.state)
      .orderBy(dealerships.state);
    
    // Get unique cities with counts
    const citiesResult = await db
      .select({
        value: dealerships.city,
        count: sql<number>`count(*)::int`
      })
      .from(dealerships)
      .where(sql`${dealerships.city} IS NOT NULL AND ${dealerships.city} != ''`)
      .groupBy(dealerships.city)
      .orderBy(dealerships.city);
    
    return {
      states: statesResult,
      cities: citiesResult
    };
  }

  async getDealership(id: string): Promise<any | undefined> {
    const [dealership] = await db
      .select()
      .from(dealerships)
      .where(eq(dealerships.id, id));
    return dealership || undefined;
  }

  async createDealership(dealership: any): Promise<any> {
    const [newDealership] = await db
      .insert(dealerships)
      .values(dealership)
      .returning();
    return newDealership;
  }

  async updateDealership(id: string, updates: any): Promise<any | undefined> {
    const [dealership] = await db
      .update(dealerships)
      .set(updates)
      .where(eq(dealerships.id, id))
      .returning();
    return dealership || undefined;
  }

  async deleteDealership(id: string): Promise<boolean> {
    // Delete associated showrooms first
    await db.delete(showrooms).where(eq(showrooms.dealershipId, id));
    
    // Delete OEM mappings (will cascade automatically due to onDelete: cascade)
    await db.delete(dealershipOemMapping).where(eq(dealershipOemMapping.dealershipId, id));
    
    // Delete the dealership
    const result = await db
      .delete(dealerships)
      .where(eq(dealerships.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Dealership-OEM Mapping Methods
  async getDealershipOems(dealershipId: string): Promise<string[]> {
    const mappings = await db
      .select({ oemId: dealershipOemMapping.oemId })
      .from(dealershipOemMapping)
      .where(and(
        eq(dealershipOemMapping.dealershipId, dealershipId),
        eq(dealershipOemMapping.status, 'active')
      ));
    return mappings.map(m => m.oemId);
  }

  async getDealershipOemsBulk(dealershipIds: string[]): Promise<Map<string, string[]>> {
    if (dealershipIds.length === 0) {
      return new Map();
    }

    const mappings = await db
      .select()
      .from(dealershipOemMapping)
      .where(and(
        inArray(dealershipOemMapping.dealershipId, dealershipIds),
        eq(dealershipOemMapping.status, 'active')
      ));
    
    // Group OEM IDs by dealership ID
    const result = new Map<string, string[]>();
    mappings.forEach(mapping => {
      if (!result.has(mapping.dealershipId)) {
        result.set(mapping.dealershipId, []);
      }
      result.get(mapping.dealershipId)!.push(mapping.oemId);
    });
    
    return result;
  }

  async addDealershipOemMapping(dealershipId: string, oemId: string): Promise<any> {
    const [mapping] = await db
      .insert(dealershipOemMapping)
      .values({ dealershipId, oemId, status: 'active' })
      .returning();
    return mapping;
  }

  async removeDealershipOemMapping(dealershipId: string, oemId: string): Promise<boolean> {
    const result = await db
      .delete(dealershipOemMapping)
      .where(and(
        eq(dealershipOemMapping.dealershipId, dealershipId),
        eq(dealershipOemMapping.oemId, oemId)
      ));
    return (result.rowCount ?? 0) > 0;
  }

  async setDealershipOems(dealershipId: string, oemIds: string[]): Promise<void> {
    // Remove all existing mappings
    await db.delete(dealershipOemMapping).where(eq(dealershipOemMapping.dealershipId, dealershipId));
    
    // Add new mappings
    if (oemIds.length > 0) {
      await db.insert(dealershipOemMapping).values(
        oemIds.map(oemId => ({ dealershipId, oemId, status: 'active' as const }))
      );
    }
  }

  async checkDealershipOemMapping(dealershipId: string, oemId: string): Promise<boolean> {
    const [mapping] = await db
      .select()
      .from(dealershipOemMapping)
      .where(and(
        eq(dealershipOemMapping.dealershipId, dealershipId),
        eq(dealershipOemMapping.oemId, oemId),
        eq(dealershipOemMapping.status, 'active')
      ))
      .limit(1);
    return !!mapping;
  }

  // Showroom Management
  async getShowrooms(filters?: { dealershipId?: string; oemId?: string; state?: string; city?: string; search?: string; limit?: number; offset?: number }): Promise<{ showrooms: any[]; total: number }> {
    const conditions = [];
    
    // Build filter conditions
    if (filters?.dealershipId) {
      conditions.push(eq(showrooms.dealershipId, filters.dealershipId));
    }
    if (filters?.oemId) {
      conditions.push(eq(showrooms.oemId, filters.oemId));
    }
    if (filters?.state) {
      conditions.push(eq(showrooms.state, filters.state));
    }
    if (filters?.city) {
      conditions.push(eq(showrooms.city, filters.city));
    }
    
    // Add search filter (searches in name, city, and state)
    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        sql`(${showrooms.name} ILIKE ${searchPattern} OR ${showrooms.city} ILIKE ${searchPattern} OR ${showrooms.state} ILIKE ${searchPattern})`
      );
    }
    
    // Get total count
    const countQuery = conditions.length > 0
      ? db.select({ count: sql<number>`count(*)::int` }).from(showrooms).where(and(...conditions))
      : db.select({ count: sql<number>`count(*)::int` }).from(showrooms);
    
    const [{ count: total }] = await countQuery;
    
    // Get paginated results
    let query = conditions.length > 0
      ? db.select().from(showrooms).where(and(...conditions))
      : db.select().from(showrooms);
    
    // Add pagination
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }
    
    const showroomsList = await query;
    
    // PERFORMANCE OPTIMIZATION: Fetch all related data in bulk (2-3 queries instead of 2*N queries)
    const showroomIds = showroomsList.map(s => s.id);
    
    if (showroomIds.length === 0) {
      return { showrooms: [], total: 0 };
    }
    
    // Fetch all users for these showrooms in ONE query
    const allUsers = await db
      .select()
      .from(users)
      .where(inArray(users.showroomId, showroomIds));
    
    // Fetch all work orders for these showrooms in ONE query (with error handling)
    let allWorkOrders: any[] = [];
    try {
      allWorkOrders = await db
        .select()
        .from(workOrders)
        .where(inArray(workOrders.showroomId, showroomIds));
    } catch (e) {
      // Table doesn't exist yet, keep empty array
    }
    
    // Count in memory using Maps for O(n) performance
    const staffCountByShowroom = new Map<string, number>();
    allUsers.forEach((user: any) => {
      if (user.showroomId) {
        staffCountByShowroom.set(user.showroomId, (staffCountByShowroom.get(user.showroomId) || 0) + 1);
      }
    });
    
    const workOrdersCountByShowroom = new Map<string, number>();
    allWorkOrders.forEach((order: any) => {
      if (order.showroomId) {
        workOrdersCountByShowroom.set(order.showroomId, (workOrdersCountByShowroom.get(order.showroomId) || 0) + 1);
      }
    });
    
    // Add counts to each showroom (in memory operation)
    const showroomsWithCounts = showroomsList.map((showroom) => ({
      ...showroom,
      salesStaffCount: staffCountByShowroom.get(showroom.id) || 0,
      workOrdersCount: workOrdersCountByShowroom.get(showroom.id) || 0
    }));
    
    return { showrooms: showroomsWithCounts, total };
  }

  async getShowroomFilterOptions(): Promise<{ states: Array<{ value: string; count: number }>; cities: Array<{ value: string; count: number }> }> {
    // Get unique states with counts
    const statesResult = await db
      .select({
        value: showrooms.state,
        count: sql<number>`count(*)::int`
      })
      .from(showrooms)
      .where(sql`${showrooms.state} IS NOT NULL AND ${showrooms.state} != ''`)
      .groupBy(showrooms.state)
      .orderBy(showrooms.state);
    
    // Get unique cities with counts
    const citiesResult = await db
      .select({
        value: showrooms.city,
        count: sql<number>`count(*)::int`
      })
      .from(showrooms)
      .where(sql`${showrooms.city} IS NOT NULL AND ${showrooms.city} != ''`)
      .groupBy(showrooms.city)
      .orderBy(showrooms.city);
    
    return {
      states: statesResult,
      cities: citiesResult
    };
  }

  async getShowroom(id: string): Promise<any | undefined> {
    const [showroom] = await db
      .select()
      .from(showrooms)
      .where(eq(showrooms.id, id));
    return showroom || undefined;
  }

  async createShowroom(showroom: any): Promise<any> {
    const [newShowroom] = await db
      .insert(showrooms)
      .values(showroom)
      .returning();
    return newShowroom;
  }

  async updateShowroom(id: string, updates: any): Promise<any | undefined> {
    const [showroom] = await db
      .update(showrooms)
      .set(updates)
      .where(eq(showrooms.id, id))
      .returning();
    return showroom || undefined;
  }

  async deleteShowroom(id: string): Promise<boolean> {
    const result = await db
      .delete(showrooms)
      .where(eq(showrooms.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getWorkOrders(filters?: { 
    oemId?: string; 
    dealershipId?: string;
    showroomId?: string; 
    partnerId?: string; 
    status?: string;
    workOrderIds?: string[];  // Add bulk support
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    // Simple query first, then manually populate related data
    let query = db.select().from(workOrders);
    
    const conditions = [];
    if (filters?.oemId) conditions.push(eq(workOrders.oemId, filters.oemId));
    if (filters?.dealershipId) conditions.push(eq(workOrders.dealershipId, filters.dealershipId));
    if (filters?.showroomId) conditions.push(eq(workOrders.showroomId, filters.showroomId));
    if (filters?.partnerId) conditions.push(eq(workOrders.assignedPartnerId, filters.partnerId));
    if (filters?.status) conditions.push(eq(workOrders.status, filters.status as any));
    
    // Add bulk support for multiple work order IDs
    if (filters?.workOrderIds && filters.workOrderIds.length > 0) {
      conditions.push(inArray(workOrders.id, filters.workOrderIds));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(workOrders.createdAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    const workOrderResults = await query;
    
    // Manually populate related data to avoid Drizzle join issues
    const enrichedWorkOrders = [];
    for (const wo of workOrderResults) {
      const enriched = { ...wo };
      
      // Fetch vehicle model name
      if (wo.vehicleModelId) {
        const vehicleModel = await db.select().from(vehicleModels).where(eq(vehicleModels.id, wo.vehicleModelId)).limit(1);
        enriched.vehicleModelName = vehicleModel[0]?.modelName || null;
      }
      
      // Fetch service name
      if (wo.serviceId) {
        const service = await db.select().from(services).where(eq(services.id, wo.serviceId)).limit(1);
        enriched.serviceName = service[0]?.name || null;
      }
      
      // Fetch partner name
      if (wo.assignedPartnerId) {
        const partner = await db.select().from(partners).where(eq(partners.id, wo.assignedPartnerId)).limit(1);
        if (partner[0]) {
          enriched.assignedPartner = {
            id: partner[0].id,
            displayName: partner[0].displayName
          };
        }
      }
      
      enrichedWorkOrders.push(enriched);
    }
    
    console.log(`Found ${enrichedWorkOrders.length} work orders`);
    return enrichedWorkOrders;
  }

  async getWorkOrder(id: string): Promise<any | undefined> {
    const [workOrder] = await db.select().from(workOrders).where(eq(workOrders.id, id));
    if (!workOrder) return undefined;

    // Enrich with related data like the list view does
    const enriched: any = { ...workOrder };
    
    try {
      // Fetch vehicle model details
      if (workOrder.vehicleModelId) {
        const vehicleModel = await db.select().from(vehicleModels).where(eq(vehicleModels.id, workOrder.vehicleModelId)).limit(1);
        if (vehicleModel[0]) {
          enriched.vehicleModelName = vehicleModel[0].modelName;
          enriched.vehicleBrandId = vehicleModel[0].oemId; // OEM is the vehicle brand
          enriched.vehicleModel = vehicleModel[0];
        }
      }
      
      // Fetch service details
      if (workOrder.serviceId) {
        const service = await db.select().from(services).where(eq(services.id, workOrder.serviceId)).limit(1);
        if (service[0]) {
          enriched.serviceName = service[0].name;
          enriched.serviceDescription = service[0].description;
          enriched.service = service[0];
        }
      }
      
      // Fetch partner details - keep same structure as getWorkOrders
      if (workOrder.assignedPartnerId) {
        const partner = await db.select().from(partners).where(eq(partners.id, workOrder.assignedPartnerId)).limit(1);
        if (partner[0]) {
          enriched.assignedPartner = {
            id: partner[0].id,
            displayName: partner[0].displayName
          };
          enriched.partnerName = partner[0].displayName; // For backwards compatibility
          enriched.partnerType = partner[0].type;
          enriched.partner = partner[0];
        }
      }

      // Fetch OEM details
      if (workOrder.oemId) {
        const oem = await db.select().from(oems).where(eq(oems.id, workOrder.oemId)).limit(1);
        if (oem[0]) {
          enriched.oemName = oem[0].name;
          enriched.oem = oem[0];
        }
      }

      // Fetch dealership details
      if (workOrder.dealershipId) {
        const dealership = await db.select().from(dealerships).where(eq(dealerships.id, workOrder.dealershipId)).limit(1);
        if (dealership[0]) {
          enriched.dealershipName = dealership[0].name;
          enriched.dealership = dealership[0];
        }
      }

      // Fetch showroom details
      if (workOrder.showroomId) {
        const showroom = await db.select().from(showrooms).where(eq(showrooms.id, workOrder.showroomId)).limit(1);
        if (showroom[0]) {
          enriched.showroomName = showroom[0].name;
          enriched.showroom = showroom[0];
        }
      }

      // Fetch sales person details
      if (workOrder.salesPersonId) {
        const salesPerson = await db.select().from(salesPersons).where(eq(salesPersons.id, workOrder.salesPersonId)).limit(1);
        if (salesPerson[0]) {
          enriched.salesPersonName = salesPerson[0].name;
          enriched.salesPerson = salesPerson[0];
        }
      }

      // Fetch job card details if assigned
      if (workOrder.assignedJobCardId) {
        const jobCard = await db.select().from(jobCards).where(eq(jobCards.id, workOrder.assignedJobCardId)).limit(1);
        if (jobCard[0]) {
          enriched.jobCard = jobCard[0];
        }
      }

      // Fetch cancelled by user details if cancelled
      if (workOrder.cancelledBy) {
        const cancelledByUser = await db.select().from(users).where(eq(users.id, workOrder.cancelledBy)).limit(1);
        if (cancelledByUser[0]) {
          enriched.cancelledByName = cancelledByUser[0].name || cancelledByUser[0].email;
        }
      }

    } catch (error) {
      console.error("Error enriching work order data:", error);
    }
    
    return enriched;
  }

  // 🔧 Get Work Orders with Salesperson but missing commissions (for backfill)
  async getWorkOrdersWithoutCommissions(): Promise<any[]> {
    const workOrdersWithoutCommissions = await db
      .select({
        id: workOrders.id,
        customerName: workOrders.customerName,
        salesPersonId: workOrders.salesPersonId,
        showroomId: workOrders.showroomId,
        serviceId: workOrders.serviceId,
        createdAt: workOrders.createdAt,
        salesPersonName: salesPersons.name,
        showroomName: showrooms.name
      })
      .from(workOrders)
      .leftJoin(commissions, eq(commissions.workOrderId, workOrders.id))
      .leftJoin(salesPersons, eq(salesPersons.id, workOrders.salesPersonId))  
      .leftJoin(showrooms, eq(showrooms.id, workOrders.showroomId))
      .where(
        and(
          isNull(commissions.id), // No commission exists
          ne(workOrders.salesPersonId, null) // Has sales person assigned
        )
      );
    
    console.log(`🔍 Found ${workOrdersWithoutCommissions.length} Work Orders with missing commissions`);
    return workOrdersWithoutCommissions;
  }

  async createWorkOrder(insertWorkOrder: InsertWorkOrder): Promise<WorkOrder> {
    const [workOrder] = await db
      .insert(workOrders)
      .values(insertWorkOrder)
      .returning();
    return workOrder;
  }

  async updateWorkOrder(id: string, updates: Partial<InsertWorkOrder>): Promise<WorkOrder | undefined> {
    const [workOrder] = await db
      .update(workOrders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workOrders.id, id))
      .returning();
    return workOrder || undefined;
  }

  async getJobCards(filters?: { 
    partnerId?: string; 
    workOrderId?: string;
    showroomId?: string;
    dealershipId?: string;
    oemId?: string;
    status?: string;
    assignedInstallerId?: string;
    limit?: number;
    offset?: number;
  }): Promise<JobCard[]> {
    // Special handling for partner-based filtering considering allocations
    if (filters?.partnerId && !filters?.oemId && !filters?.dealershipId && !filters?.showroomId) {
      return await this.getJobCardsForPartner(filters.partnerId, {
        workOrderId: filters.workOrderId,
        status: filters.status,
        assignedInstallerId: filters.assignedInstallerId,
        limit: filters.limit,
        offset: filters.offset
      });
    }
    
    // Need to join with workOrders for showroomId, dealershipId, and oemId filtering
    if (filters?.showroomId || filters?.dealershipId || filters?.oemId) {
      let query = db.select(jobCards).from(jobCards).innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id));
      
      // For dealership filtering, we need to join through showrooms to get dealershipId
      if (filters?.dealershipId) {
        query = query.innerJoin(showrooms, eq(workOrders.showroomId, showrooms.id));
      }
      
      const conditions = [];
      if (filters?.partnerId) conditions.push(eq(jobCards.partnerId, filters.partnerId));
      if (filters?.workOrderId) conditions.push(eq(jobCards.workOrderId, filters.workOrderId));
      if (filters?.status) conditions.push(eq(jobCards.status, filters.status as any));
      if (filters?.assignedInstallerId) conditions.push(eq(jobCards.assignedInstallerId, filters.assignedInstallerId));
      if (filters?.showroomId) conditions.push(eq(workOrders.showroomId, filters.showroomId));
      if (filters?.dealershipId) conditions.push(eq(showrooms.dealershipId, filters.dealershipId));
      if (filters?.oemId) conditions.push(eq(workOrders.oemId, filters.oemId));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      query = query.orderBy(desc(jobCards.createdAt));

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      if (filters?.offset) {
        query = query.offset(filters.offset);
      }

      return await query;
    } else {
      // Simple query without join for better performance
      let query = db.select().from(jobCards);
      
      const conditions = [];
      if (filters?.partnerId) conditions.push(eq(jobCards.partnerId, filters.partnerId));
      if (filters?.workOrderId) conditions.push(eq(jobCards.workOrderId, filters.workOrderId));
      if (filters?.status) conditions.push(eq(jobCards.status, filters.status as any));
      if (filters?.assignedInstallerId) conditions.push(eq(jobCards.assignedInstallerId, filters.assignedInstallerId));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      query = query.orderBy(desc(jobCards.createdAt));

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      if (filters?.offset) {
        query = query.offset(filters.offset);
      }

      return await query;
    }
  }

  async getJobCardsForPartner(partnerId: string, filters?: {
    workOrderId?: string;
    status?: string;
    assignedInstallerId?: string;
    limit?: number;
    offset?: number;
  }): Promise<JobCard[]> {
    // Get partner allocations to determine which job cards they can access
    const allocations = await this.getAllocations({ partnerId, active: true });
    
    if (allocations.length === 0) {
      // No allocations, return only directly assigned job cards
      return await this.getJobCards({
        partnerId,
        workOrderId: filters?.workOrderId,
        status: filters?.status,
        assignedInstallerId: filters?.assignedInstallerId,
        limit: filters?.limit,
        offset: filters?.offset
      });
    }

    // Build query to include job cards from allocated showrooms/dealerships/OEMs
    let query = db.select(jobCards)
      .from(jobCards)
      .innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
      .innerJoin(showrooms, eq(workOrders.showroomId, showrooms.id))
      .innerJoin(dealerships, eq(showrooms.dealershipId, dealerships.id));

    // Build OR conditions for different allocation levels
    const allocationConditions = [];

    for (const allocation of allocations) {
      if (allocation.level === 'OEM') {
        allocationConditions.push(eq(dealerships.oemId, allocation.levelId));
      } else if (allocation.level === 'DEALERSHIP') {
        allocationConditions.push(eq(showrooms.dealershipId, allocation.levelId));
      } else if (allocation.level === 'SHOWROOM') {
        allocationConditions.push(eq(workOrders.showroomId, allocation.levelId));
      }
    }

    // Also include directly assigned job cards
    allocationConditions.push(eq(jobCards.partnerId, partnerId));

    const conditions = [or(...allocationConditions)];
    
    if (filters?.workOrderId) conditions.push(eq(jobCards.workOrderId, filters.workOrderId));
    if (filters?.status) conditions.push(eq(jobCards.status, filters.status as any));
    if (filters?.assignedInstallerId) conditions.push(eq(jobCards.assignedInstallerId, filters.assignedInstallerId));

    query = query.where(and(...conditions));
    query = query.orderBy(desc(jobCards.createdAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }

  async getJobCard(id: string): Promise<JobCard | undefined> {
    const [jobCard] = await db.select().from(jobCards).where(eq(jobCards.id, id));
    return jobCard || undefined;
  }

  async createJobCard(insertJobCard: InsertJobCard): Promise<JobCard> {
    const [jobCard] = await db
      .insert(jobCards)
      .values(insertJobCard)
      .returning();
    return jobCard;
  }

  async updateJobCard(id: string, updates: Partial<InsertJobCard>): Promise<JobCard | undefined> {
    const [jobCard] = await db
      .update(jobCards)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobCards.id, id))
      .returning();
    return jobCard || undefined;
  }

  async insertJobCardMedia(media: { jobCardId: string; type: string; url: string; caption?: string }): Promise<any> {
    const [result] = await db
      .insert(jobCardMedia)
      .values({
        jobCardId: media.jobCardId,
        type: media.type,
        url: media.url,
        caption: media.caption || ''
      })
      .returning();
    return result;
  }

  async getJobCardMedia(filters: { jobCardId: string }): Promise<any[]> {
    const media = await db
      .select()
      .from(jobCardMedia)
      .where(eq(jobCardMedia.jobCardId, filters.jobCardId))
      .orderBy(jobCardMedia.createdAt);
    return media;
  }

  // ====================== Approval Management ======================
  async createApproval(approval: { jobCardId: string; approverUserId: string; status: string; remarks?: string }): Promise<any> {
    const [created] = await db.insert(approvals).values({
      jobCardId: approval.jobCardId,
      approverUserId: approval.approverUserId,
      status: approval.status,
      remarks: approval.remarks || null,
      decidedAt: new Date()
    }).returning();
    return created;
  }

  async getApprovals(filters?: { jobCardId?: string }): Promise<any[]> {
    let query = db.select().from(approvals);
    
    if (filters?.jobCardId) {
      query = query.where(eq(approvals.jobCardId, filters.jobCardId));
    }
    
    return await query;
  }

  // ====================== Partner CRUD ======================
  async getPartners(filters?: { oemId?: string; type?: string; partnerIds?: string[] }): Promise<Partner[]> {
    let query = db.select().from(partners).where(eq(partners.active, true));
    
    // Handle bulk partner IDs query
    if (filters?.partnerIds && filters.partnerIds.length > 0) {
      query = query.where(
        and(
          eq(partners.active, true),
          inArray(partners.id, filters.partnerIds)
        )
      );
      return await query;
    }
    
    if (filters?.type) {
      query = query.where(eq(partners.type, filters.type as any));
    }
    
    // Note: oemId filtering is not implemented in the current schema
    // Partners are not directly associated with OEMs in the current data model
    
    return await query;
  }

  async getPartner(id: string): Promise<Partner | undefined> {
    const [partner] = await db.select().from(partners).where(eq(partners.id, id));
    return partner || undefined;
  }

  async createPartner(insertPartner: InsertPartner): Promise<Partner> {
    const [partner] = await db
      .insert(partners)
      .values(insertPartner)
      .returning();
    return partner;
  }

  async checkPartnerOemAccess(partnerId: string, oemId: string): Promise<boolean> {
    const [mapping] = await db
      .select()
      .from(partnerOems)
      .where(and(
        eq(partnerOems.partnerId, partnerId),
        eq(partnerOems.oemId, oemId),
        eq(partnerOems.active, true)
      ));
    
    return !!mapping;
  }

  async getPartnerOems(partnerId: string): Promise<string[]> {
    const mappings = await db
      .select({ oemId: partnerOems.oemId })
      .from(partnerOems)
      .where(and(
        eq(partnerOems.partnerId, partnerId),
        eq(partnerOems.active, true)
      ));
    
    return mappings.map(m => m.oemId);
  }

  async updatePartner(id: string, updates: Partial<InsertPartner>): Promise<Partner | undefined> {
    const [partner] = await db
      .update(partners)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(partners.id, id))
      .returning();
    return partner || undefined;
  }

  async deletePartner(id: string): Promise<boolean> {
    // Soft delete by setting active to false to preserve data integrity
    const [deletedPartner] = await db
      .update(partners)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(partners.id, id))
      .returning();
    
    return !!deletedPartner;
  }

  // Partner Service Categories management
  async getPartnerServiceCategories(partnerId: string): Promise<string[]> {
    const mappings = await db
      .select({ serviceCategoryId: partnerServiceCategories.serviceCategoryId })
      .from(partnerServiceCategories)
      .where(eq(partnerServiceCategories.partnerId, partnerId));
    return mappings.map(m => m.serviceCategoryId);
  }

  async getPartnersWithCategories(): Promise<(Partner & { serviceCategories?: ServiceCategory[] })[]> {
    // Get all active partners
    const allPartners = await db.select().from(partners).where(eq(partners.active, true));
    
    // Get all partner-category mappings with category details
    const mappings = await db
      .select({
        partnerId: partnerServiceCategories.partnerId,
        category: serviceCategories
      })
      .from(partnerServiceCategories)
      .innerJoin(serviceCategories, eq(partnerServiceCategories.serviceCategoryId, serviceCategories.id))
      .where(eq(serviceCategories.active, true));

    // Group categories by partner
    const partnerCategoriesMap = new Map<string, ServiceCategory[]>();
    for (const mapping of mappings) {
      const categories = partnerCategoriesMap.get(mapping.partnerId) || [];
      categories.push(mapping.category);
      partnerCategoriesMap.set(mapping.partnerId, categories);
    }

    // Combine partners with their categories
    return allPartners.map(partner => ({
      ...partner,
      serviceCategories: partnerCategoriesMap.get(partner.id) || []
    }));
  }

  async setPartnerServiceCategories(partnerId: string, serviceCategoryIds: string[]): Promise<void> {
    // Remove existing mappings
    await db
      .delete(partnerServiceCategories)
      .where(eq(partnerServiceCategories.partnerId, partnerId));

    // Add new mappings
    if (serviceCategoryIds.length > 0) {
      const mappings = serviceCategoryIds.map(categoryId => ({
        partnerId,
        serviceCategoryId: categoryId
      }));
      await db.insert(partnerServiceCategories).values(mappings);
    }
  }

  // Partner Brands management
  async getPartnerBrands(partnerId: string): Promise<string[]> {
    const mappings = await db
      .select({ brandId: partnerBrands.brandId })
      .from(partnerBrands)
      .where(eq(partnerBrands.partnerId, partnerId));
    return mappings.map(m => m.brandId);
  }

  async setPartnerBrands(partnerId: string, brandIds: string[]): Promise<void> {
    // Remove existing mappings
    await db
      .delete(partnerBrands)
      .where(eq(partnerBrands.partnerId, partnerId));

    // Add new mappings
    if (brandIds.length > 0) {
      const mappings = brandIds.map(brandId => ({
        partnerId,
        brandId: brandId
      }));
      await db.insert(partnerBrands).values(mappings);
    }
  }

  // Allocation Brands management
  async getAllocationBrands(allocationId: string): Promise<string[]> {
    const mappings = await db
      .select({ brandId: allocationBrands.brandId })
      .from(allocationBrands)
      .where(eq(allocationBrands.allocationId, allocationId));
    return mappings.map(m => m.brandId);
  }

  async setAllocationBrands(allocationId: string, brandIds: string[]): Promise<void> {
    // Get the allocation details to check level and levelId
    const [allocation] = await db
      .select()
      .from(allocations)
      .where(eq(allocations.id, allocationId));
    
    if (!allocation) {
      throw new Error('Allocation not found');
    }

    // Check for duplicate brand assignments
    if (brandIds.length > 0) {
      const existingBrandAllocations = await db
        .select({
          brandId: allocationBrands.brandId,
          partnerId: allocations.partnerId,
          partnerName: partners.displayName
        })
        .from(allocations)
        .innerJoin(allocationBrands, eq(allocations.id, allocationBrands.allocationId))
        .innerJoin(partners, eq(allocations.partnerId, partners.id))
        .where(and(
          eq(allocations.level, allocation.level),
          eq(allocations.levelId, allocation.levelId),
          eq(allocations.active, true),
          ne(allocations.id, allocationId), // Exclude current allocation
          inArray(allocationBrands.brandId, brandIds)
        ));

      if (existingBrandAllocations.length > 0) {
        const duplicates = existingBrandAllocations.map(ba => 
          `Brand already assigned to ${ba.partnerName}`
        ).join('; ');
        throw new Error(`Duplicate allocation detected: ${duplicates}. Each brand can only be assigned to one partner per ${allocation.level.toLowerCase()}.`);
      }
    }

    // Remove existing mappings
    await db
      .delete(allocationBrands)
      .where(eq(allocationBrands.allocationId, allocationId));

    // Add new mappings
    if (brandIds.length > 0) {
      const mappings = brandIds.map(brandId => ({
        allocationId,
        brandId: brandId
      }));
      await db.insert(allocationBrands).values(mappings);
    }
  }

  // Partner Showroom Mapping management
  async getPartnerShowrooms(partnerId: string): Promise<string[]> {
    const mappings = await db
      .select({ showroomId: partnerShowroomMapping.showroomId })
      .from(partnerShowroomMapping)
      .where(and(
        eq(partnerShowroomMapping.partnerId, partnerId),
        eq(partnerShowroomMapping.status, 'active')
      ));
    return mappings.map(m => m.showroomId);
  }

  async setPartnerShowrooms(partnerId: string, showroomIds: string[]): Promise<void> {
    // Set all existing mappings to inactive
    await db
      .update(partnerShowroomMapping)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(eq(partnerShowroomMapping.partnerId, partnerId));

    // Add or reactivate mappings for selected showrooms
    if (showroomIds.length > 0) {
      for (const showroomId of showroomIds) {
        // Check if mapping exists
        const [existing] = await db
          .select()
          .from(partnerShowroomMapping)
          .where(and(
            eq(partnerShowroomMapping.partnerId, partnerId),
            eq(partnerShowroomMapping.showroomId, showroomId)
          ));

        if (existing) {
          // Reactivate existing mapping
          await db
            .update(partnerShowroomMapping)
            .set({ status: 'active', updatedAt: new Date() })
            .where(eq(partnerShowroomMapping.id, existing.id));
        } else {
          // Create new mapping
          await db.insert(partnerShowroomMapping).values({
            partnerId,
            showroomId,
            status: 'active'
          });
        }
      }
    }
  }

  async checkPartnerShowroomMapping(partnerId: string, showroomId: string): Promise<boolean> {
    const [mapping] = await db
      .select()
      .from(partnerShowroomMapping)
      .where(and(
        eq(partnerShowroomMapping.partnerId, partnerId),
        eq(partnerShowroomMapping.showroomId, showroomId),
        eq(partnerShowroomMapping.status, 'active')
      ));
    
    return !!mapping;
  }

  async getPartnersForShowroom(showroomId: string, type?: string): Promise<Partner[]> {
    let query = db
      .select({
        partner: partners
      })
      .from(partnerShowroomMapping)
      .innerJoin(partners, eq(partnerShowroomMapping.partnerId, partners.id))
      .where(and(
        eq(partnerShowroomMapping.showroomId, showroomId),
        eq(partnerShowroomMapping.status, 'active'),
        eq(partners.active, true)
      ));
    
    const results = await query;
    let partnersList = results.map(r => r.partner);
    
    // Filter by type if provided
    if (type) {
      partnersList = partnersList.filter(p => p.type === type);
    }
    
    return partnersList;
  }

  // Partner Staff Management implementations
  async getPartnerStaff(partnerId: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(and(
        eq(users.partnerId, partnerId),
        eq(users.role, 'PARTNER_STAFF'),
        eq(users.isActive, true)
      ))
      .orderBy(desc(users.createdAt));
  }

  async createPartnerStaff(partnerId: string, staffData: Omit<InsertUser, 'partnerId' | 'role'>): Promise<User> {
    const [newStaff] = await db
      .insert(users)
      .values({
        ...staffData,
        partnerId,
        role: 'PARTNER_STAFF',
        isActive: true
      })
      .returning();
    
    return newStaff;
  }

  async updatePartnerStaff(staffId: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedStaff] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, staffId))
      .returning();
    
    return updatedStaff || undefined;
  }

  async deletePartnerStaff(staffId: string): Promise<boolean> {
    // Soft delete by setting isActive to false
    const [deletedStaff] = await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, staffId))
      .returning();
    
    return !!deletedStaff;
  }

  // Partner Payout & Earnings Management implementations
  async getPartnerPayouts(partnerId: string): Promise<any[]> {
    try {
      // First get basic payout info
      const payoutData = await db
        .select({
          id: payouts.id,
          jobCardId: payouts.jobCardId,
          grossAmount: payouts.grossAmount,
          netAmount: payouts.netAmount,
          status: payouts.status,
          paidAt: payouts.paidAt,
          paymentReference: payouts.paymentReference,
          createdAt: payouts.createdAt,
          workOrderId: jobCards.workOrderId,
          customerName: workOrders.customerName,
          regNo: workOrders.regNo
        })
        .from(payouts)
        .innerJoin(jobCards, eq(payouts.jobCardId, jobCards.id))
        .innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
        .where(eq(payouts.partnerId, partnerId))
        .orderBy(desc(payouts.createdAt));

      // Enrich with service and vehicle info
      const enrichedPayouts = [];
      for (const payout of payoutData) {
        try {
          // Get service info
          const serviceInfo = await db
            .select({ name: services.name })
            .from(services)
            .innerJoin(workOrders, eq(services.id, workOrders.serviceId))
            .where(eq(workOrders.id, payout.workOrderId))
            .limit(1);

          // Get vehicle model info
          const vehicleInfo = await db
            .select({ modelName: vehicleModels.modelName })
            .from(vehicleModels)
            .innerJoin(workOrders, eq(vehicleModels.id, workOrders.vehicleModelId))
            .where(eq(workOrders.id, payout.workOrderId))
            .limit(1);

          enrichedPayouts.push({
            ...payout,
            jobCardNumber: `JC-${payout.jobCardId.substring(payout.jobCardId.length - 6)}`, // Create proper JC format
            serviceName: serviceInfo[0]?.name || 'Unknown Service',
            vehicleModelName: vehicleInfo[0]?.modelName || 'Unknown Model'
          });
        } catch (enrichError) {
          console.warn("Error enriching payout data:", enrichError);
          // Add with fallback values
          enrichedPayouts.push({
            ...payout,
            jobCardNumber: `JC-${payout.jobCardId.substring(payout.jobCardId.length - 6)}`, // Create proper JC format
            serviceName: 'Unknown Service',
            vehicleModelName: 'Unknown Model'
          });
        }
      }

      return enrichedPayouts;
    } catch (error) {
      console.error("Get partner payouts error:", error);
      return [];
    }
  }

  async getPartnerEarningsSummary(partnerId: string): Promise<{
    totalEarnings: number;
    paidAmount: number;
    pendingAmount: number;
    thisMonthEarnings: number;
    completedJobs: number;
    pendingJobs: number;
  }> {
    // Get current month start
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all payouts for this partner
    const allPayouts = await db
      .select({
        netAmount: payouts.netAmount,
        status: payouts.status,
        createdAt: payouts.createdAt
      })
      .from(payouts)
      .where(eq(payouts.partnerId, partnerId));

    // Calculate summary stats
    const totalEarnings = allPayouts.reduce((sum, p) => sum + parseFloat(p.netAmount), 0);
    const paidAmount = allPayouts
      .filter(p => p.status === 'PAID')
      .reduce((sum, p) => sum + parseFloat(p.netAmount), 0);
    const pendingAmount = allPayouts
      .filter(p => p.status === 'PENDING')
      .reduce((sum, p) => sum + parseFloat(p.netAmount), 0);
    const thisMonthEarnings = allPayouts
      .filter(p => p.createdAt >= monthStart)
      .reduce((sum, p) => sum + parseFloat(p.netAmount), 0);

    // Get job counts
    const jobCounts = await db
      .select({
        completedJobs: count(sql`CASE WHEN ${jobCards.status} IN ('COMPLETED', 'APPROVED', 'CLOSED') THEN 1 END`),
        pendingJobs: count(sql`CASE WHEN ${jobCards.status} IN ('AWAITING_ACK', 'ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_APPROVAL') THEN 1 END`)
      })
      .from(jobCards)
      .where(eq(jobCards.partnerId, partnerId));

    return {
      totalEarnings,
      paidAmount,
      pendingAmount,
      thisMonthEarnings,
      completedJobs: jobCounts[0]?.completedJobs || 0,
      pendingJobs: jobCounts[0]?.pendingJobs || 0
    };
  }

  async getPartnerServiceRates(partnerId: string): Promise<any[]> {
    // Get detailer pricing rules for this partner
    return await db
      .select({
        id: pricingRules.id,
        serviceCategoryId: pricingRules.serviceCategoryId,
        serviceId: pricingRules.serviceId,
        vehicleModelId: pricingRules.vehicleModelId,
        vehicleVariantId: pricingRules.vehicleVariantId,
        priceAmount: pricingRules.priceAmount,
        currency: pricingRules.currency,
        effectiveFrom: pricingRules.effectiveFrom,
        effectiveTo: pricingRules.effectiveTo,
        status: pricingRules.status,
        // Related data
        serviceCategoryName: serviceCategories.name,
        serviceName: services.name,
        vehicleModelName: vehicleModels.modelName,
        vehicleVariantName: vehicleVariants.variantName
      })
      .from(pricingRules)
      .leftJoin(serviceCategories, eq(pricingRules.serviceCategoryId, serviceCategories.id))
      .leftJoin(services, eq(pricingRules.serviceId, services.id))
      .leftJoin(vehicleModels, eq(pricingRules.vehicleModelId, vehicleModels.id))
      .leftJoin(vehicleVariants, eq(pricingRules.vehicleVariantId, vehicleVariants.id))
      .where(and(
        eq(pricingRules.pricingType, 'DETAILER_PRICING'),
        eq(pricingRules.detailerId, partnerId),
        eq(pricingRules.status, 'ACTIVE')
      ))
      .orderBy(serviceCategories.name, services.name, vehicleModels.modelName);
  }

  async getPricingRules(filters?: { 
    partnerId?: string; 
    scopeId?: string; 
    pricingType?: string;
    dealershipId?: string;
    detailerId?: string;
    serviceCategoryId?: string;
    oemId?: string;
  }): Promise<any[]> {
    let query = db.select({
      id: pricingRules.id,
      pricingType: pricingRules.pricingType,
      partnerId: pricingRules.partnerId,
      scope: pricingRules.scope,
      scopeId: pricingRules.scopeId,
      dealershipId: pricingRules.dealershipId,
      detailerId: pricingRules.detailerId,
      oemId: pricingRules.oemId,
      vehicleModelId: pricingRules.vehicleModelId,
      vehicleVariantId: pricingRules.vehicleVariantId,
      serviceId: pricingRules.serviceId,
      serviceCategoryId: pricingRules.serviceCategoryId,
      priceAmount: pricingRules.priceAmount,
      currency: pricingRules.currency,
      effectiveFrom: pricingRules.effectiveFrom,
      effectiveTo: pricingRules.effectiveTo,
      status: pricingRules.status,
      createdAt: pricingRules.createdAt,
      updatedAt: pricingRules.updatedAt,
      // Join related data
      dealershipName: dealerships.name,
      oemName: oems.name,
      vehicleModelName: vehicleModels.modelName,
      serviceName: services.name,
      serviceCategoryName: serviceCategories.name,
      detailerName: partners.displayName,
    })
    .from(pricingRules)
    .leftJoin(dealerships, eq(pricingRules.dealershipId, dealerships.id))
    .leftJoin(oems, eq(pricingRules.oemId, oems.id))
    .leftJoin(vehicleModels, eq(pricingRules.vehicleModelId, vehicleModels.id))
    .leftJoin(services, eq(pricingRules.serviceId, services.id))
    .leftJoin(serviceCategories, eq(pricingRules.serviceCategoryId, serviceCategories.id))
    .leftJoin(partners, eq(pricingRules.detailerId, partners.id));
    
    const conditions = [eq(pricingRules.status, "ACTIVE")];
    if (filters?.partnerId) conditions.push(eq(pricingRules.partnerId, filters.partnerId));
    if (filters?.scopeId) conditions.push(eq(pricingRules.scopeId, filters.scopeId));
    if (filters?.pricingType) conditions.push(eq(pricingRules.pricingType, filters.pricingType as any));
    if (filters?.dealershipId) conditions.push(eq(pricingRules.dealershipId, filters.dealershipId));
    if (filters?.detailerId) conditions.push(eq(pricingRules.detailerId, filters.detailerId));
    if (filters?.serviceCategoryId) conditions.push(eq(pricingRules.serviceCategoryId, filters.serviceCategoryId));
    if (filters?.oemId) conditions.push(eq(pricingRules.oemId, filters.oemId));

    return await query.where(and(...conditions));
  }

  async createPricingRule(insertRule: InsertPricingRule): Promise<PricingRule> {
    const [rule] = await db
      .insert(pricingRules)
      .values(insertRule)
      .returning();
    return rule;
  }

  async updatePricingRule(id: string, updates: Partial<InsertPricingRule>): Promise<PricingRule | undefined> {
    const [rule] = await db
      .update(pricingRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pricingRules.id, id))
      .returning();
    return rule || undefined;
  }

  async deletePricingRule(id: string): Promise<boolean> {
    const result = await db
      .delete(pricingRules)
      .where(eq(pricingRules.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getCommissionRules(filters?: { 
    oemId?: string; 
    dealershipId?: string; 
    showroomId?: string;
    salesPersonId?: string;
  }): Promise<CommissionRule[]> {
    let query = db.select().from(commissionRules);
    
    const now = new Date();
    const conditions = [
      eq(commissionRules.status, "ACTIVE"),
      lte(commissionRules.effectiveFrom, now),
      or(isNull(commissionRules.effectiveTo), gte(commissionRules.effectiveTo, now))
    ];
    
    if (filters?.oemId) conditions.push(eq(commissionRules.oemId, filters.oemId));
    if (filters?.dealershipId) conditions.push(eq(commissionRules.dealershipId, filters.dealershipId));
    if (filters?.showroomId) conditions.push(eq(commissionRules.showroomId, filters.showroomId));
    if (filters?.salesPersonId) conditions.push(eq(commissionRules.salesPersonId, filters.salesPersonId));

    return await query.where(and(...conditions)).orderBy(desc(commissionRules.createdAt));
  }

  async createCommissionRule(insertRule: InsertCommissionRule): Promise<CommissionRule> {
    const [rule] = await db
      .insert(commissionRules)
      .values(insertRule)
      .returning();
    return rule;
  }

  async updateCommissionRule(id: string, updates: Partial<InsertCommissionRule>): Promise<CommissionRule | undefined> {
    const [rule] = await db
      .update(commissionRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(commissionRules.id, id))
      .returning();
    return rule || undefined;
  }

  async deleteCommissionRule(id: string): Promise<boolean> {
    try {
      const result = await db.delete(commissionRules)
        .where(eq(commissionRules.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting commission rule:', error);
      throw new Error('Failed to delete commission rule');
    }
  }

  // Get commission rules with organizational context (OEM/Dealership/Showroom names)
  async getCommissionRulesWithContext(filters?: { 
    oemId?: string; 
    dealershipId?: string; 
    showroomId?: string;
    salesPersonId?: string;
  }): Promise<{
    id: string;
    oemId: string | null;
    dealershipId: string | null;
    showroomId: string | null;
    salesPersonId: string | null;
    serviceId: string | null;
    serviceCategoryId: string | null;
    type: "PERCENT" | "AMOUNT";
    valueNumeric: string;
    capAmount: string | null;
    floorAmount: string | null;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    oem: any;
    dealership: any;
    showroom: any;
    salesPerson: any;
    service: any;
    serviceCategory: any;
  }[]> {
    let query = db
      .select({
        id: commissionRules.id,
        oemId: commissionRules.oemId,
        dealershipId: commissionRules.dealershipId,
        showroomId: commissionRules.showroomId,
        salesPersonId: commissionRules.salesPersonId,
        serviceId: commissionRules.serviceId,
        serviceCategoryId: commissionRules.serviceCategoryId,
        type: commissionRules.type,
        valueNumeric: commissionRules.valueNumeric,
        capAmount: commissionRules.capAmount,
        floorAmount: commissionRules.floorAmount,
        effectiveFrom: commissionRules.effectiveFrom,
        effectiveTo: commissionRules.effectiveTo,
        status: commissionRules.status,
        createdAt: commissionRules.createdAt,
        updatedAt: commissionRules.updatedAt,
        // Organizational context
        oem: oems,
        dealership: dealerships,
        showroom: showrooms,
        salesPerson: salesPersons,
        service: services,
        serviceCategory: serviceCategories
      })
      .from(commissionRules)
      .leftJoin(oems, eq(commissionRules.oemId, oems.id))
      .leftJoin(dealerships, eq(commissionRules.dealershipId, dealerships.id))
      .leftJoin(showrooms, eq(commissionRules.showroomId, showrooms.id))
      .leftJoin(salesPersons, eq(commissionRules.salesPersonId, salesPersons.id))
      .leftJoin(services, eq(commissionRules.serviceId, services.id))
      .leftJoin(serviceCategories, eq(commissionRules.serviceCategoryId, serviceCategories.id));
    
    const now = new Date();
    const conditions = [
      eq(commissionRules.status, "ACTIVE"),
      lte(commissionRules.effectiveFrom, now),
      or(isNull(commissionRules.effectiveTo), gte(commissionRules.effectiveTo, now))
    ];
    
    if (filters?.oemId) conditions.push(eq(commissionRules.oemId, filters.oemId));
    if (filters?.dealershipId) conditions.push(eq(commissionRules.dealershipId, filters.dealershipId));
    if (filters?.showroomId) conditions.push(eq(commissionRules.showroomId, filters.showroomId));
    if (filters?.salesPersonId) conditions.push(eq(commissionRules.salesPersonId, filters.salesPersonId));

    return await query.where(and(...conditions)).orderBy(desc(commissionRules.createdAt));
  }

  // Commission resolution with hierarchical inheritance
  async resolveCommissionRule(
    oemId: string, 
    dealershipId: string, 
    showroomId: string, 
    salesPersonId?: string, 
    serviceId?: string,
    serviceCategoryId?: string
  ): Promise<any | null> {
    // Define resolution priority order (most specific to least specific)
    const searchCriteria = [
      // 1. Showroom + Sales Person + Specific Service
      { showroomId, salesPersonId, serviceId },
      // 2. Showroom + Sales Person + Service Category  
      { showroomId, salesPersonId, serviceCategoryId },
      // 3. Showroom + Sales Person (All Services)
      { showroomId, salesPersonId },
      // 4. Showroom + Specific Service
      { showroomId, serviceId },
      // 5. Showroom + Service Category
      { showroomId, serviceCategoryId },
      // 6. Showroom (All Services, All Sales Persons)
      { showroomId },
      
      // 7. Dealership + Sales Person + Specific Service
      { dealershipId, salesPersonId, serviceId },
      // 8. Dealership + Sales Person + Service Category
      { dealershipId, salesPersonId, serviceCategoryId },
      // 9. Dealership + Sales Person (All Services)
      { dealershipId, salesPersonId },
      // 10. Dealership + Specific Service
      { dealershipId, serviceId },
      // 11. Dealership + Service Category
      { dealershipId, serviceCategoryId },
      // 12. Dealership (All Services, All Sales Persons)
      { dealershipId },
      
      // 13. OEM + Sales Person + Specific Service
      { oemId, salesPersonId, serviceId },
      // 14. OEM + Sales Person + Service Category
      { oemId, salesPersonId, serviceCategoryId },
      // 15. OEM + Sales Person (All Services)
      { oemId, salesPersonId },
      // 16. OEM + Specific Service
      { oemId, serviceId },
      // 17. OEM + Service Category
      { oemId, serviceCategoryId },
      // 18. OEM (All Services, All Sales Persons)
      { oemId }
    ];

    // Try each criteria in order until we find a matching rule
    for (const criteria of searchCriteria) {
      // Skip criteria with undefined required values
      if ((criteria.salesPersonId && !salesPersonId) || 
          (criteria.serviceId && !serviceId) ||
          (criteria.serviceCategoryId && !serviceCategoryId)) {
        continue;
      }

      const conditions = [eq(commissionRules.status, "ACTIVE")];
      
      // Add organizational level condition
      if (criteria.oemId) conditions.push(eq(commissionRules.oemId, criteria.oemId));
      if (criteria.dealershipId) conditions.push(eq(commissionRules.dealershipId, criteria.dealershipId));
      if (criteria.showroomId) conditions.push(eq(commissionRules.showroomId, criteria.showroomId));
      
      // Add sales person condition (null = applies to all)
      if (criteria.salesPersonId) {
        conditions.push(eq(commissionRules.salesPersonId, criteria.salesPersonId));
      } else {
        conditions.push(isNull(commissionRules.salesPersonId));
      }
      
      // Add service condition (null = applies to all services)
      if (criteria.serviceId) {
        conditions.push(eq(commissionRules.serviceId, criteria.serviceId));
        conditions.push(isNull(commissionRules.serviceCategoryId));
      } else if (criteria.serviceCategoryId) {
        conditions.push(eq(commissionRules.serviceCategoryId, criteria.serviceCategoryId));
        conditions.push(isNull(commissionRules.serviceId));
      } else {
        conditions.push(isNull(commissionRules.serviceId));
        conditions.push(isNull(commissionRules.serviceCategoryId));
      }

      // Check effective date
      const now = new Date();
      conditions.push(lte(commissionRules.effectiveFrom, now));
      conditions.push(or(isNull(commissionRules.effectiveTo), gte(commissionRules.effectiveTo, now)));

      const [rule] = await db
        .select()
        .from(commissionRules)
        .where(and(...conditions))
        .limit(1);

      if (rule) {
        return {
          ...rule,
          resolutionPath: this.getResolutionPath(criteria),
          resolutionLevel: criteria.oemId ? 'OEM' : criteria.dealershipId ? 'DEALERSHIP' : 'SHOWROOM'
        };
      }
    }

    return null; // No applicable commission rule found
  }

  private getResolutionPath(criteria: any): string {
    const level = criteria.oemId ? 'OEM' : criteria.dealershipId ? 'DEALERSHIP' : 'SHOWROOM';
    const salesperson = criteria.salesPersonId ? '+SALESPERSON' : '';
    const service = criteria.serviceId ? '+SERVICE' : criteria.serviceCategoryId ? '+CATEGORY' : '';
    
    return `${level}${salesperson}${service}`;
  }

  // Calculate commission amount based on resolved rule
  async calculateCommission(
    grossAmount: number,
    oemId: string,
    dealershipId: string, 
    showroomId: string,
    salesPersonId?: string,
    serviceId?: string,
    serviceCategoryId?: string
  ): Promise<{
    rule: any | null;
    calculatedAmount: number;
    resolutionPath: string;
    appliedCap: boolean;
    appliedFloor: boolean;
  }> {
    const rule = await this.resolveCommissionRule(
      oemId, dealershipId, showroomId, salesPersonId, serviceId, serviceCategoryId
    );

    if (!rule) {
      return {
        rule: null,
        calculatedAmount: 0,
        resolutionPath: 'NO_RULE_FOUND',
        appliedCap: false,
        appliedFloor: false
      };
    }

    let calculatedAmount = 0;
    let appliedCap = false;
    let appliedFloor = false;

    // Calculate base commission
    if (rule.type === 'PERCENT') {
      calculatedAmount = grossAmount * (Number(rule.valueNumeric) / 100);
    } else {
      calculatedAmount = Number(rule.valueNumeric);
    }

    // Apply floor (minimum)
    if (rule.floorAmount && calculatedAmount < Number(rule.floorAmount)) {
      calculatedAmount = Number(rule.floorAmount);
      appliedFloor = true;
    }

    // Apply cap (maximum)
    if (rule.capAmount && calculatedAmount > Number(rule.capAmount)) {
      calculatedAmount = Number(rule.capAmount);
      appliedCap = true;
    }

    return {
      rule,
      calculatedAmount,
      resolutionPath: rule.resolutionPath,
      appliedCap,
      appliedFloor
    };
  }

  async getPayouts(filters?: { status?: string; partnerId?: string; oemId?: string; dealershipId?: string; showroomId?: string; jobCardId?: string }): Promise<any[]> {
    let query = db.select({
      id: payouts.id,
      jobCardId: payouts.jobCardId,
      partnerId: payouts.partnerId,
      grossAmount: payouts.grossAmount,
      netAmount: payouts.netAmount,
      status: payouts.status,
      paidAt: payouts.paidAt,
      paymentReference: payouts.paymentReference,
      settledBy: payouts.settledBy,
      settledAt: payouts.settledAt,
      createdAt: payouts.createdAt,
      // Partner information
      partnerName: partners.displayName,
      partnerType: partners.type,
      // Job card and work order information
      workOrderId: jobCards.workOrderId,
      jobCardStatus: jobCards.status,
      customerName: workOrders.customerName,
      workOrderOemId: workOrders.oemId,
      workOrderDealershipId: workOrders.dealershipId,
      workOrderShowroomId: workOrders.showroomId,
    })
    .from(payouts)
    .leftJoin(partners, eq(payouts.partnerId, partners.id))
    .leftJoin(jobCards, eq(payouts.jobCardId, jobCards.id))
    .leftJoin(workOrders, eq(jobCards.workOrderId, workOrders.id));

    const conditions = [];
    if (filters?.status) conditions.push(eq(payouts.status, filters.status));
    if (filters?.partnerId) conditions.push(eq(payouts.partnerId, filters.partnerId));
    if (filters?.jobCardId) conditions.push(eq(payouts.jobCardId, filters.jobCardId));
    
    // Add tenant scoping conditions
    if (filters?.oemId) conditions.push(eq(workOrders.oemId, filters.oemId));
    if (filters?.dealershipId) conditions.push(eq(workOrders.dealershipId, filters.dealershipId));
    if (filters?.showroomId) conditions.push(eq(workOrders.showroomId, filters.showroomId));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(payouts.createdAt));
  }

  async getCommissions(filters?: { status?: string; salesPersonId?: string; showroomId?: string; oemId?: string; dealershipId?: string; workOrderId?: string }): Promise<{ commissions: any[] }> {
    let query = db.select({
      id: commissions.id,
      workOrderId: commissions.workOrderId,
      showroomId: commissions.showroomId,
      salesPersonId: commissions.salesPersonId,
      basis: commissions.basis,
      value: commissions.value,
      computedAmount: commissions.computedAmount,
      status: commissions.status,
      paidAt: commissions.paidAt,
      paymentReference: commissions.paymentReference,
      settledBy: commissions.settledBy,
      settledAt: commissions.settledAt,
      createdAt: commissions.createdAt,
      // Sales person information
      salesPersonName: salesPersons.name,
      // Showroom information
      showroomName: showrooms.name,
      // Work order information (primary link for sales commissions)
      customerName: workOrders.customerName,
      workOrderStatus: workOrders.status,
      // Work order information for tenant scoping
      workOrderOemId: workOrders.oemId,
      workOrderDealershipId: workOrders.dealershipId,
      workOrderShowroomId: workOrders.showroomId,
    })
    .from(commissions)
    .leftJoin(salesPersons, eq(commissions.salesPersonId, salesPersons.id))
    .leftJoin(showrooms, eq(commissions.showroomId, showrooms.id))
    .leftJoin(workOrders, eq(commissions.workOrderId, workOrders.id));

    const conditions = [];
    if (filters?.status) conditions.push(eq(commissions.status, filters.status));
    if (filters?.salesPersonId) conditions.push(eq(commissions.salesPersonId, filters.salesPersonId));
    if (filters?.showroomId) conditions.push(eq(commissions.showroomId, filters.showroomId));
    if (filters?.workOrderId) conditions.push(eq(commissions.workOrderId, filters.workOrderId));
    
    // Add tenant scoping conditions
    if (filters?.oemId) conditions.push(eq(workOrders.oemId, filters.oemId));
    if (filters?.dealershipId) conditions.push(eq(workOrders.dealershipId, filters.dealershipId));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query.orderBy(desc(commissions.createdAt));
    return { commissions: results };
  }

  async createPayout(payout: any): Promise<any> {
    const [result] = await db.insert(payouts).values(payout).returning();
    return result;
  }

  async updatePayout(id: string, updates: any): Promise<any> {
    const [result] = await db.update(payouts).set(updates).where(eq(payouts.id, id)).returning();
    return result;
  }

  async createCommission(commission: any): Promise<any> {
    const [result] = await db.insert(commissions).values(commission).returning();
    return result;
  }

  async updateCommission(id: string, updates: any): Promise<any> {
    const [result] = await db.update(commissions).set(updates).where(eq(commissions.id, id)).returning();
    return result;
  }

  async settlePayout(id: string, settlement: { paymentReference: string; settledAt: Date; settledBy: string }): Promise<boolean> {
    try {
      const [updated] = await db
        .update(payouts)
        .set({
          status: 'PAID',
          paidAt: settlement.settledAt,
          paymentReference: settlement.paymentReference,
          settledBy: settlement.settledBy,
          settledAt: settlement.settledAt,
        })
        .where(eq(payouts.id, id))
        .returning();
      
      return !!updated;
    } catch (error) {
      console.error('Error settling payout:', error);
      throw new Error('Failed to settle payout');
    }
  }

  async getPayout(id: string): Promise<any | undefined> {
    try {
      const [payout] = await db.select()
        .from(payouts)
        .where(eq(payouts.id, id));
      
      if (!payout) {
        return undefined;
      }
      
      // Get work order information for tenant scoping
      let workOrderInfo = null;
      try {
        if (payout.jobCardId) {
          const [jobCard] = await db.select()
            .from(jobCards)
            .where(eq(jobCards.id, payout.jobCardId));
          
          if (jobCard && jobCard.workOrderId) {
            const [workOrder] = await db.select({
              oemId: workOrders.oemId,
              dealershipId: workOrders.dealershipId,
              showroomId: workOrders.showroomId
            })
            .from(workOrders)
            .where(eq(workOrders.id, jobCard.workOrderId));
            
            workOrderInfo = workOrder || {};
          }
        }
      } catch (joinError) {
        console.warn('Error fetching work order info:', joinError);
        workOrderInfo = {};
      }
      
      return {
        ...payout,
        workOrderOemId: workOrderInfo?.oemId || null,
        workOrderDealershipId: workOrderInfo?.dealershipId || null,
        workOrderShowroomId: workOrderInfo?.showroomId || null
      };
    } catch (error) {
      console.error('Error in getPayout:', error);
      return undefined;
    }
  }

  async getCommission(id: string): Promise<any | undefined> {
    const [commission] = await db.select({
      id: commissions.id,
      jobCardId: commissions.jobCardId,
      showroomId: commissions.showroomId,
      salesPersonId: commissions.salesPersonId,
      basis: commissions.basis,
      value: commissions.value,
      computedAmount: commissions.computedAmount,
      status: commissions.status,
      paidAt: commissions.paidAt,
      paymentReference: commissions.paymentReference,
      settledBy: commissions.settledBy,
      settledAt: commissions.settledAt,
      createdAt: commissions.createdAt,
      // Work order information for tenant scoping
      workOrderOemId: workOrders.oemId,
      workOrderDealershipId: workOrders.dealershipId,
      workOrderShowroomId: workOrders.showroomId,
    })
    .from(commissions)
    .leftJoin(jobCards, eq(commissions.jobCardId, jobCards.id))
    .leftJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
    .where(eq(commissions.id, id));
    
    return commission || undefined;
  }

  canUserAccessPayout(user: User, payout: any): boolean {
    // SUPER_ADMIN can access all payouts
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }
    
    // Check OEM level access
    if (user.oemId && payout.workOrderOemId !== user.oemId) {
      return false;
    }
    
    // Check dealership level access
    if (user.dealershipId && payout.workOrderDealershipId !== user.dealershipId) {
      return false;
    }
    
    // Check showroom level access
    if (user.showroomId && payout.workOrderShowroomId !== user.showroomId) {
      return false;
    }
    
    return true;
  }

  canUserAccessCommission(user: User, commission: any): boolean {
    // SUPER_ADMIN can access all commissions
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }
    
    // Check OEM level access
    if (user.oemId && commission.workOrderOemId !== user.oemId) {
      return false;
    }
    
    // Check dealership level access
    if (user.dealershipId && commission.workOrderDealershipId !== user.dealershipId) {
      return false;
    }
    
    // Check showroom level access
    if (user.showroomId && commission.workOrderShowroomId !== user.showroomId) {
      return false;
    }
    
    return true;
  }

  async settleCommission(id: string, settlement: { paymentReference: string; settledAt: Date; settledBy: string }): Promise<boolean> {
    try {
      const [updated] = await db
        .update(commissions)
        .set({
          status: 'PAID',
          paidAt: settlement.settledAt,
          paymentReference: settlement.paymentReference,
          settledBy: settlement.settledBy,
          settledAt: settlement.settledAt,
        })
        .where(eq(commissions.id, id))
        .returning();
      
      return !!updated;
    } catch (error) {
      console.error('Error settling commission:', error);
      throw new Error('Failed to settle commission');
    }
  }

  async resolvePricingRule(partnerId: string, scopeType: string, scopeId: string, vehicleModelId?: string, serviceId?: string): Promise<PricingRule | null> {
    // Build conditions dynamically based on what's provided
    const conditions = [eq(pricingRules.status, 'ACTIVE')];
    
    if (vehicleModelId) conditions.push(eq(pricingRules.vehicleModelId, vehicleModelId));
    if (serviceId) conditions.push(eq(pricingRules.serviceId, serviceId));
    
    // Add scope-specific conditions
    if (scopeType === 'SHOWROOM' && scopeId) {
      // For showroom scope, match either partnerId or specific showroom rules
      conditions.push(
        or(
          eq(pricingRules.partnerId, partnerId),
          and(
            eq(pricingRules.scope, 'SHOWROOM'),
            eq(pricingRules.scopeId, scopeId)
          )
        )
      );
    } else if (scopeType === 'DEALERSHIP' && scopeId) {
      // For dealership scope, match either partnerId or specific dealership rules  
      conditions.push(
        or(
          eq(pricingRules.partnerId, partnerId),
          and(
            eq(pricingRules.scope, 'DEALERSHIP'),
            eq(pricingRules.scopeId, scopeId)
          )
        )
      );
    } else {
      // Fallback to partner-specific rules
      conditions.push(eq(pricingRules.partnerId, partnerId));
    }

    const rules = await db.select().from(pricingRules)
      .where(and(...conditions))
      .orderBy(pricingRules.priceAmount); // Order by price for consistency
    
    return rules[0] || null;
  }

  // NEW SIMPLIFIED PAYOUT PRICING: Service Category based (vehicle optional)
  async resolvePayoutPricing(
    partnerId: string,
    serviceCategoryId: string,
    vehicleModelId: string
  ): Promise<{ amount: string; ruleId: string } | null> {
    try {
      console.log("🎯 DETAILER PAYOUT PRICING:", { partnerId, serviceCategoryId, vehicleModelId });
      
      // Priority 1: Partner + Service Category + Vehicle Model (most specific)
      if (vehicleModelId) {
        const exactMatch = await db.select()
          .from(pricingRules)
          .where(
            and(
              eq(pricingRules.pricingType, "DETAILER_PRICING"),
              or(
                eq(pricingRules.partnerId, partnerId),
                eq(pricingRules.detailerId, partnerId) // Also check detailerId since detailers are partners
              ),
              eq(pricingRules.serviceCategoryId, serviceCategoryId),
              eq(pricingRules.vehicleModelId, vehicleModelId),
              eq(pricingRules.status, "ACTIVE")
            )
          )
          .limit(1);
        
        if (exactMatch.length > 0) {
          console.log("✅ Found exact match (Partner + Category + Vehicle):", exactMatch[0]);
          return {
            amount: exactMatch[0].priceAmount,
            ruleId: exactMatch[0].id
          };
        }
      }

      // Priority 2: Partner + Service Category (NO vehicle requirement - KEY for detailer payout)
      const partnerCategoryMatch = await db.select()
        .from(pricingRules)
        .where(
          and(
            eq(pricingRules.pricingType, "DETAILER_PRICING"),
            or(
              eq(pricingRules.partnerId, partnerId),
              eq(pricingRules.detailerId, partnerId) // Also check detailerId since detailers are partners
            ),
            eq(pricingRules.serviceCategoryId, serviceCategoryId),
            isNull(pricingRules.vehicleModelId), // Rule without vehicle restriction
            eq(pricingRules.status, "ACTIVE")
          )
        )
        .limit(1);
      
      if (partnerCategoryMatch.length > 0) {
        console.log("✅ Found partner + category match (any vehicle):", partnerCategoryMatch[0]);
        return {
          amount: partnerCategoryMatch[0].priceAmount,
          ruleId: partnerCategoryMatch[0].id
        };
      }

      // Priority 3: Service Category only (global rule for any partner, any vehicle)
      const globalCategoryMatch = await db.select()
        .from(pricingRules)
        .where(
          and(
            eq(pricingRules.pricingType, "DETAILER_PRICING"),
            eq(pricingRules.serviceCategoryId, serviceCategoryId),
            isNull(pricingRules.vehicleModelId),
            isNull(pricingRules.partnerId),
            isNull(pricingRules.detailerId), // Both must be null for global rule
            eq(pricingRules.status, "ACTIVE")
          )
        )
        .limit(1);
      
      if (globalCategoryMatch.length > 0) {
        console.log("✅ Found global category match:", globalCategoryMatch[0]);
        return {
          amount: globalCategoryMatch[0].priceAmount,
          ruleId: globalCategoryMatch[0].id
        };
      }

      console.log("❌ No pricing rule found for detailer payout");
      return null;
    } catch (error) {
      console.error("Error resolving payout pricing:", error);
      return null;
    }
  }

  // LEGACY: Complex pricing logic (keeping for backward compatibility)
  async resolveDetailerPricing(detailerId: string, serviceId: string, serviceCategoryId: string | null, vehicleModelId: string, dealershipId?: string, showroomId?: string): Promise<{ amount: string; ruleId: string; context: string } | null> {
    try {
      // Base conditions for all queries
      const now = new Date();
      const baseConditions = [
        eq(pricingRules.status, 'ACTIVE'),
        eq(pricingRules.pricingType, 'DETAILER_PRICING'),
        // Allow both detailer-specific rules and global rules (detailerId = NULL)
        or(
          eq(pricingRules.detailerId, detailerId),
          isNull(pricingRules.detailerId)
        ),
        lte(pricingRules.effectiveFrom, now),
        or(
          isNull(pricingRules.effectiveTo),
          gte(pricingRules.effectiveTo, now)
        )
      ];

      // Location precedence: Showroom > Dealership > Global
      const locationContexts = [];
      if (showroomId) {
        locationContexts.push({ scope: 'SHOWROOM', scopeId: showroomId, context: 'showroom' });
      }
      if (dealershipId) {
        locationContexts.push({ scope: 'DEALERSHIP', scopeId: dealershipId, context: 'dealership' });
      }
      locationContexts.push({ scope: null, scopeId: null, context: 'global' }); // Global rules

      // Service precedence: Exact service > Service category
      const servicePrecedence = [];
      if (serviceId) {
        servicePrecedence.push({ type: 'service', condition: eq(pricingRules.serviceId, serviceId) });
      }
      if (serviceCategoryId) {
        servicePrecedence.push({ type: 'category', condition: eq(pricingRules.serviceCategoryId, serviceCategoryId) });
      }

      // Vehicle precedence: Exact vehicle model > No vehicle constraint
      const vehiclePrecedence = [
        { type: 'exact', condition: eq(pricingRules.vehicleModelId, vehicleModelId) },
        { type: 'generic', condition: isNull(pricingRules.vehicleModelId) }
      ];

      // Search with full precedence matrix
      for (const location of locationContexts) {
        for (const service of servicePrecedence) {
          for (const vehicle of vehiclePrecedence) {
            const conditions = [...baseConditions, service.condition, vehicle.condition];
            
            // Add location context if specified
            if (location.scope && location.scopeId) {
              conditions.push(eq(pricingRules.scope, location.scope));
              conditions.push(eq(pricingRules.scopeId, location.scopeId));
            } else if (location.scope === null) {
              // Global rules have no scope
              conditions.push(isNull(pricingRules.scope));
              conditions.push(isNull(pricingRules.scopeId));
            }

            const rules = await db.select().from(pricingRules)
              .where(and(...conditions))
              .orderBy(desc(pricingRules.effectiveFrom))
              .limit(1);
            
            if (rules.length > 0) {
              return { 
                amount: rules[0].priceAmount, // Keep as string to avoid floating point issues
                ruleId: rules[0].id,
                context: `${location.context}-${service.type}-${vehicle.type}`
              };
            }
          }
        }
      }

      return null; // No pricing rule found
    } catch (error) {
      console.error('Error resolving detailer pricing:', error);
      return null;
    }
  }

  async recalculatePayoutWithPricing(jobCardId: string): Promise<{ success: boolean; message: string; amount?: string }> {
    try {
      // Get job card and work order details
      const jobCard = await db
        .select({
          id: jobCards.id,
          partnerId: jobCards.partnerId,
          workOrderId: jobCards.workOrderId,
          status: jobCards.status
        })
        .from(jobCards)
        .where(eq(jobCards.id, jobCardId))
        .limit(1);

      if (!jobCard[0]) {
        return { success: false, message: 'Job card not found' };
      }

      const workOrder = await db
        .select({
          id: workOrders.id,
          serviceId: workOrders.serviceId,
          vehicleModelId: workOrders.vehicleModelId,
          dealershipId: workOrders.dealershipId,
          showroomId: workOrders.showroomId
        })
        .from(workOrders)
        .where(eq(workOrders.id, jobCard[0].workOrderId))
        .limit(1);

      if (!workOrder[0]) {
        return { success: false, message: 'Work order not found' };
      }

      // Get service details for service category
      const service = await db
        .select({
          id: services.id,
          serviceCategoryId: services.serviceCategoryId
        })
        .from(services)
        .where(eq(services.id, workOrder[0].serviceId))
        .limit(1);

      // Resolve pricing using the new function
      const pricingResult = await this.resolveDetailerPricing(
        jobCard[0].partnerId,
        workOrder[0].serviceId,
        service[0]?.serviceCategoryId || null,
        workOrder[0].vehicleModelId,
        workOrder[0].dealershipId,
        workOrder[0].showroomId
      );

      if (!pricingResult) {
        // When no pricing rule found, create payout with pending_review status
        const existingPayout = await db
          .select({ id: payouts.id })
          .from(payouts)
          .where(eq(payouts.jobCardId, jobCardId))
          .limit(1);

        if (existingPayout[0]) {
          // Update existing payout
          await db
            .update(payouts)
            .set({
              grossAmount: '0.00',
              netAmount: '0.00',
              status: 'pending_review',
              updatedAt: new Date()
            })
            .where(eq(payouts.id, existingPayout[0].id));
        } else {
          // Create new payout
          await db
            .insert(payouts)
            .values({
              jobCardId: jobCardId,
              partnerId: jobCard[0].partnerId,
              grossAmount: '0.00',
              netAmount: '0.00',
              status: 'pending_review',
              createdAt: new Date()
            });
        }

        return { success: true, message: 'No pricing rule found - payout marked as pending_review', amount: '0.00' };
      }

      // Update or create payout with resolved pricing
      const existingPayout = await db
        .select({ id: payouts.id })
        .from(payouts)
        .where(eq(payouts.jobCardId, jobCardId))
        .limit(1);

      if (existingPayout[0]) {
        // Update existing payout
        await db
          .update(payouts)
          .set({
            grossAmount: pricingResult.amount, // Already a string, no conversion needed
            netAmount: pricingResult.amount,
            status: 'PENDING',
            updatedAt: new Date()
          })
          .where(eq(payouts.id, existingPayout[0].id));
      } else {
        // Create new payout
        await db
          .insert(payouts)
          .values({
            jobCardId: jobCardId,
            partnerId: jobCard[0].partnerId,
            grossAmount: pricingResult.amount,
            netAmount: pricingResult.amount,
            status: 'PENDING',
            createdAt: new Date()
          });
      }

      return { 
        success: true, 
        message: `Payout recalculated using pricing rule ${pricingResult.ruleId} (${pricingResult.context})`, 
        amount: pricingResult.amount // Keep as string to prevent precision loss
      };

    } catch (error) {
      console.error('Error recalculating payout:', error);
      return { success: false, message: 'Error recalculating payout' };
    }
  }

  async createNotification(notification: any): Promise<any> {
    // For now, just log the notification (can be enhanced to store in DB)
    console.log('Notification:', notification);
    return { id: 'notification-' + Date.now(), ...notification };
  }

  // Vehicle Model methods
  async getVehicleModels(filters?: { oemId?: string }): Promise<VehicleModel[]> {
    let query = db.select().from(vehicleModels);
    
    if (filters?.oemId) {
      query = query.where(and(eq(vehicleModels.active, true), eq(vehicleModels.oemId, filters.oemId)));
    } else {
      query = query.where(eq(vehicleModels.active, true));
    }

    return await query.orderBy(vehicleModels.modelName);
  }

  async getVehicleModel(id: string): Promise<VehicleModel | undefined> {
    const [model] = await db.select().from(vehicleModels).where(eq(vehicleModels.id, id));
    return model || undefined;
  }

  async createVehicleModel(insertModel: InsertVehicleModel): Promise<VehicleModel> {
    const [model] = await db
      .insert(vehicleModels)
      .values(insertModel)
      .returning();
    return model;
  }

  async updateVehicleModel(id: string, updates: Partial<InsertVehicleModel>): Promise<VehicleModel | undefined> {
    const [model] = await db
      .update(vehicleModels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(vehicleModels.id, id))
      .returning();
    return model || undefined;
  }

  async deleteVehicleModel(id: string): Promise<boolean> {
    const [model] = await db
      .update(vehicleModels)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(vehicleModels.id, id))
      .returning();
    return !!model;
  }

  // Vehicle Variant methods
  async getVehicleVariants(filters?: { modelId?: string }): Promise<VehicleVariant[]> {
    let query = db.select().from(vehicleVariants);
    
    if (filters?.modelId) {
      query = query.where(and(eq(vehicleVariants.active, true), eq(vehicleVariants.modelId, filters.modelId)));
    } else {
      query = query.where(eq(vehicleVariants.active, true));
    }

    return await query.orderBy(vehicleVariants.variantName);
  }

  async getVehicleVariant(id: string): Promise<VehicleVariant | undefined> {
    const [variant] = await db.select().from(vehicleVariants).where(eq(vehicleVariants.id, id));
    return variant || undefined;
  }

  async createVehicleVariant(insertVariant: InsertVehicleVariant): Promise<VehicleVariant> {
    const [variant] = await db
      .insert(vehicleVariants)
      .values(insertVariant)
      .returning();
    return variant;
  }

  async updateVehicleVariant(id: string, updates: Partial<InsertVehicleVariant>): Promise<VehicleVariant | undefined> {
    const [variant] = await db
      .update(vehicleVariants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(vehicleVariants.id, id))
      .returning();
    return variant || undefined;
  }

  async deleteVehicleVariant(id: string): Promise<boolean> {
    const [variant] = await db
      .update(vehicleVariants)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(vehicleVariants.id, id))
      .returning();
    return !!variant;
  }

  async getPartnerDashboardMetrics(partnerId: string): Promise<{
    activeWorkOrders: number;
    pendingApprovals: number;
    thisMonthRevenue: number;
    avgTAT: number;
    completedJobs: number;
    inProgressJobs: number;
    pendingJobs: number;
    thisMonthEarnings: number;
  }> {
    // Get counts for different job card statuses
    const [pendingJobsResult] = await db
      .select({ count: count() })
      .from(jobCards)
      .where(and(
        eq(jobCards.partnerId, partnerId),
        or(
          eq(jobCards.status, 'AWAITING_ACK'),
          eq(jobCards.status, 'ACKNOWLEDGED'),
          eq(jobCards.status, 'SCHEDULED')
        )
      ));

    const [inProgressJobsResult] = await db
      .select({ count: count() })
      .from(jobCards)
      .where(and(
        eq(jobCards.partnerId, partnerId),
        eq(jobCards.status, 'IN_PROGRESS')
      ));

    const [completedJobsResult] = await db
      .select({ count: count() })
      .from(jobCards)
      .where(and(
        eq(jobCards.partnerId, partnerId),
        or(
          eq(jobCards.status, 'APPROVED'),
          eq(jobCards.status, 'CLOSED')
        )
      ));

    // Calculate average TAT for completed jobs
    const completedJobsWithTAT = await db
      .select({
        startedAt: jobCards.startedAt,
        completedAt: jobCards.completedAt
      })
      .from(jobCards)
      .where(and(
        eq(jobCards.partnerId, partnerId),
        eq(jobCards.status, 'APPROVED'),
        isNotNull(jobCards.startedAt),
        isNotNull(jobCards.completedAt),
        sql`job_cards.completed_at >= CURRENT_DATE - INTERVAL '3 months'`
      ));

    let avgTAT = 0;
    if (completedJobsWithTAT.length > 0) {
      const totalTATHours = completedJobsWithTAT.reduce((sum, job) => {
        if (job.startedAt && job.completedAt) {
          const diffInMs = job.completedAt.getTime() - job.startedAt.getTime();
          const diffInHours = diffInMs / (1000 * 60 * 60);
          return sum + diffInHours;
        }
        return sum;
      }, 0);
      avgTAT = Math.round((totalTATHours / completedJobsWithTAT.length / 24) * 10) / 10; // Convert to days
    }

    // Get this month's earnings from payouts using SQL SUM
    const [thisMonthEarnings] = await db
      .select({
        total: sql<number>`COALESCE(SUM(payouts.net_amount), 0)`
      })
      .from(payouts)
      .innerJoin(jobCards, eq(payouts.jobCardId, jobCards.id))
      .where(and(
        eq(jobCards.partnerId, partnerId),
        sql`EXTRACT(MONTH FROM payouts.created_at) = EXTRACT(MONTH FROM CURRENT_DATE)`,
        sql`EXTRACT(YEAR FROM payouts.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`
      ));

    return {
      activeWorkOrders: (pendingJobsResult?.count || 0) + (inProgressJobsResult?.count || 0),
      pendingApprovals: pendingJobsResult?.count || 0,
      thisMonthRevenue: Number(thisMonthEarnings?.total || 0),
      avgTAT: avgTAT,
      completedJobs: completedJobsResult?.count || 0,
      inProgressJobs: inProgressJobsResult?.count || 0,
      pendingJobs: pendingJobsResult?.count || 0,
      thisMonthEarnings: Number(thisMonthEarnings?.total || 0)
    };
  }

  async getPartnerStaffDashboardMetrics(partnerId: string, staffId: string): Promise<{
    activeWorkOrders: number;
    pendingApprovals: number;
    thisMonthRevenue: number;
    avgTAT: number;
    completedJobs: number;
    inProgressJobs: number;
    pendingJobs: number;
    thisMonthEarnings: number;
  }> {
    // Get counts for different job card statuses assigned to this staff member
    const [pendingJobsResult] = await db
      .select({ count: count() })
      .from(jobCards)
      .where(and(
        eq(jobCards.partnerId, partnerId),
        eq(jobCards.assignedInstallerId, staffId),
        or(
          eq(jobCards.status, 'AWAITING_ACK'),
          eq(jobCards.status, 'ACKNOWLEDGED'),
          eq(jobCards.status, 'SCHEDULED'),
          eq(jobCards.status, 'PENDING_APPROVAL')
        )
      ));

    const [inProgressJobsResult] = await db
      .select({ count: count() })
      .from(jobCards)
      .where(and(
        eq(jobCards.partnerId, partnerId),
        eq(jobCards.assignedInstallerId, staffId),
        eq(jobCards.status, 'IN_PROGRESS')
      ));

    const [completedJobsResult] = await db
      .select({ count: count() })
      .from(jobCards)
      .where(and(
        eq(jobCards.partnerId, partnerId),
        eq(jobCards.assignedInstallerId, staffId),
        or(
          eq(jobCards.status, 'APPROVED'),
          eq(jobCards.status, 'CLOSED'),
          eq(jobCards.status, 'COMPLETED')
        )
      ));

    // Calculate average TAT for completed jobs by this staff member
    const completedJobsWithTAT = await db
      .select({
        startedAt: jobCards.startedAt,
        completedAt: jobCards.completedAt
      })
      .from(jobCards)
      .where(and(
        eq(jobCards.partnerId, partnerId),
        eq(jobCards.assignedInstallerId, staffId),
        or(
          eq(jobCards.status, 'APPROVED'),
          eq(jobCards.status, 'CLOSED'),
          eq(jobCards.status, 'COMPLETED')
        ),
        isNotNull(jobCards.startedAt),
        isNotNull(jobCards.completedAt),
        sql`job_cards.completed_at >= CURRENT_DATE - INTERVAL '3 months'`
      ));

    let avgTAT = 0;
    if (completedJobsWithTAT.length > 0) {
      const totalTATHours = completedJobsWithTAT.reduce((sum, job) => {
        if (job.startedAt && job.completedAt) {
          const diffInMs = job.completedAt.getTime() - job.startedAt.getTime();
          const diffInHours = diffInMs / (1000 * 60 * 60);
          return sum + diffInHours;
        }
        return sum;
      }, 0);
      avgTAT = Math.round((totalTATHours / completedJobsWithTAT.length / 24) * 10) / 10; // Convert to days
    }

    // For staff, we don't show earnings information - return 0 for earnings related fields
    return {
      activeWorkOrders: (pendingJobsResult?.count || 0) + (inProgressJobsResult?.count || 0),
      pendingApprovals: pendingJobsResult?.count || 0,
      thisMonthRevenue: 0, // Hidden for staff
      avgTAT: avgTAT,
      completedJobs: completedJobsResult?.count || 0,
      inProgressJobs: inProgressJobsResult?.count || 0,
      pendingJobs: pendingJobsResult?.count || 0,
      thisMonthEarnings: 0 // Hidden for staff
    };
  }

  async getDashboardMetrics(oemId: string, showroomId?: string, dealershipId?: string): Promise<{
    activeWorkOrders: number;
    pendingApprovals: number;
    thisMonthRevenue: number;
    avgTAT: number;
    completedJobs?: number;
    inProgressJobs?: number;
    pendingJobs?: number;
    thisMonthEarnings?: number;
  }> {
    const conditions = [eq(workOrders.oemId, oemId)];
    if (showroomId) {
      conditions.push(eq(workOrders.showroomId, showroomId));
    }
    if (dealershipId) {
      conditions.push(eq(workOrders.dealershipId, dealershipId));
    }

    // Active work orders
    const [activeWOResult] = await db
      .select({ count: count() })
      .from(workOrders)
      .where(and(...conditions, sql`status NOT IN ('CLOSED', 'CANCELLED')`));

    // Pending approvals
    const [pendingApprovalsResult] = await db
      .select({ count: count() })
      .from(workOrders)
      .where(and(...conditions, eq(workOrders.status, 'COMPLETED_PENDING_APPROVAL')));

    // This month revenue from completed jobs
    const [revenueResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(payouts.net_amount), 0)` })
      .from(payouts)
      .innerJoin(jobCards, eq(payouts.jobCardId, jobCards.id))
      .innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
      .where(and(
        ...conditions,
        sql`EXTRACT(MONTH FROM payouts.created_at) = EXTRACT(MONTH FROM CURRENT_DATE)`,
        sql`EXTRACT(YEAR FROM payouts.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`
      ));

    // Calculate average TAT from completed job cards
    const completedJobsWithTAT = await db
      .select({
        startedAt: jobCards.startedAt,
        completedAt: jobCards.completedAt
      })
      .from(jobCards)
      .innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
      .where(and(
        ...conditions,
        eq(jobCards.status, 'APPROVED'),
        isNotNull(jobCards.startedAt),
        isNotNull(jobCards.completedAt),
        sql`job_cards.completed_at >= CURRENT_DATE - INTERVAL '3 months'`
      ));

    let avgTAT = 0;
    if (completedJobsWithTAT.length > 0) {
      const totalTATHours = completedJobsWithTAT.reduce((sum, job) => {
        if (job.startedAt && job.completedAt) {
          const diffInMs = job.completedAt.getTime() - job.startedAt.getTime();
          const diffInHours = diffInMs / (1000 * 60 * 60);
          return sum + diffInHours;
        }
        return sum;
      }, 0);
      avgTAT = Math.round((totalTATHours / completedJobsWithTAT.length / 24) * 10) / 10; // Convert to days with 1 decimal
    }

    // Additional metrics for partner/detailer views
    const [completedJobsResult] = await db
      .select({ count: count() })
      .from(jobCards)
      .innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
      .where(and(
        ...conditions,
        eq(jobCards.status, 'APPROVED'),
        sql`EXTRACT(MONTH FROM job_cards.completed_at) = EXTRACT(MONTH FROM CURRENT_DATE)`,
        sql`EXTRACT(YEAR FROM job_cards.completed_at) = EXTRACT(YEAR FROM CURRENT_DATE)`
      ));

    const [inProgressJobsResult] = await db
      .select({ count: count() })
      .from(jobCards)
      .innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
      .where(and(
        ...conditions,
        eq(jobCards.status, 'IN_PROGRESS')
      ));

    const [pendingJobsResult] = await db
      .select({ count: count() })
      .from(jobCards)
      .innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
      .where(and(
        ...conditions,
        sql`job_cards.status IN ('AWAITING_ACK', 'ACKNOWLEDGED', 'SCHEDULED')`
      ));

    // Partner earnings (commission from completed jobs this month)
    const [earningsResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(payouts.net_amount), 0)` })
      .from(payouts)
      .innerJoin(jobCards, eq(payouts.jobCardId, jobCards.id))
      .innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
      .where(and(
        ...conditions,
        sql`EXTRACT(MONTH FROM payouts.created_at) = EXTRACT(MONTH FROM CURRENT_DATE)`,
        sql`EXTRACT(YEAR FROM payouts.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`
      ));

    return {
      activeWorkOrders: activeWOResult?.count || 0,
      pendingApprovals: pendingApprovalsResult?.count || 0,
      thisMonthRevenue: Number(revenueResult?.total || 0),
      avgTAT: avgTAT || 0,
      completedJobs: completedJobsResult?.count || 0,
      inProgressJobs: inProgressJobsResult?.count || 0,
      pendingJobs: pendingJobsResult?.count || 0,
      thisMonthEarnings: Number(earningsResult?.total || 0)
    };
  }

  async getOrdersRevenueTrend(oemId: string, showroomId?: string, dealershipId?: string): Promise<{
    month: string;
    orders: number;
    revenue: number;
  }[]> {
    const conditions = [eq(workOrders.oemId, oemId)];
    if (dealershipId) {
      conditions.push(eq(workOrders.dealershipId, dealershipId));
    }
    if (showroomId) {
      conditions.push(eq(workOrders.showroomId, showroomId));
    }

    // Get monthly data for the last 9 months
    const monthlyData = await db
      .select({
        month: sql<string>`TO_CHAR(work_orders.created_at, 'Mon')`,
        monthNum: sql<number>`EXTRACT(MONTH FROM work_orders.created_at)`,
        yearNum: sql<number>`EXTRACT(YEAR FROM work_orders.created_at)`,
        orders: count(),
        totalRevenue: sql<number>`COALESCE(SUM(payouts.net_amount), 0)`
      })
      .from(workOrders)
      .leftJoin(jobCards, eq(workOrders.id, jobCards.workOrderId))
      .leftJoin(payouts, eq(jobCards.id, payouts.jobCardId))
      .where(and(
        ...conditions,
        sql`work_orders.created_at >= CURRENT_DATE - INTERVAL '9 months'`
      ))
      .groupBy(
        sql`TO_CHAR(work_orders.created_at, 'Mon')`,
        sql`EXTRACT(MONTH FROM work_orders.created_at)`,
        sql`EXTRACT(YEAR FROM work_orders.created_at)`
      )
      .orderBy(
        sql`EXTRACT(YEAR FROM work_orders.created_at)`,
        sql`EXTRACT(MONTH FROM work_orders.created_at)`
      );

    return monthlyData.map(row => ({
      month: row.month,
      orders: row.orders || 0,
      revenue: Number(row.totalRevenue || 0)
    }));
  }

  async getDealershipPerformance(oemId: string): Promise<{
    name: string;
    orders: number;
    revenue: number;
    growth: number;
  }[]> {
    // Get top performing dealerships in the OEM
    const performanceData = await db
      .select({
        dealershipId: workOrders.dealershipId,
        name: dealerships.name,
        thisMonthOrders: count(),
        thisMonthRevenue: sql<number>`COALESCE(SUM(payouts.net_amount), 0)`
      })
      .from(workOrders)
      .innerJoin(dealerships, eq(workOrders.dealershipId, dealerships.id))
      .leftJoin(jobCards, eq(workOrders.id, jobCards.workOrderId))
      .leftJoin(payouts, eq(jobCards.id, payouts.jobCardId))
      .where(and(
        eq(workOrders.oemId, oemId),
        sql`EXTRACT(MONTH FROM work_orders.created_at) = EXTRACT(MONTH FROM CURRENT_DATE)`,
        sql`EXTRACT(YEAR FROM work_orders.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`
      ))
      .groupBy(workOrders.dealershipId, dealerships.name)
      .orderBy(desc(count()))
      .limit(5);

    // Calculate growth (simplified - using random growth for now, would need previous month data)
    return performanceData.map(row => ({
      name: row.name,
      orders: row.thisMonthOrders || 0,
      revenue: Number(row.thisMonthRevenue || 0),
      growth: Math.round((Math.random() * 20 - 5) * 10) / 10 // Placeholder growth calculation
    }));
  }

  async getVehicleCategoryUpsells(oemId: string): Promise<{
    category: string;
    upsells: number;
    upsellRate: number;
    avgValue: number;
  }[]> {
    // Get vehicle category performance data
    const categoryData = await db
      .select({
        vehicleType: vehicleModels.vehicleType,
        totalOrders: count(),
        avgRevenue: avg(payouts.netAmount)
      })
      .from(workOrders)
      .innerJoin(vehicleModels, eq(workOrders.vehicleModelId, vehicleModels.id))
      .leftJoin(jobCards, eq(workOrders.id, jobCards.workOrderId))
      .leftJoin(payouts, eq(jobCards.id, payouts.jobCardId))
      .where(and(
        eq(workOrders.oemId, oemId),
        sql`work_orders.created_at >= CURRENT_DATE - INTERVAL '3 months'`
      ))
      .groupBy(vehicleModels.vehicleType)
      .orderBy(desc(count()));

    const typeMapping: { [key: string]: string } = {
      'HATCHBACK': 'Hatchback',
      'SEDAN': 'Premium Sedan', 
      'SUV': 'Luxury SUV',
      'CROSSOVER': 'Compact SUV',
      'LUXURY_SEDAN': 'Premium Sedan',
      'LUXURY_SUV': 'Luxury SUV',
      'COUPE': 'Sports Car',
      'CONVERTIBLE': 'Sports Car'
    };

    return categoryData.map(row => ({
      category: typeMapping[row.vehicleType || ''] || 'Other',
      upsells: row.totalOrders || 0,
      upsellRate: Math.round((Math.random() * 40 + 40) * 10) / 10, // Placeholder upsell rate
      avgValue: Math.round(Number(row.avgRevenue || 0))
    }));
  }

  async getTerritoryPerformance(oemId: string, dealershipId?: string, showroomId?: string): Promise<{
    territory: string;
    orders: number;
    upsells: number;
    upsellRate: number;
    revenue: number;
  }[]> {
    // Get performance by city/territory
    const conditions = [
      eq(workOrders.oemId, oemId),
      isNotNull(dealerships.city),
      sql`work_orders.created_at >= CURRENT_DATE - INTERVAL '3 months'`
    ];
    
    if (dealershipId) {
      conditions.push(eq(workOrders.dealershipId, dealershipId));
    }
    if (showroomId) {
      conditions.push(eq(workOrders.showroomId, showroomId));
    }
    
    const territoryData = await db
      .select({
        territory: dealerships.city,
        totalOrders: count(),
        totalRevenue: sum(payouts.netAmount)
      })
      .from(workOrders)
      .innerJoin(dealerships, eq(workOrders.dealershipId, dealerships.id))
      .leftJoin(jobCards, eq(workOrders.id, jobCards.workOrderId))
      .leftJoin(payouts, eq(jobCards.id, payouts.jobCardId))
      .where(and(...conditions))
      .groupBy(dealerships.city)
      .orderBy(desc(count()))
      .limit(5);

    return territoryData.map(row => ({
      territory: row.territory || 'Unknown',
      orders: row.totalOrders || 0,
      upsells: Math.round((row.totalOrders || 0) * 0.7), // Estimated upsells
      upsellRate: Math.round((Math.random() * 20 + 60) * 10) / 10, // Placeholder upsell rate
      revenue: Number(row.totalRevenue || 0)
    }));
  }

  async getServicePopularity(oemId: string, showroomId?: string, dealershipId?: string): Promise<{
    name: string;
    value: number;
    color: string;
  }[]> {
    const conditions = [eq(workOrders.oemId, oemId)];
    if (dealershipId) {
      conditions.push(eq(workOrders.dealershipId, dealershipId));
    }
    if (showroomId) {
      conditions.push(eq(workOrders.showroomId, showroomId));
    }

    const serviceData = await db
      .select({
        serviceName: services.name,
        count: count()
      })
      .from(workOrders)
      .innerJoin(services, eq(workOrders.serviceId, services.id))
      .where(and(
        ...conditions,
        sql`work_orders.created_at >= CURRENT_DATE - INTERVAL '3 months'`
      ))
      .groupBy(services.name)
      .orderBy(desc(count()))
      .limit(5);

    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff88'];
    
    return serviceData.map((row, index) => ({
      name: row.serviceName,
      value: row.count || 0,
      color: colors[index % colors.length]
    }));
  }

  async getMonthlyTrends(oemId: string, showroomId?: string, dealershipId?: string): Promise<{
    month: string;
    completedOrders: number;
    avgTAT: number;
    customerSatisfaction: number;
  }[]> {
    const conditions = [eq(workOrders.oemId, oemId)];
    if (dealershipId) {
      conditions.push(eq(workOrders.dealershipId, dealershipId));
    }
    if (showroomId) {
      conditions.push(eq(workOrders.showroomId, showroomId));
    }

    // Get monthly trends for the last 9 months
    const monthlyTrends = await db
      .select({
        month: sql<string>`TO_CHAR(job_cards.completed_at, 'Mon')`,
        monthNum: sql<number>`EXTRACT(MONTH FROM job_cards.completed_at)`,
        yearNum: sql<number>`EXTRACT(YEAR FROM job_cards.completed_at)`,
        completedCount: count(),
        avgTATDays: sql<number>`AVG(EXTRACT(EPOCH FROM (job_cards.completed_at - job_cards.started_at)) / 86400)`
      })
      .from(jobCards)
      .innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
      .where(and(
        ...conditions,
        eq(jobCards.status, 'APPROVED'),
        isNotNull(jobCards.startedAt),
        isNotNull(jobCards.completedAt),
        sql`job_cards.completed_at >= CURRENT_DATE - INTERVAL '9 months'`
      ))
      .groupBy(
        sql`TO_CHAR(job_cards.completed_at, 'Mon')`,
        sql`EXTRACT(MONTH FROM job_cards.completed_at)`,
        sql`EXTRACT(YEAR FROM job_cards.completed_at)`
      )
      .orderBy(
        sql`EXTRACT(YEAR FROM job_cards.completed_at)`,
        sql`EXTRACT(MONTH FROM job_cards.completed_at)`
      );

    return monthlyTrends.map(row => ({
      month: row.month,
      completedOrders: row.completedCount || 0,
      avgTAT: Math.round((row.avgTATDays || 0) * 10) / 10,
      customerSatisfaction: Math.round((Math.random() * 0.5 + 4.0) * 10) / 10 // Placeholder satisfaction score
    }));
  }

  async getReportsMetrics(oemId: string, showroomId?: string, dealershipId?: string): Promise<{
    totalWorkOrders: { thisMonth: number; lastMonth: number; change: number; isPositive: boolean };
    avgTAT: { thisMonth: number; lastMonth: number; change: number; isPositive: boolean };
    firstPassRate: { thisMonth: number; lastMonth: number; change: number; isPositive: boolean };
    customerSatisfaction: { thisMonth: number; lastMonth: number; change: number; isPositive: boolean };
  }> {
    const conditions = [eq(workOrders.oemId, oemId)];
    if (showroomId) conditions.push(eq(workOrders.showroomId, showroomId));
    if (dealershipId) conditions.push(eq(workOrders.dealershipId, dealershipId));

    // This month work orders
    const thisMonthWOResult = await db
      .select({ count: count() })
      .from(workOrders)
      .where(and(
        ...conditions,
        sql`work_orders.created_at >= DATE_TRUNC('month', CURRENT_DATE)`
      ));
    const thisMonthWO = thisMonthWOResult[0]?.count || 0;

    // Last month work orders
    const lastMonthWOResult = await db
      .select({ count: count() })
      .from(workOrders)
      .where(and(
        ...conditions,
        sql`work_orders.created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`,
        sql`work_orders.created_at < DATE_TRUNC('month', CURRENT_DATE)`
      ));
    const lastMonthWO = lastMonthWOResult[0]?.count || 0;

    // Calculate TAT (Turnaround Time) for this month
    const thisMonthJCConditions = [...conditions];
    const thisMonthTATResult = await db
      .select({
        avgTAT: sql<number>`AVG(EXTRACT(EPOCH FROM (job_cards.completed_at - job_cards.started_at)) / 86400)`
      })
      .from(jobCards)
      .innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
      .where(and(
        ...thisMonthJCConditions,
        eq(jobCards.status, 'APPROVED'),
        isNotNull(jobCards.startedAt),
        isNotNull(jobCards.completedAt),
        sql`job_cards.completed_at >= DATE_TRUNC('month', CURRENT_DATE)`
      ));
    const thisMonthTAT = thisMonthTATResult[0]?.avgTAT || 0;

    // Calculate TAT for last month
    const lastMonthTATResult = await db
      .select({
        avgTAT: sql<number>`AVG(EXTRACT(EPOCH FROM (job_cards.completed_at - job_cards.started_at)) / 86400)`
      })
      .from(jobCards)
      .innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
      .where(and(
        ...conditions,
        eq(jobCards.status, 'APPROVED'),
        isNotNull(jobCards.startedAt),
        isNotNull(jobCards.completedAt),
        sql`job_cards.completed_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`,
        sql`job_cards.completed_at < DATE_TRUNC('month', CURRENT_DATE)`
      ));
    const lastMonthTAT = lastMonthTATResult[0]?.avgTAT || 0;

    // First Pass Rate (jobs completed without rework)
    const thisMonthTotalResult = await db
      .select({ count: count() })
      .from(jobCards)
      .innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
      .where(and(
        ...conditions,
        eq(jobCards.status, 'APPROVED'),
        sql`job_cards.completed_at >= DATE_TRUNC('month', CURRENT_DATE)`
      ));
    const thisMonthTotal = thisMonthTotalResult[0]?.count || 0;

    const thisMonthReworkResult = await db
      .select({ count: count() })
      .from(jobCards)
      .innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
      .where(and(
        ...conditions,
        eq(jobCards.status, 'APPROVED'),
        sql`job_cards.rework_requested_at IS NOT NULL`,
        sql`job_cards.completed_at >= DATE_TRUNC('month', CURRENT_DATE)`
      ));
    const thisMonthRework = thisMonthReworkResult[0]?.count || 0;
    const thisMonthFPR = thisMonthTotal > 0 ? ((thisMonthTotal - thisMonthRework) / thisMonthTotal) * 100 : 0;

    const lastMonthTotalResult = await db
      .select({ count: count() })
      .from(jobCards)
      .innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
      .where(and(
        ...conditions,
        eq(jobCards.status, 'APPROVED'),
        sql`job_cards.completed_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`,
        sql`job_cards.completed_at < DATE_TRUNC('month', CURRENT_DATE)`
      ));
    const lastMonthTotal = lastMonthTotalResult[0]?.count || 0;

    const lastMonthReworkResult = await db
      .select({ count: count() })
      .from(jobCards)
      .innerJoin(workOrders, eq(jobCards.workOrderId, workOrders.id))
      .where(and(
        ...conditions,
        eq(jobCards.status, 'APPROVED'),
        sql`job_cards.rework_requested_at IS NOT NULL`,
        sql`job_cards.completed_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`,
        sql`job_cards.completed_at < DATE_TRUNC('month', CURRENT_DATE)`
      ));
    const lastMonthRework = lastMonthReworkResult[0]?.count || 0;
    const lastMonthFPR = lastMonthTotal > 0 ? ((lastMonthTotal - lastMonthRework) / lastMonthTotal) * 100 : 0;

    // Calculate changes
    const woChange = lastMonthWO > 0 ? ((thisMonthWO - lastMonthWO) / lastMonthWO) * 100 : 0;
    const tatChange = lastMonthTAT > 0 ? ((thisMonthTAT - lastMonthTAT) / lastMonthTAT) * 100 : 0;
    const fprChange = lastMonthFPR > 0 ? ((thisMonthFPR - lastMonthFPR) / lastMonthFPR) * 100 : 0;

    // Placeholder for customer satisfaction (can be implemented with rating system)
    const thisMonthCS = 4.6;
    const lastMonthCS = 4.5;
    const csChange = ((thisMonthCS - lastMonthCS) / lastMonthCS) * 100;

    return {
      totalWorkOrders: {
        thisMonth: thisMonthWO,
        lastMonth: lastMonthWO,
        change: Math.round(woChange * 10) / 10,
        isPositive: woChange >= 0
      },
      avgTAT: {
        thisMonth: Math.round(thisMonthTAT * 10) / 10,
        lastMonth: Math.round(lastMonthTAT * 10) / 10,
        change: Math.round(Math.abs(tatChange) * 10) / 10,
        isPositive: tatChange <= 0 // Lower TAT is better
      },
      firstPassRate: {
        thisMonth: Math.round(thisMonthFPR),
        lastMonth: Math.round(lastMonthFPR),
        change: Math.round(fprChange * 10) / 10,
        isPositive: fprChange >= 0
      },
      customerSatisfaction: {
        thisMonth: thisMonthCS,
        lastMonth: lastMonthCS,
        change: Math.round(csChange * 10) / 10,
        isPositive: csChange >= 0
      }
    };
  }

  async getCommissionsSummary(oemId: string, showroomId?: string, dealershipId?: string): Promise<{
    totalCommissionThisMonth: number;
    activeSalesPersons: number;
    avgCommissionRate: number;
  }> {
    const conditions = [eq(workOrders.oemId, oemId)];
    if (showroomId) conditions.push(eq(workOrders.showroomId, showroomId));
    if (dealershipId) conditions.push(eq(workOrders.dealershipId, dealershipId));

    // Total commission this month
    const thisMonthCommissionResult = await db
      .select({
        total: sql<number>`SUM(CAST(commissions.computed_amount AS DECIMAL))`
      })
      .from(commissions)
      .innerJoin(workOrders, eq(commissions.workOrderId, workOrders.id))
      .where(and(
        ...conditions,
        sql`commissions.created_at >= DATE_TRUNC('month', CURRENT_DATE)`
      ));
    const totalCommissionThisMonth = thisMonthCommissionResult[0]?.total || 0;

    // Active sales persons (those who generated commissions this month)
    const activeSalesPersonsResult = await db
      .selectDistinct({ salesPersonId: commissions.salesPersonId })
      .from(commissions)
      .innerJoin(workOrders, eq(commissions.workOrderId, workOrders.id))
      .where(and(
        ...conditions,
        sql`commissions.created_at >= DATE_TRUNC('month', CURRENT_DATE)`
      ));
    const activeSalesPersons = activeSalesPersonsResult.length;

    // Average commission rate
    const avgCommissionRateResult = await db
      .select({
        avgRate: sql<number>`AVG(commission_rules.percentage_rate)`
      })
      .from(commissionRules)
      .where(and(
        eq(commissionRules.oemId, oemId),
        eq(commissionRules.active, true)
      ));
    const avgCommissionRate = avgCommissionRateResult[0]?.avgRate || 0;

    return {
      totalCommissionThisMonth: Math.round(totalCommissionThisMonth),
      activeSalesPersons,
      avgCommissionRate: Math.round(avgCommissionRate * 10) / 10
    };
  }

  // Allocation management implementation
  async getAllocations(filters?: { oemId?: string; partnerId?: string; level?: string; levelId?: string }): Promise<any[]> {
    let query = db
      .select({
        id: allocations.id,
        level: allocations.level,
        levelId: allocations.levelId,
        partnerId: allocations.partnerId,
        priority: allocations.priority,
        partnerBillsDirectly: allocations.partnerBillsDirectly,
        active: allocations.active,
        createdAt: allocations.createdAt,
        partner: {
          id: partners.id,
          displayName: partners.displayName,
          type: partners.type,
          phone: partners.phone,
          email: partners.email
        }
      })
      .from(allocations)
      .leftJoin(partners, eq(allocations.partnerId, partners.id));

    if (filters) {
      const conditions = [];
      
      if (filters.partnerId) {
        conditions.push(eq(allocations.partnerId, filters.partnerId));
      }
      
      if (filters.level) {
        conditions.push(eq(allocations.level, filters.level as any));
      }
      
      if (filters.levelId) {
        conditions.push(eq(allocations.levelId, filters.levelId));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    return await query.orderBy(desc(allocations.createdAt));
  }

  async getAllocationsWithCategories(filters?: { oemId?: string; partnerId?: string; level?: string; levelId?: string }): Promise<any[]> {
    // First get allocations with partners
    let allocationsWithPartners = await this.getAllocations(filters);
    
    // Get all partner-category mappings with category details
    const mappings = await db
      .select({
        partnerId: partnerServiceCategories.partnerId,
        category: serviceCategories
      })
      .from(partnerServiceCategories)
      .innerJoin(serviceCategories, eq(partnerServiceCategories.serviceCategoryId, serviceCategories.id))
      .where(eq(serviceCategories.active, true));

    // Group categories by partner
    const partnerCategoriesMap = new Map<string, any[]>();
    for (const mapping of mappings) {
      const categories = partnerCategoriesMap.get(mapping.partnerId) || [];
      categories.push(mapping.category);
      partnerCategoriesMap.set(mapping.partnerId, categories);
    }

    // Get all allocation-brand mappings with brand details
    const allocationBrandMappings = await db
      .select({
        allocationId: allocationBrands.allocationId,
        brand: brands
      })
      .from(allocationBrands)
      .innerJoin(brands, eq(allocationBrands.brandId, brands.id))
      .where(eq(brands.active, true));

    // Group brands by allocation
    const allocationBrandsMap = new Map<string, any[]>();
    for (const mapping of allocationBrandMappings) {
      const brandList = allocationBrandsMap.get(mapping.allocationId) || [];
      brandList.push(mapping.brand);
      allocationBrandsMap.set(mapping.allocationId, brandList);
    }

    // Add service categories and brands to each allocation
    return allocationsWithPartners.map(allocation => ({
      ...allocation,
      partner: {
        ...allocation.partner,
        serviceCategories: partnerCategoriesMap.get(allocation.partnerId) || []
      },
      brands: allocationBrandsMap.get(allocation.id) || []
    }));
  }

  async getAllocation(id: string): Promise<any | undefined> {
    const [allocation] = await db
      .select({
        id: allocations.id,
        level: allocations.level,
        levelId: allocations.levelId,
        partnerId: allocations.partnerId,
        priority: allocations.priority,
        partnerBillsDirectly: allocations.partnerBillsDirectly,
        active: allocations.active,
        createdAt: allocations.createdAt,
        partner: {
          id: partners.id,
          displayName: partners.displayName,
          type: partners.type,
          phone: partners.phone,
          email: partners.email
        }
      })
      .from(allocations)
      .leftJoin(partners, eq(allocations.partnerId, partners.id))
      .where(eq(allocations.id, id));
    
    return allocation || undefined;
  }

  async getAllocatedBrands(level: string, levelId: string): Promise<{ brandId: string; partnerId: string; partnerName: string }[]> {
    const result = await db
      .select({
        brandId: allocationBrands.brandId,
        partnerId: allocations.partnerId,
        partnerName: partners.displayName
      })
      .from(allocations)
      .innerJoin(allocationBrands, eq(allocations.id, allocationBrands.allocationId))
      .innerJoin(partners, eq(allocations.partnerId, partners.id))
      .where(and(
        eq(allocations.level, level),
        eq(allocations.levelId, levelId),
        eq(allocations.active, true)
      ));
    
    return result;
  }

  async createAllocation(allocation: any): Promise<any> {
    // Business rule: Check if this specific partner is already allocated to this dealership/showroom
    const existingAllocation = await db
      .select()
      .from(allocations)
      .where(and(
        eq(allocations.levelId, allocation.levelId),
        eq(allocations.level, allocation.level),
        eq(allocations.partnerId, allocation.partnerId),
        eq(allocations.active, true)
      ));

    if (existingAllocation.length > 0) {
      throw new Error(`This partner is already allocated to this ${allocation.level.toLowerCase()}. Please remove the existing allocation first.`);
    }

    const [newAllocation] = await db
      .insert(allocations)
      .values({
        level: allocation.level,
        levelId: allocation.levelId,
        partnerId: allocation.partnerId,
        priority: allocation.priority || 1,
        partnerBillsDirectly: allocation.partnerBillsDirectly ?? false,
        active: allocation.active ?? true
      })
      .returning();
    
    return newAllocation;
  }

  async updateAllocation(id: string, updates: any): Promise<any | undefined> {
    const [allocation] = await db
      .update(allocations)
      .set({
        ...updates,
        updatedAt: sql`NOW()`
      })
      .where(eq(allocations.id, id))
      .returning();
    
    return allocation || undefined;
  }

  async deleteAllocation(id: string): Promise<boolean> {
    const result = await db
      .delete(allocations)
      .where(eq(allocations.id, id));
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  async createAuditLog(log: {
    actorUserId?: string;
    entity: string;
    entityId: string;
    action: string;
    diffJson?: any;
  }): Promise<void> {
    await db.insert(auditLogs).values({
      actorUserId: log.actorUserId,
      entity: log.entity,
      entityId: log.entityId,
      action: log.action,
      diffJson: log.diffJson
    });
  }

  // OEM Royalty Management Implementation
  async getOemRoyaltyRules(filters?: { oemId?: string; isActive?: boolean }): Promise<OemRoyaltyRule[]> {
    let query = db.select().from(oemRoyaltyRules);
    
    const conditions = [];
    
    if (filters?.oemId) {
      conditions.push(eq(oemRoyaltyRules.oemId, filters.oemId));
    }
    
    if (filters?.isActive !== undefined) {
      conditions.push(eq(oemRoyaltyRules.isActive, filters.isActive));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(oemRoyaltyRules.createdAt));
  }

  async getOemRoyaltyRule(id: string): Promise<OemRoyaltyRule | undefined> {
    const [rule] = await db
      .select()
      .from(oemRoyaltyRules)
      .where(eq(oemRoyaltyRules.id, id));
    return rule || undefined;
  }

  async getOemRoyaltyRuleByOem(oemId: string): Promise<OemRoyaltyRule | undefined> {
    const [rule] = await db
      .select()
      .from(oemRoyaltyRules)
      .where(and(
        eq(oemRoyaltyRules.oemId, oemId),
        eq(oemRoyaltyRules.isActive, true)
      ))
      .orderBy(desc(oemRoyaltyRules.effectiveFrom));
    return rule || undefined;
  }

  async createOemRoyaltyRule(rule: InsertOemRoyaltyRule, createdBy: string): Promise<OemRoyaltyRule> {
    // Deactivate any existing active rule for this OEM
    await db
      .update(oemRoyaltyRules)
      .set({ 
        isActive: false, 
        effectiveTo: sql`NOW()`,
        updatedBy: createdBy,
        updatedAt: sql`NOW()`
      })
      .where(and(
        eq(oemRoyaltyRules.oemId, rule.oemId),
        eq(oemRoyaltyRules.isActive, true)
      ));

    const [newRule] = await db
      .insert(oemRoyaltyRules)
      .values({
        ...rule,
        createdBy,
        updatedBy: createdBy
      })
      .returning();
    
    return newRule;
  }

  async updateOemRoyaltyRule(id: string, updates: Partial<InsertOemRoyaltyRule>, updatedBy: string): Promise<OemRoyaltyRule | undefined> {
    const [rule] = await db
      .update(oemRoyaltyRules)
      .set({
        ...updates,
        updatedBy,
        updatedAt: sql`NOW()`
      })
      .where(eq(oemRoyaltyRules.id, id))
      .returning();
    
    return rule || undefined;
  }

  async deactivateOemRoyaltyRule(id: string, updatedBy: string): Promise<boolean> {
    const result = await db
      .update(oemRoyaltyRules)
      .set({ 
        isActive: false, 
        effectiveTo: sql`NOW()`,
        updatedBy,
        updatedAt: sql`NOW()`
      })
      .where(eq(oemRoyaltyRules.id, id));
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  // OEM Royalty Calculations Implementation
  async getOemRoyaltyCalculations(filters?: { oemId?: string; workOrderId?: string; status?: string }): Promise<OemRoyaltyCalculation[]> {
    let query = db.select().from(oemRoyaltyCalculations);
    
    const conditions = [];
    
    if (filters?.oemId) {
      conditions.push(eq(oemRoyaltyCalculations.oemId, filters.oemId));
    }
    
    if (filters?.workOrderId) {
      conditions.push(eq(oemRoyaltyCalculations.workOrderId, filters.workOrderId));
    }
    
    if (filters?.status) {
      conditions.push(eq(oemRoyaltyCalculations.status, filters.status));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(oemRoyaltyCalculations.calculatedAt));
  }

  async createOemRoyaltyCalculation(calculation: InsertOemRoyaltyCalculation): Promise<OemRoyaltyCalculation> {
    const [newCalculation] = await db
      .insert(oemRoyaltyCalculations)
      .values(calculation)
      .returning();
    
    return newCalculation;
  }

  async updateOemRoyaltyCalculation(id: string, updates: Partial<InsertOemRoyaltyCalculation>): Promise<OemRoyaltyCalculation | undefined> {
    const [calculation] = await db
      .update(oemRoyaltyCalculations)
      .set(updates)
      .where(eq(oemRoyaltyCalculations.id, id))
      .returning();
    
    return calculation || undefined;
  }

  async calculateRoyaltyForWorkOrder(workOrderId: string, workOrderValue: number, oemId: string): Promise<OemRoyaltyCalculation | null> {
    // Check if royalty already calculated for this work order
    const [existingCalculation] = await db
      .select()
      .from(oemRoyaltyCalculations)
      .where(eq(oemRoyaltyCalculations.workOrderId, workOrderId));
    
    if (existingCalculation) {
      return existingCalculation;
    }

    // Get active royalty rule for this OEM
    const royaltyRule = await this.getOemRoyaltyRuleByOem(oemId);
    
    if (!royaltyRule) {
      // No royalty rule found, no royalty applicable
      return null;
    }

    // Calculate royalty amount
    const royaltyAmount = (workOrderValue * parseFloat(royaltyRule.royaltyPercentage)) / 100;

    // Create royalty calculation record
    const newCalculation = await this.createOemRoyaltyCalculation({
      workOrderId,
      oemId,
      royaltyRuleId: royaltyRule.id,
      workOrderValue: workOrderValue.toString(),
      royaltyPercentage: royaltyRule.royaltyPercentage,
      royaltyAmount: royaltyAmount.toString(),
      status: "PENDING"
    });

    return newCalculation;
  }

  // Knowledge Hub methods
  async getKnowledgeHubItems(filters?: { 
    oemId?: string; 
    applicableTo?: string[];
    category?: string;
    contentType?: string;
    isActive?: boolean;
    searchTerm?: string;
  }): Promise<any[]> {
    let query = db
      .select({
        id: knowledgeHub.id,
        title: knowledgeHub.title,
        category: knowledgeHub.category,
        contentType: knowledgeHub.contentType,
        fileUrl: knowledgeHub.fileUrl,
        externalLink: knowledgeHub.externalLink,
        applicableTo: knowledgeHub.applicableTo,
        description: knowledgeHub.description,
        isActive: knowledgeHub.isActive,
        viewCount: knowledgeHub.viewCount,
        createdBy: knowledgeHub.createdBy,
        oemId: knowledgeHub.oemId,
        createdAt: knowledgeHub.createdAt,
        updatedAt: knowledgeHub.updatedAt,
        creatorName: users.name,
        creatorEmail: users.email
      })
      .from(knowledgeHub)
      .leftJoin(users, eq(knowledgeHub.createdBy, users.id));

    const conditions = [];

    if (filters) {
      if (filters.oemId) {
        conditions.push(
          or(
            eq(knowledgeHub.oemId, filters.oemId),
            isNull(knowledgeHub.oemId)
          )
        );
      }

      if (filters.category) {
        conditions.push(eq(knowledgeHub.category, filters.category));
      }

      if (filters.contentType) {
        conditions.push(eq(knowledgeHub.contentType, filters.contentType));
      }

      if (filters.isActive !== undefined) {
        conditions.push(eq(knowledgeHub.isActive, filters.isActive));
      }

      if (filters.searchTerm) {
        conditions.push(
          or(
            like(knowledgeHub.title, `%${filters.searchTerm}%`),
            like(knowledgeHub.description, `%${filters.searchTerm}%`)
          )
        );
      }

      // Filter by applicable roles
      if (filters.applicableTo && filters.applicableTo.length > 0) {
        // Check if any of the user's roles are in the applicableTo array
        conditions.push(
          sql`${knowledgeHub.applicableTo} && ARRAY[${sql.join(
            filters.applicableTo.map(role => sql`${role}::knowledge_hub_applicable_to`),
            sql`, `
          )}]::knowledge_hub_applicable_to[]`
        );
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const items = await query.orderBy(desc(knowledgeHub.createdAt));
    return items;
  }

  async getKnowledgeHubItem(id: string): Promise<any | undefined> {
    const [item] = await db
      .select({
        id: knowledgeHub.id,
        title: knowledgeHub.title,
        category: knowledgeHub.category,
        contentType: knowledgeHub.contentType,
        fileUrl: knowledgeHub.fileUrl,
        externalLink: knowledgeHub.externalLink,
        applicableTo: knowledgeHub.applicableTo,
        description: knowledgeHub.description,
        isActive: knowledgeHub.isActive,
        viewCount: knowledgeHub.viewCount,
        createdBy: knowledgeHub.createdBy,
        oemId: knowledgeHub.oemId,
        createdAt: knowledgeHub.createdAt,
        updatedAt: knowledgeHub.updatedAt,
        creatorName: users.name,
        creatorEmail: users.email
      })
      .from(knowledgeHub)
      .leftJoin(users, eq(knowledgeHub.createdBy, users.id))
      .where(eq(knowledgeHub.id, id));

    return item || undefined;
  }

  async createKnowledgeHubItem(item: InsertKnowledgeHub): Promise<KnowledgeHub> {
    const [newItem] = await db
      .insert(knowledgeHub)
      .values(item)
      .returning();

    return newItem;
  }

  async updateKnowledgeHubItem(id: string, updates: Partial<InsertKnowledgeHub>): Promise<KnowledgeHub | undefined> {
    const [updatedItem] = await db
      .update(knowledgeHub)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(knowledgeHub.id, id))
      .returning();

    return updatedItem || undefined;
  }

  async deleteKnowledgeHubItem(id: string): Promise<boolean> {
    const result = await db
      .delete(knowledgeHub)
      .where(eq(knowledgeHub.id, id));

    return result.rowCount !== null && result.rowCount > 0;
  }

  async incrementViewCount(id: string): Promise<void> {
    await db
      .update(knowledgeHub)
      .set({ viewCount: sql`${knowledgeHub.viewCount} + 1` })
      .where(eq(knowledgeHub.id, id));
  }

  // Brand methods
  async getBrands(): Promise<Brand[]> {
    return await db
      .select()
      .from(brands)
      .where(eq(brands.active, true))
      .orderBy(asc(brands.name));
  }

  async getBrand(id: string): Promise<Brand | undefined> {
    const [brand] = await db
      .select()
      .from(brands)
      .where(eq(brands.id, id));
    return brand || undefined;
  }

  async getBrandByName(name: string): Promise<Brand | undefined> {
    const [brand] = await db
      .select()
      .from(brands)
      .where(eq(brands.name, name));
    return brand || undefined;
  }

  async createBrand(brand: InsertBrand): Promise<Brand> {
    const [newBrand] = await db
      .insert(brands)
      .values(brand)
      .returning();
    return newBrand;
  }

  async updateBrand(id: string, updates: Partial<InsertBrand>): Promise<Brand | undefined> {
    const [updatedBrand] = await db
      .update(brands)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(brands.id, id))
      .returning();
    return updatedBrand || undefined;
  }

  async deleteBrand(id: string): Promise<boolean> {
    const result = await db
      .delete(brands)
      .where(eq(brands.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // WhatsApp Template methods
  async getWhatsappTemplates(filters?: { brandId?: string; eventType?: string }): Promise<WhatsappTemplate[]> {
    let query = db.select().from(whatsappTemplates);
    
    const conditions = [];
    if (filters?.brandId) {
      conditions.push(eq(whatsappTemplates.brandId, filters.brandId));
    }
    if (filters?.eventType) {
      conditions.push(eq(whatsappTemplates.eventType, filters.eventType));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(asc(whatsappTemplates.eventType));
  }

  async getWhatsappTemplate(id: string): Promise<WhatsappTemplate | undefined> {
    const [template] = await db
      .select()
      .from(whatsappTemplates)
      .where(eq(whatsappTemplates.id, id));
    return template || undefined;
  }

  async getWhatsappTemplateByBrandAndEvent(brandId: string, eventType: string): Promise<WhatsappTemplate | undefined> {
    const [template] = await db
      .select()
      .from(whatsappTemplates)
      .where(and(
        eq(whatsappTemplates.brandId, brandId),
        eq(whatsappTemplates.eventType, eventType),
        eq(whatsappTemplates.isActive, true)
      ));
    return template || undefined;
  }

  async createWhatsappTemplate(template: InsertWhatsappTemplate): Promise<WhatsappTemplate> {
    const [newTemplate] = await db
      .insert(whatsappTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async updateWhatsappTemplate(id: string, updates: Partial<InsertWhatsappTemplate>): Promise<WhatsappTemplate | undefined> {
    const [updatedTemplate] = await db
      .update(whatsappTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(whatsappTemplates.id, id))
      .returning();
    return updatedTemplate || undefined;
  }

  async deleteWhatsappTemplate(id: string): Promise<boolean> {
    const result = await db
      .delete(whatsappTemplates)
      .where(eq(whatsappTemplates.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Raw Material methods
  async getRawMaterials(): Promise<RawMaterial[]> {
    return await db
      .select()
      .from(rawMaterials)
      .where(eq(rawMaterials.active, true))
      .orderBy(asc(rawMaterials.name));
  }

  async getRawMaterial(id: string): Promise<RawMaterial | undefined> {
    const [material] = await db
      .select()
      .from(rawMaterials)
      .where(eq(rawMaterials.id, id));
    return material || undefined;
  }

  async getRawMaterialByName(name: string): Promise<RawMaterial | undefined> {
    const [material] = await db
      .select()
      .from(rawMaterials)
      .where(eq(rawMaterials.name, name));
    return material || undefined;
  }

  async createRawMaterial(material: InsertRawMaterial): Promise<RawMaterial> {
    const [newMaterial] = await db
      .insert(rawMaterials)
      .values(material)
      .returning();
    return newMaterial;
  }

  async updateRawMaterial(id: string, updates: Partial<InsertRawMaterial>): Promise<RawMaterial | undefined> {
    const [updatedMaterial] = await db
      .update(rawMaterials)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(rawMaterials.id, id))
      .returning();
    return updatedMaterial || undefined;
  }

  async deleteRawMaterial(id: string): Promise<boolean> {
    const result = await db
      .delete(rawMaterials)
      .where(eq(rawMaterials.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getServiceRawMaterials(serviceId: string): Promise<RawMaterial[]> {
    const results = await db
      .select({
        id: rawMaterials.id,
        name: rawMaterials.name,
        brandId: rawMaterials.brandId,
        active: rawMaterials.active,
        createdAt: rawMaterials.createdAt,
        updatedAt: rawMaterials.updatedAt
      })
      .from(serviceRawMaterials)
      .innerJoin(rawMaterials, eq(serviceRawMaterials.rawMaterialId, rawMaterials.id))
      .where(eq(serviceRawMaterials.serviceId, serviceId));
    
    return results;
  }

  async addServiceRawMaterial(serviceId: string, rawMaterialId: string): Promise<ServiceRawMaterial> {
    const [mapping] = await db
      .insert(serviceRawMaterials)
      .values({ serviceId, rawMaterialId })
      .returning();
    return mapping;
  }

  async removeServiceRawMaterial(serviceId: string, rawMaterialId: string): Promise<boolean> {
    const result = await db
      .delete(serviceRawMaterials)
      .where(
        and(
          eq(serviceRawMaterials.serviceId, serviceId),
          eq(serviceRawMaterials.rawMaterialId, rawMaterialId)
        )
      );
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();
