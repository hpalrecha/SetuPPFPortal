import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Search, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Link as LinkIcon, 
  Download, 
  Eye, 
  Trash2,
  Edit,
  BookOpen,
  Tag,
  ExternalLink,
  Play
} from "lucide-react";

const categories = [
  { value: "KNOWLEDGE_BASE", label: "Knowledge Base" },
  { value: "OFFERS", label: "Offers" },
  { value: "COMMUNICATION", label: "Communication" },
  { value: "TRAINING", label: "Training" },
  { value: "MARKETING", label: "Marketing" }
];

const contentTypes = [
  { value: "PDF", label: "PDF", icon: FileText },
  { value: "IMAGE", label: "Image", icon: ImageIcon },
  { value: "VIDEO", label: "Video", icon: Video },
  { value: "YOUTUBE", label: "YouTube", icon: Play },
  { value: "DOCUMENT", label: "Document", icon: FileText },
  { value: "LINK", label: "Link", icon: LinkIcon }
];

const applicableToOptions = [
  { value: "DETAILER", label: "Detailer" },
  { value: "INSTALLER", label: "Installer" },
  { value: "SHOWROOM", label: "Showroom" },
  { value: "DEALERSHIP", label: "Dealership" },
  { value: "OEM", label: "OEM" },
  { value: "ALL", label: "All Users" }
];

const knowledgeHubSchema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.string().min(1, "Category is required"),
  contentType: z.string().min(1, "Content type is required"),
  fileUrl: z.string().optional(),
  externalLink: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  applicableTo: z.array(z.string()).min(1, "Select at least one user group"),
  description: z.string().optional(),
  isActive: z.boolean().default(true)
});

type KnowledgeHubFormData = z.infer<typeof knowledgeHubSchema>;

