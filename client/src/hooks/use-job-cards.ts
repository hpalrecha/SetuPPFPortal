import { useQuery } from "@tanstack/react-query";
import type { JobCard, WorkOrder, Service, VehicleModel, Partner, Oem } from "@shared/schema";

// UI-only type that includes the nested objects required by components
export interface JobCardView extends JobCard {
  workOrder?: {
    id: string;
    vehicleModelId: string;
    serviceId: string;
    vehicleModel?: {
      id: string;
      modelName: string;
      oem?: {
        id: string;
        name: string;
      };
    };
    service?: {
      id: string;
      name: string;
    };
  };
  partner?: {
    id: string;
    displayName: string;
  };
}

export function useJobCards() {
  return useQuery({
    queryKey: ["/api/job-cards"],
    queryFn: async (): Promise<JobCardView[]> => {
      const response = await fetch('/api/job-cards', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch job cards');
      }
      
      const jobCards: JobCard[] = await response.json();
      
      // Extract unique IDs for batch fetching
      const workOrderIds = Array.from(new Set(jobCards.map(jc => jc.workOrderId).filter(Boolean)));
      const serviceIds = new Set<string>();
      const vehicleModelIds = new Set<string>();
      const partnerIds = Array.from(new Set(jobCards.map(jc => jc.partnerId).filter(Boolean)));
      
      // Fetch related work orders
      const workOrders: WorkOrder[] = workOrderIds.length > 0 ? await Promise.all(
        workOrderIds.map(async (id) => {
          const res = await fetch(`/api/work-orders/${id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
            credentials: 'include',
          });
          return res.ok ? res.json() : null;
        })
      ).then(results => results.filter(Boolean)) : [];
      
      // Collect service and vehicle model IDs from work orders
      workOrders.forEach(wo => {
        if (wo.serviceId) serviceIds.add(wo.serviceId);
        if (wo.vehicleModelId) vehicleModelIds.add(wo.vehicleModelId);
      });
      
      // Fetch services, vehicle models, and partners in parallel
      const [services, vehicleModels, partners] = await Promise.all([
        serviceIds.size > 0 ? Promise.all(Array.from(serviceIds).map(async (id) => {
          const res = await fetch(`/api/services/${id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
            credentials: 'include',
          });
          return res.ok ? res.json() : null;
        })).then(results => results.filter(Boolean)) : [],
        
        vehicleModelIds.size > 0 ? Promise.all(Array.from(vehicleModelIds).map(async (id) => {
          const res = await fetch(`/api/vehicle-models/${id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
            credentials: 'include',
          });
          return res.ok ? res.json() : null;
        })).then(results => results.filter(Boolean)) : [],
        
        partnerIds.length > 0 ? Promise.all(partnerIds.map(async (id) => {
          const res = await fetch(`/api/partners/${id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
            credentials: 'include',
          });
          return res.ok ? res.json() : null;
        })).then(results => results.filter(Boolean)) : []
      ]);
      
      // Get unique OEM IDs from vehicle models
      const oemIds = Array.from(new Set(vehicleModels.map(vm => vm.oemId).filter(Boolean)));
      
      // Fetch OEMs (brands)
      const oems: Oem[] = oemIds.length > 0 ? await Promise.all(
        oemIds.map(async (id) => {
          const res = await fetch(`/api/oems/${id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
            credentials: 'include',
          });
          return res.ok ? res.json() : null;
        })
      ).then(results => results.filter(Boolean)) : [];
      
      // Create lookup maps for efficient data joining
      const workOrderMap = new Map(workOrders.map(wo => [wo.id, wo]));
      const serviceMap = new Map(services.map(s => [s.id, s]));
      const vehicleModelMap = new Map(vehicleModels.map(vm => [vm.id, vm]));
      const oemMap = new Map(oems.map(o => [o.id, o]));
      const partnerMap = new Map(partners.map(p => [p.id, p]));
      
      // Enrich job cards with related data
      const enrichedJobCards: JobCardView[] = jobCards.map(jobCard => {
        const enriched: JobCardView = { ...jobCard };
        
        // Add work order with nested data
        if (jobCard.workOrderId) {
          const workOrder = workOrderMap.get(jobCard.workOrderId);
          if (workOrder) {
            enriched.workOrder = {
              id: workOrder.id,
              vehicleModelId: workOrder.vehicleModelId,
              serviceId: workOrder.serviceId,
            };
            
            // Add vehicle model with brand
            if (workOrder.vehicleModelId) {
              const vehicleModel = vehicleModelMap.get(workOrder.vehicleModelId);
              if (vehicleModel) {
                enriched.workOrder.vehicleModel = {
                  id: vehicleModel.id,
                  modelName: vehicleModel.modelName,
                };
                
                // Add OEM (brand)
                if (vehicleModel.oemId) {
                  const oem = oemMap.get(vehicleModel.oemId);
                  if (oem) {
                    enriched.workOrder.vehicleModel.oem = {
                      id: oem.id,
                      name: oem.name,
                    };
                  }
                }
              }
            }
            
            // Add service
            if (workOrder.serviceId) {
              const service = serviceMap.get(workOrder.serviceId);
              if (service) {
                enriched.workOrder.service = {
                  id: service.id,
                  name: service.name,
                };
              }
            }
          }
        }
        
        // Add partner
        if (jobCard.partnerId) {
          const partner = partnerMap.get(jobCard.partnerId);
          if (partner) {
            enriched.partner = {
              id: partner.id,
              displayName: partner.displayName,
            };
          }
        }
        
        return enriched;
      });
      
      return enrichedJobCards;
    },
    refetchInterval: 30000
  });
}