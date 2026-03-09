import React, { useState, useEffect } from 'react';
import { vulnerabilityService, GroupedVulnerabilitiesResponse } from '../services/vulnerabilityService';
import { filterVulnerabilities, SeverityFilter, ProjectVulnerabilities } from '../utils/filterVulnerabilities';
import { exportToJSON } from '../utils/exportData';
import SummaryCards from './SummaryCards';
import { FiltersBar } from './FiltersBar';
import ProjectCard from './ProjectCard';
import './DashboardContainer.css';

interface DashboardState {
  data: GroupedVulnerabilitiesResponse | null;
  loading: boolean;
  error: string | null;
  filters: {
    severity: SeverityFilter;
    searchTerm: string;
  };
  collapsedSections: Set<string>;
}

export function DashboardContainer(): JSX.Element {
  const [state, setState] = useState<DashboardState>({
    data: null,
    loading: true,
    error: null,
    filters: {
      severity: 'all',
      searchTerm: '',
    },
    collapsedSections: new Set(),
  });

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const data = await vulnerabilityService.fetchGroupedVulnerabilities();
        setState((prev) => ({ ...prev, data, loading: false }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load dashboard data';
        setState((prev) => ({ ...prev, error: errorMessage, loading: false }));
      }
    };

    fetchData();
  }, []);

  // Handle severity filter change
  const handleSeverityChange = (severity: SeverityFilter) => {
    setState((prev) => ({
      ...prev,
      filters: { ...prev.filters, severity },
    }));
  };

  // Handle search term change
  const handleSearchChange = (searchTerm: string) => {
    setState((prev) => ({
      ...prev,
      filters: { ...prev.filters, searchTerm },
    }));
  };

  // Handle section toggle
  const handleToggleSection = (sectionId: string) => {
    setState((prev) => {
      const newCollapsed = new Set(prev.collapsedSections);
      if (newCollapsed.has(sectionId)) {
        newCollapsed.delete(sectionId);
      } else {
        newCollapsed.add(sectionId);
      }
      return { ...prev, collapsedSections: newCollapsed };
    });
  };

  // Handle export
  const handleExport = () => {
    if (!state.data) return;
    const filteredProjects = getFilteredProjects();
    exportToJSON(state.data, filteredProjects);
  };

  // Apply filters to data
  const getFilteredProjects = (): ProjectVulnerabilities[] => {
    if (!state.data) return [];
    return filterVulnerabilities(
      state.data.projects,
      state.filters.severity,
      state.filters.searchTerm
    );
  };

  // Render loading state
  if (state.loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-loading" role="status" aria-live="polite">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (state.error) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-error" role="alert">
          <h2>Error Loading Dashboard</h2>
          <p>{state.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="retry-button"
            aria-label="Retry loading dashboard"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!state.data || state.data.projects.length === 0) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-empty">
          <h2>No Vulnerabilities Found</h2>
          <p>No projects with vulnerabilities to display.</p>
        </div>
      </div>
    );
  }

  const filteredProjects = getFilteredProjects();

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Vulnerability Dashboard</h1>
        <button
          onClick={handleExport}
          className="export-button"
          aria-label="Export vulnerability report as JSON"
        >
          Export Report
        </button>
      </header>

      <SummaryCards summary={state.data.summary} />

      <FiltersBar
        currentSeverity={state.filters.severity}
        searchTerm={state.filters.searchTerm}
        onSeverityChange={handleSeverityChange}
        onSearchChange={handleSearchChange}
      />

      {filteredProjects.length === 0 ? (
        <div className="dashboard-no-results">
          <p>No vulnerabilities match the current filters.</p>
        </div>
      ) : (
        <div className="projects-list">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.repositoryId}
              project={project}
              collapsedSections={state.collapsedSections}
              onToggleSection={handleToggleSection}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default DashboardContainer;
