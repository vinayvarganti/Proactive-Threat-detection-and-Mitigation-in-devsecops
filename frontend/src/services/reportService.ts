import axios from 'axios';
import { ScanReport, VulnerabilitySummary } from './vulnerabilityService';

export interface ReportSummary {
  id: string;
  repositoryId: string;
  repositoryName: string;
  repositoryFullName: string;
  timestamp: Date;
  summary: VulnerabilitySummary;
  scanDuration: number;
  scannerResults: {
    semgrep: { success: boolean; count: number; error?: string };
    trivy: { success: boolean; count: number; error?: string };
    gitleaks: { success: boolean; count: number; error?: string };
  };
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    suggestedAction?: string;
  };
  timestamp: Date;
  requestId: string;
}

class ReportService {
  private baseURL = '/api/reports';

  /**
   * Fetches all scan reports for the authenticated user
   * Optionally filters by repository ID
   */
  async fetchReports(repositoryId?: string): Promise<ReportSummary[]> {
    try {
      const params = new URLSearchParams();
      if (repositoryId) {
        params.append('repositoryId', repositoryId);
      }

      const url = params.toString() ? `${this.baseURL}?${params.toString()}` : this.baseURL;
      const response = await axios.get<{ reports: ReportSummary[] }>(url);
      
      // Convert timestamp strings to Date objects
      return response.data.reports.map(report => ({
        ...report,
        timestamp: new Date(report.timestamp)
      }));
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data as ErrorResponse;
        throw new Error(errorData.error.message || 'Failed to fetch reports');
      }
      throw new Error('Failed to fetch reports');
    }
  }

  /**
   * Fetches a specific scan report by ID with full details
   */
  async fetchReportById(reportId: string): Promise<ScanReport> {
    try {
      const response = await axios.get<{ report: ScanReport }>(`${this.baseURL}/${reportId}`);
      
      // Convert timestamp string to Date object
      const report = response.data.report;
      return {
        ...report,
        timestamp: new Date(report.timestamp)
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data as ErrorResponse;
        throw new Error(errorData.error.message || 'Failed to fetch report');
      }
      throw new Error('Failed to fetch report');
    }
  }
}

export const reportService = new ReportService();
