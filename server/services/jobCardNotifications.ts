// Cluster 1 — per-status job-card notifications, matching the agreed lifecycle flow
// (see the Timeline "Flow Blueprint"). Called from the live routes in server/routes.ts
// after each transition (inside setImmediate, so sends never block the response).
//
// Reuses existing infra: notificationService.sendNotification (bell + email, auto-logged to
// notification_logs), emailService templates, whatsappService approved templates, and the
// storage resolvers. Recipient rules:
//   - Supply side : assigned installer/detailer + Partner Admin (getPartnerPrimaryUserId → super-admin fallback)
//   - Demand side : salesperson (else order creator) + showroom manager(s)
import { storage } from '../storage';
import { notificationService } from './notificationService';
import { emailService } from './email-service';
import { whatsappService } from './whatsapp-service';
import { getTemplate, fillTemplate } from './notificationTemplates';

function baseUrl(): string {
  if (process.env.PRODUCTION_URL) return process.env.PRODUCTION_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return process.env.FRONTEND_URL || 'http://localhost:5000';
}

async function loadContext(jobCardId: string) {
  const jobCard = await storage.getJobCard(jobCardId);
  if (!jobCard) return null;
  const workOrder = await storage.getWorkOrder(jobCard.workOrderId);
  if (!workOrder) return null;
  const [partner, vehicleModel, service, showroom] = await Promise.all([
    storage.getPartner(jobCard.partnerId),
    workOrder.vehicleModelId ? storage.getVehicleModel(workOrder.vehicleModelId) : Promise.resolve(undefined),
    workOrder.serviceId ? storage.getService(workOrder.serviceId) : Promise.resolve(undefined),
    workOrder.showroomId ? storage.getShowroom(workOrder.showroomId) : Promise.resolve(undefined),
  ]);
  const vehicleDetails =
    `${vehicleModel?.modelName || 'Vehicle'}` +
    (workOrder.regNo ? ` - ${workOrder.regNo}` : (workOrder.customerName ? ` - ${workOrder.customerName}` : ''));
  const link = `${baseUrl()}/job-cards/${jobCard.id}`;
  return { jobCard, workOrder, partner, vehicleModel, service, showroom, vehicleDetails, link };
}

type Payload = {
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  data?: any;
};

// Deduped send of the given channels to a set of user ids (skips falsy ids).
async function notifyUsers(
  userIds: (string | undefined | null)[],
  payload: Payload,
  channels: ('PUSH' | 'EMAIL' | 'WHATSAPP')[] = ['PUSH', 'EMAIL'],
): Promise<void> {
  const unique = Array.from(new Set(userIds.filter(Boolean))) as string[];
  for (const uid of unique) {
    for (const ch of channels) {
      try {
        await notificationService.sendNotification(uid, ch, payload);
      } catch (e) {
        console.error(`jobCardNotifications: ${ch} to ${uid} failed`, e);
      }
    }
  }
}

// Demand-side contacts for a work order: salesperson (else creator) + showroom manager(s).
async function demandContactIds(workOrder: any): Promise<string[]> {
  const ids: string[] = [];
  if (workOrder.salesPersonId) {
    const u = await storage.getUser(workOrder.salesPersonId);
    if (u) ids.push(u.id);
  }
  if (workOrder.createdByUserId) ids.push(workOrder.createdByUserId);
  if (workOrder.showroomId) {
    const mgrs = await storage.getUsers({ role: 'SHOWROOM_MANAGER', showroomId: workOrder.showroomId });
    ids.push(...mgrs.map((m: any) => m.id));
  }
  return ids;
}

