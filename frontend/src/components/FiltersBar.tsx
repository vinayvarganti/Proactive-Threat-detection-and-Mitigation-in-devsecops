import React from 'react';
import './FiltersBar.css';

interface FiltersBarProps {
  currentSeverity: 'all' | 'critical' | 'high' | 'medium' | 'low';
  searchTerm: string;
  onSeverityChange: (severity: 'all' | 'critical' | 'high' | 'medium' | 'low') => void;
  onSearchChange: (term: string) => void;
}

export function FiltersBar({
  currentSeverity,
  searchTerm,
  onSeverityChange,
  onSearchChange
}: FiltersBarProps): JSX.Element {
  const severities: Array<'all' | 'critical' | 'high' | 'medium' | 'low'> = [
    'all',
    'critical',
    'high',
    'medium',
    'low'
  ];

  return (
    <div className="filters-bar">
      <div className="severity-filters">
        <label className="filters-label">Filter by Severity:</label>
        <div className="filter-buttons">
          {severities.map((severity) => (
            <button
              key={severity}
              className={`filter-button ${currentSeverity === severity ? 'active' : ''} ${severity !== 'all' ? `severity-${severity}` : ''}`}
              onClick={() => onSeverityChange(severity)}
              aria-pressed={currentSeverity === severity}
              aria-label={`Filter by ${severity} severity`}
            >
              {severity.charAt(0).toUpperCase() + severity.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="search-filter">
        <label htmlFor="file-path-search" className="filters-label">
          Search by File Path:
        </label>
        <input
          id="file-path-search"
          type="text"
          className="search-input"
          placeholder="Enter file path..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search vulnerabilities by file path"
        />
      </div>
    </div>
  );
}
