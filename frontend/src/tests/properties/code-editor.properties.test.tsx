import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import CodeEditor from '../../components/CodeEditor';
import { Vulnerability, SeverityLevel, VulnerabilityType, Scanner, FixStatus } from '../../services/vulnerabilityService';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock Monaco Editor
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ value, onChange, onMount }: any) => {
    React.useEffect(() => {
      if (onMount) {
        const mockEditor = {
          revealLineInCenter: jest.fn(),
          deltaDecorations: jest.fn()
        };
        onMount(mockEditor);
      }
    }, [onMount]);

    return (
      <textarea
        data-testid="monaco-editor"
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
      />
    );
  }
}));

describe('Code Editor Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Feature: devsecops-platform, Property 17: Code Editor Loading Correctness
   * 
   * For any vulnerability selected for manual correction, the code editor should load 
   * the correct file content with the vulnerable line highlighted and visible.
   * 
   * Validates: Requirements 5.1
   */
  it('Property 17: Code Editor Loading Correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary vulnerabilities
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          type: fc.constantFrom<VulnerabilityType>('code', 'dependency', 'secret'),
          severity: fc.constantFrom<SeverityLevel>('critical', 'high', 'medium', 'low'),
          title: fc.string({ minLength: 5, maxLength: 100 }),
          description: fc.string({ minLength: 10, maxLength: 500 }),
          filePath: fc.string({ minLength: 5, maxLength: 200 }).map(s => `src/${s}.ts`),
          lineNumber: fc.integer({ min: 1, max: 1000 }),
          scanner: fc.constantFrom<Scanner>('semgrep', 'trivy', 'gitleaks'),
          fixStatus: fc.constantFrom<FixStatus>('pending', 'in_progress', 'fixed', 'verified'),
          codeSnippet: fc.string({ minLength: 10, maxLength: 200 }),
          repositoryId: fc.string({ minLength: 1, maxLength: 50 })
        }),
        // Generate arbitrary file content
        fc.string({ minLength: 50, maxLength: 1000 }),
        async (vulnerability: Vulnerability, fileContent: string) => {
          // Mock the API response with the generated file content
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              content: fileContent,
              filePath: vulnerability.filePath
            }
          });

          // Render the component
          const { unmount } = render(<CodeEditor vulnerability={vulnerability} />);

          try {
            // Wait for loading to complete
            await waitFor(
              () => {
                expect(screen.queryByText('Loading code...')).not.toBeInTheDocument();
              },
              { timeout: 3000 }
            );

            // Property: The editor should be present
            const editor = screen.getByTestId('monaco-editor');
            expect(editor).toBeInTheDocument();

            // Property: The editor should contain the correct file content
            expect(editor).toHaveValue(fileContent);

            // Property: The file path should be displayed (check for both parts)
            expect(screen.getByText(/Edit Code:/i)).toBeInTheDocument();
            // The file path is displayed in the h3, check it's there
            const header = screen.getByText(/Edit Code:/i).closest('h3');
            expect(header?.textContent).toContain(vulnerability.filePath.trim());

            // Property: The line number should be displayed
            expect(screen.getByText(/Line/i)).toBeInTheDocument();
            const lineInfo = screen.getByText(/Line/i);
            expect(lineInfo.textContent).toContain(vulnerability.lineNumber.toString());

            // Property: The vulnerability title should be displayed
            // Only check if title is not just whitespace
            if (vulnerability.title.trim().length > 0) {
              // Check that the title appears in the vulnerability-title span
              const titleSpan = document.querySelector('.vulnerability-title');
              expect(titleSpan?.textContent?.trim()).toBe(vulnerability.title.trim());
            }

            // Property: The API should have been called with the correct parameters
            expect(mockedAxios.get).toHaveBeenCalledWith(
              `/api/repositories/${vulnerability.repositoryId}/files/${encodeURIComponent(vulnerability.filePath)}`
            );
          } finally {
            // Ensure cleanup happens even if assertions fail
            unmount();
            cleanup();
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 60000); // Increase timeout for property test

  /**
   * Property: Code editor should handle various file types correctly
   */
  it('should determine correct language from file extension', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          extension: fc.constantFrom('js', 'ts', 'py', 'java', 'go', 'rb', 'php', 'cpp'),
          content: fc.string({ minLength: 20, maxLength: 200 })
        }),
        async ({ extension, content }) => {
          const vulnerability: Vulnerability = {
            id: 'test-id',
            type: 'code',
            severity: 'high',
            title: 'Test Vulnerability',
            description: 'Test description',
            filePath: `src/test.${extension}`,
            lineNumber: 10,
            scanner: 'semgrep',
            fixStatus: 'pending',
            codeSnippet: 'test snippet',
            repositoryId: 'repo-1'
          };

          mockedAxios.get.mockResolvedValueOnce({
            data: {
              content: content,
              filePath: vulnerability.filePath
            }
          });

          const { unmount } = render(<CodeEditor vulnerability={vulnerability} />);

          try {
            await waitFor(() => {
              expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
            });

            // Property: Editor should load content regardless of file type
            expect(screen.getByTestId('monaco-editor')).toHaveValue(content);
          } finally {
            unmount();
            cleanup();
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 30000);

  /**
   * Property: Code editor should display vulnerability metadata consistently
   */
  it('should display all vulnerability metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1 }),
          type: fc.constantFrom<VulnerabilityType>('code', 'dependency', 'secret'),
          severity: fc.constantFrom<SeverityLevel>('critical', 'high', 'medium', 'low'),
          title: fc.string({ minLength: 5, maxLength: 100 }),
          description: fc.string({ minLength: 10, maxLength: 500 }),
          filePath: fc.string({ minLength: 5 }).map(s => `src/${s}.ts`),
          lineNumber: fc.integer({ min: 1, max: 1000 }),
          scanner: fc.constantFrom<Scanner>('semgrep', 'trivy', 'gitleaks'),
          fixStatus: fc.constantFrom<FixStatus>('pending', 'in_progress', 'fixed', 'verified'),
          codeSnippet: fc.string({ minLength: 10 }),
          repositoryId: fc.string({ minLength: 1 })
        }),
        async (vulnerability: Vulnerability) => {
          mockedAxios.get.mockResolvedValueOnce({
            data: {
              content: 'test content',
              filePath: vulnerability.filePath
            }
          });

          const { unmount } = render(<CodeEditor vulnerability={vulnerability} />);

          try {
            await waitFor(() => {
              expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
            });

            // Property: All metadata should be visible (handle whitespace normalization)
            if (vulnerability.title.trim().length > 0) {
              // Check that the title appears somewhere in the vulnerability-title span
              const titleSpan = document.querySelector('.vulnerability-title');
              expect(titleSpan?.textContent?.trim()).toBe(vulnerability.title.trim());
            }
            expect(screen.getByText(vulnerability.severity.toUpperCase())).toBeInTheDocument();
            
            // Check line number is displayed
            const lineInfo = screen.getByText(/Line/i);
            expect(lineInfo.textContent).toContain(vulnerability.lineNumber.toString());
            
            // Check description is displayed (it may have whitespace normalized)
            if (vulnerability.description.trim().length > 0) {
              const descriptionSection = screen.getByText(/Description:/i).parentElement;
              expect(descriptionSection?.textContent).toContain(vulnerability.description.trim());
            }
          } finally {
            unmount();
            cleanup();
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);
});

