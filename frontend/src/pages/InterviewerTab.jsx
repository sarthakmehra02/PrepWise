import { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import Vapi from '@vapi-ai/web';
import { FeedbackModal, GradingOverlay } from '../components/FeedbackModal';
import * as pdfjsLib from 'pdfjs-dist';
// Use the bundled PDF.js worker (Vite resolves this automatically)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

// Suppress expected Daily.co "ejection" console errors during WebRTC handoff
const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('ejection')) return;
  originalConsoleError(...args);
};
import {
  LogOut, Mic, Briefcase, Database, Users, Code, Sparkles,
  Loader2, PhoneOff, Activity, UserSearch, X, ChevronRight,
  Clock, Target, Building2, Moon, Sun, Server, Layers,
  Smartphone, BarChart2, Upload, FileText, FileUp, PenTool
} from 'lucide-react';

const INTERVIEWER_ID = import.meta.env.VITE_VAPI_INTERVIEWER_ID;
const COLLECTOR_ID   = import.meta.env.VITE_VAPI_COLLECTOR_ID;

const INTERVIEW_TYPES = [
  { id: 'fullstack',  name: 'Full Stack Dev',       icon: Code,       tech: 'React, Node.js, SQL',                color: 'blue'   },
  { id: 'aiml',       name: 'AI/ML Engineer',        icon: Sparkles,   tech: 'Python, TensorFlow, PyTorch',        color: 'violet' },
  { id: 'data',       name: 'Data Analyst',          icon: Database,   tech: 'SQL, Python, Tableau',               color: 'cyan'   },
  { id: 'hr',         name: 'HR Interview',          icon: Users,      tech: 'Behavioral, Leadership, Culture Fit', color: 'green'  },
  { id: 'backend',    name: 'Backend Engineer',      icon: Server,     tech: 'APIs, Databases, Caching, Scaling',  color: 'orange' },
  { id: 'devops',     name: 'DevOps / SRE',          icon: Layers,     tech: 'Docker, Kubernetes, CI/CD, Linux',   color: 'red'    },
  { id: 'mobile',     name: 'Mobile Developer',      icon: Smartphone, tech: 'React Native, Swift, Kotlin',        color: 'pink'   },
  { id: 'sysdesign',  name: 'System Design',         icon: BarChart2,  tech: 'Scalability, CAP, Microservices',    color: 'amber'  },
];

const EXPERIENCE_LEVELS = [
  { id: 'intern',   label: 'Intern',       desc: '0–6 mo' },
  { id: 'junior',   label: 'Junior',       desc: '6m–1y'  },
  { id: 'mid',      label: 'Mid',          desc: '2–4 yr' },
  { id: 'senior',   label: 'Senior',       desc: '5–8 yr' },
  { id: 'lead',     label: 'Lead',         desc: '8+ yr'  },
];

const COLOR_MAP = {
  blue:   'bg-blue-500/10   text-blue-400   border-blue-400/30   group-hover:bg-blue-500   group-hover:text-white',
  violet: 'bg-violet-500/10 text-violet-400 border-violet-400/30 group-hover:bg-violet-500 group-hover:text-white',
  cyan:   'bg-cyan-500/10   text-cyan-400   border-cyan-400/30   group-hover:bg-cyan-500   group-hover:text-white',
  green:  'bg-green-500/10  text-green-400  border-green-400/30  group-hover:bg-green-500  group-hover:text-white',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-400/30 group-hover:bg-orange-500 group-hover:text-white',
  red:    'bg-red-500/10    text-red-400    border-red-400/30    group-hover:bg-red-500    group-hover:text-white',
  pink:   'bg-pink-500/10   text-pink-400   border-pink-400/30   group-hover:bg-pink-500   group-hover:text-white',
  amber:  'bg-amber-500/10  text-amber-400  border-amber-400/30  group-hover:bg-amber-500  group-hover:text-white',
};

