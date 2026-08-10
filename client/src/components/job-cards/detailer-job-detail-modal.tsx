import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, ClockIcon, CheckCircle2, XCircle, PlayCircle, PauseCircle, UserIcon, PhoneIcon, MailIcon, MapPinIcon, CarIcon, WrenchIcon, CalendarDaysIcon, Users, Camera, Eye, Shield, Plus, Trash2, RotateCcw, Pencil } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { processImage } from '@/lib/imageProcessing';
import { displayContact } from '@shared/placeholderContact';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { ImageModal } from '@/components/ui/image-modal';
import { format } from 'date-fns';
import { PreInstallationModal } from '@/components/modals/PreInstallationModal';
import { ViewPreInstallationModal } from '@/components/modals/ViewPreInstallationModal';
import { PostInstallationPhotoUpload } from '@/components/job-cards/PostInstallationPhotoUpload';

interface JobCard {
  id: string;
  status: string;
  partnerId: string;
  createdAt?: string;
  acknowledgedAt?: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  approvedAt?: string;
  approvalRequestedAt?: string;
  rescheduleCount?: number;
  rescheduleReason?: string;
  rescheduleParty?: string;
  reachedAt?: string;
  reachedBy?: string;
  supersededByJobCardId?: string;
  preInstallResult?: 'PASS' | 'FAIL' | string;
  timelineTrail?: Array<{ at: string; type: string; detail?: string; by?: string; byRole?: string }>;
  partnerRemarks?: string;
  materialConsumptionJson?: any;
  batchNumbers?: string;
  batchNumberImage?: string;
  checklistJson?: any;
  assignedInstallerId?: string;
  assignedInstaller?: any;
  reworkReason?: string;
  reworkRequestedAt?: string;
  reworkRequestedBy?: string;
  reworkCompletedAt?: string;
  reworkCompletedBy?: string;
  preInstallationPhotoFront?: string;
  preInstallationPhotoBack?: string;
  preInstallationPhotoLeft?: string;
  preInstallationPhotoRight?: string;
  preInstallationRemarks?: string;
  preInstallationCompletedAt?: string;
  preInstallationCompletedBy?: string;
  eWarrantyApplied?: boolean;
  eWarrantyAppliedAt?: string;
  partnerBilledDirectly?: boolean;
  ppfBrand?: string | null; // film brand (e.g. "P91", "STEK")
  isP91Warranty?: boolean; // true => P91Elite registration flow (prompts for batch/VIN)
  workOrder: {
    id: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    customerAddress: string;
    regNo: string;
    quantity: number;
    notes?: string;
    status?: string;
    cancelledReason?: string;
    cancelledAt?: string;
    cancelledByName?: string;
    vehicleModel: {
      modelName: string;
      brand: { name: string };
    };
    service: {
      name: string;
      description: string;
    };
    showroom: {
      name: string;
      address?: string;
      city?: string;
      state?: string;
      contactPerson?: string;
      phone?: string;
      email?: string;
    };
  };
  partner: {
    id: string;
    displayName: string;
  };
  media?: Array<{
    id: string;
    type: string;
    url: string;
    caption?: string;
  }>;
}

interface DetailerJobDetailModalProps {
  jobCardId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DetailerJobDetailModal({ jobCardId, isOpen, onClose }: DetailerJobDetailModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State for different forms
  const [currentView, setCurrentView] = useState<'details' | 'acknowledge' | 'schedule' | 'reschedule' | 'reached' | 'start' | 'complete' | 'mark-fixed'>('details');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleInstallerId, setRescheduleInstallerId] = useState('');
  const [rescheduleParty, setRescheduleParty] = useState<'TEAM' | 'SHOWROOM'>('TEAM');
  const [rescheduleEscalation, setRescheduleEscalation] = useState(false);
  const [rescheduleEscalationReason, setRescheduleEscalationReason] = useState('');
  // Sq ft of roll used so far — mandatory only when rescheduling a job that has already started.
  const [rescheduleRollUsed, setRescheduleRollUsed] = useState('');
  // Inline "edit details" (fills in the N/A work-order fields from the job-card view).
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState({
    customerName: '', customerPhone: '', customerEmail: '', customerAddress: '', regNo: '', quantity: '', notes: '',
  });
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string>('');
  const [uploadedPostPhotos, setUploadedPostPhotos] = useState<Array<{label: string; url: string; originalSize: number; compressedSize: number}>>([]);
  
  // Image modal state
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  
  // Pre-installation modal state
  const [preInstallationModalOpen, setPreInstallationModalOpen] = useState(false);
  const [viewPreInstallationModalOpen, setViewPreInstallationModalOpen] = useState(false);
  
  // Material consumption form fields
  const [materialProductName, setMaterialProductName] = useState('');
  const [materialBatchNumber, setMaterialBatchNumber] = useState('');
  const [materialQuantityUsed, setMaterialQuantityUsed] = useState('');
  const [batchNumberImage, setBatchNumberImage] = useState<string | null>(null);
  const [batchNumberImageUploading, setBatchNumberImageUploading] = useState(false);
  // P91 e-warranty dialog (collects batch/VIN/qty before registering with P91 Elite).
  // Rolls are a repeatable {lotNumber, quantity} list — a job can use material from
  // more than one batch/roll (e.g. topped up from another stock), each with its own
  // quantity used, so this isn't a single shared quantity across all batch numbers.
  const [warrantyDialogOpen, setWarrantyDialogOpen] = useState(false);
  const [warrantyVin, setWarrantyVin] = useState('');
  const [warrantyRolls, setWarrantyRolls] = useState<Array<{ lotNumber: string; quantity: string }>>([{ lotNumber: '', quantity: '' }]);

  // No JSON validation needed for form fields

  // Quality checklist items
  const [checklist, setChecklist] = useState({
    edgesSealing: false,
    partsAssembling: false,
    cleanUp: false,
    badgesAndLogos: false,
    electronicsChecks: false,
    sensorsCheck: false
  });

  const { data: jobCard, isLoading } = useQuery<JobCard>({
    queryKey: ['/api/job-cards', jobCardId],
    queryFn: async () => {
      if (!jobCardId) return null;
      const response = await apiRequest('GET', `/api/job-cards/${jobCardId}`);
      return response.json();
    },
    enabled: !!jobCardId && isOpen
  });

