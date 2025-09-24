import { storage } from '../storage';
import { pricingService } from './pricingService';
import { commissionService } from './commissionService';
import { notificationService } from './notificationService';
import { emailService } from './email-service';
import type { 
  JobCard, 
  InsertJobCard
} from '@shared/schema';

export class JobCardService {
  async acknowledgeJobCard(jobCardId: string, userId: string): Promise<JobCard> {
    const jobCard = await storage.getJobCard(jobCardId);
    if (!jobCard) {
      throw new Error('Job card not found');
    }

    if (jobCard.status !== 'AWAITING_ACK') {
      throw new Error('Job card must be in AWAITING_ACK status to acknowledge');
    }

    const updatedJobCard = await storage.updateJobCard(jobCardId, {
      status: 'ACKNOWLEDGED',
      acknowledgedAt: new Date()
    });

    // Send notification
    await notificationService.sendJobCardAcknowledged(updatedJobCard);

    return updatedJobCard;
  }

  async scheduleJobCard(jobCardId: string, scheduledAt: Date, userId: string): Promise<JobCard> {
    const jobCard = await storage.getJobCard(jobCardId);
    if (!jobCard) {
      throw new Error('Job card not found');
    }

    if (jobCard.status !== 'ACKNOWLEDGED') {
      throw new Error('Job card must be acknowledged before scheduling');
    }

    if (scheduledAt <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    const updatedJobCard = await storage.updateJobCard(jobCardId, {
      status: 'SCHEDULED',
      scheduledAt
    });

    // Send notification
    await notificationService.sendJobCardScheduled(updatedJobCard);

    return updatedJobCard;
  }

  async startJobCard(jobCardId: string, userId: string): Promise<JobCard> {
    const jobCard = await storage.getJobCard(jobCardId);
    if (!jobCard) {
      throw new Error('Job card not found');
    }

    if (jobCard.status !== 'SCHEDULED') {
      throw new Error('Job card must be scheduled before starting');
    }

    const updatedJobCard = await storage.updateJobCard(jobCardId, {
      status: 'IN_PROGRESS',
      startedAt: new Date()
    });

    // Update work order status
    await storage.updateWorkOrder(jobCard.workOrderId, {
      status: 'IN_PROGRESS'
    });

    // Send notification
    await notificationService.sendJobCardStarted(updatedJobCard);

    return updatedJobCard;
  }

  async completeJobCard(
    jobCardId: string, 
    remarks: string, 
    checklistJson: any, 
    userId: string
  ): Promise<JobCard> {
    const jobCard = await storage.getJobCard(jobCardId);
    if (!jobCard) {
      throw new Error('Job card not found');
    }

    if (jobCard.status !== 'IN_PROGRESS') {
      throw new Error('Job card must be in progress to complete');
    }

    // Check if minimum media uploaded
    // TODO: Add validation for minimum required proof images

    const updatedJobCard = await storage.updateJobCard(jobCardId, {
      status: 'COMPLETED',
      completedAt: new Date(),
      partnerRemarks: remarks,
      checklistJson
    });

    // 🚀 AUTO-CREATE DETAILER PAYOUT when job card is completed
    await this.createDetailerPayout(jobCardId);

    // Request approval automatically
    await this.requestApproval(jobCardId, userId);

    // Send email notification to customer/showroom about completion
    try {
      const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
      if (workOrder) {
        const showroom = await storage.getShowroom(workOrder.showroomId);
        if (showroom?.email) {
          await emailService.sendJobCardCompletionNotification(
            showroom.email,
            {
              jobCardId: updatedJobCard.id,
              workOrderNumber: workOrder.workOrderNumber || workOrder.id.slice(0, 8),
              vehicleDetails: `${workOrder.vehicleModel || 'Vehicle'} ${workOrder.vehicleVariant || ''}`.trim(),
              completedAt: updatedJobCard.completedAt || new Date(),
              partnerName: (await storage.getPartner(jobCard.partnerId))?.businessName || 'Partner'
            }
          );
        }
      }
    } catch (emailError) {
      console.error("Failed to send completion email:", emailError);
      // Don't fail the completion if email fails
    }

    return updatedJobCard;
  }

  // New method: Auto-create detailer payout when job card is completed
  private async createDetailerPayout(jobCardId: string): Promise<void> {
    try {
      const jobCard = await storage.getJobCard(jobCardId);
      if (!jobCard) {
        throw new Error('Job card not found');
      }

      // Get work order for pricing calculation
      const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
      if (!workOrder) {
        throw new Error('Associated work order not found');
      }

      // Get service details for category-based pricing
      const service = await storage.getService(workOrder.serviceId);
      const serviceCategoryId = service?.serviceCategoryId || null;

      // Use the NEW simplified payout pricing
      const pricingResult = serviceCategoryId 
        ? await storage.resolvePayoutPricing(
            jobCard.partnerId,    // partnerId
            serviceCategoryId,    // serviceCategoryId
            workOrder.vehicleModelId // vehicleModelId
          )
        : null;

      let payoutAmount = '0.00';
      let payoutStatus: 'pending_review' | 'due' | 'paid' = 'pending_review';

      if (pricingResult) {
        payoutAmount = pricingResult.amount;
        payoutStatus = 'pending_review'; // New flow: start with pending_review
        console.log(`✅ NEW SIMPLIFIED PRICING: ₹${payoutAmount} using rule ${pricingResult.ruleId}`);
      } else {
        console.log(`⚠️ No pricing rule found - payout marked as pending_review for manual review`);
      }

      // Check for existing payout to prevent duplicates
      const existingPayouts = await storage.getPayouts({
        jobCardId
      });
      
      if (existingPayouts.length === 0) {
        // Create detailer payout with resolved pricing
        await storage.createPayout({
          jobCardId,
          partnerId: jobCard.partnerId,
          grossAmount: payoutAmount,
          netAmount: payoutAmount, // No adjustments for now
          status: payoutStatus
        });

        console.log(`✅ Auto-created detailer payout: ₹${payoutAmount} (${payoutStatus}) for job card ${jobCardId}`);
      } else {
        // Update existing payout with correct pricing
        const existingPayout = existingPayouts[0];
        await storage.updatePayout(existingPayout.id, {
          grossAmount: payoutAmount,
          netAmount: payoutAmount,
          status: payoutStatus
        });

        console.log(`✅ Updated existing detailer payout: ₹${payoutAmount} (${payoutStatus}) for job card ${jobCardId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to auto-create detailer payout for job card ${jobCardId}:`, error);
      // Don't fail the job card completion if payout creation fails
    }
  }

  async requestApproval(jobCardId: string, userId: string): Promise<JobCard> {
    const jobCard = await storage.getJobCard(jobCardId);
    if (!jobCard) {
      throw new Error('Job card not found');
    }

    if (jobCard.status !== 'COMPLETED') {
      throw new Error('Job card must be completed to request approval');
    }

    const updatedJobCard = await storage.updateJobCard(jobCardId, {
      status: 'PENDING_APPROVAL',
      approvalRequestedAt: new Date()
    });

    // Update work order status
    await storage.updateWorkOrder(jobCard.workOrderId, {
      status: 'COMPLETED_PENDING_APPROVAL'
    });

    // Send notification
    await notificationService.sendJobCardPendingApproval(updatedJobCard);

    return updatedJobCard;
  }

  async approveJobCard(jobCardId: string, userId: string, remarks?: string): Promise<JobCard> {
    const jobCard = await storage.getJobCard(jobCardId);
    if (!jobCard) {
      throw new Error('Job card not found');
    }

    if (jobCard.status !== 'PENDING_APPROVAL') {
      throw new Error('Job card must be pending approval to approve');
    }

    // Get work order for pricing calculation
    const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
    if (!workOrder) {
      throw new Error('Associated work order not found');
    }

    // Resolve detailer pricing for payout calculation using the same logic as completion
    let detailerPayoutAmount = 0;
    try {
      // Get service details for category-based pricing (FIXED: approval was missing this!)
      const service = await storage.getService(workOrder.serviceId);
      const serviceCategoryId = service?.serviceCategoryId || null;

      // Use the same proper detailer pricing resolution as completion
      const pricingResult = await storage.resolveDetailerPricing(
        jobCard.partnerId,        // detailerId
        workOrder.serviceId,      // serviceId
        serviceCategoryId,        // serviceCategoryId - FIXED: now properly passed
        workOrder.vehicleModelId, // vehicleModelId
        workOrder.dealershipId,   // dealershipId
        workOrder.showroomId      // showroomId
      );

      if (pricingResult) {
        detailerPayoutAmount = Number(pricingResult.amount);
        console.log(`✅ Resolved detailer pricing: ₹${detailerPayoutAmount} using rule ${pricingResult.ruleId} (${pricingResult.context})`);
      } else {
        console.log(`⚠️ No pricing rule found for detailer payout - marked as NEEDS_REVIEW`);
      }
    } catch (error) {
      console.error('Error resolving detailer pricing:', error);
    }
    
    // For work order final price, use dealership pricing
    const dealershipPricing = await pricingService.resolvePricing(
      jobCard.partnerId,
      'SHOWROOM',
      workOrder.showroomId,
      workOrder.vehicleModelId,
      workOrder.serviceId
    );
    
    const finalPrice = dealershipPricing?.priceAmount || workOrder.estimatedPrice || 0;

    // Calculate commission
    let commissionAmount = 0;
    if (workOrder.salesPersonId) {
      const commission = await commissionService.calculateCommission(
        workOrder.showroomId,
        workOrder.salesPersonId,
        workOrder.serviceId,
        Number(finalPrice)
      );
      commissionAmount = commission.amount;
    }

    const updatedJobCard = await storage.updateJobCard(jobCardId, {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedByUserId: userId,
      pricingSnapshotJson: dealershipPricing ? {
        priceAmount: dealershipPricing.priceAmount,
        currency: dealershipPricing.currency,
        ruleId: dealershipPricing.id
      } : null,
      commissionSnapshotJson: workOrder.salesPersonId ? {
        salesPersonId: workOrder.salesPersonId,
        amount: commissionAmount,
        basis: 'CALCULATED'
      } : null
    });

    // Update work order
    await storage.updateWorkOrder(jobCard.workOrderId, {
      status: 'APPROVED',
      finalPrice,
      approvedAt: new Date()
    });

    // Create approval record
    await storage.createApproval({
      jobCardId,
      approverUserId: userId,
      status: 'APPROVED',
      remarks
    });

    // Update existing payout instead of creating duplicate
    const existingPayouts = await storage.getPayouts({ jobCardId });
    if (existingPayouts.length > 0) {
      // Update existing payout with detailer payout amount  
      await storage.updatePayout(existingPayouts[0].id, {
        grossAmount: detailerPayoutAmount,
        netAmount: detailerPayoutAmount,
        status: 'COMPUTED'
      });
      console.log(`✅ Updated existing payout to COMPUTED status with detailer payout: ₹${detailerPayoutAmount}`);
    } else {
      // Fallback: create payout if somehow none exists
      await storage.createPayout({
        jobCardId,
        partnerId: jobCard.partnerId,
        grossAmount: detailerPayoutAmount,
        netAmount: detailerPayoutAmount,
        status: 'COMPUTED'
      });
      console.log(`⚠️ No existing payout found, created new COMPUTED payout`);
    }

    // Update existing commission instead of creating duplicate
    if (workOrder.salesPersonId && commissionAmount > 0) {
      const existingCommissions = await storage.getCommissions({ workOrderId: workOrder.id });
      if (existingCommissions.commissions.length > 0) {
        // Update existing commission with final amounts
        await storage.updateCommission(existingCommissions.commissions[0].id, {
          computedAmount: commissionAmount,
          status: 'COMPUTED'
        });
        console.log(`✅ Updated existing commission to COMPUTED status with final amount: ₹${commissionAmount}`);
      } else {
        // Fallback: create commission if somehow none exists
        // Get commission rule to set correct value
        const commission = await commissionService.calculateCommission(
          workOrder.showroomId,
          workOrder.salesPersonId,
          workOrder.serviceId,
          Number(finalPrice)
        );
        
        if (commission.rule) {
          await storage.createCommission({
            workOrderId: workOrder.id, // Use workOrderId not jobCardId
            showroomId: workOrder.showroomId,
            salesPersonId: workOrder.salesPersonId,
            basis: commission.rule.type, // Use rule type (PERCENT/AMOUNT)
            value: Number(commission.rule.valueNumeric), // Use rule value (percentage/amount)
            computedAmount: commissionAmount, // Use computed money amount
            status: 'COMPUTED'
          });
          console.log(`⚠️ No existing commission found, created new COMPUTED commission`);
        } else {
          console.log(`⚠️ No commission rule found, skipping commission creation`);
        }
      }
    }

    // Send notifications
    await notificationService.sendJobCardApproved(updatedJobCard);

    return updatedJobCard;
  }

  async rejectJobCard(jobCardId: string, userId: string, remarks: string): Promise<JobCard> {
    const jobCard = await storage.getJobCard(jobCardId);
    if (!jobCard) {
      throw new Error('Job card not found');
    }

    if (jobCard.status !== 'PENDING_APPROVAL') {
      throw new Error('Job card must be pending approval to reject');
    }

    const updatedJobCard = await storage.updateJobCard(jobCardId, {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectionReason: remarks
    });

    // Create approval record
    await storage.createApproval({
      jobCardId,
      approverUserId: userId,
      status: 'REJECTED',
      remarks
    });

    // Send notification
    await notificationService.sendJobCardRejected(updatedJobCard);

    return updatedJobCard;
  }

  async requestRework(jobCardId: string, userId: string, reason: string): Promise<JobCard> {
    const jobCard = await storage.getJobCard(jobCardId);
    if (!jobCard) {
      throw new Error('Job card not found');
    }

    if (jobCard.status !== 'PENDING_APPROVAL') {
      throw new Error('Job card must be pending approval to request rework');
    }

    const updatedJobCard = await storage.updateJobCard(jobCardId, {
      status: 'REWORK_REQUESTED',
      reworkRequestedAt: new Date(),
      reworkReason: reason
    });

    // Update work order status
    await storage.updateWorkOrder(jobCard.workOrderId, {
      status: 'REWORK_REQUESTED'
    });

    // Create approval record
    await storage.createApproval({
      jobCardId,
      approverUserId: userId,
      status: 'REWORK_REQUESTED',
      remarks: reason
    });

    // Send notification
    await notificationService.sendJobCardReworkRequested(updatedJobCard);

    return updatedJobCard;
  }

  async uploadJobCardMedia(
    jobCardId: string,
    mediaUrl: string,
    type: 'IMAGE' | 'VIDEO',
    caption?: string,
    userId?: string
  ): Promise<JobCardMedia> {
    const jobCard = await storage.getJobCard(jobCardId);
    if (!jobCard) {
      throw new Error('Job card not found');
    }

    // TODO: Validate media URL and set proper ACL
    
    const media = await storage.insertJobCardMedia({
      jobCardId,
      type,
      url: mediaUrl,
      caption
    });

    return media;
  }

  async getJobCardWithMedia(jobCardId: string): Promise<any> {
    const jobCard = await storage.getJobCard(jobCardId);
    if (!jobCard) {
      throw new Error('Job card not found');
    }

    // Get associated media
    const media = await storage.getJobCardMedia({ jobCardId });

    return {
      ...jobCard,
      media
    };
  }
}

export const jobCardService = new JobCardService();
