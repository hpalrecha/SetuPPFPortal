import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ApiClient } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

const pricingRuleSchema = z.object({
  partnerId: z.string().min(1, "Partner is required"),
  scope: z.enum(["PARTNER", "SHOWROOM", "DEALERSHIP"], {
    required_error: "Scope is required",
  }),
  vehicleModelId: z.string().optional(),
  serviceId: z.string().min(1, "Service is required"),
  priceAmount: z.string().min(1, "Price amount is required"),
  effectiveFrom: z.string().min(1, "Effective date is required"),
});

type PricingRuleFormData = z.infer<typeof pricingRuleSchema>;

interface CreatePricingRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingRule?: any;
}

export function CreatePricingRuleModal({
  open,
  onOpenChange,
  onSuccess,
  editingRule,
}: CreatePricingRuleModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!editingRule;

  const form = useForm<PricingRuleFormData>({
    resolver: zodResolver(pricingRuleSchema),
    defaultValues: {
      partnerId: editingRule?.partnerId || "",
      scope: editingRule?.scope || "PARTNER",
      vehicleModelId: editingRule?.vehicleModelId || "",
      serviceId: editingRule?.serviceId || "",
      priceAmount: editingRule?.priceAmount || "",
      effectiveFrom: editingRule?.effectiveFrom ? new Date(editingRule.effectiveFrom).toISOString().split('T')[0] : "",
    },
  });

  // Fetch partners
  const { data: partners = [] } = useQuery({
    queryKey: ["/api/partners"],
    queryFn: async () => {
      const response = await fetch('/api/partners', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch partners');
      return response.json();
    },
    enabled: open,
  });

  // Mock services data - in a real app this would come from API
  const services = [
    { id: "full-body", name: "Full Body PPF" },
    { id: "front-end", name: "Front End PPF" },
    { id: "headlights", name: "Headlight PPF" },
    { id: "door-handles", name: "Door Handle PPF" },
  ];

  // Mock vehicle models - in a real app this would come from API
  const vehicleModels = [
    { id: "swift", name: "Swift" },
    { id: "baleno", name: "Baleno" },
    { id: "i20", name: "i20" },
    { id: "creta", name: "Creta" },
  ];

  const onSubmit = async (data: PricingRuleFormData) => {
    setIsLoading(true);
    try {
      const endpoint = isEditing ? `/api/pricing-rules/${editingRule.id}` : "/api/pricing-rules";
      const method = isEditing ? "PUT" : "POST";
      
      await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          priceAmount: parseFloat(data.priceAmount),
          effectiveFrom: new Date(data.effectiveFrom).toISOString(),
        }),
      });

      toast({
        title: "Success",
        description: `Pricing rule ${isEditing ? 'updated' : 'created'} successfully`,
      });

      form.reset();
      onSuccess();
    } catch (error) {
      console.error("Error saving pricing rule:", error);
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? 'update' : 'create'} pricing rule`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Create'} Pricing Rule</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="partnerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Partner</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select partner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {partners?.map((partner: any) => (
                          <SelectItem key={partner.id} value={partner.id}>
                            {partner.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scope"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scope</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select scope" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PARTNER">Partner Level</SelectItem>
                        <SelectItem value="SHOWROOM">Showroom Level</SelectItem>
                        <SelectItem value="DEALERSHIP">Dealership Level</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vehicleModelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Model (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vehicle model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">All Models</SelectItem>
                        {vehicleModels?.map((model: any) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serviceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {services?.map((service: any) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priceAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price Amount (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter price amount"
                        {...field}
                        data-testid="input-price-amount"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="effectiveFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective From</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-effective-from"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-save-pricing-rule"
              >
                {isLoading ? "Saving..." : `${isEditing ? 'Update' : 'Create'} Pricing Rule`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}