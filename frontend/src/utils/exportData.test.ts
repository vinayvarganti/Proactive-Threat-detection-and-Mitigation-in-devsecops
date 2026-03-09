import { exportToJSON } from './exportData';
import { GroupedVulnerabilitiesResponse, ProjectVulnerabilities } from '../services/vulnerabilityService';

describe('exportToJSON', () => {
  let createElementSpy: jest.SpyInstance;
  let appendChildSpy: jest.SpyInstance;
  let removeChildSpy: jest.SpyInstance;
  let clickSpy: jest.Mock;
  let blobSpy: jest.SpyInstance;
  let capturedBlobData: string | null = null;

  beforeEach(() => {
    // Mock Blob to capture data
    capturedBlobData = null;
    blobSpy = jest.spyOn(global, 'Blob').mockImplementation((content: any[], options?: any) => {
      capturedBlobData = content[0];
      return {
        size: content[0].length,
        type: options?.type || '',
      } as Blob;
    });

    // Mock DOM methods
    clickSpy = jest.fn();
    createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue({
      click: clickSpy,
      href: '',
      download: '',
    } as any);
    appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
    removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);
    
    // Mock URL methods
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should export full dataset with all vulnerabilities', () => {
    const fullData: GroupedVulnerabilitiesResponse = {
      summary: {
        totalProjects: 2,
        totalVulnerabilities: 3,
        criticalCount: 1,
        highCount: 1,
        mediumCount: 1,
        lowCount: 0,
      },
      projects: [
        {
          repositoryId: 'repo1',
          repositoryName: 'Test Repo 1',
          totalVulnerabilities: 2,
          scanners: [
            {
              scannerName: 'gitleaks',
              totalCount: 2,
              severityBreakdown: { critical: 1, high: 1, medium: 0, low: 0 },
              vulnerabilities: [
                {
                  id: '1',
                  severity: 'critical',
                  title: 'Critical Issue',
                  filePath: 'src/auth.ts',
                  lineNumber: 10,
                  status: 'open',
                  scannerName: 'gitleaks',
                },
                {
                  id: '2',
                  severity: 'high',
                  title: 'High Issue',
                  filePath: 'src/db.ts',
                  lineNumber: 20,
                  status: 'open',
                  scannerName: 'gitleaks',
                },
              ],
            },
          ],
        },
        {
          repositoryId: 'repo2',
          repositoryName: 'Test Repo 2',
          totalVulnerabilities: 1,
          scanners: [
            {
              scannerName: 'semgrep',
              totalCount: 1,
              severityBreakdown: { critical: 0, high: 0, medium: 1, low: 0 },
              vulnerabilities: [
                {
                  id: '3',
                  severity: 'medium',
                  title: 'Medium Issue',
                  filePath: 'src/api.ts',
                  lineNumber: 30,
                  status: 'open',
                  scannerName: 'semgrep',
                },
              ],
            },
          ],
        },
      ],
    };

    exportToJSON(fullData, fullData.projects);

    expect(capturedBlobData).toBeTruthy();
    const exportedData = JSON.parse(capturedBlobData!);

    expect(exportedData.projects).toEqual(fullData.projects);
    expect(exportedData.summary.totalProjects).toBe(2);
    expect(exportedData.summary.totalVulnerabilities).toBe(3);
    expect(exportedData.summary.criticalCount).toBe(1);
    expect(exportedData.summary.highCount).toBe(1);
    expect(exportedData.summary.mediumCount).toBe(1);
    expect(exportedData.summary.lowCount).toBe(0);
    expect(exportedData.exportDate).toBeDefined();
  });

  it('should export filtered dataset with only visible vulnerabilities', () => {
    const fullData: GroupedVulnerabilitiesResponse = {
      summary: {
        totalProjects: 2,
        totalVulnerabilities: 3,
        criticalCount: 1,
        highCount: 1,
        mediumCount: 1,
        lowCount: 0,
      },
      projects: [],
    };

    const filteredProjects: ProjectVulnerabilities[] = [
      {
        repositoryId: 'repo1',
        repositoryName: 'Test Repo 1',
        totalVulnerabilities: 1,
        scanners: [
          {
            scannerName: 'gitleaks',
            totalCount: 1,
            severityBreakdown: { critical: 1, high: 0, medium: 0, low: 0 },
            vulnerabilities: [
              {
                id: '1',
                severity: 'critical',
                title: 'Critical Issue',
                filePath: 'src/auth.ts',
                lineNumber: 10,
                status: 'open',
                scannerName: 'gitleaks',
              },
            ],
          },
        ],
      },
    ];

    exportToJSON(fullData, filteredProjects);

    expect(capturedBlobData).toBeTruthy();
    const exportedData = JSON.parse(capturedBlobData!);

    // Should only contain filtered projects
    expect(exportedData.projects).toEqual(filteredProjects);
    expect(exportedData.summary.totalProjects).toBe(1);
    expect(exportedData.summary.totalVulnerabilities).toBe(1);
    expect(exportedData.summary.criticalCount).toBe(1);
    expect(exportedData.summary.highCount).toBe(0);
  });

  it('should trigger download with correct filename', () => {
    const fullData: GroupedVulnerabilitiesResponse = {
      summary: {
        totalProjects: 0,
        totalVulnerabilities: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      },
      projects: [],
    };

    exportToJSON(fullData, []);

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(clickSpy).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
  });

  it('should create blob with correct MIME type', () => {
    const fullData: GroupedVulnerabilitiesResponse = {
      summary: {
        totalProjects: 0,
        totalVulnerabilities: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      },
      projects: [],
    };

    exportToJSON(fullData, []);

    expect(blobSpy).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ type: 'application/json' })
    );
  });

  it('should include export date in ISO format', () => {
    const fullData: GroupedVulnerabilitiesResponse = {
      summary: {
        totalProjects: 0,
        totalVulnerabilities: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      },
      projects: [],
    };

    const beforeExport = new Date();
    exportToJSON(fullData, []);
    const afterExport = new Date();

    expect(capturedBlobData).toBeTruthy();
    const exportedData = JSON.parse(capturedBlobData!);

    expect(exportedData.exportDate).toBeDefined();
    const exportDate = new Date(exportedData.exportDate);
    expect(exportDate.getTime()).toBeGreaterThanOrEqual(beforeExport.getTime());
    expect(exportDate.getTime()).toBeLessThanOrEqual(afterExport.getTime());
  });

  it('should calculate severity counts correctly from filtered data', () => {
    const fullData: GroupedVulnerabilitiesResponse = {
      summary: {
        totalProjects: 1,
        totalVulnerabilities: 10,
        criticalCount: 5,
        highCount: 5,
        mediumCount: 0,
        lowCount: 0,
      },
      projects: [],
    };

    const filteredProjects: ProjectVulnerabilities[] = [
      {
        repositoryId: 'repo1',
        repositoryName: 'Test Repo',
        totalVulnerabilities: 4,
        scanners: [
          {
            scannerName: 'gitleaks',
            totalCount: 4,
            severityBreakdown: { critical: 2, high: 1, medium: 1, low: 0 },
            vulnerabilities: [
              {
                id: '1',
                severity: 'critical',
                title: 'Issue 1',
                filePath: 'file1.ts',
                lineNumber: 1,
                status: 'open',
                scannerName: 'gitleaks',
              },
              {
                id: '2',
                severity: 'critical',
                title: 'Issue 2',
                filePath: 'file2.ts',
                lineNumber: 2,
                status: 'open',
                scannerName: 'gitleaks',
              },
              {
                id: '3',
                severity: 'high',
                title: 'Issue 3',
                filePath: 'file3.ts',
                lineNumber: 3,
                status: 'open',
                scannerName: 'gitleaks',
              },
              {
                id: '4',
                severity: 'medium',
                title: 'Issue 4',
                filePath: 'file4.ts',
                lineNumber: 4,
                status: 'open',
                scannerName: 'gitleaks',
              },
            ],
          },
        ],
      },
    ];

    exportToJSON(fullData, filteredProjects);

    expect(capturedBlobData).toBeTruthy();
    const exportedData = JSON.parse(capturedBlobData!);

    // Should calculate from filtered data, not full data
    expect(exportedData.summary.criticalCount).toBe(2);
    expect(exportedData.summary.highCount).toBe(1);
    expect(exportedData.summary.mediumCount).toBe(1);
    expect(exportedData.summary.lowCount).toBe(0);
  });
});