  // Fetch team members for the current partner - get partnerId from job card
  const partnerId = jobCard?.partnerId;
  
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['/api/partners/staff', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const response = await apiRequest('GET', `/api/partners/${partnerId}/staff`);
      return response.json();
    },
    enabled: !!partnerId && isOpen
  });

  // Installer options for the reschedule form's "reassign to" picker — broader access than the
  // staff endpoint above so PARTNER_STAFF/DETAILING_PARTNER can also reassign while rescheduling.
  const { data: rescheduleOptions } = useQuery<{ installers: Array<{ id: string; name: string; role: string }> }>({
    queryKey: ['/api/job-cards', jobCardId, 'reschedule-options'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/job-cards/${jobCardId}/reschedule-options`);
      return response.json();
    },
    enabled: !!jobCardId && isOpen && currentView === 'reschedule',
  });

  const acknowledgeJobMutation = useMutation({
    mutationFn: async () => {
      // Assigning the team member is required to acknowledge.
      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/acknowledge`, { assignedInstallerId: selectedTeamMemberId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards', jobCardId] });
      toast({ title: 'Job Acknowledged', description: 'Job acknowledged and assigned to the team member.' });
      setCurrentView('details');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.message || 'Failed to acknowledge job card.', variant: 'destructive' });
    }
  });

  const scheduleJobMutation = useMutation({
    mutationFn: async () => {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/schedule`, { scheduledAt });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      toast({ title: 'Job Scheduled', description: 'Job card has been scheduled successfully.' });
      setCurrentView('details');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to schedule job card.', variant: 'destructive' });
    }
  });

  const rescheduleJobMutation = useMutation({
    mutationFn: async () => {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      const body: any = { scheduledAt, reason: rescheduleReason.trim() };
      // Only send an installer id when it's actually a change — otherwise the server treats it
      // as an in-place reschedule (same team, status/time only).
      if (rescheduleInstallerId && rescheduleInstallerId !== (jobCard?.assignedInstallerId || '')) {
        body.assignedInstallerId = rescheduleInstallerId;
      }
      if (isSuperAdmin) body.party = rescheduleParty;
      if (needsEscalationPrompt && rescheduleEscalation) {
        body.escalation = true;
        body.escalationReason = rescheduleEscalationReason.trim();
      }
      if (rescheduleStarted) body.rollUsedSqft = Number(rescheduleRollUsed);
      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/reschedule`, body);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards', jobCardId] });
      toast({
        title: 'Job Rescheduled',
        description: 'The new time (and team, if changed) is saved on this job card and both parties notified.',
      });
      setCurrentView('details');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.message || 'Failed to reschedule job card.', variant: 'destructive' });
    }
  });

  const reachedJobMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/reached`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      toast({ title: 'Marked Reached', description: 'The team has been marked on-site.' });
      setCurrentView('details');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to mark job as reached.', variant: 'destructive' });
    }
  });

  const updateDetailsMutation = useMutation({
    mutationFn: async () => {
      const body: any = {};
      for (const [k, v] of Object.entries(detailsForm)) {
        const val = String(v ?? '').trim();
        if (val !== '') body[k] = k === 'quantity' ? Number(val) : val;
      }
      const response = await apiRequest('PATCH', `/api/job-cards/${jobCardId}/work-order-details`, body);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards', jobCardId] });
      toast({ title: 'Details updated', description: 'The work-order details were saved.' });
      setEditingDetails(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.message || 'Failed to update details.', variant: 'destructive' });
    },
  });

  const preInstallResultMutation = useMutation({
    mutationFn: async (result: 'PASS' | 'FAIL') => {
      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/pre-install-result`, { result });
      return response.json();
    },
    onSuccess: (_data, result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards', jobCardId] });
      toast({
        title: result === 'PASS' ? 'Pre-installation passed' : 'Pre-installation failed',
        description: result === 'PASS' ? 'You can now Start Work.' : 'Please reschedule the job.',
      });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to record the pre-installation result.', variant: 'destructive' });
    }
  });

  const startJobMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/start`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      toast({ title: 'Job Started', description: 'Job card has been started successfully.' });
      setCurrentView('details');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to start job card.', variant: 'destructive' });
    }
  });

  const assignTeamMemberMutation = useMutation({
    mutationFn: async (installerId: string) => {
      const response = await apiRequest('PUT', `/api/job-cards/${jobCardId}/assign`, { assignedInstallerId: installerId });
      return response.json();
    },
    onSuccess: (updatedJobCard) => {
      // Update specific job card cache and general list
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards', jobCardId] });
      // Optionally update the data directly
      queryClient.setQueryData(['/api/job-cards', jobCardId], updatedJobCard);
      setSelectedTeamMemberId(updatedJobCard.assignedInstallerId || '');
      toast({ title: 'Team Member Assigned', description: 'Job card has been assigned to team member successfully.' });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error || 'Failed to assign team member.';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  });

  const completeJobMutation = useMutation({
    mutationFn: async () => {
      // Validate batch number image is required when batch number is provided
      if (materialBatchNumber.trim() && !batchNumberImage) {
        throw new Error('Batch number image is required when batch number is provided');
      }

      // Create material consumption object from form fields
      let materialConsumptionData = null;
      if (materialProductName.trim() || materialBatchNumber.trim() || materialQuantityUsed.trim()) {
        materialConsumptionData = {
          productName: materialProductName.trim() || null,
          batchNumber: materialBatchNumber.trim() || null,
          quantityUsed: materialQuantityUsed.trim() || null
        };
      }

      // Photos are already uploaded individually via PostInstallationPhotoUpload component
      // No need to upload files here

      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/complete`, {
        remarks: completionRemarks,
        checklistJson: checklist,
        materialConsumptionJson: materialConsumptionData,
        batchNumbers: materialBatchNumber.trim() || null,
        batchNumberImage: batchNumberImage || null
      });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh both the job cards list and specific job card  
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards', jobCardId] });
      toast({ title: 'Job Completed', description: 'Job card has been completed and submitted for approval.' });
      setCurrentView('details');
    },
    onError: (error: Error) => {
      const errorMessage = error.message || 'Failed to complete job card.';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  });

  const markFixedMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/mark-fixed`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards', jobCardId] });
      toast({ title: 'Rework Completed', description: 'Job has been marked as fixed and resubmitted for approval.' });
      onClose();
    },
    onError: (error: Error) => {
      const errorMessage = error.message || 'Failed to mark job as fixed.';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  });

  // E-Warranty Request Mutation. Payload is only sent for the P91 flow (batch/VIN);
  // STEK stays one-click (no payload).
  const applyWarrantyMutation = useMutation({
    mutationFn: async (payload?: { vin?: string; lotNumbers?: Array<{ lotNumber: string; quantity: number }> }) => {
      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/request-e-warranty`, payload);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards', jobCardId] });
      setWarrantyDialogOpen(false);
      toast({
        title: 'E-Warranty Applied',
        description: data?.warranty?.code
          ? `Registered with P91 Elite. Warranty code: ${data.warranty.code}`
          : 'E-Warranty application has been submitted successfully. Notification emails have been sent.',
      });
    },
    onError: (error: Error) => {
      const errorMessage = error.message || 'Failed to apply e-warranty.';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  });

  // Open the P91 dialog with values pre-filled from the job card (single roll).
  // "Add Roll" below lets the user add extra batch/quantity pairs for material
  // used from another roll/stock beyond what the job card itself captured.
  const openWarrantyDialog = () => {
    const reg = (jobCard?.workOrder?.regNo || '').trim();
    setWarrantyVin(reg === '-' ? '' : reg);
    const consumption = (jobCard?.materialConsumptionJson as any) || {};
    const qty = consumption.plannedQuantity ?? consumption.quantity ?? consumption.quantityUsed ?? '';
    setWarrantyRolls([{ lotNumber: jobCard?.batchNumbers || '', quantity: qty === '' ? '' : String(qty) }]);
    setWarrantyDialogOpen(true);
  };

  const addWarrantyRoll = () => setWarrantyRolls((rolls) => [...rolls, { lotNumber: '', quantity: '' }]);
  const removeWarrantyRoll = (index: number) =>
    setWarrantyRolls((rolls) => (rolls.length > 1 ? rolls.filter((_, i) => i !== index) : rolls));
  const updateWarrantyRoll = (index: number, field: 'lotNumber' | 'quantity', value: string) =>
    setWarrantyRolls((rolls) => rolls.map((r, i) => (i === index ? { ...r, [field]: value } : r)));

  // Submit the P91 dialog: every roll needs a batch number AND a quantity > 0.
  const submitP91Warranty = () => {
    const rows = warrantyRolls.filter((r) => r.lotNumber.trim() || r.quantity.trim());
    if (rows.length === 0) {
      toast({ title: 'Batch number required', description: 'Enter at least one batch number.', variant: 'destructive' });
      return;
    }
    const missingBatch = rows.some((r) => !r.lotNumber.trim());
    if (missingBatch) {
      toast({ title: 'Batch number required', description: 'Every roll needs a batch number.', variant: 'destructive' });
      return;
    }
    const zeroQty = rows.filter((r) => !(Number(r.quantity) > 0)).map((r) => r.lotNumber.trim());
    if (zeroQty.length > 0) {
      toast({
        title: 'Quantity required',
        description: `Quantity must be greater than 0 for: ${zeroQty.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }
    const lotNumbers = rows.map((r) => ({ lotNumber: r.lotNumber.trim(), quantity: Number(r.quantity) }));
    applyWarrantyMutation.mutate({ vin: warrantyVin.trim() || undefined, lotNumbers });
  };

  // Batch number image upload handler
  const handleBatchNumberImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setBatchNumberImageUploading(true);

      // Compress/convert (handles HEIC from phones), then upload via the server,
      // which pushes to S3 and returns a stable "/objects/..." path. Uploading
      // through the server avoids the browser->S3 CORS preflight that the bucket
      // rejects (see /api/objects/upload-file).
      const processed = await processImage(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        quality: 0.8,
      });

      const formData = new FormData();
      formData.append('file', processed.file);

      const response = await apiRequest('POST', '/api/objects/upload-file', formData);
      const { url } = await response.json();

      setBatchNumberImage(url);
      toast({ title: 'Success', description: 'Batch number image uploaded successfully' });
    } catch (error: any) {
      toast({ 
        title: 'Upload Failed', 
        description: error.message || 'Failed to upload batch number image', 
        variant: 'destructive' 
      });
    } finally {
      setBatchNumberImageUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'AWAITING_ACK': 'bg-yellow-100 text-yellow-800',
      'ACKNOWLEDGED': 'bg-blue-100 text-blue-800',
      'SCHEDULED': 'bg-purple-100 text-purple-800',
      'RESCHEDULED': 'bg-amber-100 text-amber-800',
      'REACHED': 'bg-teal-100 text-teal-800',
      'IN_PROGRESS': 'bg-orange-100 text-orange-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'PENDING_APPROVAL': 'bg-indigo-100 text-indigo-800',
      'APPROVED': 'bg-emerald-100 text-emerald-800',
      'REWORK_REQUESTED': 'bg-yellow-100 text-yellow-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canEditDetails = ['SUPER_ADMIN', 'ADMIN', 'PARTNER_ADMIN', 'PARTNER_STAFF', 'DETAILING_PARTNER'].includes(user?.role || '');
  const openEditDetails = () => {
    const wo: any = jobCard?.workOrder || {};
    setDetailsForm({
      customerName: wo.customerName || '', customerPhone: wo.customerPhone || '', customerEmail: wo.customerEmail || '',
      customerAddress: wo.customerAddress || '', regNo: wo.regNo || '', quantity: wo.quantity ? String(wo.quantity) : '',
      notes: wo.notes || '',
    });
    setEditingDetails(true);
  };
  const canAcknowledge = jobCard?.status === 'AWAITING_ACK';
  const canSchedule = jobCard?.status === 'ACKNOWLEDGED';
  // Corrected flow: SCHEDULED → REACHED → pre-install (PASS/FAIL) → Start.
  const preStartStatus = ['SCHEDULED', 'RESCHEDULED', 'REACHED'].includes(jobCard?.status || '');
  // Reschedule is available all the way until Start (incl. after a failed pre-install). Once the
  // job has STARTED, only a Super Admin may reschedule (and reassign a team).
  const canReschedule = preStartStatus || (jobCard?.status === 'IN_PROGRESS' && isSuperAdmin);
  const canReachedStatus = ['SCHEDULED', 'RESCHEDULED'].includes(jobCard?.status || '');
  // Partner-level: Mark Reached is available from 3h BEFORE the scheduled time to 3 days AFTER it
  // (not way ahead). Super Admin has no such restriction.
  const withinReachWindow = isSuperAdmin || (jobCard?.scheduledAt ? (() => {
    const sched = new Date(jobCard.scheduledAt).getTime();
    const now = Date.now();
    return now >= sched - 3 * 60 * 60 * 1000 && now <= sched + 3 * 24 * 60 * 60 * 1000;
  })() : false);
  const canReached = canReachedStatus;
  const preInstallPassed = jobCard?.preInstallResult === 'PASS';
  const preInstallFailed = jobCard?.preInstallResult === 'FAIL';
  // After Reached, run the pre-install check (until it passes). Start only appears once it PASSES.
  const needsPreInstallation = jobCard?.status === 'REACHED' && !preInstallPassed;
  const canStart = jobCard?.status === 'REACHED' && preInstallPassed;
  const canComplete = jobCard?.status === 'IN_PROGRESS';
  const needsRework = jobCard?.status === 'REWORK_REQUESTED';
  const rescheduleCount = jobCard?.rescheduleCount || 0;
  // Reschedule is unlimited (no visible cap). Past the 6th, we softly ask about escalation.
  const needsEscalationPrompt = rescheduleCount >= 6;
  // Rescheduling an already-started job must capture the sq ft of roll already used.
  const rescheduleStarted = !!jobCard?.startedAt || jobCard?.status === 'IN_PROGRESS';
  const hasPreInstallationPhotos = !!(jobCard?.preInstallationPhotoFront && jobCard?.preInstallationPhotoBack && jobCard?.preInstallationPhotoLeft && jobCard?.preInstallationPhotoRight);
  // E-Warranty: available from COMPLETED onward (both brands), when not already applied.
  const canApplyWarranty = jobCard?.partnerBilledDirectly &&
                          ['COMPLETED', 'PENDING_APPROVAL', 'PENDING_SALES_INVOICE', 'APPROVED'].includes(jobCard?.status || '') &&
                          !jobCard?.eWarrantyApplied;

  const resetForm = () => {
    setCurrentView('details');
    setScheduleDate('');
    setScheduleTime('');
    setRescheduleReason('');
    setRescheduleInstallerId('');
    setRescheduleParty('TEAM');
    setRescheduleEscalation(false);
    setRescheduleEscalationReason('');
    setRescheduleRollUsed('');
    setCompletionRemarks('');
    setUploadedPostPhotos([]);
    setSelectedTeamMemberId(jobCard?.assignedInstallerId || '');
    setMaterialProductName('');
    setMaterialBatchNumber('');
    setMaterialQuantityUsed('');
    setChecklist({
      edgesSealing: false,
      partsAssembling: false,
      cleanUp: false,
      badgesAndLogos: false,
      electronicsChecks: false,
      sensorsCheck: false
    });
  };

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  // Initialize selectedTeamMemberId when jobCard data is loaded
  useEffect(() => {
    if (jobCard?.assignedInstallerId) {
      setSelectedTeamMemberId(jobCard.assignedInstallerId);
    }
  }, [jobCard?.assignedInstallerId]);

  if (!isOpen || !jobCardId) return null;

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!jobCard) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="text-center text-red-600">Job card not found</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <WrenchIcon className="h-6 w-6 text-blue-600" />
            Job Card: {jobCard.id.slice(0, 8)}
            <Badge className={getStatusColor(jobCard.status)}>
              {jobCard.status.replace('_', ' ')}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {currentView === 'details' && (
          <div className="space-y-6">
            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              {canAcknowledge && (
                <Button onClick={() => setCurrentView('acknowledge')} className="bg-blue-600 hover:bg-blue-700" data-testid="button-acknowledge">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Acknowledge Job
                </Button>
              )}
              {canSchedule && (
                <Button onClick={() => setCurrentView('schedule')} className="bg-purple-600 hover:bg-purple-700" data-testid="button-schedule">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Schedule Visit
                </Button>
              )}
              {canReschedule && (
                <Button
                  onClick={() => { setScheduleDate(''); setScheduleTime(''); setRescheduleReason(''); setRescheduleInstallerId(''); setRescheduleParty('TEAM'); setRescheduleEscalation(false); setRescheduleEscalationReason(''); setRescheduleRollUsed(''); setCurrentView('reschedule'); }}
                  variant="outline"
                  className="border-amber-300 text-amber-800 hover:bg-amber-50"
                  data-testid="button-reschedule"
                >
                  <CalendarDaysIcon className="h-4 w-4 mr-2" />
                  Reschedule
                </Button>
              )}
              {canReached && (
                <Button
                  onClick={() => setCurrentView('reached')}
                  disabled={!withinReachWindow}
                  title={!withinReachWindow ? 'Available within 4 hours of the scheduled time' : undefined}
                  className="bg-teal-600 hover:bg-teal-700"
                  data-testid="button-reached"
                >
                  <MapPinIcon className="h-4 w-4 mr-2" />
                  Mark Reached
                </Button>
              )}
              {/* Step 1 — Pre-installation CHECK (Pass/Fail) comes first; photos are NOT required yet. */}
              {needsPreInstallation && (
                <>
                  <Button onClick={() => preInstallResultMutation.mutate('PASS')} disabled={preInstallResultMutation.isPending} className="bg-green-600 hover:bg-green-700" data-testid="button-preinstall-pass">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Pre-install Check: Pass
                  </Button>
                  <Button onClick={() => preInstallResultMutation.mutate('FAIL')} disabled={preInstallResultMutation.isPending} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" data-testid="button-preinstall-fail">
                    <XCircle className="h-4 w-4 mr-2" />
                    Pre-install Check: Fail
                  </Button>
                </>
              )}
              {/* Step 2 — after PASS: pre-installation PHOTOS + Start Work together (photos can be added after). */}
              {canStart && !hasPreInstallationPhotos && (
                <Button onClick={() => setPreInstallationModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700" data-testid="button-pre-installation">
                  <Camera className="h-4 w-4 mr-2" />
                  Pre-Installation Photos
                </Button>
              )}
              {canStart && (
                <Button onClick={() => setCurrentView('start')} className="bg-orange-600 hover:bg-orange-700" data-testid="button-start">
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Start Work
                </Button>
              )}
              {hasPreInstallationPhotos && (
                <Button onClick={() => setViewPreInstallationModalOpen(true)} variant="outline" data-testid="button-view-pre-installation">
                  <Eye className="h-4 w-4 mr-2" />
                  View Pre-Installation Photos
                </Button>
              )}
              {canComplete && (
                <Button onClick={() => setCurrentView('complete')} className="bg-green-600 hover:bg-green-700" data-testid="button-complete">
                  <PauseCircle className="h-4 w-4 mr-2" />
                  Complete Job
                </Button>
              )}
              {/* Rework is now handled by creating a new linked job card, so the in-place
                  "Mark as Fixed" action has been retired. This card stays as a historical record. */}
              {canApplyWarranty && (
                <Button
                  onClick={() => (jobCard?.isP91Warranty ? openWarrantyDialog() : applyWarrantyMutation.mutate(undefined))}
                  disabled={applyWarrantyMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700"
                  data-testid="button-apply-warranty"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  {applyWarrantyMutation.isPending ? 'Applying...' : 'Apply for E-Warranty'}
                </Button>
              )}
            </div>

            {/* Pre-installation FAILED notice — the job must be rescheduled. */}
            {preInstallFailed && jobCard?.status === 'REACHED' && (
              <Card className="border-2 border-red-200 bg-red-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-red-800 flex items-center gap-2">
                    <XCircle className="h-5 w-5" />
                    Pre-installation check failed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-red-700">
                    The pre-installation check was marked <strong>Fail</strong>. Please <strong>Reschedule</strong> the job
                    to a new time. Once the team has reached again, you can re-run the check.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Pre-Installation Required Notice */}
            {needsPreInstallation && !preInstallFailed && (
              <Card className="border-2 border-indigo-200 bg-indigo-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-indigo-800 flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Pre-Installation Check
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-indigo-700">
                    Inspect the vehicle and mark the pre-installation check <strong>Pass</strong> or <strong>Fail</strong>.
                    Pass unlocks <strong>Start Work</strong> and the pre-installation photos (upload them then, or right after
                    starting). Fail sends the job back to Reschedule.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Pre-installation PASSED — photos + Start Work available together */}
            {canStart && !hasPreInstallationPhotos && (
              <Card className="border-2 border-green-200 bg-green-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-green-800 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Pre-installation check passed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-green-700">
                    Upload the 4 pre-installation photos and start the work — you can add the photos now or right after
                    starting the job.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Pre-Installation Completed Notice */}
            {hasPreInstallationPhotos && jobCard?.preInstallationCompletedAt && (
              <Card className="border-2 border-green-200 bg-green-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-green-800 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Pre-Installation Inspection Completed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-green-700">
                    Pre-installation photos were uploaded on {format(new Date(jobCard.preInstallationCompletedAt), 'PPp')}. 
                    You can now proceed to start the installation work.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Rework Information */}
            {needsRework && jobCard?.reworkReason && (
              <Card className="border-2 border-yellow-200 bg-yellow-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-yellow-800 flex items-center gap-2">
                    <WrenchIcon className="h-5 w-5" />
                    Rework Required
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-yellow-800">Admin Request:</p>
                    <p className="text-sm text-yellow-700 bg-yellow-100 p-3 rounded border">{jobCard.reworkReason}</p>
                    {jobCard.reworkRequestedAt && (
                      <p className="text-xs text-yellow-600">
                        Requested on: {format(new Date(jobCard.reworkRequestedAt), 'PPp')}
                      </p>
                    )}
                    <p className="text-sm text-yellow-800 font-medium mt-3">
                      ⚠️ A new job card has been created against this work order to redo the work. This card is kept as a record of the original job.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cancellation Information */}
            {jobCard?.status === 'CANCELLED' && jobCard?.workOrder?.status === 'CANCELLED' && (
              <Card className="border-2 border-red-200 bg-red-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-red-800 flex items-center gap-2">
                    <PauseCircle className="h-5 w-5" />
                    Work Order Cancelled
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {jobCard.workOrder.cancelledReason && (
                      <div>
                        <p className="text-sm font-medium text-red-800">Cancellation Reason:</p>
                        <p className="text-sm text-red-700 bg-red-100 p-3 rounded border mt-1">
                          {jobCard.workOrder.cancelledReason}
                        </p>
                      </div>
                    )}
                    {jobCard.workOrder.cancelledAt && (
                      <p className="text-xs text-red-600">
                        Cancelled on: {format(new Date(jobCard.workOrder.cancelledAt), 'PPp')}
                      </p>
                    )}
                    {jobCard.workOrder.cancelledByName && (
                      <p className="text-xs text-red-600">
                        Cancelled by: {jobCard.workOrder.cancelledByName}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Team Member Assignment */}
            {teamMembers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    Team Member Assignment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="team-member-select">Assign to Team Member</Label>
                      <Select
                        value={selectedTeamMemberId}
                        onValueChange={setSelectedTeamMemberId}
                        data-testid="select-team-member"
                      >
                        <SelectTrigger id="team-member-select">
                          <SelectValue placeholder="Select a team member" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned" data-testid="option-unassigned">
                            Unassigned
                          </SelectItem>
                          {teamMembers.map((member: any) => (
                            <SelectItem key={member.id} value={member.id} data-testid={`option-member-${member.id}`}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={() => assignTeamMemberMutation.mutate(selectedTeamMemberId)}
                        disabled={assignTeamMemberMutation.isPending || selectedTeamMemberId === jobCard?.assignedInstallerId}
                        variant="outline"
                        data-testid="button-assign-member"
                      >
                        {assignTeamMemberMutation.isPending ? 'Assigning...' : 'Assign'}
                      </Button>
                    </div>
                  </div>
                  {jobCard?.assignedInstallerId && (
                    <div className="mt-2 text-sm text-gray-600" data-testid="text-current-assignment">
                      Currently assigned to: {jobCard?.assignedInstaller?.name || teamMembers.find((m: any) => m.id === jobCard?.assignedInstallerId)?.name || 'Unknown'}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Edit missing details — lets you fill in the "N/A" work-order fields from here. */}
            {canEditDetails && !editingDetails && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={openEditDetails} data-testid="button-edit-details">
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit details
                </Button>
              </div>
            )}
            {canEditDetails && editingDetails && (
              <Card className="border-2 border-blue-200 bg-blue-50/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-blue-600" />
                    Edit details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="edit-customer-name">Customer name</Label>
                      <Input id="edit-customer-name" value={detailsForm.customerName}
                        onChange={(e) => setDetailsForm((f) => ({ ...f, customerName: e.target.value }))}
                        placeholder="Customer name" data-testid="input-edit-customer-name" />
                    </div>
                    <div>
                      <Label htmlFor="edit-customer-phone">Phone</Label>
                      <Input id="edit-customer-phone" value={detailsForm.customerPhone}
                        onChange={(e) => setDetailsForm((f) => ({ ...f, customerPhone: e.target.value }))}
                        placeholder="Phone" data-testid="input-edit-customer-phone" />
                    </div>
                    <div>
                      <Label htmlFor="edit-customer-email">Email</Label>
                      <Input id="edit-customer-email" value={detailsForm.customerEmail}
                        onChange={(e) => setDetailsForm((f) => ({ ...f, customerEmail: e.target.value }))}
                        placeholder="Email" data-testid="input-edit-customer-email" />
                    </div>
                    <div>
                      <Label htmlFor="edit-reg-no">Registration No</Label>
                      <Input id="edit-reg-no" value={detailsForm.regNo}
                        onChange={(e) => setDetailsForm((f) => ({ ...f, regNo: e.target.value }))}
                        placeholder="Registration / VIN number" data-testid="input-edit-reg-no" />
                    </div>
                    <div>
                      <Label htmlFor="edit-quantity">Quantity</Label>
                      <Input id="edit-quantity" type="number" min="1" value={detailsForm.quantity}
                        onChange={(e) => setDetailsForm((f) => ({ ...f, quantity: e.target.value }))}
                        placeholder="Quantity" data-testid="input-edit-quantity" />
                    </div>
                    <div>
                      <Label htmlFor="edit-customer-address">Address</Label>
                      <Input id="edit-customer-address" value={detailsForm.customerAddress}
                        onChange={(e) => setDetailsForm((f) => ({ ...f, customerAddress: e.target.value }))}
                        placeholder="Address" data-testid="input-edit-customer-address" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="edit-notes">Notes</Label>
                    <Textarea id="edit-notes" rows={2} value={detailsForm.notes}
                      onChange={(e) => setDetailsForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Work order notes" data-testid="input-edit-notes" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => updateDetailsMutation.mutate()} disabled={updateDetailsMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700" data-testid="button-save-details">
                      {updateDetailsMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                    <Button variant="outline" onClick={() => setEditingDetails(false)} data-testid="button-cancel-details">
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Customer Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserIcon className="h-5 w-5 text-blue-600" />
                    Customer Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Name</Label>
                    <p className="text-sm font-semibold" data-testid="text-customer-name">{jobCard?.workOrder?.customerName || "N/A"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Phone</Label>
                      <p className="text-sm flex items-center gap-1" data-testid="text-customer-phone">
                        <PhoneIcon className="h-3 w-3" />
                        {displayContact(jobCard?.workOrder?.customerPhone)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Email</Label>
                      <p className="text-sm flex items-center gap-1" data-testid="text-customer-email">
                        <MailIcon className="h-3 w-3" />
                        {displayContact(jobCard?.workOrder?.customerEmail)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Address</Label>
                    <p className="text-sm flex items-center gap-1" data-testid="text-customer-address">
                      <MapPinIcon className="h-3 w-3" />
                      {jobCard?.workOrder?.customerAddress || "N/A"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Vehicle Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CarIcon className="h-5 w-5 text-green-600" />
                    Vehicle Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Vehicle</Label>
                    <p className="text-sm font-semibold" data-testid="text-vehicle-info">
                      {jobCard?.workOrder?.vehicleModel?.brand?.name || "N/A"} {jobCard?.workOrder?.vehicleModel?.modelName || "N/A"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Registration No</Label>
                      <p className="text-sm" data-testid="text-reg-no">{jobCard?.workOrder?.regNo || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Quantity</Label>
                      <p className="text-sm" data-testid="text-quantity">{jobCard?.workOrder?.quantity || "N/A"}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Service</Label>
                    <p className="text-sm font-semibold" data-testid="text-service">{jobCard?.workOrder?.service?.name || "N/A"}</p>
                    <p className="text-xs text-gray-500">{jobCard?.workOrder?.service?.description || "N/A"}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Showroom Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPinIcon className="h-5 w-5 text-purple-600" />
                    Showroom Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Showroom Name</Label>
                    <p className="text-sm font-semibold" data-testid="text-showroom-name">{jobCard?.workOrder?.showroom?.name || "N/A"}</p>
                  </div>
                  
                  {jobCard?.workOrder?.showroom?.address && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Address</Label>
                      <p className="text-sm text-gray-700" data-testid="text-showroom-address">
                        {jobCard?.workOrder?.showroom?.address || "N/A"}
                        {jobCard?.workOrder?.showroom?.city && `, ${jobCard.workOrder.showroom.city}`}
                        {jobCard?.workOrder?.showroom?.state && `, ${jobCard.workOrder.showroom.state}`}
                      </p>
                    </div>
                  )}
                  
                  {(jobCard?.workOrder?.showroom?.contactPerson || jobCard?.workOrder?.showroom?.phone || jobCard?.workOrder?.showroom?.email) && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Contact Information</Label>
                      <div className="space-y-1">
                        {jobCard?.workOrder?.showroom?.contactPerson && (
                          <p className="text-sm text-gray-700" data-testid="text-showroom-contact">
                            Contact: {jobCard.workOrder.showroom.contactPerson}
                          </p>
                        )}
                        {jobCard?.workOrder?.showroom?.phone && (
                          <p className="text-sm text-gray-700" data-testid="text-showroom-phone">
                            Phone: {jobCard.workOrder.showroom.phone}
                          </p>
                        )}
                        {jobCard?.workOrder?.showroom?.email && (
                          <p className="text-sm text-gray-700" data-testid="text-showroom-email">
                            Email: {jobCard.workOrder.showroom.email}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Service Instructions</Label>
                    <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded" data-testid="text-service-instructions">
                      Contact the showroom before arriving to confirm vehicle availability and service requirements.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDaysIcon className="h-5 w-5 text-purple-600" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {jobCard.createdAt && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <span className="text-sm">Created on {format(new Date(jobCard.createdAt), 'PPp')}</span>
                    </div>
                  )}
                  {jobCard.acknowledgedAt && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <span className="text-sm">Acknowledged on {format(new Date(jobCard.acknowledgedAt), 'PPp')}</span>
                    </div>
                  )}
                  {jobCard.scheduledAt && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                      <span className="text-sm">Scheduled for {format(new Date(jobCard.scheduledAt), 'PPp')}</span>
                    </div>
                  )}
                  {jobCard.rescheduleReason && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-amber-600 rounded-full mt-1.5"></div>
                      <span className="text-sm">
                        Rescheduled{jobCard.rescheduleCount ? ` (${jobCard.rescheduleCount}/3)` : ''} — {jobCard.rescheduleReason}
                      </span>
                    </div>
                  )}
                  {jobCard.reachedAt && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-teal-600 rounded-full"></div>
                      <span className="text-sm">Reached on {format(new Date(jobCard.reachedAt), 'PPp')}</span>
                    </div>
                  )}
                  {jobCard.startedAt && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                      <span className="text-sm">Started on {format(new Date(jobCard.startedAt), 'PPp')}</span>
                    </div>
                  )}
                  {jobCard.completedAt && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      <span className="text-sm">Completed on {format(new Date(jobCard.completedAt), 'PPp')}</span>
                    </div>
                  )}
                  {jobCard.approvedAt && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
                      <span className="text-sm">Approved on {format(new Date(jobCard.approvedAt), 'PPp')}</span>
                    </div>
                  )}
                  {/* Full trail: reschedules (with reason + any team change), pre-install pass/fail. */}
                  {Array.isArray(jobCard.timelineTrail) && jobCard.timelineTrail.length > 0 && (
                    <div className="pt-2 border-t space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">History</p>
                      {jobCard.timelineTrail.map((t, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <RotateCcw className="h-3.5 w-3.5 text-slate-400 mt-1" />
                          <span className="text-sm">
                            <span className="font-medium">{t.type.replace(/_/g, ' ')}</span>
                            {t.detail ? ` — ${t.detail}` : ''}
                            <span className="text-xs text-muted-foreground"> · {format(new Date(t.at), 'PPp')}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!jobCard.createdAt && !jobCard.acknowledgedAt && !jobCard.scheduledAt && !jobCard.startedAt && !jobCard.completedAt && (
                    <p className="text-sm text-muted-foreground">No timeline events yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Uploaded Images */}
            {jobCard?.media && jobCard.media.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="h-5 w-5 text-green-600" />
                    Uploaded Images
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {jobCard.media.map((mediaItem: any, index: number) => (
                      <div key={mediaItem.id || index} className="relative group">
                        <img 
                          src={mediaItem.url} 
                          alt={mediaItem.caption || `Job card image ${index + 1}`} 
                          className="w-full h-32 object-cover rounded-lg border border-gray-200 group-hover:border-green-500 transition-colors cursor-pointer hover:opacity-80"
                          data-testid={`uploaded-image-${index}`}
                          onClick={() => {
                            setSelectedImageIndex(index);
                            setImageModalOpen(true);
                          }}
                        />
                        {mediaItem.caption && (
                          <p className="text-xs text-gray-600 mt-1 text-center" data-testid={`image-caption-${index}`}>
                            {mediaItem.caption}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Additional Information */}
            {(jobCard?.workOrder?.notes || jobCard.partnerRemarks) && (
              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {jobCard?.workOrder?.notes && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Work Order Notes</Label>
                      <p className="text-sm" data-testid="text-work-order-notes">{jobCard?.workOrder?.notes || "N/A"}</p>
                    </div>
                  )}
                  {jobCard.partnerRemarks && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Partner Remarks</Label>
                      <p className="text-sm" data-testid="text-partner-remarks">{jobCard.partnerRemarks}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Material Consumption Details (Readonly View) */}
            {(jobCard?.materialConsumptionJson || jobCard?.batchNumbers || jobCard?.batchNumberImage) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <WrenchIcon className="h-5 w-5 text-gray-600" />
                    Material Consumption
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {jobCard?.materialConsumptionJson && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {jobCard.materialConsumptionJson.productName && (
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Product Name</Label>
                          <p className="text-sm">{jobCard.materialConsumptionJson.productName}</p>
                        </div>
                      )}
                      {jobCard.materialConsumptionJson.batchNumber && (
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Batch Number</Label>
                          <p className="text-sm">{jobCard.materialConsumptionJson.batchNumber}</p>
                        </div>
                      )}
                      {jobCard.materialConsumptionJson.quantityUsed && (
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Quantity Used</Label>
                          <p className="text-sm">{jobCard.materialConsumptionJson.quantityUsed}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {jobCard?.batchNumbers && !jobCard?.materialConsumptionJson?.batchNumber && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Batch Number</Label>
                      <p className="text-sm">{jobCard.batchNumbers}</p>
                    </div>
                  )}
                  {jobCard?.batchNumberImage && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600 flex items-center gap-2">
                        <Camera className="h-4 w-4" />
                        Batch Number Image
                      </Label>
                      <div className="mt-2">
                        <img 
                          src={jobCard.batchNumberImage} 
                          alt="Batch Number" 
                          className="max-w-xs rounded border shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(jobCard.batchNumberImage, '_blank')}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Acknowledge Form */}
        {currentView === 'acknowledge' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Acknowledge Job Assignment</h3>
            <p className="text-sm text-gray-600">
              By acknowledging this job, you confirm you’ve received the assignment. You must also assign the team
              member who will carry it out — acknowledging requires a team member.
            </p>
            <div>
              <Label htmlFor="ack-team-member">Assign team member <span className="text-red-500">*</span></Label>
              <Select value={selectedTeamMemberId} onValueChange={setSelectedTeamMemberId}>
                <SelectTrigger id="ack-team-member" data-testid="select-ack-team-member">
                  <SelectValue placeholder="Select a team member" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member: any) => (
                    <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {teamMembers.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No team members found for this partner — add staff first.</p>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => acknowledgeJobMutation.mutate()}
                disabled={acknowledgeJobMutation.isPending || !selectedTeamMemberId}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-confirm-acknowledge"
              >
                {acknowledgeJobMutation.isPending ? 'Acknowledging...' : 'Confirm & Assign'}
              </Button>
              <Button variant="outline" onClick={() => setCurrentView('details')} data-testid="button-cancel-acknowledge">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Schedule Form */}
        {currentView === 'schedule' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Schedule Installation Visit</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="schedule-date">Date</Label>
                <Input
                  id="schedule-date"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  data-testid="input-schedule-date"
                />
              </div>
              <div>
                <Label htmlFor="schedule-time">Time</Label>
                <Input
                  id="schedule-time"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  data-testid="input-schedule-time"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => scheduleJobMutation.mutate()}
                disabled={scheduleJobMutation.isPending || !scheduleDate || !scheduleTime}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-confirm-schedule"
              >
                {scheduleJobMutation.isPending ? 'Scheduling...' : 'Confirm Schedule'}
              </Button>
              <Button variant="outline" onClick={() => setCurrentView('details')} data-testid="button-cancel-schedule">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Reschedule Form */}
        {currentView === 'reschedule' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Reschedule Visit</h3>
            <p className="text-sm text-muted-foreground">
              Pick a new date &amp; time and give a reason. Both the partner team and the showroom/salesperson
              will be notified.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reschedule-date">New Date</Label>
                <Input id="reschedule-date" type="date" value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]} data-testid="input-reschedule-date" />
              </div>
              <div>
                <Label htmlFor="reschedule-time">New Time</Label>
                <Input id="reschedule-time" type="time" value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)} data-testid="input-reschedule-time" />
              </div>
            </div>
            <div>
              <Label htmlFor="reschedule-reason">Reason <span className="text-red-500">*</span></Label>
              <Textarea id="reschedule-reason" rows={3} value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="Why is this being rescheduled?" data-testid="input-reschedule-reason" />
            </div>
            {rescheduleStarted && (
              <div>
                <Label htmlFor="reschedule-roll-used">Sq ft of roll used so far <span className="text-red-500">*</span></Label>
                <Input id="reschedule-roll-used" type="number" min="0" step="0.01" value={rescheduleRollUsed}
                  onChange={(e) => setRescheduleRollUsed(e.target.value)}
                  placeholder="e.g. 12.5" data-testid="input-reschedule-roll-used" />
                <p className="text-xs text-muted-foreground mt-1">
                  This job has already started — record the PPF roll consumed so far (in sq ft) before pausing.
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="reschedule-installer">Team member</Label>
              <Select value={rescheduleInstallerId || jobCard?.assignedInstallerId || ''} onValueChange={setRescheduleInstallerId}>
                <SelectTrigger id="reschedule-installer" data-testid="select-reschedule-installer">
                  <SelectValue placeholder="Keep current team member" />
                </SelectTrigger>
                <SelectContent>
                  {(rescheduleOptions?.installers || []).map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Only change this if the job is being handed to a different team member — that creates a
                new job card for them. Leaving it as-is just updates the time on this job card.
              </p>
            </div>
            {isSuperAdmin && (
              <div>
                <Label htmlFor="reschedule-party">Which party wants to reschedule ?</Label>
                <Select value={rescheduleParty} onValueChange={(v) => setRescheduleParty(v as 'TEAM' | 'SHOWROOM')}>
                  <SelectTrigger id="reschedule-party" data-testid="select-reschedule-party">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEAM">Team / Partner</SelectItem>
                    <SelectItem value="SHOWROOM">Showroom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Soft escalation prompt — only after the 6th reschedule (no hard limit is shown). */}
            {needsEscalationPrompt && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
                <p className="text-sm text-amber-800">
                  This job has been rescheduled several times. Should this be flagged as an escalation?
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={rescheduleEscalation} onChange={(e) => setRescheduleEscalation(e.target.checked)} data-testid="checkbox-reschedule-escalation" />
                  Yes, flag as an escalation
                </label>
                {rescheduleEscalation && (
                  <Textarea
                    rows={2}
                    value={rescheduleEscalationReason}
                    onChange={(e) => setRescheduleEscalationReason(e.target.value)}
                    placeholder="Escalation reason…"
                    data-testid="input-reschedule-escalation-reason"
                  />
                )}
              </div>
            )}
            <div className="flex gap-3">
              <Button
                onClick={() => rescheduleJobMutation.mutate()}
                disabled={rescheduleJobMutation.isPending || !scheduleDate || !scheduleTime || !rescheduleReason.trim() || (needsEscalationPrompt && rescheduleEscalation && !rescheduleEscalationReason.trim()) || (rescheduleStarted && (rescheduleRollUsed.trim() === '' || Number.isNaN(Number(rescheduleRollUsed)) || Number(rescheduleRollUsed) < 0))}
                className="bg-amber-600 hover:bg-amber-700"
                data-testid="button-confirm-reschedule"
              >
                {rescheduleJobMutation.isPending ? 'Rescheduling...' : 'Confirm Reschedule'}
              </Button>
              <Button variant="outline" onClick={() => setCurrentView('details')} data-testid="button-cancel-reschedule">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Reached Confirmation */}
        {currentView === 'reached' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Mark Team as Reached</h3>
            <p className="text-sm text-muted-foreground">
              Confirm that the team has reached the site for this job. This moves the job to
              <span className="font-medium"> Reached</span>, after which the pre-installation check becomes available.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => reachedJobMutation.mutate()}
                disabled={reachedJobMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700"
                data-testid="button-confirm-reached"
              >
                {reachedJobMutation.isPending ? 'Saving...' : 'Confirm Reached'}
              </Button>
              <Button variant="outline" onClick={() => setCurrentView('details')} data-testid="button-cancel-reached">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Start Form */}
        {currentView === 'start' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Start Installation Work</h3>
            <p className="text-sm text-gray-600">
              Mark this job as started. This will update the status and notify the showroom that installation has begun.
            </p>
            <div className="flex gap-3">
              <Button 
                onClick={() => startJobMutation.mutate()} 
                disabled={startJobMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700"
                data-testid="button-confirm-start"
              >
                {startJobMutation.isPending ? 'Starting...' : 'Start Work'}
              </Button>
              <Button variant="outline" onClick={() => setCurrentView('details')} data-testid="button-cancel-start">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Complete Form */}
        {currentView === 'complete' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Complete Installation</h3>
            
            {/* Quality Checklist */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quality Checklist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries({
                  edgesSealing: 'Edges Sealing',
                  partsAssembling: 'Parts Assembling',
                  cleanUp: 'Clean Up',
                  badgesAndLogos: 'Badges and Logos Placed Again',
                  electronicsChecks: 'Electronics Checks',
                  sensorsCheck: 'Sensors Check'
                }).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={key}
                      checked={checklist[key as keyof typeof checklist]}
                      onChange={(e) => setChecklist(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="rounded border-gray-300"
                      data-testid={`checkbox-${key}`}
                    />
                    <Label htmlFor={key} className="text-sm">{label}</Label>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Material Consumption */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Material Consumption</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="material-product-name">Product Name</Label>
                    <Input
                      id="material-product-name"
                      placeholder="PPF Film Type A"
                      value={materialProductName}
                      onChange={(e) => setMaterialProductName(e.target.value)}
                      data-testid="input-material-product-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="material-batch-number">Batch Number</Label>
                    <Input
                      id="material-batch-number"
                      placeholder="BT2024001"
                      value={materialBatchNumber}
                      onChange={(e) => setMaterialBatchNumber(e.target.value)}
                      data-testid="input-material-batch-number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="material-quantity-used">Quantity Used</Label>
                    <Input
                      id="material-quantity-used"
                      placeholder="25 sq ft"
                      value={materialQuantityUsed}
                      onChange={(e) => setMaterialQuantityUsed(e.target.value)}
                      data-testid="input-material-quantity-used"
                    />
                  </div>
                </div>

                {/* Batch Number Image Upload - Required when batch number is provided */}
                <div className="mt-4">
                  <Label htmlFor="batch-number-image" className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Batch Number Image {materialBatchNumber.trim() && <span className="text-red-500">*</span>}
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Upload a photo of the batch number sticker/label {materialBatchNumber.trim() && '(Required when batch number is provided)'}
                  </p>
                  <div className="flex items-center gap-4">
                    <Input
                      id="batch-number-image"
                      type="file"
                      accept="image/*"
                      onChange={handleBatchNumberImageUpload}
                      disabled={batchNumberImageUploading}
                      className="max-w-xs"
                      data-testid="input-batch-number-image"
                    />
                    {batchNumberImageUploading && (
                      <span className="text-sm text-muted-foreground">Uploading...</span>
                    )}
                    {batchNumberImage && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-600">Image uploaded</span>
                        <img 
                          src={batchNumberImage} 
                          alt="Batch Number" 
                          className="h-12 w-12 object-cover rounded border cursor-pointer"
                          onClick={() => window.open(batchNumberImage, '_blank')}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Completion Remarks */}
            <div>
              <Label htmlFor="completion-remarks">Completion Remarks <span className="text-red-500">*</span></Label>
              <Textarea
                id="completion-remarks"
                placeholder="Installation completed successfully. Customer satisfied with the work."
                value={completionRemarks}
                onChange={(e) => setCompletionRemarks(e.target.value)}
                data-testid="textarea-completion-remarks"
              />
            </div>

            {/* Photo Upload - Post-Installation Photos with compression and one-by-one upload */}
            <PostInstallationPhotoUpload
              jobCardId={jobCardId!}
              onPhotosChange={setUploadedPostPhotos}
              existingPhotos={uploadedPostPhotos}
            />

            <div className="flex gap-3">
              <Button 
                onClick={() => completeJobMutation.mutate()} 
                disabled={completeJobMutation.isPending || !completionRemarks.trim()}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-confirm-complete"
              >
                {completeJobMutation.isPending ? 'Completing...' : 'Complete & Submit for Approval'}
              </Button>
              <Button variant="outline" onClick={() => setCurrentView('details')} data-testid="button-cancel-complete">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    
    {/* Image Modal */}
    {jobCard?.media && (
      <ImageModal
        images={jobCard.media.map((item: any, idx: number) => ({
          id: item.id || idx.toString(),
          url: item.url,
          caption: item.caption,
          alt: item.caption || `Job card image ${idx + 1}`
        }))}
        initialIndex={selectedImageIndex}
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
      />
    )}
    
    {/* Pre-Installation Modal */}
    {jobCardId && (
      <PreInstallationModal
        open={preInstallationModalOpen}
        onOpenChange={setPreInstallationModalOpen}
        jobCardId={jobCardId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
          queryClient.invalidateQueries({ queryKey: ['/api/job-cards', jobCardId] });
        }}
      />
    )}
    
    {/* View Pre-Installation Modal */}
    {jobCard && hasPreInstallationPhotos && (
      <ViewPreInstallationModal
        open={viewPreInstallationModalOpen}
        onOpenChange={setViewPreInstallationModalOpen}
        photoFrontUrl={jobCard.preInstallationPhotoFront!}
        photoBackUrl={jobCard.preInstallationPhotoBack!}
        photoLeftUrl={jobCard.preInstallationPhotoLeft!}
        photoRightUrl={jobCard.preInstallationPhotoRight!}
        remarks={jobCard.preInstallationRemarks}
        completedAt={jobCard.preInstallationCompletedAt ? new Date(jobCard.preInstallationCompletedAt) : null}
        completedBy={jobCard.preInstallationCompletedBy}
      />
    )}

    {jobCard && (
      <Dialog open={warrantyDialogOpen} onOpenChange={setWarrantyDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-600" />
              Register P91 E-Warranty
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 text-sm">
            <p className="text-muted-foreground">
              Review the details below that will be exchanged with P91 Elite, then click Exchange Data.
            </p>

            {/* Installer & Showroom */}
            <div className="rounded-lg border p-3 space-y-1.5">
              <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Installer &amp; Showroom</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div><span className="text-muted-foreground">Installer:</span> {jobCard?.assignedInstaller?.name || jobCard?.assignedInstaller?.displayName || '—'}</div>
                <div><span className="text-muted-foreground">Mobile:</span> {jobCard?.assignedInstaller?.phone || '—'}</div>
                <div><span className="text-muted-foreground">Showroom:</span> {jobCard?.workOrder?.showroom?.name || '—'}</div>
                <div><span className="text-muted-foreground">Email:</span> {jobCard?.workOrder?.showroom?.email || '—'}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Location:</span> {[jobCard?.workOrder?.showroom?.address, jobCard?.workOrder?.showroom?.city, jobCard?.workOrder?.showroom?.state].filter(Boolean).join(', ') || '—'}</div>
              </div>
            </div>

            {/* Customer */}
            <div className="rounded-lg border p-3 space-y-1.5">
              <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Customer</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div><span className="text-muted-foreground">Name:</span> {jobCard?.workOrder?.customerName || '—'}</div>
                <div><span className="text-muted-foreground">Mobile:</span> {jobCard?.workOrder?.customerPhone || 'HNI / not shared'}</div>
                <div><span className="text-muted-foreground">Email:</span> {jobCard?.workOrder?.customerEmail || 'HNI / not shared'}</div>
                <div><span className="text-muted-foreground">Address:</span> {jobCard?.workOrder?.customerAddress || 'HNI / not shared'}</div>
              </div>
            </div>

            {/* Vehicle & Product */}
            <div className="rounded-lg border p-3 space-y-1.5">
              <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Vehicle &amp; Product</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div><span className="text-muted-foreground">Make:</span> {jobCard?.workOrder?.vehicleModel?.brand?.name || '—'}</div>
                <div><span className="text-muted-foreground">Model:</span> {jobCard?.workOrder?.vehicleModel?.modelName || '—'}</div>
                <div><span className="text-muted-foreground">Product:</span> {jobCard?.workOrder?.service?.name || 'Full Car PPF'}</div>
                <div><span className="text-muted-foreground">Install date:</span> {jobCard?.completedAt ? format(new Date(jobCard.completedAt), 'dd MMM yyyy') : '—'}</div>
              </div>
            </div>

            {/* Batch & warranty — one row per roll. Add a roll if material was also
                used from another batch/stock beyond what the job card captured. */}
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Batch &amp; Warranty</p>
                <Button type="button" size="sm" variant="outline" onClick={addWarrantyRoll} data-testid="button-add-roll">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Roll
                </Button>
              </div>
              {warrantyRolls.map((roll, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                  <div className="space-y-1.5">
                    {index === 0 && <Label htmlFor={`warranty-batch-${index}`}>Batch number</Label>}
                    <Input
                      id={`warranty-batch-${index}`}
                      value={roll.lotNumber}
                      onChange={(e) => updateWarrantyRoll(index, 'lotNumber', e.target.value)}
                      placeholder="Batch number"
                      data-testid={`input-warranty-batch-${index}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    {index === 0 && <Label htmlFor={`warranty-qty-${index}`}>Quantity (sq.ft)</Label>}
                    <Input
                      id={`warranty-qty-${index}`}
                      type="number"
                      min="0"
                      value={roll.quantity}
                      onChange={(e) => updateWarrantyRoll(index, 'quantity', e.target.value)}
                      placeholder="e.g. 150"
                      data-testid={`input-warranty-quantity-${index}`}
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeWarrantyRoll(index)}
                    disabled={warrantyRolls.length === 1}
                    data-testid={`button-remove-roll-${index}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor="warranty-vin">VIN / Reg no.</Label>
                <Input
                  id="warranty-vin"
                  value={warrantyVin}
                  onChange={(e) => setWarrantyVin(e.target.value)}
                  placeholder="VIN / registration"
                  data-testid="input-warranty-vin"
                />
              </div>
              <p className="text-xs text-muted-foreground">VIN is saved back to the work order if it was missing.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setWarrantyDialogOpen(false)}
              disabled={applyWarrantyMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={submitP91Warranty}
              disabled={applyWarrantyMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="button-exchange-data"
            >
              {applyWarrantyMutation.isPending ? 'Exchanging…' : 'Exchange Data'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}