export default function KnowledgeHub() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedContentType, setSelectedContentType] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'OEM_ADMIN';

  const form = useForm<KnowledgeHubFormData>({
    resolver: zodResolver(knowledgeHubSchema),
    defaultValues: {
      title: "",
      category: "",
      contentType: "",
      fileUrl: "",
      externalLink: "",
      applicableTo: [],
      description: "",
      isActive: true
    }
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['/api/knowledge-hub', selectedCategory, selectedContentType, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedContentType) params.append('contentType', selectedContentType);
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await fetch(`/api/knowledge-hub?${params.toString()}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch knowledge hub items');
      return response.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: KnowledgeHubFormData) => {
      return apiRequest('/api/knowledge-hub', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-hub'] });
      toast({ title: "Success", description: "Resource created successfully" });
      setShowCreateModal(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create resource",
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<KnowledgeHubFormData> }) => {
      return apiRequest(`/api/knowledge-hub/${id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-hub'] });
      toast({ title: "Success", description: "Resource updated successfully" });
      setEditingItem(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update resource",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/knowledge-hub/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-hub'] });
      toast({ title: "Success", description: "Resource deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete resource",
        variant: "destructive"
      });
    }
  });

  const viewMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/knowledge-hub/${id}/view`, 'POST');
    }
  });

  const handleSubmit = (data: KnowledgeHubFormData) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleView = (item: any) => {
    setSelectedItem(item);
    viewMutation.mutate(item.id);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    form.reset({
      title: item.title,
      category: item.category,
      contentType: item.contentType,
      fileUrl: item.fileUrl || "",
      externalLink: item.externalLink || "",
      applicableTo: item.applicableTo,
      description: item.description || "",
      isActive: item.isActive
    });
    setShowCreateModal(true);
  };

  const getContentIcon = (contentType: string) => {
    const type = contentTypes.find(t => t.value === contentType);
    return type ? type.icon : FileText;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'KNOWLEDGE_BASE': 'bg-blue-100 text-blue-700 border-blue-300',
      'OFFERS': 'bg-green-100 text-green-700 border-green-300',
      'COMMUNICATION': 'bg-purple-100 text-purple-700 border-purple-300',
      'TRAINING': 'bg-orange-100 text-orange-700 border-orange-300',
      'MARKETING': 'bg-pink-100 text-pink-700 border-pink-300'
    };
    return colors[category] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Knowledge Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Access training materials, offers, and important resources
          </p>
        </div>
        {isAdmin && (
          <Button 
            onClick={() => {
              setEditingItem(null);
              form.reset();
              setShowCreateModal(true);
            }}
            data-testid="button-create-resource"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Resource
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search resources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="select-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedContentType} onValueChange={setSelectedContentType}>
              <SelectTrigger data-testid="select-content-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                {contentTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(searchTerm || selectedCategory || selectedContentType) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("");
                  setSelectedContentType("");
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading resources...</p>
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No resources found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item: any) => {
            const ContentIcon = getContentIcon(item.contentType);
            return (
              <Card 
                key={item.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleView(item)}
                data-testid={`card-resource-${item.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <ContentIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base line-clamp-2">{item.title}</CardTitle>
                        <CardDescription className="mt-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${getCategoryColor(item.category)}`}>
                            <Tag className="h-3 w-3" />
                            {categories.find(c => c.value === item.category)?.label}
                          </span>
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      <span>{item.viewCount || 0} views</span>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(item)}
                          data-testid={`button-edit-${item.id}`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this resource?")) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                          data-testid={`button-delete-${item.id}`}
                        >
                          <Trash2 className="h-3 w-3 text-red-600" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Resource' : 'Add New Resource'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the resource details below' : 'Create a new resource for your team'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title*</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., STEK PPF Installation Guide" {...field} data-testid="input-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category*</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-form-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
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
                  name="contentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content Type*</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-form-content-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {contentTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {form.watch('contentType') === 'YOUTUBE' || form.watch('contentType') === 'LINK' ? (
                <FormField
                  control={form.control}
                  name="externalLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>External Link/URL*</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://youtube.com/..." 
                          {...field} 
                          data-testid="input-external-link" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="fileUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>File URL</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Upload file or paste URL" 
                          {...field} 
                          data-testid="input-file-url" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="applicableTo"
                render={() => (
                  <FormItem>
                    <FormLabel>Applicable To*</FormLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {applicableToOptions.map((option) => (
                        <FormField
                          key={option.value}
                          control={form.control}
                          name="applicableTo"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={option.value}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(option.value)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, option.value])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== option.value
                                            )
                                          );
                                    }}
                                    data-testid={`checkbox-${option.value.toLowerCase()}`}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {option.label}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Brief description of the resource" 
                        className="resize-none" 
                        rows={3}
                        {...field} 
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-active"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Active
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Make this resource visible to users
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingItem(null);
                    form.reset();
                  }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedItem && (() => {
                const Icon = getContentIcon(selectedItem.contentType);
                return <Icon className="h-5 w-5" />;
              })()}
              {selectedItem?.title}
            </DialogTitle>
            <DialogDescription>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${selectedItem ? getCategoryColor(selectedItem.category) : ''}`}>
                <Tag className="h-3 w-3" />
                {selectedItem && categories.find(c => c.value === selectedItem.category)?.label}
              </span>
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              {selectedItem.description && (
                <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
              )}
              
              {/* YouTube Embed */}
              {selectedItem.contentType === 'YOUTUBE' && selectedItem.externalLink && (
                <div className="aspect-video">
                  <iframe
                    src={selectedItem.externalLink.replace('watch?v=', 'embed/')}
                    className="w-full h-full rounded-lg"
                    allowFullScreen
                  />
                </div>
              )}

              {/* PDF Viewer */}
              {selectedItem.contentType === 'PDF' && selectedItem.fileUrl && (
                <div className="border rounded-lg p-4">
                  <iframe 
                    src={selectedItem.fileUrl} 
                    className="w-full h-[500px]"
                  />
                </div>
              )}

              {/* Image */}
              {selectedItem.contentType === 'IMAGE' && selectedItem.fileUrl && (
                <img 
                  src={selectedItem.fileUrl} 
                  alt={selectedItem.title}
                  className="w-full rounded-lg"
                />
              )}

              {/* Download/View Links */}
              <div className="flex gap-2">
                {selectedItem.fileUrl && (
                  <Button asChild variant="outline">
                    <a href={selectedItem.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                )}
                {selectedItem.externalLink && (
                  <Button asChild variant="outline">
                    <a href={selectedItem.externalLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Link
                    </a>
                  </Button>
                )}
              </div>

              <div className="text-xs text-muted-foreground border-t pt-4">
                <p>Created by: {selectedItem.creatorName || selectedItem.creatorEmail}</p>
                <p>Views: {selectedItem.viewCount || 0}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
