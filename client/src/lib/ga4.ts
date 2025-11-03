// Google Analytics 4 Tracking Utility

declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string | Date,
      config?: Record<string, any>
    ) => void;
    dataLayer?: any[];
  }
}

const GA_MEASUREMENT_ID = 'G-2ELXYG64RE';

// Check if GA4 is loaded
export const isGA4Loaded = (): boolean => {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
};

// Track page views
export const trackPageView = (path: string, title?: string) => {
  if (!isGA4Loaded()) {
    console.warn('GA4 not loaded yet');
    return;
  }

  window.gtag!('config', GA_MEASUREMENT_ID, {
    page_path: path,
    page_title: title || document.title,
  });
};

// Track custom events
export const trackEvent = (
  eventName: string,
  parameters?: Record<string, any>
) => {
  if (!isGA4Loaded()) {
    console.warn('GA4 not loaded yet');
    return;
  }

  window.gtag!('event', eventName, parameters);
};

// Predefined event trackers for common actions
export const GA4Events = {
  // Authentication events
  login: (method: string = 'username') => {
    trackEvent('login', { method });
  },

  logout: () => {
    trackEvent('logout');
  },

  // Work Order events
  createWorkOrder: (oemName?: string) => {
    trackEvent('create_work_order', { oem_name: oemName });
  },

  viewWorkOrder: (workOrderId: string) => {
    trackEvent('view_work_order', { work_order_id: workOrderId });
  },

  updateWorkOrder: (workOrderId: string, status?: string) => {
    trackEvent('update_work_order', {
      work_order_id: workOrderId,
      status,
    });
  },

  // Job Card events
  createJobCard: (workOrderId: string) => {
    trackEvent('create_job_card', { work_order_id: workOrderId });
  },

  viewJobCard: (jobCardId: string) => {
    trackEvent('view_job_card', { job_card_id: jobCardId });
  },

  updateJobCardStatus: (jobCardId: string, status: string) => {
    trackEvent('update_job_card_status', {
      job_card_id: jobCardId,
      status,
    });
  },

  approveJobCard: (jobCardId: string) => {
    trackEvent('approve_job_card', { job_card_id: jobCardId });
  },

  rejectJobCard: (jobCardId: string) => {
    trackEvent('reject_job_card', { job_card_id: jobCardId });
  },

  // Partner events
  createPartner: () => {
    trackEvent('create_partner');
  },

  viewPartner: (partnerId: string) => {
    trackEvent('view_partner', { partner_id: partnerId });
  },

  // Dealership/Showroom events
  createDealership: (oemName?: string) => {
    trackEvent('create_dealership', { oem_name: oemName });
  },

  createShowroom: (dealershipId?: string) => {
    trackEvent('create_showroom', { dealership_id: dealershipId });
  },

  // Bulk operations
  bulkUpload: (type: 'dealerships' | 'showrooms' | 'partners', count: number) => {
    trackEvent('bulk_upload', { type, count });
  },

  // Profile completion
  completeProfile: (userRole: string) => {
    trackEvent('complete_profile', { user_role: userRole });
  },

  verifyEmail: () => {
    trackEvent('verify_email');
  },

  verifyPhone: () => {
    trackEvent('verify_phone');
  },

  // Settings
  updateSettings: (section: string) => {
    trackEvent('update_settings', { section });
  },

  // Search and filter
  search: (searchTerm: string, context?: string) => {
    trackEvent('search', { search_term: searchTerm, context });
  },

  filter: (filterType: string, value: string) => {
    trackEvent('filter', { filter_type: filterType, value });
  },

  // Navigation
  navigateToPage: (pageName: string) => {
    trackEvent('navigate', { page_name: pageName });
  },
};

// User properties setter
export const setUserProperties = (properties: Record<string, any>) => {
  if (!isGA4Loaded()) {
    console.warn('GA4 not loaded yet');
    return;
  }

  window.gtag!('set', 'user_properties', properties);
};
