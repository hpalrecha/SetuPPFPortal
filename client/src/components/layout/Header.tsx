import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, User, Mail, MessageCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface BellNotification {
  id: string;
  channel: string;
  subject?: string | null;
  bodyPreview?: string | null;
  createdAt: string;
  readAt?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

const authHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
});

const channelIcon = (channel: string) => {
  switch (channel) {
    case 'EMAIL': return Mail;
    case 'WHATSAPP': return MessageCircle;
    case 'SMS': return Smartphone;
    default: return Bell;
  }
};

const timeAgo = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [notificationOpen, setNotificationOpen] = useState(false);

  // Per-user in-app feed for the bell. Polls every 60s so new items surface without a reload.
  const { data } = useQuery<{ items: BellNotification[]; unreadCount: number }>({
    queryKey: ["/api/notifications/mine"],
    queryFn: async () => {
      const res = await fetch('/api/notifications/mine', { headers: authHeaders(), credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  const items = data?.items || [];
  const unreadCount = data?.unreadCount || 0;

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      await fetch('/api/notifications/mine/read', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/mine"] });
    } catch { /* non-blocking */ }
  };

  const openNotification = (n: BellNotification) => {
    setNotificationOpen(false);
    if (n.relatedEntityType === 'job_card' && n.relatedEntityId) setLocation(`/job-cards/${n.relatedEntityId}`);
    else if (n.relatedEntityType === 'work_order' && n.relatedEntityId) setLocation(`/work-orders/${n.relatedEntityId}`);
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  return (
    <header className="bg-card border-b border-border sticky top-0 z-40 safe-top safe-x">
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
          <Popover open={notificationOpen} onOpenChange={(o) => { setNotificationOpen(o); if (o) markAllRead(); }}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="relative p-2"
                data-testid="button-notifications"
              >
                <Bell className="w-5 h-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center"
                    data-testid="badge-unread-count"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
                )}
              </div>
              {items.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <p>All caught up! 🎉</p>
                  <p className="text-xs mt-1">You have no new notifications</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto divide-y">
                  {items.map((n) => {
                    const Icon = channelIcon(n.channel);
                    const clickable = !!n.relatedEntityId && (n.relatedEntityType === 'job_card' || n.relatedEntityType === 'work_order');
                    return (
                      <div
                        key={n.id}
                        className={`flex gap-3 p-3 ${!n.readAt ? 'bg-primary/5' : ''} ${clickable ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                        onClick={() => clickable && openNotification(n)}
                        data-testid={`bell-item-${n.id}`}
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{n.subject || 'Notification'}</p>
                          {n.bodyPreview && <p className="text-xs text-muted-foreground line-clamp-2">{n.bodyPreview}</p>}
                          <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(n.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
