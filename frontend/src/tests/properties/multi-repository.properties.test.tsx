import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import VulnerabilityDashboard from '../../components/VulnerabilityDashboard';
import { Vulnerability, SeverityLevel, VulnerabilityType, Scanner, FixStatus } from '../../services/vulnerabilityService';
import { vulnerabilityService } from '../../services/vulnerabilityService';

// Mock the vulnerability service
jest.mock('../../services/vulnerabilityService', () => ({
  vulnerabilityService: {
    fetchVulnerabilities: jest.fn(),
    fetchScanReport: jest.fn(),
    sortBySeverity: jest.fn((vulns) => vulns),
    filterBySeverity: jest.fn((vulns, severity) => vulns.filter((v: any) => v.severity === severity)),
    filterByFile: jest.fn((vulns, search) => vulns.filter((v: any) => v.filePath.toLowerCase().includes(search.toLowerCase()))),
    filterByRepository: jest.fn((vulns, repoId) => vulns.filter((v: any) => v.repositoryId === repoId))
  },
  SeverityLevel: {} as any,
  VulnerabilityType: {} as any,
  Scanner: {} as any,
  FixStatus: {} as any
}));

describe('Multi-Repository Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Feature: devsecops-platform, Property 44: Repository Context Switching
   * 
   * For any user switching from one repository to another in the dashboard, 
   * the displayed vulnerabilities should update to show only vulnerabilities 
   * from the newly selected repository.
   * 
   * Validates: Requirements 12.5
   */
  it('Property 44: Repository Context Switching', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate multiple repositories with vulnerabilities
        fc.array(
          fc.record({
            repositoryId: fc.string({ minLength: 5, maxLength: 20 }),
            repositoryName: fc.string({ minLength: 3, maxLength: 30 }),
            vulnerabilities: fc.array(
              fc.record({
                id: fc.string({ minLength: 1, maxLength: 50 }),
                type: fc.constantFrom<VulnerabilityType>('code', 'dependency', 'secret'),
                severity: fc.constantFrom<SeverityLevel>('critical', 'high', 'medium', 'low'),
                title: fc.string({ minLength: 5, maxLength: 100 }),
                description: fc.string({ minLength: 10, maxLength: 200 }),
                filePath: fc.string({ minLength: 5, maxLength: 50 }).map(s => `src/${s}.ts`),
                lineNumber: fc.integer({ min: 1, max: 1000 }),
                scanner: fc.constantFrom<Scanner>('semgrep', 'trivy', 'gitleaks'),
                fixStatus: fc.constantFrom<FixStatus>('pending', 'in_progress', 'fixed', 'verified'),
                codeSnippet: fc.string({ minLength: 10, maxLength: 100 })
              }),
              { minLength: 1, maxLength: 10 }
            )
          }),
          { minLength: 2, maxLength: 4 }
        ),
        async (repositories) => {
          // Flatten all vulnerabilities and add repository information
          const allVulnerabilities: Vulnerability[] = repositories.flatMap(repo =>
            repo.vulnerabilities.map(vuln => ({
              ...vuln,
              repositoryId: repo.repositoryId,
              repositoryName: repo.repositoryName
            }))
          );

          // Mock the service to return all vulnerabilities
          (vulnerabilityService.fetchVulnerabilities as jest.Mock).mockResolvedValue(allVulnerabilities);
          (vulnerabilityService.sortBySeverity as jest.Mock).mockReturnValue(allVulnerabilities);

          const user = userEvent.setup();
          const { unmount } = render(<VulnerabilityDashboard />);

          // Wait for initial load
          await waitFor(() => {
            expect(screen.queryByText('Loading vulnerabilities...')).not.toBeInTheDocument();
          }, { timeout: 3000 });

          // Property: Initially, all vulnerabilities should be displayed
          const initialRows = screen.getAllByRole('button', { name: /view details for/i });
          expect(initialRows.length).toBe(allVulnerabilities.length);

          // For each repository, test switching to it
          for (const targetRepo of repositories) {
            // Find and select the repository filter dropdown
            const repoSelect = screen.getByLabelText(/filter by repository/i);
            
            // Switch to the target repository
            await user.selectOptions(repoSelect, targetRepo.repositoryId);

            // Wait for filter to apply
            await waitFor(() => {
              const displayedRows = screen.queryAllByRole('button', { name: /view details for/i });
              
              // Property: Only vulnerabilities from the selected repository should be displayed
              const expectedCount = targetRepo.vulnerabilities.length;
              expect(displayedRows.length).toBe(expectedCount);
            }, { timeout: 2000 });

            // Property: Verify that filterByRepository was called with correct repository ID
            expect(vulnerabilityService.filterByRepository).toHaveBeenCalledWith(
              expect.any(Array),
              targetRepo.repositoryId
            );

            // Property: Verify all displayed vulnerabilities belong to the selected repository
            const displayedVulns = allVulnerabilities.filter(v => v.repositoryId === targetRepo.repositoryId);
            for (const vuln of displayedVulns) {
              // Check that vulnerability title is present in the document
              expect(screen.getByText(vuln.title)).toBeInTheDocument();
            }

            // Property: Verify vulnerabilities from other repositories are NOT displayed
            const otherRepoVulns = allVulnerabilities.filter(v => v.repositoryId !== targetRepo.repositoryId);
            for (const vuln of otherRepoVulns) {
              // Check that vulnerability title is NOT present in the document
              expect(screen.queryByText(vuln.title)).not.toBeInTheDocument();
            }
          }

          // Property: Switching back to "All Repositories" should show all vulnerabilities again
          const repoSelect = screen.getByLabelText(/filter by repository/i);
          await user.selectOptions(repoSelect, 'all');

          await waitFor(() => {
            const displayedRows = screen.queryAllByRole('button', { name: /view details for/i });
            expect(displayedRows.length).toBe(allVulnerabilities.length);
          }, { timeout: 2000 });

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 30000); // Increase timeout for property test

  /**
   * Property: Repository context switching should preserve other filters
   */
  it('should preserve severity and file filters when switching repositories', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            repositoryId: fc.string({ minLength: 5, maxLength: 20 }),
            repositoryName: fc.string({ minLength: 3, maxLength: 30 }),
            vulnerabilities: fc.array(
              fc.record({
                id: fc.string({ minLength: 1, maxLength: 50 }),
                type: fc.constantFrom<VulnerabilityType>('code', 'dependency', 'secret'),
                severity: fc.constantFrom<SeverityLevel>('critical', 'high', 'medium', 'low'),
                title: fc.string({ minLength: 5, maxLength: 100 }),
                description: fc.string({ minLength: 10, maxLength: 200 }),
                filePath: fc.string({ minLength: 5, maxLength: 50 }).map(s => `src/${s}.ts`),
                lineNumber: fc.integer({ min: 1, max: 1000 }),
                scanner: fc.constantFrom<Scanner>('semgrep', 'trivy', 'gitleaks'),
                fixStatus: fc.constantFrom<FixStatus>('pending', 'in_progress', 'fixed', 'verified'),
                codeSnippet: fc.string({ minLength: 10, maxLength: 100 })
              }),
              { minLength: 2, maxLength: 5 }
            )
          }),
          { minLength: 2, maxLength: 3 }
        ),
        fc.constantFrom<SeverityLevel>('critical', 'high', 'medium', 'low'),
        async (repositories, selectedSeverity) => {
          const allVulnerabilities: Vulnerability[] = repositories.flatMap(repo =>
            repo.vulnerabilities.map(vuln => ({
              ...vuln,
              repositoryId: repo.repositoryId,
              repositoryName: repo.repositoryName
            }))
          );

          (vulnerabilityService.fetchVulnerabilities as jest.Mock).mockResolvedValue(allVulnerabilities);
          (vulnerabilityService.sortBySeverity as jest.Mock).mockReturnValue(allVulnerabilities);

          const user = userEvent.setup();
          const { unmount } = render(<VulnerabilityDashboard />);

          await waitFor(() => {
            expect(screen.queryByText('Loading vulnerabilities...')).not.toBeInTheDocument();
          });

          // Apply severity filter first
          const severityButton = screen.getByRole('button', { 
            name: new RegExp(selectedSeverity, 'i') 
          });
          await user.click(severityButton);

          await waitFor(() => {
            expect(vulnerabilityService.filterBySeverity).toHaveBeenCalled();
          });

          // Now switch repository
          const repoSelect = screen.getByLabelText(/filter by repository/i);
          await user.selectOptions(repoSelect, repositories[0].repositoryId);

          await waitFor(() => {
            // Property: Both filters should be applied
            expect(vulnerabilityService.filterBySeverity).toHaveBeenCalled();
            expect(vulnerabilityService.filterByRepository).toHaveBeenCalled();
          });

          // Property: Severity filter button should still be active
          expect(severityButton).toHaveClass('active');

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 20000);

  /**
   * Property: Repository context switching should work with empty repositories
   */
  it('should handle switching to repositories with no vulnerabilities', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          repoWithVulns: fc.record({
            repositoryId: fc.string({ minLength: 5, maxLength: 20 }),
            repositoryName: fc.string({ minLength: 3, maxLength: 30 }),
            vulnerabilities: fc.array(
              fc.record({
                id: fc.string({ minLength: 1, maxLength: 50 }),
                type: fc.constantFrom<VulnerabilityType>('code', 'dependency', 'secret'),
                severity: fc.constantFrom<SeverityLevel>('critical', 'high', 'medium', 'low'),
                title: fc.string({ minLength: 5, maxLength: 100 }),
                description: fc.string({ minLength: 10, maxLength: 200 }),
                filePath: fc.string({ minLength: 5, maxLength: 50 }).map(s => `src/${s}.ts`),
                lineNumber: fc.integer({ min: 1, max: 1000 }),
                scanner: fc.constantFrom<Scanner>('semgrep', 'trivy', 'gitleaks'),
                fixStatus: fc.constantFrom<FixStatus>('pending', 'in_progress', 'fixed', 'verified'),
                codeSnippet: fc.string({ minLength: 10, maxLength: 100 })
              }),
              { minLength: 1, maxLength: 5 }
            )
          }),
          emptyRepo: fc.record({
            repositoryId: fc.string({ minLength: 5, maxLength: 20 }),
            repositoryName: fc.string({ minLength: 3, maxLength: 30 })
          })
        }),
        async ({ repoWithVulns, emptyRepo }) => {
          const allVulnerabilities: Vulnerability[] = repoWithVulns.vulnerabilities.map(vuln => ({
            ...vuln,
            repositoryId: repoWithVulns.repositoryId,
            repositoryName: repoWithVulns.repositoryName
          }));

          (vulnerabilityService.fetchVulnerabilities as jest.Mock).mockResolvedValue(allVulnerabilities);
          (vulnerabilityService.sortBySeverity as jest.Mock).mockReturnValue(allVulnerabilities);

          const user = userEvent.setup();
          const { unmount } = render(<VulnerabilityDashboard />);

          await waitFor(() => {
            expect(screen.queryByText('Loading vulnerabilities...')).not.toBeInTheDocument();
          });

          // Switch to empty repository
          const repoSelect = screen.getByLabelText(/filter by repository/i);
          await user.selectOptions(repoSelect, emptyRepo.repositoryId);

          await waitFor(() => {
            // Property: Should show "no vulnerabilities match" message
            expect(screen.getByText(/no vulnerabilities match the current filters/i)).toBeInTheDocument();
          });

          // Property: Should show clear filters button
          expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();

          // Switch back to repository with vulnerabilities
          await user.selectOptions(repoSelect, repoWithVulns.repositoryId);

          await waitFor(() => {
            // Property: Should show vulnerabilities again
            const displayedRows = screen.queryAllByRole('button', { name: /view details for/i });
            expect(displayedRows.length).toBe(repoWithVulns.vulnerabilities.length);
          });

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 20000);
});

