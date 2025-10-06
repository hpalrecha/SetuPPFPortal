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
  // Helper function to determine billing details based on hierarchy rules
  private async calculateBillingDetails(
    oemId: string,
    dealershipId: string,
    showroomId: string,
    partnerId?: string
  ): Promise<{
    billFrom: any;
    billTo: any;
    shipTo: any;
    partnerBilledDirectly: boolean;
  }> {
    // Default billing entity - Plus Nine One Inc
    const plusNineOneInc = {
      name: "Plus Nine One Inc",
      addressLine1: "123 Business Park",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      gstin: "27AABCP9999A1Z5"
    };

    let billFrom = plusNineOneInc;
    let partnerBilledDirectly = false;

    // Check if partner bills directly (if partner is assigned)
    if (partnerId) {
      // Get the allocation for this partner and showroom/dealership
      const showroomAllocations = await storage.getAllocations({
        level: 'SHOWROOM',
        levelId: showroomId,
        partnerId
      });

      if (showroomAllocations.length > 0 && showroomAllocations[0].partnerBillsDirectly) {
        // Partner bills directly - use partner's billing address
        const partner = await storage.getPartner(partnerId);
        if (partner && partner.address) {
          billFrom = {
            name: partner.displayName,
            addressLine1: partner.address,
            city: partner.city || '',
            state: partner.state || '',
            pincode: partner.pincode || '',
            gstin: partner.gstin || ''
          };
          partnerBilledDirectly = true;
        }
      } else {
        // Check dealership level allocation
        const dealershipAllocations = await storage.getAllocations({
          level: 'DEALERSHIP',
          levelId: dealershipId,
          partnerId
        });

        if (dealershipAllocations.length > 0 && dealershipAllocations[0].partnerBillsDirectly) {
          const partner = await storage.getPartner(partnerId);
          if (partner && partner.address) {
            billFrom = {
              name: partner.displayName,
              addressLine1: partner.address,
              city: partner.city || '',
              state: partner.state || '',
              pincode: partner.pincode || '',
              gstin: partner.gstin || ''
            };
            partnerBilledDirectly = true;
          }
        }
      }
    }

    // Determine Bill To based on hierarchy
    let billTo: any = null;

    // Get entities
    const oem = await storage.getOem(oemId);
    const showroom = await storage.getShowroom(showroomId);
    const dealership = await storage.getDealership(dealershipId);

    // Check hierarchy: OEM > Dealership > Showroom > Dealership address (fallback)
    if (oem && oem.billJobsDirectlyToOem && oem.billToAddress) {
      billTo = { ...oem.billToAddress, entityName: oem.name, entityType: 'OEM' };
    } else if (dealership && dealership.billDirectlyToDealership && dealership.billToAddress) {
      billTo = { ...dealership.billToAddress, entityName: dealership.name, entityType: 'Dealership' };
    } else if (showroom && showroom.billDirectlyToShowroom && showroom.billToAddress) {
      billTo = { ...showroom.billToAddress, entityName: showroom.name, entityType: 'Showroom' };
    } else if (dealership && dealership.billToAddress) {
      billTo = { ...dealership.billToAddress, entityName: dealership.name, entityType: 'Dealership' };
    }

    // Ship To - always showroom's ship to address
    let shipTo: any = null;
    if (showroom && showroom.shipToAddress) {
      shipTo = { ...showroom.shipToAddress, entityName: showroom.name };
    }

    return {
      billFrom,
      billTo,
      shipTo,
      partnerBilledDirectly
    };
  }

  async createWorkOrder(data: InsertWorkOrder, userId: string): Promise<WorkOrder> {
    // 💰 Calculate estimated price from pricing rules
    let estimatedPrice = 0;
    try {
      const pricingResult = await pricingService.calculateWorkOrderPrice(
        data.dealershipId,
        data.vehicleModelId,
        data.serviceId,
        data.quantity || 1
      );
      
      if (pricingResult.ruleFound) {
        estimatedPrice = pricingResult.price;
        console.log(`💰 Estimated price calculated: ₹${estimatedPrice} (${pricingResult.source})`);
      } else {
        console.log(`⚠️ No pricing rule found - work order will have zero estimated price`);
      }
    } catch (error) {
      console.error('Error calculating estimated price:', error);
      // Continue with zero price if calculation fails
    }

    // 💵 Calculate billing details (without partner at this stage)
    let billingDetails;
    try {
      billingDetails = await this.calculateBillingDetails(
        data.oemId,
        data.dealershipId,
        data.showroomId
      );
      console.log(`💵 Billing details calculated - Bill To: ${billingDetails.billTo?.entityType || 'Unknown'}`);
    } catch (error) {
      console.error('Error calculating billing details:', error);
      // Continue without billing details if calculation fails
    }

    const workOrder = await storage.createWorkOrder({
      ...data,
      estimatedPrice,
      createdByUserId: userId,
      status: 'PENDING',
      billFrom: billingDetails?.billFrom || null,
      billTo: billingDetails?.billTo || null,
      shipTo: billingDetails?.shipTo || null
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

  // 🔥 ROBUST COMMISSION CREATION - Uses new bulletproof logic
  private async createSalesCommission(workOrderId: string): Promise<void> {
    try {
      console.log(`🔥 ROBUST Commission creation started for Work Order ${workOrderId}`);
      
      // Use new robust commission creation method
      const result = await commissionService.createCommissionForWorkOrder(workOrderId);
      
      if (result.success) {
        console.log(`✅ Commission creation SUCCESS:`, {
          workOrderId,
          commissionId: result.commissionId,
          message: result.message
        });
      } else {
        console.log(`⚠️ Commission creation SKIPPED:`, {
          workOrderId,
          reason: result.message
        });
      }
    } catch (error) {
      console.error(`❌ CRITICAL ERROR: Failed to create commission for work order ${workOrderId}:`, error);
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
      status: 'SUBMITTED'
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

    // 💵 Recalculate billing details with partner information
    let billingDetails;
    try {
      billingDetails = await this.calculateBillingDetails(
        workOrder.oemId,
        workOrder.dealershipId,
        workOrder.showroomId,
        partnerId
      );
      console.log(`💵 Billing details recalculated with partner - Bill From: ${billingDetails.billFrom?.name}, Partner Bills Directly: ${billingDetails.partnerBilledDirectly}`);
    } catch (error) {
      console.error('Error calculating billing details:', error);
    }

    const updatedWorkOrder = await storage.updateWorkOrder(workOrderId, {
      status: 'ASSIGNED',
      assignedPartnerId: partnerId,
      estimatedPrice: pricing ? pricing.priceAmount : null,
      billFrom: billingDetails?.billFrom || workOrder.billFrom,
      billTo: billingDetails?.billTo || workOrder.billTo,
      shipTo: billingDetails?.shipTo || workOrder.shipTo
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
      remarks: workOrderDetails,
      billingValue: pricing?.priceAmount || null,
      billFrom: billingDetails?.billFrom || null,
      billTo: billingDetails?.billTo || null,
      shipTo: billingDetails?.shipTo || null,
      partnerBilledDirectly: billingDetails?.partnerBilledDirectly || false
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
    // Get partners mapped to this showroom with their service categories
    const showroomPartners = await storage.getPartnersForShowroom(showroomId);
    
    // Get all partners with their service categories
    const partnersWithCategories = await storage.getPartnersWithCategories();
    
    // Filter showroom partners who can handle this service category
    const capablePartners = showroomPartners
      .map(sp => partnersWithCategories.find(p => p.id === sp.id))
      .filter(partner => 
        partner && partner.serviceCategories?.some(category => category.id === serviceCategoryId)
      );

    if (capablePartners.length === 0) {
      return null;
    }

    // Get showroom allocations for priority ordering
    const showroomAllocations = await storage.getAllocations({
      level: 'SHOWROOM',
      levelId: showroomId,
      active: true
    });

    // Priority 1: Partners mapped to showroom WITH allocations AND can handle the service
    for (const allocation of showroomAllocations) {
      const matchingPartner = capablePartners.find(p => p && p.id === allocation.partnerId);
      if (matchingPartner) {
        return matchingPartner;
      }
    }

    // Priority 2: Partners mapped to showroom (without specific allocation) who can handle the service
    if (capablePartners.length > 0 && capablePartners[0]) {
      return capablePartners[0];
    }

    // Priority 3: Partners allocated to dealership AND can handle the service  
    const dealershipAllocations = await storage.getAllocations({
      level: 'DEALERSHIP', 
      levelId: dealershipId,
      active: true
    });

    for (const allocation of dealershipAllocations) {
      const matchingPartner = partnersWithCategories.find(p => 
        p.id === allocation.partnerId && 
        p.serviceCategories?.some(category => category.id === serviceCategoryId)
      );
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

    // Priority 1: Get partners mapped to this showroom
    const showroomPartners = await storage.getPartnersForShowroom(workOrder.showroomId);
    
    if (showroomPartners.length > 0) {
      // Check if any of these partners have allocations for priority ordering
      const allocations = await storage.getAllocations({
        level: 'SHOWROOM',
        levelId: workOrder.showroomId,
        active: true
      });
      
      // Prefer partners with allocations first
      for (const allocation of allocations) {
        const allocatedPartner = showroomPartners.find(p => p.id === allocation.partnerId);
        if (allocatedPartner) {
          await this.assignWorkOrder(workOrderId, allocatedPartner.id, 'SYSTEM');
          return;
        }
      }
      
      // Otherwise use the first mapped partner
      await this.assignWorkOrder(workOrderId, showroomPartners[0].id, 'SYSTEM');
      return;
    }

    // Priority 2: Try dealership level allocations
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
    console.error(`CRITICAL: Work order ${workOrderId} has NO partner mappings at showroom or dealership level. Marking as UNASSIGNED for admin intervention.`);
    
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
