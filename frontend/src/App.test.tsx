import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';
import { authService } from './services/authService';

jest.mock('./services/authService');

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the app title', async () => {
    (authService.getAuthStatus as jest.Mock).mockResolvedValue({ isAuthenticated: false });
    
    render(<App />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    
    const titleElement = screen.getByText(/DevSecOps Platform/i);
    expect(titleElement).toBeInTheDocument();
  });

  it('renders the app description', async () => {
    (authService.getAuthStatus as jest.Mock).mockResolvedValue({ isAuthenticated: false });
    
    render(<App />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    
    const descElement = screen.getByText(/AI-Assisted Proactive Threat Detection/i);
    expect(descElement).toBeInTheDocument();
  });
});
