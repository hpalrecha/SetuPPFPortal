import { useQuery } from "@tanstack/react-query";
import type { JobCard, WorkOrder, Service, VehicleModel, Partner, Oem } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useOemContext } from "@/hooks/use-oem-context";

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
  const { user } = useAuth();
  const { selectedOemId } = useOemContext();
  
  return useQuery({
    queryKey: ["/api/job-cards", selectedOemId, "v4"],
    enabled: !!user && !!selectedOemId && user.role !== undefined,
    refetchOnWindowFocus: false,
    staleTime: 30000,
    queryFn: async (): Promise<JobCardView[]> => {
      // Get headers with OEM ID
      const token = localStorage.getItem('auth_token');
      
      
      const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
      };
      
      if (selectedOemId) {
        headers['x-oem-id'] = selectedOemId;
      }
      
      const response = await fetch('/api/job-cards', {
        headers,
        credentials: 'include',
      });
      
      
      if (!response.ok) {
        throw new Error(`Failed to fetch job cards: ${response.status} ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error(`Expected JSON response but got ${contentType} from /api/job-cards`);
      }
      
      const jobCards: JobCard[] = await response.json();
      
      
      // Extract unique IDs for batch fetching

      // Extract unique IDs for batch fetching with defensive field mapping
      const workOrderIds = Array.from(new Set(
        jobCards.map(jc => jc.workOrderId || jc.id || (jc as any).jobCard?.workOrderId).filter(Boolean)
      ));
      const serviceIds = new Set<string>();
      const vehicleModelIds = new Set<string>();
      const partnerIds = Array.from(new Set(
        jobCards.map(jc => jc.partnerId || (jc as any).partner?.id || (jc as any).jobCard?.partnerId).filter(Boolean)
      ));

      
      // Fetch related work orders
      const workOrders: WorkOrder[] = workOrderIds.length > 0 ? await Promise.all(
        workOrderIds.map(async (id) => {
          const workOrderHeaders: HeadersInit = { 
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}` 
          };
          if (selectedOemId) {
            workOrderHeaders['x-oem-id'] = selectedOemId;
          }
          
          const res = await fetch(`/api/work-orders/${id}`, {
            headers: workOrderHeaders,
            credentials: 'include',
            cache: 'no-store', // Prevent 304 responses
          });
          return (res.ok || res.status === 304) ? res.json() : null;
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
          const serviceHeaders: HeadersInit = { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` };
          if (selectedOemId) {
            serviceHeaders['x-oem-id'] = selectedOemId;
          }
          const res = await fetch(`/api/services/${id}`, {
            headers: serviceHeaders,
            credentials: 'include',
            cache: 'no-store', // Prevent 304 responses
          });
          return (res.ok || res.status === 304) ? res.json() : null;
        })).then(results => results.filter(Boolean)) : [],
        
        vehicleModelIds.size > 0 ? Promise.all(Array.from(vehicleModelIds).map(async (id) => {
          const vehicleHeaders: HeadersInit = { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` };
          if (selectedOemId) {
            vehicleHeaders['x-oem-id'] = selectedOemId;
          }
          const res = await fetch(`/api/vehicle-models/${id}`, {
            headers: vehicleHeaders,
            credentials: 'include',
            cache: 'no-store', // Prevent 304 responses
          });
          return (res.ok || res.status === 304) ? res.json() : null;
        })).then(results => results.filter(Boolean)) : [],
        
        partnerIds.length > 0 ? Promise.all(partnerIds.map(async (id) => {
          const partnerHeaders: HeadersInit = { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` };
          if (selectedOemId) {
            partnerHeaders['x-oem-id'] = selectedOemId;
          }
          const res = await fetch(`/api/partners/${id}`, {
            headers: partnerHeaders,
            credentials: 'include',
            cache: 'no-store', // Prevent 304 responses
          });
          return (res.ok || res.status === 304) ? res.json() : null;
        })).then(results => results.filter(Boolean)) : []
      ]);
      
      
      // Get unique OEM IDs from vehicle models
      const oemIds = Array.from(new Set(vehicleModels.map(vm => vm.oemId).filter(Boolean)));
      
      // Fetch OEMs (brands)
      const oems: Oem[] = oemIds.length > 0 ? await Promise.all(
        oemIds.map(async (id) => {
          const oemHeaders: HeadersInit = { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` };
          if (selectedOemId) {
            oemHeaders['x-oem-id'] = selectedOemId;
          }
          const res = await fetch(`/api/oems/${id}`, {
            headers: oemHeaders,
            credentials: 'include',
          });
          
          if (!res.ok) {
            console.error(`Failed to fetch OEM ${id}:`, res.status, res.statusText);
            return null;
          }
          
          return res.json();
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
    }
  });
}