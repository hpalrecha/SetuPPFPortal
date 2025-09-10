import { storage } from '../storage';
import { db } from '../db';
import { pricingRules, partners, vehicleModels, services } from '@shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

export interface PricingResolutionParams {
  partnerId: string;
  showroomId?: string;
  dealershipId?: string;
  vehicleModelId?: string;
  serviceId: string;
}

export interface DealershipPricingParams {
  dealershipId: string;
  serviceId: string;
  vehicleModelId?: string;
}

export interface DetailerPricingParams {
  detailerId: string; // User ID of detailer/installer
  serviceId: string;
  vehicleModelId?: string;
}

export interface ResolvedPricing {
  priceAmount: string;
  currency: string;
  ruleId: string;
  resolutionPath: string;
}

export class PricingService {
  
  /**
   * Get dealership pricing for a specific service and vehicle
   * Used when dealership creates work orders to show them the price they'll be charged
   */
  async getDealershipPricing(params: DealershipPricingParams): Promise<ResolvedPricing> {
    const { dealershipId, serviceId, vehicleModelId } = params;

    // Try exact match: Dealership + Service + Vehicle Model
    if (vehicleModelId) {
      const rule = await this.findPricingRule({
        pricingType: 'DEALERSHIP_PRICING',
        dealershipId,
        serviceId,
        vehicleModelId
      });
      if (rule) {
        return {
          priceAmount: rule.priceAmount,
          currency: rule.currency,
          ruleId: rule.id,
          resolutionPath: 'DEALERSHIP+SERVICE+VEHICLE'
        };
      }
    }

    // Try Dealership + Service
    const rule = await this.findPricingRule({
      pricingType: 'DEALERSHIP_PRICING',
      dealershipId,
      serviceId
    });
    if (rule) {
      return {
        priceAmount: rule.priceAmount,
        currency: rule.currency,
        ruleId: rule.id,
        resolutionPath: 'DEALERSHIP+SERVICE'
      };
    }

    throw new Error('No dealership pricing rule found for the given parameters');
  }

  /**
   * Get detailer/installer pricing for a specific service and vehicle
   * Used to show detailers how much they'll earn for completing a job
   */
  async getDetailerPricing(params: DetailerPricingParams): Promise<ResolvedPricing> {
    const { detailerId, serviceId, vehicleModelId } = params;

    // Try exact match: Detailer + Service + Vehicle Model
    if (vehicleModelId) {
      const rule = await this.findPricingRule({
        pricingType: 'DETAILER_PRICING',
        detailerId,
        serviceId,
        vehicleModelId
      });
      if (rule) {
        return {
          priceAmount: rule.priceAmount,
          currency: rule.currency,
          ruleId: rule.id,
          resolutionPath: 'DETAILER+SERVICE+VEHICLE'
        };
      }
    }

    // Try Detailer + Service
    const rule = await this.findPricingRule({
      pricingType: 'DETAILER_PRICING',
      detailerId,
      serviceId
    });
    if (rule) {
      return {
        priceAmount: rule.priceAmount,
        currency: rule.currency,
        ruleId: rule.id,
        resolutionPath: 'DETAILER+SERVICE'
      };
    }

    throw new Error('No detailer pricing rule found for the given parameters');
  }
  /**
   * Resolve pricing based on hierarchical rules:
   * 1. Partner + Showroom + Vehicle Model + Service (most specific)
   * 2. Partner + Showroom + Service
   * 3. Partner + Dealership + Vehicle Model + Service
   * 4. Partner + Dealership + Service (least specific)
   */
  async resolvePricing(params: PricingResolutionParams): Promise<ResolvedPricing> {
    const { partnerId, showroomId, dealershipId, vehicleModelId, serviceId } = params;

    // Try exact match: Partner + Showroom + Vehicle Model + Service
    if (showroomId && vehicleModelId) {
      const rule = await this.findPricingRule({
        pricingType: 'PARTNER_PRICING',
        partnerId,
        scope: 'SHOWROOM',
        scopeId: showroomId,
        vehicleModelId,
        serviceId
      });
      if (rule) {
        return {
          priceAmount: rule.priceAmount,
          currency: rule.currency || 'INR',
          ruleId: rule.id,
          resolutionPath: 'PARTNER+SHOWROOM+VEHICLE+SERVICE'
        };
      }
    }

    // Try Partner + Showroom + Service
    if (showroomId) {
      const rule = await this.findPricingRule({
        pricingType: 'PARTNER_PRICING',
        partnerId,
        scope: 'SHOWROOM',
        scopeId: showroomId,
        serviceId
      });
      if (rule) {
        return {
          priceAmount: rule.priceAmount,
          currency: rule.currency || 'INR',
          ruleId: rule.id,
          resolutionPath: 'PARTNER+SHOWROOM+SERVICE'
        };
      }
    }

    // Try Partner + Dealership + Vehicle Model + Service
    if (dealershipId && vehicleModelId) {
      const rule = await this.findPricingRule({
        pricingType: 'PARTNER_PRICING',
        partnerId,
        scope: 'DEALERSHIP',
        scopeId: dealershipId,
        vehicleModelId,
        serviceId
      });
      if (rule) {
        return {
          priceAmount: rule.priceAmount,
          currency: rule.currency || 'INR',
          ruleId: rule.id,
          resolutionPath: 'PARTNER+DEALERSHIP+VEHICLE+SERVICE'
        };
      }
    }

    // Try Partner + Dealership + Service
    if (dealershipId) {
      const rule = await this.findPricingRule({
        pricingType: 'PARTNER_PRICING',
        partnerId,
        scope: 'DEALERSHIP',
        scopeId: dealershipId,
        serviceId
      });
      if (rule) {
        return {
          priceAmount: rule.priceAmount,
          currency: rule.currency || 'INR',
          ruleId: rule.id,
          resolutionPath: 'PARTNER+DEALERSHIP+SERVICE'
        };
      }
    }

    throw new Error('No pricing rule found for the given parameters');
  }

