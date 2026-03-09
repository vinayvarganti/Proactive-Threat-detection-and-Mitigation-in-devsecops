import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import { NotificationProvider, useNotification } from '../../contexts/NotificationContext';
import { NotificationType } from '../../components/Notification';

// Test component that uses the notification hook
const TestComponent: React.FC<{
  onNotificationShown?: (id: string) => void;
}> = ({ onNotificationShown }) => {
  const {
    showNotification,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    dismissNotification
  } = useNotification();

  return (
    <div>
      <button
        onClick={() => {
          const id = showNotification('success', 'Test notification');
          onNotificationShown?.(id);
        }}
        data-testid="show-notification"
      >
        Show Notification
      </button>
      <button
        onClick={() => {
          const id = showSuccess('Success message');
          onNotificationShown?.(id);
        }}
        data-testid="show-success"
      >
        Show Success
      </button>
      <button
        onClick={() => {
          const id = showError('Error message');
          onNotificationShown?.(id);
        }}
        data-testid="show-error"
      >
        Show Error
      </button>
      <button
        onClick={() => {
          const id = showInfo('Info message');
          onNotificationShown?.(id);
        }}
        data-testid="show-info"
      >
        Show Info
      </button>
      <button
        onClick={() => {
          const id = showWarning('Warning message');
          onNotificationShown?.(id);
        }}
        data-testid="show-warning"
      >
        Show Warning
      </button>
    </div>
  );
};