// ── Interview Config Modal ────────────────────────────────────────
function ConfigModal({ role, onClose, onStart }) {
  const [customRole,   setCustomRole]   = useState(role.isCustom ? '' : role.name);
  const [customTech,   setCustomTech]   = useState('');
  const [level,        setLevel]        = useState('');
  const [focusArea,    setFocusArea]    = useState('');
  const [yearsExp,     setYearsExp]     = useState('');
  const [companyType,  setCompanyType]  = useState('');
  const [customCompany,setCustomCompany]= useState('');
  const [resumeText,   setResumeText]   = useState('');
  const [resumeName,   setResumeName]   = useState('');
  const [resumeLoading,setResumeLoading]= useState(false);
  const resumeInputRef = useRef(null);

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setResumeName(file.name);
    setResumeLoading(true);
    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        const allLinks = new Set();

        for (let i = 1; i <= pdf.numPages; i++) {
          const page    = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(' ') + '\n';

          // Link Extraction Fail-safe
          try {
            const annotations = await page.getAnnotations();
            annotations.forEach(anno => {
              if (anno.subtype === 'Link' && anno.url) {
                allLinks.add(anno.url);
              }
            });
          } catch (e) { /* ignore page link errors */ }
        }

        if (allLinks.size > 0) {
          text += '\n[LINKS]:\n' + Array.from(allLinks).join('\n');
        }

        setResumeText(text.trim());
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => setResumeText(ev.target.result);
        reader.readAsText(file);
      }
    } catch (err) {
      console.error('Resume parse error:', err);
      setResumeName('Error reading file');
    } finally {
      setResumeLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative glass-card rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-6 md:p-7 pb-5 border-b border-border shrink-0">
          <div className="pt-2 flex-1 min-w-0">
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-1 opacity-80">Configure Interview</p>
            {role.isCustom ? (
              <h2 className="text-2xl font-black tracking-tight">Custom Role</h2>
            ) : (
              <>
                <h2 className="text-2xl font-black tracking-tight">{role.name}</h2>
                <p className="text-sm text-muted-foreground font-medium mt-1">{role.tech}</p>
              </>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 md:p-7 space-y-6 overflow-y-auto flex-1">
          {role.isCustom && (
            <div>
              <label className="block text-sm font-bold mb-3 flex items-center gap-2">
                <PenTool className="w-4 h-4 text-primary" /> Target Role Title <span className="text-destructive">*</span>
              </label>
              <input value={customRole} onChange={e => setCustomRole(e.target.value)}
                autoFocus
                placeholder="e.g. Senior Frontend Developer"
                className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background/50 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all font-bold placeholder:text-muted-foreground/30 shadow-[inner_0_2px_4px_rgba(0,0,0,0.1)]" />
            </div>
          )}
          <div>
            <label className="block text-sm font-bold mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> Experience Level <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-5 gap-2">
              {EXPERIENCE_LEVELS.map(l => (
                <button key={l.id} onClick={() => setLevel(l.id)}
                  className={`flex flex-col items-center text-center p-3 rounded-xl border-2 transition-all ${level === l.id ? 'border-primary bg-primary/10 text-primary scale-105 shadow-md' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                  <span className="font-bold text-xs">{l.label}</span>
                  <span className="text-[10px] mt-0.5 opacity-70">{l.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Optional — tailors your questions</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1.5 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> {role.isCustom ? "Job Description / Tech Stack" : "Focus Area"}
                </label>
                {role.isCustom ? (
                  <textarea value={customTech} onChange={e => setCustomTech(e.target.value)}
                    placeholder="Paste the job description or list the technologies..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background/50 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all font-bold placeholder:text-muted-foreground/30 shadow-[inner_0_2px_4px_rgba(0,0,0,0.1)] resize-none" />
                ) : (
                  <input value={focusArea} onChange={e => setFocusArea(e.target.value)}
                    placeholder="e.g. System Design, React Hooks, SQL Optimization…"
                    className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background/50 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all font-bold placeholder:text-muted-foreground/30 shadow-[inner_0_2px_4px_rgba(0,0,0,0.1)]" />
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Years of Exp.
                  </label>
                  <input type="number" min="0" max="40" value={yearsExp} onChange={e => setYearsExp(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background/50 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all font-bold shadow-[inner_0_2px_4px_rgba(0,0,0,0.1)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" /> Target Company
                  </label>
                  <select value={companyType} onChange={e => { setCompanyType(e.target.value); if (e.target.value !== 'custom') setCustomCompany(''); }}
                    className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background/50 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all font-bold shadow-[inner_0_2px_4px_rgba(0,0,0,0.1)]">
                    <option value="">Any / Not Specified</option>
                    <option>FAANG / Big Tech</option>
                    <option>Series A/B Startup</option>
                    <option>Enterprise / MNC</option>
                    <option>Product-based</option>
                    <option>Service-based</option>
                    <option value="custom">Custom...</option>
                  </select>
                  {companyType === 'custom' && (
                    <input autoFocus value={customCompany} onChange={e => setCustomCompany(e.target.value)}
                      placeholder="Enter company name..."
                      className="mt-2 w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Resume Upload */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> Resume — Optional
            </p>
            <div
              onClick={() => resumeInputRef.current?.click()}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                resumeText ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-secondary/50'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                resumeText ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
              }`}>
                {resumeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {resumeLoading ? 'Reading resume…' : resumeText ? resumeName : 'Upload Resume (PDF or TXT)'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {resumeText ? 'AI will tailor questions to your background' : 'Click to upload — helps personalise your interview'}
                </p>
              </div>
              {resumeText && (
                <button onClick={e => { e.stopPropagation(); setResumeText(''); setResumeName(''); }}
                  className="p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive transition shrink-0">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <input ref={resumeInputRef} type="file" accept=".pdf,.txt,.md" className="hidden" onChange={handleResumeUpload} />
          </div>

        </div>

        <div className="px-6 md:px-7 py-5 flex items-center justify-between border-t border-border shrink-0 bg-background/50 rounded-b-3xl">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition">Cancel</button>
          <button onClick={() => { if (level && (!role.isCustom || customRole.trim())) onStart({ experience: EXPERIENCE_LEVELS.find(l => l.id === level)?.label, focusArea: role.isCustom ? customTech : focusArea, yearsExp, companyType: companyType === 'custom' ? customCompany : companyType, resumeText, customRole: role.isCustom ? customRole : null }); }}
            disabled={!level || (role.isCustom && !customRole.trim())}
            className="flex items-center gap-2 btn-glow px-7 py-3.5 disabled:opacity-40 hover:opacity-90 hover:-translate-y-0.5 transition-all shadow-md shadow-primary/20">
            <Mic className="w-4 h-4" /> Start Interview <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Enter Manually Card ─────────────────────────────────────────
function EnterManuallyCard({ onClick, isDisabled }) {
  return (
    <div className="relative glass-card border-violet-400/20 p-7 mb-8 hover:border-violet-400/40 transition-colors">
      <div className="flex flex-col md:flex-row items-start gap-5">
        <div className="w-14 h-14 bg-violet-500/10 text-violet-400 rounded-2xl flex items-center justify-center shrink-0">
          <FileText className="w-7 h-7" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold">Enter manually</h3>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-400/20">Custom Interview</span>
          </div>
          <p className="text-muted-foreground text-sm mb-5">
            Configure a completely custom interview. You can specify the exact role, paste a job description, and set your experience level.
          </p>
          <button
            onClick={onClick}
            disabled={isDisabled}
            className="flex items-center gap-2 border-2 border-violet-400/50 text-violet-400 px-6 py-2.5 rounded-xl font-bold hover:bg-violet-500/10 transition text-sm disabled:opacity-50"
          >
            <PenTool className="w-4 h-4" /> Configure Custom Interview
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mic waveform indicator (visible during active call) ──────────
function MicBar({ volume }) {
  const bars = [0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8];
  return (
    <div className="flex items-end gap-1 h-10">
      {bars.map((base, i) => (
        <div key={i}
          className="w-1.5 bg-primary rounded-full transition-all duration-75"
          style={{ height: `${Math.max(6, (base * volume * 36) + 4)}px` }} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════
export default function Dashboard({ user, isDark, setIsDark }) {
  const navigate = useNavigate();
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState('');
  const [callStatus,   setCallStatus]   = useState('idle');
  const [activeRole,   setActiveRole]   = useState('');
  const [volumeLevel,  setVolumeLevel]  = useState(0);
  const [modalRole,    setModalRole]    = useState(null);
  const [fileContent,  setFileContent]  = useState(null);
  const [fileName,     setFileName]     = useState('');
  const [aiSpeaking,   setAiSpeaking]   = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [showCollectorFallback, setShowCollectorFallback] = useState(false);
  const fileInputRef   = useRef(null);
  const transcriptRef      = useRef([]);
  const activeRoleRef      = useRef('');
  const pendingLaunchRef   = useRef(null); // queued interviewer args after collector ends
  const wasInterviewRef    = useRef(false); // true only when a real interview (not collector) starts
  const [feedback,         setFeedback]   = useState(null);
  const [isGrading,        setIsGrading]  = useState(false);
  const vapiRef            = useRef(null);

  // ── Init Vapi SDK ──────────────────────────────────────────────
  useEffect(() => {
    let vapi;
    const initVapi = async () => {
      try {
        const VapiClass = Vapi?.default || Vapi;
        if (typeof VapiClass !== 'function') throw new Error('Vapi not a constructor');
        vapi = new VapiClass(import.meta.env.VITE_VAPI_PUBLIC_KEY);
        vapiRef.current = vapi;

        vapi.on('call-start', () =>
          setCallStatus(p => p === 'collecting' ? 'collecting' : 'active')
        );
        vapi.on('call-end', async () => {
          setVolumeLevel(0);
          setIsLoading(false);
          setAiSpeaking(false);
          setUserSpeaking(false);
          // Clear custom agent file upload state after session ends
          setFileContent(null);
          setFileName('');

          // If collector just ended and we have a pending interviewer launch, fire it
          if (pendingLaunchRef.current) {
            const args = pendingLaunchRef.current;
            pendingLaunchRef.current = null;
            setShowCollectorFallback(false);
            
            console.log('[HANDOFF] Collector session ended. Launching Interviewer in 1.5s...', args);
            transcriptRef.current = [];
            wasInterviewRef.current = false;
            await new Promise(r => setTimeout(r, 1500));
            launchInterviewer(args);
            return;
          }

          // FAIL-SAFE: If collector ended WITHOUT a tool call, but we have a transcript
          // We use !wasInterviewRef.current instead of callStatus === 'collecting' 
          // because callStatus is trapped in a stale closure from the useEffect [].
          if (!wasInterviewRef.current) {
            const fullTranscript = transcriptRef.current.join('\n');
            if (fullTranscript.length > 50) {
              console.log('[HANDOFF] Collector timed out. Attempting Fail-safe Transcript Handoff...');
              setIsLoading(true);
              setCallStatus('connecting');
              
              try {
                const r = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/vapi/generate-from-transcript`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ transcript: fullTranscript, userId: user?.uid }),
                });
                if (r.ok) {
                  const d = await r.json();
                  launchInterviewer({ 
                    role: d.variableValues.role, 
                    experience: 'General', 
                    techStack: 'Based on Conversation',
                    prefetchedData: d // Pass data to avoid re-calling backend
                  });
                  return;
                }
              } catch (e) { console.error('[HANDOFF FAILSAFE ERROR]', e); }
            }
            console.log('[HANDOFF] Collector ended without enough info. Showing fallback.');
            setShowCollectorFallback(true);
            setCallStatus('idle');
            setIsLoading(false);
          }

          // Only grade if it was a real interview (not the collector)
          const fullTranscript = transcriptRef.current.join('\n');
          const wasInterview   = wasInterviewRef.current && activeRoleRef.current && fullTranscript.length > 80;
          transcriptRef.current = [];
          wasInterviewRef.current = false;
          setCallStatus('idle');
          if (wasInterview) {
            setIsGrading(true);
            try {
              const r = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/vapi/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  transcript: fullTranscript,
                  role: activeRoleRef.current,
                  experience: 'General',
                  userId: user?.uid,
                }),
              });
              if (r.ok) {
                const d = await r.json();
                if (d.success && d.feedback) setFeedback({ ...d.feedback, role: activeRoleRef.current });
              }
            } catch (e) { console.error('[feedback]', e); }
            finally { setIsGrading(false); }
          }
        });
        vapi.on('volume-level', l => setVolumeLevel(l));
        vapi.on('speech-start', () => setAiSpeaking(true));
        vapi.on('speech-end',   () => setAiSpeaking(false));

        // Collector tool-call → handoff
        vapi.on('message', async msg => {
          // DEBUG: Log all Vapi messages to help troubleshoot handoff issues
          if (msg.type !== 'transcript') {
            console.log(`[VAPI MESSAGE DEBUG] Type: ${msg.type}`, msg);
          }

          // Capture transcript and detect user speaking
          if (msg.type === 'transcript') {
            if (msg.role === 'user') {
              setUserSpeaking(true);
              setAiSpeaking(false);
              setTimeout(() => setUserSpeaking(false), 1500);
            }
            // Capture both partial and final to be safe, deduplicating via ref
            const speaker = msg.role === 'assistant' ? 'Interviewer' : 'Candidate';
            const text = msg.transcript;
            if (text && !transcriptRef.current.includes(`${speaker}: ${text}`)) {
               transcriptRef.current.push(`${speaker}: ${text}`);
            }
          }
          if (msg.type !== 'tool-calls') return;
          const tc = msg.toolCallList?.find(t => t.function?.name === 'submit_interview_details');
          if (!tc) return;
          
          console.log('[HANDOFF] Collector tool call received:', tc.function.name);
          let args = tc.function.arguments;
          if (typeof args === 'string') args = JSON.parse(args);
          const { role, experience, techStack } = args;
          
          setActiveRole(role);
          activeRoleRef.current = role;
          setCallStatus('connecting');
          
          // Queue the interviewer launch
          pendingLaunchRef.current = { role, experience, techStack };
          
          // Send a visual confirmation that we got the data
          console.log('[HANDOFF] Data queued. Stopping collector...');
          vapi.stop();
        });

        vapi.on('error', err => {
          // "Meeting has ended" is fired by Daily.co when the Collector Agent ends its
          // session — this is expected during the collector → interviewer handoff.
          // Suppress it to avoid false error banners and premature status resets.
          const msg = err?.error?.errorMsg || err?.message || '';
          if (msg.includes('Meeting has ended') || msg.includes('ejection')) return;

          console.error('[Vapi]', err);
          setError('Voice connection error. Check microphone permissions.');
          setCallStatus('idle');
          setIsLoading(false);
        });
      } catch (err) {
        console.error('Vapi init failed:', err);
        setError('Failed to load voice SDK — please refresh.');
      }
    };
    initVapi();
    return () => vapi?.stop();
  }, []);

  // ── Generate questions + launch Interviewer ────────────────────
  const launchInterviewer = async ({ role, experience, techStack, contentText = null, resumeContent = null, prefetchedData = null }) => {
    setIsLoading(true);
    setError('');
    const requestId = Math.random().toString(36).substring(7);
    try {
      console.log(`[launchInterviewer:${requestId}] Starting...`, { role, experience, techStack });
      
      let data;
      if (prefetchedData) {
        console.log(`[launchInterviewer:${requestId}] Using prefetched data (Skipping Backend Call)`);
        data = prefetchedData;
      } else {
        const hasDoc    = contentText && contentText.trim().length > 50;
        const hasResume = resumeContent && resumeContent.trim().length > 50;
        const endpoint  = hasDoc ? '/api/vapi/generate-from-content' : '/api/vapi/generate';
        const body      = hasDoc
          ? { content: contentText, role, experience, techStack, userId: user?.uid }
          : { role, experience, techStack, resumeContent: hasResume ? resumeContent : null, userId: user?.uid };

        console.log(`[launchInterviewer:${requestId}] Calling ${endpoint}...`, body);
        
        const startTime = Date.now();
        const res  = await fetch(`${import.meta.env.VITE_BACKEND_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        console.log(`[launchInterviewer:${requestId}] HTTP Status: ${res.status} (${Date.now() - startTime}ms)`);
        
        if (!res.ok) {
          const errText = await res.text();
          console.error(`[launchInterviewer:${requestId}] Server Error:`, errText);
          throw new Error(`Backend ${res.status}: ${errText}`);
        }

        data = await res.json();
      }
      
      console.log(`[launchInterviewer:${requestId}] Received Data:`, data);

      if (!data.success || !data.questions) throw new Error('Invalid response payload');

      const baseQuestions = data.variableValues?.questions ||
        data.questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

      const sysRole = data.variableValues?.role || role || 'the requested role';
      const sysExp = data.variableValues?.experience || experience || 'general';

      // Use variableValues to inject context into the Vapi assistant template
      const assistantOverrides = {
        variableValues: {
          role: sysRole,
          experience: sysExp,
          questions: baseQuestions
        }
      };

      await new Promise(r => setTimeout(r, 300));
      setCallStatus('active');
      wasInterviewRef.current = true;
      activeRoleRef.current = sysRole;
      setActiveRole(sysRole);
      
      await vapiRef.current.start(INTERVIEWER_ID, assistantOverrides);
    } catch (err) {
      console.error('Interviewer Start Error:', err);
      setError('Could not start the interview. Please check your microphone permissions and try again.');
      setCallStatus('idle');
      setActiveRole('');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Predefined flow ────────────────────────────────────────────
  const handleModalStart = (cfg) => {
    if (!modalRole || !vapiRef.current) return;
    const { experience, focusArea, yearsExp, companyType, resumeText, customRole } = cfg;
    let roleName = customRole || modalRole.name;
    let tech = focusArea || modalRole.tech;
    if (!modalRole.isCustom && focusArea) tech = `${modalRole.tech}. Focus on: ${focusArea}`;
    if (companyType) tech += `. Target: ${companyType}`;
    if (yearsExp)    tech += `. ${yearsExp} years experience`;

    setModalRole(null);
    activeRoleRef.current = roleName;
    setActiveRole(roleName);
    setCallStatus("connecting");
    
    const isJd = modalRole.isCustom && tech.length > 50;
    launchInterviewer({
      role: roleName,
      experience,
      techStack: tech,
      contentText: isJd ? tech : null,
      resumeContent: resumeText || null
    });
  };

  // ── Custom Collector flow ──────────────────────────────────────
  const startCustomCollector = () => {
    if (!vapiRef.current) return setError('Voice SDK not ready. Please refresh.');
    setError('');
    setCallStatus('collecting');
    setActiveRole('Custom');
    vapiRef.current.start(COLLECTOR_ID);
  };


  // ── File upload flow (txt + pdf) ─────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setFileContent(null); // reset while parsing

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page    = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(' ') + '\n';
        }
        setFileContent(text.trim());
      } catch (err) {
        console.error('PDF parse error:', err);
        setError('Could not read this PDF. Make sure it contains selectable text (not scanned images).');
        setFileName('');
      }
    } else {
      // Plain text / markdown
      const reader = new FileReader();
      reader.onload = (ev) => setFileContent(ev.target.result);
      reader.readAsText(file);
    }
  };

  const startFileInterview = () => {
    if (!fileContent || !vapiRef.current) return;
    setActiveRole(`Doc: ${fileName}`);
    setCallStatus('connecting');
    launchInterviewer({ role: 'Document-based', experience: 'General', techStack: 'General', contentText: fileContent });
  };

  const stopCall = () => {
    vapiRef.current?.stop();
    setCallStatus('idle');
    setActiveRole('');
    setIsLoading(false);
  };

  const handleLogout = async () => {
    vapiRef.current?.stop();
    await signOut(auth);
    navigate('/');
  };

  const isCallActive = callStatus !== 'idle';

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* Config Modal */}
      {modalRole && <ConfigModal role={modalRole} onClose={() => setModalRole(null)} onStart={handleModalStart} />}

      {/* Grading overlay */}
      {isGrading && <GradingOverlay />}

      {/* Feedback report */}
      {feedback && !isGrading && (
        <FeedbackModal
          feedback={feedback}
          role={feedback.role}
          onClose={() => setFeedback(null)}
        />
      )}

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 pt-10 md:pt-20 pb-20">

        {error && (
          <div className="bg-destructive/10 border-l-4 border-destructive text-destructive p-4 rounded-xl mb-8">
            <p className="font-bold text-sm">Error</p><p className="text-sm">{error}</p>
          </div>
        )}

        {/* ── Active Call Overlay ── */}
        {isCallActive && (
          <div className="mb-10 p-8 glass-card border-primary/50 flex flex-col items-center text-center relative overflow-hidden">
            {callStatus === 'active' && <div className="absolute inset-0 bg-primary/5 animate-pulse rounded-3xl pointer-events-none" />}

            <div className="relative z-10 flex flex-col items-center w-full">
              <h2 className="text-2xl font-extrabold mb-1">
                {callStatus === 'collecting' ? 'Collector Agent Active'
                : callStatus === 'connecting' ? 'Loading your interview...'
                : 'Live Interview'}
              </h2>
              <p className="text-muted-foreground text-sm flex items-center gap-2 mb-8">
                {(callStatus === 'active' || callStatus === 'collecting') && <Activity className="w-4 h-4 text-primary animate-pulse" />}
                {callStatus === 'collecting' ? 'Speak naturally — describe your role, experience & stack'
                : callStatus === 'connecting' ? 'Generating your personalised questions…'
                : `${activeRole} • Technical Interview`}
              </p>

              {/* Dual avatar row for interview */}
              {callStatus === 'active' && (
                <div className="flex items-end justify-center gap-16 mb-8">
                  {/* AI Avatar */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      {aiSpeaking && (
                        <>
                          <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                          <span className="absolute -inset-2 rounded-full border-2 border-primary/40 animate-pulse" />
                        </>
                      )}
                      <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 ${
                        aiSpeaking ? 'bg-primary text-primary-foreground scale-110 ring-4 ring-primary/40' : 'bg-primary/20 text-primary'
                      }`}>
                        <Sparkles className="w-10 h-10" />
                      </div>
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      aiSpeaking ? 'text-primary' : 'text-muted-foreground'
                    }`}>{aiSpeaking ? '● Speaking' : 'AI Interviewer'}</span>
                    {aiSpeaking && (
                      <div className="flex items-end gap-0.5 h-5">
                        {[0.4,0.8,1,0.6,0.9,0.5,0.7].map((b,i) => (
                          <div key={i} className="w-1 bg-primary rounded-full animate-bounce" style={{ height: `${b*16+4}px`, animationDelay: `${i*80}ms` }} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="flex flex-col items-center gap-1 text-muted-foreground/30">
                    <div className="w-px h-16 bg-border" />
                    <span className="text-xs">vs</span>
                    <div className="w-px h-16 bg-border" />
                  </div>

                  {/* User Avatar */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      {userSpeaking && (
                        <>
                          <span className="absolute inset-0 rounded-full bg-green-400/20 animate-ping" />
                          <span className="absolute -inset-2 rounded-full border-2 border-green-400/40 animate-pulse" />
                        </>
                      )}
                      <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 ${
                        userSpeaking ? 'bg-green-500 text-white scale-110 ring-4 ring-green-400/40' : 'bg-green-500/20 text-green-400'
                      }`}>
                        <Mic className="w-10 h-10" />
                      </div>
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      userSpeaking ? 'text-green-400' : 'text-muted-foreground'
                    }`}>{userSpeaking ? '● Speaking' : 'You'}</span>
                    {userSpeaking && (
                      <div className="flex items-end gap-0.5 h-5">
                        {[0.6,1,0.7,0.9,0.5,0.8,0.4].map((b,i) => (
                          <div key={i} className="w-1 bg-green-400 rounded-full animate-bounce" style={{ height: `${b*16+4}px`, animationDelay: `${i*80}ms` }} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dual avatar row for collector */}
              {callStatus === 'collecting' && (
                <div className="flex items-end justify-center gap-16 mb-8">
                  {/* Collector Agent Avatar */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      {aiSpeaking && (
                        <>
                          <span className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
                          <span className="absolute -inset-2 rounded-full border-2 border-amber-400/40 animate-pulse" />
                        </>
                      )}
                      <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 ${
                        aiSpeaking ? 'bg-amber-500 text-white scale-110 ring-4 ring-amber-400/40' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        <UserSearch className="w-10 h-10" />
                      </div>
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      aiSpeaking ? 'text-amber-400' : 'text-muted-foreground'
                    }`}>{aiSpeaking ? '● Speaking' : 'Collector Agent'}</span>
                    {aiSpeaking && (
                      <div className="flex items-end gap-0.5 h-5">
                        {[0.4,0.8,1,0.6,0.9,0.5,0.7].map((b,i) => (
                          <div key={i} className="w-1 bg-amber-400 rounded-full animate-bounce" style={{ height: `${b*16+4}px`, animationDelay: `${i*80}ms` }} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="flex flex-col items-center gap-1 text-muted-foreground/30">
                    <div className="w-px h-16 bg-border" />
                    <span className="text-xs">↔</span>
                    <div className="w-px h-16 bg-border" />
                  </div>

                  {/* User Avatar */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      {userSpeaking && (
                        <>
                          <span className="absolute inset-0 rounded-full bg-green-400/20 animate-ping" />
                          <span className="absolute -inset-2 rounded-full border-2 border-green-400/40 animate-pulse" />
                        </>
                      )}
                      <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 ${
                        userSpeaking ? 'bg-green-500 text-white scale-110 ring-4 ring-green-400/40' : 'bg-green-500/20 text-green-400'
                      }`}>
                        <Mic className="w-10 h-10" />
                      </div>
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      userSpeaking ? 'text-green-400' : 'text-muted-foreground'
                    }`}>{userSpeaking ? '● Speaking' : 'You'}</span>
                    {userSpeaking && (
                      <div className="flex items-end gap-0.5 h-5">
                        {[0.6,1,0.7,0.9,0.5,0.8,0.4].map((b,i) => (
                          <div key={i} className="w-1 bg-green-400 rounded-full animate-bounce" style={{ height: `${b*16+4}px`, animationDelay: `${i*80}ms` }} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Connecting spinner */}
              {callStatus === 'connecting' && (
                <div className="mb-8 flex flex-col items-center">
                  <div className="w-32 h-32 rounded-full flex items-center justify-center shadow-2xl bg-primary/10 text-primary border-4 border-primary/20 relative">
                    <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <Loader2 className="w-12 h-12 animate-pulse" />
                  </div>
                  <p className="mt-6 text-primary font-bold tracking-wide animate-pulse uppercase text-sm">
                    Connecting to Interviewer...
                  </p>
                </div>
              )}

              <button onClick={stopCall}
                className="bg-destructive text-destructive-foreground px-10 py-4 rounded-full font-bold hover:opacity-90 hover:scale-105 transition-all shadow-lg flex items-center gap-3">
                <PhoneOff className="w-5 h-5" /> End Session
              </button>
            </div>
          </div>
        )}

        {/* ── Setup Panel ── */}
        <div className={`transition-all duration-500 ${isCallActive ? 'opacity-20 pointer-events-none blur-sm scale-95' : ''}`}>
          <div className="mb-10">
            <h2 className="text-4xl font-extrabold mb-2">Start a Mock Interview</h2>
            <p className="text-muted-foreground text-lg">Choose any domain, configure your level, and dive straight in.</p>
          </div>

          {/* Custom Interview */}
          <div className="relative glass-card border-amber-400/20 p-7 mb-6 hover:border-amber-400/40 transition-colors overflow-hidden">
            <div className="flex flex-col md:flex-row items-start gap-5">
              <div className="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
                <UserSearch className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold">Custom Interview</h3>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-400/20">AI Collector</span>
                </div>
                <p className="text-muted-foreground text-sm mb-5">
                  The <strong className="text-foreground">Collector Agent</strong> will voice-chat with you to learn your role, experience & stack, then hand you off to the Interviewer with personalised questions.
                </p>
                <div className="flex flex-wrap gap-4">
                  <button onClick={startCustomCollector} disabled={isLoading || isCallActive}
                    className="bg-amber-500 hover:bg-amber-400 text-white px-7 py-3 rounded-xl font-bold disabled:opacity-50 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2">
                    <UserSearch className="w-4 h-4" /> {showCollectorFallback ? 'Restart Collector' : 'Talk to Collector Agent'}
                  </button>
                  
                  {showCollectorFallback && (
                    <button onClick={() => { setShowCollectorFallback(false); launchInterviewer({ role: 'Custom Role', experience: 'General', techStack: 'General' }); }}
                      className="bg-primary text-white px-7 py-3 rounded-xl font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2 animate-bounce">
                      <Sparkles className="w-4 h-4" /> Start Interview Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Job Description (replaces old file-upload card) */}
          <EnterManuallyCard
            onClick={() => setModalRole({ id: 'manual', name: 'Custom Interview', tech: 'Define your own role and tech stack', isCustom: true })}
            isDisabled={isLoading || isCallActive}
          />

          {/* Predefined Roles */}
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-5">Or choose a predefined domain</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {INTERVIEW_TYPES.map(type => {
              const Icon = type.icon;
              return (
                <button key={type.id} onClick={() => !isLoading && !isCallActive && setModalRole(type)}
                  disabled={isLoading || isCallActive}
                  className="glass-card border-transparent text-left p-5 group transition-all cursor-pointer hover:border-primary hover:-translate-y-1.5 hover:shadow-xl disabled:opacity-50">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 border transition-all duration-300 ${COLOR_MAP[type.color]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm mb-1">{type.name}</h4>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{type.tech}</p>
                  <div className="flex items-center gap-2 text-primary text-xs font-bold group-hover:gap-3 transition-all">
                    <Mic className="w-3.5 h-3.5" /> Configure & Start
                    <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
