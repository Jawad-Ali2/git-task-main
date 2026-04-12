'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

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
  id?: string; // Unique ID for notification
}

interface NotificationContextType {
  notifications: Notification[];
  isConnected: boolean;
  isHydrated: boolean;
  clearNotifications: () => void;
  clearNotification: (id: string) => void;
  addNotification: (notification: Notification) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const STORAGE_KEY = 'notifications-history';
const MAX_NOTIFICATIONS = 50;

// Scan-related notification types that should be grouped
const SCAN_NOTIFICATION_TYPES = [
  NotificationType.SCAN_STARTED,
  NotificationType.SCAN_PROGRESS,
  NotificationType.SCAN_COMPLETED,
  NotificationType.SCAN_FAILED,
];

export function NotificationContextProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 3;

  // Load notifications from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setNotifications(parsed);
      }
    } catch (error) {
      console.error('Failed to load notifications from storage:', error);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('Failed to save notifications to storage:', error);
    }
  }, [notifications]);

  const addNotification = (notification: Notification) => {
    setNotifications((prev) => {
      // Generate unique ID if not provided
      const id = notification.id || `${notification.type}-${Date.now()}-${Math.random()}`;
      const notificationWithId = { ...notification, id };

      // Check if this is a scan notification that should update an existing one
      if (SCAN_NOTIFICATION_TYPES.includes(notification.type) && notification.data?.repoId) {
        const repoId = notification.data.repoId;
        
        // Find existing scan notification for this repo
        const existingIndex = prev.findIndex(
          n => SCAN_NOTIFICATION_TYPES.includes(n.type) && n.data?.repoId === repoId
        );

        if (existingIndex !== -1) {
          // Update existing notification in place
          const updated = [...prev];
          updated[existingIndex] = notificationWithId;
          return updated;
        }
      }

      // Add new notification at the beginning
      const updated = [notificationWithId, ...prev].slice(0, MAX_NOTIFICATIONS);
      return updated;
    });
  };

  const clearNotifications = () => {
    setNotifications([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const clearNotification = (id: string) => {
    setNotifications((prev) => prev.filter(n => n.id !== id));
  };

  const connect = () => {
    if (eventSourceRef.current) {
      return; // Already connected
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const eventSource = new EventSource(`${apiUrl}/notifications/stream`, {
        withCredentials: true,
      });

      eventSource.onopen = () => {
        console.log('📡 Connected to notification stream');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
      };

      eventSource.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data) as Notification;
          
          // Skip the initial connection message
          if (notification.type === 'connected' as any) {
            return;
          }
          
          addNotification(notification);
          console.log('📬 Notification received:', notification);
        } catch (err) {
          console.error('Failed to parse notification:', err);
        }
      };

      eventSource.onerror = (error) => {
        // SSE errors are common during auth issues or network problems
        // Only log in development to reduce console noise
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ SSE connection issue (may be due to auth or network)');
        }
        setIsConnected(false);

        // Cleanup and attempt reconnect
        eventSource.close();
        eventSourceRef.current = null;

        // Only attempt reconnect if under max attempts
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(5000 * reconnectAttemptsRef.current, 30000); // Exponential backoff, max 30s
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (process.env.NODE_ENV === 'development') {
              console.log(`🔄 Reconnecting... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
            }
            connect();
          }, delay);
        }
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error('Failed to establish SSE connection:', error);
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

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        isConnected,
        isHydrated,
        clearNotifications,
        clearNotification,
        addNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationContextProvider');
  }
  return context;
}
