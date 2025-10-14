import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  ClipboardList, 
  CheckSquare, 
  Handshake, 
  Network,
  DollarSign, 
  Percent, 
  CreditCard,
  Shield,
  BarChart3, 
  History, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  Store,
  MapPin,
  Users,
  Car,
  Tag,
  BookOpen,
  Package
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
  isMobile?: boolean;
}

const baseNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "OEM_ADMIN", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER", "SALES_PERSON", "PARTNER_ADMIN", "PARTNER_STAFF"] },
  { name: "Work Orders", href: "/work-orders", icon: ClipboardList, roles: ["SUPER_ADMIN", "OEM_ADMIN", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER", "SALES_PERSON", "PARTNER_ADMIN"] },
  { name: "Job Cards", href: "/job-cards", icon: CheckSquare, roles: ["SUPER_ADMIN", "OEM_ADMIN", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER", "SALES_PERSON", "PARTNER_ADMIN", "PARTNER_STAFF"] },
  { name: "Knowledge Hub", href: "/knowledge-hub", icon: BookOpen, roles: ["SUPER_ADMIN", "OEM_ADMIN", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER", "SALES_PERSON", "PARTNER_ADMIN", "PARTNER_STAFF"] },
  { name: "Partners", href: "/partners", icon: Handshake, roles: ["SUPER_ADMIN", "SHOWROOM_MANAGER"] },
  { name: "Staff Management", href: "/partner-staff", icon: Users, roles: ["PARTNER_ADMIN"] },
  { name: "Payouts & Earnings", href: "/payouts", icon: DollarSign, roles: ["PARTNER_ADMIN"] },
  { name: "Allocations", href: "/allocations", icon: Network, roles: ["SUPER_ADMIN", "OEM_ADMIN", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER"] },
  { name: "Services", href: "/services", icon: Shield, roles: ["SUPER_ADMIN", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER", "SALES_PERSON"] },
  { name: "Pricing Rules", href: "/pricing", icon: DollarSign, roles: ["SUPER_ADMIN", "OEM_ADMIN", "DEALERSHIP_ADMIN"] },
  { name: "Commissions", href: "/commissions", icon: Percent, roles: ["SUPER_ADMIN", "OEM_ADMIN", "DEALERSHIP_ADMIN"] },
  { name: "Payout Settlement", href: "/payout-settlement", icon: CreditCard, roles: ["SUPER_ADMIN", "OEM_ADMIN", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER"] },
];

const organizationNavigation = [
  { name: "OEMs", href: "/oems", icon: Building2, roles: ["SUPER_ADMIN"] },
  { name: "Dealerships", href: "/dealerships", icon: Store, roles: ["SUPER_ADMIN"] },
  { name: "Showrooms", href: "/showrooms", icon: MapPin, roles: ["SUPER_ADMIN"] },
  { name: "Sales Persons", href: "/sales-persons", icon: Users, roles: ["SUPER_ADMIN"] },
  { name: "Vehicles", href: "/vehicles", icon: Car, roles: ["SUPER_ADMIN"] },
  { name: "Service Categories", href: "/service-categories", icon: Tag, roles: ["SUPER_ADMIN"] },
  { name: "Brands", href: "/brands", icon: Tag, roles: ["SUPER_ADMIN"] },
  { name: "Raw Materials", href: "/raw-materials", icon: Package, roles: ["SUPER_ADMIN"] },
];

const systemNavigation = [
  { name: "Reports", href: "/reports", icon: BarChart3, roles: ["SUPER_ADMIN", "OEM_ADMIN", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER", "PARTNER_ADMIN"] },
  { name: "Audit Logs", href: "/audit", icon: History, roles: ["SUPER_ADMIN", "OEM_ADMIN"] },
  { name: "Settings", href: "/settings", icon: Settings, roles: ["SUPER_ADMIN", "OEM_ADMIN", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER", "SALES_PERSON", "PARTNER_ADMIN", "PARTNER_STAFF"] },
];

const getFilteredNavigation = (userRole: string | undefined) => {
  if (!userRole) return [];
  
  const filterByRole = (items: any[]) => 
    items.filter(item => item.roles.includes(userRole));
  
  const navigation = [...filterByRole(baseNavigation)];
  
  // Add organization management section for Super Admin
  if (userRole === "SUPER_ADMIN") {
    navigation.push(...filterByRole(organizationNavigation));
  }
  
  navigation.push(...filterByRole(systemNavigation));
  
  return navigation;
};

export function Sidebar({ collapsed, onToggle, className, isMobile = false }: SidebarProps) {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  
  const navigation = getFilteredNavigation(user?.role) || [];

  return (
    <div className={cn(
      "flex flex-col bg-card border-r border-border transition-all duration-300",
      // Different width behavior for mobile vs desktop
      isMobile 
        ? (collapsed ? "-translate-x-full w-64" : "translate-x-0 w-64") 
        : (collapsed ? "w-16" : "w-64"),
      className
    )}>
      {/* Toggle Button */}
      <div className="flex justify-end p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-8 w-8 p-0"
          data-testid="button-toggle-sidebar"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navigation.map((item, index) => {
          const isActive = location === item.href || 
                          (item.href === "/dashboard" && location === "/");
          
          // Add section divider for organization management (Super Admin only)
          const isFirstOrgItem = user?.role === "SUPER_ADMIN" && item.href === "/oems";
          const isFirstSystemItem = item.href === "/reports";
          
          return (
            <div key={item.name}>
              {(isFirstOrgItem || isFirstSystemItem) && !collapsed && (
                <div className="px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {isFirstOrgItem ? "Organization" : "System"}
                </div>
              )}
              <Button
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  collapsed && "px-2",
                  isActive && "bg-primary text-primary-foreground"
                )}
                onClick={() => navigate(item.href)}
                data-testid={`nav-${item.href.replace("/", "")}`}
              >
                <item.icon className={cn("h-4 w-4", !collapsed && "mr-3")} />
                {!collapsed && (
                  <span className="truncate">{item.name}</span>
                )}
              </Button>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
