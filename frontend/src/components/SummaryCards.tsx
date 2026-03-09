import React from 'react';
import './SummaryCards.css';

export interface SummaryData {
  totalProjects: number;
  totalVulnerabilities: number;
  criticalCount: number;
  highCount: number;
}

export interface SummaryCardsProps {
  summary: SummaryData;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  return (
    <div className="summary-cards" role="region" aria-label="Vulnerability summary statistics">
      <div className="summary-card" data-testid="summary-card-projects">
        <div className="summary-card-icon" aria-hidden="true">📁</div>
        <div className="summary-card-content">
          <h3 className="summary-card-label">Total Projects</h3>
          <p className="summary-card-value" aria-label={`${summary.totalProjects} projects scanned`}>
            {summary.totalProjects}
          </p>
        </div>
      </div>

      <div className="summary-card" data-testid="summary-card-vulnerabilities">
        <div className="summary-card-icon" aria-hidden="true">🔍</div>
        <div className="summary-card-content">
          <h3 className="summary-card-label">Total Vulnerabilities</h3>
          <p className="summary-card-value" aria-label={`${summary.totalVulnerabilities} total vulnerabilities`}>
            {summary.totalVulnerabilities}
          </p>
        </div>
      </div>

      <div className="summary-card summary-card-critical" data-testid="summary-card-critical">
        <div className="summary-card-icon" aria-hidden="true">🔴</div>
        <div className="summary-card-content">
          <h3 className="summary-card-label">Critical</h3>
          <p className="summary-card-value" aria-label={`${summary.criticalCount} critical vulnerabilities`}>
            {summary.criticalCount}
          </p>
        </div>
      </div>

      <div className="summary-card summary-card-high" data-testid="summary-card-high">
        <div className="summary-card-icon" aria-hidden="true">🟠</div>
        <div className="summary-card-content">
          <h3 className="summary-card-label">High</h3>
          <p className="summary-card-value" aria-label={`${summary.highCount} high severity vulnerabilities`}>
            {summary.highCount}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SummaryCards;
