import { storage } from '../storage';
import { db } from '../db';
import { commissionRules } from '@shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

export interface CommissionResolutionParams {
  showroomId: string;
  salesPersonId?: string;
  serviceId?: string;
}

export interface ResolvedCommission {
  type: 'PERCENT' | 'AMOUNT';
  value: string;
  capAmount?: string;
  floorAmount?: string;
  ruleId: string;
  resolutionPath: string;
}

export interface CommissionCalculationParams {
  grossAmount: number;
  commission: ResolvedCommission;
}

export interface CalculatedCommission {
  basis: string;
  value: string;
  computedAmount: string;
  capApplied: boolean;
  floorApplied: boolean;
}

export class CommissionService {
  /**
   * Resolve commission rules based on hierarchy:
   * 1. Showroom + Sales Person + Service (most specific)
   * 2. Showroom + Sales Person
   * 3. Showroom + Service
   * 4. Showroom default (least specific)
   */
  async resolveCommission(params: CommissionResolutionParams): Promise<ResolvedCommission | null> {
    const { showroomId, salesPersonId, serviceId } = params;

    // Try exact match: Showroom + Sales Person + Service
    if (salesPersonId && serviceId) {
      const rule = await this.findRule({
        showroomId,
        salesPersonId,
        serviceId
      });
      if (rule) {
        return {
          type: rule.type,
          value: rule.valueNumeric,
          capAmount: rule.capAmount || undefined,
          floorAmount: rule.floorAmount || undefined,
          ruleId: rule.id,
          resolutionPath: 'SHOWROOM+SALESPERSON+SERVICE'
        };
      }
    }

    // Try Showroom + Sales Person
    if (salesPersonId) {
      const rule = await this.findRule({
        showroomId,
        salesPersonId
      });
      if (rule) {
        return {
          type: rule.type,
          value: rule.valueNumeric,
          capAmount: rule.capAmount || undefined,
          floorAmount: rule.floorAmount || undefined,
          ruleId: rule.id,
          resolutionPath: 'SHOWROOM+SALESPERSON'
        };
      }
    }

    // Try Showroom + Service
    if (serviceId) {
      const rule = await this.findRule({
        showroomId,
        serviceId
      });
      if (rule) {
        return {
          type: rule.type,
          value: rule.valueNumeric,
          capAmount: rule.capAmount || undefined,
          floorAmount: rule.floorAmount || undefined,
          ruleId: rule.id,
          resolutionPath: 'SHOWROOM+SERVICE'
        };
      }
    }

    // Try Showroom default
    const rule = await this.findRule({
      showroomId
    });
    if (rule) {
      return {
        type: rule.type,
        value: rule.valueNumeric,
        capAmount: rule.capAmount || undefined,
        floorAmount: rule.floorAmount || undefined,
        ruleId: rule.id,
        resolutionPath: 'SHOWROOM_DEFAULT'
      };
    }

    // No commission rule found
    return null;
  }

  private async findRule(criteria: {
    showroomId: string;
    salesPersonId?: string;
    serviceId?: string;
  }) {
    const conditions = [
      eq(commissionRules.showroomId, criteria.showroomId),
      eq(commissionRules.status, 'ACTIVE'),
      sql`${commissionRules.effectiveFrom} <= NOW()`,
      sql`(${commissionRules.effectiveTo} IS NULL OR ${commissionRules.effectiveTo} > NOW())`
    ];

    if (criteria.salesPersonId) {
      conditions.push(eq(commissionRules.salesPersonId, criteria.salesPersonId));
    } else {
      conditions.push(sql`${commissionRules.salesPersonId} IS NULL`);
    }

    if (criteria.serviceId) {
      conditions.push(eq(commissionRules.serviceId, criteria.serviceId));
    } else {
      conditions.push(sql`${commissionRules.serviceId} IS NULL`);
    }

    const [rule] = await db
      .select()
      .from(commissionRules)
      .where(and(...conditions))
      .orderBy(desc(commissionRules.effectiveFrom))
      .limit(1);

    return rule;
  }

  /**
   * Calculate commission amount with caps and floors
   */
  calculateCommission(params: CommissionCalculationParams): CalculatedCommission {
    const { grossAmount, commission } = params;
    let computedAmount: number;
    let capApplied = false;
    let floorApplied = false;

    if (commission.type === 'PERCENT') {
      const percentage = parseFloat(commission.value);
      computedAmount = grossAmount * (percentage / 100);
    } else {
      computedAmount = parseFloat(commission.value);
    }

    // Apply floor (minimum)
    if (commission.floorAmount) {
      const floor = parseFloat(commission.floorAmount);
      if (computedAmount < floor) {
        computedAmount = floor;
        floorApplied = true;
      }
    }

    // Apply cap (maximum)
    if (commission.capAmount) {
      const cap = parseFloat(commission.capAmount);
      if (computedAmount > cap) {
        computedAmount = cap;
        capApplied = true;
      }
    }

    return {
      basis: commission.type === 'PERCENT' ? `${commission.value}% of ₹${grossAmount}` : `Fixed ₹${commission.value}`,
      value: commission.value,
      computedAmount: computedAmount.toFixed(2),
      capApplied,
      floorApplied
    };
  }

  /**
   * Create commission snapshot for job card approval
   */
  async createCommissionSnapshot(workOrderId: string, grossAmount: number): Promise<any> {
    const workOrder = await storage.getWorkOrder(workOrderId);
    if (!workOrder) {
      throw new Error('Work order not found');
    }

    const commission = await this.resolveCommission({
      showroomId: workOrder.showroomId,
      salesPersonId: workOrder.salesPersonId || undefined,
      serviceId: workOrder.serviceId
    });

    if (!commission) {
      return {
        workOrderId,
        showroomId: workOrder.showroomId,
        salesPersonId: workOrder.salesPersonId,
        serviceId: workOrder.serviceId,
        commission: null,
        calculatedCommission: {
          basis: 'No commission rule found',
          value: '0',
          computedAmount: '0.00',
          capApplied: false,
          floorApplied: false
        },
        snapshotAt: new Date().toISOString()
      };
    }

    const calculatedCommission = this.calculateCommission({
      grossAmount,
      commission
    });

    return {
      workOrderId,
      showroomId: workOrder.showroomId,
      salesPersonId: workOrder.salesPersonId,
      serviceId: workOrder.serviceId,
      commission,
      calculatedCommission,
      snapshotAt: new Date().toISOString()
    };
  }
}

export const commissionService = new CommissionService();
