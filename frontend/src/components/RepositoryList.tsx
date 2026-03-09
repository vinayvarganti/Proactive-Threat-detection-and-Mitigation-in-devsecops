import React, { useState, useEffect } from 'react';
import { repositoryService, Repository } from '../services/repositoryService';
import './RepositoryList.css';

interface RepositoryListProps {
  onScanComplete?: (reportIds: string[]) => void;
}

const RepositoryList: React.FC<RepositoryListProps> = ({ onScanComplete }) => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<string | null>(null);

  useEffect(() => {
    loadRepositories();
  }, []);

  const loadRepositories = async () => {
    try {
      setLoading(true);
      setError(null);
      const repos = await repositoryService.fetchRepositories();
      setRepositories(repos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repositories');
      console.error('Repository fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRepository = (repoId: string) => {
    setSelectedRepoIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(repoId)) {
        newSet.delete(repoId);
      } else {
        newSet.add(repoId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedRepoIds.size === repositories.length) {
      // Deselect all
      setSelectedRepoIds(new Set());
    } else {
      // Select all
      setSelectedRepoIds(new Set(repositories.map(repo => repo.id)));
    }
  };

  const handleInitiateScan = async () => {
    if (selectedRepoIds.size === 0) {
      setError('Please select at least one repository to scan');
      return;
    }

    try {
      setScanning(true);
      setError(null);
      setScanProgress(`Initializing scan for ${selectedRepoIds.size} repository(ies)...`);

      // Get full repository objects for selected IDs
      const selectedRepos = repositories.filter(repo => selectedRepoIds.has(repo.id));
      
      // Update progress
      setScanProgress(`Downloading repositories and running security scans...`);
      
      const results = await repositoryService.scanMultipleRepositories(selectedRepos);

      // Extract successful report IDs
      const reportIds = results
        .filter(result => result.success && result.reportId)
        .map(result => result.reportId!);

      // Check for failures
      const failures = results.filter(result => !result.success);
      if (failures.length > 0) {
        setError(`${failures.length} scan(s) failed. Check console for details.`);
        failures.forEach((failure, index) => {
          console.error(`Scan ${index + 1} failed:`, failure.message);
        });
      }

      setScanProgress(`✓ Scan complete! ${reportIds.length} successful scan(s).`);

      // Notify parent component
      if (onScanComplete && reportIds.length > 0) {
        onScanComplete(reportIds);
      }

      // Clear selection after successful scan
      setSelectedRepoIds(new Set());

      // Clear progress message after 3 seconds
      setTimeout(() => {
        setScanProgress(null);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate scan');
      console.error('Scan error:', err);
      setScanProgress(null);
    } finally {
      setScanning(false);
    }
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="repository-list-container">
        <div className="loading" role="status">Loading repositories...</div>
      </div>
    );
  }

  return (
    <div className="repository-list-container">
      <div className="repository-list-header">
        <h2>Repositories</h2>
        <div className="repository-actions">
          {repositories.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="select-all-button"
              aria-label={selectedRepoIds.size === repositories.length ? 'Deselect all' : 'Select all'}
            >
              {selectedRepoIds.size === repositories.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
          <button
            onClick={handleInitiateScan}
            disabled={scanning || selectedRepoIds.size === 0}
            className="scan-button"
            aria-label="Initiate scan"
          >
            {scanning ? 'Scanning...' : `Scan Selected (${selectedRepoIds.size})`}
          </button>
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

      {scanProgress && (
        <div className="scan-progress" role="status">
          <div className="scan-progress-content">
            <div className="spinner"></div>
            <span>{scanProgress}</span>
          </div>
        </div>
      )}

      {repositories.length === 0 ? (
        <div className="no-repositories">
          <p>No repositories found.</p>
          <button onClick={loadRepositories} className="retry-button">
            Retry
          </button>
        </div>
      ) : (
        <div className="repository-list">
          <table className="repository-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedRepoIds.size === repositories.length && repositories.length > 0}
                    onChange={handleSelectAll}
                    aria-label="Select all repositories"
                  />
                </th>
                <th>Name</th>
                <th>Visibility</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {repositories.map(repo => (
                <tr
                  key={repo.id}
                  className={selectedRepoIds.has(repo.id) ? 'selected' : ''}
                  onClick={() => handleSelectRepository(repo.id)}
                  role="row"
                  aria-selected={selectedRepoIds.has(repo.id)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedRepoIds.has(repo.id)}
                      onChange={() => handleSelectRepository(repo.id)}
                      aria-label={`Select ${repo.name}`}
                    />
                  </td>
                  <td>
                    <div className="repository-name">
                      <strong>{repo.name}</strong>
                      <span className="repository-full-name">{repo.fullName}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`visibility-badge ${repo.visibility}`}>
                      {repo.visibility}
                    </span>
                  </td>
                  <td>{formatDate(repo.lastUpdated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RepositoryList;
