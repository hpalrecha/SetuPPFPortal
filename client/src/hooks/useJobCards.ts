import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface JobCardFilters {
  status?: string;
  partnerId?: string;
  workOrderId?: string;
  limit?: number;
  offset?: number;
}

export function useJobCards(filters: JobCardFilters = {}) {
  return useQuery({
    queryKey: ["/api/job-cards", filters],
    queryFn: () => api.get("/api/job-cards", filters),
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 seconds
  });
}

export function useJobCard(id: string) {
  return useQuery({
    queryKey: ["/api/job-cards", id],
    queryFn: () => api.get(`/api/job-cards/${id}`),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });
}
