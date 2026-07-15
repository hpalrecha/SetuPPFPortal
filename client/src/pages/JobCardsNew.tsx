import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOemContext } from '@/hooks/use-oem-context';
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { 
  LayoutGrid, 
  List, 
  Loader2, 
  Eye,
  AlertCircle, 
  Clock, 
  Wrench, 
  CheckCircle2, 
  Trophy, 
  FileText, 
  Zap, 
  Target, 
  Settings, 
  Play,
  Grid3X3,
  User,
  Phone,
  Mail,
  Car,
  Wrench as ServiceIcon,
  Building2,
  Calendar,
  FileCheck,
  MapPin,
  Users,
  CheckCircle,
  XCircle,
  Image,
  CalendarDays,
  Search,
  Receipt,
  MapPinned,
  Package,
  DollarSign,
  Shield,
  Hash,
  Store,
  Download,
  Printer,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import DetailerJobDetailModal from "@/components/job-cards/detailer-job-detail-modal";
import ApprovalModal from "@/components/job-cards/approval-modal";
import { ImageModal } from "@/components/ui/image-modal";
import { ViewPreInstallationModal } from "@/components/modals/ViewPreInstallationModal";
import logoGreen from "@assets/P91 PULSE logo-01_1761139835394.png";

// Enhanced Job Card types to match API structure
interface JobCard {
  id: string;
  workOrderId?: string;
  partnerId?: string;
  assignedInstallerId?: string;
  status: string;
  acknowledgedAt?: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  checklistJson?: string;
  remarks?: string;
  partnerRemarks?: string;
  materialConsumptionJson?: {
    productName?: string;
    batchNumber?: string;
    quantityUsed?: string;
  } | null;
  batchNumbers?: string | string[];
  batchNumberImage?: string;
  approvalRequestedAt?: string;
  approvedAt?: string;
  approvedByUserId?: string;
  pricingSnapshotJson?: string;
  commissionSnapshotJson?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

interface WorkOrder {
  id: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicleModelId?: string;
  vehicleModelName?: string;
  vehicleVariant?: string;
  serviceId?: string;
  serviceName?: string;
  serviceDescription?: string;
  showroomId?: string;
  showroomName?: string;
  dealershipId?: string;
  dealershipName?: string;
  oemId?: string;
  oemName?: string;
  [key: string]: any;
}

interface Partner {
  id: string;
  displayName?: string;
  companyName?: string;
  businessType?: string;
  contactPersonName?: string;
  contactPersonPhone?: string;
  contactPersonEmail?: string;
  [key: string]: any;
}

interface Service {
  id: string;
  name?: string;
  description?: string;
  brandName?: string;
  categoryName?: string;
  [key: string]: any;
}

interface VehicleModel {
  id: string;
  modelName?: string;
  variant?: string;
  oemId?: string;
  oemName?: string;
  [key: string]: any;
}

interface EnrichedJobCard extends JobCard {
  workOrder?: WorkOrder;
  partner?: Partner;
  service?: Service;
  vehicleModel?: VehicleModel;
  customerName?: string;
  vehicleDisplay?: string;
  serviceDisplay?: string;
  partnerDisplay?: string;
  assignedInstaller?: any;
}

type ViewMode = 'list' | 'kanban';

const STATUS_COLORS = {
  'AWAITING_ACK': 'bg-red-100 text-red-800 border-red-200',
  'ACKNOWLEDGED': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'ASSIGNED': 'bg-blue-100 text-blue-800 border-blue-200',
  'SCHEDULED': 'bg-blue-100 text-blue-800 border-blue-200', 
  'IN_PROGRESS': 'bg-blue-100 text-blue-800 border-blue-200',
  'COMPLETED': 'bg-green-100 text-green-800 border-green-200',
  'PENDING_APPROVAL': 'bg-orange-100 text-orange-800 border-orange-200',
  'APPROVED': 'bg-green-100 text-green-800 border-green-200',
  'PENDING_SALES_INVOICE': 'bg-purple-100 text-purple-800 border-purple-200',
  'INVOICE_RAISED': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'WARRANTY_REGISTRATION': 'bg-teal-100 text-teal-800 border-teal-200',
  'CANCELLED': 'bg-red-100 text-red-800 border-red-200',
  'CLOSED': 'bg-gray-100 text-gray-800 border-gray-200'
};

const STATUS_ICONS = {
  'AWAITING_ACK': Clock,
  'ACKNOWLEDGED': CheckCircle2,
  'ASSIGNED': CheckCircle2,
  'SCHEDULED': Clock,
  'IN_PROGRESS': Wrench,
  'COMPLETED': CheckCircle2,
  'PENDING_APPROVAL': AlertCircle,
  'APPROVED': Trophy,
  'PENDING_SALES_INVOICE': DollarSign,
  'INVOICE_RAISED': FileText,
  'WARRANTY_REGISTRATION': Shield,
  'CANCELLED': AlertCircle,
  'CLOSED': Trophy
};

const STATUS_LABELS = {
  'AWAITING_ACK': 'Awaiting Acknowledgment',
  'ACKNOWLEDGED': 'Acknowledged',
  'ASSIGNED': 'Assigned',
  'SCHEDULED': 'Scheduled',
  'IN_PROGRESS': 'In Progress',
  'COMPLETED': 'Completed',
  'PENDING_APPROVAL': 'Pending Approval',
  'APPROVED': 'Approved',
  'PENDING_SALES_INVOICE': 'Pending Invoice',
  'INVOICE_RAISED': 'Invoice Raised',
  'WARRANTY_REGISTRATION': 'Warranty Registered',
  'CANCELLED': 'Cancelled',
  'CLOSED': 'Closed'
};

export default function JobCardsNew() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedJobCard, setSelectedJobCard] = useState<EnrichedJobCard | null>(null);
  const [selectedJobCardId, setSelectedJobCardId] = useState<string | null>(null);
  const [selectedDetailerJobCard, setSelectedDetailerJobCard] = useState<string | null>(null);
  const [selectedApprovalJobCard, setSelectedApprovalJobCard] = useState<string | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [showSettlePaymentModal, setShowSettlePaymentModal] = useState(false);
  const [showApplyWarrantyModal, setShowApplyWarrantyModal] = useState(false);
  const [showViewPreInstallationModal, setShowViewPreInstallationModal] = useState(false);
  const [salesInvoiceNumber, setSalesInvoiceNumber] = useState('');
  const [warrantyReferenceNumber, setWarrantyReferenceNumber] = useState('');
  
  // Handle direct link to specific job card
  const [, params] = useRoute('/job-cards/:id');
  const urlJobCardId = params?.id;
  
  // Search filters state
  const [searchFilters, setSearchFilters] = useState({
    jobCardNumber: '',
    customerName: '',
    status: '',
    partnerId: '',
    showroomId: '',
    vehicleModel: '',
    regNo: '',
    dateFrom: '',
    dateTo: ''
  });
  
  // Sorting state
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Combobox open states
  const [partnerComboboxOpen, setPartnerComboboxOpen] = useState(false);
  const [showroomComboboxOpen, setShowroomComboboxOpen] = useState(false);

  // Live tracking toggle (auto-polls the list while on)
  const [liveTracking, setLiveTracking] = useState(false);
  
  // Get current user for admin check
  const { user } = useAuth();
  const { toast } = useToast();
  const isPartnerUser = user?.role === 'PARTNER_ADMIN' || user?.role === 'PARTNER_STAFF' || user?.role === 'DETAILING_PARTNER';
  const isShowroomUser = user?.role === 'SHOWROOM_MANAGER' || user?.role === 'DEALERSHIP_ADMIN';
  const showPrices = user?.showServicePrices !== false;
  const { selectedOemId } = useOemContext();

  // Fetch and enrich job cards with related data.
  // Live Tracking refetches every 10s; otherwise no polling.
  const { data: allJobCards = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['jobCards'],
    refetchInterval: liveTracking ? 10000 : false,
    queryFn: async (): Promise<EnrichedJobCard[]> => {
      // Fetch job cards using the proper apiRequest function
      const response = await apiRequest('GET', '/api/job-cards');
      const rawJobCards: JobCard[] = await response.json();
      // Extract unique IDs for batch fetching
      const workOrderIds = Array.from(new Set(
        rawJobCards.map(jc => jc.workOrderId).filter(Boolean)
      ));
      const partnerIds = Array.from(new Set(
        rawJobCards.map(jc => jc.partnerId).filter(Boolean)
      ));
      

      // Fetch related data in parallel (batched to avoid N+1 requests / 403 spam)
      const [workOrdersData, partnersData] = await Promise.all([
        // Work orders: one scoped list call, with per-id fallback for any not
        // returned (e.g. partner-scoped users whose list omits some referenced WOs)
        (async () => {
          if (workOrderIds.length === 0) return [];
          let list: WorkOrder[] = [];
          try {
            const res = await apiRequest('GET', '/api/work-orders');
            list = await res.json();
          } catch {
            list = [];
          }
          const map = new Map(list.map((wo: WorkOrder) => [wo.id, wo]));
          const missing = workOrderIds.filter((id) => !map.has(id as string));
          const fetched = await Promise.all(
            missing.map(async (id) => {
              try {
                const res = await apiRequest('GET', `/api/work-orders/${id}`);
                return await res.json();
              } catch {
                return null;
              }
            })
          );
          return [
            ...workOrderIds.map((id) => map.get(id as string)).filter(Boolean),
            ...fetched.filter(Boolean),
          ];
        })(),

        // Partners: single bulk call per 100 ids (avoids N requests and the
        // per-partner 403 "Access denied to this partner" errors)
        (async () => {
          if (partnerIds.length === 0) return [];
          const chunks: string[][] = [];
          for (let i = 0; i < partnerIds.length; i += 100) {
            chunks.push(partnerIds.slice(i, i + 100) as string[]);
          }
          const results = await Promise.all(
            chunks.map(async (ids) => {
              try {
                const res = await apiRequest('POST', '/api/partners/bulk', { ids });
                return await res.json();
              } catch (error) {
                console.error('❌ Error fetching partners (bulk):', error);
                return [];
              }
            })
          );
          return results.flat();
        })(),
      ]);

      // Create lookup maps
      const workOrderMap = new Map(workOrdersData.map((wo: WorkOrder) => [wo.id, wo]));
      const partnerMap = new Map(partnersData.map((p: Partner) => [p.id, p]));
      
      
      // Enrich job cards with related data
      const enrichedJobCards: EnrichedJobCard[] = rawJobCards.map(jobCard => {
        const workOrder = workOrderMap.get(jobCard.workOrderId || '');
        const partner = partnerMap.get(jobCard.partnerId || '');
        

        const enriched: EnrichedJobCard = {
          ...jobCard,
          workOrder,
          partner,
          // Create display strings using proper data sources
          customerName: workOrder?.customerName || 'N/A',
          vehicleDisplay: workOrder?.vehicleModelName 
            ? `${workOrder.oemName || ''} ${workOrder.vehicleModelName}${workOrder.vehicleVariant ? ` (${workOrder.vehicleVariant})` : ''}`.trim()
            : 'N/A',
          serviceDisplay: workOrder?.serviceName || 'N/A',
          partnerDisplay: partner?.displayName || (jobCard.partnerId ? 'Partner Info Loading...' : 'Unassigned Partner')
        };

        return enriched;
      });
      
      return enrichedJobCards;
    }
  });

  // Fetch all partners for the combobox filter
  const { data: allPartners = [] } = useQuery({
    queryKey: ['partners-filter'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/partners');
      const data = await response.json();
      return Array.isArray(data) ? data : (data.partners || []);
    },
    staleTime: 5 * 60 * 1000
  });

  // Fetch all showrooms for the combobox filter
  const { data: allShowrooms = [] } = useQuery({
    queryKey: ['showrooms-filter'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/showrooms');
      const data = await response.json();
      return Array.isArray(data) ? data : (data.showrooms || []);
    },
    staleTime: 5 * 60 * 1000
  });

  // Apply search filters to job cards
  const filteredJobCards = allJobCards.filter((jobCard) => {
    const jobCardNumber = `JC-${jobCard.id.slice(-6)}`.toLowerCase();
    const status = (jobCard.status || '').toUpperCase();
    const vehicleModel = (jobCard.vehicleDisplay || '').toLowerCase();
    const showroomId = jobCard.workOrder?.showroomId || '';
    const partnerId = jobCard.partnerId || '';
    const regNo = (jobCard.workOrder?.regNo || '').toLowerCase();
    const customerName = (jobCard.workOrder?.customerName || '').toLowerCase();
    const createdAt = jobCard.createdAt ? new Date(jobCard.createdAt) : null;

    // Date filter logic
    let dateMatch = true;
    if (searchFilters.dateFrom) {
      const fromDate = new Date(searchFilters.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      if (!createdAt || createdAt < fromDate) dateMatch = false;
    }
    if (searchFilters.dateTo) {
      const toDate = new Date(searchFilters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (!createdAt || createdAt > toDate) dateMatch = false;
    }

    return (
      (!searchFilters.jobCardNumber || jobCardNumber.includes(searchFilters.jobCardNumber.toLowerCase())) &&
      (!searchFilters.customerName || customerName.includes(searchFilters.customerName.toLowerCase())) &&
      (!searchFilters.status || status === searchFilters.status) &&
      (!searchFilters.partnerId || partnerId === searchFilters.partnerId) &&
      (!searchFilters.showroomId || showroomId === searchFilters.showroomId) &&
      (!searchFilters.vehicleModel || vehicleModel.includes(searchFilters.vehicleModel.toLowerCase())) &&
      (!searchFilters.regNo || regNo.includes(searchFilters.regNo.toLowerCase())) &&
      dateMatch
    );
  });

  // Sort filtered job cards
  const sortedJobCards = [...filteredJobCards].sort((a, b) => {
    let aVal: any, bVal: any;
    
    switch (sortField) {
      case 'createdAt':
        aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        break;
      case 'status':
        aVal = a.status || '';
        bVal = b.status || '';
        break;
      case 'customerName':
        aVal = a.customerName?.toLowerCase() || '';
        bVal = b.customerName?.toLowerCase() || '';
        break;
      case 'partner':
        aVal = a.partnerDisplay?.toLowerCase() || '';
        bVal = b.partnerDisplay?.toLowerCase() || '';
        break;
      default:
        aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    }
    
    if (sortOrder === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedJobCards.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const jobCards = sortedJobCards.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilters, sortField, sortOrder]);

  // Fetch detailed job card data including media when one is selected
  const { data: detailedJobCard } = useQuery({
    queryKey: ['/api/job-cards', selectedJobCardId],
    queryFn: async () => {
      if (!selectedJobCardId) return null;
      const response = await apiRequest('GET', `/api/job-cards/${selectedJobCardId}`);
      return response.json();
    },
    enabled: !!selectedJobCardId
  });

  // Handle direct link to specific job card from URL
  useEffect(() => {
    if (urlJobCardId && !isLoading) {
      // Find the job card in the list
      const jobCard = allJobCards.find(jc => jc.id === urlJobCardId);
      if (jobCard) {
        // Open the job card modal/detail view
        if (isPartnerUser) {
          setSelectedDetailerJobCard(urlJobCardId);
        } else {
          setSelectedJobCardId(urlJobCardId);
          setSelectedJobCard(jobCard);
        }
      } else if (allJobCards.length > 0) {
        // Job card not found in list - might need to fetch directly
        console.warn(`Job card ${urlJobCardId} not found in list, attempting direct fetch`);
        setSelectedJobCardId(urlJobCardId);
      }
    }
  }, [urlJobCardId, allJobCards, isLoading, isPartnerUser]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid Date';
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return 'Invalid Date';
    }
  };

  // Export job cards to Excel
  const exportToExcel = () => {
    const exportData = sortedJobCards.map((jc) => {
      let completedDateVal = 'N/A';
      if (jc.completedAt) {
        if (jc.startedAt) {
          const duration = new Date(jc.completedAt).getTime() - new Date(jc.startedAt).getTime();
          if (duration > 24 * 60 * 60 * 1000) {
            completedDateVal = 'Job Started';
          } else {
            completedDateVal = formatDateTime(jc.completedAt);
          }
        } else {
          completedDateVal = formatDateTime(jc.completedAt);
        }
      }

      return {
        'Job Card ID': `JC-${jc.id.slice(-6)}`,
        'Work Order ID': jc.workOrderId ? `WO-${jc.workOrderId.slice(-6)}` : 'N/A',
        'Status': jc.status,
        'Customer Name': jc.workOrder?.customerName || 'N/A',
        'Customer Phone': jc.workOrder?.customerPhone || 'N/A',
        'Customer Email': jc.workOrder?.customerEmail || 'N/A',
        'Customer Address': jc.workOrder?.customerAddress || 'N/A',
        'Vehicle Model': jc.vehicleDisplay || 'N/A',
        'Vehicle Color': jc.workOrder?.color || 'N/A',
        'Reg No': jc.workOrder?.regNo || 'N/A',
        'Service': jc.serviceDisplay || 'N/A',
        'Partner': jc.partnerDisplay || 'N/A',
        'Installer / Detailer': jc.assignedInstaller?.name || 'N/A',
        'Showroom': jc.workOrder?.showroomName || 'N/A',
        'Dealership': jc.workOrder?.dealershipName || 'N/A',
        'OEM': jc.workOrder?.oemName || 'N/A',
        'Created Date': formatDate(jc.createdAt),
        'Scheduled Date': formatDate(jc.scheduledDate),
        'Acknowledged Date': jc.acknowledgedAt ? formatDateTime(jc.acknowledgedAt) : 'N/A',
        'Completed Date': completedDateVal,
        'Approved Date': jc.approvedAt ? formatDateTime(jc.approvedAt) : 'N/A',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Job Cards');
    
    // Auto-size columns
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    worksheet['!cols'] = colWidths;
    
    XLSX.writeFile(workbook, `job-cards-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: 'Export Complete', description: `Exported ${exportData.length} job cards to Excel` });
  };

  // Print individual job card
  const printJobCard = (jobCard: JobCard) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: 'Error', description: 'Please allow popups to print', variant: 'destructive' });
      return;
    }

    const statusLabels: Record<string, string> = {
      'AWAITING_ACK': 'Awaiting Acknowledgment',
      'ACKNOWLEDGED': 'Acknowledged',
      'IN_PROGRESS': 'In Progress',
      'COMPLETED': 'Completed',
      'PENDING_APPROVAL': 'Pending Approval',
      'APPROVED': 'Approved',
      'PENDING_SALES_INVOICE': 'Pending Sales Invoice',
      'INVOICE_RAISED': 'Invoice Raised',
      'WARRANTY_REGISTRATION': 'Warranty Registered',
      'CANCELLED': 'Cancelled',
      'CLOSED': 'Closed'
    };

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Job Card - ${jobCard.id}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 10px; line-height: 1.3; color: #333; }
          .header { text-align: center; border-bottom: 2px solid #1a5f2a; padding-bottom: 10px; margin-bottom: 12px; }
          .header h1 { font-size: 20px; color: #1a5f2a; margin-bottom: 4px; }
          .header .ids { font-size: 11px; color: #666; margin-bottom: 6px; }
          .header .ids div { margin: 2px 0; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 10px; }
          .status-AWAITING_ACK { background: #fee2e2; color: #dc2626; }
          .status-ACKNOWLEDGED { background: #fef3c7; color: #d97706; }
          .status-IN_PROGRESS { background: #dbeafe; color: #2563eb; }
          .status-COMPLETED { background: #dcfce7; color: #16a34a; }
          .status-PENDING_APPROVAL { background: #fed7aa; color: #ea580c; }
          .status-APPROVED { background: #bbf7d0; color: #15803d; }
          .status-PENDING_SALES_INVOICE { background: #e0e7ff; color: #4f46e5; }
          .status-INVOICE_RAISED { background: #c7d2fe; color: #4338ca; }
          .status-WARRANTY_REGISTRATION { background: #a5f3fc; color: #0891b2; }
          .status-CANCELLED { background: #fecaca; color: #b91c1c; }
          .status-CLOSED { background: #d1d5db; color: #374151; }
          .section { margin-bottom: 10px; page-break-inside: avoid; }
          .section-title { font-size: 11px; font-weight: bold; color: #1a5f2a; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-bottom: 6px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
          .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 12px; }
          .grid-5 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap: 4px 8px; }
          .field { margin-bottom: 4px; }
          .field-label { font-weight: bold; color: #666; font-size: 9px; text-transform: uppercase; }
          .field-value { font-size: 10px; word-wrap: break-word; }
          .billing-box { background: #f9fafb; padding: 8px; border-radius: 4px; border: 1px solid #e5e7eb; margin-bottom: 4px; }
          .billing-box .title { font-weight: bold; font-size: 10px; margin-bottom: 4px; color: #1a5f2a; }
          .photos-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin-top: 6px; }
          .photo-item { text-align: center; }
          .photo-item img { max-width: 100%; max-height: 120px; border: 1px solid #ddd; border-radius: 4px; }
          .photo-label { font-size: 9px; font-weight: bold; color: #666; margin-top: 2px; }
          .remarks-box { background: #f9fafb; padding: 6px; border-radius: 4px; border: 1px solid #e5e7eb; font-size: 10px; }
          .settlement-box { background: #f0fdf4; padding: 6px; border-radius: 4px; border: 1px solid #bbf7d0; }
          .footer { margin-top: 15px; padding-top: 8px; border-top: 1px solid #ddd; text-align: center; font-size: 8px; color: #999; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header" style="text-align: left; display: flex; align-items: flex-start; gap: 20px;">
          <img src="${logoGreen}" alt="P91 Pulse VAS" style="height: 60px;" />
          <div style="flex: 1;">
            <h1 style="margin-bottom: 4px;">Job Card</h1>
            <div class="ids">
              <div><strong>Job Card ID:</strong> ${jobCard.id}</div>
              <div><strong>Work Order ID:</strong> ${jobCard.workOrderId || 'N/A'}</div>
            </div>
            <div style="margin-top: 6px;">
              <span class="status-badge status-${jobCard.status}">${statusLabels[jobCard.status] || jobCard.status.replace(/_/g, ' ')}</span>
            </div>
            <div style="font-size: 9px; color: #666; margin-top: 6px;">
              Created: ${formatDateTime(jobCard.createdAt)} | Updated: ${formatDateTime(jobCard.updatedAt)}
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Customer Information</div>
          <div class="grid">
            <div class="field">
              <div class="field-label">Name</div>
              <div class="field-value">${jobCard.workOrder?.customerName || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">Phone</div>
              <div class="field-value">${jobCard.workOrder?.customerPhone || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">Email</div>
              <div class="field-value">${jobCard.workOrder?.customerEmail || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">Address</div>
              <div class="field-value">${jobCard.workOrder?.customerAddress || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Vehicle & Service</div>
          <div class="grid">
            <div class="field">
              <div class="field-label">Vehicle Model</div>
              <div class="field-value">${jobCard.vehicleDisplay || jobCard.workOrder?.vehicleModelName || jobCard.workOrder?.vehicleModel?.modelName || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">Registration No</div>
              <div class="field-value">${jobCard.workOrder?.regNo || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">VIN Number</div>
              <div class="field-value">${jobCard.workOrder?.regNo || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">Color</div>
              <div class="field-value">${jobCard.workOrder?.color || 'N/A'}</div>
            </div>
            <div class="field" style="grid-column: span 2;">
              <div class="field-label">Service</div>
              <div class="field-value">${jobCard.serviceDisplay || 'N/A'}</div>
            </div>
            ${(jobCard.workOrder?.serviceDescription || jobCard.workOrder?.serviceCategory?.description) ? `
            <div class="field" style="grid-column: span 2;">
              <div class="field-label">Description</div>
              <div class="field-value">${jobCard.workOrder?.serviceDescription || jobCard.workOrder?.serviceCategory?.description}</div>
            </div>
            ` : ''}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Order Placed By</div>
          <div class="grid-3">
            <div class="field">
              <div class="field-label">Showroom</div>
              <div class="field-value">${jobCard.workOrder?.showroomName || jobCard.workOrder?.showroom?.name || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">Dealership</div>
              <div class="field-value">${jobCard.workOrder?.dealershipName || jobCard.workOrder?.dealership?.name || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">OEM</div>
              <div class="field-value">${jobCard.workOrder?.oemName || jobCard.workOrder?.oem?.name || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Partner Information</div>
          <div class="grid">
            <div class="field">
              <div class="field-label">Partner</div>
              <div class="field-value">${jobCard.partnerDisplay || jobCard.partner?.displayName || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">Business Type</div>
              <div class="field-value">${jobCard.partner?.businessType || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">Contact Person</div>
              <div class="field-value">${jobCard.partner?.contactPersonName || jobCard.partner?.primaryContactName || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">Contact Phone</div>
              <div class="field-value">${jobCard.partner?.contactPersonPhone || jobCard.partner?.primaryContactPhone || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Timeline</div>
          <div class="grid-5">
            <div class="field">
              <div class="field-label">Acknowledged</div>
              <div class="field-value">${jobCard.acknowledgedAt ? formatDateTime(jobCard.acknowledgedAt) : 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">Scheduled</div>
              <div class="field-value">${jobCard.scheduledDate ? formatDateTime(jobCard.scheduledDate) : (jobCard.scheduledAt ? formatDateTime(jobCard.scheduledAt) : 'N/A')}</div>
            </div>
            <div class="field">
              <div class="field-label">Started</div>
              <div class="field-value">${jobCard.startTime ? formatDateTime(jobCard.startTime) : 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">Completed</div>
              <div class="field-value">${jobCard.completedAt ? formatDateTime(jobCard.completedAt) : 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">Approved</div>
              <div class="field-value">${jobCard.approvedAt ? formatDateTime(jobCard.approvedAt) : 'N/A'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Additional Details</div>
          <div class="grid">
            <div class="field">
              <div class="field-label">Job Card Billing Value</div>
              <div class="field-value">${jobCard.invoiceAmount ? '₹' + parseFloat(String(jobCard.invoiceAmount)).toLocaleString('en-IN', {minimumFractionDigits: 2}) : 'Not set'}</div>
            </div>
            <div class="field">
              <div class="field-label">Assigned Installer</div>
              <div class="field-value">${jobCard.assignedInstaller?.name || 'Not assigned'}</div>
            </div>
            ${jobCard.remarks ? `
            <div class="field" style="grid-column: span 2;">
              <div class="field-label">Remarks</div>
              <div class="field-value">${jobCard.remarks}</div>
            </div>
            ` : ''}
            ${jobCard.batchNumbers ? `
            <div class="field" style="grid-column: span 2;">
              <div class="field-label">Batch Numbers</div>
              <div class="field-value">${jobCard.batchNumbers}</div>
            </div>
            ` : ''}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Billing Information</div>
          <div class="grid">
            <div class="billing-box">
              <div class="title">Bill From</div>
              <div class="field-value">${jobCard.billFromName || jobCard.workOrder?.billFromName || 'N/A'}</div>
              <div class="field-value" style="font-size: 9px; color: #666;">${jobCard.billFromAddress || jobCard.workOrder?.billFromAddress || ''}</div>
              ${(jobCard.billFromGstin || jobCard.workOrder?.billFromGstin) ? `<div class="field-value" style="font-size: 9px;">GSTIN: ${jobCard.billFromGstin || jobCard.workOrder?.billFromGstin}</div>` : ''}
            </div>
            <div class="billing-box">
              <div class="title">Bill To${jobCard.billToType || jobCard.workOrder?.billToType ? ` (${jobCard.billToType || jobCard.workOrder?.billToType})` : ''}</div>
              <div class="field-value">${jobCard.billToName || jobCard.workOrder?.billToName || 'N/A'}</div>
              <div class="field-value" style="font-size: 9px; color: #666;">${jobCard.billToAddress || jobCard.workOrder?.billToAddress || ''}</div>
              ${(jobCard.billToGstin || jobCard.workOrder?.billToGstin) ? `<div class="field-value" style="font-size: 9px;">GSTIN: ${jobCard.billToGstin || jobCard.workOrder?.billToGstin}</div>` : ''}
            </div>
          </div>
        </div>

        ${(jobCard.preInstallationPhotoFront || jobCard.preInstallationPhotoBack || jobCard.preInstallationPhotoLeft || jobCard.preInstallationPhotoRight) ? `
        <div class="section">
          <div class="section-title">Pre-Installation Photos</div>
          <div class="photos-grid">
            ${jobCard.preInstallationPhotoFront ? `<div class="photo-item"><img src="${jobCard.preInstallationPhotoFront}" alt="Front" /><div class="photo-label">Front</div></div>` : '<div class="photo-item"><div style="height:120px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;color:#999;">No Photo</div><div class="photo-label">Front</div></div>'}
            ${jobCard.preInstallationPhotoBack ? `<div class="photo-item"><img src="${jobCard.preInstallationPhotoBack}" alt="Back" /><div class="photo-label">Back</div></div>` : '<div class="photo-item"><div style="height:120px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;color:#999;">No Photo</div><div class="photo-label">Back</div></div>'}
            ${jobCard.preInstallationPhotoLeft ? `<div class="photo-item"><img src="${jobCard.preInstallationPhotoLeft}" alt="Left Side" /><div class="photo-label">Left Side</div></div>` : '<div class="photo-item"><div style="height:120px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;color:#999;">No Photo</div><div class="photo-label">Left Side</div></div>'}
            ${jobCard.preInstallationPhotoRight ? `<div class="photo-item"><img src="${jobCard.preInstallationPhotoRight}" alt="Right Side" /><div class="photo-label">Right Side</div></div>` : '<div class="photo-item"><div style="height:120px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;color:#999;">No Photo</div><div class="photo-label">Right Side</div></div>'}
          </div>
          ${jobCard.preInstallationRemarks ? `<div class="remarks-box" style="margin-top: 6px;"><strong>Pre-Installation Remarks:</strong> ${jobCard.preInstallationRemarks}</div>` : ''}
        </div>
        ` : ''}

        ${(jobCard.materialConsumptionJson || jobCard.batchNumbers || jobCard.batchNumberImage) ? `
        <div class="section">
          <div class="section-title">Material Consumption</div>
          <div class="grid">
            ${jobCard.materialConsumptionJson?.productName ? `<div><div class="field-label">Product Name</div><div class="field-value">${jobCard.materialConsumptionJson.productName}</div></div>` : ''}
            ${(jobCard.materialConsumptionJson?.batchNumber || jobCard.batchNumbers) ? `<div><div class="field-label">Batch Number</div><div class="field-value">${jobCard.materialConsumptionJson?.batchNumber || jobCard.batchNumbers}</div></div>` : ''}
            ${jobCard.materialConsumptionJson?.quantityUsed ? `<div><div class="field-label">Quantity Used</div><div class="field-value">${jobCard.materialConsumptionJson.quantityUsed}</div></div>` : ''}
          </div>
          ${jobCard.batchNumberImage ? `
          <div style="margin-top: 10px;">
            <div class="field-label">Batch Number Image</div>
            <img src="${jobCard.batchNumberImage}" alt="Batch Number" style="max-width: 200px; max-height: 150px; border: 1px solid #ddd; border-radius: 4px; margin-top: 4px;" />
          </div>
          ` : ''}
        </div>
        ` : ''}

        ${(jobCard.salesInvoiceNumber || jobCard.warrantyReferenceNumber) ? `
        <div class="section">
          <div class="section-title">Settlement Actions</div>
          <div class="grid">
            ${jobCard.salesInvoiceNumber ? `
            <div class="settlement-box">
              <div class="field-label">Payment Settlement</div>
              <div class="field-value">Settled${jobCard.settledAt ? ` on ${formatDateTime(jobCard.settledAt)}` : ''}</div>
              <div class="field-value"><strong>Invoice:</strong> ${jobCard.salesInvoiceNumber}</div>
            </div>
            ` : ''}
            ${jobCard.warrantyReferenceNumber ? `
            <div class="settlement-box">
              <div class="field-label">E-Warranty</div>
              <div class="field-value">Applied${jobCard.warrantyAppliedAt ? ` on ${formatDateTime(jobCard.warrantyAppliedAt)}` : ''}</div>
              <div class="field-value"><strong>Ref:</strong> ${jobCard.warrantyReferenceNumber}</div>
            </div>
            ` : ''}
          </div>
        </div>
        ` : ''}

        <div class="footer">
          Printed on ${format(new Date(), 'MMM dd, yyyy HH:mm')} | Pulse VAS System
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // Admin approval mutations
  const approveJobCardMutation = useMutation({
    mutationFn: async (jobCardId: string) => {
      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/approve`, {
        remarks: 'Approved by admin'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      setSelectedJobCard(null);
    }
  });

  const rejectJobCardMutation = useMutation({
    mutationFn: async ({ jobCardId, reason }: { jobCardId: string; reason: string }) => {
      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/request-rework`, {
        remarks: reason
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      setSelectedJobCard(null);
    }
  });

  // Settlement mutations
  const settlePaymentMutation = useMutation({
    mutationFn: async ({ jobCardId, salesInvoiceNumber }: { jobCardId: string; salesInvoiceNumber: string }) => {
      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/settle-payment`, {
        salesInvoiceNumber
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      setShowSettlePaymentModal(false);
      setSalesInvoiceNumber('');
      toast({
        title: "Payment Settled",
        description: "Sales invoice number has been recorded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to settle payment",
        variant: "destructive"
      });
    }
  });

  const applyWarrantyMutation = useMutation({
    mutationFn: async ({ jobCardId, warrantyReferenceNumber }: { jobCardId: string; warrantyReferenceNumber: string }) => {
      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/apply-warranty`, {
        warrantyReferenceNumber
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      setShowApplyWarrantyModal(false);
      setWarrantyReferenceNumber('');
      toast({
        title: "Warranty Applied",
        description: "E-warranty reference number has been recorded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to apply warranty",
        variant: "destructive"
      });
    }
  });

  const requestEWarrantyMutation = useMutation({
    mutationFn: async (jobCardId: string) => {
      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/request-e-warranty`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      toast({
        title: "E-Warranty Requested",
        description: "E-warranty application has been submitted. Notification emails have been sent to STEK India.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to request e-warranty. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Check if user is admin 
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'OEM_ADMIN' || user?.role === 'SHOWROOM_MANAGER' || user?.role === 'DEALERSHIP_ADMIN';
  console.log('User role:', user?.role, 'isAdmin:', isAdmin);

  const getStatusBadge = (status: string) => {
    const StatusIcon = STATUS_ICONS[status as keyof typeof STATUS_ICONS] || Clock;
    return (
      <Badge className={STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'bg-gray-500 text-white'}>
        <StatusIcon className="w-3 h-3 mr-1" />
        {STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status}
      </Badge>
    );
  };

  const getProgressValue = (status: string) => {
    const progressMap: Record<string, number> = {
      AWAITING_ACK: 10,
      ACKNOWLEDGED: 25,
      ASSIGNED: 40,
      SCHEDULED: 40,
      IN_PROGRESS: 60,
      COMPLETED: 80,
      PENDING_APPROVAL: 90,
      APPROVED: 92,
      PENDING_SALES_INVOICE: 94,
      INVOICE_RAISED: 96,
      WARRANTY_REGISTRATION: 98,
      CLOSED: 100
    };
    return progressMap[status] || 0;
  };

  // Group job cards by status for Kanban view
  const groupedJobCards = {
    AWAITING_ACK: jobCards.filter(jc => jc.status === 'AWAITING_ACK'),
    IN_PROGRESS: jobCards.filter(jc => jc.status && ['ACKNOWLEDGED', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS'].includes(jc.status)),
    PENDING_APPROVAL: jobCards.filter(jc => jc.status === 'PENDING_APPROVAL'),
    COMPLETED: jobCards.filter(jc => jc.status && ['COMPLETED', 'APPROVED', 'PENDING_SALES_INVOICE', 'INVOICE_RAISED', 'WARRANTY_REGISTRATION', 'CLOSED'].includes(jc.status))
  };

  const handleViewJobCard = (jobCard: EnrichedJobCard) => {
    if (isPartnerUser && ['AWAITING_ACK', 'ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS', 'REWORK_REQUESTED'].includes(jobCard.status || '')) {
      // Show detailer workflow modal for partner users
      setSelectedDetailerJobCard(jobCard.id);
    } else if (isShowroomUser && ['COMPLETED', 'PENDING_APPROVAL'].includes(jobCard.status || '')) {
      // Show approval modal for showroom users
      setSelectedApprovalJobCard(jobCard.id);
    } else {
      // Show basic details modal for other cases - fetch detailed data including media
      setSelectedJobCardId(jobCard.id);
    }
  };
  
  const handleManageJob = (jobCardId: string) => {
    setSelectedDetailerJobCard(jobCardId);
  };
  
  const handleReviewJob = (jobCardId: string) => {
    setSelectedApprovalJobCard(jobCardId);
  };

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p>Error loading job cards: {(error as Error).message}</p>
              <Button className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-2"></div>
          <div className="h-4 bg-muted rounded w-72"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-96 bg-muted rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with gradient styling matching old design */}
      <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Job Cards
          </h2>
          <p className="text-muted-foreground mt-1 text-base sm:text-lg">Track installation progress and approvals</p>
        </div>
        <div className="stack-mobile">
          <div className="flex items-center gap-2">
            <Button
              variant={liveTracking ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLiveTracking((v) => !v)}
              className="text-xs sm:text-sm h-8"
              data-testid="button-live-tracking"
              title={liveTracking ? 'Live tracking on (refreshes every 10s)' : 'Enable live tracking (refreshes every 10s)'}
            >
              <Target className={`h-3 w-3 mr-1 ${liveTracking ? 'animate-pulse' : ''}`} />
              Live Tracking
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-xs sm:text-sm h-8"
              data-testid="button-refresh"
              title="Refresh now"
            >
              <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 px-2 text-xs sm:text-sm"
              data-testid="button-list-view"
            >
              <List className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="h-8 px-2 text-xs sm:text-sm"
              data-testid="button-kanban-view"
            >
              <Grid3X3 className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Kanban</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Search Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <Input
              placeholder="Job Card Number (e.g., JC-123456)"
              value={searchFilters.jobCardNumber}
              onChange={(e) => setSearchFilters(prev => ({ ...prev, jobCardNumber: e.target.value }))}
              data-testid="input-job-card-search"
            />

            <Select 
              value={searchFilters.status || undefined} 
              onValueChange={(value) => setSearchFilters(prev => ({ ...prev, status: value || '' }))}
            >
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AWAITING_ACK">Awaiting Acknowledgment</SelectItem>
                <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="PENDING_SALES_INVOICE">Pending Invoice</SelectItem>
                <SelectItem value="INVOICE_RAISED">Invoice Raised</SelectItem>
                <SelectItem value="WARRANTY_REGISTRATION">Warranty Registered</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Customer Name"
              value={searchFilters.customerName}
              onChange={(e) => setSearchFilters(prev => ({ ...prev, customerName: e.target.value }))}
              data-testid="input-customer-search"
            />

            <Input
              placeholder="Reg No / VIN"
              value={searchFilters.regNo}
              onChange={(e) => setSearchFilters(prev => ({ ...prev, regNo: e.target.value }))}
              data-testid="input-vin-search"
            />

            {/* Partner Combobox */}
            <Popover open={partnerComboboxOpen} onOpenChange={setPartnerComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={partnerComboboxOpen}
                  className="justify-between w-full font-normal"
                  data-testid="combobox-partner-filter"
                >
                  {searchFilters.partnerId
                    ? allPartners.find((p: Partner) => p.id === searchFilters.partnerId)?.displayName || 'Select Partner'
                    : 'All Partners'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0">
                <Command>
                  <CommandInput placeholder="Search partner..." />
                  <CommandList>
                    <CommandEmpty>No partner found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value=""
                        onSelect={() => {
                          setSearchFilters(prev => ({ ...prev, partnerId: '' }));
                          setPartnerComboboxOpen(false);
                        }}
                      >
                        <Check className={`mr-2 h-4 w-4 ${!searchFilters.partnerId ? 'opacity-100' : 'opacity-0'}`} />
                        All Partners
                      </CommandItem>
                      {allPartners.map((partner: Partner) => (
                        <CommandItem
                          key={partner.id}
                          value={partner.displayName || partner.companyName || ''}
                          onSelect={() => {
                            setSearchFilters(prev => ({ ...prev, partnerId: partner.id }));
                            setPartnerComboboxOpen(false);
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${searchFilters.partnerId === partner.id ? 'opacity-100' : 'opacity-0'}`} />
                          {partner.displayName || partner.companyName}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Showroom Combobox */}
            <Popover open={showroomComboboxOpen} onOpenChange={setShowroomComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={showroomComboboxOpen}
                  className="justify-between w-full font-normal"
                  data-testid="combobox-showroom-filter"
                >
                  {searchFilters.showroomId
                    ? allShowrooms.find((s: any) => s.id === searchFilters.showroomId)?.name || 'Select Showroom'
                    : 'All Showrooms'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Search showroom..." />
                  <CommandList>
                    <CommandEmpty>No showroom found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value=""
                        onSelect={() => {
                          setSearchFilters(prev => ({ ...prev, showroomId: '' }));
                          setShowroomComboboxOpen(false);
                        }}
                      >
                        <Check className={`mr-2 h-4 w-4 ${!searchFilters.showroomId ? 'opacity-100' : 'opacity-0'}`} />
                        All Showrooms
                      </CommandItem>
                      {allShowrooms.map((showroom: any) => (
                        <CommandItem
                          key={showroom.id}
                          value={`${showroom.name} ${showroom.city || ''}`}
                          onSelect={() => {
                            setSearchFilters(prev => ({ ...prev, showroomId: showroom.id }));
                            setShowroomComboboxOpen(false);
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${searchFilters.showroomId === showroom.id ? 'opacity-100' : 'opacity-0'}`} />
                          <div className="flex flex-col">
                            <span>{showroom.name}</span>
                            {showroom.city && <span className="text-xs text-muted-foreground">{showroom.city}</span>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Input
              placeholder="Vehicle Model"
              value={searchFilters.vehicleModel}
              onChange={(e) => setSearchFilters(prev => ({ ...prev, vehicleModel: e.target.value }))}
              data-testid="input-vehicle-search"
            />
          </div>

          {/* Date Range Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">From Date</label>
              <Input
                type="date"
                value={searchFilters.dateFrom}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                data-testid="input-date-from"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">To Date</label>
              <Input
                type="date"
                value={searchFilters.dateTo}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                data-testid="input-date-to"
              />
            </div>
          </div>

          {/* Sorting and Pagination Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, sortedJobCards.length)} of {sortedJobCards.length} job cards
                {sortedJobCards.length < allJobCards.length && ` (filtered from ${allJobCards.length})`}
              </div>
            </div>
            
            <div className="flex items-center gap-4 flex-wrap">
              {/* Sort Controls */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort by:</span>
                <Select value={sortField} onValueChange={(v) => setSortField(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">Date Created</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="customerName">Customer</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                </Button>
              </div>

              {/* Items per page */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Show:</span>
                <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchFilters({
                  jobCardNumber: '',
                  customerName: '',
                  status: '',
                  partnerId: '',
                  showroomId: '',
                  vehicleModel: '',
                  regNo: '',
                  dateFrom: '',
                  dateTo: ''
                })}
                data-testid="button-clear-filters"
              >
                <Search className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={exportToExcel}
                disabled={sortedJobCards.length === 0}
                data-testid="button-export-excel"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* No Data State */}
      {!isLoading && sortedJobCards.length === 0 && allJobCards.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground" data-testid="text-no-filtered-results">
                No job cards match your search criteria
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={() => setSearchFilters({
                  jobCardNumber: '',
                  customerName: '',
                  status: '',
                  partnerId: '',
                  showroomId: '',
                  vehicleModel: '',
                  regNo: '',
                  dateFrom: '',
                  dateTo: ''
                })}
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && allJobCards.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground" data-testid="text-no-job-cards">
                No job cards found
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List View - Responsive Table */}
      {!isLoading && jobCards.length > 0 && viewMode === 'list' && (
        <>
          {/* Desktop & Tablet Table View */}
          <div className="hidden lg:block rounded-lg border border-border overflow-hidden">
            {/* Table Header */}
            <div className="bg-muted/50 border-b border-border px-4 py-3">
              <div className="grid gap-3 text-xs font-medium text-muted-foreground uppercase tracking-wide" style={{gridTemplateColumns: '90px 140px 1fr 130px 1fr 150px 100px 100px 110px'}}>
                <div className="truncate">ID</div>
                <div className="truncate">Status</div>
                <div className="truncate">Vehicle</div>
                <div className="truncate">Reg No</div>
                <div className="truncate">Service</div>
                <div className="truncate">Allocated Partner</div>
                <div className="truncate">Created</div>
                <div className="truncate">Scheduled</div>
                <div className="truncate">Actions</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-border">
              {jobCards.map((jobCard) => (
                <div 
                  key={jobCard.id}
                  className="px-4 py-4 hover:bg-muted/30 transition-colors"
                  data-testid={`row-job-card-${jobCard.id}`}
                >
                  <div className="grid gap-3 items-center min-h-[70px]" style={{gridTemplateColumns: '90px 140px 1fr 130px 1fr 150px 100px 100px 110px'}}>
                    {/* ID Column */}
                    <div className="min-w-0 overflow-hidden">
                      <span className="font-mono text-sm font-semibold block truncate" data-testid={`text-id-${jobCard.id}`}>
                        JC-{jobCard.id.slice(-6)}
                      </span>
                    </div>

                    {/* Status Column */}
                    <div className="min-w-0 overflow-hidden" data-testid={`status-${jobCard.id}`}>
                      <div className="mb-1">
                        {getStatusBadge(jobCard.status)}
                      </div>
                      <div>
                        <Progress value={getProgressValue(jobCard.status)} className="h-1 w-full" />
                      </div>
                    </div>

                    {/* Vehicle Column - just model name */}
                    <div className="min-w-0 overflow-hidden">
                      <div className="text-sm font-medium truncate" data-testid={`text-vehicle-${jobCard.id}`} title={jobCard.workOrder?.vehicleModel?.modelName || jobCard.vehicleDisplay}>
                        {jobCard.workOrder?.vehicleModel?.modelName || jobCard.vehicleDisplay}
                      </div>
                    </div>

                    {/* Reg No (VIN) Column */}
                    <div className="min-w-0 overflow-hidden">
                      <div className="text-sm font-medium truncate font-mono" data-testid={`text-regno-${jobCard.id}`} title={jobCard.workOrder?.regNo || 'N/A'}>
                        {jobCard.workOrder?.regNo || 'N/A'}
                      </div>
                    </div>

                    {/* Service Column */}
                    <div className="min-w-0 overflow-hidden">
                      <div className="text-sm font-medium truncate" data-testid={`text-service-${jobCard.id}`} title={jobCard.serviceDisplay}>
                        {jobCard.serviceDisplay}
                      </div>
                    </div>

                    {/* Allocated Partner Column */}
                    <div className="min-w-0 overflow-hidden">
                      <div className="text-sm font-medium truncate" data-testid={`text-partner-${jobCard.id}`} title={jobCard.partnerDisplay}>
                        {jobCard.partnerDisplay}
                      </div>
                    </div>

                    {/* Created Column */}
                    <div className="min-w-0 overflow-hidden">
                      <div className="text-sm truncate" data-testid={`text-created-${jobCard.id}`} title={formatDate(jobCard.createdAt)}>
                        {formatDate(jobCard.createdAt)}
                      </div>
                    </div>

                    {/* Scheduled Column */}
                    <div className="min-w-0 overflow-hidden">
                      <div className="text-sm truncate" data-testid={`text-scheduled-${jobCard.id}`} title={formatDate(jobCard.scheduledAt)}>
                        {formatDate(jobCard.scheduledAt)}
                      </div>
                    </div>

                    {/* Actions Column */}
                    <div className="min-w-0 overflow-hidden flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewJobCard(jobCard)}
                        data-testid={`button-view-${jobCard.id}`}
                        className="flex-1 text-xs px-2"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        <span className="hidden xl:inline">View</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => printJobCard(jobCard)}
                        data-testid={`button-print-${jobCard.id}`}
                        className="text-xs px-2"
                        title="Print Job Card"
                      >
                        <Printer className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tablet Compact View */}
          <div className="hidden md:block lg:hidden rounded-lg border border-border overflow-hidden">
            {/* Table Header */}
            <div className="bg-muted/50 border-b border-border px-3 py-2">
              <div className="grid grid-cols-8 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <div className="col-span-1">ID</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-2">Vehicle</div>
                <div className="col-span-2">Reg No</div>
                <div className="col-span-1">Partner</div>
                <div className="col-span-1">Actions</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-border">
              {jobCards.map((jobCard) => (
                <div 
                  key={jobCard.id}
                  className="px-3 py-3 hover:bg-muted/30 transition-colors"
                  data-testid={`row-tablet-job-card-${jobCard.id}`}
                >
                  <div className="grid grid-cols-8 gap-2 items-center">
                    {/* ID Column */}
                    <div className="col-span-1">
                      <span className="font-mono text-xs font-semibold" data-testid={`text-id-${jobCard.id}`}>
                        JC-{jobCard.id.slice(-6)}
                      </span>
                    </div>

                    {/* Status Column */}
                    <div className="col-span-1" data-testid={`status-${jobCard.id}`}>
                      {getStatusBadge(jobCard.status)}
                      <div className="mt-1">
                        <Progress value={getProgressValue(jobCard.status)} className="h-1 w-full" />
                      </div>
                    </div>

                    {/* Vehicle Column */}
                    <div className="col-span-2">
                      <div className="text-xs font-medium truncate" data-testid={`text-vehicle-${jobCard.id}`}>
                        {jobCard.workOrder?.vehicleModel?.modelName || jobCard.vehicleDisplay}
                      </div>
                      <div className="text-xs text-muted-foreground truncate" data-testid={`text-service-${jobCard.id}`}>
                        {jobCard.serviceDisplay}
                      </div>
                    </div>

                    {/* Reg No Column */}
                    <div className="col-span-2">
                      <div className="text-xs font-medium truncate font-mono" data-testid={`text-regno-${jobCard.id}`}>
                        {jobCard.workOrder?.regNo || 'N/A'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(jobCard.createdAt)}
                      </div>
                    </div>

                    {/* Partner Column */}
                    <div className="col-span-1">
                      <div className="text-xs font-medium truncate" data-testid={`text-partner-${jobCard.id}`} title={jobCard.partnerDisplay}>
                        {jobCard.partnerDisplay}
                      </div>
                    </div>

                    {/* Actions Column */}
                    <div className="col-span-1 flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewJobCard(jobCard)}
                        data-testid={`button-view-${jobCard.id}`}
                        className="flex-1 text-xs px-1"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => printJobCard(jobCard)}
                        data-testid={`button-print-${jobCard.id}`}
                        className="text-xs px-1"
                        title="Print"
                      >
                        <Printer className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-4">
            {jobCards.map((jobCard) => (
              <Card key={jobCard.id} className="shadow-sm border-l-4 border-l-blue-500" data-testid={`card-mobile-job-${jobCard.id}`}>
                <CardContent className="p-4">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold" data-testid={`text-id-${jobCard.id}`}>
                        JC-{jobCard.id.slice(-6)}
                      </span>
                    </div>
                    <div data-testid={`status-${jobCard.id}`}>
                      {getStatusBadge(jobCard.status)}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <Progress value={getProgressValue(jobCard.status)} className="h-2 w-full" />
                    <div className="text-xs text-muted-foreground mt-1 text-center">
                      {getProgressValue(jobCard.status)}% Complete
                    </div>
                  </div>
                  
                  {/* Details Grid */}
                  <div className="grid grid-cols-1 gap-2 text-sm mb-4">
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                      <Car className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground">Vehicle</div>
                        <div className="font-medium truncate" data-testid={`text-vehicle-${jobCard.id}`}>
                          {jobCard.workOrder?.vehicleModel?.modelName || jobCard.vehicleDisplay}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                      <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground">Reg No</div>
                        <div className="font-medium font-mono truncate" data-testid={`text-regno-${jobCard.id}`}>
                          {jobCard.workOrder?.regNo || 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                      <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground">Allocated Partner</div>
                        <div className="font-medium truncate" data-testid={`text-partner-${jobCard.id}`}>
                          {jobCard.partnerDisplay}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                      <ServiceIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground">Service</div>
                        <div className="font-medium truncate" data-testid={`text-service-${jobCard.id}`}>
                          {jobCard.serviceDisplay}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleViewJobCard(jobCard)}
                      data-testid={`button-view-${jobCard.id}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => printJobCard(jobCard)}
                      data-testid={`button-print-${jobCard.id}`}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Kanban View with gradient cards matching old design */}
      {!isLoading && jobCards.length > 0 && viewMode === 'kanban' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Awaiting Acknowledgment */}
          <Card className="border-l-4 border-l-red-500 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-red-50 to-orange-50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Clock className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-red-700">Awaiting Acknowledgment</CardTitle>
                    <p className="text-xs text-red-500 mt-1">Needs immediate attention</p>
                  </div>
                </div>
                <Badge className="bg-red-500 text-white font-semibold" data-testid="count-awaiting-ack">
                  {groupedJobCards.AWAITING_ACK.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {groupedJobCards.AWAITING_ACK.length === 0 ? (
                <div className="text-center py-12">
                  <div className="p-4 bg-green-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                  <p className="text-sm font-medium text-green-700 mb-1">All Clear!</p>
                  <p className="text-xs text-green-600">No pending acknowledgments</p>
                </div>
              ) : (
                groupedJobCards.AWAITING_ACK.map((job) => (
                  <Card key={job.id} className="border" data-testid={`card-job-${job.id}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-mono text-primary">JC-{job.id.slice(-6)}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        {job.vehicleDisplay} - {job.serviceDisplay}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">{job.partnerDisplay}</p>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleViewJobCard(job)}
                          data-testid={`button-view-${job.id}`}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => printJobCard(job)}
                          data-testid={`button-print-${job.id}`}
                        >
                          <Printer className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          {/* In Progress */}
          <Card className="border-l-4 border-l-blue-500 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Wrench className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-blue-700">In Progress</CardTitle>
                    <p className="text-xs text-blue-500 mt-1">Active installations</p>
                  </div>
                </div>
                <Badge className="bg-blue-500 text-white font-semibold" data-testid="count-in-progress">
                  {groupedJobCards.IN_PROGRESS.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {groupedJobCards.IN_PROGRESS.length === 0 ? (
                <div className="text-center py-12">
                  <div className="p-4 bg-blue-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <FileText className="h-8 w-8 text-blue-500" />
                  </div>
                  <p className="text-sm font-medium text-blue-700 mb-1">Ready to Work</p>
                  <p className="text-xs text-blue-600">No active installations</p>
                </div>
              ) : (
                groupedJobCards.IN_PROGRESS.map((job) => (
                  <Card key={job.id} className="border" data-testid={`card-job-${job.id}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-mono text-primary">JC-{job.id.slice(-6)}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        {job.vehicleDisplay} - {job.serviceDisplay}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">{job.partnerDisplay}</p>
                      <div className="mb-2">
                        <Progress value={getProgressValue(job.status)} className="h-2" />
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{getProgressValue(job.status)}% complete</p>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleViewJobCard(job)}
                          data-testid={`button-view-${job.id}`}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => printJobCard(job)}
                          data-testid={`button-print-${job.id}`}
                        >
                          <Printer className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          {/* Pending Approval */}
          <Card className="border-l-4 border-l-orange-500 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-orange-50 to-yellow-50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-orange-700">Pending Approval</CardTitle>
                    <p className="text-xs text-orange-500 mt-1">Awaiting review</p>
                  </div>
                </div>
                <Badge className="bg-orange-500 text-white font-semibold" data-testid="count-pending-approval">
                  {groupedJobCards.PENDING_APPROVAL.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {groupedJobCards.PENDING_APPROVAL.length === 0 ? (
                <div className="text-center py-12">
                  <div className="p-4 bg-gray-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <Clock className="h-8 w-8 text-gray-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">All Reviewed</p>
                  <p className="text-xs text-gray-600">No approvals pending</p>
                </div>
              ) : (
                groupedJobCards.PENDING_APPROVAL.map((job) => (
                  <Card key={job.id} className="border" data-testid={`card-job-${job.id}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-mono text-primary">JC-{job.id.slice(-6)}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        {job.vehicleDisplay} - {job.serviceDisplay}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">{job.partnerDisplay}</p>
                      <div className="flex gap-1">
                        {isShowroomUser ? (
                          <Button 
                            size="sm" 
                            className="flex-1"
                            onClick={() => handleReviewJob(job.id)}
                            data-testid={`button-review-${job.id}`}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Review
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            className="flex-1"
                            onClick={() => handleViewJobCard(job)}
                            data-testid={`button-view-${job.id}`}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => printJobCard(job)}
                          data-testid={`button-print-${job.id}`}
                        >
                          <Printer className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          {/* Completed */}
          <Card className="border-l-4 border-l-green-500 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-green-50 to-emerald-50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Trophy className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-green-700">Completed</CardTitle>
                    <p className="text-xs text-green-500 mt-1">Successfully finished</p>
                  </div>
                </div>
                <Badge className="bg-green-500 text-white font-semibold" data-testid="count-completed">
                  {groupedJobCards.COMPLETED.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {groupedJobCards.COMPLETED.length === 0 ? (
                <div className="text-center py-12">
                  <div className="p-4 bg-yellow-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <Target className="h-8 w-8 text-yellow-500" />
                  </div>
                  <p className="text-sm font-medium text-yellow-700 mb-1">Ready to Achieve</p>
                  <p className="text-xs text-yellow-600">No completed jobs yet</p>
                </div>
              ) : (
                groupedJobCards.COMPLETED.map((job) => (
                  <Card key={job.id} className="border" data-testid={`card-job-${job.id}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-mono text-primary">JC-{job.id.slice(-6)}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        {job.vehicleDisplay} - {job.serviceDisplay}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">{job.partnerDisplay}</p>
                      <Badge className="bg-green-100 text-green-800 mb-2">
                        Approved
                      </Badge>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          className="flex-1"
                          variant="outline"
                          onClick={() => handleViewJobCard(job)}
                          data-testid={`button-view-${job.id}`}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => printJobCard(job)}
                          data-testid={`button-print-${job.id}`}
                        >
                          <Printer className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pagination - Bottom of List */}
      {totalPages > 1 && jobCards.length > 0 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm px-4">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last
          </Button>
        </div>
      )}

      {/* Job Card Detail Modal - Enhanced UI */}
      <Dialog open={!!selectedJobCardId} onOpenChange={() => {
        setSelectedJobCardId(null);
        setSelectedJobCard(null);
      }}>
        <DialogContent className="modal-responsive max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileCheck className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  Job Card Details - {detailedJobCard?.id}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Comprehensive job card information and status tracking
                </p>
              </div>
            </div>
          </DialogHeader>
          
          {detailedJobCard && (
            <div className="flex-1 pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 py-4">
                
                {/* Basic Information Card */}
                <Card className="col-span-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-base">Basic Information</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <span className="text-sm text-muted-foreground">Job Card ID</span>
                      <p className="font-mono text-xs bg-muted px-2 py-1 rounded mt-1 break-all" data-testid="text-job-card-id">
                        {detailedJobCard.id}
                      </p>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Status</span>
                      {getStatusBadge(detailedJobCard.status)}
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Work Order ID</span>
                      <p className="font-mono text-xs bg-muted px-2 py-1 rounded mt-1 break-all" data-testid="text-work-order-id">
                        {detailedJobCard.workOrderId}
                      </p>
                    </div>
                    {detailedJobCard.acknowledgedAt && (
                      <div>
                        <span className="text-sm text-muted-foreground">Acknowledged Date</span>
                        <p className="font-medium text-sm" data-testid="text-acknowledged-date">
                          {formatDateTime(detailedJobCard.acknowledgedAt)}
                        </p>
                      </div>
                    )}
                    <div className="border-t pt-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-green-600" />
                        <span className="text-muted-foreground">Created:</span>
                        <span className="font-medium">{formatDateTime(detailedJobCard?.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-orange-600" />
                        <span className="text-muted-foreground">Updated:</span>
                        <span className="font-medium">{formatDateTime(detailedJobCard?.updatedAt)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Customer Information Card */}
                <Card className="col-span-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-green-600" />
                      <CardTitle className="text-base">Customer Information</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-sm text-muted-foreground">Name</span>
                        <p className="font-medium">{detailedJobCard.workOrder?.customerName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-sm text-muted-foreground">Phone</span>
                        <p className="font-medium font-mono">
                          {detailedJobCard.workOrder?.customerPhone || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-sm text-muted-foreground">Email</span>
                        <p className="font-medium text-sm">
                          {detailedJobCard.workOrder?.customerEmail || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Vehicle & Service Card */}
                <Card className="col-span-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Car className="h-5 w-5 text-purple-600" />
                      <CardTitle className="text-base">Vehicle & Service</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Car className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <span className="text-sm text-muted-foreground">Vehicle Model</span>
                        <p className="font-medium text-sm leading-relaxed">
                          {detailedJobCard.workOrder?.vehicleModel?.modelName || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <span className="text-sm text-muted-foreground">Registration No.</span>
                        <p className="font-medium text-sm font-mono" data-testid="text-detail-regno">
                          {detailedJobCard.workOrder?.regNo || 'N/A'}
                        </p>
                      </div>
                    </div>
                    {detailedJobCard.workOrder?.vehicleColor && (
                      <div className="flex items-start gap-3">
                        <Car className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <span className="text-sm text-muted-foreground">Color</span>
                          <p className="font-medium text-sm">
                            {detailedJobCard.workOrder.vehicleColor}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <ServiceIcon className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <span className="text-sm text-muted-foreground">Service</span>
                        <p className="font-medium text-sm">{detailedJobCard.workOrder?.service?.name || 'N/A'}</p>
                      </div>
                    </div>
                    {detailedJobCard.workOrder?.service?.description && (
                      <div className="flex items-start gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <span className="text-sm text-muted-foreground">Description</span>
                          <p className="text-sm leading-relaxed">
                            {detailedJobCard.workOrder.service.description}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Order Source Card - Showroom/Dealership */}
                <Card className="col-span-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Store className="h-5 w-5 text-indigo-600" />
                      <CardTitle className="text-base">Order Placed By</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {detailedJobCard.workOrder?.showroomName && (
                      <div className="flex items-start gap-3">
                        <Store className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <span className="text-sm text-muted-foreground">Showroom</span>
                          <p className="font-medium text-sm" data-testid="text-showroom-name">
                            {detailedJobCard.workOrder.showroomName}
                          </p>
                        </div>
                      </div>
                    )}
                    {detailedJobCard.workOrder?.dealershipName && (
                      <div className="flex items-start gap-3">
                        <Building2 className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <span className="text-sm text-muted-foreground">Dealership</span>
                          <p className="font-medium text-sm" data-testid="text-dealership-name">
                            {detailedJobCard.workOrder.dealershipName}
                          </p>
                        </div>
                      </div>
                    )}
                    {detailedJobCard.workOrder?.oemName && (
                      <div className="flex items-start gap-3">
                        <Building2 className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <span className="text-sm text-muted-foreground">OEM</span>
                          <p className="font-medium text-sm" data-testid="text-oem-name">
                            {detailedJobCard.workOrder.oemName}
                          </p>
                        </div>
                      </div>
                    )}
                    {!detailedJobCard.workOrder?.showroomName && !detailedJobCard.workOrder?.dealershipName && (
                      <p className="text-sm text-muted-foreground">No source information available</p>
                    )}
                  </CardContent>
                </Card>

                {/* Partner Information Card */}
                <Card className="col-span-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-orange-600" />
                      <CardTitle className="text-base">Partner Information</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Building2 className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <span className="text-sm text-muted-foreground">Partner</span>
                        <p className="font-medium">{detailedJobCard.partner?.displayName || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-sm text-muted-foreground">Business Type</span>
                        <p className="font-medium">{detailedJobCard.partner?.businessType || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-sm text-muted-foreground">Contact Person</span>
                        <p className="font-medium">{detailedJobCard.partner?.contactPersonName || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-sm text-muted-foreground">Contact Phone</span>
                        <p className="font-medium font-mono">
                          {detailedJobCard.partner?.contactPersonPhone || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Timeline Card */}
                <Card className="col-span-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-base">Timeline</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      {[
                        { label: 'Acknowledged', date: detailedJobCard?.acknowledgedAt, icon: CheckCircle2 },
                        { label: 'Scheduled', date: detailedJobCard?.scheduledAt, icon: Calendar },
                        { label: 'Started', date: detailedJobCard.startedAt, icon: Play },
                        { label: 'Completed', date: detailedJobCard.completedAt, icon: Wrench },
                        { label: 'Approved', date: detailedJobCard.approvedAt, icon: Trophy }
                      ].map((item, index) => (
                        <div key={index} className="flex items-center gap-3 text-sm">
                          <item.icon className={`h-4 w-4 ${item.date ? 'text-green-600' : 'text-gray-300'}`} />
                          <span className="text-muted-foreground min-w-[80px]">{item.label}:</span>
                          <span className={`font-medium text-xs ${item.date ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {item.date ? formatDateTime(item.date) : 'N/A'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Details Card */}
                <Card className="col-span-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-gray-600" />
                      <CardTitle className="text-base">Additional Details</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      {/* Billing Value - hidden when showServicePrices is disabled */}
                      {showPrices && (
                        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
                          <span className="text-sm text-muted-foreground">Job Card Billing Value</span>
                          <p className="font-bold text-lg text-green-700 dark:text-green-400" data-testid="text-billing-value">
                            {detailedJobCard.billingValue 
                              ? `₹${Number(detailedJobCard.billingValue).toLocaleString('en-IN')}` 
                              : '₹0.00'}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {detailedJobCard.billingValue ? 'From Work Order' : 'Not set'}
                          </span>
                        </div>
                      )}
                      
                      <div>
                        <span className="text-sm text-muted-foreground">Assigned Installer</span>
                        <p className="font-medium text-sm" data-testid="text-assigned-installer">
                          {detailedJobCard.assignedInstaller?.displayName || detailedJobCard.assignedInstallerId || 'Not assigned'}
                        </p>
                      </div>
                      {detailedJobCard.remarks && (
                        <div>
                          <span className="text-sm text-muted-foreground">Remarks</span>
                          <p className="text-sm leading-relaxed bg-muted p-2 rounded">
                            {detailedJobCard.remarks}
                          </p>
                        </div>
                      )}
                      {detailedJobCard.partnerRemarks && (
                        <div>
                          <span className="text-sm text-muted-foreground">Partner Remarks</span>
                          <p className="text-sm leading-relaxed bg-orange-50 p-2 rounded">
                            {detailedJobCard.partnerRemarks}
                          </p>
                        </div>
                      )}
                      {detailedJobCard.batchNumbers && (
                        <div>
                          <span className="text-sm text-muted-foreground">Batch Numbers</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(Array.isArray(detailedJobCard.batchNumbers) 
                              ? detailedJobCard.batchNumbers 
                              : [detailedJobCard.batchNumbers]
                            ).map((batch: string, i: number) => (
                              <span key={i} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {batch}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {detailedJobCard.batchNumberImage && (
                        <div className="col-span-2">
                          <span className="text-sm text-muted-foreground">Batch Number Image</span>
                          <div className="mt-2">
                            <img 
                              src={detailedJobCard.batchNumberImage} 
                              alt="Batch Number" 
                              className="max-w-[200px] max-h-[150px] rounded border shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(detailedJobCard.batchNumberImage, '_blank')}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Billing Information Card */}
                {(detailedJobCard.billFrom || detailedJobCard.billTo || detailedJobCard.shipTo) && (
                  <Card className="col-span-1 lg:col-span-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-indigo-600" />
                        <CardTitle className="text-base">Billing Information</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Bill From */}
                      {detailedJobCard.billFrom && (
                        <div className="border-l-4 border-blue-500 pl-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-semibold text-blue-900 dark:text-blue-300">Bill From</span>
                          </div>
                          <p className="font-medium">{detailedJobCard.billFrom.name || 'N/A'}</p>
                          {detailedJobCard.billFrom.addressLine1 && (
                            <p className="text-sm text-muted-foreground">
                              {detailedJobCard.billFrom.addressLine1}
                              {detailedJobCard.billFrom.city && `, ${detailedJobCard.billFrom.city}`}
                              {detailedJobCard.billFrom.state && `, ${detailedJobCard.billFrom.state}`}
                              {detailedJobCard.billFrom.pincode && ` - ${detailedJobCard.billFrom.pincode}`}
                            </p>
                          )}
                          {detailedJobCard.billFrom.gstin && (
                            <p className="text-xs text-muted-foreground font-mono mt-1">
                              GSTIN: {detailedJobCard.billFrom.gstin}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Bill To */}
                      {detailedJobCard.billTo && (
                        <div className="border-l-4 border-green-500 pl-3">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-semibold text-green-900 dark:text-green-300">Bill To</span>
                            {detailedJobCard.billTo.entityType && (
                              <Badge variant="outline" className="text-xs">
                                {detailedJobCard.billTo.entityType}
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium">{detailedJobCard.billTo.entityName || 'N/A'}</p>
                          {detailedJobCard.billTo.addressLine1 && (
                            <p className="text-sm text-muted-foreground">
                              {detailedJobCard.billTo.addressLine1}
                              {detailedJobCard.billTo.city && `, ${detailedJobCard.billTo.city}`}
                              {detailedJobCard.billTo.state && `, ${detailedJobCard.billTo.state}`}
                              {detailedJobCard.billTo.pincode && ` - ${detailedJobCard.billTo.pincode}`}
                            </p>
                          )}
                          {detailedJobCard.billTo.gstin && (
                            <p className="text-xs text-muted-foreground font-mono mt-1">
                              GSTIN: {detailedJobCard.billTo.gstin}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Ship To */}
                      {detailedJobCard.shipTo && (
                        <div className="border-l-4 border-orange-500 pl-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Package className="h-4 w-4 text-orange-600" />
                            <span className="text-sm font-semibold text-orange-900 dark:text-orange-300">Ship To</span>
                          </div>
                          <p className="font-medium">{detailedJobCard.shipTo.entityName || 'N/A'}</p>
                          {detailedJobCard.shipTo.addressLine1 && (
                            <p className="text-sm text-muted-foreground">
                              {detailedJobCard.shipTo.addressLine1}
                              {detailedJobCard.shipTo.city && `, ${detailedJobCard.shipTo.city}`}
                              {detailedJobCard.shipTo.state && `, ${detailedJobCard.shipTo.state}`}
                              {detailedJobCard.shipTo.pincode && ` - ${detailedJobCard.shipTo.pincode}`}
                            </p>
                          )}
                          {detailedJobCard.shipTo.gstin && (
                            <p className="text-xs text-muted-foreground font-mono mt-1">
                              GSTIN: {detailedJobCard.shipTo.gstin}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Partner Billing Direct indicator */}
                      {detailedJobCard.partnerBilledDirectly && (
                        <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-purple-600" />
                            <span className="text-sm font-medium text-purple-900 dark:text-purple-300">
                              Partner Bills Customer Directly
                            </span>
                          </div>
                          <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                            This partner handles billing directly with the customer
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Pre-Installation Photos Section - Always visible when photos exist */}
                {detailedJobCard?.preInstallationPhotos && detailedJobCard.preInstallationPhotos.length > 0 && (
                  <Card className="col-span-1 lg:col-span-2 xl:col-span-3 border-2 border-indigo-200 bg-indigo-50/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Image className="h-5 w-5 text-indigo-600" />
                          <CardTitle className="text-base text-indigo-900">Pre-Installation Photos</CardTitle>
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                            Completed
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowViewPreInstallationModal(true)}
                          className="border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                          data-testid="button-view-pre-installation"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Photos
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {detailedJobCard.preInstallationPhotos.map((mediaItem: any, index: number) => {
                          const imageUrl = mediaItem.url;
                          const imageName = mediaItem.caption || ['Front', 'Back', 'Left Side', 'Right Side'][index] || `Image ${index + 1}`;
                          return (
                            <div key={index} className="relative group">
                              <img
                                src={imageUrl}
                                alt={imageName}
                                className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-75 transition-opacity"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedImageUrl(imageUrl);
                                  setSelectedImageIndex(index);
                                }}
                                data-testid={`thumbnail-preinstall-${imageName.toLowerCase().replace(/\s+/g, '-')}`}
                              />
                              <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                                {imageName}
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <Eye className="h-6 w-6 text-white drop-shadow-lg" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-sm text-indigo-700 mt-3">
                        Pre-installation inspection photos documenting vehicle condition before PPF installation.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Post-Installation Photos Section - Show only if there are post-installation media */}
                {detailedJobCard?.media && detailedJobCard.media.length > 0 && (
                  <Card className="col-span-1 lg:col-span-2 xl:col-span-3">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Image className="h-5 w-5 text-purple-600" />
                        <CardTitle className="text-base">Post-Installation Photos</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {detailedJobCard.media.map((mediaItem: any, index: number) => {
                          const imageUrl = mediaItem.url;
                          const imageName = mediaItem.caption || `Image ${index + 1}`;
                          return (
                            <div key={index} className="relative group">
                              <img
                                src={imageUrl}
                                alt={imageName}
                                className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-75 transition-opacity"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedImageUrl(imageUrl);
                                  setSelectedImageIndex(index);
                                }}
                                data-testid={`thumbnail-postinstall-${index}`}
                              />
                              <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                                {imageName}
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <Eye className="h-6 w-6 text-white drop-shadow-lg" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Admin Approval Section */}
                {isAdmin && (detailedJobCard.status === 'COMPLETED' || detailedJobCard.status === 'PENDING_APPROVAL') && (
                  <Card className="col-span-1 lg:col-span-2 xl:col-span-3 border-2 border-dashed border-blue-200 bg-blue-50/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                        <CardTitle className="text-base text-blue-900">Admin Approval Required</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          onClick={() => approveJobCardMutation.mutate(detailedJobCard.id)}
                          disabled={approveJobCardMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          data-testid="button-approve"
                        >
                          {approveJobCardMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Approve Job Card
                        </Button>
                        <Button
                          onClick={() => {
                            const reason = prompt('Please provide a reason for requesting rework:');
                            if (reason) {
                              rejectJobCardMutation.mutate({ jobCardId: detailedJobCard.id, reason });
                            }
                          }}
                          disabled={rejectJobCardMutation.isPending}
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          data-testid="button-reject"
                        >
                          {rejectJobCardMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-2" />
                          )}
                          Found Issue / Request Rework
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        As an admin, you can approve this completed job card or request rework if issues are found.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Settlement Section - Post Approval */}
                {(detailedJobCard.status === 'APPROVED' || detailedJobCard.status === 'PENDING_SALES_INVOICE' || detailedJobCard.status === 'INVOICE_RAISED' || detailedJobCard.status === 'WARRANTY_REGISTRATION' || detailedJobCard.status === 'PAYMENT_PENDING' || detailedJobCard.status === 'CLOSED') && (
                  (detailedJobCard.partnerBilledDirectly && (user?.role === 'PARTNER_ADMIN' || user?.role === 'PARTNER_STAFF')) ||
                  (!detailedJobCard.partnerBilledDirectly && isAdmin)
                ) && (
                  <Card className={`col-span-1 lg:col-span-2 xl:col-span-3 border-2 ${detailedJobCard.status === 'CLOSED' ? 'border-gray-200 bg-gray-50/50' : 'border-dashed border-green-200 bg-green-50/50'}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Receipt className={`h-5 w-5 ${detailedJobCard.status === 'CLOSED' ? 'text-gray-600' : 'text-green-600'}`} />
                        <CardTitle className={`text-base ${detailedJobCard.status === 'CLOSED' ? 'text-gray-900' : 'text-green-900'}`}>
                          {detailedJobCard.status === 'CLOSED' ? 'Settlement Details' : 'Settlement Actions'}
                        </CardTitle>
                        {detailedJobCard.status === 'CLOSED' && (
                          <span className="ml-auto text-xs font-medium px-2 py-1 rounded bg-green-100 text-green-700">
                            Completed
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {/* Payment Settlement Status */}
                        <div className="flex items-start gap-3 p-3 bg-white rounded-lg border">
                          <DollarSign className={`h-5 w-5 mt-0.5 ${detailedJobCard.paymentSettledAt ? 'text-green-600' : 'text-gray-400'}`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">Payment Settlement</span>
                              {detailedJobCard.paymentSettledAt && (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                            {detailedJobCard.paymentSettledAt ? (
                              <>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Settled on {formatDateTime(detailedJobCard.paymentSettledAt)}
                                </p>
                                <p className="text-xs font-mono mt-1 text-green-700">
                                  Invoice: {detailedJobCard.salesInvoiceNumber}
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-1">
                                Invoice number not recorded yet
                              </p>
                            )}
                          </div>
                          {detailedJobCard.status === 'PENDING_SALES_INVOICE' && (
                            <Button
                              size="sm"
                              onClick={() => setShowSettlePaymentModal(true)}
                              className="bg-green-600 hover:bg-green-700"
                              data-testid="button-settle-payment"
                            >
                              Enter Invoice
                            </Button>
                          )}
                        </div>

                        {/* Warranty Application Status */}
                        <div className="flex items-start gap-3 p-3 bg-white rounded-lg border">
                          <Shield className={`h-5 w-5 mt-0.5 ${(detailedJobCard.partnerBilledDirectly ? detailedJobCard.eWarrantyApplied : detailedJobCard.warrantyAppliedAt) ? 'text-blue-600' : 'text-gray-400'}`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">E-Warranty</span>
                              {(detailedJobCard.partnerBilledDirectly ? detailedJobCard.eWarrantyApplied : detailedJobCard.warrantyAppliedAt) && (
                                <CheckCircle className="h-4 w-4 text-blue-600" />
                              )}
                            </div>
                            {detailedJobCard.partnerBilledDirectly ? (
                              detailedJobCard.eWarrantyApplied ? (
                                <>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Requested on {formatDateTime(detailedJobCard.eWarrantyAppliedAt)}
                                  </p>
                                  <p className="text-xs text-amber-700 mt-1">
                                    Notification sent to STEK India
                                  </p>
                                </>
                              ) : (
                                <p className="text-xs text-muted-foreground mt-1">
                                  E-warranty not requested yet
                                </p>
                              )
                            ) : (
                              detailedJobCard.warrantyAppliedAt ? (
                                <>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Applied on {formatDateTime(detailedJobCard.warrantyAppliedAt)}
                                  </p>
                                  <p className="text-xs font-mono mt-1 text-blue-700">
                                    Ref: {detailedJobCard.warrantyReferenceNumber}
                                  </p>
                                </>
                              ) : (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Warranty reference not recorded yet
                                </p>
                              )
                            )}
                          </div>
                          {detailedJobCard.partnerBilledDirectly ? (
                            !detailedJobCard.eWarrantyApplied && detailedJobCard.status !== 'CLOSED' && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (detailedJobCard?.id) {
                                    requestEWarrantyMutation.mutate(detailedJobCard.id);
                                  }
                                }}
                                disabled={requestEWarrantyMutation.isPending}
                                className="bg-amber-600 hover:bg-amber-700"
                                data-testid="button-request-e-warranty"
                              >
                                {requestEWarrantyMutation.isPending ? 'Requesting...' : 'Request E-Warranty'}
                              </Button>
                            )
                          ) : (
                            detailedJobCard.status === 'INVOICE_RAISED' && (
                              <Button
                                size="sm"
                                onClick={() => setShowApplyWarrantyModal(true)}
                                className="bg-blue-600 hover:bg-blue-700"
                                data-testid="button-apply-warranty"
                              >
                                Apply eWarranty
                              </Button>
                            )
                          )}
                        </div>
                      </div>

                      {detailedJobCard.status !== 'CLOSED' && (
                        <p className="text-xs text-muted-foreground">
                          {detailedJobCard.partnerBilledDirectly 
                            ? "As a partner, you must record the sales invoice number and apply e-warranty before closing this job card."
                            : "As an admin, you must record the sales invoice number and apply e-warranty before closing this job card."
                          }
                        </p>
                      )}

                      {detailedJobCard.paymentSettledAt && 
                       (detailedJobCard.partnerBilledDirectly ? detailedJobCard.eWarrantyApplied : detailedJobCard.warrantyAppliedAt) && 
                       detailedJobCard.status !== 'CLOSED' && (
                        <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-700" />
                            <span className="text-sm font-medium text-green-900">
                              Settlement Complete - Job card will be closed automatically
                            </span>
                          </div>
                        </div>
                      )}

                      {detailedJobCard.status === 'CLOSED' && (
                        <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-700" />
                            <span className="text-sm font-medium text-green-900">
                              Job card closed - Settlement completed successfully
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal - Combine pre and post installation photos */}
      <ImageModal
        images={[
          ...(detailedJobCard?.preInstallationPhotos || []).map((mediaItem: any, index: number) => ({
            id: mediaItem.id || `pre-install-${index}`,
            url: mediaItem.url,
            caption: mediaItem.caption || ['Front', 'Back', 'Left Side', 'Right Side'][index] || `Pre-Install ${index + 1}`,
            alt: `Pre-installation photo ${index + 1}`
          })),
          ...(detailedJobCard?.media || []).map((mediaItem: any, index: number) => ({
            id: mediaItem.id || `post-install-${index}`,
            url: mediaItem.url,
            caption: mediaItem.caption || `Post-Install ${index + 1}`,
            alt: `Post-installation photo ${index + 1}`
          }))
        ]}
        initialIndex={selectedImageIndex}
        isOpen={!!selectedImageUrl && (!!detailedJobCard?.preInstallationPhotos || !!detailedJobCard?.media)}
        onClose={() => {
          setSelectedImageUrl(null);
          setSelectedImageIndex(0);
        }}
      />

      {/* Detailer Job Management Modal */}
      <DetailerJobDetailModal 
        jobCardId={selectedDetailerJobCard}
        isOpen={!!selectedDetailerJobCard}
        onClose={() => setSelectedDetailerJobCard(null)}
      />

      {/* Approval Modal */}
      <ApprovalModal 
        jobCardId={selectedApprovalJobCard}
        isOpen={!!selectedApprovalJobCard}
        onClose={() => setSelectedApprovalJobCard(null)}
      />

      {/* View Pre-Installation Photos Modal */}
      {detailedJobCard?.preInstallationPhotos && detailedJobCard.preInstallationPhotos.length > 0 && (
        <ViewPreInstallationModal
          open={showViewPreInstallationModal}
          onOpenChange={setShowViewPreInstallationModal}
          photoFrontUrl={detailedJobCard.preInstallationPhotos.find((p: any) => p.caption === 'Front')?.url || detailedJobCard.preInstallationPhotos[0]?.url || ''}
          photoBackUrl={detailedJobCard.preInstallationPhotos.find((p: any) => p.caption === 'Back')?.url || detailedJobCard.preInstallationPhotos[1]?.url || ''}
          photoLeftUrl={detailedJobCard.preInstallationPhotos.find((p: any) => p.caption === 'Left Side')?.url || detailedJobCard.preInstallationPhotos[2]?.url || ''}
          photoRightUrl={detailedJobCard.preInstallationPhotos.find((p: any) => p.caption === 'Right Side')?.url || detailedJobCard.preInstallationPhotos[3]?.url || ''}
          remarks={detailedJobCard.preInstallationRemarks}
          completedAt={detailedJobCard.preInstallationCompletedAt}
        />
      )}

      {/* Settle Payment Modal */}
      <Dialog open={showSettlePaymentModal} onOpenChange={setShowSettlePaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Settle Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Enter the sales invoice number to record the payment settlement for this job card.
            </p>
            <div className="space-y-2">
              <label htmlFor="invoice-number" className="text-sm font-medium">
                Sales Invoice Number
              </label>
              <Input
                id="invoice-number"
                placeholder="e.g., INV-2025-001"
                value={salesInvoiceNumber}
                onChange={(e) => setSalesInvoiceNumber(e.target.value)}
                data-testid="input-invoice-number"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSettlePaymentModal(false);
                  setSalesInvoiceNumber('');
                }}
                data-testid="button-cancel-settle"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (detailedJobCard?.id && salesInvoiceNumber.trim()) {
                    settlePaymentMutation.mutate({
                      jobCardId: detailedJobCard.id,
                      salesInvoiceNumber: salesInvoiceNumber.trim()
                    });
                  }
                }}
                disabled={!salesInvoiceNumber.trim() || settlePaymentMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-confirm-settle"
              >
                {settlePaymentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Settling...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Settlement
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apply Warranty Modal */}
      <Dialog open={showApplyWarrantyModal} onOpenChange={setShowApplyWarrantyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Apply E-Warranty
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Enter the e-warranty reference number to register the warranty for this job card.
            </p>
            <div className="space-y-2">
              <label htmlFor="warranty-reference" className="text-sm font-medium">
                Warranty Reference Number
              </label>
              <Input
                id="warranty-reference"
                placeholder="e.g., WRT-2025-001"
                value={warrantyReferenceNumber}
                onChange={(e) => setWarrantyReferenceNumber(e.target.value)}
                data-testid="input-warranty-reference"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowApplyWarrantyModal(false);
                  setWarrantyReferenceNumber('');
                }}
                data-testid="button-cancel-warranty"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (detailedJobCard?.id && warrantyReferenceNumber.trim()) {
                    applyWarrantyMutation.mutate({
                      jobCardId: detailedJobCard.id,
                      warrantyReferenceNumber: warrantyReferenceNumber.trim()
                    });
                  }
                }}
                disabled={!warrantyReferenceNumber.trim() || applyWarrantyMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-confirm-warranty"
              >
                {applyWarrantyMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Application
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}