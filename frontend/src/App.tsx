import React, { useState, useEffect } from 'react';
import Authentication from './components/Authentication';
import RepositoryList from './components/RepositoryList';
import DashboardContainer from './components/DashboardContainer';
import ReportHistory from './components/ReportHistory';
import { NotificationProvider } from './contexts/NotificationContext';
import Notification from './components/Notification';
import { authService } from './services/authService';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedRepository, setSelectedRepository] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'repositories' | 'dashboard' | 'history'>('repositories');
  const [loading, setLoading] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const status = await authService.getAuthStatus();
      setIsAuthenticated(status.isAuthenticated);
    } catch (error) {
      console.error('Failed to check auth status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthChange = (authenticated: boolean) => {
    setIsAuthenticated(authenticated);
    if (!authenticated) {
      setSelectedRepository(null);
      setCurrentView('repositories');
    }
  };

  const handleScanComplete = (reportIds: string[]) => {
    console.log('Scan completed with report IDs:', reportIds);
    // Optionally switch to history view to show the new reports
    if (reportIds.length > 0) {
      setCurrentView('history');
    }
  };

  const handleRepositorySelect = (repoId: string) => {
    setSelectedRepository(repoId);
    setCurrentView('dashboard');
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2rem'
      }}>
        Loading...
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await authService.logout();
      setIsAuthenticated(false);
      setSelectedRepository(null);
      setCurrentView('repositories');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <NotificationProvider>
      <div className="app-container">
        {!isAuthenticated ? (
          <Authentication onAuthChange={handleAuthChange} />
        ) : (
          <div className="authenticated-layout">
            <header className="app-header">
              <div className="header-content">
                <div className="header-title">
                  <h1>DevSecOps Platform</h1>
                  <p>AI-Assisted Proactive Threat Detection and Mitigation</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="logout-button"
                >
                  Logout
                </button>
              </div>
            </header>

            <nav className="app-nav">
              <button
                className={`nav-button ${currentView === 'repositories' ? 'active' : ''}`}
                onClick={() => setCurrentView('repositories')}
              >
                Repositories
              </button>
              <button
                className={`nav-button ${currentView === 'dashboard' ? 'active' : ''}`}
                onClick={() => setCurrentView('dashboard')}
              >
                Vulnerabilities
              </button>
              <button
                className={`nav-button ${currentView === 'history' ? 'active' : ''}`}
                onClick={() => setCurrentView('history')}
              >
                Scan History
              </button>
            </nav>

            <main className="app-content">
              {currentView === 'repositories' && (
                <RepositoryList onScanComplete={handleScanComplete} />
              )}
              {currentView === 'dashboard' && (
                <DashboardContainer />
              )}
              {currentView === 'history' && (
                <ReportHistory />
              )}
            </main>
          </div>
        )}
      </div>
    </NotificationProvider>
  );
};

export default App;
