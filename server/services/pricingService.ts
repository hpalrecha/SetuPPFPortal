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
      currency: rule.currency || 'INR',
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
    if (rule.partnerId && rule.scope && rule.scopeId) {
      const existingRules = await storage.getPricingRules({
        partnerId: rule.partnerId
      });

      const overlapping = existingRules.find((existing: any) => 
        existing.id !== rule.id &&
        existing.scope === rule.scope &&
        existing.scopeId === rule.scopeId &&
        existing.vehicleModelId === rule.vehicleModelId &&
        existing.status === 'ACTIVE' &&
        this.dateRangesOverlap(
          rule.effectiveFrom || new Date(),
          rule.effectiveTo || null,
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
    const pricingRules = await storage.getPricingRules({
      partnerId: filters.partnerId
    });

    const effectiveDate = filters.effectiveDate || new Date();

    return pricingRules.filter((rule: any) => {
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

  /**
   * Calculate estimated price for a work order based on DEALERSHIP_PRICING and OEM_PRICING rules
   * This is specifically for work order creation, not partner pricing
   * Hierarchy: DEALERSHIP_PRICING → OEM_PRICING
   */
  async calculateWorkOrderPrice(
    dealershipId: string,
    vehicleModelId: string,
    serviceId: string,
    quantity: number = 1,
    oemId?: string
  ): Promise<{ price: number; ruleFound: boolean; source?: string; rule?: any }> {
    try {
      console.log(`💰 Calculating work order price:`, {
        dealershipId,
        oemId,
        vehicleModelId,
        serviceId,
        quantity
      });

      // Priority 1: Look for DEALERSHIP_PRICING rule
      const dealershipRules = await storage.getPricingRules({
        pricingType: 'DEALERSHIP_PRICING',
        dealershipId
      });

      // Find rule that matches vehicle model and service
      const dealershipMatchingRule = dealershipRules.find(rule => 
        rule.vehicleModelId === vehicleModelId && 
        rule.serviceId === serviceId &&
        rule.status === 'ACTIVE'
      );

      if (dealershipMatchingRule) {
        const totalPrice = Number(dealershipMatchingRule.priceAmount) * quantity;
        
        console.log(`✅ Found dealership pricing rule:`, {
          ruleId: dealershipMatchingRule.id,
          priceAmount: dealershipMatchingRule.priceAmount,
          quantity,
          totalPrice
        });

        return {
          price: totalPrice,
          ruleFound: true,
          source: 'DEALERSHIP_PRICING',
          rule: dealershipMatchingRule
        };
      }

      console.log(`⚠️ No dealership pricing rule found, checking OEM pricing...`);

      // Priority 2: Fall back to OEM_PRICING rule if oemId is provided
      if (oemId) {
        const oemRules = await storage.getPricingRules({
          pricingType: 'OEM_PRICING',
          oemId
        });

        // Find rule that matches vehicle model and service
        const oemMatchingRule = oemRules.find(rule => 
          rule.vehicleModelId === vehicleModelId && 
          rule.serviceId === serviceId &&
          rule.status === 'ACTIVE'
        );

        if (oemMatchingRule) {
          const totalPrice = Number(oemMatchingRule.priceAmount) * quantity;
          
          console.log(`✅ Found OEM pricing rule (fallback):`, {
            ruleId: oemMatchingRule.id,
            priceAmount: oemMatchingRule.priceAmount,
            quantity,
            totalPrice
          });

          return {
            price: totalPrice,
            ruleFound: true,
            source: 'OEM_PRICING',
            rule: oemMatchingRule
          };
        }

        console.log(`❌ No OEM pricing rule found either`);
      }

      console.log(`❌ No pricing rule found for service ${serviceId} and vehicle ${vehicleModelId}`);
      
      return {
        price: 0,
        ruleFound: false,
        source: 'NO_RULE_FOUND'
      };

    } catch (error) {
      console.error('Error calculating work order price:', error);
      return {
        price: 0,
        ruleFound: false,
        source: 'ERROR'
      };
    }
  }
}

export const pricingService = new PricingService();
