import React from 'react';
import VulnerabilityTable, { Vulnerability } from './VulnerabilityTable';
import './ScannerSection.css';

export interface SeverityBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ScannerVulnerabilities {
  scannerName: 'gitleaks' | 'semgrep' | 'trivy';
  totalCount: number;
  severityBreakdown: SeverityBreakdown;
  vulnerabilities: Vulnerability[];
}

export interface ScannerSectionProps {
  scanner: ScannerVulnerabilities;
  repositoryId: string;
  isCollapsed: boolean;
  onToggle: () => void;
}

const SEVERITY_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a'
} as const;

const ScannerSection: React.FC<ScannerSectionProps> = ({
  scanner,
  repositoryId,
  isCollapsed,
  onToggle
}) => {
  const sectionId = `${repositoryId}-${scanner.scannerName}`;
  const scannerDisplayName = scanner.scannerName.charAt(0).toUpperCase() + scanner.scannerName.slice(1);

  return (
    <div className="scanner-section" data-testid={`scanner-section-${sectionId}`}>
      <button
        className="scanner-section-header"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        aria-controls={`${sectionId}-content`}
        aria-label={`${scannerDisplayName} scanner section, ${scanner.totalCount} vulnerabilities. Click to ${isCollapsed ? 'expand' : 'collapse'}`}
      >
        <div className="scanner-header-left">
          <span className="scanner-toggle-icon" aria-hidden="true">
            {isCollapsed ? '▶' : '▼'}
          </span>
          <h3 className="scanner-name">{scannerDisplayName}</h3>
          <span className="scanner-total-count" aria-label={`Total: ${scanner.totalCount}`}>
            Total: {scanner.totalCount}
          </span>
        </div>
        
        <div className="severity-breakdown" aria-label="Severity breakdown">
          {scanner.severityBreakdown.critical > 0 && (
            <span 
              className="severity-count"
              style={{ color: SEVERITY_COLORS.critical }}
              aria-label={`Critical: ${scanner.severityBreakdown.critical}`}
            >
              Critical: {scanner.severityBreakdown.critical}
            </span>
          )}
          {scanner.severityBreakdown.high > 0 && (
            <span 
              className="severity-count"
              style={{ color: SEVERITY_COLORS.high }}
              aria-label={`High: ${scanner.severityBreakdown.high}`}
            >
              High: {scanner.severityBreakdown.high}
            </span>
          )}
          {scanner.severityBreakdown.medium > 0 && (
            <span 
              className="severity-count"
              style={{ color: SEVERITY_COLORS.medium }}
              aria-label={`Medium: ${scanner.severityBreakdown.medium}`}
            >
              Medium: {scanner.severityBreakdown.medium}
            </span>
          )}
          {scanner.severityBreakdown.low > 0 && (
            <span 
              className="severity-count"
              style={{ color: SEVERITY_COLORS.low }}
              aria-label={`Low: ${scanner.severityBreakdown.low}`}
            >
              Low: {scanner.severityBreakdown.low}
            </span>
          )}
        </div>
      </button>

      {!isCollapsed && (
        <div 
          id={`${sectionId}-content`}
          className="scanner-section-content"
          role="region"
          aria-label={`${scannerDisplayName} vulnerabilities table`}
        >
          <VulnerabilityTable vulnerabilities={scanner.vulnerabilities} />
        </div>
      )}
    </div>
  );
};

export default ScannerSection;
