export interface User {
  id: string;
  email: string;
  phone?: string;
  role: UserRole;
  oemId?: string;
  dealershipId?: string;
  showroomId?: string;
  partnerId?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 
  | 'SUPER_ADMIN'
  | 'OEM_ADMIN'
  | 'DEALERSHIP_ADMIN'
  | 'SHOWROOM_MANAGER'
  | 'SALES_PERSON'
  | 'PARTNER_ADMIN'
  | 'PARTNER_STAFF';

export interface Oem {
  id: string;
  name: string;
  brandCode: string;
  logoUrl?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Dealership {
  id: string;
  oemId: string;
  name: string;
  code: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Showroom {
  id: string;
  dealershipId: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Partner {
  id: string;
  type: 'STUDIO' | 'INSTALLER';
  displayName: string;
  gstin?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleBrand {
  id: string;
  oemId: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface VehicleModel {
  id: string;
  brandId: string;
  modelName: string;
  variant?: string;
  active: boolean;
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  code: string;
  description?: string;
  meta?: any;
  active: boolean;
  createdAt: string;
}

export type WorkOrderStatus = 
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED_PENDING_APPROVAL'
  | 'APPROVED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'REWORK_REQUESTED';

export interface WorkOrder {
  id: string;
  oemId: string;
  dealershipId: string;
  showroomId: string;
  createdByUserId: string;
  status: WorkOrderStatus;
  vehicleBrandId: string;
  vehicleModelId: string;
  variant?: string;
  regNo?: string;
  serviceId: string;
  quantity: number;
  notes?: string;
  salesPersonId?: string;
  assignedPartnerId?: string;
  assignedJobCardId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  estimatedPrice?: string;
  finalPrice?: string;
  submittedAt?: string;
  assignedAt?: string;
  completedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type JobCardStatus = 
  | 'AWAITING_ACK'
  | 'ACKNOWLEDGED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'CLOSED'
  | 'NO_SHOW'
  | 'CANCELLED_BY_CUSTOMER'
  | 'PARTS_PENDING'
  | 'RESCHEDULED'
  | 'REWORK_REQUESTED';

export interface JobCard {
  id: string;
  workOrderId: string;
  partnerId: string;
  status: JobCardStatus;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  checklistJson?: any;
  remarks?: string;
  partnerRemarks?: string;
  approvalRequestedAt?: string;
  approvedAt?: string;
  approvedByUserId?: string;
  pricingSnapshotJson?: any;
  commissionSnapshotJson?: any;
  acknowledgedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  reworkRequestedAt?: string;
  reworkReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PricingRule {
  id: string;
  partnerId: string;
  scope: 'SHOWROOM' | 'DEALERSHIP';
  scopeId: string;
  vehicleModelId?: string;
  serviceId: string;
  priceAmount: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionRule {
  id: string;
  showroomId: string;
  salesPersonId?: string;
  serviceId?: string;
  type: 'PERCENT' | 'AMOUNT';
  valueNumeric: string;
  capAmount?: string;
  floorAmount?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
