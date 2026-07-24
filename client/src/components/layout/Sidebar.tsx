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
  UserPlus,
  Car,
  Tag,
  BookOpen,
  Package,
  Contact
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
  isMobile?: boolean;
}

// Navigation items configuration
const baseNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "OEM_ADMIN", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER", "SALES_PERSON", "PARTNER_ADMIN", "PARTNER_STAFF", "DETAILING_PARTNER"] },
  { name: "Work Orders", href: "/work-orders", icon: ClipboardList, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "OEM_ADMIN", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER", "SALES_PERSON", "PARTNER_ADMIN"] },
  { name: "Job Cards", href: "/job-cards", icon: CheckSquare, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "OEM_ADMIN", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER", "SALES_PERSON", "PARTNER_ADMIN", "PARTNER_STAFF", "DETAILING_PARTNER"] },
  { name: "Customers", href: "/customers", icon: Contact, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { name: "Knowledge Hub", href: "/knowledge-hub", icon: BookOpen, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "OEM_ADMIN", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER", "SALES_PERSON", "PARTNER_ADMIN", "PARTNER_STAFF", "DETAILING_PARTNER"] },
  { name: "Partners", href: "/partners", icon: Handshake, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { name: "Users", href: "/pulse-pending-users", icon: Users, roles: ["SUPER_ADMIN", "ADMIN"] },
  { name: "Staff Management", href: "/partner-staff", icon: Users, roles: ["PARTNER_ADMIN"] },
  { name: "Invite Installer", href: "/invite-installer", icon: UserPlus, roles: ["PARTNER_STAFF", "DETAILING_PARTNER"] },
  { name: "Payouts & Earnings", href: "/payouts", icon: DollarSign, roles: ["PARTNER_ADMIN"] },
  { name: "Allocations", href: "/allocations", icon: Network, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { name: "Services", href: "/services", icon: Shield, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER", "SALES_PERSON"] },
  { name: "Pricing Rules", href: "/pricing", icon: DollarSign, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { name: "Commissions", href: "/commissions", icon: Percent, roles: ["SUPER_ADMIN", "ADMIN"] },
  { name: "Payout Settlement", href: "/payout-settlement", icon: CreditCard, roles: ["SUPER_ADMIN", "ADMIN", "OEM_ADMIN", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER"] },
];

const organizationNavigation = [
  { name: "OEMs", href: "/oems", icon: Building2, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { name: "Dealerships", href: "/dealerships", icon: Store, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { name: "Showrooms", href: "/showrooms", icon: MapPin, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { name: "Sales Persons", href: "/sales-persons", icon: Users, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { name: "Vehicles", href: "/vehicles", icon: Car, roles: ["SUPER_ADMIN", "ADMIN"] },
  { name: "Service Categories", href: "/service-categories", icon: Tag, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { name: "Brands", href: "/brands", icon: Tag, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { name: "Raw Materials", href: "/raw-materials", icon: Package, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
];

const systemNavigation = [
  { name: "Audit Logs", href: "/audit", icon: History, roles: ["SUPER_ADMIN", "ADMIN", "OEM_ADMIN"] },
  { name: "Settings", href: "/settings", icon: Settings, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "OEM_ADMIN", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER", "SALES_PERSON", "PARTNER_ADMIN", "PARTNER_STAFF", "DETAILING_PARTNER"] },
];

const getFilteredNavigation = (userRole: string | undefined) => {
  if (!userRole) return [];
  
  const filterByRole = (items: any[]) => 
    items.filter(item => item.roles.includes(userRole));
  
  const navigation = [...filterByRole(baseNavigation)];
  
  // Add organization management section for Super Admin, Admin, and Manager
  if (userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "MANAGER") {
    navigation.push(...filterByRole(organizationNavigation));
  }
  
  navigation.push(...filterByRole(systemNavigation));
  
  return navigation;
};

export function Sidebar({ collapsed, onToggle, className, isMobile = false }: SidebarProps) {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  
  const navigation = getFilteredNavigation(user?.role) || [];

  // First visible item of the "System" group (Reports was removed; Audit/Settings remain)
  const systemHrefs = ["/audit", "/settings"];
  const firstSystemHref = navigation.find((n) => systemHrefs.includes(n.href))?.href;

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

      {/* Navigation (scrolls independently of page content) */}
      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        {navigation.map((item, index) => {
          const isActive = location === item.href || 
                          (item.href === "/dashboard" && location === "/");
          
          // Add section divider for organization management (Super Admin, Admin, Manager)
          const isFirstOrgItem = (user?.role === "SUPER_ADMIN" || user?.role === "ADMIN" || user?.role === "MANAGER") && item.href === "/oems";
          const isFirstSystemItem = item.href === firstSystemHref;
          
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
                title={collapsed ? item.name : undefined}
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
