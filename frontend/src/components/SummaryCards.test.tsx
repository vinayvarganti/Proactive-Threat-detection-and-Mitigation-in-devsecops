import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SummaryCards, { SummaryData } from './SummaryCards';

describe('SummaryCards', () => {
  const mockSummary: SummaryData = {
    totalProjects: 5,
    totalVulnerabilities: 42,
    criticalCount: 8,
    highCount: 15
  };

  describe('All four cards render', () => {
    it('should render all four summary cards', () => {
      const { container } = render(<SummaryCards summary={mockSummary} />);
      
      const cards = container.querySelectorAll('.summary-card');
      expect(cards.length).toBe(4);
    });

    it('should render Total Projects card', () => {
      render(<SummaryCards summary={mockSummary} />);
      
      expect(screen.getByText('Total Projects')).toBeInTheDocument();
      expect(screen.getByTestId('summary-card-projects')).toBeInTheDocument();
    });

    it('should render Total Vulnerabilities card', () => {
      render(<SummaryCards summary={mockSummary} />);
      
      expect(screen.getByText('Total Vulnerabilities')).toBeInTheDocument();
      expect(screen.getByTestId('summary-card-vulnerabilities')).toBeInTheDocument();
    });

    it('should render Critical card', () => {
      render(<SummaryCards summary={mockSummary} />);
      
      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByTestId('summary-card-critical')).toBeInTheDocument();
    });

    it('should render High card', () => {
      render(<SummaryCards summary={mockSummary} />);
      
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByTestId('summary-card-high')).toBeInTheDocument();
    });
  });

  describe('Correct values are displayed', () => {
    it('should display correct total projects value', () => {
      render(<SummaryCards summary={mockSummary} />);
      
      const projectsValue = screen.getByLabelText('5 projects scanned');
      expect(projectsValue).toBeInTheDocument();
      expect(projectsValue.textContent).toBe('5');
    });

    it('should display correct total vulnerabilities value', () => {
      render(<SummaryCards summary={mockSummary} />);
      
      const vulnerabilitiesValue = screen.getByLabelText('42 total vulnerabilities');
      expect(vulnerabilitiesValue).toBeInTheDocument();
      expect(vulnerabilitiesValue.textContent).toBe('42');
    });

    it('should display correct critical count value', () => {
      render(<SummaryCards summary={mockSummary} />);
      
      const criticalValue = screen.getByLabelText('8 critical vulnerabilities');
      expect(criticalValue).toBeInTheDocument();
      expect(criticalValue.textContent).toBe('8');
    });

    it('should display correct high count value', () => {
      render(<SummaryCards summary={mockSummary} />);
      
      const highValue = screen.getByLabelText('15 high severity vulnerabilities');
      expect(highValue).toBeInTheDocument();
      expect(highValue.textContent).toBe('15');
    });

    it('should handle zero values correctly', () => {
      const zeroSummary: SummaryData = {
        totalProjects: 0,
        totalVulnerabilities: 0,
        criticalCount: 0,
        highCount: 0
      };

      render(<SummaryCards summary={zeroSummary} />);
      
      expect(screen.getByLabelText('0 projects scanned')).toBeInTheDocument();
      expect(screen.getByLabelText('0 total vulnerabilities')).toBeInTheDocument();
      expect(screen.getByLabelText('0 critical vulnerabilities')).toBeInTheDocument();
      expect(screen.getByLabelText('0 high severity vulnerabilities')).toBeInTheDocument();
    });

    it('should handle large numbers correctly', () => {
      const largeSummary: SummaryData = {
        totalProjects: 999,
        totalVulnerabilities: 9999,
        criticalCount: 500,
        highCount: 1500
      };

      render(<SummaryCards summary={largeSummary} />);
      
      expect(screen.getByLabelText('999 projects scanned').textContent).toBe('999');
      expect(screen.getByLabelText('9999 total vulnerabilities').textContent).toBe('9999');
      expect(screen.getByLabelText('500 critical vulnerabilities').textContent).toBe('500');
      expect(screen.getByLabelText('1500 high severity vulnerabilities').textContent).toBe('1500');
    });
  });

  describe('Responsive layout on mobile', () => {
    it('should have responsive grid layout', () => {
      const { container } = render(<SummaryCards summary={mockSummary} />);
      
      const summaryCards = container.querySelector('.summary-cards');
      expect(summaryCards).toHaveClass('summary-cards');
    });

    it('should apply correct CSS classes for responsive design', () => {
      const { container } = render(<SummaryCards summary={mockSummary} />);
      
      const cards = container.querySelectorAll('.summary-card');
      cards.forEach(card => {
        expect(card).toHaveClass('summary-card');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have region role on container', () => {
      const { container } = render(<SummaryCards summary={mockSummary} />);
      
      const region = container.querySelector('[role="region"]');
      expect(region).toBeInTheDocument();
    });

    it('should have aria-label on container', () => {
      const { container } = render(<SummaryCards summary={mockSummary} />);
      
      const region = container.querySelector('[role="region"]');
      expect(region).toHaveAttribute('aria-label', 'Vulnerability summary statistics');
    });

    it('should have aria-labels on all value elements', () => {
      render(<SummaryCards summary={mockSummary} />);
      
      expect(screen.getByLabelText('5 projects scanned')).toBeInTheDocument();
      expect(screen.getByLabelText('42 total vulnerabilities')).toBeInTheDocument();
      expect(screen.getByLabelText('8 critical vulnerabilities')).toBeInTheDocument();
      expect(screen.getByLabelText('15 high severity vulnerabilities')).toBeInTheDocument();
    });

    it('should have aria-hidden on decorative icons', () => {
      const { container } = render(<SummaryCards summary={mockSummary} />);
      
      const icons = container.querySelectorAll('.summary-card-icon');
      icons.forEach(icon => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('Styling', () => {
    it('should apply critical styling to critical card', () => {
      const { container } = render(<SummaryCards summary={mockSummary} />);
      
      const criticalCard = container.querySelector('[data-testid="summary-card-critical"]');
      expect(criticalCard).toHaveClass('summary-card-critical');
    });

    it('should apply high styling to high card', () => {
      const { container } = render(<SummaryCards summary={mockSummary} />);
      
      const highCard = container.querySelector('[data-testid="summary-card-high"]');
      expect(highCard).toHaveClass('summary-card-high');
    });

    it('should have proper structure with icon and content', () => {
      const { container } = render(<SummaryCards summary={mockSummary} />);
      
      const cards = container.querySelectorAll('.summary-card');
      cards.forEach(card => {
        expect(card.querySelector('.summary-card-icon')).toBeInTheDocument();
        expect(card.querySelector('.summary-card-content')).toBeInTheDocument();
        expect(card.querySelector('.summary-card-label')).toBeInTheDocument();
        expect(card.querySelector('.summary-card-value')).toBeInTheDocument();
      });
    });
  });
});
