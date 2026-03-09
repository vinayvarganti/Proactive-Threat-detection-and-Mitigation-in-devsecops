import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Vulnerability } from '../services/vulnerabilityService';
import axios from 'axios';

interface CodeEditorProps {
  vulnerability: Vulnerability;
  onSave?: (fixedCode: string) => void;
  onCancel?: () => void;
}

interface ValidationError {
  line: number;
  column: number;
  message: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

interface FileContentResponse {
  content: string;
  filePath: string;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ vulnerability, onSave, onCancel }) => {
  const [code, setCode] = useState<string>('');
  const [originalCode, setOriginalCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    loadCode();
  }, [vulnerability]);

  const loadCode = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch file content from backend
      const response = await axios.get<FileContentResponse>(
        `/api/repositories/${vulnerability.repositoryId}/files/${encodeURIComponent(vulnerability.filePath)}`
      );

      const fileContent = response.data.content;
      setCode(fileContent);
      setOriginalCode(fileContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file content');
      console.error('Failed to load code:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;

    // Highlight the vulnerable line
    if (vulnerability.lineNumber > 0) {
      // Scroll to the vulnerable line
      editor.revealLineInCenter(vulnerability.lineNumber);

      // Add decoration to highlight the line
      editor.deltaDecorations(
        [],
        [
          {
            range: {
              startLineNumber: vulnerability.lineNumber,
              startColumn: 1,
              endLineNumber: vulnerability.lineNumber,
              endColumn: 1000
            },
            options: {
              isWholeLine: true,
              className: 'vulnerable-line-highlight',
              glyphMarginClassName: 'vulnerable-line-glyph'
            }
          }
        ]
      );
    }
  };

  const validateSyntax = async (codeToValidate: string): Promise<ValidationResult> => {
    try {
      // Send code to backend for validation
      const response = await axios.post<ValidationResult>('/api/fixes/validate', {
        filePath: vulnerability.filePath,
        code: codeToValidate
      });

      return response.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        return err.response.data as ValidationResult;
      }
      
      // If validation endpoint fails, return error
      return {
        isValid: false,
        errors: [{ line: 0, column: 0, message: 'Failed to validate syntax' }]
      };
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setValidationErrors([]);

      // Validate syntax before saving
      const validationResult = await validateSyntax(code);

      if (!validationResult.isValid) {
        setValidationErrors(validationResult.errors);
        setError('Code contains syntax errors. Please fix them before saving.');
        return;
      }

      // Save the fix
      await axios.post('/api/fixes/manual', {
        vulnerabilityId: vulnerability.id,
        fixedCode: code,
        filePath: vulnerability.filePath
      });

      // Update vulnerability status to in_progress
      await axios.patch(`/api/vulnerabilities/${vulnerability.id}`, {
        fixStatus: 'in_progress'
      });

      if (onSave) {
        onSave(code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original code
    setCode(originalCode);
    setValidationErrors([]);
    setError(null);

    if (onCancel) {
      onCancel();
    }
  };

  const hasChanges = code !== originalCode;

  if (loading) {
    return (
      <div className="code-editor-container">
        <div className="loading">Loading code...</div>
      </div>
    );
  }

  return (
    <div className="code-editor-container">
      <div className="editor-header">
        <h3>Edit Code: {vulnerability.filePath}</h3>
        <div className="vulnerability-info">
          <span className={`severity-badge ${vulnerability.severity}`}>
            {vulnerability.severity.toUpperCase()}
          </span>
          <span className="vulnerability-title">{vulnerability.title}</span>
        </div>
        <div className="line-info">
          Line {vulnerability.lineNumber}
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="validation-errors" role="alert">
          <h4>Syntax Errors:</h4>
          <ul>
            {validationErrors.map((err, index) => (
              <li key={index}>
                Line {err.line}, Column {err.column}: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="editor-wrapper">
        <Editor
          height="500px"
          defaultLanguage={getLanguageFromFilePath(vulnerability.filePath)}
          value={code}
          onChange={(value) => setCode(value || '')}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            automaticLayout: true
          }}
        />
      </div>

      <div className="editor-actions">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="save-button"
          aria-label="Save changes"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="cancel-button"
          aria-label="Cancel"
        >
          Cancel
        </button>
      </div>

      <div className="editor-footer">
        <div className="description">
          <strong>Description:</strong> {vulnerability.description}
        </div>
      </div>
    </div>
  );
};

/**
 * Determines the Monaco editor language based on file extension
 */
function getLanguageFromFilePath(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'go': 'go',
    'rb': 'ruby',
    'php': 'php',
    'c': 'c',
    'cpp': 'cpp',
    'cs': 'csharp',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'md': 'markdown',
    'sh': 'shell',
    'bash': 'shell'
  };

  return languageMap[extension || ''] || 'plaintext';
}

export default CodeEditor;