  private async findPricingRule(criteria: {
    pricingType: 'PARTNER_PRICING' | 'DEALERSHIP_PRICING' | 'DETAILER_PRICING';
    partnerId?: string;
    scope?: 'DEALERSHIP' | 'SHOWROOM';
    scopeId?: string;
    dealershipId?: string;
    detailerId?: string;
    vehicleModelId?: string;
    serviceId: string;
  }): Promise<any> {
    const conditions = [
      eq(pricingRules.status, "ACTIVE"),
      eq(pricingRules.pricingType, criteria.pricingType),
      eq(pricingRules.serviceId, criteria.serviceId),
      sql`${pricingRules.effectiveFrom} <= NOW()`,
      sql`(${pricingRules.effectiveTo} IS NULL OR ${pricingRules.effectiveTo} > NOW())`
    ];

    // Add type-specific conditions
    if (criteria.pricingType === 'PARTNER_PRICING') {
      if (criteria.partnerId) conditions.push(eq(pricingRules.partnerId, criteria.partnerId));
      if (criteria.scope) conditions.push(eq(pricingRules.scope, criteria.scope));
      if (criteria.scopeId) conditions.push(eq(pricingRules.scopeId, criteria.scopeId));
    } else if (criteria.pricingType === 'DEALERSHIP_PRICING') {
      if (criteria.dealershipId) conditions.push(eq(pricingRules.dealershipId, criteria.dealershipId));
    } else if (criteria.pricingType === 'DETAILER_PRICING') {
      if (criteria.detailerId) conditions.push(eq(pricingRules.detailerId, criteria.detailerId));
    }

    if (criteria.vehicleModelId) {
      conditions.push(eq(pricingRules.vehicleModelId, criteria.vehicleModelId));
    } else {
      conditions.push(sql`${pricingRules.vehicleModelId} IS NULL`);
    }

    const [rule] = await db
      .select()
      .from(pricingRules)
      .where(and(...conditions))
      .orderBy(desc(pricingRules.effectiveFrom))
      .limit(1);

    return rule;
  }
  
  private async findRule(criteria: {
    partnerId: string;
    scope: 'SHOWROOM' | 'DEALERSHIP';
    scopeId: string;
    serviceId: string;
    vehicleModelId?: string;
  }) {
    const conditions = [
      eq(pricingRules.partnerId, criteria.partnerId),
      eq(pricingRules.scope, criteria.scope),
      eq(pricingRules.scopeId, criteria.scopeId),
      eq(pricingRules.serviceId, criteria.serviceId),
      eq(pricingRules.status, 'ACTIVE'),
      sql`${pricingRules.effectiveFrom} <= NOW()`,
      sql`(${pricingRules.effectiveTo} IS NULL OR ${pricingRules.effectiveTo} > NOW())`
    ];

    if (criteria.vehicleModelId) {
      conditions.push(eq(pricingRules.vehicleModelId, criteria.vehicleModelId));
    } else {
      conditions.push(sql`${pricingRules.vehicleModelId} IS NULL`);
    }

    const [rule] = await db
      .select()
      .from(pricingRules)
      .where(and(...conditions))
      .orderBy(desc(pricingRules.effectiveFrom))
      .limit(1);

    return rule;
  }

  /**
   * Create pricing snapshot for job card approval
   */
  async createPricingSnapshot(workOrderId: string): Promise<any> {
    // This would get work order details and resolve pricing
    const workOrder = await storage.getWorkOrder(workOrderId);
    if (!workOrder) {
      throw new Error('Work order not found');
    }

    const pricing = await this.resolvePricing({
      partnerId: workOrder.assignedPartnerId!,
      showroomId: workOrder.showroomId,
      dealershipId: workOrder.dealershipId,
      vehicleModelId: workOrder.vehicleModelId,
      serviceId: workOrder.serviceId
    });

    return {
      workOrderId,
      partnerId: workOrder.assignedPartnerId,
      serviceId: workOrder.serviceId,
      vehicleModelId: workOrder.vehicleModelId,
      quantity: workOrder.quantity,
      unitPrice: pricing.priceAmount,
      totalPrice: (parseFloat(pricing.priceAmount) * workOrder.quantity!).toString(),
      currency: pricing.currency,
      pricingRuleId: pricing.ruleId,
      resolutionPath: pricing.resolutionPath,
      snapshotAt: new Date().toISOString()
    };
  }
}

export const pricingService = new PricingService();
