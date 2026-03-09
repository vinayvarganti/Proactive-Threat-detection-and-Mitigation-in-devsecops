import React, { useState, useEffect } from 'react';
import { reportService, ReportSummary } from '../services/reportService';
import VulnerabilityDashboard from './VulnerabilityDashboard';
import './ReportHistory.css';

interface ReportHistoryProps {
  repositoryId?: string;
}

const ReportHistory: React.FC<ReportHistoryProps> = ({ repositoryId }) => {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, [repositoryId]);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const fetchedReports = await reportService.fetchReports(repositoryId);
      setReports(fetchedReports);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
      console.error('Report fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReportSelect = (reportId: string) => {
    setSelectedReportId(reportId);
  };

  const handleBackToList = () => {
    setSelectedReportId(null);
  };

  const getSeverityClass = (severity: string): string => {
    return `severity-${severity}`;
  };

  const getStatusSummary = (report: ReportSummary): string => {
    const { byStatus } = report.summary;
    const parts: string[] = [];
    
    if (byStatus.fixed > 0) {
      parts.push(`${byStatus.fixed} fixed`);
    }
    if (byStatus.in_progress > 0) {
      parts.push(`${byStatus.in_progress} in progress`);
    }
    if (byStatus.pending > 0) {
      parts.push(`${byStatus.pending} pending`);
    }
    if (byStatus.verified > 0) {
      parts.push(`${byStatus.verified} verified`);
    }
    
    return parts.length > 0 ? parts.join(', ') : 'No vulnerabilities';
  };

  const getScannerStatus = (report: ReportSummary): string => {
    const { scannerResults } = report;
    const successful = [
      scannerResults.semgrep.success,
      scannerResults.trivy.success,
      scannerResults.gitleaks.success
    ].filter(Boolean).length;
    
    return `${successful}/3 scanners successful`;
  };

  if (selectedReportId) {
    return (
      <div className="report-history-container">
        <div className="back-to-list">
          <button onClick={handleBackToList} className="button-secondary">
            ← Back to Report History
          </button>
        </div>
        <VulnerabilityDashboard reportId={selectedReportId} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="report-history-container">
        <div className="loading" role="status">Loading report history...</div>
      </div>
    );
  }

  return (
    <div className="report-history-container">
      <div className="report-history-header">
        <h2>Scan Report History</h2>
        <div className="report-count">
          {reports.length} {reports.length === 1 ? 'report' : 'reports'}
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
          <button
            onClick={() => setError(null)}
            className="error-dismiss"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {reports.length === 0 ? (
        <div className="no-reports">
          <p>No scan reports found.</p>
          <p>Run a repository scan to generate your first report.</p>
        </div>
      ) : (
        <div className="report-list">
          {reports.map(report => (
            <div
              key={report.id}
              className="report-card"
              onClick={() => handleReportSelect(report.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleReportSelect(report.id);
                }
              }}
              aria-label={`View report for ${report.repositoryName} from ${report.timestamp.toLocaleString()}`}
            >
              <div className="report-card-header">
                <div className="report-repository">
                  <span className="repository-badge-large" title={report.repositoryFullName}>
                    {report.repositoryName}
                  </span>
                </div>
                <div className="report-timestamp">
                  {report.timestamp.toLocaleString()}
                </div>
              </div>

              <div className="report-card-body">
                <div className="report-summary-section">
                  <div className="summary-item">
                    <span className="summary-label">Total Vulnerabilities:</span>
                    <span className="summary-value total-count">{report.summary.total}</span>
                  </div>
                  
                  <div className="summary-item">
                    <span className="summary-label">By Severity:</span>
                    <div className="severity-breakdown">
                      {report.summary.bySeverity.critical > 0 && (
                        <span className={`severity-badge ${getSeverityClass('critical')}`}>
                          Critical: {report.summary.bySeverity.critical}
                        </span>
                      )}
                      {report.summary.bySeverity.high > 0 && (
                        <span className={`severity-badge ${getSeverityClass('high')}`}>
                          High: {report.summary.bySeverity.high}
                        </span>
                      )}
                      {report.summary.bySeverity.medium > 0 && (
                        <span className={`severity-badge ${getSeverityClass('medium')}`}>
                          Medium: {report.summary.bySeverity.medium}
                        </span>
                      )}
                      {report.summary.bySeverity.low > 0 && (
                        <span className={`severity-badge ${getSeverityClass('low')}`}>
                          Low: {report.summary.bySeverity.low}
                        </span>
                      )}
                      {report.summary.total === 0 && (
                        <span className="no-vulnerabilities-badge">None</span>
                      )}
                    </div>
                  </div>

                  <div className="summary-item">
                    <span className="summary-label">Status:</span>
                    <span className="summary-value">{getStatusSummary(report)}</span>
                  </div>
                </div>

                <div className="report-metadata">
                  <div className="metadata-item">
                    <span className="metadata-label">Scan Duration:</span>
                    <span className="metadata-value">{(report.scanDuration / 1000).toFixed(2)}s</span>
                  </div>
                  <div className="metadata-item">
                    <span className="metadata-label">Scanners:</span>
                    <span className="metadata-value">{getScannerStatus(report)}</span>
                  </div>
                </div>
              </div>

              <div className="report-card-footer">
                <button className="view-report-button">
                  View Full Report →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReportHistory;
