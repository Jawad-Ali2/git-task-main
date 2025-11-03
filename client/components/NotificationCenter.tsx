'use client';

import { useNotificationContext, type Notification } from '@/contexts/NotificationContext';
import { Bell, X, CheckCircle, XCircle, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

export function NotificationCenter() {
  const { notifications, isConnected, clearNotifications, clearNotification } = useNotificationContext();

  const unreadCount = notifications.length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'scan:completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'scan:failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'scan:started':
      case 'scan:progress':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'webhook:created':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'webhook:deleted':
        return <Info className="h-4 w-4 text-gray-500" />;
      case 'webhook:failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'repo:added':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'repo:removed':
        return <Info className="h-4 w-4 text-gray-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          {!isConnected && (
            <span className="absolute bottom-0 right-0 h-2 w-2 bg-red-500 rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Notifications</h3>
            {isConnected && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                Live
              </span>
            )}
          </div>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearNotifications}
              className="h-auto p-1 text-xs"
            >
              Clear All
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                You'll see updates here
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem 
                  key={notification.id} 
                  notification={notification} 
                  getIcon={getIcon}
                  onDismiss={() => notification.id && clearNotification(notification.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationItem({
  notification,
  getIcon,
  onDismiss,
}: {
  notification: Notification;
  getIcon: (type: string) => React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div className="p-4 hover:bg-muted/50 transition-colors group">
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-1">{getIcon(notification.type)}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{notification.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
    </div>
  );
}

function NotificationItem({
  notification,
  getIcon,
}: {
  notification: Notification;
  getIcon: (type: string) => React.ReactNode;
}) {
  return (
    <div className="p-4 hover:bg-muted/50 transition-colors">
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-1">{getIcon(notification.type)}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{notification.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );
}
