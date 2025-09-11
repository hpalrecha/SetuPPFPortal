import { storage } from '../storage';
import { pricingService } from './pricingService';
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
      workOrder.dealershipId,
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

    // Create job card
    const jobCard = await storage.createJobCard({
      workOrderId,
      partnerId,
      status: 'AWAITING_ACK'
    });

    // Update work order with job card reference
    await storage.updateWorkOrder(workOrderId, {
      assignedJobCardId: jobCard.id
    });

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
