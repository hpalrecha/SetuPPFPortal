import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, CheckCircle, XCircle, Camera, UserIcon, PhoneIcon, MailIcon, MapPinIcon, CarIcon, CalendarDaysIcon, WrenchIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ImageModal } from "@/components/ui/image-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

interface ApprovalModalProps {
  jobCardId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ApprovalModal({ jobCardId, isOpen, onClose }: ApprovalModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Fetch job card data with full details
  const { data: jobCard, isLoading } = useQuery({
    queryKey: ['/api/job-cards', jobCardId],
    queryFn: async () => {
      if (!jobCardId) return null;
      const response = await apiRequest('GET', `/api/job-cards/${jobCardId}`);
      return response.json();
    },
    enabled: !!jobCardId && isOpen
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/job-cards/${jobCardId}/approve`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === "/api/job-cards" 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/payouts"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"], exact: false });
      toast({
        title: "Job Card Approved",
        description: "The job card has been approved successfully."
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Approval Failed",
        description: "Failed to approve job card. Please try again.",
        variant: "destructive"
      });
    }
  });

  const requestReworkMutation = useMutation({
    mutationFn: async ({ jobCardId, reason }: { jobCardId: string; reason: string }) => {
      const response = await apiRequest("POST", `/api/job-cards/${jobCardId}/request-rework`, {
        reason
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === "/api/job-cards" 
      });
      toast({
        title: "Rework Requested",
        description: "Rework has been requested for this job card."
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Rework Request Failed",
        description: "Failed to request rework. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleClose = () => {
    onClose();
  };

  if (!isOpen || !jobCardId) return null;

  // Helper function to format currency
  const formatCurrency = (amount: number | string | null | undefined) => {
    if (!amount) return "₹0";
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `₹${numAmount.toLocaleString('en-IN')}`;
  };

  // Helper function to calculate duration
  const calculateDuration = (startDate: string | null, endDate: string | null) => {
    if (!startDate || !endDate) return "N/A";
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffInHours = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (diffInHours < 24) {
      return `${Math.round(diffInHours)} hours`;
    }
    return `${Math.round(diffInHours / 24)} days`;
  };

  const proofImages = jobCard?.media || [];

  // Parse quality checklist
  const checklist = jobCard?.checklistJson || {};

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4" data-testid="approval-modal">
      <div className="bg-card rounded-lg border shadow-lg modal-responsive w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-foreground truncate">Job Card Approval</h3>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              JC-{jobCardId.slice(0, 8)} - {jobCard?.workOrder?.service?.name || "Installation"}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose} data-testid="button-close" className="flex-shrink-0 ml-2">
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[75vh] sm:max-h-[70vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading job details...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Work Details Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <WrenchIcon className="h-5 w-5 text-orange-600" />
                    Work Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Partner</Label>
                      <p className="text-sm font-semibold" data-testid="text-partner-name">
                        {jobCard?.partner?.displayName || "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Service</Label>
                      <p className="text-sm font-semibold" data-testid="text-service-name">
                        {jobCard?.workOrder?.service?.name || "N/A"}
                      </p>
                      {jobCard?.workOrder?.service?.description && (
                        <p className="text-xs text-gray-500">{jobCard.workOrder.service.description}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Started</Label>
                      <p className="text-sm" data-testid="text-started-at">
                        {jobCard?.startedAt ? format(new Date(jobCard.startedAt), 'PPp') : "Not started"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Completed</Label>
                      <p className="text-sm" data-testid="text-completed-at">
                        {jobCard?.completedAt ? format(new Date(jobCard.completedAt), 'PPp') : "Not completed"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Duration</Label>
                      <p className="text-sm" data-testid="text-duration">
                        {calculateDuration(jobCard?.startedAt, jobCard?.completedAt)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Billing Value</Label>
                      <p className="text-sm font-semibold text-green-600" data-testid="text-billing-value">
                        {formatCurrency(jobCard?.billingValue)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

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
                      <p className="text-sm font-semibold" data-testid="text-customer-name">
                        {jobCard?.workOrder?.customerName || "N/A"}
                      </p>
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
                        <p className="text-sm" data-testid="text-reg-no">
                          {jobCard?.workOrder?.regNo || "N/A"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Quantity</Label>
                        <p className="text-sm" data-testid="text-quantity">
                          {jobCard?.workOrder?.quantity || "N/A"}
                        </p>
                      </div>
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
                      <p className="text-sm font-semibold" data-testid="text-showroom-name">
                        {jobCard?.workOrder?.showroom?.name || "N/A"}
                      </p>
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
                  </CardContent>
                </Card>

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
                      {jobCard?.acknowledgedAt && (
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          <span className="text-sm">Acknowledged on {format(new Date(jobCard.acknowledgedAt), 'PPp')}</span>
                        </div>
                      )}
                      {jobCard?.scheduledAt && (
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                          <span className="text-sm">Scheduled for {format(new Date(jobCard.scheduledAt), 'PPp')}</span>
                        </div>
                      )}
                      {jobCard?.startedAt && (
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                          <span className="text-sm">Started on {format(new Date(jobCard.startedAt), 'PPp')}</span>
                        </div>
                      )}
                      {jobCard?.completedAt && (
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                          <span className="text-sm">Completed on {format(new Date(jobCard.completedAt), 'PPp')}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Partner Remarks */}
              {jobCard?.partnerRemarks && (
                <Card>
                  <CardHeader>
                    <CardTitle>Partner Remarks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm" data-testid="text-partner-remarks">{jobCard.partnerRemarks}</p>
                  </CardContent>
                </Card>
              )}

              {/* Quality Checklist */}
              {Object.keys(checklist).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Quality Checklist</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {checklist.edgesSealing && (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-foreground">Edges properly sealed</span>
                        </div>
                      )}
                      {checklist.partsAssembling && (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-foreground">Parts assembling completed</span>
                        </div>
                      )}
                      {checklist.cleanUp && (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-foreground">Clean up completed</span>
                        </div>
                      )}
                      {checklist.badgesAndLogos && (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-foreground">Badges and logos checked</span>
                        </div>
                      )}
                      {checklist.electronicsChecks && (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-foreground">Electronics checks completed</span>
                        </div>
                      )}
                      {checklist.sensorsCheck && (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-foreground">Sensors check completed</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Proof Images */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="h-5 w-5 text-green-600" />
                    Proof Images
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {proofImages.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {proofImages.map((mediaItem: any, index: number) => (
                        <div key={mediaItem.id || index} className="space-y-1">
                          <img 
                            src={mediaItem.url} 
                            alt={mediaItem.caption || `Proof image ${index + 1}`} 
                            className="rounded-lg border aspect-square object-cover w-full cursor-pointer hover:opacity-80 transition-opacity"
                            data-testid={`proof-image-${index}`}
                            onClick={() => {
                              setSelectedImageIndex(index);
                              setImageModalOpen(true);
                            }}
                          />
                          {mediaItem.caption && (
                            <p className="text-xs text-muted-foreground text-center" data-testid={`proof-caption-${index}`}>
                              {mediaItem.caption}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center text-muted-foreground" data-testid="no-images-message">
                      <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No proof images uploaded yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Admin Approval Section - Same as Admin Portal */}
              <Card className="border-2 border-dashed border-blue-200 bg-blue-50/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-base text-blue-900">Admin Approval Required</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={() => approveMutation.mutate()}
                      disabled={approveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      data-testid="button-approve"
                    >
                      {approveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Approve Job Card
                    </Button>
                    <Button
                      onClick={() => {
                        const reason = prompt('Please provide a reason for requesting rework:');
                        if (reason && jobCardId) {
                          requestReworkMutation.mutate({ jobCardId, reason });
                        }
                      }}
                      disabled={requestReworkMutation.isPending}
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                      data-testid="button-reject"
                    >
                      {requestReworkMutation.isPending ? (
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
            </div>
          )}
        </div>
      </div>
    </div>
    
    {/* Image Modal */}
    <ImageModal
      images={proofImages.map((item: any, idx: number) => ({
        id: item.id || idx.toString(),
        url: item.url,
        caption: item.caption,
        alt: item.caption || `Proof image ${idx + 1}`
      }))}
      initialIndex={selectedImageIndex}
      isOpen={imageModalOpen}
      onClose={() => setImageModalOpen(false)}
    />
    </>
  );
}
