import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface WorkOrderFilters {
  status?: string;
  partnerId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function useWorkOrders(filters: WorkOrderFilters = {}) {
  return useQuery({
    queryKey: ["/api/work-orders", "v2", filters], // Cache bust
    queryFn: () => api.get("/api/work-orders", filters),
    refetchOnWindowFocus: false,
    staleTime: 0, // Always fetch fresh data
  });
}

export function useWorkOrder(id: string) {
  return useQuery({
    queryKey: ["/api/work-orders", "v2", id], // Cache bust
    queryFn: () => api.get(`/api/work-orders/${id}`),
    enabled: !!id,
    refetchOnWindowFocus: false,
    staleTime: 0, // Always fetch fresh data
  });
}
