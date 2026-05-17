import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PenTool, Code, LayoutTemplate, MessageSquare, Download, Play,
  Loader2, Save, FileText, Upload, Sparkles, ArrowRight,
  CheckCircle2, AlertCircle, XCircle, Send, Bot, User, Plus, Trash2, RefreshCw
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import * as pdfjsLib from 'pdfjs-dist';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

const DEFAULT_LATEX = `\\documentclass[10pt, letterpaper]{article}
\\usepackage[margin=0.5in]{geometry}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\setlist[itemize]{leftmargin=*, noitemsep, topsep=2pt}

\\begin{document}
\\pagestyle{empty}

\\begin{center}
    {\\Huge \\textbf{John Doe}} \\\\
    \\vspace{2mm}
    \\small johndoe@email.com $\\cdot$ (123) 456-7890 $\\cdot$ \\href{https://linkedin.com/in/johndoe}{linkedin.com/in/johndoe} $\\cdot$ \\href{https://github.com/johndoe}{github.com/johndoe}
\\end{center}

\\vspace{3mm}
\\noindent{\\Large \\textbf{Education}} \\vspace{1mm} \\hrule \\vspace{2mm}
\\textbf{University of Technology} \\hfill \\textit{Graduation: May 2024} \\\\
Bachelor of Science in Computer Science \\hfill GPA: 3.9/4.0

\\vspace{4mm}
\\noindent{\\Large \\textbf{Experience}} \\vspace{1mm} \\hrule \\vspace{2mm}
\\textbf{Software Engineer Intern} $\\cdot$ \\textit{Tech Corp} \\hfill \\textit{Jun 2023 -- Aug 2023}
\\begin{itemize}
    \\item Built a full-stack web application using React and Node.js, serving 10,000+ users.
    \\item Optimized database queries reducing API response time by 40\\%.
    \\item Collaborated with cross-functional teams to deliver 3 major features on schedule.
\\end{itemize}

\\vspace{3mm}
\\textbf{Software Developer Intern} $\\cdot$ \\textit{Startup Inc} \\hfill \\textit{Jan 2023 -- May 2023}
\\begin{itemize}
    \\item Implemented RESTful APIs using Express.js and PostgreSQL.
    \\item Reduced deployment time by 60\\% by containerizing services with Docker.
\\end{itemize}

\\vspace{4mm}
\\noindent{\\Large \\textbf{Projects}} \\vspace{1mm} \\hrule \\vspace{2mm}
\\textbf{AI Interview Prep Tool} $\\cdot$ \\textit{React, Node.js, Express}
\\begin{itemize}
    \\item Built a mock interview platform with real-time voice AI agents and instant performance scoring.
\\end{itemize}

\\vspace{4mm}
\\noindent{\\Large \\textbf{Skills}} \\vspace{1mm} \\hrule \\vspace{2mm}
\\textbf{Languages:} Python, Java, JavaScript, TypeScript, C++ \\\\
\\textbf{Frameworks:} React, Node.js, Express, Next.js, Spring Boot \\\\
\\textbf{Tools:} Git, Docker, AWS, PostgreSQL, MongoDB, Redis

\\end{document}
`;

// ── Empty blocks template for "Create New" flow ─────────────────
const EMPTY_BLOCKS = {
  contact:  { name: '', email: '', phone: '', linkedin: '', github: '', portfolio: '' },
  education: [{ institution: '', degree: '', date: '', gpa: '' }],
  experience: [{ company: '', role: '', duration: '', location: '', points: [''] }],
  projects: [{ name: '', techStack: '', link: '', points: [''] }],
  skills: [''],
  customSections: [],
};

// ── Reusable Score Ring ──────────────────────────────────────────
function ScoreRing({ score }) {
  const color = score >= 80 ? 'text-green-500' : score >= 60 ? 'text-amber-500' : 'text-red-500';
  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full -rotate-90">
        <circle cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="10" className="text-secondary" />
        <circle cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="10"
          className={color} strokeDasharray={352} strokeDashoffset={352 - (352 * score) / 100}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s ease-out' }} />
      </svg>
      <span className="text-4xl font-black">{score}</span>
    </div>
  );
}

