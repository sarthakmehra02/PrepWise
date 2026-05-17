import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { Mic, Mail, Lock, ArrowRight, Shield } from 'lucide-react';

const GOOGLE_ERRORS = {
  'auth/popup-closed-by-user':    'Sign-in popup was closed. Please try again.',
  'auth/popup-blocked':           'Popup was blocked. Please allow popups for this site.',
  'auth/cancelled-popup-request': 'Only one sign-in popup can be open at a time.',
  'auth/configuration-not-found': 'Google sign-in is not configured yet.',
  'auth/network-request-failed':  'Network error. Check your connection.',
  'auth/email-already-in-use':    'An account with this email already exists.',
  'auth/weak-password':           'Password must be at least 6 characters.',
  'auth/invalid-email':           'Please enter a valid email address.',
};
function friendlyError(err) { return GOOGLE_ERRORS[err.code] || err.message; }

/* ── Password Strength ─────────────────────────────────────── */
function getStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9!@#$%^&*]/.test(pw)) score++;
  return score;
}

const STRENGTH_COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E'];
const STRENGTH_LABELS = ['Weak', 'Fair', 'Good', 'Strong'];

function PasswordStrength({ password }) {
  const score = getStrength(password);
  if (!password) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1.5 mb-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex-1 h-1.5 rounded-full transition-all duration-400"
            style={{ background: i < score ? STRENGTH_COLORS[score - 1] : 'var(--border-subtle)' }} />
        ))}
      </div>
      {score > 0 && (
        <p className="text-xs font-medium" style={{ color: STRENGTH_COLORS[score - 1] }}>
          {STRENGTH_LABELS[score - 1]}
        </p>
      )}
    </div>
  );
}

/* ── Left Panel ────────────────────────────────────────────── */
function LeftPanel() {
  const perks = [
    { icon: '🎙️', title: 'Real-time Voice AI', desc: 'Sub-500ms voice conversations' },
    { icon: '📊', title: 'Instant Scorecard', desc: 'Detailed performance breakdown' },
    { icon: '🧠', title: '8+ Interview Types', desc: 'Every domain covered' },
  ];

  return (
    <div className="hidden lg:flex flex-col items-center justify-center relative w-1/2 overflow-hidden p-12 border-r border-white/5">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span className="font-display font-bold text-white" style={{ fontSize: '15vh', opacity: 0.03 }}>PREP WISE</span>
      </div>
      <div className="aurora-blob-a" style={{ opacity: 0.06 }} />
      <div className="aurora-blob-b" style={{ opacity: 0.04 }} />

      <div className="relative z-10 text-center mb-12">
        <div className="w-24 h-24 rounded-2xl mx-auto mb-6 flex items-center justify-center relative group overflow-hidden"
          style={{ background: 'linear-gradient(135deg, var(--accent-violet), var(--accent-indigo))', boxShadow: '0 0 40px rgba(124,58,237,0.4)' }}>
          <img src="/logo.png" alt="Prep Wise" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <h2 className="font-display text-3xl font-bold text-[var(--text-primary)] mb-3">Start Your Journey</h2>
        <p className="text-[var(--text-secondary)] max-w-xs mx-auto text-sm leading-relaxed">
          Start practicing real technical interviews with AI-powered agents to land your dream job.
        </p>
      </div>

      <div className="relative z-10 flex flex-col gap-4 w-72">
        {perks.map((p, i) => (
          <div key={i} className="glass-card px-5 py-4 flex items-center gap-4 float-card" style={{ animationDelay: `${-i * 1.3}s` }}>
            <span className="text-2xl">{p.icon}</span>
            <div>
              <p className="font-semibold text-[var(--text-primary)] text-sm">{p.title}</p>
              <p className="text-[var(--text-muted)] text-xs">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [agreed,   setAgreed]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [shake,    setShake]    = useState(false);
  const navigate = useNavigate();

  const showError = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!agreed) { showError('Please accept the terms to continue.'); return; }
    setError(''); setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
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
            <h1 className="font-display text-3xl font-bold gradient-text mb-1">Create Account</h1>
            <p className="text-[var(--text-muted)] text-sm mb-8">Start your AI interview prep journey</p>

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
              Register with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--border-subtle))' }} />
              <span className="text-[var(--text-muted)] text-xs">or</span>
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, var(--border-subtle), transparent)' }} />
            </div>

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="neo-input" style={{ paddingLeft: '44px' }} placeholder="you@example.com" />
              </div>

              <div>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                  <input type="password" required minLength="6" value={password} onChange={e => setPassword(e.target.value)}
                    className="neo-input" style={{ paddingLeft: '44px' }} placeholder="Min 6 characters" />
                </div>
                <PasswordStrength password={password} />
              </div>

              {/* Terms checkbox */}
              <label className="flex items-start gap-3 cursor-pointer group mt-2">
                <div className="relative mt-0.5 flex-shrink-0">
                  <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="sr-only" />
                  <div className="w-5 h-5 rounded flex items-center justify-center transition-all"
                    style={{
                      background: agreed ? 'linear-gradient(135deg, var(--accent-violet), var(--accent-indigo))' : 'var(--bg-surface)',
                      border: agreed ? 'none' : '1px solid var(--border-subtle)',
                      boxShadow: agreed ? '0 0 12px rgba(124,58,237,0.4)' : 'none',
                    }}>
                    {agreed && (
                      <svg viewBox="0 0 12 10" width="12" height="10" style={{ animation: 'checkIn 0.25s ease forwards' }}>
                        <polyline points="1,5 4,8 11,1" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-xs text-[var(--text-muted)] leading-relaxed">
                  I agree to the{' '}
                  <span className="text-[var(--accent-violet)] hover:underline cursor-pointer">Terms of Service</span>
                  {' '}and{' '}
                  <span className="text-[var(--accent-violet)] hover:underline cursor-pointer">Privacy Policy</span>
                </span>
              </label>

              <button type="submit" disabled={loading || !agreed} className="btn-glow w-full mt-2" style={{ padding: '14px' }}>
                {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                  : <><Shield size={16} /><span>Create Account</span><ArrowRight size={16} /></>}
              </button>
            </form>

            <p className="text-center text-sm text-[var(--text-muted)] mt-6">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold hover:underline" style={{ color: 'var(--accent-violet)' }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
