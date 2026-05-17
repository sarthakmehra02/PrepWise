import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Mic, Code2, BarChart2, ChevronDown, Zap, Brain, Sun, Moon } from 'lucide-react';

/* ── Animated Hero Orb ─────────────────────────────────────── */
function HeroOrb({ isDark }) {
  const orbRef = useRef(null);
  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;
    const handleMove = (e) => {
      const rect = orb.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      const rx = dy * 12;
      const ry = -dx * 12;
      orb.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  const particles = [
    { r: 180, delay: 0,    size: 4, dur: 8 },
    { r: 180, delay: -1.5, size: 3, dur: 8 },
    { r: 200, delay: -3,   size: 2, dur: 11 },
    { r: 200, delay: -5,   size: 3, dur: 11 },
    { r: 160, delay: -2,   size: 2, dur: 7 },
    { r: 160, delay: -4,   size: 4, dur: 7 },
    { r: 220, delay: -1,   size: 2, dur: 14 },
    { r: 220, delay: -6,   size: 3, dur: 14 },
    { r: 140, delay: -3.5, size: 2, dur: 6 },
    { r: 140, delay: -5.5, size: 3, dur: 6 },
    { r: 240, delay: -2.5, size: 2, dur: 16 },
    { r: 240, delay: -7,   size: 3, dur: 16 },
  ];

  const waveHeights = [8, 16, 24, 32, 28, 36, 24, 32, 20, 28, 16, 24, 18, 30, 22, 36, 28, 20, 14, 26];

  const innerOrbGradient = isDark
    ? 'radial-gradient(circle at 35% 35%, #9F7AEA, #4F46E5, #02020D)'
    : 'radial-gradient(circle at 35% 35%, #7C3AED, #2563EB, #1E3A8A)';

  const innerOrbShadow = isDark
    ? '0 0 80px rgba(124,58,237,0.5), 0 0 160px rgba(124,58,237,0.2), inset 0 0 60px rgba(0,0,0,0.8)'
    : '0 0 60px rgba(124,58,237,0.3), 0 0 120px rgba(37,99,235,0.15), inset 0 0 40px rgba(0,0,0,0.4)';

  return (
    <div className="relative w-[400px] h-[400px] flex-shrink-0 hidden lg:flex items-center justify-center">
      <div ref={orbRef} className="relative w-full h-full" style={{ transition: 'transform 0.1s ease', willChange: 'transform' }}>
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full"
          style={{
            border: `1px solid ${isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.15)'}`,
            animation: 'spinCW 20s linear infinite',
          }} />
        {/* Middle ring */}
        <div className="absolute inset-[50px] rounded-full"
          style={{
            border: `1px solid ${isDark ? 'rgba(6,182,212,0.15)' : 'rgba(37,99,235,0.12)'}`,
            animation: 'spinCCW 15s linear infinite',
          }} />
        {/* Inner orb */}
        <div className="absolute inset-[80px] rounded-full"
          style={{ background: innerOrbGradient, boxShadow: innerOrbShadow }} />
        {/* Particles */}
        {particles.map((p, i) => (
          <div key={i} className="absolute top-1/2 left-1/2"
            style={{
              '--orbit-r': `${p.r}px`,
              '--orbit-start': `${i * 30}deg`,
              width: `${p.size}px`, height: `${p.size}px`,
              marginTop: `-${p.size / 2}px`, marginLeft: `-${p.size / 2}px`,
              borderRadius: '50%',
              background: i % 2 === 0 ? 'var(--accent-violet)' : 'var(--accent-cyan)',
              animation: `orbit ${p.dur}s linear ${p.delay}s infinite`,
              willChange: 'transform',
            }} />
        ))}
      </div>
      {/* Waveform */}
      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-end gap-[3px]">
        {waveHeights.map((h, i) => (
          <div key={i} style={{
            width: '3px', borderRadius: '2px', minHeight: '4px',
            background: 'linear-gradient(to top, var(--accent-violet), var(--accent-cyan))',
            '--wave-h': `${h}px`,
            animation: `waveBar 1.4s ease-in-out ${i * 0.07}s infinite`,
            willChange: 'height',
          }} />
        ))}
      </div>
    </div>
  );
}

/* ── Feature Cards ─────────────────────────────────────────── */
const FEATURES = [
  { icon: Mic,      color: '#7C3AED', glow: 'rgba(124,58,237,0.25)', title: 'Real Voice AI',      desc: 'Sub-500ms latency voice agents that feel like a real recruiter. No scripts — adaptive, live conversation.' },
  { icon: Brain,    color: '#06B6D4', glow: 'rgba(6,182,212,0.2)',   title: 'Technical Rigor',    desc: 'Domain-specific questions powered by AI — tailored to your stack, experience, and target company.' },
  { icon: BarChart2, color: '#F59E0B', glow: 'rgba(245,158,11,0.2)', title: 'Instant Scorecard', desc: 'Detailed performance report grading communication, depth of knowledge, and problem solving.' },
];

function FeatureCards() {
  const cardRefs = useRef([]);
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.style.animationPlayState = 'running';
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.2 });
    cardRefs.current.forEach(el => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
      {FEATURES.map((f, i) => {
        const Icon = f.icon;
        return (
          <div key={i} ref={el => cardRefs.current[i] = el}
            className="glass-card p-8 relative overflow-hidden group"
            style={{ opacity: 0, animation: `pageReveal 0.6s cubic-bezier(0.4,0,0.2,1) calc(${i}*120ms) forwards`, animationPlayState: 'paused' }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 relative"
              style={{ background: `${f.color}15`, boxShadow: `0 0 20px ${f.glow}` }}>
              <Icon size={22} style={{ color: f.color }} />
            </div>
            <h3 className="font-display text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{f.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
            <div className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-500 rounded-b-2xl"
              style={{ background: `linear-gradient(90deg, ${f.color}, transparent)` }} />
          </div>
        );
      })}
    </div>
  );
}

