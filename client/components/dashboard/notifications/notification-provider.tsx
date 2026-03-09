'use client';

import { useEffect, useRef } from 'react';
import { useNotificationContext, NotificationType, type Notification } from '@/contexts/NotificationContext';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Loader2, Info } from 'lucide-react';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  // Track scan toast IDs per repository to update them in place
  const scanToastIds = useRef<Map<string, string | number>>(new Map());
  const { notifications, isConnected } = useNotificationContext();
  const processedNotifications = useRef<Set<string> | null>(null);

  // On first render, seed processedNotifications with existing notifications
  // so that localStorage-persisted notifications are not re-toasted on refresh.
  if (processedNotifications.current === null) {
    const initial = new Set<string>();
    notifications.forEach((n) => {
      initial.add(`${n.type}-${n.timestamp}`);
    });
    processedNotifications.current = initial;
  }

  useEffect(() => {
    // Process new notifications
    notifications.forEach((notification) => {
      const notificationId = `${notification.type}-${notification.timestamp}`;
      
      // Skip if already processed
      if (processedNotifications?.current?.has(notificationId)) {
        return;
      }
      
      processedNotifications?.current?.add(notificationId);
      handleNotification(notification);
    });
  }, [notifications]);

  const handleNotification = (notification: Notification) => {
    const { type, title, message, data } = notification;
    const repoId = data?.repoId || data?.repositoryId;

    switch (type) {
      case NotificationType.SCAN_STARTED: {
        // Create or update scan toast for this repository
        const toastId = repoId ? `scan-${repoId}` : undefined;
        
        if (toastId) {
          // Store the toast ID
          scanToastIds.current.set(repoId, toastId);
          
          toast.loading(title, {
            id: toastId,
            description: message,
            duration: Infinity, // Don't auto-dismiss during scan
          });
        } else {
          toast.info(title, {
            description: message,
            icon: <Loader2 className="h-4 w-4 animate-spin" />,
            duration: 3000,
          });
        }
        break;
      }

      case NotificationType.SCAN_PROGRESS: {
        // Update existing scan toast
        const toastId = repoId ? scanToastIds.current.get(repoId) : undefined;
        
        if (toastId) {
          toast.loading(title, {
            id: toastId,
            description: message,
            duration: Infinity,
          });
        } else {
          // Fallback if no toast ID exists
          toast.info(title, {
            description: message,
            icon: <Loader2 className="h-4 w-4 animate-spin" />,
            duration: 2000,
          });
        }
        break;
      }

      case NotificationType.SCAN_COMPLETED: {
        // Update scan toast with success
        const toastId = repoId ? scanToastIds.current.get(repoId) : undefined;
        
        if (toastId) {
          toast.success(title, {
            id: toastId,
            description: message,
            icon: <CheckCircle className="h-4 w-4" />,
            duration: 5000,
            action: repoId
              ? {
                  label: 'View Tasks',
                  onClick: () => {
                    window.location.href = `/dashboard/repositories/${repoId}/tasks`;
                  },
                }
              : undefined,
          });
          
          // Clean up the toast ID after completion
          scanToastIds.current.delete(repoId);
        } else {
          // Fallback
          toast.success(title, {
            description: message,
            icon: <CheckCircle className="h-4 w-4" />,
            duration: 5000,
            action: repoId
              ? {
                  label: 'View Tasks',
                  onClick: () => {
                    window.location.href = `/dashboard/repositories/${repoId}/tasks`;
                  },
                }
              : undefined,
          });
        }
        break;
      }

      case NotificationType.SCAN_FAILED: {
        // Update scan toast with error
        const toastId = repoId ? scanToastIds.current.get(repoId) : undefined;
        
        if (toastId) {
          toast.error(title, {
            id: toastId,
            description: message,
            icon: <XCircle className="h-4 w-4" />,
            duration: 7000,
          });
          
          // Clean up the toast ID after failure
          scanToastIds.current.delete(repoId);
        } else {
          // Fallback
          toast.error(title, {
            description: message,
            icon: <XCircle className="h-4 w-4" />,
            duration: 7000,
          });
        }
        break;
      }

      case NotificationType.REPO_ADDED:
        toast.success(title, {
          description: message,
          icon: <CheckCircle className="h-4 w-4" />,
          duration: 4000,
        });
        break;

      case NotificationType.REPO_REMOVED:
        toast.info(title, {
          description: message,
          icon: <Info className="h-4 w-4" />,
          duration: 3000,
        });
        break;

      case NotificationType.WEBHOOK_CREATED:
        toast.success(title, {
          description: message,
          icon: <CheckCircle className="h-4 w-4" />,
          duration: 3000,
        });
        break;

      case NotificationType.WEBHOOK_DELETED:
        toast.info(title, {
          description: message,
          icon: <Info className="h-4 w-4" />,
          duration: 3000,
        });
        break;

      case NotificationType.WEBHOOK_FAILED:
        toast.error(title, {
          description: message,
          icon: <XCircle className="h-4 w-4" />,
          duration: 5000,
        });
        break;

      case NotificationType.TASK_CREATED:
      case NotificationType.TASK_UPDATED:
      case NotificationType.TASK_DELETED:
        toast.info(title, {
          description: message,
          duration: 3000,
        });
        break;

      default:
        toast(title, {
          description: message,
          duration: 3000,
        });
    }
  };

  useEffect(() => {
    if (isConnected) {
      toast.success('Connected', {
        description: 'Real-time notifications enabled',
        duration: 2000,
      });
    }
  }, [isConnected]);

  return <>{children}</>;
}
