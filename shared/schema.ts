import { sql } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  uuid, 
  timestamp, 
  integer, 
  decimal, 
  boolean, 
  jsonb,
  pgEnum
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum('user_role', [
  'SUPER_ADMIN',
  'OEM_ADMIN', 
  'DEALERSHIP_ADMIN',
  'SHOWROOM_MANAGER',
  'SALES_PERSON',
  'PARTNER_ADMIN',
  'PARTNER_STAFF'
]);

export const partnerTypeEnum = pgEnum('partner_type', ['STUDIO', 'INSTALLER']);

export const workOrderStatusEnum = pgEnum('work_order_status', [
  'DRAFT',
  'SUBMITTED', 
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED_PENDING_APPROVAL',
  'APPROVED',
  'CLOSED',
  'CANCELLED',
  'REWORK_REQUESTED'
]);

export const jobCardStatusEnum = pgEnum('job_card_status', [
  'AWAITING_ACK',
  'ACKNOWLEDGED',
  'SCHEDULED',
  'IN_PROGRESS', 
  'COMPLETED',
  'PENDING_APPROVAL',
  'APPROVED',
  'CLOSED',
  'NO_SHOW',
  'CANCELLED_BY_CUSTOMER',
  'PARTS_PENDING',
  'RESCHEDULED',
  'REWORK_REQUESTED'
]);

export const allocationLevelEnum = pgEnum('allocation_level', ['DEALERSHIP', 'SHOWROOM']);
export const commissionTypeEnum = pgEnum('commission_type', ['PERCENT', 'AMOUNT']);

export const pricingTypeEnum = pgEnum('pricing_type', [
  'PARTNER_PRICING',     // What partner charges for services (existing)
  'DEALERSHIP_PRICING',  // What dealership is charged for services
  'DETAILER_PRICING'     // What detailer/installer earns for completing jobs
]);

export const scopeEnum = pgEnum('scope', ['DEALERSHIP', 'SHOWROOM']);