// #3 — On acknowledge, send the "assigned to your team" message to the assigned installer/detailer.
export async function notifyAcknowledged(jobCardId: string): Promise<void> {
  const ctx = await loadContext(jobCardId);
  if (!ctx) return;
  const { jobCard, workOrder, service, showroom, vehicleDetails, link } = ctx;
  const installer = jobCard.assignedInstallerId ? await storage.getUser(jobCard.assignedInstallerId) : undefined;
  if (!installer) return; // no team member yet — the assign endpoint notifies on assignment

  const tpl = await getTemplate('job_card_acknowledged');
  const vars = { jobId: jobCard.id.slice(0, 8), vehicle: vehicleDetails, partner: ctx.partner?.displayName };
  await notifyUsers([installer.id], {
    title: fillTemplate(tpl.emailSubject, vars) || 'Job assigned to your team',
    message: fillTemplate(tpl.emailBody, vars),
    type: 'INFO',
    data: { type: 'job_card_acknowledged', jobCardId: jobCard.id, workOrderId: workOrder.id },
  });

  if (installer.phone && tpl.whatsappActive) {
    try {
      await whatsappService.sendJobCardCreated(
        whatsappService.formatPhoneNumber(installer.phone),
        installer.name,
        jobCard.id.slice(0, 8),
        vehicleDetails,
        showroom?.name || 'Showroom',
        service?.name || 'Service',
        link,
      );
    } catch (e) {
      console.error('notifyAcknowledged: whatsapp failed', e);
    }
  }
}

