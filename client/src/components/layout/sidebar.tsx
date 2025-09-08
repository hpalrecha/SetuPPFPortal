import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  ClipboardList, 
  CheckSquare, 
  Handshake, 
  DollarSign, 
  Percent, 
  PieChart, 
  History, 
  Settings,
  Shield
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { name: "Work Orders", href: "/work-orders", icon: ClipboardList },
  { name: "Job Cards", href: "/job-cards", icon: CheckSquare },
  { name: "Partners", href: "/partners", icon: Handshake },
  { name: "Pricing Rules", href: "/pricing", icon: DollarSign },
  { name: "Commissions", href: "/commissions", icon: Percent },
  { name: "Reports", href: "/reports", icon: PieChart },
  { name: "Audit Logs", href: "/audit", icon: History },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-16 z-30 h-[calc(100vh-4rem)] w-64 bg-card border-r border-border transition-transform duration-300 ease-in-out",
          "md:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        data-testid="sidebar"
      >
        <nav className="p-4 space-y-2" data-testid="sidebar-nav">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile toggle button */}
      <button
        className="fixed top-4 left-4 z-40 p-2 rounded-md bg-card border border-border md:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        data-testid="sidebar-toggle"
      >
        <div className="w-6 h-6 flex flex-col justify-center space-y-1">
          <div className="w-full h-0.5 bg-foreground"></div>
          <div className="w-full h-0.5 bg-foreground"></div>
          <div className="w-full h-0.5 bg-foreground"></div>
        </div>
      </button>
    </>
  );
}
