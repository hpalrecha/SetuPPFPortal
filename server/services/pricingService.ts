import { storage } from '../storage';
import type { PricingRule } from '@shared/schema';

export class PricingService {
  async resolvePricing(
    partnerId: string,
    scopeType: 'SHOWROOM' | 'DEALERSHIP',
    scopeId: string,
    vehicleModelId?: string,
    serviceId?: string
  ): Promise<PricingRule | null> {
    // Try showroom level first if not already specified
    if (scopeType === 'DEALERSHIP') {
      // Get showrooms for this dealership and try each
      const showrooms = await storage.getShowrooms(scopeId);
      for (const showroom of showrooms) {
        const rule = await storage.resolvePricingRule(
          partnerId,
          'SHOWROOM',
          showroom.id,
          vehicleModelId,
          serviceId
        );
        if (rule) return rule;
      }
    }

    // Try the specified scope
    const rule = await storage.resolvePricingRule(
      partnerId,
      scopeType,
      scopeId,
      vehicleModelId,
      serviceId
    );

    if (rule) return rule;

    // If showroom level fails, try dealership level
    if (scopeType === 'SHOWROOM') {
      const showroom = await storage.getShowrooms();
      const targetShowroom = showroom.find(s => s.id === scopeId);
      if (targetShowroom) {
        const dealershipRule = await storage.resolvePricingRule(
          partnerId,
          'DEALERSHIP',
          targetShowroom.dealershipId,
          vehicleModelId,
          serviceId
        );
        if (dealershipRule) return dealershipRule;
      }
    }

    return null;
  }

  async calculatePrice(
    partnerId: string,
    scopeType: 'SHOWROOM' | 'DEALERSHIP',
    scopeId: string,
    vehicleModelId?: string,
    serviceId?: string,
    quantity: number = 1
  ): Promise<{ price: number; currency: string; rule?: PricingRule }> {
    const rule = await this.resolvePricing(partnerId, scopeType, scopeId, vehicleModelId, serviceId);
    
    if (!rule) {
      throw new Error(`No pricing rule found for partner ${partnerId}, scope ${scopeType}:${scopeId}, vehicle ${vehicleModelId}, service ${serviceId}`);
    }

    const basePrice = Number(rule.priceAmount);
    const totalPrice = basePrice * quantity;

    return {
      price: totalPrice,
      currency: rule.currency,
      rule
    };
  }

  async validatePricingRule(rule: Partial<PricingRule>): Promise<string[]> {
    const errors: string[] = [];

    if (!rule.partnerId) {
      errors.push('Partner is required');
    }

    if (!rule.scope || !rule.scopeId) {
      errors.push('Scope and scope ID are required');
    }

    if (!rule.serviceId) {
      errors.push('Service is required');
    }

    if (!rule.priceAmount || Number(rule.priceAmount) <= 0) {
      errors.push('Price amount must be greater than 0');
    }

    if (rule.effectiveTo && rule.effectiveFrom && new Date(rule.effectiveTo) <= new Date(rule.effectiveFrom)) {
      errors.push('Effective end date must be after start date');
    }

    // Check for overlapping rules
    if (rule.partnerId && rule.scope && rule.scopeId && rule.serviceId) {
      const existingRules = await storage.getPricingRules({
        partnerId: rule.partnerId,
        serviceId: rule.serviceId
      });

      const overlapping = existingRules.pricingRules.find(existing => 
        existing.id !== rule.id &&
        existing.scope === rule.scope &&
        existing.scopeId === rule.scopeId &&
        existing.vehicleModelId === rule.vehicleModelId &&
        existing.status === 'ACTIVE' &&
        this.dateRangesOverlap(
          rule.effectiveFrom || new Date(),
          rule.effectiveTo,
          existing.effectiveFrom,
          existing.effectiveTo
        )
      );

      if (overlapping) {
        errors.push('A pricing rule with overlapping effective dates already exists');
      }
    }

    return errors;
  }

  private dateRangesOverlap(
    start1: Date,
    end1: Date | null,
    start2: Date,
    end2: Date | null
  ): boolean {
    const effectiveEnd1 = end1 || new Date('2099-12-31');
    const effectiveEnd2 = end2 || new Date('2099-12-31');

    return start1 <= effectiveEnd2 && start2 <= effectiveEnd1;
  }

  async getEffectivePricingRules(filters: {
    partnerId?: string;
    scopeType?: string;
    scopeId?: string;
    serviceId?: string;
    vehicleModelId?: string;
    effectiveDate?: Date;
  }) {
    const { pricingRules } = await storage.getPricingRules({
      partnerId: filters.partnerId,
      serviceId: filters.serviceId
    });

    const effectiveDate = filters.effectiveDate || new Date();

    return pricingRules.filter(rule => {
      // Check scope match
      if (filters.scopeType && rule.scope !== filters.scopeType) return false;
      if (filters.scopeId && rule.scopeId !== filters.scopeId) return false;
      if (filters.vehicleModelId && rule.vehicleModelId !== filters.vehicleModelId) return false;

      // Check effective date range
      if (rule.effectiveFrom > effectiveDate) return false;
      if (rule.effectiveTo && rule.effectiveTo < effectiveDate) return false;

      return rule.status === 'ACTIVE';
    });
  }
}

export const pricingService = new PricingService();
