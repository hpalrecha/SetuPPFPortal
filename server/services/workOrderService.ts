import { storage } from '../storage';
import { pricingService } from './pricingService';
import { commissionService } from './commissionService';
import { notificationService } from './notificationService';
import type { 
  WorkOrder, 
  InsertWorkOrder, 
  User, 
  Partner 
} from '@shared/schema';

export class WorkOrderService {
  async createWorkOrder(data: InsertWorkOrder, userId: string): Promise<WorkOrder> {
    const workOrder = await storage.createWorkOrder({
      ...data,
      createdByUserId: userId,
      status: 'PENDING'
    });

    // 🚀 AUTO-CREATE SALES COMMISSION immediately if salesperson is mapped
    if (workOrder.salesPersonId && workOrder.showroomId) {
      console.log(`📈 Commission creation triggered for WO ${workOrder.id} - Salesperson: ${workOrder.salesPersonId}`);
      await this.createSalesCommission(workOrder.id);
    } else {
      console.log(`⚠️ No Salesperson mapped → commission skipped.`);
    }

    // Auto-assign partner and create job card immediately for showroom work orders
    if (workOrder.showroomId) {
      try {
        await this.autoAssignPartner(workOrder.id);
      } catch (error) {
        console.warn('Could not auto-assign partner for work order:', workOrder.id, error);
        // Don't fail the work order creation if auto-assignment fails
      }
    }

    // Send notification
    await notificationService.sendWorkOrderCreated(workOrder);

    return workOrder;
  }

  // Enhanced method: Auto-create sales commission when work order is created
  private async createSalesCommission(workOrderId: string): Promise<void> {
    try {
      console.log(`🔍 Commission calculation started for Work Order ${workOrderId}`);
      
      const workOrder = await storage.getWorkOrder(workOrderId);
      if (!workOrder || !workOrder.salesPersonId || !workOrder.showroomId) {
        console.log(`❌ Commission skipped for WO ${workOrderId} - Missing required data:`, {
          workOrderExists: !!workOrder,
          salesPersonId: workOrder?.salesPersonId || null,
          showroomId: workOrder?.showroomId || null
        });
        return;
      }

      console.log(`📊 Commission calculation parameters:`, {
        workOrderId,
        showroomId: workOrder.showroomId,
        salesPersonId: workOrder.salesPersonId,
        serviceId: workOrder.serviceId,
        estimatedPrice: workOrder.estimatedPrice || 0
      });

      // Calculate commission using existing service (use estimatedPrice or 0 for now)
      const commission = await commissionService.calculateCommission(
        workOrder.showroomId,
        workOrder.salesPersonId,
        workOrder.serviceId,
        Number(workOrder.estimatedPrice || 0),
        workOrder.oemId,
        workOrder.dealershipId
      );

      console.log(`💰 Commission calculation result:`, {
        amount: commission.amount,
        ruleFound: !!commission.rule,
        ruleId: commission.rule?.id,
        calculation: commission.calculation
      });

      // Create commission even if amount is 0 (will be recalculated when price is confirmed)
      // Check for existing commission to prevent duplicates
      const existingCommissions = await storage.getCommissions({
        workOrderId
      });
      
      if (existingCommissions.commissions.length === 0) {
        // Create sales commission (PENDING status)
        const commissionData = {
          workOrderId,
          showroomId: workOrder.showroomId,
          salesPersonId: workOrder.salesPersonId,
          basis: commission.rule?.type || 'PERCENT',
          value: Number(commission.rule?.valueNumeric || 0),
          computedAmount: commission.amount,
          status: 'PENDING'
        };
        
        console.log(`📝 Creating commission record:`, commissionData);
        
        const createdCommission = await storage.createCommission(commissionData);
        
        // Get salesperson name for better logging
        const salesPerson = await storage.getSalesPerson(workOrder.salesPersonId);
        const salesPersonName = salesPerson?.name || `ID:${workOrder.salesPersonId}`;
        
        console.log(`✅ Commission created for ${salesPersonName} on Work Order ${workOrderId} = ₹${commission.amount} (Rule found: ${commission.ruleFound})`);
        
        if (!commission.ruleFound) {
          console.log(`⚠️ WARNING: No commission rule found for ${salesPersonName} in showroom ${workOrder.showroomId}`);
        }
      } else {
        console.log(`⚠️ Commission already exists for work order ${workOrderId}, skipping creation. Existing count: ${existingCommissions.commissions.length}`);
      }
    } catch (error) {
      console.error(`❌ CRITICAL ERROR: Failed to auto-create sales commission for work order ${workOrderId}:`, error);
      console.error(`📋 Error stack:`, error.stack);
      // Don't fail the work order creation if commission creation fails
    }
  }

