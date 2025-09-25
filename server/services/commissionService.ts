import { storage } from '../storage';
import type { CommissionRule } from '@shared/schema';

export class CommissionService {
  // 🔥 ROBUST COMMISSION CREATION - Works for any work order (existing or new)
  async createCommissionForWorkOrder(workOrderId: string): Promise<{ success: boolean; message: string; commissionId?: string }> {
    try {
      console.log(`🔥 REBUILDING COMMISSION for Work Order ${workOrderId}`);

      // Get work order details
      const workOrder = await storage.getWorkOrder(workOrderId);
      if (!workOrder) {
        return { success: false, message: 'Work order not found' };
      }

      // Must have salesperson to create commission
      if (!workOrder.salesPersonId || !workOrder.showroomId) {
        return { success: false, message: 'Work order missing salesperson or showroom - commission not applicable' };
      }

      // Check if commission already exists
      const existingCommissions = await storage.getCommissions({ workOrderId });
      if (existingCommissions.commissions.length > 0) {
        return { success: false, message: `Commission already exists for work order ${workOrderId}` };
      }

      console.log(`📊 Commission parameters:`, {
        workOrderId,
        showroomId: workOrder.showroomId,
        salesPersonId: workOrder.salesPersonId,
        serviceId: workOrder.serviceId || 'none'
      });

      // Find applicable commission rule using storage method
      const applicableRule = await storage.resolveCommissionRule(
        workOrder.oemId || '',
        workOrder.dealershipId || '',
        workOrder.showroomId,
        workOrder.salesPersonId,
        workOrder.serviceId
      );

      if (!applicableRule) {
        return { success: false, message: 'No applicable commission rule found' };
      }

      console.log(`💰 Found commission rule:`, {
        ruleId: applicableRule.id,
        type: applicableRule.type,
        value: applicableRule.valueNumeric,
        resolutionPath: applicableRule.resolutionPath || 'direct'
      });

      // Create commission record
      const commission = await storage.createCommission({
        workOrderId: workOrder.id,
        showroomId: workOrder.showroomId,
        salesPersonId: workOrder.salesPersonId,
        basis: applicableRule.type,
        value: Number(applicableRule.valueNumeric),
        computedAmount: 0, // Will be calculated when work order pricing is finalized
        status: 'PENDING'
      });

      console.log(`✅ Commission created successfully:`, {
        commissionId: commission.id,
        basis: commission.basis,
        value: commission.value,
        status: commission.status
      });

      return {
        success: true,
        message: `Commission created with ${commission.basis} rate of ${commission.value}${commission.basis === 'PERCENT' ? '%' : ''}`,
        commissionId: commission.id
      };

    } catch (error) {
      console.error(`❌ Failed to create commission for work order ${workOrderId}:`, error);
      return { success: false, message: `Error creating commission: ${error.message}` };
    }
  }

  async calculateCommission(
    showroomId: string,
    salesPersonId?: string,
    serviceId?: string,
    orderValue?: number,
    oemId?: string,
    dealershipId?: string,
    serviceCategoryId?: string
  ): Promise<{ amount: number; ruleFound: boolean; rule?: CommissionRule; calculation: any }> {
    // Get missing parameters if not provided - we need these for proper rule resolution
    let resolvedOemId = oemId;
    let resolvedDealershipId = dealershipId;
    let resolvedServiceCategoryId = serviceCategoryId;
    
    if (!resolvedOemId || !resolvedDealershipId) {
      // Get the organizational hierarchy from showroom
      const showroom = await storage.getShowroom(showroomId);
      if (showroom) {
        resolvedDealershipId = resolvedDealershipId || showroom.dealershipId;
        
        if (!resolvedOemId) {
          const dealership = await storage.getDealership(showroom.dealershipId);
          resolvedOemId = dealership?.oemId;
        }
      }
    }
    
    if (!resolvedServiceCategoryId && serviceId) {
      // Get service category from service
      const service = await storage.getService(serviceId);
      resolvedServiceCategoryId = service?.serviceCategoryId;
    }
    
    const rule = await storage.resolveCommissionRule(
      resolvedOemId, 
      resolvedDealershipId, 
      showroomId, 
      salesPersonId, 
      serviceId, 
      resolvedServiceCategoryId
    );

    if (!rule) {
      return {
        amount: 0,
        ruleFound: false,
        calculation: { reason: 'No applicable commission rule found' }
      };
    }

    let calculatedAmount = 0;
    const calculation: any = {
      ruleId: rule.id,
      type: rule.type,
      value: Number(rule.valueNumeric),
      orderValue
    };

    if (rule.type === 'PERCENT') {
      if (!orderValue) {
        throw new Error('Order value is required for percentage-based commission');
      }
      calculatedAmount = (orderValue * Number(rule.valueNumeric)) / 100;
      calculation.percentageApplied = Number(rule.valueNumeric);
    } else if (rule.type === 'AMOUNT') {
      calculatedAmount = Number(rule.valueNumeric);
    }

    // Apply floor and cap
    if (rule.floorAmount && calculatedAmount < Number(rule.floorAmount)) {
      calculatedAmount = Number(rule.floorAmount);
      calculation.floorApplied = true;
    }

    if (rule.capAmount && calculatedAmount > Number(rule.capAmount)) {
      calculatedAmount = Number(rule.capAmount);
      calculation.capApplied = true;
    }

    calculation.finalAmount = calculatedAmount;

    return {
      amount: calculatedAmount,
      ruleFound: true,
      rule,
      calculation
    };
  }

