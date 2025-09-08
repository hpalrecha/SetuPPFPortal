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

export interface ResolvedPricing {
  priceAmount: string;
  currency: string;
  ruleId: string;
  resolutionPath: string;
}

export class PricingService {
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
      const rule = await this.findRule({
        partnerId,
        scope: 'SHOWROOM',
        scopeId: showroomId,
        vehicleModelId,
        serviceId
      });
      if (rule) {
        return {
          priceAmount: rule.priceAmount,
          currency: rule.currency,
          ruleId: rule.id,
          resolutionPath: 'PARTNER+SHOWROOM+VEHICLE+SERVICE'
        };
      }
    }

    // Try Partner + Showroom + Service
    if (showroomId) {
      const rule = await this.findRule({
        partnerId,
        scope: 'SHOWROOM',
        scopeId: showroomId,
        serviceId
      });
      if (rule) {
        return {
          priceAmount: rule.priceAmount,
          currency: rule.currency,
          ruleId: rule.id,
          resolutionPath: 'PARTNER+SHOWROOM+SERVICE'
        };
      }
    }

    // Try Partner + Dealership + Vehicle Model + Service
    if (dealershipId && vehicleModelId) {
      const rule = await this.findRule({
        partnerId,
        scope: 'DEALERSHIP',
        scopeId: dealershipId,
        vehicleModelId,
        serviceId
      });
      if (rule) {
        return {
          priceAmount: rule.priceAmount,
          currency: rule.currency,
          ruleId: rule.id,
          resolutionPath: 'PARTNER+DEALERSHIP+VEHICLE+SERVICE'
        };
      }
    }

    // Try Partner + Dealership + Service
    if (dealershipId) {
      const rule = await this.findRule({
        partnerId,
        scope: 'DEALERSHIP',
        scopeId: dealershipId,
        serviceId
      });
      if (rule) {
        return {
          priceAmount: rule.priceAmount,
          currency: rule.currency,
          ruleId: rule.id,
          resolutionPath: 'PARTNER+DEALERSHIP+SERVICE'
        };
      }
    }

    throw new Error('No pricing rule found for the given parameters');
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
