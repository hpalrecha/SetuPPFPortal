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

    // Get allocations for the showroom (highest priority first)
    const allocations = await storage.getAllocations({
      level: 'SHOWROOM',
      levelId: workOrder.showroomId,
      active: true
    });

    if (allocations.length === 0) {
      // Try dealership level allocations
      const dealershipAllocations = await storage.getAllocations({
        level: 'DEALERSHIP',
        levelId: workOrder.dealershipId,
        active: true
      });

      if (dealershipAllocations.length > 0) {
        await this.assignWorkOrder(workOrderId, dealershipAllocations[0].partnerId, 'SYSTEM');
      }
    } else {
      await this.assignWorkOrder(workOrderId, allocations[0].partnerId, 'SYSTEM');
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
