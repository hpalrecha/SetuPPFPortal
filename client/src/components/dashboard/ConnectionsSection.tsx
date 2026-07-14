import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Car, Users, MapPin } from "lucide-react";

interface ConnectionEntity {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

interface ConnectionsResponse {
  dealerships?: { count: number; items: ConnectionEntity[] };
  showrooms?: { count: number; items: ConnectionEntity[] };
  partners?: { count: number; items: ConnectionEntity[] };
  territory: { count: number; items: { state: string; cities: string[] }[] };
}

type SectionKey = "dealerships" | "showrooms" | "partners" | "territory";

const SECTION_META: Record<
  SectionKey,
  { label: string; sublabel: string; icon: typeof Building2; iconBg: string; iconColor: string }
> = {
  dealerships: {
    label: "Dealerships",
    sublabel: "Assigned dealerships",
    icon: Building2,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  showrooms: {
    label: "Showrooms",
    sublabel: "Assigned showrooms",
    icon: Car,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
  partners: {
    label: "Partners",
    sublabel: "Connected partners",
    icon: Users,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
  },
  territory: {
    label: "Territory",
    sublabel: "States covered",
    icon: MapPin,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
};

const SECTION_ORDER: SectionKey[] = ["dealerships", "showrooms", "partners", "territory"];

export default function ConnectionsSection() {
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);

  const { data, isLoading } = useQuery<ConnectionsResponse>({
    queryKey: ["/api/dashboard/connections"],
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 60000, // Consider data fresh for 1 minute
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-12" />
                </div>
                <Skeleton className="w-12 h-12 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const visibleSections = SECTION_ORDER.filter((key) => data[key] !== undefined);
  if (visibleSections.length === 0) return null;

  const openMeta = openSection ? SECTION_META[openSection] : null;
  const openData = openSection ? data[openSection] : undefined;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {visibleSections.map((key) => {
          const meta = SECTION_META[key];
          const section = data[key]!;
          const Icon = meta.icon;
          return (
            <Card
              key={key}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setOpenSection(key)}
              data-testid={`tile-connections-${key}`}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">{meta.label}</p>
                    <p
                      className="text-2xl font-semibold text-foreground"
                      data-testid={`text-connections-${key}-count`}
                    >
                      {section.count}
                    </p>
                  </div>
                  <div
                    className={`w-12 h-12 ${meta.iconBg} rounded-full flex items-center justify-center`}
                  >
                    <Icon className={`h-6 w-6 ${meta.iconColor}`} />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{meta.sublabel}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={openSection !== null} onOpenChange={(open) => !open && setOpenSection(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {openMeta && <openMeta.icon className={`h-5 w-5 ${openMeta.iconColor}`} />}
              {openMeta?.label}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {openSection === "territory" ? (
              <div className="space-y-3 pr-4">
                {data.territory.items.length === 0 && (
                  <p className="text-sm text-muted-foreground">No territory data yet.</p>
                )}
                {data.territory.items.map((t) => (
                  <div key={t.state}>
                    <p className="font-medium text-foreground">{t.state}</p>
                    {t.cities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {t.cities.map((city) => (
                          <Badge key={city} variant="secondary">
                            {city}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {openData?.items.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nothing assigned yet.</p>
                )}
                {(openData?.items as ConnectionEntity[] | undefined)?.map((item) => (
                  <div key={item.id} className="border-b border-border pb-2 last:border-b-0">
                    <p className="font-medium text-foreground">{item.name}</p>
                    {(item.city || item.state) && (
                      <p className="text-sm text-muted-foreground">
                        {[item.city, item.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                ))}
                {openData && openData.count > openData.items.length && (
                  <p className="text-sm text-muted-foreground pt-1">
                    +{openData.count - openData.items.length} more
                  </p>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
