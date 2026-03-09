import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import ProgressIndicator, { OperationType } from '../../components/ProgressIndicator';

describe('Progress Indicator Property-Based Tests', () => {
  /**
   * Feature: devsecops-platform, Property 41: Operation Progress Indicators
   * 
   * For any long-running operation (scan, download, AI fix, commit), the UI should 
   * display a progress indicator or loading state while the operation is in progress.
   * 
   * Validates: Requirements 11.1, 11.2, 11.3, 11.4
   */
  it('Property 41: Operation Progress Indicators', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary operation types
        fc.constantFrom<OperationType>('scan', 'download', 'ai-processing', 'commit'),
        // Generate arbitrary visibility states
        fc.boolean(),
        // Generate arbitrary custom messages
        fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: undefined }),
        // Generate arbitrary progress values (0-100 or undefined for spinner)
        fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
        async (
          operationType: OperationType,
          isVisible: boolean,
          customMessage: string | undefined,
          progress: number | undefined
        ) => {
          const { unmount, container } = render(
            <ProgressIndicator
              type={operationType}
              isVisible={isVisible}
              message={customMessage}
              progress={progress}
            />
          );

          if (isVisible) {
            // Property: Progress indicator must be visible when isVisible is true
            const progressIndicator = screen.getByTestId(`progress-indicator-${operationType}`);
            expect(progressIndicator).toBeInTheDocument();

            // Property: Progress indicator must have proper ARIA attributes
            expect(progressIndicator).toHaveAttribute('role', 'status');
            expect(progressIndicator).toHaveAttribute('aria-live', 'polite');
            expect(progressIndicator).toHaveAttribute('aria-busy', 'true');

            // Property: A message must be displayed
            const messageElement = container.querySelector('.progress-message');
            expect(messageElement).toBeInTheDocument();
            expect(messageElement?.textContent).toBeTruthy();

            if (progress !== undefined) {
              // Property: When progress is defined, a progress bar must be shown
              const progressBar = container.querySelector('.progress-bar');
              expect(progressBar).toBeInTheDocument();
              expect(progressBar).toHaveAttribute('role', 'progressbar');
              expect(progressBar).toHaveAttribute('aria-valuenow', progress.toString());
              expect(progressBar).toHaveAttribute('aria-valuemin', '0');
              expect(progressBar).toHaveAttribute('aria-valuemax', '100');

              // Property: Progress bar width should match the progress value
              const style = window.getComputedStyle(progressBar as Element);
              expect(progressBar).toHaveStyle({ width: `${progress}%` });

              // Property: Spinner should not be shown when progress bar is shown
              const spinner = container.querySelector('.spinner');
              expect(spinner).not.toBeInTheDocument();
            } else {
              // Property: When progress is undefined, a spinner must be shown
              const spinner = container.querySelector('.spinner');
              expect(spinner).toBeInTheDocument();
              expect(spinner).toHaveAttribute('aria-label', 'Loading spinner');

              // Property: Progress bar should not be shown when spinner is shown
              const progressBar = container.querySelector('.progress-bar');
              expect(progressBar).not.toBeInTheDocument();
            }

            // Property: Custom message should be displayed if provided
            if (customMessage) {
              expect(screen.getByText(customMessage)).toBeInTheDocument();
            }
          } else {
            // Property: Progress indicator must not be visible when isVisible is false
            const progressIndicator = screen.queryByTestId(`progress-indicator-${operationType}`);
            expect(progressIndicator).not.toBeInTheDocument();
          }

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 30000); // Increase timeout for property test with 20 runs

  /**
   * Property: Progress indicators should display appropriate default messages
   */
  it('should display correct default messages for each operation type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<OperationType>('scan', 'download', 'ai-processing', 'commit'),
        async (operationType: OperationType) => {
          const { unmount } = render(
            <ProgressIndicator
              type={operationType}
              isVisible={true}
            />
          );

          // Property: Each operation type should have a meaningful default message
          const expectedMessages: Record<OperationType, string> = {
            'scan': 'Scanning repository for vulnerabilities...',
            'download': 'Downloading repository files...',
            'ai-processing': 'AI is generating fix proposal...',
            'commit': 'Committing changes to GitHub...'
          };

          expect(screen.getByText(expectedMessages[operationType])).toBeInTheDocument();

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 10000);

  /**
   * Property: Progress bar values should be constrained to valid range
   */
  it('should handle progress values correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<OperationType>('scan', 'download', 'ai-processing', 'commit'),
        fc.integer({ min: 0, max: 100 }),
        async (operationType: OperationType, progress: number) => {
          const { unmount, container } = render(
            <ProgressIndicator
              type={operationType}
              isVisible={true}
              progress={progress}
            />
          );

          const progressBar = container.querySelector('.progress-bar');
          expect(progressBar).toBeInTheDocument();

          // Property: Progress value should be within valid range
          const ariaValueNow = progressBar?.getAttribute('aria-valuenow');
          const numericValue = parseInt(ariaValueNow || '0', 10);
          expect(numericValue).toBeGreaterThanOrEqual(0);
          expect(numericValue).toBeLessThanOrEqual(100);

          // Property: Progress bar width should match the progress value
          expect(progressBar).toHaveStyle({ width: `${progress}%` });

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 15000);

  /**
   * Property: Progress indicators should be accessible
   */
  it('should maintain accessibility attributes for all configurations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<OperationType>('scan', 'download', 'ai-processing', 'commit'),
        fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
        fc.option(fc.string({ minLength: 5, maxLength: 100 }), { nil: undefined }),
        async (
          operationType: OperationType,
          progress: number | undefined,
          message: string | undefined
        ) => {
          const { unmount } = render(
            <ProgressIndicator
              type={operationType}
              isVisible={true}
              progress={progress}
              message={message}
            />
          );

          const progressIndicator = screen.getByTestId(`progress-indicator-${operationType}`);

          // Property: Must have status role for screen readers
          expect(progressIndicator).toHaveAttribute('role', 'status');

          // Property: Must have aria-live for dynamic updates
          expect(progressIndicator).toHaveAttribute('aria-live', 'polite');

          // Property: Must indicate busy state
          expect(progressIndicator).toHaveAttribute('aria-busy', 'true');

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 15000);
});

