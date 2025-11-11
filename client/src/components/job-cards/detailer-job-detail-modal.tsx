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
import { CalendarIcon, ClockIcon, CheckCircle2, PlayCircle, PauseCircle, UploadIcon, UserIcon, PhoneIcon, MailIcon, MapPinIcon, CarIcon, WrenchIcon, CalendarDaysIcon, Users, Camera, Eye, Shield } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ImageModal } from '@/components/ui/image-modal';
import { format } from 'date-fns';
import { PreInstallationModal } from '@/components/modals/PreInstallationModal';
import { ViewPreInstallationModal } from '@/components/modals/ViewPreInstallationModal';

interface JobCard {
  id: string;
  status: string;
  partnerId: string;
  acknowledgedAt?: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  partnerRemarks?: string;
  materialConsumptionJson?: any;
  batchNumbers?: string;
  checklistJson?: any;
  assignedInstallerId?: string;
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
  const queryClient = useQueryClient();
  
  // State for different forms
  const [currentView, setCurrentView] = useState<'details' | 'acknowledge' | 'schedule' | 'start' | 'complete' | 'mark-fixed'>('details');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
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

  const acknowledgeJobMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/acknowledge`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      toast({ title: 'Job Acknowledged', description: 'Job card has been acknowledged successfully.' });
      setCurrentView('details');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to acknowledge job card.', variant: 'destructive' });
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
      // Create material consumption object from form fields
      let materialConsumptionData = null;
      if (materialProductName.trim() || materialBatchNumber.trim() || materialQuantityUsed.trim()) {
        materialConsumptionData = {
          productName: materialProductName.trim() || null,
          batchNumber: materialBatchNumber.trim() || null,
          quantityUsed: materialQuantityUsed.trim() || null
        };
      }

      // Upload files first if any
      const mediaUrls = [];
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('jobCardId', jobCardId!);
            formData.append('type', 'IMAGE');
            
            const uploadResponse = await apiRequest('POST', '/api/job-cards/upload-media', formData);
            const uploadResult = await uploadResponse.json();
            mediaUrls.push(uploadResult.url);
          } catch (error) {
            throw new Error(`Failed to upload file ${file.name}. Please try again.`);
          }
        }
      }

      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/complete`, {
        remarks: completionRemarks,
        checklistJson: checklist,
        materialConsumptionJson: materialConsumptionData,
        batchNumbers: materialBatchNumber.trim() || null
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

  // E-Warranty Application Mutation
  const applyWarrantyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/apply-warranty`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards', jobCardId] });
      toast({ 
        title: 'E-Warranty Applied', 
        description: 'E-Warranty application has been submitted successfully. Notification emails have been sent.' 
      });
    },
    onError: (error: Error) => {
      const errorMessage = error.message || 'Failed to apply e-warranty.';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  });

  const getStatusColor = (status: string) => {
    const colors = {
      'AWAITING_ACK': 'bg-yellow-100 text-yellow-800',
      'ACKNOWLEDGED': 'bg-blue-100 text-blue-800',
      'SCHEDULED': 'bg-purple-100 text-purple-800',
      'IN_PROGRESS': 'bg-orange-100 text-orange-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'PENDING_APPROVAL': 'bg-indigo-100 text-indigo-800',
      'APPROVED': 'bg-emerald-100 text-emerald-800',
      'REWORK_REQUESTED': 'bg-yellow-100 text-yellow-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const canAcknowledge = jobCard?.status === 'AWAITING_ACK';
  const canSchedule = jobCard?.status === 'ACKNOWLEDGED';
  const canStart = jobCard?.status === 'SCHEDULED';
  const canComplete = jobCard?.status === 'IN_PROGRESS';
  const needsRework = jobCard?.status === 'REWORK_REQUESTED';
  const hasPreInstallationPhotos = !!(jobCard?.preInstallationPhotoFront && jobCard?.preInstallationPhotoBack && jobCard?.preInstallationPhotoLeft && jobCard?.preInstallationPhotoRight);
  const needsPreInstallation = canStart && !hasPreInstallationPhotos;
  // E-Warranty button: show when partner bills directly, job is approved/completed, and not already applied
  const canApplyWarranty = jobCard?.partnerBilledDirectly && 
                          ['PENDING_SALES_INVOICE', 'APPROVED'].includes(jobCard?.status || '') && 
                          !jobCard?.eWarrantyApplied;

  const resetForm = () => {
    setCurrentView('details');
    setScheduleDate('');
    setScheduleTime('');
    setCompletionRemarks('');
    setSelectedFiles([]);
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
              {needsPreInstallation && (
                <Button onClick={() => setPreInstallationModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700" data-testid="button-pre-installation">
                  <Camera className="h-4 w-4 mr-2" />
                  Pre-Installation Photos
                </Button>
              )}
              {canStart && hasPreInstallationPhotos && (
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
              {needsRework && (
                <Button onClick={() => markFixedMutation.mutate()} disabled={markFixedMutation.isPending} className="bg-green-600 hover:bg-green-700" data-testid="button-mark-fixed">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {markFixedMutation.isPending ? 'Marking as Fixed...' : 'Mark as Fixed'}
                </Button>
              )}
              {canApplyWarranty && (
                <Button 
                  onClick={() => applyWarrantyMutation.mutate()} 
                  disabled={applyWarrantyMutation.isPending} 
                  className="bg-amber-600 hover:bg-amber-700" 
                  data-testid="button-apply-warranty"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  {applyWarrantyMutation.isPending ? 'Applying...' : 'Apply for E-Warranty'}
                </Button>
              )}
            </div>

            {/* Pre-Installation Required Notice */}
            {needsPreInstallation && (
              <Card className="border-2 border-indigo-200 bg-indigo-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-indigo-800 flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Pre-Installation Photos Required
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-indigo-700">
                    Before starting the installation work, you must upload 4 photos of the vehicle (Front, Back, Left Side, Right Side) to document its pre-installation condition.
                    Click the "Pre-Installation Photos" button above to upload the required photos.
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
                      ⚠️ Please address the issues mentioned above and click "Mark as Fixed" when completed.
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
                      Currently assigned to: {teamMembers.find((m: any) => m.id === jobCard?.assignedInstallerId)?.name || 'Unknown'}
                    </div>
                  )}
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
                        {jobCard?.workOrder?.customerPhone || "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Email</Label>
                      <p className="text-sm flex items-center gap-1" data-testid="text-customer-email">
                        <MailIcon className="h-3 w-3" />
                        {jobCard?.workOrder?.customerEmail || "N/A"}
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
          </div>
        )}

        {/* Acknowledge Form */}
        {currentView === 'acknowledge' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Acknowledge Job Assignment</h3>
            <p className="text-sm text-gray-600">
              By acknowledging this job, you confirm that you have received the assignment and will proceed with the installation.
            </p>
            <div className="flex gap-3">
              <Button 
                onClick={() => acknowledgeJobMutation.mutate()} 
                disabled={acknowledgeJobMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-confirm-acknowledge"
              >
                {acknowledgeJobMutation.isPending ? 'Acknowledging...' : 'Confirm Acknowledgment'}
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
              </CardContent>
            </Card>

            {/* Completion Remarks */}
            <div>
              <Label htmlFor="completion-remarks">Completion Remarks</Label>
              <Textarea
                id="completion-remarks"
                placeholder="Installation completed successfully. Customer satisfied with the work."
                value={completionRemarks}
                onChange={(e) => setCompletionRemarks(e.target.value)}
                data-testid="textarea-completion-remarks"
              />
            </div>

            {/* Photo Upload - 4-Side Car Images */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">4-Side Car Images</CardTitle>
                <p className="text-sm text-gray-600">Upload photos showing all four sides of the vehicle after installation</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                    <UploadIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                      className="hidden"
                      id="photo-upload"
                      data-testid="input-photo-upload"
                    />
                    <Label htmlFor="photo-upload" className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium">
                      Click to upload vehicle photos
                    </Label>
                    <p className="text-xs text-gray-500 mt-1">
                      Upload 4 photos: Front, Rear, Left Side, Right Side (JPG, PNG up to 10MB each)
                    </p>
                  </div>
                  
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <p className="text-sm font-medium text-green-700">{selectedFiles.length} file(s) selected</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                            <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                            <span className="text-xs text-gray-700 truncate">{file.name}</span>
                            <span className="text-xs text-gray-500 ml-auto">
                              {(file.size / 1024 / 1024).toFixed(1)}MB
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                        ✓ Images will be uploaded when you complete the job
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

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
    </>
  );
}