export default function ResumeEditor() {
  // Onboarding
  const [onboardStep, setOnboardStep] = useState('choose'); // choose | upload | analyzing | rated | editor
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedText, setUploadedText] = useState('');
  const [rating, setRating] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const uploadRef = useRef(null);

  // Editor
  const [activeTab, setActiveTab] = useState('latex');
  const [latexCode, setLatexCode] = useState(DEFAULT_LATEX);
  const [isCompiling, setIsCompiling] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [compileError, setCompileError] = useState('');

  // Visual Blocks
  const [blocks, setBlocks] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isGeneratingLatex, setIsGeneratingLatex] = useState(false);

  // AI Chat
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your AI Resume Coach. I can rewrite bullet points, optimize for specific roles, add missing sections, or improve your ATS score. What would you like to change?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Save to Firebase
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // ── Handle PDF Upload ─────────────────────────────────────────
  const handlePdfUpload = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.name.endsWith('.pdf')) { setUploadError('Please upload a PDF file.'); return; }
    setUploadedFile(f);
    setUploadError('');
    setOnboardStep('analyzing');
    try {
      const arrayBuffer = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n';
      }
      if (text.trim().length < 100) throw new Error('Could not extract enough text.');
      setUploadedText(text);

      // Auto-rate the uploaded resume
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/resume/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: text }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setRating(data.analysis);

      // Also parse into blocks for the visual editor
      setIsParsing(true);
      const parseRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/resume/parse`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: text }),
      });
      const parseData = await parseRes.json();
      if (parseData.success) {
        setBlocks(parseData.blocks);
      }
      setIsParsing(false);

      setOnboardStep('rated');
    } catch (err) {
      setUploadError(err.message);
      setOnboardStep('upload');
      setIsParsing(false);
    }
  };

  // ── LaTeX Compile ─────────────────────────────────────────────
  const compileLatex = useCallback(async (code = latexCode) => {
    setIsCompiling(true);
    setCompileError('');
    try {
      let safeCode = code.trim();

      // ── Sanitize: strip markdown fences if AI returned them ──
      safeCode = safeCode.replace(/^```(?:latex)?\s*/i, '').replace(/\s*```$/i, '').trim();

      // ── Sanitize: remove any \usepackage / \geometry / \setlist 
      //   that leaked inside \begin{document}…\end{document}
      const beginDoc = safeCode.indexOf('\\begin{document}');
      if (beginDoc !== -1) {
        const beforeDoc = safeCode.slice(0, beginDoc);
        let insideDoc  = safeCode.slice(beginDoc);
        // Strip preamble-only commands from the body
        insideDoc = insideDoc
          .replace(/\\usepackage\s*(\[.*?\])?\s*\{[^}]*\}\s*/g, '')
          .replace(/\\geometry\s*\{[^}]*\}\s*/g, '')
          .replace(/\\setlist\s*(\[.*?\])?\s*\{[^}]*\}\s*/g, '')
          .replace(/\\documentclass\s*(\[.*?\])?\s*\{[^}]*\}\s*/g, '');
        safeCode = beforeDoc + insideDoc;
      }

      // ── Guard: if missing \documentclass, prepend full preamble ──
      if (!safeCode.startsWith('\\documentclass')) {
        safeCode = `\\documentclass[10pt, letterpaper]{article}
\\usepackage[margin=0.5in]{geometry}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\setlist[itemize]{leftmargin=*, noitemsep, topsep=2pt}
\\setlength{\\parindent}{0pt}

` + safeCode;
      }

      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/resume/compile-latex`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex: safeCode }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: 'Server error. Please restart your backend.' }));
        throw new Error(d.error || 'Compilation failed');
      }
      const blob = await res.blob();
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
    } catch (err) {
      setCompileError(err.message);
    } finally {
      setIsCompiling(false);
    }
  }, [latexCode, pdfUrl]);


  // ── AI Chat Send ─────────────────────────────────────────────
  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || isChatLoading) return;
    const newMessages = [...chatMessages, { role: 'user', content: msg }];
    setChatMessages(newMessages);
    setChatInput('');
    setIsChatLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/resume/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, blocks, currentLatex: latexCode }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to get chat response.');

      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);

      // If AI updated the blocks — regenerate LaTeX and compile PDF directly
      if (data.updatedBlocks) {
        setBlocks(data.updatedBlocks);

        // Step 1: Generate updated LaTeX from the new blocks
        const latexRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/resume/generate-latex`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocks: data.updatedBlocks }),
        });
        const latexData = await latexRes.json();
        if (!latexData.success) throw new Error('Failed to regenerate LaTeX from updated blocks.');

        const newLatex = latexData.latex;
        setLatexCode(newLatex);

        // Step 2: Compile updated LaTeX to PDF directly (bypass stale closure in compileLatex)
        setIsCompiling(true);
        setCompileError(null);
        try {
          const compileRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/resume/compile-latex`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latex: newLatex }),
          });
          if (compileRes.ok) {
            const blob = await compileRes.blob();
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            setPdfUrl(URL.createObjectURL(blob));
          }
        } finally {
          setIsCompiling(false);
        }
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I encountered an error: ${err.message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };





  // ── Handle Continue to Editor ──────────────────────────────────
  const handleContinueToEditor = async () => {
    if (blocks) {
      setIsGeneratingLatex(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/resume/generate-latex`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocks }),
        });
        const data = await res.json();
        if (data.success) {
          setLatexCode(data.latex);
          setOnboardStep('editor');
          compileLatex(data.latex);
        }
      } catch (err) {
        alert('Failed to sync blocks to editor: ' + err.message);
      } finally {
        setIsGeneratingLatex(false);
      }
    } else {
      setOnboardStep('editor');
    }
  };

  // ── Blocks to LaTeX ──────────────────────────────────────────
  const syncBlocksToLatex = async () => {
    if (!blocks) return;
    setIsGeneratingLatex(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/resume/generate-latex`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      });
      const data = await res.json();
      if (data.success) {
        setLatexCode(data.latex);
        setActiveTab('latex');
        // Do NOT auto-compile here — let the user click "Preview" if they want to wait for the PDF
        setCompileError('LaTeX updated. Click "Rebuild PDF" to refresh the preview.');
      }
    } catch (err) {
      alert('Failed to sync: ' + err.message);
    } finally {
      setIsGeneratingLatex(false);
    }
  };

  // ── Save Resume to Firebase ───────────────────────────────────
  // Stores the LaTeX source (tiny, ~5-20KB) instead of the PDF blob (500KB+)
  // The SavedData page recompiles to PDF on demand when the user clicks Download.
  const savePdfToFirebase = async () => {
    const user = auth.currentUser;
    if (!user) { setSaveMsg('Log in to save.'); return; }
    setIsSaving(true);
    setSaveMsg('Saving…');
    const startTime = Date.now();
    try {
      console.log('[saveResume] Starting save...');
      
      // Optimistic update
      setSaveMsg('✓ Saved!');
      
      const summary = rating ? [
        `Resume Analysis Report`,
        `ATS Score: ${rating.score}/100`,
        `Role Match: ${rating.roleMatch || 'N/A'}`,
        '',
        'STRENGTHS:',
        ...(rating.strengths || []).map(s => `  - ${s}`),
        '',
        'AREAS FOR IMPROVEMENT:',
        ...(rating.weaknesses || []).map(w => `  - ${w}`),
      ].join('\n') : null;

      await addDoc(collection(db, 'savedPdfs'), {
        userId:    user.uid,
        type:      'resume',
        label:     blocks?.contact?.name || 'Resume',
        latexCode: latexCode,
        rating:    rating || null,
        textSummary: summary,
        createdAt: new Date().toISOString(),
      });
      console.log('[save] Success!');
      setSaveMsg('✓ Saved to Stored Data!');
    } catch (err) {
      console.error('[save] Firestore error:', err);
      setSaveMsg('Save failed: ' + err.message);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMsg(''), 4000);
    }
  };

  // ══════════════════════════════════════════════════════════════
  //  ONBOARDING SCREENS
  // ══════════════════════════════════════════════════════════════
  if (onboardStep === 'choose') {
    return (
      <div className="max-w-4xl mx-auto p-8 w-full flex flex-col items-center justify-center min-h-[80vh]">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-primary flex items-center justify-center gap-3 mb-3">
            <PenTool className="w-9 h-9" />
            <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }} className="hover:opacity-80 transition-opacity">Prep Wise</Link> Resume Editor
          </h1>
          <p className="text-muted-foreground text-lg">Build a stunning, ATS-optimized resume using LaTeX, visual blocks, or AI chat.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          <button onClick={() => {
            setBlocks(JSON.parse(JSON.stringify(EMPTY_BLOCKS)));
            setActiveTab('blocks');
            setOnboardStep('editor');
          }}
            className="group p-8 glass-card border-transparent hover:border-primary hover:-translate-y-2 transition-all text-left shadow-sm hover:shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-5 group-hover:scale-110 transition-transform">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold mb-2">Create New Resume</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Start with our professionally designed LaTeX template and build your resume from scratch.</p>
          </button>
          <button onClick={() => setOnboardStep('upload')}
            className="group p-8 glass-card border-transparent hover:border-primary hover:-translate-y-2 transition-all text-left shadow-sm hover:shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-5 group-hover:scale-110 transition-transform">
              <Upload className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold mb-2">Import Existing Resume</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Upload your PDF resume. We'll analyze and rate it, then open the editor with our template.</p>
          </button>
        </div>
      </div>
    );
  }

  if (onboardStep === 'upload') {
    return (
      <div className="max-w-2xl mx-auto p-8 w-full">
        <button onClick={() => setOnboardStep('choose')} className="text-sm text-muted-foreground hover:text-foreground font-bold mb-8 flex items-center gap-2">← Back</button>
        <h2 className="text-3xl font-bold mb-2">Upload Your Resume</h2>
        <p className="text-muted-foreground mb-8">We'll extract the content, give you an ATS score, and then let you edit using our tools.</p>
        {uploadError && <div className="mb-6 p-4 bg-destructive/10 border-l-4 border-destructive text-destructive rounded-xl text-sm">{uploadError}</div>}
        <div onClick={() => uploadRef.current?.click()}
          className="w-full h-64 border-2 border-dashed border-primary/40 rounded-3xl flex flex-col items-center justify-center glass-card hover:bg-primary/5 transition-all cursor-pointer group">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform mb-4">
            <Upload className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold mb-1">Click to upload PDF</h3>
          <p className="text-muted-foreground text-sm">Text-based PDF only · Max 5MB</p>
        </div>
        <input ref={uploadRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
      </div>
    );
  }

  if (onboardStep === 'analyzing') {
    return (
      <div className="max-w-2xl mx-auto p-8 w-full flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
        <h3 className="text-2xl font-bold animate-pulse mb-2">Analyzing Your Resume...</h3>
        <p style={{ color: 'var(--text-muted)' }}>Checking ATS score, keywords, and structure</p>
      </div>
    );
  }

  if (onboardStep === 'rated' && rating) {
    return (
      <div className="max-w-3xl mx-auto p-8 w-full">
        <div className="flex items-center gap-3 mb-6 p-4 bg-secondary/50 rounded-2xl border border-border">
          <FileText className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm">{uploadedFile?.name}</span>
        </div>
        <h2 className="text-3xl font-bold mb-1">Your Resume Analysis</h2>
        <p className="text-muted-foreground mb-8">Here's how your current resume scores. You can now edit it using our AI-powered tools.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="glass-card p-6 flex flex-col items-center text-center">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">ATS Score</p>
            <ScoreRing score={rating.score} />
            <p className="text-sm mt-4 text-muted-foreground">
              {rating.score >= 80 ? '🟢 Excellent' : rating.score >= 60 ? '🟡 Good' : '🔴 Needs Work'}
            </p>
          </div>
          <div className="col-span-2 space-y-4">
            <div className="glass-card p-5">
              <h4 className="text-sm font-bold text-green-500 flex items-center gap-2 mb-3"><CheckCircle2 className="w-4 h-4" /> Strengths</h4>
              <ul className="space-y-1.5">
                {rating.strengths?.slice(0, 3).map((s, i) => <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-green-500 shrink-0">•</span>{s}</li>)}
              </ul>
            </div>
            <div className="glass-card p-5">
              <h4 className="text-sm font-bold text-amber-500 flex items-center gap-2 mb-3"><AlertCircle className="w-4 h-4" /> Key Issues</h4>
              <ul className="space-y-1.5">
                {rating.weaknesses?.slice(0, 3).map((w, i) => <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-amber-500 shrink-0">•</span>{w}</li>)}
              </ul>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 border-primary/20 mb-6">
          <h4 className="font-bold flex items-center gap-2 mb-4"><Sparkles className="w-5 h-5 text-primary" /> Top Suggestions</h4>
          <ul className="space-y-2">
            {rating.suggestions?.slice(0, 4).map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />{s}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3 mb-8">
          <button onClick={handleContinueToEditor} disabled={isGeneratingLatex}
            className="flex-1 py-4 btn-glow text-lg transition flex items-center justify-center gap-3">
            {isGeneratingLatex ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue to Editor <ArrowRight className="w-5 h-5" /></>}
          </button>
          <button onClick={async () => {
              const user = auth.currentUser;
              if (!user) { setSaveMsg('Log in to save.'); return; }
              setIsSaving(true);
              setSaveMsg('');
              try {
                await addDoc(collection(db, 'savedPdfs'), {
                  userId: user.uid,
                  type: 'analysis',
                  label: `Analysis - ${uploadedFile?.name || 'Resume'}`,
                  score: rating.score,
                  data: rating,
                  createdAt: new Date().toISOString(),
                });
                setSaveMsg('✓ Analysis Saved!');
              } catch (err) {
                console.error('[saveRating]', err);
                setSaveMsg('Failed: ' + err.message);
              } finally {
                setIsSaving(false);
                setTimeout(() => setSaveMsg(''), 4000);
              }
            }}
            disabled={isSaving}
            className="px-6 py-4 rounded-xl border-2 border-primary/40 text-primary hover:bg-primary/10 transition flex items-center gap-2 font-bold whitespace-nowrap">
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Save Rating
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  //  MAIN EDITOR
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="h-full w-full flex flex-col p-6">
      {/* Toolbar */}
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <button onClick={() => {
              // Reset all editor state for the new resume session
              setChatMessages([{ role: 'assistant', content: "Hi! I'm your AI Resume Coach. I can rewrite bullet points, optimize for specific roles, add missing sections, or improve your ATS score. What would you like to change?" }]);
              setChatInput('');
              setBlocks(null);
              setLatexCode(DEFAULT_LATEX);
              if (pdfUrl) URL.revokeObjectURL(pdfUrl);
              setPdfUrl(null);
              setCompileError('');
              setActiveTab('latex');
              setUploadedFile(null);
              setUploadedText('');
              setRating(null);
              setOnboardStep('choose');
            }} className="text-sm text-muted-foreground hover:text-foreground font-bold">← Back</button>
          <h1 className="text-2xl font-extrabold text-primary flex items-center gap-2">
            <PenTool className="w-6 h-6" />
            <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }} className="hover:opacity-80 transition-opacity">Prep Wise</Link> Resume Editor
          </h1>
        </div>
        <div className="flex gap-3 items-center">
          {saveMsg && <span className={`text-xs font-bold px-3 py-1 rounded-lg ${saveMsg.startsWith('✓') ? 'text-green-500 bg-green-500/10' : 'text-destructive bg-destructive/10'}`}>{saveMsg}</span>}
          <button onClick={savePdfToFirebase} disabled={!latexCode.trim() || isSaving}
            className="px-4 py-2 rounded-xl border border-primary/40 hover:bg-primary/10 transition disabled:opacity-40 flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--accent-blue)' }}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save PDF
          </button>
          <button onClick={() => { if (pdfUrl) { const a = document.createElement('a'); a.href = pdfUrl; a.download = 'resume.pdf'; a.click(); } }}
            disabled={!pdfUrl}
            className="px-4 py-2 btn-glow transition disabled:opacity-40 flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </div>

      {/* Editor Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 min-h-0">

        {/* Left: Tabs */}
        <div className="flex flex-col glass-card min-h-0 overflow-hidden">
          <div className="flex border-b border-border bg-secondary/30 shrink-0">
            {[
              { id: 'latex', label: 'LaTeX', icon: Code },
              { id: 'blocks', label: 'Visual Blocks', icon: LayoutTemplate },
              { id: 'chat', label: 'AI Chat', icon: MessageSquare },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex-1 flex justify-center items-center gap-2 py-3 font-bold text-xs transition-colors border-b-2 ${activeTab === id ? 'border-primary text-primary bg-background' : 'border-transparent text-muted-foreground hover:bg-secondary/50'}`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>

          <div className="flex-1 relative min-h-0 overflow-hidden bg-background">
            {/* LaTeX Tab */}
            {activeTab === 'latex' && (
              <div className="absolute inset-0 flex flex-col">
                <div className="flex-1 min-h-0">
                  <Editor height="100%" language="latex" theme="vs-dark" value={latexCode}
                    onChange={(v) => setLatexCode(v || '')}
                    options={{ minimap: { enabled: false }, wordWrap: 'on', padding: { top: 16 }, fontSize: 13 }} />
                </div>
                <div className="p-4 border-t border-border glass-card rounded-b-2xl shrink-0">
                  {compileError && <p className="text-destructive text-xs mb-2 font-bold">{compileError}</p>}
                  <button onClick={() => compileLatex()} disabled={isCompiling}
                    className="w-full py-3 btn-glow flex items-center justify-center gap-2 transition disabled:opacity-50 text-sm">
                    {isCompiling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {isCompiling ? 'Compiling...' : 'Compile & Preview'}
                  </button>
                </div>
              </div>
            )}

            {/* Blocks Tab */}
            {activeTab === 'blocks' && (
              <div className="absolute inset-0 flex flex-col">
                <div className="flex-1 p-6 overflow-y-auto space-y-8">
                  {isParsing ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                      <Loader2 className="w-10 h-10 text-primary animate-spin" />
                      <p className="font-bold text-sm">Parsing your resume into editable blocks...</p>
                    </div>
                  ) : blocks ? (
                    <>
                      {/* Personal Info */}
                      <section className="space-y-4">
                        <h4 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Personal Info</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { field: 'name',      label: 'Full Name',        type: 'text'  },
                            { field: 'email',     label: 'Email',            type: 'email' },
                            { field: 'phone',     label: 'Phone Number',     type: 'text'  },
                            { field: 'linkedin',  label: 'LinkedIn URL',     type: 'text'  },
                            { field: 'github',    label: 'GitHub URL',       type: 'text'  },
                            { field: 'portfolio', label: 'Portfolio / Website', type: 'text' },
                          ].map(({ field, label, type }) => (
                            <input
                              key={field}
                              type={type}
                              placeholder={label}
                              value={blocks.contact?.[field] || ''}
                              onChange={e => setBlocks({ ...blocks, contact: { ...blocks.contact, [field]: e.target.value } })}
                              className="px-3 py-2 rounded-xl border text-sm col-span-1"
                              style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                            />
                          ))}
                        </div>
                      </section>

                      {/* Education */}
                      <section className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Education</h4>
                          <div className="flex items-center gap-2">
                            <button onClick={syncBlocksToLatex} disabled={isGeneratingLatex}
                              className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition text-[10px] font-bold uppercase tracking-wider">
                              {isGeneratingLatex ? 'Syncing…' : 'Sync Changes'}
                            </button>
                            <button onClick={() => setBlocks({ ...blocks, education: [...(blocks.education || []), { institution: '', degree: '', date: '', gpa: '' }] })}
                              className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition"
                            ><Plus className="w-4 h-4" /></button>
                          </div>
                        </div>
                        {(blocks.education || []).map((edu, idx) => (
                          <div key={idx} className="p-4 rounded-2xl border space-y-3 relative group" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                            <button onClick={() => {
                              const n = [...blocks.education]; n.splice(idx, 1);
                              setBlocks({ ...blocks, education: n });
                            }} className="absolute top-4 right-4 text-muted-foreground hover:text-destructive transition opacity-0 group-hover:opacity-100"
                            ><Trash2 className="w-4 h-4" /></button>
                            <div className="grid grid-cols-2 gap-2">
                              <input type="text" placeholder="University / Institution" value={edu.institution || ''}
                                onChange={e => { const n=[...blocks.education]; n[idx]={...n[idx],institution:e.target.value}; setBlocks({...blocks,education:n}); }}
                                className="px-3 py-2 rounded-lg border text-sm font-bold col-span-2"
                                style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                              <input type="text" placeholder="Degree (e.g. B.S. in Computer Science)" value={edu.degree || ''}
                                onChange={e => { const n=[...blocks.education]; n[idx]={...n[idx],degree:e.target.value}; setBlocks({...blocks,education:n}); }}
                                className="px-3 py-2 rounded-lg border text-sm col-span-2"
                                style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                              <input type="text" placeholder="Date (e.g. May 2024)" value={edu.date || ''}
                                onChange={e => { const n=[...blocks.education]; n[idx]={...n[idx],date:e.target.value}; setBlocks({...blocks,education:n}); }}
                                className="px-3 py-2 rounded-lg border text-sm"
                                style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                              <input type="text" placeholder="GPA (optional)" value={edu.gpa || ''}
                                onChange={e => { const n=[...blocks.education]; n[idx]={...n[idx],gpa:e.target.value}; setBlocks({...blocks,education:n}); }}
                                className="px-3 py-2 rounded-lg border text-sm"
                                style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                            </div>
                          </div>
                        ))}
                      </section>

                      {/* Experience */}
                      <section className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Experience</h4>
                          <button onClick={() => setBlocks({ ...blocks, experience: [...(blocks.experience || []), { company: '', role: '', duration: '', location: '', points: [''] }] })}
                            className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition"
                          ><Plus className="w-4 h-4" /></button>
                        </div>
                        {(blocks.experience || []).map((exp, idx) => (

                          <div key={idx} className="p-4 rounded-2xl border space-y-3 relative group" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                            <button onClick={() => {
                              const newExp = [...blocks.experience];
                              newExp.splice(idx, 1);
                              setBlocks({ ...blocks, experience: newExp });
                            }} className="absolute top-4 right-4 text-muted-foreground hover:text-destructive transition opacity-0 group-hover:opacity-100"
                            ><Trash2 className="w-4 h-4" /></button>

                            <div className="grid grid-cols-2 gap-2">
                              {/* Company name */}
                              <input type="text" placeholder="Internship / Company Name"
                                value={exp.company || ''}
                                onChange={e => { const n=[...blocks.experience]; n[idx]={...n[idx],company:e.target.value}; setBlocks({...blocks,experience:n}); }}
                                className="px-3 py-2 rounded-lg border text-sm font-bold"
                                style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                              />
                              {/* Role */}
                              <input type="text" placeholder="Job Title / Role"
                                value={exp.role || ''}
                                onChange={e => { const n=[...blocks.experience]; n[idx]={...n[idx],role:e.target.value}; setBlocks({...blocks,experience:n}); }}
                                className="px-3 py-2 rounded-lg border text-sm"
                                style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                              />
                              {/* Duration */}
                              <input type="text" placeholder="Duration (e.g. Jun 2023 – Aug 2023)"
                                value={exp.duration || exp.date || ''}
                                onChange={e => { const n=[...blocks.experience]; n[idx]={...n[idx],duration:e.target.value,date:e.target.value}; setBlocks({...blocks,experience:n}); }}
                                className="px-3 py-2 rounded-lg border text-sm"
                                style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                              />
                              {/* Location */}
                              <input type="text" placeholder="Location (e.g. Remote, New York)"
                                value={exp.location || ''}
                                onChange={e => { const n=[...blocks.experience]; n[idx]={...n[idx],location:e.target.value}; setBlocks({...blocks,experience:n}); }}
                                className="px-3 py-2 rounded-lg border text-sm"
                                style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                              />
                            </div>

                            {/* Description bullets */}
                            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Description / Bullet Points</p>
                            <div className="space-y-2">
                              {(exp.points || []).map((p, pIdx) => (
                                <div key={pIdx} className="flex gap-2">
                                  <textarea value={p} onChange={e => {
                                    const newExp = [...blocks.experience];
                                    newExp[idx] = { ...newExp[idx], points: [...(newExp[idx].points || [])] };
                                    newExp[idx].points[pIdx] = e.target.value;
                                    setBlocks({ ...blocks, experience: newExp });
                                  }} className="flex-1 px-3 py-1.5 rounded-lg border text-xs min-h-[60px]"
                                  style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                                  <button onClick={() => {
                                    const newExp = [...blocks.experience];
                                    newExp[idx].points.splice(pIdx, 1);
                                    setBlocks({ ...blocks, experience: newExp });
                                  }} className="p-1 text-muted-foreground hover:text-destructive"
                                  ><XCircle className="w-4 h-4" /></button>
                                </div>
                              ))}
                              <button onClick={() => {
                                const newExp = [...blocks.experience];
                                newExp[idx] = { ...newExp[idx], points: [...(newExp[idx].points || []), ''] };
                                setBlocks({ ...blocks, experience: newExp });
                              }} className="text-xs font-bold text-primary flex items-center gap-1"
                              ><Plus className="w-3 h-3" /> Add Bullet Point</button>
                            </div>
                          </div>
                        ))}
                      </section>

                      {/* Projects */}
                      <section className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Projects</h4>
                          <button onClick={() => setBlocks({ ...blocks, projects: [...(blocks.projects || []), { name: '', techStack: '', link: '', points: [''] }] })}
                            className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition"
                          ><Plus className="w-4 h-4" /></button>
                        </div>
                        {(blocks.projects || []).map((proj, idx) => (
                          <div key={idx} className="p-4 rounded-2xl border space-y-3 relative group" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                            <button onClick={() => {
                              const n=[...blocks.projects]; n.splice(idx,1);
                              setBlocks({...blocks, projects: n});
                            }} className="absolute top-4 right-4 text-muted-foreground hover:text-destructive transition opacity-0 group-hover:opacity-100"
                            ><Trash2 className="w-4 h-4" /></button>
                            <div className="grid grid-cols-2 gap-2">
                              <input type="text" placeholder="Project Name" value={proj.name || ''}
                                onChange={e => { const n=[...blocks.projects]; n[idx]={...n[idx],name:e.target.value}; setBlocks({...blocks,projects:n}); }}
                                className="px-3 py-2 rounded-lg border text-sm font-bold"
                                style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                              <input type="text" placeholder="Tech Stack (e.g. React, Node.js)" value={proj.techStack || ''}
                                onChange={e => { const n=[...blocks.projects]; n[idx]={...n[idx],techStack:e.target.value}; setBlocks({...blocks,projects:n}); }}
                                className="px-3 py-2 rounded-lg border text-sm"
                                style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                              <input type="text" placeholder="GitHub / Demo Link (optional)" value={proj.link || ''}
                                onChange={e => { const n=[...blocks.projects]; n[idx]={...n[idx],link:e.target.value}; setBlocks({...blocks,projects:n}); }}
                                className="px-3 py-2 rounded-lg border text-sm col-span-2"
                                style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                            </div>
                            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Description / Bullet Points</p>
                            <div className="space-y-2">
                              {(proj.points || []).map((p, pIdx) => (
                                <div key={pIdx} className="flex gap-2">
                                  <textarea value={p} onChange={e => {
                                    const n=[...blocks.projects]; n[idx]={...n[idx],points:[...(n[idx].points||[])]}; n[idx].points[pIdx]=e.target.value;
                                    setBlocks({...blocks,projects:n});
                                  }} className="flex-1 px-3 py-1.5 rounded-lg border text-xs min-h-[50px]"
                                  style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                                  <button onClick={() => {
                                    const n=[...blocks.projects]; n[idx].points.splice(pIdx,1);
                                    setBlocks({...blocks,projects:n});
                                  }} className="p-1 text-muted-foreground hover:text-destructive"><XCircle className="w-4 h-4" /></button>
                                </div>
                              ))}
                              <button onClick={() => {
                                const n=[...blocks.projects]; n[idx]={...n[idx],points:[...(n[idx].points||[]),''] };
                                setBlocks({...blocks,projects:n});
                              }} className="text-xs font-bold text-primary flex items-center gap-1"><Plus className="w-3 h-3" /> Add Bullet Point</button>
                            </div>
                          </div>
                        ))}
                      </section>

                      <section className="space-y-4">
                        <h4 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Skills</h4>
                        <textarea
                          placeholder="e.g. Languages: Python, Java... Frameworks: React, Node..."
                          value={Array.isArray(blocks.skills) ? blocks.skills.join('\n') : blocks.skills || ''}
                          onChange={e => setBlocks({ ...blocks, skills: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border text-sm min-h-[100px]"
                          style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                        />
                      </section>

                      {/* Custom Sections */}
                      <section className="space-y-4 pt-4 border-t border-border">
                        <div className="flex justify-between items-center">
                          <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Custom Sections</h4>
                          <button onClick={() => setBlocks({...blocks, customSections: [...(blocks.customSections || []), {title: 'New Section', items: ['']}]})}
                            className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition flex items-center gap-1 text-xs"><Plus className="w-4 h-4" /> Add Section</button>
                        </div>
                        {(blocks.customSections || []).map((sec, idx) => (
                          <div key={idx} className="p-4 rounded-2xl border border-border bg-secondary/20 space-y-3 relative group">
                            <button onClick={() => {
                              const newSecs = [...blocks.customSections];
                              newSecs.splice(idx, 1);
                              setBlocks({...blocks, customSections: newSecs});
                            }} className="absolute top-4 right-4 text-muted-foreground hover:text-destructive transition opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                            <input type="text" placeholder="Section Title (e.g. Certifications)" value={sec.title}
                              onChange={e => {
                                const newSecs = [...blocks.customSections];
                                newSecs[idx].title = e.target.value;
                                setBlocks({...blocks, customSections: newSecs});
                              }} className="w-full px-3 py-1.5 rounded-lg bg-background border border-border font-bold text-sm" />
                            <div className="space-y-2">
                              {sec.items?.map((item, iIdx) => (
                                <div key={iIdx} className="flex gap-2">
                                  <textarea value={item} onChange={e => {
                                    const newSecs = [...blocks.customSections];
                                    newSecs[idx].items[iIdx] = e.target.value;
                                    setBlocks({...blocks, customSections: newSecs});
                                  }} className="flex-1 px-3 py-1.5 rounded-lg bg-background border border-border text-xs min-h-[40px]" />
                                  <button onClick={() => {
                                    const newSecs = [...blocks.customSections];
                                    newSecs[idx].items.splice(iIdx, 1);
                                    setBlocks({...blocks, customSections: newSecs});
                                  }} className="p-1 text-muted-foreground hover:text-destructive"><XCircle className="w-4 h-4" /></button>
                                </div>
                              ))}
                              <button onClick={() => {
                                const newSecs = [...blocks.customSections];
                                newSecs[idx].items.push('');
                                setBlocks({...blocks, customSections: newSecs});
                              }} className="text-xs font-bold text-primary flex items-center gap-1"><Plus className="w-3 h-3" /> Add Item</button>
                            </div>
                          </div>
                        ))}
                      </section>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <LayoutTemplate className="w-16 h-16 text-muted-foreground mb-4 opacity-20" />
                      <h3 className="font-bold mb-2">No data to show</h3>
                      <p className="text-sm text-muted-foreground">Upload an existing resume to see it parsed into editable blocks here.</p>
                    </div>
                  )}
                </div>
                {blocks && (
                  <div className="p-4 border-t border-border glass-card rounded-b-2xl shrink-0">
                    <button onClick={syncBlocksToLatex} disabled={isGeneratingLatex}
                      className="w-full py-3 btn-glow flex items-center justify-center gap-2 transition disabled:opacity-50 text-sm">
                      {isGeneratingLatex ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Sync & Recompile LaTeX
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* AI Chat Tab */}
            {activeTab === 'chat' && (
              <div className="absolute inset-0 flex flex-col">
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary rounded-tl-sm'}`}>
                        {msg.content}
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><Bot className="w-4 h-4 text-primary" /></div>
                      <div className="bg-secondary px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-4 border-t border-border glass-card rounded-b-2xl shrink-0">
                  <div className="flex gap-2">
                    <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                      placeholder="e.g. 'Add a summary section' or 'Make my bullets stronger'..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    <button onClick={sendChat} disabled={!chatInput.trim() || isChatLoading}
                      className="px-4 py-2.5 btn-glow transition flex items-center gap-2">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: PDF Preview */}
        <div className="flex flex-col glass-card min-h-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-secondary/30 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-sm">Live Preview</h3>
            <div className="flex items-center gap-3">
              {isCompiling && <span className="text-[10px] text-muted-foreground animate-pulse uppercase tracking-wider font-bold">Compiling…</span>}
              <button onClick={() => compileLatex(latexCode)} disabled={isCompiling || !latexCode.trim()}
                className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                <RefreshCw className={`w-3 h-3 ${isCompiling ? 'animate-spin' : ''}`} /> Rebuild PDF
              </button>
            </div>
          </div>
          <div className="flex-1 relative bg-neutral-100 dark:bg-neutral-800 min-h-0">
            {isCompiling ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                <p className="font-bold text-neutral-500 text-sm">Generating PDF via TeXLive...</p>
              </div>
            ) : pdfUrl ? (
              <iframe src={`${pdfUrl}#toolbar=0`} className="w-full h-full border-0 bg-white" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-neutral-400">
                <FileText className="w-16 h-16 mb-4 opacity-20" />
                <p className="font-bold mb-2">No Preview Yet</p>
                <p className="text-sm">Click "Compile & Preview" to render your LaTeX resume as a PDF.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
