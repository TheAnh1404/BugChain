import { useState, useEffect } from 'react';
import TopNavBar from './components/TopNavBar';
import SideNavBar from './components/SideNavBar';
import LandingPage from './views/LandingPage';
import BountyMarketplace from './views/BountyMarketplace';
import BountyDetails from './views/BountyDetails';
import SubmitReport from './views/SubmitReport';
import ResearcherDashboard from './views/ResearcherDashboard';
import AuthPage from './views/AuthPage';
import VerifyEmail from './views/VerifyEmail';
import ProfileSettings from './views/ProfileSettings';
import CreateBounty from './views/CreateBounty';
import AnalyticsDashboard from './views/AnalyticsDashboard';
import OrganizationConsole from './views/OrganizationConsole';
import { useAuth } from './context/AuthContext';

const protectedViews = new Set([
  'dashboard',
  'submit',
  'profile',
  'create-bounty',
  'analytics',
  'organizations',
]);

function App() {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const [currentView, setCurrentView] = useState('landing');
  const [selectedBountyId, setSelectedBountyId] = useState(null);
  const [tokenParam, setTokenParam] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const path = window.location.pathname;

    if ((path.includes('/verify-email') || window.location.href.includes('/verify-email')) && token) {
      setTimeout(() => {
        setTokenParam(token);
        setCurrentView('verify-email');
      }, 0);
      window.history.replaceState({}, document.title, '/');
    } else if ((path.includes('/reset-password') || window.location.href.includes('/reset-password')) && token) {
      setTimeout(() => {
        setTokenParam(token);
        setCurrentView('reset-password');
      }, 0);
      window.history.replaceState({}, document.title, '/');
    }
  }, []);

  const handleSelectBounty = (bounty) => {
    setSelectedBountyId(bounty.id);
    setCurrentView('details');
  };

  const handleSubmitReport = (bounty) => {
    if (!isAuthenticated) {
      setCurrentView('login');
      return;
    }

    setSelectedBountyId(bounty.id);
    setCurrentView('submit');
  };

  const handleCreatedBounty = (bounty) => {
    setSelectedBountyId(bounty.id);
    setCurrentView('details');
  };

  const shouldShowSidebar = !['landing', 'login', 'register'].includes(currentView);
  const needsAuth = protectedViews.has(currentView);

  const renderCurrentView = () => {
    if (isBootstrapping) {
      return (
        <div className="flex min-h-[calc(100vh-80px)] flex-1 items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-5xl text-[#d2bbff]">
            progress_activity
          </span>
        </div>
      );
    }

    if (needsAuth && !isAuthenticated) {
      return <AuthPage mode="login" setCurrentView={setCurrentView} />;
    }

    if (currentView === 'verify-email') {
      return <VerifyEmail token={tokenParam} setCurrentView={setCurrentView} />;
    }

    if (currentView === 'reset-password') {
      return <AuthPage mode="reset-password" token={tokenParam} setCurrentView={setCurrentView} />;
    }

    if (currentView === 'landing') {
      return (
        <LandingPage
          setCurrentView={setCurrentView}
          isAuthenticated={isAuthenticated}
        />
      );
    }

    if (currentView === 'login') {
      return <AuthPage mode="login" setCurrentView={setCurrentView} />;
    }

    if (currentView === 'register') {
      return <AuthPage mode="register" setCurrentView={setCurrentView} />;
    }

    if (currentView === 'marketplace') {
      return (
        <BountyMarketplace
          onSelectBounty={handleSelectBounty}
          setCurrentView={setCurrentView}
        />
      );
    }

    if (currentView === 'details') {
      return (
        <BountyDetails
          bountyId={selectedBountyId}
          onBack={() => setCurrentView('marketplace')}
          onSubmitReport={handleSubmitReport}
          onDeleted={() => {
            setSelectedBountyId(null);
            setCurrentView('marketplace');
          }}
        />
      );
    }

    if (currentView === 'submit') {
      return (
        <SubmitReport
          selectedBountyId={selectedBountyId}
          setCurrentView={setCurrentView}
        />
      );
    }

    if (currentView === 'dashboard') {
      return <ResearcherDashboard setCurrentView={setCurrentView} />;
    }

    if (currentView === 'profile') {
      return <ProfileSettings />;
    }

    if (currentView === 'create-bounty') {
      return (
        <CreateBounty
          onCreated={handleCreatedBounty}
          setCurrentView={setCurrentView}
        />
      );
    }

    if (currentView === 'analytics') {
      return <AnalyticsDashboard />;
    }

    if (currentView === 'organizations') {
      return <OrganizationConsole />;
    }

    return (
      <BountyMarketplace
        onSelectBounty={handleSelectBounty}
        setCurrentView={setCurrentView}
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col font-sans antialiased">
      <TopNavBar
        currentView={currentView}
        setCurrentView={setCurrentView}
      />

      {shouldShowSidebar ? (
        <div className="flex-1 flex relative">
          <SideNavBar currentView={currentView} setCurrentView={setCurrentView} />
          <main className="flex-1 flex flex-col bg-[#0A0A0A] overflow-x-hidden min-h-[calc(100vh-80px)]">
            {renderCurrentView()}
          </main>
        </div>
      ) : (
        renderCurrentView()
      )}
    </div>
  );
}

export default App;
