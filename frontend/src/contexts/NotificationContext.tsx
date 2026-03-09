import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Notification, { NotificationType } from '../components/Notification';

export interface NotificationData {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

interface NotificationContextType {
  showNotification: (type: NotificationType, message: string, duration?: number) => string;
  dismissNotification: (id: string) => void;
  showSuccess: (message: string, duration?: number) => string;
  showError: (message: string, duration?: number) => string;
  showInfo: (message: string, duration?: number) => string;
  showWarning: (message: string, duration?: number) => string;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  const showNotification = useCallback(
    (type: NotificationType, message: string, duration?: number): string => {
      const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const notification: NotificationData = {
        id,
        type,
        message,
        duration
      };

      setNotifications((prev) => [...prev, notification]);
      return id;
    },
    []
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  const showSuccess = useCallback(
    (message: string, duration?: number): string => {
      return showNotification('success', message, duration);
    },
    [showNotification]
  );

  const showError = useCallback(
    (message: string, duration?: number): string => {
      return showNotification('error', message, duration);
    },
    [showNotification]
  );

  const showInfo = useCallback(
    (message: string, duration?: number): string => {
      return showNotification('info', message, duration);
    },
    [showNotification]
  );

  const showWarning = useCallback(
    (message: string, duration?: number): string => {
      return showNotification('warning', message, duration);
    },
    [showNotification]
  );

  const value: NotificationContextType = {
    showNotification,
    dismissNotification,
    showSuccess,
    showError,
    showInfo,
    showWarning
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="notification-container" data-testid="notification-container">
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            id={notification.id}
            type={notification.type}
            message={notification.message}
            duration={notification.duration}
            onDismiss={dismissNotification}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