/* ── How It Works ──────────────────────────────────────────── */
const STEPS = [
  { n: '01', title: 'Set Your Profile',    desc: 'Choose your role, experience level, and optionally upload your resume for personalised questions.' },
  { n: '02', title: 'Start Voice Session', desc: 'Talk to the AI interviewer. Answer naturally — it adapts and challenges you in real-time.' },
  { n: '03', title: 'Get Your Scorecard',  desc: 'Receive a detailed performance report with scores, strengths, and areas to improve.' },
];

function HowItWorks() {
  return (
    <div className="mt-32">
      <div className="text-center mb-16">
        <p className="font-semibold text-sm uppercase tracking-widest mb-3" style={{ color: 'var(--accent-cyan)' }}>The Process</p>
        <h2 className="font-display text-4xl font-bold section-title" style={{ color: 'var(--text-primary)' }}>How It Works</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
        {/* Connector line */}
        <div className="hidden md:block absolute top-12 left-1/4 right-1/4 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, var(--accent-violet), var(--accent-cyan), transparent)' }} />
        {STEPS.map((s, i) => (
          <div key={i} className="glass-card p-8 text-center stagger-child" style={{ '--i': i }}>
            <div className="gradient-text font-display text-6xl font-bold mb-4 leading-none">{s.n}</div>
            <h3 className="font-display text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{s.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Navbar ────────────────────────────────────────────────── */
function Navbar({ isDark, setIsDark }) {
  const [scrolled, setScrolled] = useState(false);
  const [showScroll, setShowScroll] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      setShowScroll(window.scrollY < 100);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navBg = scrolled
    ? isDark ? 'rgba(5,5,16,0.88)' : 'rgba(248,250,252,0.88)'
    : 'transparent';

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 px-6 md:px-10 py-4 flex items-center justify-between transition-all duration-300"
        style={{
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: `1px solid ${scrolled ? 'var(--border-subtle)' : 'transparent'}`,
          boxShadow: scrolled ? '0 1px 0 var(--border-glow), 0 8px 32px rgba(0,0,0,0.08)' : 'none',
          background: navBg,
        }}
      >
        <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 shadow-lg shadow-violet-500/20 border border-white/10">
            <img src="/logo.png" alt="Prep Wise Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Prep Wise
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="nav-link text-sm">Features</a>
          <a href="#how" className="nav-link text-sm">How It Works</a>
          <Link to="/login" className="nav-link text-sm">Login</Link>

          {/* Theme toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-lg transition-all hover:scale-110"
            style={{
              background: 'var(--secondary)',
              color: isDark ? 'var(--accent-gold)' : 'var(--accent-blue)',
              border: '1px solid var(--border-subtle)',
            }}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <Link to="/register" className="btn-glow text-sm" style={{ padding: '8px 20px' }}>
            Sign Up Free
          </Link>
        </nav>

        {/* Mobile */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-lg transition-all"
            style={{ background: 'var(--secondary)', color: isDark ? 'var(--accent-gold)' : 'var(--accent-blue)', border: '1px solid var(--border-subtle)' }}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <Link to="/register" className="btn-glow text-sm" style={{ padding: '8px 16px' }}>Sign Up</Link>
        </div>
      </header>

      {/* Scroll indicator */}
      <div
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1 transition-opacity duration-500"
        style={{ opacity: showScroll ? 1 : 0, pointerEvents: 'none' }}
      >
        <ChevronDown size={20} style={{ color: 'var(--accent-violet)', animation: 'bounceSlow 2s ease-in-out infinite' }} />
      </div>
    </>
  );
}

/* ── Main Landing Page ─────────────────────────────────────── */
export default function LandingPage({ isDark, setIsDark }) {
  return (
    <div className="aurora-bg min-h-screen" style={{ color: 'var(--text-primary)' }}>
      <div className="aurora-blob-a" />
      <div className="aurora-blob-b" />
      <div className="aurora-blob-c" />

      <Navbar isDark={isDark} setIsDark={setIsDark} />

      {/* Hero */}
      <section className="relative z-10 min-h-screen flex items-center pt-20 px-6 md:px-10">
        <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row items-center justify-between gap-16">
          {/* Text */}
          <div className="flex-1 max-w-2xl page-enter">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 glass-card px-4 py-2 mb-8 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0"
                style={{ boxShadow: '0 0 8px rgba(74,222,128,0.8)', animation: 'pulseRing 2s ease-out infinite' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Real-time AI Voice Interview Practice
              </span>
            </div>

            <h1 className="font-display font-bold leading-[1.05] mb-6">
              <span style={{ fontSize: 'clamp(2.5rem, 5vw, 5rem)', color: 'var(--text-primary)' }}>
                Nail your next<br />interview with
              </span>
              <br />
              <span className="gradient-text block" style={{ fontSize: 'clamp(2.5rem, 5vw, 5rem)' }}>
                AI Voice Practice.
              </span>
            </h1>

            <p className="text-lg md:text-xl leading-relaxed max-w-[560px] mb-10" style={{ color: 'var(--text-secondary)' }}>
              Prep Wise simulates real-time, high-pressure technical interviews using advanced AI voice agents.
              Speak naturally and get instantly graded.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link to="/register" className="btn-glow text-base" style={{ padding: '14px 32px' }}>
                <Zap size={18} /> Get Started Free
              </Link>
              <Link to="/login" className="btn-ghost text-base" style={{ padding: '14px 32px' }}>
                Sign In
              </Link>
            </div>
          </div>

          {/* Orb */}
          <HeroOrb isDark={isDark} />
        </div>
      </section>

      {/* Content Sections */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 pb-32">

        {/* Features */}
        <section id="features">
          <div className="text-center">
            <p className="font-semibold text-sm uppercase tracking-widest mb-3" style={{ color: 'var(--accent-cyan)' }}>What You Get</p>
            <h2 className="font-display text-4xl font-bold section-title" style={{ color: 'var(--text-primary)' }}>Everything to Succeed</h2>
            <p className="mt-6 max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>Stop freezing up. Practice until it's instinct.</p>
          </div>
          <FeatureCards />
        </section>

        {/* How It Works */}
        <section id="how"><HowItWorks /></section>

        {/* CTA */}
        <div className="glass-card p-16 text-center mt-32" style={{ background: 'rgba(124,58,237,0.05)' }}>
          <h2 className="font-display text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Ready to dominate your next interview?</h2>
          <p className="mb-8 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>Practice real-world technical interviews and land your dream job using Prep Wise.</p>
          <Link to="/register" className="btn-glow text-lg" style={{ padding: '16px 40px' }}>
            Start Practicing Free
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-6 md:px-10 text-center text-sm"
        style={{
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-md overflow-hidden opacity-80">
            <img src="/logo.png" alt="" className="w-full h-full object-cover" />
          </div>
          <span className="font-display font-bold" style={{ color: 'var(--text-secondary)' }}>Prep Wise</span>
        </div>
        <p>© {new Date().getFullYear()} Prep Wise. AI-powered interview preparation.</p>
      </footer>
    </div>
  );
}
