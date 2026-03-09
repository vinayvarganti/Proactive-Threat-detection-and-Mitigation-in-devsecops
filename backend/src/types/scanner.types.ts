export type ScannerType = 'semgrep' | 'trivy' | 'gitleaks';
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';
export type VulnerabilityType = 'code' | 'dependency' | 'secret';

export interface RawVulnerability {
  title: string;
  description: string;
  severity: string;
  filePath: string;
  lineNumber: number;
  codeSnippet: string;
  metadata: Record<string, any>;
}

export interface ScanResult {
  scanner: ScannerType;
  vulnerabilities: RawVulnerability[];
  executionTime: number;
  success: boolean;
  error?: string;
}

export interface Vulnerability {
  id: string;
  type: VulnerabilityType;
  severity: SeverityLevel;
  title: string;
  description: string;
  filePath: string;
  lineNumber: number;
  scanner: ScannerType;
  codeSnippet: string;
  metadata: Record<string, any>;
}

export interface VulnerabilitySummary {
  total: number;
  bySeverity: Record<SeverityLevel, number>;
  byScanner: Record<ScannerType, number>;
}

export interface ScanReport {
  id: string;
  repositoryPath: string;
  timestamp: Date;
  vulnerabilities: Vulnerability[];
  summary: VulnerabilitySummary;
  scanDuration: number;
  scannerResults: {
    semgrep: { success: boolean; count: number; error?: string };
    trivy: { success: boolean; count: number; error?: string };
    gitleaks: { success: boolean; count: number; error?: string };
  };
}
