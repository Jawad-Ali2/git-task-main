import { useEffect, useRef, useState } from 'react';

export enum NotificationType {
  SCAN_STARTED = 'scan:started',
  SCAN_PROGRESS = 'scan:progress',
  SCAN_COMPLETED = 'scan:completed',
  SCAN_FAILED = 'scan:failed',
  REPO_ADDED = 'repo:added',
  REPO_REMOVED = 'repo:removed',
  WEBHOOK_CREATED = 'webhook:created',
  WEBHOOK_DELETED = 'webhook:deleted',
  WEBHOOK_FAILED = 'webhook:failed',
  TASK_CREATED = 'task:created',
  TASK_UPDATED = 'task:updated',
  TASK_DELETED = 'task:deleted',
}

export interface Notification {
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  timestamp: string;
}

interface UseNotificationsOptions {
  onNotification?: (notification: Notification) => void;
  onError?: (error: Error) => void;
  autoConnect?: boolean;
}

export const useNotifications = (options: UseNotificationsOptions = {}) => {
  const { onNotification, onError, autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    if (eventSourceRef.current) {
      return; // Already connected
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const eventSource = new EventSource(`${apiUrl}/notifications/stream`, {
        withCredentials: true, // Important for cookies
      });

      eventSource.onopen = () => {
        console.log('📡 Connected to notification stream');
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data) as Notification;
          
          // Add to notifications list
          setNotifications((prev) => [notification, ...prev].slice(0, 50)); // Keep last 50

          // Call callback if provided
          if (onNotification) {
            onNotification(notification);
          }

          console.log('📬 Notification received:', notification);
        } catch (err) {
          console.error('Failed to parse notification:', err);
        }
      };

      eventSource.onerror = (error) => {
        console.error('❌ SSE Error:', error);
        setIsConnected(false);
        
        if (onError) {
          onError(new Error('Connection error'));
        }

        // Cleanup and attempt reconnect
        eventSource.close();
        eventSourceRef.current = null;

        // Reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          connect();
        }, 5000);
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error('Failed to establish SSE connection:', error);
      if (onError) {
        onError(error as Error);
      }
    }
  };

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      console.log('🔌 Disconnected from notification stream');
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect]);

  return {
    notifications,
    isConnected,
    connect,
    disconnect,
    clearNotifications,
  };
};
