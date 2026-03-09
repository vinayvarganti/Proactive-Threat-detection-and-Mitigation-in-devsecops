import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CodeEditor from './CodeEditor';
import { Vulnerability } from '../services/vulnerabilityService';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock Monaco Editor
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ value, onChange, onMount }: any) => {
    // Simulate editor mount
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

describe('CodeEditor Component', () => {
  const mockVulnerability: Vulnerability = {
    id: 'vuln-1',
    type: 'code',
    severity: 'high',
    title: 'SQL Injection',
    description: 'Potential SQL injection vulnerability',
    filePath: 'src/database.ts',
    lineNumber: 42,
    scanner: 'semgrep',
    fixStatus: 'pending',
    codeSnippet: 'const query = "SELECT * FROM users WHERE id = " + userId;',
    repositoryId: 'repo-1'
  };

  const mockFileContent = `function getUser(userId: string) {
  const query = "SELECT * FROM users WHERE id = " + userId;
  return db.execute(query);
}`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load and display file content', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        content: mockFileContent,
        filePath: 'src/database.ts'
      }
    });

    render(<CodeEditor vulnerability={mockVulnerability} />);

    expect(screen.getByText('Loading code...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    expect(screen.getByTestId('monaco-editor')).toHaveValue(mockFileContent);
  });

  it('should display vulnerability information', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { content: mockFileContent, filePath: 'src/database.ts' }
    });

    render(<CodeEditor vulnerability={mockVulnerability} />);

    await waitFor(() => {
      expect(screen.getByText('Edit Code: src/database.ts')).toBeInTheDocument();
    });

    expect(screen.getByText('SQL Injection')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('Line 42')).toBeInTheDocument();
  });

  it('should validate syntax before saving', async () => {
    const user = userEvent.setup();

    mockedAxios.get.mockResolvedValueOnce({
      data: { content: mockFileContent, filePath: 'src/database.ts' }
    });

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        isValid: false,
        errors: [
          { line: 2, column: 10, message: 'Unexpected token' }
        ]
      }
    });

    render(<CodeEditor vulnerability={mockVulnerability} />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    // Modify code
    const editor = screen.getByTestId('monaco-editor');
    await user.clear(editor);
    await user.type(editor, 'invalid code {');

    // Try to save
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/syntax errors/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Unexpected token/i)).toBeInTheDocument();
  });

  it('should save changes when validation passes', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();

    const fixedCode = `function getUser(userId: string) {
  const query = "SELECT * FROM users WHERE id = ?";
  return db.execute(query, [userId]);
}`;

    mockedAxios.get.mockResolvedValueOnce({
      data: { content: mockFileContent, filePath: 'src/database.ts' }
    });

    mockedAxios.post.mockResolvedValueOnce({
      data: { isValid: true, errors: [] }
    });

    mockedAxios.post.mockResolvedValueOnce({
      data: { success: true }
    });

    mockedAxios.patch.mockResolvedValueOnce({
      data: { success: true }
    });

    render(<CodeEditor vulnerability={mockVulnerability} onSave={onSave} />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    // Modify code
    const editor = screen.getByTestId('monaco-editor');
    await user.clear(editor);
    await user.type(editor, fixedCode);

    // Save
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(fixedCode);
    });

    expect(mockedAxios.post).toHaveBeenCalledWith('/api/fixes/validate', {
      filePath: 'src/database.ts',
      code: fixedCode
    });

    expect(mockedAxios.post).toHaveBeenCalledWith('/api/fixes/manual', {
      vulnerabilityId: 'vuln-1',
      fixedCode: fixedCode,
      filePath: 'src/database.ts'
    });

    expect(mockedAxios.patch).toHaveBeenCalledWith('/api/vulnerabilities/vuln-1', {
      fixStatus: 'in_progress'
    });
  });

  it('should handle cancel action', async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();

    mockedAxios.get.mockResolvedValueOnce({
      data: { content: mockFileContent, filePath: 'src/database.ts' }
    });

    render(<CodeEditor vulnerability={mockVulnerability} onCancel={onCancel} />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    // Modify code
    const editor = screen.getByTestId('monaco-editor');
    await user.clear(editor);
    await user.type(editor, 'modified code');

    // Cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
    
    // Code should be reset to original
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toHaveValue(mockFileContent);
    });
  });

  it('should display error when file loading fails', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('File not found'));

    render(<CodeEditor vulnerability={mockVulnerability} />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load file content/i)).toBeInTheDocument();
    });
  });

  it('should disable save button when no changes', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { content: mockFileContent, filePath: 'src/database.ts' }
    });

    render(<CodeEditor vulnerability={mockVulnerability} />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    expect(saveButton).toBeDisabled();
  });
});
