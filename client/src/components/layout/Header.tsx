import { useState } from "react";
import { Bell, User, CheckCircle, AlertCircle, Clock, PackageCheck, FileText, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import logoGreen from "@assets/P91 PULSE logo-01_1761139835394.png";
import logoWhite from "@assets/P91 PULSE logo  copy-01_1761139835393.png";

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [notificationOpen, setNotificationOpen] = useState(false);

  // Check if notifications have been read from localStorage
  const getUnreadCount = () => {
    const hasRead = localStorage.getItem('notifications_read');
    return hasRead === 'true' ? 0 : 5;
  };

  const [unreadCount, setUnreadCount] = useState(getUnreadCount());

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const handleNotificationOpen = (open: boolean) => {
    setNotificationOpen(open);
    if (open && unreadCount > 0) {
      // Mark notifications as read when opened
      setTimeout(() => {
        setUnreadCount(0);
        localStorage.setItem('notifications_read', 'true');
      }, 300);
    }
  };

  return (
    <header className="bg-card border-b border-border sticky top-0 z-40">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden p-2"
            onClick={onToggleSidebar}
            data-testid="button-toggle-mobile-sidebar"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </Button>
          
          <div className="flex items-center space-x-2 sm:space-x-3">
            <img 
              src={logoGreen} 
              alt="Pulse VAS" 
              className="h-[42px] sm:h-[52px] w-auto object-contain dark:hidden"
            />
            <img 
              src={logoWhite} 
              alt="Pulse VAS" 
              className="h-[42px] sm:h-[52px] w-auto object-contain hidden dark:block"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Notifications */}
          <Popover open={notificationOpen} onOpenChange={handleNotificationOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="relative p-2"
                data-testid="button-notifications"
              >
                <Bell className="w-5 h-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 p-0 flex items-center justify-center text-xs"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">{unreadCount} New</Badge>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {/* New Work Order */}
                <div className="p-4 hover:bg-muted/50 border-b cursor-pointer transition-colors">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        New Work Order #WO-2845
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Mercedes-Benz S-Class - Full Body PPF requested by Mumbai Hyundai Showroom
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        5 minutes ago
                      </p>
                    </div>
                  </div>
                </div>

                {/* Approval Pending */}
                <div className="p-4 hover:bg-muted/50 border-b cursor-pointer transition-colors">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        Approval Required
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Job Card JC-1234 awaiting your approval for ceramic coating service
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        2 hours ago
                      </p>
                    </div>
                  </div>
                </div>

                {/* Job Card Completed */}
                <div className="p-4 hover:bg-muted/50 border-b cursor-pointer transition-colors">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <PackageCheck className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        Job Card Completed
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        JC-1189 has been marked as completed by P91 Car Care
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        5 hours ago
                      </p>
                    </div>
                  </div>
                </div>

                {/* Rework Requested */}
                <div className="p-4 hover:bg-muted/50 border-b cursor-pointer transition-colors">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        Rework Requested
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Job Card JC-1156 requires rework - quality issues reported
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Yesterday
                      </p>
                    </div>
                  </div>
                </div>

                {/* System Update */}
                <div className="p-4 hover:bg-muted/50 border-b cursor-pointer transition-colors">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Wrench className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        System Performance Improved
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Work order creation is now 80% faster - orders create in 3-5 seconds
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        2 days ago
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Empty state */}
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <p>All caught up! 🎉</p>
                  <p className="text-xs mt-1">You have no older notifications</p>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center space-x-2 sm:space-x-3 p-1 sm:p-2"
                data-testid="button-user-menu"
              >
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-foreground truncate max-w-32">
                    {user?.email || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.role?.replace("_", " ") || "Role"}
                  </p>
                </div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation("/settings")}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/audit")}>
                Activity Log
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