  // Helper method to update commission with accurate pricing when work order is assigned
  private async updateCommissionWithPricing(workOrderId: string, finalPrice: number): Promise<void> {
    try {
      console.log(`🔄 Commission pricing update started for WO ${workOrderId} with price ₹${finalPrice}`);
      
      const workOrder = await storage.getWorkOrder(workOrderId);
      if (!workOrder || !workOrder.salesPersonId) {
        console.log(`❌ Cannot update commission for WO ${workOrderId} - missing work order or sales person`);
        return;
      }

      // Get existing commission
      const existingCommissions = await storage.getCommissions({ workOrderId });
      if (existingCommissions.commissions.length === 0) {
        console.log(`⚠️ No existing commission found for WO ${workOrderId}, creating new one`);
        await this.createSalesCommission(workOrderId);
        return;
      }

      const existingCommission = existingCommissions.commissions[0];
      
      // Recalculate commission with accurate pricing
      const commission = await commissionService.calculateCommission(
        workOrder.showroomId,
        workOrder.salesPersonId,
        workOrder.serviceId,
        finalPrice,
        workOrder.oemId,
        workOrder.dealershipId
      );

      console.log(`💰 Updated commission calculation:`, {
        previousAmount: existingCommission.computedAmount,
        newAmount: commission.amount,
        priceDifference: finalPrice - Number(workOrder.estimatedPrice || 0)
      });

      // Update the commission with new amount
      await storage.updateCommission(existingCommission.id, {
        computedAmount: commission.amount,
        value: Number(commission.rule?.valueNumeric || 0),
        basis: commission.rule?.type || 'PERCENT'
      });

      console.log(`✅ Commission updated successfully for WO ${workOrderId}: ₹${commission.amount}`);
    } catch (error) {
      console.error(`❌ Failed to update commission pricing for WO ${workOrderId}:`, error);
    }
  }

  async submitWorkOrder(workOrderId: string, userId: string): Promise<WorkOrder> {
    const workOrder = await storage.getWorkOrder(workOrderId);
    if (!workOrder) {
      throw new Error('Work order not found');
    }

    if (workOrder.status !== 'DRAFT') {
      throw new Error('Work order must be in DRAFT status to submit');
    }

    const updatedWorkOrder = await storage.updateWorkOrder(workOrderId, {
      status: 'SUBMITTED',
      submittedAt: new Date()
    });

    // Auto-assign to partner if no manual assignment
    if (!workOrder.assignedPartnerId) {
      await this.autoAssignPartner(workOrderId);
    }

    // Send notification
    await notificationService.sendWorkOrderSubmitted(updatedWorkOrder);

    return updatedWorkOrder;
  }

