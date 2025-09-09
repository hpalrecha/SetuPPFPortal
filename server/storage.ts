import { 
  users, 
  oems,
  dealerships,
  showrooms,
  salesPersons,
  partners,
  allocations,
  vehicleModels,
  vehicleVariants,
  services,
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
  type InsertVehicleVariant
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, count, avg, sum } from "drizzle-orm";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;

  // OEM management
  getOems(): Promise<Oem[]>;
  getOem(id: string): Promise<Oem | undefined>;
  createOem(oem: InsertOem): Promise<Oem>;

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
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<JobCard[]>;
  getJobCard(id: string): Promise<JobCard | undefined>;
  createJobCard(jobCard: InsertJobCard): Promise<JobCard>;
  updateJobCard(id: string, updates: Partial<InsertJobCard>): Promise<JobCard | undefined>;

  // Partner management
  getPartners(filters?: { oemId?: string }): Promise<Partner[]>;
  getPartner(id: string): Promise<Partner | undefined>;
  createPartner(partner: InsertPartner): Promise<Partner>;
  updatePartner(id: string, updates: Partial<InsertPartner>): Promise<Partner | undefined>;

  // Pricing Rules
  getPricingRules(filters?: { partnerId?: string; scopeId?: string }): Promise<PricingRule[]>;
  createPricingRule(rule: InsertPricingRule): Promise<PricingRule>;
  updatePricingRule(id: string, updates: Partial<InsertPricingRule>): Promise<PricingRule | undefined>;

  // Commission Rules
  getCommissionRules(filters?: { showroomId?: string }): Promise<CommissionRule[]>;
  createCommissionRule(rule: InsertCommissionRule): Promise<CommissionRule>;
  updateCommissionRule(id: string, updates: Partial<InsertCommissionRule>): Promise<CommissionRule | undefined>;


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

  // Dashboard metrics
  getDashboardMetrics(oemId: string, showroomId?: string): Promise<{
    activeWorkOrders: number;
    pendingApprovals: number;
    thisMonthRevenue: number;
    avgTAT: number;
  }>;

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

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
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
    const result = await db
      .delete(oems)
      .where(eq(oems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getWorkOrders(filters?: { 
    oemId?: string; 
    showroomId?: string; 
    partnerId?: string; 
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<WorkOrder[]> {
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

    return await query;
  }

  async getWorkOrder(id: string): Promise<WorkOrder | undefined> {
    const [workOrder] = await db.select().from(workOrders).where(eq(workOrders.id, id));
    return workOrder || undefined;
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
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<JobCard[]> {
    let query = db.select().from(jobCards);
    
    const conditions = [];
    if (filters?.partnerId) conditions.push(eq(jobCards.partnerId, filters.partnerId));
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

  async getPartners(filters?: { oemId?: string }): Promise<Partner[]> {
    return await db.select().from(partners).where(eq(partners.active, true));
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

  async updatePartner(id: string, updates: Partial<InsertPartner>): Promise<Partner | undefined> {
    const [partner] = await db
      .update(partners)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(partners.id, id))
      .returning();
    return partner || undefined;
  }

  async getPricingRules(filters?: { partnerId?: string; scopeId?: string }): Promise<PricingRule[]> {
    let query = db.select().from(pricingRules);
    
    const conditions = [eq(pricingRules.status, "ACTIVE")];
    if (filters?.partnerId) conditions.push(eq(pricingRules.partnerId, filters.partnerId));
    if (filters?.scopeId) conditions.push(eq(pricingRules.scopeId, filters.scopeId));

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

  async getCommissionRules(filters?: { showroomId?: string }): Promise<CommissionRule[]> {
    let query = db.select().from(commissionRules);
    
    const conditions = [eq(commissionRules.status, "ACTIVE")];
    if (filters?.showroomId) conditions.push(eq(commissionRules.showroomId, filters.showroomId));

    return await query.where(and(...conditions));
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

  // Vehicle Model methods
  async getVehicleModels(filters?: { oemId?: string }): Promise<VehicleModel[]> {
    let query = db.select().from(vehicleModels).where(eq(vehicleModels.active, true));
    
    if (filters?.oemId) {
      query = query.where(and(eq(vehicleModels.active, true), eq(vehicleModels.oemId, filters.oemId)));
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
    let query = db.select().from(vehicleVariants).where(eq(vehicleVariants.active, true));
    
    if (filters?.modelId) {
      query = query.where(and(eq(vehicleVariants.active, true), eq(vehicleVariants.modelId, filters.modelId)));
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
