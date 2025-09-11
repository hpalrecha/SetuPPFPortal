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
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

const allocationSchema = z.object({
  level: z.enum(['DEALERSHIP', 'SHOWROOM'], { required_error: "Level is required" }),
  levelId: z.string().min(1, "Please select a dealership or showroom"),
  partnerId: z.string().min(1, "Please select a partner"),
  priority: z.number().min(1).max(10).default(1),
  active: z.boolean().default(true),
  serviceCategoryIds: z.array(z.string()).optional(),
});

type AllocationFormData = z.infer<typeof allocationSchema>;

interface CreateAllocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  allocation?: any;
}

export function CreateAllocationModal({
  open,
  onOpenChange,
  onSuccess,
  allocation,
}: CreateAllocationModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!allocation;

  const form = useForm<AllocationFormData>({
    resolver: zodResolver(allocationSchema),
    defaultValues: {
      level: "DEALERSHIP",
      levelId: "",
      partnerId: "",
      priority: 1,
      active: true,
      serviceCategoryIds: [],
    },
  });

  const selectedLevel = form.watch("level");

  // Fetch service categories
  const { data: serviceCategories = [] } = useQuery({
    queryKey: ["/api/service-categories"],
    queryFn: async () => {
      const response = await fetch('/api/service-categories', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch service categories');
      return response.json();
    },
    enabled: open,
  });

  // Fetch existing allocation service categories when editing
  const { data: existingCategories = [] } = useQuery({
    queryKey: ["/api/allocations", allocation?.id, "service-categories"],
    queryFn: async () => {
      const response = await fetch(`/api/allocations/${allocation.id}/service-categories`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch allocation service categories');
      return response.json();
    },
    enabled: open && isEditing && !!allocation?.id,
  });

  // Reset form when allocation prop changes (for editing)
  useEffect(() => {
    if (allocation && open) {
      const serviceCategoryIds = existingCategories.map((cat: any) => cat.id) || [];
      form.reset({
        level: allocation.level || "DEALERSHIP",
        levelId: allocation.levelId || "",
        partnerId: allocation.partnerId || "",
        priority: allocation.priority || 1,
        active: allocation.active ?? true,
        serviceCategoryIds,
      });
    } else if (!allocation && open) {
      form.reset({
        level: "DEALERSHIP",
        levelId: "",
        partnerId: "",
        priority: 1,
        active: true,
        serviceCategoryIds: [],
      });
    }
  }, [allocation, open, form, existingCategories]);

  // Fetch dealerships
  const { data: dealerships = [] } = useQuery({
    queryKey: ["/api/dealerships"],
    queryFn: async () => {
      const response = await fetch('/api/dealerships', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dealerships');
      return response.json();
    },
    enabled: open,
  });

  // Fetch showrooms
  const { data: showrooms = [] } = useQuery({
    queryKey: ["/api/showrooms"],
    queryFn: async () => {
      const response = await fetch('/api/showrooms', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch showrooms');
      return response.json();
    },
    enabled: open,
  });

  // Fetch partners
  const { data: partners = [] } = useQuery({
    queryKey: ["/api/partners", { type: "INSTALLER" }],
    queryFn: async () => {
      const response = await fetch('/api/partners?type=INSTALLER', {
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

  const onSubmit = async (data: AllocationFormData) => {
    setIsLoading(true);
    try {
      const endpoint = isEditing ? `/api/allocations/${allocation.id}` : "/api/allocations";
      const method = isEditing ? "PUT" : "POST";
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} allocation`);
      }

      toast({
        title: "Success",
        description: `Allocation ${isEditing ? 'updated' : 'created'} successfully`,
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  const getLevelOptions = () => {
    if (selectedLevel === "DEALERSHIP") {
      return dealerships.map((dealership) => ({
        value: dealership.id,
        label: dealership.name,
      }));
    } else {
      return showrooms.map((showroom) => ({
        value: showroom.id,
        label: showroom.name,
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="modal-create-allocation">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Create'} Partner Allocation</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue("levelId", ""); // Reset levelId when level changes
                      }} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-level">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DEALERSHIP">Dealership</SelectItem>
                        <SelectItem value="SHOWROOM">Showroom</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="levelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {selectedLevel === "DEALERSHIP" ? "Dealership" : "Showroom"}
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-level-id">
                          <SelectValue placeholder={`Select ${selectedLevel.toLowerCase()}`} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getLevelOptions().map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="partnerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Partner</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-partner">
                        <SelectValue placeholder="Select partner" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {partners.map((partner) => (
                        <SelectItem key={partner.id} value={partner.id}>
                          {partner.displayName} ({partner.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Service Categories */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Service Categories</h3>
              <p className="text-sm text-muted-foreground">
                Select the service categories this allocation covers
              </p>
              
              <FormField
                control={form.control}
                name="serviceCategoryIds"
                render={({ field }) => (
                  <FormItem>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {serviceCategories.map((category: any) => (
                        <div key={category.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`category-${category.id}`}
                            checked={field.value?.includes(category.id) || false}
                            onCheckedChange={(checked) => {
                              const currentValues = field.value || [];
                              if (checked) {
                                field.onChange([...currentValues, category.id]);
                              } else {
                                field.onChange(currentValues.filter((id: string) => id !== category.id));
                              }
                            }}
                            data-testid={`checkbox-category-${category.code}`}
                          />
                          <label
                            htmlFor={`category-${category.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {category.name}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        data-testid="input-priority"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-2">
                    <FormLabel>Active</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-active"
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
                onClick={handleCancel}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-submit"
              >
                {isLoading ? "Saving..." : isEditing ? "Update Allocation" : "Create Allocation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}