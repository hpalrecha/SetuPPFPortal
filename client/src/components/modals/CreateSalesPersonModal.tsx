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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [selectedOemId, setSelectedOemId] = useState<string>("");
  const [selectedDealershipId, setSelectedDealershipId] = useState<string>("");
  const [dealershipComboboxOpen, setDealershipComboboxOpen] = useState(false);
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

  useEffect(() => {
    if (salesPerson && open) {
      form.reset({
        name: salesPerson.name || "",
        email: salesPerson.email || "",
        phone: salesPerson.phone || "",
        showroomId: salesPerson.showroomId || "",
        active: salesPerson.active ?? true,
      });
      if (salesPerson.showroomId) {
        fetch(`/api/showrooms/${salesPerson.showroomId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
          credentials: 'include',
        })
          .then(r => r.json())
          .then(showroom => {
            if (showroom.dealershipId) {
              setSelectedDealershipId(showroom.dealershipId);
              fetch(`/api/dealerships/${showroom.dealershipId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
                credentials: 'include',
              })
                .then(r => r.json())
                .then(dealership => {
                  if (dealership.oemIds && dealership.oemIds.length > 0) {
                    setSelectedOemId(dealership.oemIds[0]);
                  }
                });
            }
            if (showroom.oemId) {
              setSelectedOemId(showroom.oemId);
            }
          });
      }
    } else if (!salesPerson && open) {
      form.reset({
        name: "",
        email: "",
        phone: "",
        showroomId: "",
        active: true,
      });
      setSelectedOemId("");
      setSelectedDealershipId("");
    }
  }, [salesPerson, open, form]);

  const { data: oems = [] } = useQuery<any[]>({
    queryKey: ["/api/oems"],
    enabled: open,
    staleTime: 300000,
  });

  const { data: dealershipData } = useQuery<{ dealerships: any[]; total: number }>({
    queryKey: ["/api/dealerships", "salesperson", selectedOemId],
    queryFn: async () => {
      const response = await fetch(`/api/dealerships?oemId=${selectedOemId}&limit=10000`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dealerships');
      return response.json();
    },
    enabled: open && !!selectedOemId,
    staleTime: 300000,
  });
  const dealerships = dealershipData?.dealerships || [];

  const { data: showroomData } = useQuery<{ showrooms: any[]; total: number }>({
    queryKey: ["/api/showrooms", "salesperson", selectedDealershipId],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '10000' });
      if (selectedDealershipId) params.set('dealershipId', selectedDealershipId);
      const response = await fetch(`/api/showrooms?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch showrooms');
      return response.json();
    },
    enabled: open && !!selectedDealershipId,
    staleTime: 300000,
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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

            <FormItem>
              <FormLabel>Select OEM</FormLabel>
              <Select
                value={selectedOemId}
                onValueChange={(value) => {
                  setSelectedOemId(value);
                  setSelectedDealershipId("");
                  form.setValue('showroomId', '');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select OEM" />
                </SelectTrigger>
                <SelectContent>
                  {oems.map((oem: any) => (
                    <SelectItem key={oem.id} value={oem.id}>
                      {oem.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>

            <FormItem className="flex flex-col">
              <FormLabel>Select Dealership</FormLabel>
              <Popover open={dealershipComboboxOpen} onOpenChange={setDealershipComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={dealershipComboboxOpen}
                    className={cn(
                      "w-full justify-between font-normal",
                      !selectedDealershipId && "text-muted-foreground"
                    )}
                    disabled={!selectedOemId}
                  >
                    {selectedDealershipId
                      ? dealerships.find((d: any) => d.id === selectedDealershipId)?.name || "Select Dealership"
                      : selectedOemId ? "Select Dealership" : "Select OEM first"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search dealership..." />
                    <CommandList>
                      <CommandEmpty>No dealership found.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        {dealerships.map((dealership: any) => (
                          <CommandItem
                            key={dealership.id}
                            value={dealership.name}
                            onSelect={() => {
                              setSelectedDealershipId(dealership.id);
                              form.setValue('showroomId', '');
                              setDealershipComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedDealershipId === dealership.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {dealership.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </FormItem>

            <FormField
              control={form.control}
              name="showroomId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Select Showroom</FormLabel>
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
                          disabled={!selectedDealershipId}
                        >
                          {field.value
                            ? showrooms.find((s: any) => s.id === field.value)?.name || "Select Showroom"
                            : selectedDealershipId ? "Select Showroom" : "Select Dealership first"}
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
