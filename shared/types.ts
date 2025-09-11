// Additional types for commission rules with context
export type CommissionRuleWithContext = {
  id: string;
  oemId: string | null;
  dealershipId: string | null;
  showroomId: string | null;
  salesPersonId: string | null;
  serviceId: string | null;
  serviceCategoryId: string | null;
  type: "PERCENT" | "AMOUNT";
  valueNumeric: string;
  capAmount: string | null;
  floorAmount: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Joined context data
  oem: {
    id: string;
    name: string;
    active: boolean;
  } | null;
  
  dealership: {
    id: string;
    name: string;
    oemId: string;
    active: boolean;
  } | null;
  
  showroom: {
    id: string;
    name: string;
    dealershipId: string;
    active: boolean;
  } | null;
  
  salesPerson: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  
  service: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  
  serviceCategory: {
    id: string;
    name: string;
    description: string | null;
  } | null;
};

export type CommissionResolutionResult = {
  rule: any | null;
  calculatedAmount: number;
  resolutionPath: string;
  appliedCap: boolean;
  appliedFloor: boolean;
};