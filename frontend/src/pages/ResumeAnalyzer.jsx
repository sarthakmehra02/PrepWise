import { useState, useRef } from 'react';
import {
  Upload, FileText, Loader2, Target, CheckCircle2, AlertCircle,
  ArrowRight, Sparkles, Briefcase, SlidersHorizontal, Tag, XCircle, ChevronRight, Save
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

const EXPERIENCE_OPTIONS = ['0-1 years (Fresher)', '1-3 years (Junior)', '3-5 years (Mid-level)', '5-8 years (Senior)', '8+ years (Lead/Principal)'];
const INDUSTRY_OPTIONS = ['Software Engineering', 'Data Science / ML', 'Product Management', 'Design (UI/UX)', 'DevOps / Cloud', 'Cybersecurity', 'Finance / Fintech', 'Healthcare', 'Marketing', 'General Technology'];

export default function ResumeAnalyzer() {
  const [step, setStep] = useState('upload');   // upload | context | analyzing | results
  const [file, setFile] = useState(null);
  const [resumeText, setResumeText] = useState('');
  const [contextMode, setContextMode] = useState(null); // 'jd' | 'manual'

  // JD mode
  const [jobDescription, setJobDescription] = useState('');
  // Manual mode
  const [targetRole, setTargetRole] = useState('');
  const [experience, setExperience] = useState('');
  const [industry, setIndustry] = useState('');

  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Save to Firebase
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // ── Step 1: Upload PDF ─────────────────────────────────────────
  const handleUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith('.pdf')) { setError('Please upload a PDF file.'); return; }
    setFile(selectedFile);
    setError('');
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      const allLinks = new Set();

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n';

        // Extract hyperlinks from annotations
        try {
          const annotations = await page.getAnnotations();
          annotations.forEach(anno => {
            if (anno.subtype === 'Link' && anno.url) {
              allLinks.add(anno.url);
            }
          });
        } catch (linkErr) { console.warn('Link extraction failed for page', i); }
      }

      if (allLinks.size > 0) {
        text += '\n[EXTRACTED LINKS]:\n' + Array.from(allLinks).join('\n');
      }

      if (text.trim().length < 100) throw new Error('Could not extract enough text. Ensure the PDF is not a scan.');
      setResumeText(text);
      setStep('context');
    } catch (err) {
      setError(err.message);
      setFile(null);
    }
  };

  // ── Step 3: Analyze ────────────────────────────────────────────
  const runAnalysis = async () => {
    if (contextMode === 'jd' && !jobDescription.trim()) { setError('Please paste a job description.'); return; }
    if (contextMode === 'manual' && !targetRole.trim()) { setError('Please enter a target role.'); return; }
    setError('');
    setStep('analyzing');
    try {
      const body = { resumeText };
      if (contextMode === 'jd') body.jobDescription = jobDescription;
      else { body.targetRole = targetRole; body.experience = experience; body.industry = industry; }

      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/resume/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Analysis failed');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Analysis failed');
      setResult(data.analysis);
      setStep('results');
    } catch (err) {
      setError(err.message);
      setStep('context');
    }
  };

  const reset = () => {
    setStep('upload'); setFile(null); setResumeText(''); setContextMode(null);
    setJobDescription(''); setTargetRole(''); setExperience(''); setIndustry('');
    setResult(null); setError(''); setSaveMsg('');
  };

  // ── Save Analysis PDF to Firebase ─────────────────────────────────
  const saveAnalysisToFirebase = async () => {
    if (!result) return;
    const user = auth.currentUser;
    if (!user) { setSaveMsg('You must be logged in to save.'); return; }
    setIsSaving(true);
    setSaveMsg('Saving…');
    const startTime = Date.now();
    try {
      console.log('[saveAnalysis] Starting save...');
      const summary = [
        `Resume Analysis Report`,
        `File: ${file?.name || 'Unknown'}`,
        `ATS Score: ${result.score}/100`,
        `Role Match: ${result.roleMatch || 'N/A'}`,
        '',
        'STRENGTHS:',
        ...(result.strengths || []).map(s => `  - ${s}`),
        '',
        'AREAS FOR IMPROVEMENT:',
        ...(result.weaknesses || []).map(w => `  - ${w}`),
        '',
        'AI SUGGESTIONS:',
        ...(result.suggestions || []).map(s => `  - ${s}`),
        '',
        'KEYWORDS FOUND: ' + (result.keywords?.present || []).join(', '),
        'KEYWORDS MISSING: ' + (result.keywords?.missing || []).join(', '),
      ].join('\n');

      // Optimistic update
      setSaveMsg('✓ Analysis saved!');
      
      await addDoc(collection(db, 'savedPdfs'), {
        userId: user.uid,
        type: 'analysis',
        label: file?.name || 'Resume Analysis',
        score: result.score,
        roleMatch: result.roleMatch || '',
        textSummary: summary,
        result,
        createdAt: new Date().toISOString(),
      });
      console.log(`[saveAnalysis] Success in ${Date.now() - startTime}ms`);
    } catch (err) {
      console.error('[saveAnalysis] Firestore error:', err);
      setSaveMsg('Failed to save: ' + err.message);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMsg(''), 4000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 w-full">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-primary mb-2 flex items-center gap-3">
          <Target className="w-8 h-8" /> Resume Analyzer
        </h1>
        <p className="text-muted-foreground text-lg">
          Get a tailored ATS score and AI-driven suggestions matched to your target role.
        </p>
        {/* Progress */}
        <div className="flex items-center gap-3 mt-6">
          {['Upload', 'Context', 'Results'].map((label, i) => {
            const active = (step === 'upload' && i === 0) || (step === 'context' && i === 1) || ((step === 'analyzing' || step === 'results') && i === 2);
            const done = (i === 0 && step !== 'upload') || (i === 1 && (step === 'analyzing' || step === 'results'));
            return (
              <div key={label} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${done ? 'bg-primary border-primary text-primary-foreground' : active ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-sm font-bold ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                {i < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border-l-4 border-destructive text-destructive rounded-xl">
          <p className="font-bold">Error</p><p className="text-sm">{error}</p>
        </div>
      )}

      {/* ── STEP 1: UPLOAD ───────────────────────────────────── */}
      {step === 'upload' && (
        <div onClick={() => fileInputRef.current?.click()}
          className="w-full h-72 border-2 border-dashed border-primary/40 rounded-3xl flex flex-col items-center justify-center glass-card hover:bg-primary/5 transition-all cursor-pointer group">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform mb-4">
            <Upload className="w-9 h-9" />
          </div>
          <h3 className="text-xl font-bold mb-1">Click to upload your resume PDF</h3>
          <p className="text-muted-foreground text-sm">Max 5MB · Text-based PDFs only</p>
        </div>
      )}

      {/* ── STEP 2: CONTEXT ──────────────────────────────────── */}
      {step === 'context' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 glass-card">
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <span className="font-bold text-sm">{file?.name}</span>
            <button onClick={reset} className="ml-auto text-muted-foreground hover:text-destructive transition">
              <XCircle className="w-4 h-4" />
            </button>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-2">How should we evaluate your resume?</h2>
            <p className="text-muted-foreground mb-6">Give us context to tailor the ATS score and suggestions to your specific goal.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => setContextMode('jd')}
                className={`p-6 rounded-2xl border-2 text-left transition-all hover:-translate-y-1 ${contextMode === 'jd' ? 'border-primary bg-primary/5' : 'border-transparent glass-card hover:border-primary/50'}`}>
                <Briefcase className={`w-8 h-8 mb-3 ${contextMode === 'jd' ? 'text-primary' : 'text-muted-foreground'}`} />
                <h3 className="font-bold text-lg mb-1">Paste Job Description</h3>
                <p className="text-muted-foreground text-sm">We'll score your resume specifically against the JD keywords and requirements.</p>
              </button>
              <button onClick={() => setContextMode('manual')}
                className={`p-6 rounded-2xl border-2 text-left transition-all hover:-translate-y-1 ${contextMode === 'manual' ? 'border-primary bg-primary/5' : 'border-transparent glass-card hover:border-primary/50'}`}>
                <SlidersHorizontal className={`w-8 h-8 mb-3 ${contextMode === 'manual' ? 'text-primary' : 'text-muted-foreground'}`} />
                <h3 className="font-bold text-lg mb-1">Set Target Manually</h3>
                <p className="text-muted-foreground text-sm">Select your target role, experience level, and industry for a tailored evaluation.</p>
              </button>
            </div>
          </div>

          {contextMode === 'jd' && (
            <div className="glass-card p-6">
              <label className="block text-sm font-bold mb-2">Job Description</label>
              <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)}
                rows={8} placeholder="Paste the full job description here..."
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          )}

          {contextMode === 'manual' && (
            <div className="glass-card p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">Target Role *</label>
                <input type="text" value={targetRole} onChange={e => setTargetRole(e.target.value)}
                  placeholder="e.g. Senior Software Engineer, Data Scientist, Product Manager..."
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Experience Level</label>
                  <select value={experience} onChange={e => setExperience(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select experience...</option>
                    {EXPERIENCE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Industry</label>
                  <select value={industry} onChange={e => setIndustry(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select industry...</option>
                    {INDUSTRY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {contextMode && (
            <button onClick={runAnalysis}
              className="w-full py-4 btn-glow text-lg flex items-center justify-center gap-3">
              <Sparkles className="w-5 h-5" /> Analyze Resume
            </button>
          )}
        </div>
      )}

      {/* ── STEP: ANALYZING ──────────────────────────────────── */}
      {step === 'analyzing' && (
        <div className="w-full h-80 glass-card flex flex-col items-center justify-center p-8 text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
            <Loader2 className="w-16 h-16 text-primary animate-spin relative z-10" />
          </div>
          <h3 className="text-2xl font-black mb-3">AI Engine Processing…</h3>
          <div className="space-y-2">
            <p className="text-sm text-primary font-bold animate-pulse">
              Stage 1: Parsing PDF Structure & Content
            </p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Prep Wise is currently mapping your experience against industry standards and extracting key impact metrics.
            </p>
          </div>
          <div className="mt-8 flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {/* ── STEP: RESULTS ────────────────────────────────────── */}
      {step === 'results' && result && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={reset} className="text-sm font-bold text-muted-foreground hover:text-foreground flex items-center gap-2">
              ← Analyze another resume
            </button>
            <div className="flex items-center gap-3">
              {saveMsg && <span className={`text-xs font-bold px-3 py-1 rounded-lg ${saveMsg.startsWith('✓') ? 'text-green-500 bg-green-500/10' : 'text-destructive bg-destructive/10'}`}>{saveMsg}</span>}
              <button onClick={saveAnalysisToFirebase} disabled={isSaving}
                className="px-4 py-2 rounded-xl border border-primary/40 hover:bg-primary/10 transition disabled:opacity-40 flex items-center gap-2 text-sm font-semibold"
                style={{ color: 'var(--accent-blue)' }}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Report
              </button>
              <span className="px-4 py-1.5 bg-secondary text-secondary-foreground rounded-full text-sm font-bold flex items-center gap-2">
                <FileText className="w-4 h-4" /> {file?.name}
              </span>
            </div>
          </div>

          {/* Score + Role Match */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-1 glass-card p-8 flex flex-col items-center text-center">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6">ATS Match Score</h3>
              <div className="relative w-40 h-40 flex items-center justify-center mb-4">
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="80" cy="80" r="70" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-secondary" />
                  <circle cx="80" cy="80" r="70" fill="transparent" stroke="currentColor" strokeWidth="12"
                    className={result.score >= 80 ? 'text-green-500' : result.score >= 60 ? 'text-amber-500' : 'text-red-500'}
                    strokeDasharray={440} strokeDashoffset={440 - (440 * result.score) / 100}
                    strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s ease-out' }} />
                </svg>
                <span className="text-5xl font-black">{result.score}</span>
              </div>
              {result.roleMatch && <p className="text-xs text-muted-foreground leading-relaxed">{result.roleMatch}</p>}
            </div>

            <div className="col-span-2 space-y-4">
              <div className="glass-card p-6">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-3 text-green-500">
                  <CheckCircle2 className="w-4 h-4" /> Key Strengths
                </h3>
                <ul className="space-y-2">
                  {result.strengths?.map((s, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="glass-card p-6">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-3 text-amber-500">
                  <AlertCircle className="w-4 h-4" /> Areas for Improvement
                </h3>
                <ul className="space-y-2">
                  {result.weaknesses?.map((w, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />{w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Keywords */}
          {result.keywords && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card p-6 border-green-500/20">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-green-500">
                  <Tag className="w-4 h-4" /> Keywords Found
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.keywords.present?.map((k, i) => (
                    <span key={i} className="px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-bold border border-green-500/20">{k}</span>
                  ))}
                </div>
              </div>
              <div className="glass-card p-6 border-red-500/20">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-red-500">
                  <XCircle className="w-4 h-4" /> Keywords Missing
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.keywords.missing?.map((k, i) => (
                    <span key={i} className="px-3 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold border border-red-500/20">{k}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AI Suggestions */}
          <div className="glass-card p-8 border-primary/20">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
              <Sparkles className="w-6 h-6 text-primary" /> AI Recommended Changes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.suggestions?.map((s, i) => (
                <div key={i} className="p-4 rounded-2xl bg-secondary/50 border border-border flex items-start gap-3">
                  <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed">{s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
    </div>
  );
}
