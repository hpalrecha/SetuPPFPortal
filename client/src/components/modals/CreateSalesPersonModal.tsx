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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const salesPersonSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  showroomId: z.string().min(1, "Showroom is required"),
  active: z.boolean(),
});

type SalesPersonFormData = z.infer<typeof salesPersonSchema>;

interface CreateSalesPersonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  salesPerson?: any;
}

export function CreateSalesPersonModal({
  open,
  onOpenChange,
  onSuccess,
  salesPerson,
}: CreateSalesPersonModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showroomComboboxOpen, setShowroomComboboxOpen] = useState(false);
  const isEditing = !!salesPerson;

  const form = useForm<SalesPersonFormData>({
    resolver: zodResolver(salesPersonSchema),
    defaultValues: {
      name: salesPerson?.name || "",
      email: salesPerson?.email || "",
      phone: salesPerson?.phone || "",
      showroomId: salesPerson?.showroomId || "",
      active: salesPerson?.active ?? true,
    },
  });

  // Update form when salesPerson prop changes (for editing)
  useEffect(() => {
    if (salesPerson && open) {
      form.reset({
        name: salesPerson.name || "",
        email: salesPerson.email || "",
        phone: salesPerson.phone || "",
        showroomId: salesPerson.showroomId || "",
        active: salesPerson.active ?? true,
      });
    } else if (!salesPerson && open) {
      form.reset({
        name: "",
        email: "",
        phone: "",
        showroomId: "",
        active: true,
      });
    }
  }, [salesPerson, open, form]);

  // Fetch showrooms
  const { data: showroomData } = useQuery<{ showrooms: any[]; total: number }>({
    queryKey: ["/api/showrooms"],
    queryFn: async () => {
      const response = await fetch('/api/showrooms?limit=1000', {
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
  const showrooms = showroomData?.showrooms || [];

  const onSubmit = async (data: SalesPersonFormData) => {
    setIsLoading(true);
    try {
      const endpoint = isEditing ? `/api/sales-persons/${salesPerson.id}` : "/api/sales-persons";
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
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} sales person`);
      }

      toast({
        title: "Success",
        description: `Sales person ${isEditing ? 'updated' : 'created'} successfully`,
      });

      form.reset();
      onSuccess();
    } catch (error) {
      console.error("Error saving sales person:", error);
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? 'update' : 'create'} sales person`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Create'} Sales Person</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter sales person name"
                      {...field}
                      data-testid="input-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter email address"
                      {...field}
                      data-testid="input-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter phone number"
                      {...field}
                      data-testid="input-phone"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="showroomId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Showroom</FormLabel>
                  <Popover open={showroomComboboxOpen} onOpenChange={setShowroomComboboxOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={showroomComboboxOpen}
                          className={cn(
                            "w-full justify-between font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? showrooms.find((s: any) => s.id === field.value)?.name || "Select Showroom"
                            : "Select Showroom"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search showroom..." />
                        <CommandList>
                          <CommandEmpty>No showroom found.</CommandEmpty>
                          <CommandGroup className="max-h-64 overflow-auto">
                            {showrooms.map((showroom: any) => (
                              <CommandItem
                                key={showroom.id}
                                value={showroom.name}
                                onSelect={() => {
                                  field.onChange(showroom.id);
                                  setShowroomComboboxOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === showroom.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {showroom.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Active Status */}
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Sales person is currently active and can handle work orders
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-active"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

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
                data-testid="button-save-sales-person"
              >
                {isLoading ? "Saving..." : `${isEditing ? 'Update' : 'Create'} Sales Person`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}