// Core Organization Tables
export const oems = pgTable("oems", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  brandCode: text("brand_code").notNull().unique(),
  logoUrl: text("logo_url"),
  contactPersonName: text("contact_person_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const dealerships = pgTable("dealerships", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  oemId: uuid("oem_id").references(() => oems.id).notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  contactPersonName: text("contact_person_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const showrooms = pgTable("showrooms", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  dealershipId: uuid("dealership_id").references(() => dealerships.id).notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  managerName: text("manager_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull(),
  oemId: uuid("oem_id").references(() => oems.id),
  dealershipId: uuid("dealership_id").references(() => dealerships.id),
  showroomId: uuid("showroom_id").references(() => showrooms.id),
  partnerId: uuid("partner_id"),
  isActive: boolean("is_active").default(true),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const salesPersons = pgTable("sales_persons", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  showroomId: uuid("showroom_id").references(() => showrooms.id).notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Partner Tables
export const partners = pgTable("partners", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  type: partnerTypeEnum("type").notNull(),
  displayName: text("display_name").notNull(),
  gstin: text("gstin"),
  pan: text("pan"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  phone: text("phone"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const partnerMembers = pgTable("partner_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: uuid("partner_id").references(() => partners.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  role: text("role").notNull(), // ADMIN, STAFF
  createdAt: timestamp("created_at").defaultNow()
});

export const allocations = pgTable("allocations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  level: allocationLevelEnum("level").notNull(),
  levelId: uuid("level_id").notNull(), // dealership_id or showroom_id
  partnerId: uuid("partner_id").references(() => partners.id).notNull(),
  priority: integer("priority").notNull(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Vehicle and Service Catalog  
export const vehicleModels = pgTable("vehicle_models", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  oemId: uuid("oem_id").references(() => oems.id).notNull(),
  modelName: text("model_name").notNull(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const vehicleVariants = pgTable("vehicle_variants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  modelId: uuid("model_id").references(() => vehicleModels.id).notNull(),
  variantName: text("variant_name").notNull(),
  fuelType: text("fuel_type"), // PETROL, DIESEL, ELECTRIC, HYBRID
  transmission: text("transmission"), // MANUAL, AUTOMATIC, CVT
  engineCapacity: text("engine_capacity"), // 1.2L, 1.5L, etc.
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const services = pgTable("services", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  productBrand: text("product_brand"), // Brand used for this service (e.g., 3M, XPEL, etc.)
  availabilityScope: text("availability_scope").default("GLOBAL"), // GLOBAL, OEM, DEALERSHIP, MULTIPLE
  oemId: uuid("oem_id").references(() => oems.id), // Required if scope is OEM or DEALERSHIP (legacy)
  dealershipId: uuid("dealership_id").references(() => dealerships.id), // Required if scope is DEALERSHIP (legacy)
  oemIds: text("oem_ids").array(), // Multiple OEM IDs for MULTIPLE scope
  dealershipIds: text("dealership_ids").array(), // Multiple dealership IDs for MULTIPLE scope
  active: boolean("active").default(true),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Pricing and Commission Rules
export const pricingRules = pgTable("pricing_rules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  pricingType: pricingTypeEnum("pricing_type").notNull().default('PARTNER_PRICING'),
  
  // For PARTNER_PRICING (existing functionality)
  partnerId: uuid("partner_id").references(() => partners.id),
  scope: scopeEnum("scope"),
  scopeId: uuid("scope_id"), // dealership_id or showroom_id for partner pricing
  
  // For DEALERSHIP_PRICING (Service + Vehicle Model + Dealership)
  dealershipId: uuid("dealership_id").references(() => dealerships.id),
  
  // For DETAILER_PRICING (Detailer + Service + Vehicle Model)
  detailerId: uuid("detailer_id").references(() => partners.id), // References partner with INSTALLER type
  
  // Common fields for all pricing types
  vehicleModelId: uuid("vehicle_model_id").references(() => vehicleModels.id),
  vehicleVariantId: uuid("vehicle_variant_id").references(() => vehicleVariants.id),
  serviceId: uuid("service_id").references(() => services.id).notNull(),
  priceAmount: decimal("price_amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("INR"),
  effectiveFrom: timestamp("effective_from").notNull(),
  effectiveTo: timestamp("effective_to"),
  status: text("status").default("ACTIVE"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const commissionRules = pgTable("commission_rules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  showroomId: uuid("showroom_id").references(() => showrooms.id).notNull(),
  salesPersonId: uuid("sales_person_id").references(() => salesPersons.id),
  serviceId: uuid("service_id").references(() => services.id),
  type: commissionTypeEnum("type").notNull(),
  valueNumeric: decimal("value_numeric", { precision: 10, scale: 2 }).notNull(),
  capAmount: decimal("cap_amount", { precision: 10, scale: 2 }),
  floorAmount: decimal("floor_amount", { precision: 10, scale: 2 }),
  effectiveFrom: timestamp("effective_from").notNull(),
  effectiveTo: timestamp("effective_to"),
  status: text("status").default("ACTIVE"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Work Execution
export const workOrders = pgTable("work_orders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  oemId: uuid("oem_id").references(() => oems.id).notNull(),
  dealershipId: uuid("dealership_id").references(() => dealerships.id).notNull(),
  showroomId: uuid("showroom_id").references(() => showrooms.id).notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id).notNull(),
  status: workOrderStatusEnum("status").default("DRAFT"),
  vehicleModelId: uuid("vehicle_model_id").references(() => vehicleModels.id).notNull(),
  vehicleVariantId: uuid("vehicle_variant_id").references(() => vehicleVariants.id),
  regNo: text("reg_no"),
  serviceId: uuid("service_id").references(() => services.id).notNull(),
  quantity: integer("quantity").default(1),
  notes: text("notes"),
  salesPersonId: uuid("sales_person_id").references(() => salesPersons.id),
  assignedPartnerId: uuid("assigned_partner_id").references(() => partners.id),
  assignedJobCardId: uuid("assigned_job_card_id"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  customerAddress: text("customer_address"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const jobCards = pgTable("job_cards", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  workOrderId: uuid("work_order_id").references(() => workOrders.id).notNull(),
  partnerId: uuid("partner_id").references(() => partners.id).notNull(),
  status: jobCardStatusEnum("status").default("AWAITING_ACK"),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  checklistJson: jsonb("checklist_json"),
  remarks: text("remarks"),
  approvalRequestedAt: timestamp("approval_requested_at"),
  approvedAt: timestamp("approved_at"),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
  pricingSnapshotJson: jsonb("pricing_snapshot_json"),
  commissionSnapshotJson: jsonb("commission_snapshot_json"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const jobCardMedia = pgTable("job_card_media", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobCardId: uuid("job_card_id").references(() => jobCards.id).notNull(),
  type: text("type").notNull(), // IMAGE, VIDEO
  url: text("url").notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at").defaultNow()
});

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobCardId: uuid("job_card_id").references(() => jobCards.id).notNull(),
  approverUserId: uuid("approver_user_id").references(() => users.id).notNull(),
  status: text("status").notNull(), // APPROVED, REJECTED, REWORK_REQUESTED
  remarks: text("remarks"),
  decidedAt: timestamp("decided_at").defaultNow()
});

// Money and Reporting
export const payouts = pgTable("payouts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobCardId: uuid("job_card_id").references(() => jobCards.id).notNull(),
  partnerId: uuid("partner_id").references(() => partners.id).notNull(),
  grossAmount: decimal("gross_amount", { precision: 10, scale: 2 }).notNull(),
  adjustmentsJson: jsonb("adjustments_json"),
  netAmount: decimal("net_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").default("PENDING"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow()
});

export const commissions = pgTable("commissions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobCardId: uuid("job_card_id").references(() => jobCards.id).notNull(),
  showroomId: uuid("showroom_id").references(() => showrooms.id).notNull(),
  salesPersonId: uuid("sales_person_id").references(() => salesPersons.id),
  basis: text("basis").notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  computedAmount: decimal("computed_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").default("PENDING"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow()
});

// System Tables
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(),
  diffJson: jsonb("diff_json"),
  createdAt: timestamp("created_at").defaultNow()
});

export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantScope: text("tenant_scope"),
  event: text("event").notNull(),
  targetUrl: text("target_url").notNull(),
  secret: text("secret"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
});

export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text("key").primaryKey(),
  firstSeenAt: timestamp("first_seen_at").defaultNow(),
  responseHash: text("response_hash")
});

// Relations
export const oemsRelations = relations(oems, ({ many }) => ({
  dealerships: many(dealerships),
  vehicleModels: many(vehicleModels),
  users: many(users),
  workOrders: many(workOrders)
}));

export const dealershipsRelations = relations(dealerships, ({ one, many }) => ({
  oem: one(oems, { fields: [dealerships.oemId], references: [oems.id] }),
  showrooms: many(showrooms),
  users: many(users),
  workOrders: many(workOrders)
}));

export const showroomsRelations = relations(showrooms, ({ one, many }) => ({
  dealership: one(dealerships, { fields: [showrooms.dealershipId], references: [dealerships.id] }),
  salesPersons: many(salesPersons),
  users: many(users),
  workOrders: many(workOrders),
  commissionRules: many(commissionRules),
  commissions: many(commissions)
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  oem: one(oems, { fields: [users.oemId], references: [oems.id] }),
  dealership: one(dealerships, { fields: [users.dealershipId], references: [dealerships.id] }),
  showroom: one(showrooms, { fields: [users.showroomId], references: [showrooms.id] }),
  createdWorkOrders: many(workOrders),
  approvedJobCards: many(jobCards),
  auditLogs: many(auditLogs),
  approvals: many(approvals)
}));

export const partnersRelations = relations(partners, ({ many }) => ({
  members: many(partnerMembers),
  allocations: many(allocations),
  pricingRules: many(pricingRules),
  workOrders: many(workOrders),
  jobCards: many(jobCards),
  payouts: many(payouts)
}));

export const vehicleModelsRelations = relations(vehicleModels, ({ one, many }) => ({
  oem: one(oems, { fields: [vehicleModels.oemId], references: [oems.id] }),
  variants: many(vehicleVariants),
  workOrders: many(workOrders),
  pricingRules: many(pricingRules)
}));

export const vehicleVariantsRelations = relations(vehicleVariants, ({ one, many }) => ({
  model: one(vehicleModels, { fields: [vehicleVariants.modelId], references: [vehicleModels.id] }),
  workOrders: many(workOrders),
  pricingRules: many(pricingRules)
}));

export const workOrdersRelations = relations(workOrders, ({ one, many }) => ({
  oem: one(oems, { fields: [workOrders.oemId], references: [oems.id] }),
  dealership: one(dealerships, { fields: [workOrders.dealershipId], references: [dealerships.id] }),
  showroom: one(showrooms, { fields: [workOrders.showroomId], references: [showrooms.id] }),
  createdBy: one(users, { fields: [workOrders.createdByUserId], references: [users.id] }),
  vehicleModel: one(vehicleModels, { fields: [workOrders.vehicleModelId], references: [vehicleModels.id] }),
  vehicleVariant: one(vehicleVariants, { fields: [workOrders.vehicleVariantId], references: [vehicleVariants.id] }),
  service: one(services, { fields: [workOrders.serviceId], references: [services.id] }),
  salesPerson: one(salesPersons, { fields: [workOrders.salesPersonId], references: [salesPersons.id] }),
  assignedPartner: one(partners, { fields: [workOrders.assignedPartnerId], references: [partners.id] }),
  jobCards: many(jobCards)
}));

export const jobCardsRelations = relations(jobCards, ({ one, many }) => ({
  workOrder: one(workOrders, { fields: [jobCards.workOrderId], references: [workOrders.id] }),
  partner: one(partners, { fields: [jobCards.partnerId], references: [partners.id] }),
  approvedBy: one(users, { fields: [jobCards.approvedByUserId], references: [users.id] }),
  media: many(jobCardMedia),
  approvals: many(approvals),
  payouts: many(payouts),
  commissions: many(commissions)
}));

// Insert and Select Schemas
export const insertOemSchema = createInsertSchema(oems).omit({ id: true, createdAt: true, updatedAt: true });
export const selectOemSchema = createSelectSchema(oems);
export type InsertOem = z.infer<typeof insertOemSchema>;
export type Oem = z.infer<typeof selectOemSchema>;

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = z.infer<typeof selectUserSchema>;

export const insertWorkOrderSchema = createInsertSchema(workOrders).omit({ id: true, createdAt: true, updatedAt: true });
export const selectWorkOrderSchema = createSelectSchema(workOrders);
export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;
export type WorkOrder = z.infer<typeof selectWorkOrderSchema>;

export const insertJobCardSchema = createInsertSchema(jobCards).omit({ id: true, createdAt: true, updatedAt: true });
export const selectJobCardSchema = createSelectSchema(jobCards);
export type InsertJobCard = z.infer<typeof insertJobCardSchema>;
export type JobCard = z.infer<typeof selectJobCardSchema>;

export const insertPartnerSchema = createInsertSchema(partners).omit({ id: true, createdAt: true, updatedAt: true });
export const selectPartnerSchema = createSelectSchema(partners);
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Partner = z.infer<typeof selectPartnerSchema>;

export const insertPricingRuleSchema = createInsertSchema(pricingRules).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  effectiveFrom: z.string().or(z.date()).transform((val) => typeof val === 'string' ? new Date(val) : val),
  effectiveTo: z.string().or(z.date()).transform((val) => val ? (typeof val === 'string' ? new Date(val) : val) : null).optional(),
});
export const selectPricingRuleSchema = createSelectSchema(pricingRules);
export type InsertPricingRule = z.infer<typeof insertPricingRuleSchema>;
export type PricingRule = z.infer<typeof selectPricingRuleSchema>;

export const insertCommissionRuleSchema = createInsertSchema(commissionRules).omit({ id: true, createdAt: true, updatedAt: true });
export const selectCommissionRuleSchema = createSelectSchema(commissionRules);
export type InsertCommissionRule = z.infer<typeof insertCommissionRuleSchema>;
export type CommissionRule = z.infer<typeof selectCommissionRuleSchema>;

export const insertVehicleModelSchema = createInsertSchema(vehicleModels).omit({ id: true, createdAt: true, updatedAt: true });
export const selectVehicleModelSchema = createSelectSchema(vehicleModels);
export type InsertVehicleModel = z.infer<typeof insertVehicleModelSchema>;
export type VehicleModel = z.infer<typeof selectVehicleModelSchema>;

export const insertVehicleVariantSchema = createInsertSchema(vehicleVariants).omit({ id: true, createdAt: true, updatedAt: true });
export const selectVehicleVariantSchema = createSelectSchema(vehicleVariants);
export type InsertVehicleVariant = z.infer<typeof insertVehicleVariantSchema>;
export type VehicleVariant = z.infer<typeof selectVehicleVariantSchema>;

export const insertServiceSchema = createInsertSchema(services).omit({ id: true, createdAt: true, updatedAt: true });
export const selectServiceSchema = createSelectSchema(services);
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = z.infer<typeof selectServiceSchema>;
