'use client';

import { useEffect, useRef } from 'react';
import { useNotificationContext, NotificationType, type Notification } from '@/contexts/NotificationContext';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Loader2, Info } from 'lucide-react';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  // Track scan toast IDs per repository to update them in place
  const scanToastIds = useRef<Map<string, string | number>>(new Map());
  const { notifications, isConnected, isHydrated } = useNotificationContext();
  const processedNotifications = useRef<Set<string>>(new Set());
  const hasInitialized = useRef(false);
  const hasSeenInitialConnection = useRef(false);

  useEffect(() => {
    if (!isHydrated) return;

    // Seed with already-present notifications once hydration completes,
    // so persisted history is not shown as fresh toasts on page refresh.
    if (!hasInitialized.current) {
      notifications.forEach((notification) => {
        processedNotifications.current.add(`${notification.type}-${notification.timestamp}`);
      });
      hasInitialized.current = true;
      return;
    }

    // Process new notifications
    notifications.forEach((notification) => {
      const notificationId = `${notification.type}-${notification.timestamp}`;
      
      // Skip if already processed
      if (processedNotifications.current.has(notificationId)) {
        return;
      }
      
      processedNotifications.current.add(notificationId);
      handleNotification(notification, notificationId);
    });
  }, [notifications, isHydrated]);

  const handleNotification = (notification: Notification, notificationId: string) => {
    const { type, title, message, data } = notification;
    const repoId = data?.repoId || data?.repositoryId;
    const repositoryName = data?.repositoryName || data?.repoName || data?.repositoryFullName;
    const messageWithRepository = repositoryName
      ? `${message} (Repository: ${repositoryName})`
      : message;

    switch (type) {
      case NotificationType.SCAN_STARTED: {
        // Create or update scan toast for this repository
        const toastId = repoId ? `scan-${repoId}` : undefined;
        
        if (toastId) {
          // Store the toast ID
          scanToastIds.current.set(repoId, toastId);
          
          toast.loading(title, {
            id: toastId,
            description: messageWithRepository,
            duration: Infinity, // Don't auto-dismiss during scan
          });
        } else {
          toast.info(title, {
            description: messageWithRepository,
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
            description: messageWithRepository,
            duration: Infinity,
          });
        } else {
          // Fallback if no toast ID exists
          toast.info(title, {
            id: notificationId,
            description: messageWithRepository,
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
            description: messageWithRepository,
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
            id: notificationId,
            description: messageWithRepository,
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
            description: messageWithRepository,
            icon: <XCircle className="h-4 w-4" />,
            duration: 7000,
          });
          
          // Clean up the toast ID after failure
          scanToastIds.current.delete(repoId);
        } else {
          // Fallback
          toast.error(title, {
            id: notificationId,
            description: messageWithRepository,
            icon: <XCircle className="h-4 w-4" />,
            duration: 7000,
          });
        }
        break;
      }

      case NotificationType.REPO_ADDED:
        toast.success(title, {
          id: notificationId,
          description: message,
          icon: <CheckCircle className="h-4 w-4" />,
          duration: 4000,
        });
        break;

      case NotificationType.REPO_REMOVED:
        toast.info(title, {
          id: notificationId,
          description: message,
          icon: <Info className="h-4 w-4" />,
          duration: 3000,
        });
        break;

      case NotificationType.WEBHOOK_CREATED:
        toast.success(title, {
          id: notificationId,
          description: message,
          icon: <CheckCircle className="h-4 w-4" />,
          duration: 3000,
        });
        break;

      case NotificationType.WEBHOOK_DELETED:
        toast.info(title, {
          id: notificationId,
          description: message,
          icon: <Info className="h-4 w-4" />,
          duration: 3000,
        });
        break;

      case NotificationType.WEBHOOK_FAILED:
        toast.error(title, {
          id: notificationId,
          description: message,
          icon: <XCircle className="h-4 w-4" />,
          duration: 5000,
        });
        break;

      case NotificationType.TASK_CREATED:
      case NotificationType.TASK_UPDATED:
      case NotificationType.TASK_DELETED:
        toast.info(title, {
          id: notificationId,
          description: messageWithRepository,
          duration: 3000,
        });
        break;

      default:
        toast(title, {
          id: notificationId,
          description: message,
          duration: 3000,
        });
    }
  };

  useEffect(() => {
    if (!isHydrated) return;

    if (isConnected) {
      // Skip toast on first successful connection after page load.
      if (!hasSeenInitialConnection.current) {
        hasSeenInitialConnection.current = true;
        return;
      }

      toast.success('Connected', {
        description: 'Real-time notifications enabled',
        duration: 2000,
      });
    }
  }, [isConnected, isHydrated]);

  return <>{children}</>;
}
