import { useState, useEffect } from "react";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const royaltyRuleSchema = z.object({
  oemId: z.string().min(1, "OEM is required"),
  royaltyPercentage: z.string()
    .min(1, "Royalty percentage is required")
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0 && num <= 100;
    }, "Royalty percentage must be between 0 and 100"),
  effectiveFrom: z.string().min(1, "Effective date is required"),
  effectiveTo: z.string().optional(),
  isActive: z.boolean().default(true),
});

type RoyaltyRuleFormData = z.infer<typeof royaltyRuleSchema>;

interface CreateRoyaltyRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingRule?: any;
  preselectedOemId?: string | null;
}

export function CreateRoyaltyRuleModal({
  open,
  onOpenChange,
  onSuccess,
  editingRule,
  preselectedOemId,
}: CreateRoyaltyRuleModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!editingRule;

  const form = useForm<RoyaltyRuleFormData>({
    resolver: zodResolver(royaltyRuleSchema),
    defaultValues: {
      oemId: editingRule?.oemId || preselectedOemId || "",
      royaltyPercentage: editingRule?.royaltyPercentage || "",
      effectiveFrom: editingRule?.effectiveFrom 
        ? new Date(editingRule.effectiveFrom).toISOString().split('T')[0] 
        : new Date().toISOString().split('T')[0],
      effectiveTo: editingRule?.effectiveTo 
        ? new Date(editingRule.effectiveTo).toISOString().split('T')[0] 
        : "",
      isActive: editingRule?.isActive ?? true,
    },
  });

  // Fetch OEMs for the dropdown
  const { data: oems = [], isLoading: oemsLoading } = useQuery({
    queryKey: ["/api/oems"],
    queryFn: async () => {
      const response = await fetch('/api/oems');
      if (!response.ok) {
        throw new Error('Failed to fetch OEMs');
      }
      return response.json();
    }
  });

  // Reset form when editing rule changes
  useEffect(() => {
    if (editingRule && open) {
      form.reset({
        oemId: editingRule.oemId || "",
        royaltyPercentage: editingRule.royaltyPercentage || "",
        effectiveFrom: editingRule.effectiveFrom 
          ? new Date(editingRule.effectiveFrom).toISOString().split('T')[0] 
          : new Date().toISOString().split('T')[0],
        effectiveTo: editingRule.effectiveTo 
          ? new Date(editingRule.effectiveTo).toISOString().split('T')[0] 
          : "",
        isActive: editingRule.isActive ?? true,
      });
    } else if (!isEditing && open) {
      form.reset({
        oemId: preselectedOemId || "",
        royaltyPercentage: "",
        effectiveFrom: new Date().toISOString().split('T')[0],
        effectiveTo: "",
        isActive: true,
      });
    }
  }, [editingRule, open, isEditing, preselectedOemId, form]);

  const onSubmit = async (data: RoyaltyRuleFormData) => {
    setIsLoading(true);

    try {
      const submitData = {
        ...data,
        royaltyPercentage: parseFloat(data.royaltyPercentage).toString(),
        effectiveFrom: new Date(data.effectiveFrom).toISOString(),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo).toISOString() : null,
      };

      if (isEditing) {
        await apiRequest("PUT", `/api/oem-royalty-rules/${editingRule.id}`, submitData);
      } else {
        await apiRequest("POST", "/api/oem-royalty-rules", submitData);
      }

      // Invalidate relevant queries
      await queryClient.invalidateQueries({ queryKey: ["/api/oem-royalty-rules"] });
      
      toast({
        title: "Success!",
        description: `Royalty rule ${isEditing ? 'updated' : 'created'} successfully.`,
      });

      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Royalty rule error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${isEditing ? 'update' : 'create'} royalty rule`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="modal-create-royalty-rule">
        <DialogHeader>
          <DialogTitle data-testid="title-royalty-rule-modal">
            {isEditing ? 'Edit' : 'Create'} OEM Royalty Rule
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {/* OEM Selection */}
              <FormField
                control={form.control}
                name="oemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OEM *</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={isEditing} // Don't allow changing OEM when editing
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-oem">
                          <SelectValue placeholder="Select an OEM" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {oemsLoading ? (
                          <SelectItem value="loading" disabled>Loading OEMs...</SelectItem>
                        ) : (
                          oems.map((oem: any) => (
                            <SelectItem key={oem.id} value={oem.id}>
                              {oem.name} ({oem.brandCode})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Royalty Percentage */}
              <FormField
                control={form.control}
                name="royaltyPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Royalty Percentage (%) *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="e.g., 5.50"
                        data-testid="input-royalty-percentage"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Effective From */}
              <FormField
                control={form.control}
                name="effectiveFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective From *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        data-testid="input-effective-from"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Effective To (Optional) */}
              <FormField
                control={form.control}
                name="effectiveTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective To (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        data-testid="input-effective-to"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Active Status */}
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <div className="text-sm text-gray-500">
                        Enable or disable this royalty rule
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-royalty-rule"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-save-royalty-rule"
              >
                {isLoading ? "Saving..." : `${isEditing ? 'Update' : 'Create'} Royalty Rule`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}