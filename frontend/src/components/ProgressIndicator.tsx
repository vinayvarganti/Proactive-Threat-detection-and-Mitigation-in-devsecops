import React from 'react';

export type OperationType = 'scan' | 'download' | 'ai-processing' | 'commit';

export interface ProgressIndicatorProps {
  type: OperationType;
  isVisible: boolean;
  message?: string;
  progress?: number; // 0-100 for progress bar, undefined for spinner
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  type,
  isVisible,
  message,
  progress
}) => {
  if (!isVisible) {
    return null;
  }

  const getDefaultMessage = (): string => {
    switch (type) {
      case 'scan':
        return 'Scanning repository for vulnerabilities...';
      case 'download':
        return 'Downloading repository files...';
      case 'ai-processing':
        return 'AI is generating fix proposal...';
      case 'commit':
        return 'Committing changes to GitHub...';
      default:
        return 'Processing...';
    }
  };

  const displayMessage = message || getDefaultMessage();

  return (
    <div 
      className="progress-indicator" 
      data-testid={`progress-indicator-${type}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="progress-content">
        {progress !== undefined ? (
          <div className="progress-bar-container">
            <div 
              className="progress-bar"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : (
          <div className="spinner" aria-label="Loading spinner" />
        )}
        <p className="progress-message">{displayMessage}</p>
      </div>
    </div>
  );
};

export default ProgressIndicator;
