import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Authentication from './Authentication';
import { authService } from '../services/authService';

// Mock the authService
jest.mock('../services/authService', () => ({
  authService: {
    initiateGitHubLogin: jest.fn(),
    handleOAuthCallback: jest.fn(),
    logout: jest.fn(),
    getAuthStatus: jest.fn()
  }
}));

describe('Authentication Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear URL search params
    window.history.replaceState({}, '', '/');
  });

  describe('Login Flow', () => {
    it('should display login button when not authenticated', async () => {
      (authService.getAuthStatus as jest.Mock).mockResolvedValue({
        isAuthenticated: false,
        username: null,
        avatarUrl: null
      });

      render(<Authentication />);

      await waitFor(() => {
        expect(screen.queryByText('Loading authentication status...')).not.toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /login with github/i })).toBeInTheDocument();
    });

    it('should initiate GitHub OAuth flow when login button is clicked', async () => {
      const mockOAuthUrl = 'https://github.com/login/oauth/authorize?client_id=test';
      
      (authService.getAuthStatus as jest.Mock).mockResolvedValue({
        isAuthenticated: false,
        username: null,
        avatarUrl: null
      });
      
      (authService.initiateGitHubLogin as jest.Mock).mockResolvedValue(mockOAuthUrl);

      // Mock window.location.href
      delete (window as any).location;
      window.location = { href: '' } as any;

      render(<Authentication />);

      await waitFor(() => {
        expect(screen.queryByText('Loading authentication status...')).not.toBeInTheDocument();
      });

      const loginButton = screen.getByRole('button', { name: /login with github/i });
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(authService.initiateGitHubLogin).toHaveBeenCalledTimes(1);
      });

      expect(window.location.href).toBe(mockOAuthUrl);
    });

    it('should display error message when login initiation fails', async () => {
      const errorMessage = 'Failed to initiate OAuth flow';
      
      (authService.getAuthStatus as jest.Mock).mockResolvedValue({
        isAuthenticated: false,
        username: null,
        avatarUrl: null
      });
      
      (authService.initiateGitHubLogin as jest.Mock).mockRejectedValue(new Error(errorMessage));

      render(<Authentication />);

      await waitFor(() => {
        expect(screen.queryByText('Loading authentication status...')).not.toBeInTheDocument();
      });

      const loginButton = screen.getByRole('button', { name: /login with github/i });
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
      });
    });

    it('should handle OAuth callback with code parameter', async () => {
      const mockCode = 'test-oauth-code';
      const mockUser = {
        id: '123',
        username: 'testuser',
        avatarUrl: 'https://github.com/avatar.png',
        email: 'test@example.com'
      };

      (authService.getAuthStatus as jest.Mock).mockResolvedValue({
        isAuthenticated: false,
        username: null,
        avatarUrl: null
      });

      (authService.handleOAuthCallback as jest.Mock).mockResolvedValue(mockUser);

      // Mock window.location.search before rendering
      Object.defineProperty(window, 'location', {
        value: {
          ...window.location,
          search: `?code=${mockCode}`,
          pathname: '/'
        },
        writable: true
      });

      render(<Authentication />);

      await waitFor(() => {
        expect(authService.handleOAuthCallback).toHaveBeenCalledWith(mockCode);
      }, { timeout: 3000 });

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });
    });

    it('should display error when OAuth callback fails', async () => {
      const mockCode = 'invalid-code';
      const errorMessage = 'Authentication failed';

      (authService.getAuthStatus as jest.Mock).mockResolvedValue({
        isAuthenticated: false,
        username: null,
        avatarUrl: null
      });

      (authService.handleOAuthCallback as jest.Mock).mockRejectedValue(new Error(errorMessage));

      // Mock window.location.search before rendering
      Object.defineProperty(window, 'location', {
        value: {
          ...window.location,
          search: `?code=${mockCode}`,
          pathname: '/'
        },
        writable: true
      });

      render(<Authentication />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
      }, { timeout: 3000 });
    });
  });

  describe('Logout Flow', () => {
    it('should display user info and logout button when authenticated', async () => {
      (authService.getAuthStatus as jest.Mock).mockResolvedValue({
        isAuthenticated: true,
        username: 'testuser',
        avatarUrl: 'https://github.com/avatar.png'
      });

      render(<Authentication />);

      await waitFor(() => {
        expect(screen.queryByText('Loading authentication status...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('testuser')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      expect(screen.getByAltText("testuser's avatar")).toBeInTheDocument();
    });

    it('should logout user when logout button is clicked', async () => {
      (authService.getAuthStatus as jest.Mock).mockResolvedValue({
        isAuthenticated: true,
        username: 'testuser',
        avatarUrl: 'https://github.com/avatar.png'
      });

      (authService.logout as jest.Mock).mockResolvedValue(undefined);

      render(<Authentication />);

      await waitFor(() => {
        expect(screen.queryByText('Loading authentication status...')).not.toBeInTheDocument();
      });

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(authService.logout).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login with github/i })).toBeInTheDocument();
      });
    });

    it('should display error message when logout fails', async () => {
      const errorMessage = 'Failed to logout';
      
      (authService.getAuthStatus as jest.Mock).mockResolvedValue({
        isAuthenticated: true,
        username: 'testuser',
        avatarUrl: 'https://github.com/avatar.png'
      });

      (authService.logout as jest.Mock).mockRejectedValue(new Error(errorMessage));

      render(<Authentication />);

      await waitFor(() => {
        expect(screen.queryByText('Loading authentication status...')).not.toBeInTheDocument();
      });

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
      });

      // User should still be shown as authenticated
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });

    it('should disable logout button while logging out', async () => {
      (authService.getAuthStatus as jest.Mock).mockResolvedValue({
        isAuthenticated: true,
        username: 'testuser',
        avatarUrl: 'https://github.com/avatar.png'
      });

      let resolveLogout: () => void;
      const logoutPromise = new Promise<void>(resolve => {
        resolveLogout = resolve;
      });

      (authService.logout as jest.Mock).mockReturnValue(logoutPromise);

      render(<Authentication />);

      await waitFor(() => {
        expect(screen.queryByText('Loading authentication status...')).not.toBeInTheDocument();
      });

      const logoutButton = screen.getByRole('button', { name: /^logout$/i });
      fireEvent.click(logoutButton);

      // Check that button shows "Logging out..." and is disabled
      await waitFor(() => {
        const button = screen.getByText('Logging out...');
        expect(button).toBeDisabled();
      });

      // Resolve the logout promise
      resolveLogout!();

      // Wait for logout to complete
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login with github/i })).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should allow dismissing error messages', async () => {
      const errorMessage = 'Test error message';
      
      (authService.getAuthStatus as jest.Mock).mockResolvedValue({
        isAuthenticated: false,
        username: null,
        avatarUrl: null
      });
      
      (authService.initiateGitHubLogin as jest.Mock).mockRejectedValue(new Error(errorMessage));

      render(<Authentication />);

      await waitFor(() => {
        expect(screen.queryByText('Loading authentication status...')).not.toBeInTheDocument();
      });

      const loginButton = screen.getByRole('button', { name: /login with github/i });
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('Authentication Status Display', () => {
    it('should show loading state initially', () => {
      (authService.getAuthStatus as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      render(<Authentication />);

      expect(screen.getByText('Loading authentication status...')).toBeInTheDocument();
    });

    it('should call onAuthChange callback when authentication status changes', async () => {
      const onAuthChange = jest.fn();

      (authService.getAuthStatus as jest.Mock).mockResolvedValue({
        isAuthenticated: true,
        username: 'testuser',
        avatarUrl: 'https://github.com/avatar.png'
      });

      render(<Authentication onAuthChange={onAuthChange} />);

      await waitFor(() => {
        expect(onAuthChange).toHaveBeenCalledWith(true);
      });
    });

    it('should display user without avatar when avatarUrl is null', async () => {
      (authService.getAuthStatus as jest.Mock).mockResolvedValue({
        isAuthenticated: true,
        username: 'testuser',
        avatarUrl: null
      });

      render(<Authentication />);

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });
});
