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
    queryKey: ["/api/work-orders", filters],
    queryFn: () => api.get("/api/work-orders", filters),
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 seconds
  });
}

export function useWorkOrder(id: string) {
  return useQuery({
    queryKey: ["/api/work-orders", id],
    queryFn: () => api.get(`/api/work-orders/${id}`),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });
}
