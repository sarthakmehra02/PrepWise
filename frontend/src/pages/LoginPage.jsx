import { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { Mic, Mail, Lock, ArrowRight } from 'lucide-react';

const GOOGLE_ERRORS = {
  'auth/popup-closed-by-user':    'Sign-in popup was closed. Please try again.',
  'auth/popup-blocked':           'Popup was blocked. Please allow popups for this site.',
  'auth/cancelled-popup-request': 'Only one sign-in popup can be open at a time.',
  'auth/configuration-not-found': 'Google sign-in is not configured yet.',
  'auth/network-request-failed':  'Network error. Check your connection.',
  'auth/user-not-found':          'No account found with this email.',
  'auth/wrong-password':          'Incorrect password. Please try again.',
  'auth/invalid-email':           'Please enter a valid email address.',
  'auth/too-many-requests':       'Too many attempts. Please wait and try again.',
  'auth/invalid-credential':      'Invalid email or password.',
};
function friendlyError(err) { return GOOGLE_ERRORS[err.code] || err.message; }

const ROLES = ['Full Stack Dev', 'AI/ML Engineer', 'Data Analyst', 'Backend Engineer', 'DevOps / SRE', 'System Design'];

function LeftPanel() {
  const [idx, setIdx] = useState(0);
  useState(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % ROLES.length), 2200);
    return () => clearInterval(t);
  });

  return (
    <div className="hidden lg:flex flex-col items-center justify-center relative w-1/2 overflow-hidden p-12 border-r border-white/5">
      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span className="font-display font-bold text-white"
          style={{ fontSize: '15vh', opacity: 0.03, whiteSpace: 'nowrap' }}>PREP WISE</span>
      </div>

      {/* Aurora blobs */}
      <div className="aurora-blob-a" style={{ opacity: 0.06 }} />
      <div className="aurora-blob-c" style={{ opacity: 0.05 }} />

      {/* Rotating role text */}
      <div className="relative z-10 text-center mb-16">
        <p className="text-[var(--text-muted)] text-sm uppercase tracking-widest mb-4">Practice for</p>
        <div className="h-16 overflow-hidden">
          <div style={{ transform: `translateY(-${idx * 64}px)`, transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)' }}>
            {ROLES.map((r, i) => (
              <div key={i} className="h-16 flex items-center justify-center">
                <span className="font-display text-4xl font-bold gradient-text">{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating micro-cards */}
      <div className="relative z-10 flex flex-col gap-4 w-64">
        {['✓ Real-time Voice AI', '✓ Instant AI Feedback', '✓ 8+ Interview Types'].map((txt, i) => (
          <div key={i} className="glass-card px-5 py-3 float-card text-[var(--text-secondary)] text-sm font-medium text-center"
            style={{ animationDelay: `${-i * 1.3}s` }}>{txt}</div>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [email,    setEmail]   = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]   = useState('');
  const [loading,  setLoading] = useState(false);
  const [shake,    setShake]   = useState(false);
  const navigate = useNavigate();

  const showError = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dashboard');
    } catch (err) { showError(friendlyError(err)); }
    finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(''); setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/dashboard');
    } catch (err) { showError(friendlyError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-void)' }}>
      <LeftPanel />

      {/* Right Panel */}
      <div className="flex items-center justify-center p-6 w-full lg:w-1/2">
        <div className="w-full max-w-[420px] page-enter">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 mb-10 group">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 shadow-lg shadow-violet-500/20 border border-white/10 group-hover:scale-110 transition-transform">
              <img src="/logo.png" alt="Prep Wise Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-display text-2xl font-bold text-[var(--text-primary)] tracking-tight">Prep Wise</span>
          </Link>

          <div className="glass-card p-8">
            <h1 className="font-display text-3xl font-bold gradient-text mb-1">Welcome Back</h1>
            <p className="text-[var(--text-muted)] text-sm mb-8">Sign in to continue your prep journey</p>

            {/* Error */}
            {error && (
              <div className={`mb-5 p-3 rounded-xl text-sm font-medium text-red-400 border border-red-500/20 bg-red-500/10 ${shake ? 'error-shake' : ''}`}>
                {error}
              </div>
            )}

            {/* Google */}
            <button onClick={handleGoogle} disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-semibold text-sm mb-6 transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--border-subtle))' }} />
              <span className="text-[var(--text-muted)] text-xs">or</span>
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, var(--border-subtle), transparent)' }} />
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="neo-input" style={{ paddingLeft: '44px' }} placeholder="you@example.com" />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="neo-input" style={{ paddingLeft: '44px' }} placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading} className="btn-glow w-full mt-2" style={{ padding: '14px' }}>
                {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                  : <><span>Sign In</span><ArrowRight size={16} /></>}
              </button>
            </form>

            <p className="text-center text-sm text-[var(--text-muted)] mt-6">
              No account?{' '}
              <Link to="/register" className="font-semibold hover:text-[var(--accent-violet)] transition-colors"
                style={{ color: 'var(--accent-violet)' }}>Create one free</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