describe('Notification Property-Based Tests', () => {
  /**
   * Feature: devsecops-platform, Property 42: Operation Completion Notifications
   * 
   * For any completed operation (successful or failed), the platform should display 
   * a notification indicating success or failure with relevant details.
   * 
   * Validates: Requirements 11.5
   */
  it('Property 42: Operation Completion Notifications', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary notification types
        fc.constantFrom<NotificationType>('success', 'error', 'info', 'warning'),
        // Generate arbitrary messages
        fc.string({ minLength: 10, maxLength: 200 }),
        // Generate arbitrary durations (or undefined for no auto-dismiss)
        fc.option(fc.integer({ min: 100, max: 10000 }), { nil: undefined }),
        async (
          notificationType: NotificationType,
          message: string,
          duration: number | undefined
        ) => {
          let notificationId: string | undefined;

          const TestWrapper: React.FC = () => {
            const { showNotification } = useNotification();

            React.useEffect(() => {
              notificationId = showNotification(notificationType, message, duration);
            }, []);

            return <div data-testid="test-wrapper" />;
          };

          const { unmount } = render(
            <NotificationProvider>
              <TestWrapper />
            </NotificationProvider>
          );

          // Property: Notification must be displayed immediately after operation completion
          await waitFor(
            () => {
              const container = screen.getByTestId('notification-container');
              expect(container).toBeInTheDocument();
            },
            { timeout: 1000 }
          );

          // Property: Notification must contain the message
          expect(screen.getByText(message)).toBeInTheDocument();

          // Property: Notification must have proper ARIA attributes
          const notifications = screen.getAllByRole('alert');
          expect(notifications.length).toBeGreaterThan(0);
          
          const notification = notifications[0];
          expect(notification).toHaveAttribute('aria-live', 'assertive');

          // Property: Notification must have the correct type class
          expect(notification).toHaveClass(`notification-${notificationType}`);

          // Property: Notification must have a dismiss button
          const dismissButton = screen.getByLabelText('Dismiss notification');
          expect(dismissButton).toBeInTheDocument();

          // Property: If duration is set, notification should auto-dismiss
          if (duration) {
            await waitFor(
              () => {
                expect(screen.queryByText(message)).not.toBeInTheDocument();
              },
              { timeout: duration + 1000 }
            );
          }

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 60000); // Increase timeout for property test with auto-dismiss

  /**
   * Property: Notifications should be dismissible by user action
   */
  it('should allow manual dismissal of notifications', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<NotificationType>('success', 'error', 'info', 'warning'),
        fc.string({ minLength: 10, maxLength: 200 }),
        async (notificationType: NotificationType, message: string) => {
          const TestWrapper: React.FC = () => {
            const { showNotification } = useNotification();

            React.useEffect(() => {
              // Use a long duration to ensure it doesn't auto-dismiss during test
              showNotification(notificationType, message, 30000);
            }, []);

            return <div data-testid="test-wrapper" />;
          };

          const user = userEvent.setup();
          const { unmount } = render(
            <NotificationProvider>
              <TestWrapper />
            </NotificationProvider>
          );

          // Wait for notification to appear
          await waitFor(() => {
            expect(screen.getByText(message)).toBeInTheDocument();
          });

          // Property: Clicking dismiss button should remove the notification
          const dismissButton = screen.getByLabelText('Dismiss notification');
          await user.click(dismissButton);

          await waitFor(() => {
            expect(screen.queryByText(message)).not.toBeInTheDocument();
          });

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 30000);

  /**
   * Property: Multiple notifications should be displayed simultaneously
   */
  it('should display multiple notifications at once', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom<NotificationType>('success', 'error', 'info', 'warning'),
            message: fc.string({ minLength: 10, maxLength: 100 })
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (notifications) => {
          const TestWrapper: React.FC = () => {
            const { showNotification } = useNotification();

            React.useEffect(() => {
              notifications.forEach((notif) => {
                showNotification(notif.type, notif.message, 30000);
              });
            }, []);

            return <div data-testid="test-wrapper" />;
          };

          const { unmount } = render(
            <NotificationProvider>
              <TestWrapper />
            </NotificationProvider>
          );

          // Property: All notifications should be displayed
          await waitFor(() => {
            notifications.forEach((notif) => {
              expect(screen.getByText(notif.message)).toBeInTheDocument();
            });
          });

          // Property: Number of displayed notifications should match
          const displayedNotifications = screen.getAllByRole('alert');
          expect(displayedNotifications.length).toBe(notifications.length);

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 30000);

  /**
   * Property: Notification helper methods should work correctly
   */
  it('should provide convenience methods for each notification type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 200 }),
        async (message: string) => {
          const user = userEvent.setup();
          const { unmount } = render(
            <NotificationProvider>
              <TestComponent />
            </NotificationProvider>
          );

          // Test showSuccess
          const successButton = screen.getByTestId('show-success');
          await user.click(successButton);
          await waitFor(() => {
            const successNotif = screen.getByText('Success message');
            expect(successNotif.closest('.notification')).toHaveClass('notification-success');
          });

          // Test showError
          const errorButton = screen.getByTestId('show-error');
          await user.click(errorButton);
          await waitFor(() => {
            const errorNotif = screen.getByText('Error message');
            expect(errorNotif.closest('.notification')).toHaveClass('notification-error');
          });

          // Test showInfo
          const infoButton = screen.getByTestId('show-info');
          await user.click(infoButton);
          await waitFor(() => {
            const infoNotif = screen.getByText('Info message');
            expect(infoNotif.closest('.notification')).toHaveClass('notification-info');
          });

          // Test showWarning
          const warningButton = screen.getByTestId('show-warning');
          await user.click(warningButton);
          await waitFor(() => {
            const warningNotif = screen.getByText('Warning message');
            expect(warningNotif.closest('.notification')).toHaveClass('notification-warning');
          });

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 15000);

  /**
   * Property: Notifications should have appropriate icons
   */
  it('should display correct icons for each notification type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<NotificationType>('success', 'error', 'info', 'warning'),
        fc.string({ minLength: 10, maxLength: 200 }),
        async (notificationType: NotificationType, message: string) => {
          const TestWrapper: React.FC = () => {
            const { showNotification } = useNotification();

            React.useEffect(() => {
              showNotification(notificationType, message, 30000);
            }, []);

            return <div data-testid="test-wrapper" />;
          };

          const { unmount, container } = render(
            <NotificationProvider>
              <TestWrapper />
            </NotificationProvider>
          );

          await waitFor(() => {
            expect(screen.getByText(message)).toBeInTheDocument();
          });

          // Property: Each notification type should have an icon
          const icon = container.querySelector('.notification-icon');
          expect(icon).toBeInTheDocument();
          expect(icon?.textContent).toBeTruthy();

          // Property: Icon should be hidden from screen readers
          expect(icon).toHaveAttribute('aria-hidden', 'true');

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 30000);
});

