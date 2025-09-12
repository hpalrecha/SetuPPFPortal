import { QueryClient, QueryFunction } from "@tanstack/react-query";

const TOKEN_KEY = 'auth_token';

function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getSelectedOemId(): string | null {
  // Get current user to build the storage key
  const userStr = localStorage.getItem('auth_user');
  if (!userStr) return null;
  
  try {
    const user = JSON.parse(userStr);
    if (user?.role === 'PARTNER_ADMIN' || user?.role === 'PARTNER_STAFF') {
      // For partner users, get selected OEM from storage
      return localStorage.getItem(`selected_oem_id_${user.id}`);
    } else {
      // For non-partner users, use their oemId
      return user?.oemId || null;
    }
  } catch {
    return null;
  }
}

function setAuthHeader(headers: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Add OEM ID header for tenant isolation
  const oemId = getSelectedOemId();
  if (oemId) {
    headers['x-oem-id'] = oemId;
  }
  
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Check if data is FormData - if so, don't set Content-Type header and don't stringify
  const isFormData = data instanceof FormData;
  
  const headers = setAuthHeader(
    data && !isFormData ? { "Content-Type": "application/json" } : {}
  );

  const res = await fetch(url, {
    method,
    headers,
    body: isFormData ? data : (data ? JSON.stringify(data) : undefined),
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers = setAuthHeader();
    
    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
