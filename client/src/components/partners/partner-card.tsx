import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Store, User, MapPin, Phone, Star, BarChart3, Edit } from "lucide-react";
import type { Partner } from "@shared/schema";

interface PartnerCardProps {
  partner: Partner;
  onEdit?: (id: string) => void;
  onView?: (id: string) => void;
}

export default function PartnerCard({ partner, onEdit, onView }: PartnerCardProps) {
  const handleEdit = () => {
    onEdit?.(partner.id);
  };

  const handleView = () => {
    onView?.(partner.id);
  };

  return (
    <Card data-testid={`card-partner-${partner.id}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              {partner.type === 'STUDIO' ? (
                <Store className="h-6 w-6 text-primary" />
              ) : (
                <User className="h-6 w-6 text-orange-600" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{partner.displayName}</h3>
              <p className="text-sm text-muted-foreground capitalize">
                {partner.type.toLowerCase()}
              </p>
            </div>
          </div>
          <Badge className={partner.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
            {partner.active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        
        <div className="space-y-2 mb-4">
          {partner.address && (
            <div className="flex items-center text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mr-2" />
              <span>{partner.city}, {partner.state}</span>
            </div>
          )}
          {partner.phone && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Phone className="h-4 w-4 mr-2" />
              <span>{partner.phone}</span>
            </div>
          )}
          <div className="flex items-center text-sm text-muted-foreground">
            <Star className="h-4 w-4 mr-2" />
            <span>Priority: 1</span>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4">
          <div>
            <p className="font-semibold text-foreground">15</p>
            <p className="text-muted-foreground">Active Jobs</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">94%</p>
            <p className="text-muted-foreground">Success Rate</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">2.1d</p>
            <p className="text-muted-foreground">Avg TAT</p>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button 
            variant="secondary" 
            className="flex-1 text-sm"
            onClick={handleEdit}
            data-testid={`button-edit-${partner.id}`}
          >
            <Edit className="mr-1 h-3 w-3" />
            Edit
          </Button>
          <Button 
            className="flex-1 text-sm"
            onClick={handleView}
            data-testid={`button-view-${partner.id}`}
          >
            <BarChart3 className="mr-1 h-3 w-3" />
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
