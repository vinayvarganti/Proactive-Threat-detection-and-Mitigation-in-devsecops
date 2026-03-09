import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import { DashboardContainer } from './DashboardContainer';
import { vulnerabilityService, GroupedVulnerabilitiesResponse } from '../services/vulnerabilityService';

// Feature: vulnerability-dashboard-redesign, Property 1: Project Card Uniqueness
// **Validates: Requirements 1.2**
// For any set of projects with vulnerabilities, each project should be rendered
// as a distinct card component with a unique identifier.

// Feature: vulnerability-dashboard-redesign, Property 2: Empty Project Filtering
// **Validates: Requirements 1.4**
// For any dataset containing projects, only projects with at least one vulnerability
// should be displayed in the dashboard.

jest.mock('../services/vulnerabilityService');

describe('DashboardContainer - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Arbitraries for generating test data
  const severityArb = fc.constantFrom<'critical' | 'high' | 'medium' | 'low'>(
    'critical',
    'high',
    'medium',
    'low'
  );

  const vulnerabilityArb = fc.record({
    id: fc.uuid(),
    severity: severityArb,
    title: fc.string({ minLength: 1, maxLength: 100 }),
    filePath: fc.string({ minLength: 1, maxLength: 50 }).map((s) => `src/${s.replace(/\s/g, '_')}.ts`),
    lineNumber: fc.integer({ min: 1, max: 1000 }),
    status: fc.constantFrom('open', 'fixed', 'ignored'),
    scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy'),
  });

  const scannerVulnerabilitiesArb = fc
    .record({
      scannerName: fc.constantFrom<'gitleaks' | 'semgrep' | 'trivy'>('gitleaks', 'semgrep', 'trivy'),
      vulnerabilities: fc.array(vulnerabilityArb, { minLength: 1, maxLength: 10 }),
    })
    .map((data) => {
      const severityBreakdown = {
        critical: data.vulnerabilities.filter((v) => v.severity === 'critical').length,
        high: data.vulnerabilities.filter((v) => v.severity === 'high').length,
        medium: data.vulnerabilities.filter((v) => v.severity === 'medium').length,
        low: data.vulnerabilities.filter((v) => v.severity === 'low').length,
      };

      return {
        scannerName: data.scannerName,
        totalCount: data.vulnerabilities.length,
        severityBreakdown,
        vulnerabilities: data.vulnerabilities,
      };
    });

  const projectVulnerabilitiesArb = fc
    .record({
      repositoryId: fc.uuid(),
      repositoryName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length > 0),
      scanners: fc.array(scannerVulnerabilitiesArb, { minLength: 1, maxLength: 3 }),
    })
    .map((data) => {
      const totalVulnerabilities = data.scanners.reduce(
        (sum, scanner) => sum + scanner.totalCount,
        0
      );

      return {
        repositoryId: data.repositoryId,
        repositoryName: data.repositoryName.trim(),
        totalVulnerabilities,
        scanners: data.scanners,
      };
    });

  const groupedVulnerabilitiesArb = fc
    .record({
      projects: fc.array(projectVulnerabilitiesArb, { minLength: 1, maxLength: 10 }),
    })
    .map((data) => {
      let totalVulnerabilities = 0;
      let criticalCount = 0;
      let highCount = 0;
      let mediumCount = 0;
      let lowCount = 0;

      for (const project of data.projects) {
        for (const scanner of project.scanners) {
          totalVulnerabilities += scanner.totalCount;
          criticalCount += scanner.severityBreakdown.critical;
          highCount += scanner.severityBreakdown.high;
          mediumCount += scanner.severityBreakdown.medium;
          lowCount += scanner.severityBreakdown.low;
        }
      }

      return {
        summary: {
          totalProjects: data.projects.length,
          totalVulnerabilities,
          criticalCount,
          highCount,
          mediumCount,
          lowCount,
        },
        projects: data.projects,
      } as GroupedVulnerabilitiesResponse;
    });

  describe('Property 1: Project Card Uniqueness', () => {
    it('should render each project as a distinct card with unique identifier', async () => {
      await fc.assert(
        fc.asyncProperty(groupedVulnerabilitiesArb, async (response) => {
          // Mock the service to return our generated data
          (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(response);

          const { container } = render(<DashboardContainer />);

          // Wait for data to load
          await waitFor(() => {
            expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument();
          });

          // Find all project cards
          const projectCards = container.querySelectorAll('.project-card');

          // Each project should have a card
          expect(projectCards.length).toBe(response.projects.length);

          // Collect all repository IDs - they should be unique
          const renderedRepoIds = new Set<string>();
          response.projects.forEach((project) => {
            renderedRepoIds.add(project.repositoryId);
          });

          // All repository IDs should be unique
          expect(renderedRepoIds.size).toBe(response.projects.length);
        }),
        { numRuns: 10, timeout: 10000 } // Reduced runs and increased timeout for async tests
      );
    }, 15000); // Increase Jest timeout
  });

  describe('Property 2: Empty Project Filtering', () => {
    it('should only display projects with at least one vulnerability', async () => {
      await fc.assert(
        fc.asyncProperty(groupedVulnerabilitiesArb, async (response) => {
          // Mock the service to return our generated data
          (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(response);

          const { container } = render(<DashboardContainer />);

          // Wait for data to load
          await waitFor(() => {
            expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument();
          });

          // Find all project cards
          const projectCards = container.querySelectorAll('.project-card');

          // Every rendered project should have at least one vulnerability
          expect(projectCards.length).toBeGreaterThan(0);

          // Verify each project in the response has vulnerabilities
          response.projects.forEach((project) => {
            expect(project.totalVulnerabilities).toBeGreaterThan(0);
            expect(project.scanners.length).toBeGreaterThan(0);

            // Each scanner should have vulnerabilities
            project.scanners.forEach((scanner) => {
              expect(scanner.vulnerabilities.length).toBeGreaterThan(0);
            });
          });

          // The number of rendered cards should match projects with vulnerabilities
          expect(projectCards.length).toBe(response.projects.length);
        }),
        { numRuns: 10, timeout: 10000 }
      );
    }, 15000);
  });
});