  async assignWorkOrder(workOrderId: string, partnerId: string, userId: string): Promise<WorkOrder> {
    const workOrder = await storage.getWorkOrder(workOrderId);
    if (!workOrder) {
      throw new Error('Work order not found');
    }

    if (workOrder.status !== 'PENDING' && workOrder.status !== 'SUBMITTED' && workOrder.status !== 'ASSIGNED') {
      throw new Error('Work order must be in PENDING, SUBMITTED or ASSIGNED status to assign');
    }

    // Get pricing for estimation
    const pricing = await pricingService.resolvePricing(
      partnerId,
      'SHOWROOM', // Fix: Use scope type not dealership ID
      workOrder.showroomId,
      workOrder.vehicleModelId,
      workOrder.serviceId
    );

    const updatedWorkOrder = await storage.updateWorkOrder(workOrderId, {
      status: 'ASSIGNED',
      assignedPartnerId: partnerId,
      assignedAt: new Date(),
      estimatedPrice: pricing ? pricing.priceAmount : null
    });

    // Create job card with comprehensive work order details
    const workOrderDetails = `
WORK ORDER DETAILS:
━━━━━━━━━━━━━━━━━━━━
📋 Work Order ID: WO-${workOrder.id.slice(-6)}
📅 Created: ${new Date(workOrder.createdAt).toLocaleDateString()}

👤 CUSTOMER INFORMATION:
• Name: ${workOrder.customerName || 'N/A'}
• Phone: ${workOrder.customerPhone || 'N/A'}
• Email: ${workOrder.customerEmail || 'N/A'}
• Address: ${workOrder.customerAddress || 'N/A'}

🚗 VEHICLE INFORMATION:
• Model: ${workOrder.vehicleModelName || 'N/A'} ${workOrder.vehicleModelBrand || ''}
• Registration: ${workOrder.regNo || 'Not specified'}
• Variant: ${workOrder.vehicleVariantId ? 'Variant ID: ' + workOrder.vehicleVariantId : 'Standard'}

🔧 SERVICE DETAILS:
• Service: ${workOrder.serviceName || 'N/A'}
• Description: ${workOrder.serviceDescription || 'Standard service'}
• Estimated Price: ₹${pricing?.priceAmount || 'To be confirmed'}

🏢 ORGANIZATION:
• OEM: ${workOrder.oemName || 'N/A'}
• Dealership: ${workOrder.dealershipName || 'N/A'}
• Showroom: ${workOrder.showroomName || 'N/A'}
• Sales Person: ${workOrder.salesPersonName || 'N/A'}

📝 ADDITIONAL NOTES:
${workOrder.notes || 'No additional notes provided'}

━━━━━━━━━━━━━━━━━━━━
Status: AWAITING ACKNOWLEDGMENT
Please acknowledge receipt and provide estimated completion time.
    `.trim();

    const jobCard = await storage.createJobCard({
      workOrderId,
      partnerId,
      status: 'AWAITING_ACK',
      remarks: workOrderDetails
    });

    // Update work order with job card reference
    await storage.updateWorkOrder(workOrderId, {
      assignedJobCardId: jobCard.id
    });

    // 🔄 UPDATE EXISTING COMMISSION with accurate pricing (if commission was created with estimated price = 0)
    if (workOrder.salesPersonId && workOrder.showroomId && pricing?.priceAmount) {
      console.log(`💡 Updating commission with accurate pricing for WO ${workOrderId}: ₹${pricing.priceAmount}`);
      await this.updateCommissionWithPricing(workOrderId, Number(pricing.priceAmount));
    }

    // Send notifications
    await notificationService.sendWorkOrderAssigned(updatedWorkOrder, partnerId);

    return updatedWorkOrder;
  }

  async autoAssignPartner(workOrderId: string): Promise<void> {
    const workOrder = await storage.getWorkOrder(workOrderId);
    if (!workOrder) {
      throw new Error('Work order not found');
    }

    // Get the service details to determine the required service category
    const service = await storage.getService(workOrder.serviceId);
    if (!service || !service.serviceCategoryId) {
      console.warn(`Service ${workOrder.serviceId} has no service category, falling back to basic allocation`);
      return this.basicAutoAssignPartner(workOrderId);
    }

    // Find partners who can handle this service category and are allocated to this showroom/dealership
    const suitablePartner = await this.findSuitablePartner(
      workOrder.showroomId,
      workOrder.dealershipId,
      service.serviceCategoryId
    );

    if (suitablePartner) {
      console.log(`Auto-assigning work order ${workOrderId} to partner ${suitablePartner.id} based on service category match`);
      await this.assignWorkOrder(workOrderId, suitablePartner.id, 'SYSTEM');
    } else {
      console.warn(`No suitable partner found for service category. Falling back to basic allocation for work order ${workOrderId}`);
      await this.basicAutoAssignPartner(workOrderId);
    }
  }

  // Enhanced partner finding with service category matching
  private async findSuitablePartner(showroomId: string, dealershipId: string, serviceCategoryId: string): Promise<any | null> {
    // Get all partners with their service categories
    const partnersWithCategories = await storage.getPartnersWithCategories();
    
    // Filter partners who can handle this service category
    const capablePartners = partnersWithCategories.filter(partner => 
      partner.serviceCategories?.some(category => category.id === serviceCategoryId)
    );

    if (capablePartners.length === 0) {
      return null;
    }

    // Get showroom allocations and find matching partners
    const showroomAllocations = await storage.getAllocations({
      level: 'SHOWROOM',
      levelId: showroomId,
      active: true
    });

    // Priority 1: Partners allocated to showroom AND can handle the service
    for (const allocation of showroomAllocations) {
      const matchingPartner = capablePartners.find(p => p.id === allocation.partnerId);
      if (matchingPartner) {
        return matchingPartner;
      }
    }

    // Priority 2: Partners allocated to dealership AND can handle the service  
    const dealershipAllocations = await storage.getAllocations({
      level: 'DEALERSHIP', 
      levelId: dealershipId,
      active: true
    });

    for (const allocation of dealershipAllocations) {
      const matchingPartner = capablePartners.find(p => p.id === allocation.partnerId);
      if (matchingPartner) {
        return matchingPartner;
      }
    }

    return null;
  }