// #4 — On schedule, notify showroom/salesperson + partner admin + assigned team (internal + external).
export async function notifyScheduled(jobCardId: string): Promise<void> {
  const ctx = await loadContext(jobCardId);
  if (!ctx) return;
  const { jobCard, workOrder, vehicleDetails } = ctx;
  const partnerAdminId = await storage.getPartnerPrimaryUserId(jobCard.partnerId);
  const demand = await demandContactIds(workOrder);
  const when = jobCard.scheduledAt
    ? new Date(jobCard.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'the scheduled time';

  const tpl = await getTemplate('job_card_scheduled');
  const vars = { jobId: jobCard.id.slice(0, 8), vehicle: vehicleDetails, when };
  await notifyUsers([partnerAdminId, jobCard.assignedInstallerId, ...demand], {
    title: fillTemplate(tpl.emailSubject, vars) || 'Job scheduled',
    message: fillTemplate(tpl.emailBody, vars),
    type: 'INFO',
    data: { type: 'job_card_scheduled', jobCardId: jobCard.id, workOrderId: workOrder.id },
  });
}

// Cluster 2 — On reschedule, notify both parties (partner admin + staff + showroom/salesperson).
export async function notifyRescheduled(jobCardId: string): Promise<void> {
  const ctx = await loadContext(jobCardId);
  if (!ctx) return;
  const { jobCard, workOrder, vehicleDetails } = ctx;
  const partnerAdminId = await storage.getPartnerPrimaryUserId(jobCard.partnerId);
  const staff = await storage.getPartnerStaff(jobCard.partnerId);
  const demand = await demandContactIds(workOrder);
  const when = jobCard.scheduledAt
    ? new Date(jobCard.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'a new time';

  const tpl = await getTemplate('job_card_rescheduled');
  const vars = { jobId: jobCard.id.slice(0, 8), vehicle: vehicleDetails, when, reason: jobCard.rescheduleReason || 'not specified' };
  await notifyUsers(
    [partnerAdminId, jobCard.assignedInstallerId, ...staff.map((s: any) => s.id), ...demand],
    {
      title: fillTemplate(tpl.emailSubject, vars) || 'Job rescheduled',
      message: fillTemplate(tpl.emailBody, vars),
      type: 'WARNING',
      data: { type: 'job_card_rescheduled', jobCardId: jobCard.id, workOrderId: workOrder.id },
    },
  );
}

// #4 — On complete, notify EVERYONE (customer + showroom/sales + team + partner) on mail + WhatsApp,
// with the 15-day rework-buffer + car-checkup message.
export async function notifyCompletedCustomer(jobCardId: string): Promise<void> {
  const ctx = await loadContext(jobCardId);
  if (!ctx) return;
  const { jobCard, workOrder, partner, service, vehicleDetails } = ctx;
  const tpl = await getTemplate('job_card_completed_customer');
  const vars = { vehicle: vehicleDetails, customer: workOrder.customerName || undefined, jobId: jobCard.id.slice(0, 8) };
  const subject = fillTemplate(tpl.emailSubject, vars);
  const body = fillTemplate(tpl.emailBody, vars);

  // Customer — structured completion email (carries the buffer/checkup notice) + best-effort WhatsApp.
  if (workOrder.customerEmail) {
    try {
      await emailService.sendJobCardCustomerCompletion(workOrder.customerEmail, {
        customerName: workOrder.customerName || undefined,
        vehicleDetails,
        workOrderNumber: `WO-${workOrder.id.slice(0, 8)}`,
        partnerName: partner?.displayName,
        serviceName: service?.name,
        completedAt: jobCard.completedAt ? new Date(jobCard.completedAt) : new Date(),
      }, subject || undefined);
    } catch (e) { console.error('notifyCompleted: customer email failed', e); }
  }
  if (workOrder.customerPhone) {
    try {
      await whatsappService.sendMessage(
        { to: whatsappService.formatPhoneNumber(workOrder.customerPhone), type: 'text', text: { body } },
        { eventType: 'job_card_completed_customer', relatedEntityType: 'job_card', relatedEntityId: jobCard.id },
      );
    } catch (e) { console.error('notifyCompleted: customer whatsapp failed', e); }
  }

  // Internal + demand — showroom/sales + assigned team + partner admin (email + bell).
  const partnerAdminId = await storage.getPartnerPrimaryUserId(jobCard.partnerId);
  const demand = await demandContactIds(workOrder);
  await notifyUsers([partnerAdminId, jobCard.assignedInstallerId, ...demand], {
    title: subject || 'Job completed',
    message: body,
    type: 'SUCCESS',
    data: { type: 'job_card_completed_customer', jobCardId: jobCard.id, workOrderId: workOrder.id },
  }, ['EMAIL', 'PUSH']);
}

// #10 — On rework, email partner admin + assignee with reason + affected parts + assign-to.
export async function notifyRework(jobCardId: string): Promise<void> {
  const ctx = await loadContext(jobCardId);
  if (!ctx) return;
  const { jobCard, workOrder, vehicleDetails, link } = ctx;
  const details = (jobCard.reworkDetailsJson as any) || {};
  const parts: string[] = Array.isArray(details.parts) ? details.parts : [];
  const assigneeId = jobCard.assignedInstallerId || details.requestedAssigneeId;
  const [assignee, partnerAdminId] = await Promise.all([
    assigneeId ? storage.getUser(assigneeId) : Promise.resolve(undefined),
    storage.getPartnerPrimaryUserId(jobCard.partnerId),
  ]);
  const partnerAdmin = partnerAdminId ? await storage.getUser(partnerAdminId) : undefined;

  const tpl = await getTemplate('job_card_rework');
  const vars = { jobId: jobCard.id.slice(0, 8), vehicle: vehicleDetails, reason: jobCard.reworkReason || 'see details' };
  const emails: string[] = [];
  if (partnerAdmin?.email) emails.push(partnerAdmin.email);
  if (assignee?.email && !emails.includes(assignee.email)) emails.push(assignee.email);
  if (emails.length) {
    try {
      await emailService.sendJobCardReworkNotification(emails, {
        jobCardId: jobCard.id.slice(0, 8),
        workOrderNumber: `WO-${workOrder.id.slice(0, 8)}`,
        vehicleDetails,
        reason: jobCard.reworkReason || '',
        parts,
        assignedTo: assignee?.name,
        jobCardLink: link,
      }, fillTemplate(tpl.emailSubject, vars) || undefined);
    } catch (e) {
      console.error('notifyRework: email failed', e);
    }
  }

  await notifyUsers([partnerAdminId, assigneeId], {
    title: fillTemplate(tpl.emailSubject, vars) || 'Rework requested',
    message: fillTemplate(tpl.emailBody, vars) || `Rework requested for ${vehicleDetails}`,
    type: 'WARNING',
    data: { type: 'job_card_rework', jobCardId: jobCard.id, workOrderId: workOrder.id },
  }, ['PUSH']);
}

// #11 — On approve, email the allocated team + partner admin/super admin + showroom/salesperson.
export async function notifyApproved(jobCardId: string): Promise<void> {
  const ctx = await loadContext(jobCardId);
  if (!ctx) return;
  const { jobCard, workOrder, vehicleDetails } = ctx;
  const partnerAdminId = await storage.getPartnerPrimaryUserId(jobCard.partnerId);
  const demand = await demandContactIds(workOrder);

  const tpl = await getTemplate('job_card_approved');
  const vars = { jobId: jobCard.id.slice(0, 8), vehicle: vehicleDetails };
  await notifyUsers([partnerAdminId, jobCard.assignedInstallerId, ...demand], {
    title: fillTemplate(tpl.emailSubject, vars) || 'Job approved',
    message: fillTemplate(tpl.emailBody, vars),
    type: 'SUCCESS',
    data: { type: 'job_card_approved', jobCardId: jobCard.id, workOrderId: workOrder.id },
  }, ['EMAIL', 'PUSH']);
}

// #5 — 3 hours before the appointment: arrival check to supply, car-ready check to demand.
export async function notifyPre3h(jobCardId: string): Promise<void> {
  const ctx = await loadContext(jobCardId);
  if (!ctx) return;
  const { jobCard, workOrder, vehicleDetails } = ctx;
  const partnerAdminId = await storage.getPartnerPrimaryUserId(jobCard.partnerId);
  const demand = await demandContactIds(workOrder);
  const when = jobCard.scheduledAt
    ? new Date(jobCard.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'soon';
  const vars = { jobId: jobCard.id.slice(0, 8), vehicle: vehicleDetails, when };

  const supplyTpl = await getTemplate('job_arrival_check');
  await notifyUsers([partnerAdminId, jobCard.assignedInstallerId], {
    title: fillTemplate(supplyTpl.emailSubject, vars) || 'Heading to site?',
    message: fillTemplate(supplyTpl.emailBody, vars),
    type: 'WARNING',
    data: { type: 'job_arrival_check', jobCardId: jobCard.id, workOrderId: workOrder.id },
  });

  const demandTpl = await getTemplate('job_car_ready_check');
  await notifyUsers(demand, {
    title: fillTemplate(demandTpl.emailSubject, vars) || 'Is the car ready?',
    message: fillTemplate(demandTpl.emailBody, vars),
    type: 'WARNING',
    data: { type: 'job_car_ready_check', jobCardId: jobCard.id, workOrderId: workOrder.id },
  });
}

// #6 — at the scheduled time: confirm arrival (team + showroom + partner admin/super admin).
export async function notifyAtTime(jobCardId: string): Promise<void> {
  const ctx = await loadContext(jobCardId);
  if (!ctx) return;
  const { jobCard, workOrder, vehicleDetails } = ctx;
  const partnerAdminId = await storage.getPartnerPrimaryUserId(jobCard.partnerId);
  const demand = await demandContactIds(workOrder);
  const vars = { jobId: jobCard.id.slice(0, 8), vehicle: vehicleDetails };
  const tpl = await getTemplate('job_at_time_check');
  await notifyUsers([partnerAdminId, jobCard.assignedInstallerId, ...demand], {
    title: fillTemplate(tpl.emailSubject, vars) || 'Appointment time',
    message: fillTemplate(tpl.emailBody, vars),
    type: 'WARNING',
    data: { type: 'job_at_time_check', jobCardId: jobCard.id, workOrderId: workOrder.id },
  });
}
