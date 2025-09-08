import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { 
  LayoutDashboard, 
  ClipboardList, 
  CheckSquare, 
  Handshake, 
  DollarSign, 
  Percent, 
  BarChart3, 
  History, 
  Settings,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Work Orders", href: "/work-orders", icon: ClipboardList },
  { name: "Job Cards", href: "/job-cards", icon: CheckSquare },
  { name: "Partners", href: "/partners", icon: Handshake },
  { name: "Pricing Rules", href: "/pricing", icon: DollarSign },
  { name: "Commissions", href: "/commissions", icon: Percent },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Audit Logs", href: "/audit", icon: History },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ collapsed, onToggle, className }: SidebarProps) {
  const [location, navigate] = useLocation();

  return (
    <div className={cn(
      "flex flex-col bg-card border-r border-border transition-all duration-300",
      collapsed ? "w-16" : "w-64",
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
        {navigation.map((item) => {
          const isActive = location === item.href || 
                          (item.href === "/dashboard" && location === "/");
          
          return (
            <Button
              key={item.name}
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
          );
        })}
      </nav>
    </div>
  );
}
