import React, { useEffect } from 'react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationProps {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number; // milliseconds, undefined means no auto-dismiss
  onDismiss: (id: string) => void;
}

const Notification: React.FC<NotificationProps> = ({
  id,
  type,
  message,
  duration = 5000,
  onDismiss
}) => {
  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        onDismiss(id);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [id, duration, onDismiss]);

  const handleDismiss = () => {
    onDismiss(id);
  };

  const getIcon = (): string => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '';
    }
  };

  return (
    <div
      className={`notification notification-${type}`}
      data-testid={`notification-${id}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="notification-content">
        <span className="notification-icon" aria-hidden="true">
          {getIcon()}
        </span>
        <p className="notification-message">{message}</p>
        <button
          className="notification-dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default Notification;
