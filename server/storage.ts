import { 
  users, 
  oems,
  dealerships,
  showrooms,
  salesPersons,
  partners,
  partnerOems,
  allocations,
  vehicleModels,
  vehicleVariants,
  services,
  serviceCategories,
  partnerServiceCategories,
  pricingRules,
  commissionRules,
  workOrders,
  jobCards,
  jobCardMedia,
  approvals,
  payouts,
  commissions,
  auditLogs,
  type User, 
  type InsertUser,
  type Oem,
  type InsertOem,
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
  type InsertPartnerServiceCategory
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, count, avg, sum, lte, gte, or, isNull, asc, inArray, ne, like } from "drizzle-orm";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(filters?: { oemId?: string; dealershipId?: string; showroomId?: string; role?: string }): Promise<User[]>;
  getSalesPersons(showroomId?: string): Promise<User[]>;
  getSalesPersonMetrics(salesPersonId: string): Promise<{
    activeOrders: number;
    thisMonthRevenue: number;
    thisMonthOrders: number;
  }>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Service Categories management
  getServiceCategories(): Promise<ServiceCategory[]>;
  getServiceCategory(id: string): Promise<ServiceCategory | undefined>;
  createServiceCategory(category: InsertServiceCategory): Promise<ServiceCategory>;
  updateServiceCategory(id: string, updates: Partial<InsertServiceCategory>): Promise<ServiceCategory | undefined>;
  deleteServiceCategory(id: string): Promise<boolean>;

  // Services management
  getServices(filters?: { oemId?: string; dealershipId?: string }): Promise<any[]>;
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
  getDealerships(oemId?: string): Promise<any[]>;
  getDealership(id: string): Promise<any | undefined>;
  createDealership(dealership: any): Promise<any>;
  updateDealership(id: string, updates: any): Promise<any | undefined>;
  deleteDealership(id: string): Promise<boolean>;

  // Showroom management
  getShowrooms(dealershipId?: string, oemId?: string): Promise<any[]>;
  getShowroom(id: string): Promise<any | undefined>;
  createShowroom(showroom: any): Promise<any>;
  updateShowroom(id: string, updates: any): Promise<any | undefined>;
  deleteShowroom(id: string): Promise<boolean>;

  // Work Order management
  getWorkOrders(filters?: { 
    oemId?: string; 
    showroomId?: string; 
    partnerId?: string; 
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<WorkOrder[]>;
  getWorkOrder(id: string): Promise<WorkOrder | undefined>;
  createWorkOrder(workOrder: InsertWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(id: string, updates: Partial<InsertWorkOrder>): Promise<WorkOrder | undefined>;

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

  // Partner management
  getPartners(filters?: { oemId?: string; type?: string }): Promise<Partner[]>;
  getPartner(id: string): Promise<Partner | undefined>;
  createPartner(partner: InsertPartner): Promise<Partner>;
  updatePartner(id: string, updates: Partial<InsertPartner>): Promise<Partner | undefined>;

  // Partner Service Categories
  getPartnerServiceCategories(partnerId: string): Promise<string[]>;
  getPartnersWithCategories(): Promise<(Partner & { serviceCategories?: ServiceCategory[] })[]>;
  setPartnerServiceCategories(partnerId: string, serviceCategoryIds: string[]): Promise<void>;

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
  createAllocation(allocation: any): Promise<any>;
  updateAllocation(id: string, updates: any): Promise<any | undefined>;
  deleteAllocation(id: string): Promise<boolean>;

  // Dashboard metrics
  getDashboardMetrics(oemId: string, showroomId?: string): Promise<{
    activeWorkOrders: number;
    pendingApprovals: number;
    thisMonthRevenue: number;
    avgTAT: number;
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

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
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

  async deleteUser(id: string): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id));
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
  async getServices(filters?: { oemId?: string; dealershipId?: string }): Promise<any[]> {
    let query = db.select().from(services);
    
    if (filters?.dealershipId) {
      // For dealership-specific services, include GLOBAL, OEM-specific, dealership-specific, and MULTIPLE
      query = query.where(
        and(
          eq(services.active, true),
          sql`(
            ${services.availabilityScope} = 'GLOBAL' OR 
            (${services.availabilityScope} = 'DEALERSHIP' AND ${services.dealershipId} = ${filters.dealershipId}) OR
            (${services.availabilityScope} = 'OEM' AND ${services.oemId} = (SELECT oem_id FROM dealerships WHERE id = ${filters.dealershipId})) OR
            (${services.availabilityScope} = 'MULTIPLE' AND (
              ${filters.dealershipId} = ANY(${services.dealershipIds}) OR
              (SELECT oem_id FROM dealerships WHERE id = ${filters.dealershipId}) = ANY(${services.oemIds})
            ))
          )`
        )
      );
    } else if (filters?.oemId) {
      // For OEM-specific services, include GLOBAL, OEM-specific, and MULTIPLE with matching OEMs
      query = query.where(
        and(
          eq(services.active, true),
          sql`(
            ${services.availabilityScope} = 'GLOBAL' OR 
            (${services.availabilityScope} = 'OEM' AND ${services.oemId} = ${filters.oemId}) OR
            (${services.availabilityScope} = 'MULTIPLE' AND ${filters.oemId} = ANY(${services.oemIds}))
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
    
    // 2. Update users to remove OEM association (preserve user accounts)
    await db.update(users)
      .set({ oemId: null, dealershipId: null, showroomId: null })
      .where(eq(users.oemId, id));
    
    // 3. Get all dealerships for this OEM
    const oemDealerships = await db.select({ id: dealerships.id }).from(dealerships).where(eq(dealerships.oemId, id));
    
    // 4. Delete showrooms for each dealership
    for (const dealership of oemDealerships) {
      await db.delete(showrooms).where(eq(showrooms.dealershipId, dealership.id));
    }
    
    // 5. Delete all dealerships for this OEM
    await db.delete(dealerships).where(eq(dealerships.oemId, id));
    
    // 6. Delete all vehicle models and their variants for this OEM
    const oemModels = await db.select({ id: vehicleModels.id }).from(vehicleModels).where(eq(vehicleModels.oemId, id));
    for (const model of oemModels) {
      await db.delete(vehicleVariants).where(eq(vehicleVariants.modelId, model.id));
    }
    await db.delete(vehicleModels).where(eq(vehicleModels.oemId, id));
    
    // 7. Finally delete the OEM itself
    const result = await db
      .delete(oems)
      .where(eq(oems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Dealership Management
  async getDealerships(oemId?: string): Promise<any[]> {
    const query = db.select().from(dealerships);
    if (oemId) {
      return await query.where(eq(dealerships.oemId, oemId));
    }
    return await query;
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
    
    // Delete the dealership
    const result = await db
      .delete(dealerships)
      .where(eq(dealerships.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Showroom Management
  async getShowrooms(dealershipId?: string, oemId?: string): Promise<any[]> {
    let showroomsList;
    
    if (dealershipId) {
      showroomsList = await db.select().from(showrooms).where(eq(showrooms.dealershipId, dealershipId));
    } else if (oemId) {
      // Get showrooms for all dealerships under this OEM
      const oemDealerships = await db.select({ id: dealerships.id }).from(dealerships).where(eq(dealerships.oemId, oemId));
      
      if (oemDealerships.length === 0) return [];
      
      // Get all showrooms for these dealerships using individual queries (simpler and safer)
      const allShowrooms = [];
      for (const dealership of oemDealerships) {
        const dealershipShowrooms = await db.select().from(showrooms).where(eq(showrooms.dealershipId, dealership.id));
        allShowrooms.push(...dealershipShowrooms);
      }
      showroomsList = allShowrooms;
    } else {
      showroomsList = await db.select().from(showrooms);
    }
    
    // Add counts for each showroom
    const showroomsWithCounts = await Promise.all(
      showroomsList.map(async (showroom) => {
        // Count sales staff (users) for this showroom
        const staffCount = await db.select().from(users).where(eq(users.showroomId, showroom.id));
        
        // Count work orders for this showroom (when work_orders table exists)
        let workOrdersCount = 0;
        try {
          // This might fail if work_orders table doesn't exist yet
          const showroomOrders = await db.select().from(workOrders).where(eq(workOrders.showroomId, showroom.id));
          workOrdersCount = showroomOrders.length;
        } catch (e) {
          // Table doesn't exist yet, keep count as 0
        }
        
        return {
          ...showroom,
          salesStaffCount: staffCount.length,
          workOrdersCount
        };
      })
    );
    
    return showroomsWithCounts;
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
    showroomId?: string; 
    partnerId?: string; 
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    // Simple query first, then manually populate related data
    let query = db.select().from(workOrders);
    
    const conditions = [];
    if (filters?.oemId) conditions.push(eq(workOrders.oemId, filters.oemId));
    if (filters?.showroomId) conditions.push(eq(workOrders.showroomId, filters.showroomId));
    if (filters?.partnerId) conditions.push(eq(workOrders.assignedPartnerId, filters.partnerId));
    if (filters?.status) conditions.push(eq(workOrders.status, filters.status as any));

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
          enriched.vehicleModelBrand = vehicleModel[0].brand;
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

    } catch (error) {
      console.error("Error enriching work order data:", error);
    }
    
    return enriched;
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
    limit?: number;
    offset?: number;
  }): Promise<JobCard[]> {
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

  async getPartners(filters?: { oemId?: string; type?: string }): Promise<Partner[]> {
    let query = db.select().from(partners).where(eq(partners.active, true));
    
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
  }): Promise<any[]> {
    let query = db.select({
      id: pricingRules.id,
      pricingType: pricingRules.pricingType,
      partnerId: pricingRules.partnerId,
      scope: pricingRules.scope,
      scopeId: pricingRules.scopeId,
      dealershipId: pricingRules.dealershipId,
      detailerId: pricingRules.detailerId,
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
      vehicleModelName: vehicleModels.modelName,
      serviceName: services.name,
      serviceCategoryName: serviceCategories.name,
      detailerName: partners.displayName,
    })
    .from(pricingRules)
    .leftJoin(dealerships, eq(pricingRules.dealershipId, dealerships.id))
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
        // When no pricing rule found, create payout with NEEDS_REVIEW status
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
              status: 'NEEDS_REVIEW',
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
              status: 'NEEDS_REVIEW',
              createdAt: new Date()
            });
        }

        return { success: true, message: 'No pricing rule found - payout marked as NEEDS_REVIEW', amount: '0.00' };
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

  async getDashboardMetrics(oemId: string, showroomId?: string): Promise<{
    activeWorkOrders: number;
    pendingApprovals: number;
    thisMonthRevenue: number;
    avgTAT: number;
  }> {
    const conditions = [eq(workOrders.oemId, oemId)];
    if (showroomId) {
      conditions.push(eq(workOrders.showroomId, showroomId));
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

    // This month revenue (placeholder - would need more complex calculation)
    const [revenueResult] = await db
      .select({ total: sum(payouts.netAmount) })
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
      avgTAT: 3.2 // Placeholder calculation
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

    // Add service categories to each allocation's partner
    return allocationsWithPartners.map(allocation => ({
      ...allocation,
      partner: {
        ...allocation.partner,
        serviceCategories: partnerCategoriesMap.get(allocation.partnerId) || []
      }
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

  async createAllocation(allocation: any): Promise<any> {
    // Business rule: Check if there's already an active allocation for this dealership/showroom
    const existingAllocation = await db
      .select()
      .from(allocations)
      .where(and(
        eq(allocations.levelId, allocation.levelId),
        eq(allocations.level, allocation.level),
        eq(allocations.active, true)
      ));

    if (existingAllocation.length > 0) {
      throw new Error(`This ${allocation.level.toLowerCase()} already has an active allocation. Please remove the existing allocation first.`);
    }

    const [newAllocation] = await db
      .insert(allocations)
      .values({
        level: allocation.level,
        levelId: allocation.levelId,
        partnerId: allocation.partnerId,
        priority: allocation.priority || 1,
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
}

export const storage = new DatabaseStorage();