  // Fallback to basic allocation when service category matching is not possible
  private async basicAutoAssignPartner(workOrderId: string): Promise<void> {
    const workOrder = await storage.getWorkOrder(workOrderId);
    if (!workOrder) {
      throw new Error('Work order not found');
    }

    // Get allocations for the showroom (highest priority first)
    const allocations = await storage.getAllocations({
      level: 'SHOWROOM',
      levelId: workOrder.showroomId,
      active: true
    });

    if (allocations.length > 0) {
      await this.assignWorkOrder(workOrderId, allocations[0].partnerId, 'SYSTEM');
      return;
    }

    // Try dealership level allocations
    const dealershipAllocations = await storage.getAllocations({
      level: 'DEALERSHIP',
      levelId: workOrder.dealershipId,
      active: true
    });

    if (dealershipAllocations.length > 0) {
      await this.assignWorkOrder(workOrderId, dealershipAllocations[0].partnerId, 'SYSTEM');
      return;
    }

    // SAFETY NET: No allocations found at any level
    console.error(`CRITICAL: Work order ${workOrderId} has NO partner allocations at showroom or dealership level. Marking as UNASSIGNED for admin intervention.`);
    
    // Mark work order as needing manual assignment
    await storage.updateWorkOrder(workOrderId, {
      status: 'PENDING', // Keep as PENDING so it appears in admin queue
      notes: workOrder.notes 
        ? `${workOrder.notes}\n\n[SYSTEM] No partner allocations available - requires manual assignment.`
        : '[SYSTEM] No partner allocations available - requires manual assignment.'
    });

    // TODO: Send high-priority alert to admin about unassigned work order
    // TODO: Add metrics tracking for unassigned work orders
  }

  // 🔧 BACKFILL SCRIPT: Generate missing commissions for existing Work Orders
  async backfillMissingCommissions(): Promise<{ processed: number; created: number; errors: string[] }> {
    console.log(`🚀 COMMISSION BACKFILL STARTED`);
    
    const results = {
      processed: 0,
      created: 0, 
      errors: [] as string[]
    };

    try {
      // Find Work Orders with Salesperson but NO commission entries
      const workOrdersWithoutCommissions = await storage.getWorkOrdersWithoutCommissions();
      
      console.log(`📊 Found ${workOrdersWithoutCommissions.length} Work Orders with missing commissions`);
      
      for (const workOrder of workOrdersWithoutCommissions) {
        try {
          results.processed++;
          
          console.log(`⚙️ Processing WO ${workOrder.id} (Customer: ${workOrder.customerName}, Sales: ${workOrder.salesPersonName})`);
          
          // Use the existing createSalesCommission method
          await this.createSalesCommission(workOrder.id);
          
          results.created++;
          console.log(`✅ Commission backfilled for WO ${workOrder.id}`);
          
        } catch (error) {
          const errorMsg = `Failed to backfill commission for WO ${workOrder.id}: ${error.message}`;
          console.error(`❌ ${errorMsg}`);
          results.errors.push(errorMsg);
        }
      }
      
      console.log(`🎯 BACKFILL COMPLETE:`, results);
      return results;
      
    } catch (error) {
      console.error(`❌ CRITICAL ERROR during backfill:`, error);
      results.errors.push(`Critical error: ${error.message}`);
      return results;
    }
  }

  canUserAccessWorkOrder(user: User, workOrder: WorkOrder): boolean {
    switch (user.role) {
      case 'SUPER_ADMIN':
        return true;
      case 'OEM_ADMIN':
        return user.oemId === workOrder.oemId;
      case 'DEALERSHIP_ADMIN':
        return user.dealershipId === workOrder.dealershipId;
      case 'SHOWROOM_MANAGER':
      case 'SALES_PERSON':
        return user.showroomId === workOrder.showroomId;
      case 'PARTNER_ADMIN':
      case 'PARTNER_STAFF':
        return user.partnerId === workOrder.assignedPartnerId;
      default:
        return false;
    }
  }

  async getWorkOrderWithDetails(workOrderId: string): Promise<any> {
    const workOrder = await storage.getWorkOrder(workOrderId);
    if (!workOrder) {
      throw new Error('Work order not found');
    }

    // Get related job cards
    const jobCards = await storage.getJobCards({ workOrderId });

    return {
      ...workOrder,
      jobCards: jobCards.jobCards
    };
  }
}

export const workOrderService = new WorkOrderService();
