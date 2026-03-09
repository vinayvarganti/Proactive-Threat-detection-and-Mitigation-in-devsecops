import {
  filterVulnerabilities,
  ProjectVulnerabilities,
  ScannerVulnerabilities,
  Vulnerability,
} from './filterVulnerabilities';

describe('filterVulnerabilities', () => {
  const createVulnerability = (
    severity: 'critical' | 'high' | 'medium' | 'low',
    filePath: string
  ): Vulnerability => ({
    id: `vuln-${Math.random()}`,
    severity,
    title: 'Test Vulnerability',
    filePath,
    lineNumber: 10,
    status: 'open',
    scannerName: 'gitleaks',
  });

  const createScanner = (
    scannerName: 'gitleaks' | 'semgrep' | 'trivy',
    vulnerabilities: Vulnerability[]
  ): ScannerVulnerabilities => {
    const severityBreakdown = {
      critical: vulnerabilities.filter((v) => v.severity === 'critical').length,
      high: vulnerabilities.filter((v) => v.severity === 'high').length,
      medium: vulnerabilities.filter((v) => v.severity === 'medium').length,
      low: vulnerabilities.filter((v) => v.severity === 'low').length,
    };

    return {
      scannerName,
      totalCount: vulnerabilities.length,
      severityBreakdown,
      vulnerabilities,
    };
  };

  const createProject = (
    repositoryName: string,
    scanners: ScannerVulnerabilities[]
  ): ProjectVulnerabilities => {
    const totalVulnerabilities = scanners.reduce((sum, s) => sum + s.totalCount, 0);

    return {
      repositoryId: `repo-${Math.random()}`,
      repositoryName,
      totalVulnerabilities,
      scanners,
    };
  };

  describe('Severity filtering', () => {
    it('should filter by critical severity', () => {
      const vulns = [
        createVulnerability('critical', 'src/app.ts'),
        createVulnerability('high', 'src/utils.ts'),
        createVulnerability('medium', 'src/config.ts'),
      ];
      const scanner = createScanner('gitleaks', vulns);
      const project = createProject('test-repo', [scanner]);

      const result = filterVulnerabilities([project], 'critical', '');

      expect(result).toHaveLength(1);
      expect(result[0].scanners[0].vulnerabilities).toHaveLength(1);
      expect(result[0].scanners[0].vulnerabilities[0].severity).toBe('critical');
    });

    it('should filter by high severity', () => {
      const vulns = [
        createVulnerability('critical', 'src/app.ts'),
        createVulnerability('high', 'src/utils.ts'),
        createVulnerability('high', 'src/config.ts'),
      ];
      const scanner = createScanner('gitleaks', vulns);
      const project = createProject('test-repo', [scanner]);

      const result = filterVulnerabilities([project], 'high', '');

      expect(result).toHaveLength(1);
      expect(result[0].scanners[0].vulnerabilities).toHaveLength(2);
      result[0].scanners[0].vulnerabilities.forEach((v) => {
        expect(v.severity).toBe('high');
      });
    });

    it('should filter by medium severity', () => {
      const vulns = [
        createVulnerability('medium', 'src/app.ts'),
        createVulnerability('low', 'src/utils.ts'),
      ];
      const scanner = createScanner('gitleaks', vulns);
      const project = createProject('test-repo', [scanner]);

      const result = filterVulnerabilities([project], 'medium', '');

      expect(result).toHaveLength(1);
      expect(result[0].scanners[0].vulnerabilities).toHaveLength(1);
      expect(result[0].scanners[0].vulnerabilities[0].severity).toBe('medium');
    });

    it('should filter by low severity', () => {
      const vulns = [
        createVulnerability('low', 'src/app.ts'),
        createVulnerability('low', 'src/utils.ts'),
        createVulnerability('high', 'src/config.ts'),
      ];
      const scanner = createScanner('gitleaks', vulns);
      const project = createProject('test-repo', [scanner]);

      const result = filterVulnerabilities([project], 'low', '');

      expect(result).toHaveLength(1);
      expect(result[0].scanners[0].vulnerabilities).toHaveLength(2);
      result[0].scanners[0].vulnerabilities.forEach((v) => {
        expect(v.severity).toBe('low');
      });
    });

    it('should show all vulnerabilities when severity is "all"', () => {
      const vulns = [
        createVulnerability('critical', 'src/app.ts'),
        createVulnerability('high', 'src/utils.ts'),
        createVulnerability('medium', 'src/config.ts'),
        createVulnerability('low', 'src/test.ts'),
      ];
      const scanner = createScanner('gitleaks', vulns);
      const project = createProject('test-repo', [scanner]);

      const result = filterVulnerabilities([project], 'all', '');

      expect(result).toHaveLength(1);
      expect(result[0].scanners[0].vulnerabilities).toHaveLength(4);
    });
  });

  describe('Search filtering', () => {
    it('should filter by file path search term', () => {
      const vulns = [
        createVulnerability('critical', 'src/app.ts'),
        createVulnerability('high', 'src/utils.ts'),
        createVulnerability('medium', 'tests/config.ts'),
      ];
      const scanner = createScanner('gitleaks', vulns);
      const project = createProject('test-repo', [scanner]);

      const result = filterVulnerabilities([project], 'all', 'src');

      expect(result).toHaveLength(1);
      expect(result[0].scanners[0].vulnerabilities).toHaveLength(2);
      result[0].scanners[0].vulnerabilities.forEach((v) => {
        expect(v.filePath).toContain('src');
      });
    });

    it('should be case-insensitive', () => {
      const vulns = [
        createVulnerability('critical', 'src/App.ts'),
        createVulnerability('high', 'src/Utils.ts'),
      ];
      const scanner = createScanner('gitleaks', vulns);
      const project = createProject('test-repo', [scanner]);

      const resultLower = filterVulnerabilities([project], 'all', 'app');
      const resultUpper = filterVulnerabilities([project], 'all', 'APP');

      expect(resultLower).toHaveLength(1);
      expect(resultUpper).toHaveLength(1);
      expect(resultLower[0].scanners[0].vulnerabilities).toHaveLength(1);
      expect(resultUpper[0].scanners[0].vulnerabilities).toHaveLength(1);
    });

    it('should handle empty search term', () => {
      const vulns = [
        createVulnerability('critical', 'src/app.ts'),
        createVulnerability('high', 'src/utils.ts'),
      ];
      const scanner = createScanner('gitleaks', vulns);
      const project = createProject('test-repo', [scanner]);

      const result = filterVulnerabilities([project], 'all', '');

      expect(result).toHaveLength(1);
      expect(result[0].scanners[0].vulnerabilities).toHaveLength(2);
    });

    it('should handle search term with spaces', () => {
      const vulns = [
        createVulnerability('critical', 'src/app.ts'),
        createVulnerability('high', 'src/utils.ts'),
      ];
      const scanner = createScanner('gitleaks', vulns);
      const project = createProject('test-repo', [scanner]);

      const result = filterVulnerabilities([project], 'all', '  app  ');

      expect(result).toHaveLength(1);
      expect(result[0].scanners[0].vulnerabilities).toHaveLength(1);
      expect(result[0].scanners[0].vulnerabilities[0].filePath).toContain('app');
    });
  });

  describe('Combined filtering', () => {
    it('should apply both severity and search filters', () => {
      const vulns = [
        createVulnerability('critical', 'src/app.ts'),
        createVulnerability('critical', 'tests/app.test.ts'),
        createVulnerability('high', 'src/utils.ts'),
      ];
      const scanner = createScanner('gitleaks', vulns);
      const project = createProject('test-repo', [scanner]);

      const result = filterVulnerabilities([project], 'critical', 'src');

      expect(result).toHaveLength(1);
      expect(result[0].scanners[0].vulnerabilities).toHaveLength(1);
      expect(result[0].scanners[0].vulnerabilities[0].severity).toBe('critical');
      expect(result[0].scanners[0].vulnerabilities[0].filePath).toContain('src');
    });

    it('should return empty array when no matches', () => {
      const vulns = [
        createVulnerability('critical', 'src/app.ts'),
        createVulnerability('high', 'src/utils.ts'),
      ];
      const scanner = createScanner('gitleaks', vulns);
      const project = createProject('test-repo', [scanner]);

      const result = filterVulnerabilities([project], 'low', '');

      expect(result).toHaveLength(0);
    });
  });

  describe('Project and scanner removal', () => {
    it('should remove projects with no matching vulnerabilities', () => {
      const vulns1 = [createVulnerability('critical', 'src/app.ts')];
      const vulns2 = [createVulnerability('high', 'src/utils.ts')];
      const scanner1 = createScanner('gitleaks', vulns1);
      const scanner2 = createScanner('semgrep', vulns2);
      const project1 = createProject('repo1', [scanner1]);
      const project2 = createProject('repo2', [scanner2]);

      const result = filterVulnerabilities([project1, project2], 'critical', '');

      expect(result).toHaveLength(1);
      expect(result[0].repositoryName).toBe('repo1');
    });

    it('should remove scanner sections with no matching vulnerabilities', () => {
      const vulns1 = [createVulnerability('critical', 'src/app.ts')];
      const vulns2 = [createVulnerability('high', 'src/utils.ts')];
      const scanner1 = createScanner('gitleaks', vulns1);
      const scanner2 = createScanner('semgrep', vulns2);
      const project = createProject('test-repo', [scanner1, scanner2]);

      const result = filterVulnerabilities([project], 'critical', '');

      expect(result).toHaveLength(1);
      expect(result[0].scanners).toHaveLength(1);
      expect(result[0].scanners[0].scannerName).toBe('gitleaks');
    });
  });

  describe('Count recalculation', () => {
    it('should recalculate scanner total count after filtering', () => {
      const vulns = [
        createVulnerability('critical', 'src/app.ts'),
        createVulnerability('high', 'src/utils.ts'),
        createVulnerability('medium', 'src/config.ts'),
      ];
      const scanner = createScanner('gitleaks', vulns);
      const project = createProject('test-repo', [scanner]);

      const result = filterVulnerabilities([project], 'critical', '');

      expect(result[0].scanners[0].totalCount).toBe(1);
    });

    it('should recalculate severity breakdown after filtering', () => {
      const vulns = [
        createVulnerability('critical', 'src/app.ts'),
        createVulnerability('critical', 'src/main.ts'),
        createVulnerability('high', 'src/utils.ts'),
      ];
      const scanner = createScanner('gitleaks', vulns);
      const project = createProject('test-repo', [scanner]);

      const result = filterVulnerabilities([project], 'critical', '');

      expect(result[0].scanners[0].severityBreakdown.critical).toBe(2);
      expect(result[0].scanners[0].severityBreakdown.high).toBe(0);
      expect(result[0].scanners[0].severityBreakdown.medium).toBe(0);
      expect(result[0].scanners[0].severityBreakdown.low).toBe(0);
    });

    it('should recalculate project total vulnerabilities after filtering', () => {
      const vulns1 = [
        createVulnerability('critical', 'src/app.ts'),
        createVulnerability('high', 'src/utils.ts'),
      ];
      const vulns2 = [
        createVulnerability('critical', 'src/config.ts'),
        createVulnerability('medium', 'src/test.ts'),
      ];
      const scanner1 = createScanner('gitleaks', vulns1);
      const scanner2 = createScanner('semgrep', vulns2);
      const project = createProject('test-repo', [scanner1, scanner2]);

      const result = filterVulnerabilities([project], 'critical', '');

      expect(result[0].totalVulnerabilities).toBe(2);
    });
  });

  describe('Special characters in search', () => {
    it('should handle special characters in file paths', () => {
      const vulns = [
        createVulnerability('critical', 'src/app-config.ts'),
        createVulnerability('high', 'src/utils_helper.ts'),
        createVulnerability('medium', 'src/test.config.ts'),
      ];
      const scanner = createScanner('gitleaks', vulns);
      const project = createProject('test-repo', [scanner]);

      const result = filterVulnerabilities([project], 'all', 'config');

      expect(result).toHaveLength(1);
      expect(result[0].scanners[0].vulnerabilities).toHaveLength(2);
    });

    it('should handle dots in search term', () => {
      const vulns = [
        createVulnerability('critical', 'src/app.ts'),
        createVulnerability('high', 'src/app.js'),
      ];
      const scanner = createScanner('gitleaks', vulns);
      const project = createProject('test-repo', [scanner]);

      const result = filterVulnerabilities([project], 'all', '.ts');

      expect(result).toHaveLength(1);
      expect(result[0].scanners[0].vulnerabilities).toHaveLength(1);
      expect(result[0].scanners[0].vulnerabilities[0].filePath).toContain('.ts');
    });
  });
});
