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
import { CalendarIcon, ClockIcon, CheckCircle2, PlayCircle, PauseCircle, UploadIcon, UserIcon, PhoneIcon, MailIcon, MapPinIcon, CarIcon, WrenchIcon, CalendarDaysIcon, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

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
  workOrder: {
    id: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    customerAddress: string;
    regNo: string;
    quantity: number;
    notes?: string;
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
  const [currentView, setCurrentView] = useState<'details' | 'acknowledge' | 'schedule' | 'start' | 'complete'>('details');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [materialConsumption, setMaterialConsumption] = useState('');
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string>('');
  const [batchNumbers, setBatchNumbers] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [jsonValidationError, setJsonValidationError] = useState<string | null>(null);

  // JSON validation helper
  const validateJSON = (jsonString: string): { isValid: boolean; error?: string } => {
    if (!jsonString.trim()) {
      return { isValid: true }; // Empty is valid (optional field)
    }
    
    try {
      JSON.parse(jsonString);
      return { isValid: true };
    } catch (error) {
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Invalid JSON format'
      };
    }
  };

  // Handle material consumption change with validation
  const handleMaterialConsumptionChange = (value: string) => {
    setMaterialConsumption(value);
    const validation = validateJSON(value);
    setJsonValidationError(validation.isValid ? null : validation.error || 'Invalid JSON');
  };

  // Quality checklist items
  const [checklist, setChecklist] = useState({
    surfacePreparation: false,
    alignmentCheck: false,
    bubbleInspection: false,
    edgeSealing: false,
    finalCleaning: false,
    customerWalkthrough: false
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
      // Validate JSON if material consumption is provided
      let parsedMaterialConsumption = null;
      if (materialConsumption.trim()) {
        try {
          parsedMaterialConsumption = JSON.parse(materialConsumption);
        } catch (error) {
          throw new Error('Invalid JSON format in material consumption field. Please check the syntax.');
        }
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
        materialConsumptionJson: parsedMaterialConsumption,
        batchNumbers
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      toast({ title: 'Job Completed', description: 'Job card has been completed and submitted for approval.' });
      setCurrentView('details');
    },
    onError: (error: Error) => {
      const errorMessage = error.message || 'Failed to complete job card.';
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
      'APPROVED': 'bg-emerald-100 text-emerald-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const canAcknowledge = jobCard?.status === 'AWAITING_ACK';
  const canSchedule = jobCard?.status === 'ACKNOWLEDGED';
  const canStart = jobCard?.status === 'SCHEDULED';
  const canComplete = jobCard?.status === 'IN_PROGRESS';

  const resetForm = () => {
    setCurrentView('details');
    setScheduleDate('');
    setScheduleTime('');
    setCompletionRemarks('');
    setMaterialConsumption('');
    setBatchNumbers('');
    setSelectedFiles([]);
    setJsonValidationError(null);
    setSelectedTeamMemberId(jobCard?.assignedInstallerId || '');
    setChecklist({
      surfacePreparation: false,
      alignmentCheck: false,
      bubbleInspection: false,
      edgeSealing: false,
      finalCleaning: false,
      customerWalkthrough: false
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
              {canStart && (
                <Button onClick={() => setCurrentView('start')} className="bg-orange-600 hover:bg-orange-700" data-testid="button-start">
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Start Work
                </Button>
              )}
              {canComplete && (
                <Button onClick={() => setCurrentView('complete')} className="bg-green-600 hover:bg-green-700" data-testid="button-complete">
                  <PauseCircle className="h-4 w-4 mr-2" />
                  Complete Job
                </Button>
              )}
            </div>

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
                    <p className="text-sm font-semibold" data-testid="text-customer-name">{jobCard.workOrder.customerName}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Phone</Label>
                      <p className="text-sm flex items-center gap-1" data-testid="text-customer-phone">
                        <PhoneIcon className="h-3 w-3" />
                        {jobCard.workOrder.customerPhone}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Email</Label>
                      <p className="text-sm flex items-center gap-1" data-testid="text-customer-email">
                        <MailIcon className="h-3 w-3" />
                        {jobCard.workOrder.customerEmail}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Address</Label>
                    <p className="text-sm flex items-center gap-1" data-testid="text-customer-address">
                      <MapPinIcon className="h-3 w-3" />
                      {jobCard.workOrder.customerAddress}
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
                      {jobCard.workOrder.vehicleModel.brand.name} {jobCard.workOrder.vehicleModel.modelName}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Registration No</Label>
                      <p className="text-sm" data-testid="text-reg-no">{jobCard.workOrder.regNo}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Quantity</Label>
                      <p className="text-sm" data-testid="text-quantity">{jobCard.workOrder.quantity}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Service</Label>
                    <p className="text-sm font-semibold" data-testid="text-service">{jobCard.workOrder.service.name}</p>
                    <p className="text-xs text-gray-500">{jobCard.workOrder.service.description}</p>
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

            {/* Additional Information */}
            {(jobCard.workOrder.notes || jobCard.partnerRemarks) && (
              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {jobCard.workOrder.notes && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Work Order Notes</Label>
                      <p className="text-sm" data-testid="text-work-order-notes">{jobCard.workOrder.notes}</p>
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
                  surfacePreparation: 'Surface Preparation',
                  alignmentCheck: 'Alignment Check',
                  bubbleInspection: 'Bubble Inspection',
                  edgeSealing: 'Edge Sealing',
                  finalCleaning: 'Final Cleaning',
                  customerWalkthrough: 'Customer Walkthrough'
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="material-consumption">Material Consumption (JSON)</Label>
                  {materialConsumption.trim() && (
                    jsonValidationError ? (
                      <span className="text-red-500 text-xs">✗ Invalid JSON</span>
                    ) : (
                      <span className="text-green-500 text-xs">✓ Valid JSON</span>
                    )
                  )}
                </div>
                <Textarea
                  id="material-consumption"
                  placeholder='{"film_sqft": 25, "primer_ml": 50}'
                  value={materialConsumption}
                  onChange={(e) => handleMaterialConsumptionChange(e.target.value)}
                  className={jsonValidationError ? 'border-red-300' : ''}
                  data-testid="textarea-material-consumption"
                />
                {jsonValidationError && (
                  <p className="text-red-500 text-xs mt-1">{jsonValidationError}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  Optional: Enter material usage in JSON format (e.g., film area, primer volume)
                </p>
              </div>
              <div>
                <Label htmlFor="batch-numbers">Batch Numbers</Label>
                <Input
                  id="batch-numbers"
                  placeholder="BT2024001, BT2024002"
                  value={batchNumbers}
                  onChange={(e) => setBatchNumbers(e.target.value)}
                  data-testid="input-batch-numbers"
                />
              </div>
            </div>

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

            {/* Photo Upload */}
            <div>
              <Label>Post-Installation Photos</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
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
                <Label htmlFor="photo-upload" className="cursor-pointer text-blue-600 hover:text-blue-700">
                  Click to upload photos
                </Label>
                <p className="text-xs text-gray-500 mt-1">Upload multiple photos showing completed installation</p>
                {selectedFiles.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-green-600">{selectedFiles.length} file(s) selected</p>
                    <div className="space-y-1">
                      {selectedFiles.map((file, index) => (
                        <p key={index} className="text-xs text-gray-600">{file.name}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                onClick={() => completeJobMutation.mutate()} 
                disabled={completeJobMutation.isPending || !completionRemarks.trim() || !!jsonValidationError}
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
  );
}