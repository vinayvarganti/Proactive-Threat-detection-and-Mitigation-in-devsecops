import React from 'react';
import ScannerSection, { ScannerVulnerabilities } from './ScannerSection';
import './ProjectCard.css';

export interface ProjectVulnerabilities {
  repositoryId: string;
  repositoryName: string;
  totalVulnerabilities: number;
  scanners: ScannerVulnerabilities[];
}

export interface ProjectCardProps {
  project: ProjectVulnerabilities;
  collapsedSections: Set<string>;
  onToggleSection: (sectionId: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  collapsedSections,
  onToggleSection
}) => {
  // Only show scanner sections that have vulnerabilities
  const scannersWithVulnerabilities = project.scanners.filter(
    scanner => scanner.vulnerabilities.length > 0
  );

  return (
    <div 
      className="project-card" 
      data-testid={`project-card-${project.repositoryId}`}
      role="article"
      aria-label={`Project ${project.repositoryName} with ${project.totalVulnerabilities} vulnerabilities`}
    >
      <div className="project-card-header">
        <h2 className="project-name">{project.repositoryName}</h2>
        <span 
          className="project-total-count"
          aria-label={`Total vulnerabilities: ${project.totalVulnerabilities}`}
        >
          {project.totalVulnerabilities} {project.totalVulnerabilities === 1 ? 'vulnerability' : 'vulnerabilities'}
        </span>
      </div>

      <div className="project-scanners">
        {scannersWithVulnerabilities.map(scanner => {
          const sectionId = `${project.repositoryId}-${scanner.scannerName}`;
          const isCollapsed = collapsedSections.has(sectionId);

          return (
            <ScannerSection
              key={sectionId}
              scanner={scanner}
              repositoryId={project.repositoryId}
              isCollapsed={isCollapsed}
              onToggle={() => onToggleSection(sectionId)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default ProjectCard;
