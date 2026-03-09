import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FiltersBar } from './FiltersBar';

describe('FiltersBar', () => {
  it('renders all filter buttons', () => {
    const mockOnSeverityChange = jest.fn();
    const mockOnSearchChange = jest.fn();

    render(
      <FiltersBar
        currentSeverity="all"
        searchTerm=""
        onSeverityChange={mockOnSeverityChange}
        onSearchChange={mockOnSearchChange}
      />
    );

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('renders search input', () => {
    const mockOnSeverityChange = jest.fn();
    const mockOnSearchChange = jest.fn();

    render(
      <FiltersBar
        currentSeverity="all"
        searchTerm=""
        onSeverityChange={mockOnSeverityChange}
        onSearchChange={mockOnSearchChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Enter file path...');
    expect(searchInput).toBeInTheDocument();
  });

  it('calls onSeverityChange when filter button is clicked', () => {
    const mockOnSeverityChange = jest.fn();
    const mockOnSearchChange = jest.fn();

    render(
      <FiltersBar
        currentSeverity="all"
        searchTerm=""
        onSeverityChange={mockOnSeverityChange}
        onSearchChange={mockOnSearchChange}
      />
    );

    fireEvent.click(screen.getByText('Critical'));
    expect(mockOnSeverityChange).toHaveBeenCalledWith('critical');

    fireEvent.click(screen.getByText('High'));
    expect(mockOnSeverityChange).toHaveBeenCalledWith('high');

    fireEvent.click(screen.getByText('Medium'));
    expect(mockOnSeverityChange).toHaveBeenCalledWith('medium');

    fireEvent.click(screen.getByText('Low'));
    expect(mockOnSeverityChange).toHaveBeenCalledWith('low');
  });

  it('calls onSearchChange when typing in search input', () => {
    const mockOnSeverityChange = jest.fn();
    const mockOnSearchChange = jest.fn();

    render(
      <FiltersBar
        currentSeverity="all"
        searchTerm=""
        onSeverityChange={mockOnSeverityChange}
        onSearchChange={mockOnSearchChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Enter file path...');
    fireEvent.change(searchInput, { target: { value: 'src/test.ts' } });

    expect(mockOnSearchChange).toHaveBeenCalledWith('src/test.ts');
  });

  it('highlights active filter button', () => {
    const mockOnSeverityChange = jest.fn();
    const mockOnSearchChange = jest.fn();

    render(
      <FiltersBar
        currentSeverity="critical"
        searchTerm=""
        onSeverityChange={mockOnSeverityChange}
        onSearchChange={mockOnSearchChange}
      />
    );

    const criticalButton = screen.getByText('Critical');
    expect(criticalButton).toHaveClass('active');
    expect(criticalButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('displays current search term in input', () => {
    const mockOnSeverityChange = jest.fn();
    const mockOnSearchChange = jest.fn();

    render(
      <FiltersBar
        currentSeverity="all"
        searchTerm="src/components"
        onSeverityChange={mockOnSeverityChange}
        onSearchChange={mockOnSearchChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Enter file path...') as HTMLInputElement;
    expect(searchInput.value).toBe('src/components');
  });

  it('has proper ARIA labels for accessibility', () => {
    const mockOnSeverityChange = jest.fn();
    const mockOnSearchChange = jest.fn();

    render(
      <FiltersBar
        currentSeverity="all"
        searchTerm=""
        onSeverityChange={mockOnSeverityChange}
        onSearchChange={mockOnSearchChange}
      />
    );

    expect(screen.getByLabelText('Filter by all severity')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by critical severity')).toBeInTheDocument();
    expect(screen.getByLabelText('Search vulnerabilities by file path')).toBeInTheDocument();
  });
});
