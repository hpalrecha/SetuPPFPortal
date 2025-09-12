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

function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('auth_user');
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  const headers = setAuthHeader({
    'Content-Type': 'application/json'
  });

  const config: RequestInit = {
    method,
    headers,
    credentials: 'include'
  };

  if (data && method !== 'GET') {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(url, config);

  // Handle authentication errors
  if (response.status === 401) {
    clearAuth();
    window.location.href = '/login';
    throw new Error('Authentication required');
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = response.statusText;
    
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    throw new Error(`${response.status}: ${errorMessage}`);
  }

  return response;
}

export class ApiClient {
  static async get<T>(url: string): Promise<T> {
    const response = await apiRequest('GET', url);
    return response.json();
  }

  static async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await apiRequest('POST', url, data);
    return response.json();
  }

  static async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await apiRequest('PUT', url, data);
    return response.json();
  }

  static async patch<T>(url: string, data?: unknown): Promise<T> {
    const response = await apiRequest('PATCH', url, data);
    return response.json();
  }

  static async delete<T>(url: string): Promise<T> {
    const response = await apiRequest('DELETE', url);
    return response.json();
  }
}
