import { NavLink, Link } from 'react-router-dom';
import { Mic, FileText, PenTool, Database, Sparkles, LogOut, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export default function Sidebar({ user, isDark, setIsDark, collapsed, setCollapsed }) {
  const handleLogout = async () => {
    await signOut(auth);
  };

  const links = [
    { name: 'AI Interviewer',  path: '/dashboard',          icon: Mic       },
    { name: 'Resume Analyzer', path: '/dashboard/analyzer', icon: Sparkles  },
    { name: 'Resume Editor',   path: '/dashboard/editor',   icon: PenTool   },
    { name: 'Saved Data',      path: '/dashboard/saved',    icon: Database  },
  ];

  return (
    <div
      className="relative h-full flex-shrink-0 transition-all duration-300"
      style={{ width: collapsed ? '0px' : '256px', overflow: 'visible' }}
    >
      {/* Toggle button — always visible */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="sidebar-toggle-btn"
        style={{
          right: collapsed ? '-28px' : '-14px',
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      >
        {collapsed
          ? <ChevronRight className="w-3.5 h-3.5" />
          : <ChevronLeft  className="w-3.5 h-3.5" />
        }
      </button>

      {/* Sidebar panel */}
      <div
        className="absolute left-0 top-0 h-full flex flex-col transition-all duration-300 overflow-hidden"
        style={{
          width: '256px',
          transform: collapsed ? 'translateX(-100%)' : 'translateX(0)',
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          borderRight: '1px solid var(--border-subtle)',
          boxShadow: '2px 0 16px rgba(0,0,0,0.06)',
        }}
      >
        {/* Logo */}
        <div className="p-6 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <Link to="/" className="text-xl font-bold flex items-center gap-3 hover:opacity-80 transition-opacity" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>
            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 shadow-lg shadow-blue-500/20 border border-white/10">
              <img src="/logo.png" alt="Prep Wise Logo" className="w-full h-full object-cover" />
            </div>
            <span className="tracking-tight">Prep Wise</span>
          </Link>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.name}
              to={link.path}
              end={link.path === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                  isActive
                    ? 'text-[var(--accent-blue)] border'
                    : 'hover:bg-secondary/70 hover:text-foreground text-muted-foreground'
                }`
              }
              style={({ isActive }) => isActive ? {
                background: 'rgba(14,165,233,0.08)',
                borderColor: 'rgba(14,165,233,0.25)',
              } : {}}
            >
              <link.icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{link.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom: user + theme + logout */}
        <div className="p-4 border-t space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
          {/* User email + theme toggle */}
          <div className="flex items-center justify-between px-2 gap-2">
            <span className="text-xs truncate max-w-[140px]" style={{ color: 'var(--text-muted)' }}>
              {user?.email}
            </span>
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-lg transition-all hover:scale-110 shrink-0"
              style={{
                background: 'var(--secondary)',
                color: isDark ? 'var(--accent-gold)' : 'var(--accent-blue)',
              }}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark
                ? <Sun  className="w-4 h-4" />
                : <Moon className="w-4 h-4" />
              }
            </button>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-sm px-4 py-2.5 rounded-xl transition-all font-semibold"
            style={{ color: 'var(--destructive)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>
    </div>
  );
}
