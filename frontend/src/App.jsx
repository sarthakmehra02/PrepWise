import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Sidebar from './components/Sidebar';

// Lazy loaded pages for performance
const InterviewerTab = lazy(() => import('./pages/InterviewerTab'));
const ResumeAnalyzer  = lazy(() => import('./pages/ResumeAnalyzer'));
const ResumeEditor    = lazy(() => import('./pages/ResumeEditor'));
const SavedData       = lazy(() => import('./pages/SavedData'));

// Loading component for lazy routes
const PageLoader = () => (
  <div className="h-full w-full flex items-center justify-center" style={{ background: 'var(--bg-void)' }}>
    <div className="flex flex-col items-center gap-3">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Loading…</span>
    </div>
  </div>
);

// Layout Component
const DashboardLayout = ({ user, isDark, setIsDark }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="h-screen w-screen flex overflow-hidden"
      style={{ background: 'var(--bg-void)', color: 'var(--text-primary)' }}
    >
      <Sidebar
        user={user}
        isDark={isDark}
        setIsDark={setIsDark}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
      <div
        className="flex-1 h-full overflow-y-auto transition-all duration-300"
        style={{ padding: collapsed ? '0' : undefined }}
      >
        <Outlet context={{ user, isDark, setIsDark }} />
      </div>
    </div>
  );
};

function App() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark]   = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-void)', color: 'var(--text-primary)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(14,165,233,0.3)', borderTopColor: 'var(--accent-blue)' }} />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading Prep Wise…</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<LandingPage isDark={isDark} setIsDark={setIsDark} />} />
        <Route path="/login"    element={!user ? <LoginPage />    : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to="/dashboard" />} />

        {/* Protected Dashboard Layout with Nested Routes */}
        <Route path="/dashboard" element={user ? <DashboardLayout user={user} isDark={isDark} setIsDark={setIsDark} /> : <Navigate to="/login" />}>
          <Route index element={
            <Suspense fallback={<PageLoader />}>
              <InterviewerTab user={user} isDark={isDark} setIsDark={setIsDark} />
            </Suspense>
          } />
          <Route path="analyzer" element={
            <Suspense fallback={<PageLoader />}>
              <ResumeAnalyzer />
            </Suspense>
          } />
          <Route path="editor" element={
            <Suspense fallback={<PageLoader />}>
              <ResumeEditor />
            </Suspense>
          } />
          <Route path="saved" element={
            <Suspense fallback={<PageLoader />}>
              <SavedData user={user} />
            </Suspense>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
