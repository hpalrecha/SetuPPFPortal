import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserPlus, Users, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User as StaffUser, Partner } from "@shared/schema";

// Staff users created by the Pulse webhook without a resolvable partner tag.
// Admins assign them to a partner here; after that they appear in the
// partner's Staff Management tab.
export default function PulsePendingUsersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedPartners, setSelectedPartners] = useState<Record<string, string>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const authHeaders = {
    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
  };

  const { data: pendingUsers = [], isLoading } = useQuery<StaffUser[]>({
    queryKey: ["/api/admin/pulse-pending-users"],
    queryFn: async () => {
      const response = await fetch('/api/admin/pulse-pending-users', {
        headers: authHeaders,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch pending users');
      return response.json();
    },
  });

  const { data: partners = [] } = useQuery<Partner[]>({
    queryKey: ["/api/partners"],
    queryFn: async () => {
      const response = await fetch('/api/partners', {
        headers: authHeaders,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch partners');
      return response.json();
    },
  });

  const activePartners = partners.filter((p) => p.active);

  const handleAssign = async (userId: string) => {
    const partnerId = selectedPartners[userId];
    if (!partnerId) {
      toast({
        title: "Select a partner",
        description: "Choose a partner before assigning.",
        variant: "destructive",
      });
      return;
    }

    setAssigningId(userId);
    try {
      const response = await fetch(`/api/admin/pulse-pending-users/${userId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
        body: JSON.stringify({ partnerId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign partner');
      }

      toast({
        title: "Partner assigned",
        description: "The user now appears in that partner's staff list.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pulse-pending-users"] });
    } catch (error: any) {
      console.error('Error assigning partner:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to assign partner',
        variant: "destructive",
      });
    } finally {
      setAssigningId(null);
    }
  };

  const formatTerritory = (user: StaffUser) => {
    const meta = user.pulseMetadata;
    if (!meta) return '—';
    const parts = [meta.city, meta.state, meta.postalCode].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '—';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-64 mb-2"></div>
          <div className="h-4 bg-muted rounded w-96"></div>
        </div>
        <div className="h-64 bg-muted rounded-lg animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Pending Pulse Users</h2>
        <p className="text-muted-foreground mt-1">
          Staff from Pulse without a partner assignment. Assign each one to their partner.
        </p>
      </div>

      {pendingUsers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Pending Users</h3>
            <p className="text-sm text-muted-foreground">
              All Pulse-created staff users are assigned to a partner.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table data-testid="table-pulse-pending-users">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead>Assign Partner</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user) => (
                  <TableRow key={user.id} data-testid={`row-pending-user-${user.id}`}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone || '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={user.role === 'DETAILING_PARTNER' ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}
                      >
                        {user.role === 'DETAILING_PARTNER' ? 'Detailing Partner' : 'Installer (Staff)'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3 mr-1" />
                        {formatTerritory(user)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={selectedPartners[user.id] || ''}
                        onValueChange={(value) =>
                          setSelectedPartners((prev) => ({ ...prev, [user.id]: value }))
                        }
                      >
                        <SelectTrigger className="w-56" data-testid={`select-partner-${user.id}`}>
                          <SelectValue placeholder="Select partner" />
                        </SelectTrigger>
                        <SelectContent>
                          {activePartners.map((partner) => (
                            <SelectItem key={partner.id} value={partner.id}>
                              {partner.displayName} ({partner.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleAssign(user.id)}
                        disabled={assigningId === user.id || !selectedPartners[user.id]}
                        data-testid={`button-assign-${user.id}`}
                      >
                        <UserPlus className="h-3 w-3 mr-1" />
                        {assigningId === user.id ? 'Assigning...' : 'Assign'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