  async validateCommissionRule(rule: Partial<CommissionRule>): Promise<string[]> {
    const errors: string[] = [];

    if (!rule.showroomId) {
      errors.push('Showroom is required');
    }

    if (!rule.type) {
      errors.push('Commission type is required');
    }

    if (!rule.valueNumeric || Number(rule.valueNumeric) <= 0) {
      errors.push('Commission value must be greater than 0');
    }

    if (rule.type === 'PERCENT' && Number(rule.valueNumeric) > 100) {
      errors.push('Percentage commission cannot exceed 100%');
    }

    if (rule.floorAmount && rule.capAmount && Number(rule.floorAmount) > Number(rule.capAmount)) {
      errors.push('Floor amount cannot be greater than cap amount');
    }

    if (rule.effectiveTo && rule.effectiveFrom && new Date(rule.effectiveTo) <= new Date(rule.effectiveFrom)) {
      errors.push('Effective end date must be after start date');
    }

    // Check for overlapping rules
    if (rule.showroomId) {
      const existingRules = await storage.getCommissionRules({
        showroomId: rule.showroomId,
        salesPersonId: rule.salesPersonId,
        serviceId: rule.serviceId
      });

      const overlapping = existingRules.commissionRules.find(existing => 
        existing.id !== rule.id &&
        existing.status === 'ACTIVE' &&
        this.dateRangesOverlap(
          rule.effectiveFrom || new Date(),
          rule.effectiveTo,
          existing.effectiveFrom,
          existing.effectiveTo
        )
      );

      if (overlapping) {
        errors.push('A commission rule with overlapping effective dates already exists');
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

  async getCommissionEarnings(filters: {
    salesPersonId?: string;
    showroomId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const { commissions } = await storage.getCommissions({
      salesPersonId: filters.salesPersonId,
      showroomId: filters.showroomId
    });

    let filteredCommissions = commissions;

    if (filters.startDate) {
      filteredCommissions = filteredCommissions.filter(c => 
        c.createdAt >= filters.startDate!
      );
    }

    if (filters.endDate) {
      filteredCommissions = filteredCommissions.filter(c => 
        c.createdAt <= filters.endDate!
      );
    }

    const totalEarnings = filteredCommissions.reduce((sum, commission) => 
      sum + Number(commission.computedAmount), 0
    );

    const paidEarnings = filteredCommissions
      .filter(c => c.status === 'PAID')
      .reduce((sum, commission) => sum + Number(commission.computedAmount), 0);

    const pendingEarnings = totalEarnings - paidEarnings;

    return {
      totalEarnings,
      paidEarnings,
      pendingEarnings,
      commissionCount: filteredCommissions.length,
      commissions: filteredCommissions
    };
  }

  async processCommissionPayment(commissionId: string): Promise<void> {
    await storage.updateCommission(commissionId, {
      status: 'PAID',
      paidAt: new Date()
    });
  }

  async bulkProcessCommissionPayments(commissionIds: string[]): Promise<void> {
    for (const id of commissionIds) {
      await this.processCommissionPayment(id);
    }
  }

  async getCommissionAnalytics(filters: {
    oemId?: string;
    dealershipId?: string;
    showroomId?: string;
    period: 'daily' | 'weekly' | 'monthly' | 'yearly';
    startDate: Date;
    endDate: Date;
  }) {
    // This would typically use more complex SQL queries
    // For now, we'll implement basic analytics
    
    const { commissions } = await storage.getCommissions({
      showroomId: filters.showroomId
    });

    const filteredCommissions = commissions.filter(c => 
      c.createdAt >= filters.startDate && c.createdAt <= filters.endDate
    );

    const analytics = {
      totalCommissions: filteredCommissions.length,
      totalAmount: filteredCommissions.reduce((sum, c) => sum + Number(c.computedAmount), 0),
      averageCommission: 0,
      topEarners: [] as any[],
      commissionByPeriod: [] as any[]
    };

    analytics.averageCommission = analytics.totalCommissions > 0 
      ? analytics.totalAmount / analytics.totalCommissions 
      : 0;

    // Group by sales person for top earners
    const earningsBySalesPerson = new Map<string, number>();
    filteredCommissions.forEach(commission => {
      if (commission.salesPersonId) {
        const current = earningsBySalesPerson.get(commission.salesPersonId) || 0;
        earningsBySalesPerson.set(commission.salesPersonId, current + Number(commission.computedAmount));
      }
    });

    analytics.topEarners = Array.from(earningsBySalesPerson.entries())
      .map(([salesPersonId, amount]) => ({ salesPersonId, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return analytics;
  }
}

export const commissionService = new CommissionService();
