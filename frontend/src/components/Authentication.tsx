import React, { useState, useEffect } from 'react';
import { authService, AuthStatus } from '../services/authService';

interface AuthenticationProps {
  onAuthChange?: (isAuthenticated: boolean) => void;
}

const Authentication: React.FC<AuthenticationProps> = ({ onAuthChange }) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    isAuthenticated: false,
    username: null,
    avatarUrl: null
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Handle OAuth callback on mount
  useEffect(() => {
    const callbackResult = authService.handleOAuthCallback();
    
    if (callbackResult) {
      // Authentication successful - token stored in localStorage
      setAuthStatus({
        isAuthenticated: true,
        username: callbackResult.username,
        avatarUrl: null
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Refresh auth status to get full user info
      checkAuthStatus();
    } else {
      // Check for error in URL
      const urlParams = new URLSearchParams(window.location.search);
      const authResult = urlParams.get('auth');
      const errorMessage = urlParams.get('message');
      
      if (authResult === 'error') {
        setError(errorMessage ? decodeURIComponent(errorMessage) : 'Authentication failed');
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Notify parent component of auth changes
  useEffect(() => {
    if (onAuthChange) {
      onAuthChange(authStatus.isAuthenticated);
    }
  }, [authStatus.isAuthenticated, onAuthChange]);

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const status = await authService.getAuthStatus();
      setAuthStatus(status);
    } catch (err) {
      setError('Failed to check authentication status');
      console.error('Auth status check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setError(null);
      const oauthUrl = await authService.initiateGitHubLogin();
      // Redirect to GitHub OAuth page
      window.location.href = oauthUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate login');
      console.error('Login error:', err);
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      setError(null);
      await authService.logout();
      
      setAuthStatus({
        isAuthenticated: false,
        username: null,
        avatarUrl: null
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to logout');
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div className="loading">Loading authentication status...</div>
      </div>
    );
  }

  return (
    <div className="landing-page">
      <div className="landing-background">
        <div className="glow-circle top-left"></div>
        <div className="glow-circle bottom-right"></div>
      </div>
      
      <div className="landing-content">
        <div className="landing-text">
          <h1 className="landing-title">
            <span className="text-gradient">Proactive Security</span> for your DevOps flow
          </h1>
          <p className="landing-subtitle">
            Seamlessly integrate AI-assisted threat detection and mitigation into your CI/CD pipeline. Protect your repositories with continuous analysis.
          </p>
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

        <div className="auth-box">
          {authStatus.isAuthenticated ? (
            <div className="authenticated-user">
              <div className="user-info">
                {authStatus.avatarUrl && (
                  <img 
                    src={authStatus.avatarUrl} 
                    alt={`${authStatus.username}'s avatar`}
                    className="user-avatar"
                  />
                )}
                <span className="username">Welcome back, {authStatus.username}</span>
              </div>
              <button 
                onClick={handleLogout}
                disabled={loggingOut}
                className="secondary-button"
                aria-label="Logout"
              >
                {loggingOut ? 'Logging out...' : 'Go to Dashboard'}
              </button>
            </div>
          ) : (
            <div className="login-section">
              <p className="login-prompt">Get started by authenticating with your provider</p>
              <button 
                onClick={handleLogin}
                className="primary-login-button"
                aria-label="Login with GitHub"
              >
                <svg viewBox="0 0 24 24" className="github-icon" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Sign in with GitHub
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Authentication;
