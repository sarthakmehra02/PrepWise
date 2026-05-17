import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Database, Loader2, Trophy, TrendingUp, ChevronDown, ChevronUp,
  Trash2, RefreshCw, Calendar, Briefcase, CheckCircle2, AlertCircle,
  FileText, Download, BarChart2, Mic, Target, Star, Eye, X
} from 'lucide-react';

const SCORE_LABELS = {
  technicalAccuracy:    'Technical Accuracy',
  problemSolving:       'Problem Solving',
  communicationClarity: 'Communication',
  depthOfKnowledge:     'Depth of Knowledge',
  confidence:           'Confidence',
};

function ScoreBar({ label, value }) {
  const color = value >= 8 ? 'bg-green-500' : value >= 6 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-bold text-muted-foreground">{label}</span>
        <span className="text-xs font-black">{value}/10</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${value * 10}%` }} />
      </div>
    </div>
  );
}

// ── Interview Card ────────────────────────────────────────────────
function InterviewCard({ record, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const avg = record.average || 0;
  const avgColor = avg >= 8 ? 'text-green-500' : avg >= 6 ? 'text-amber-500' : 'text-red-500';
  const avgBg   = avg >= 8 ? 'bg-green-500/10 border-green-500/20' : avg >= 6 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';
  const date = record.createdAt
    ? new Date(record.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Unknown date';

  return (
    <div className="glass-card overflow-hidden transition-all">
      <div className="p-5 flex items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 ${avgBg}`}>
          <span className={`text-xl font-black ${avgColor}`}>{avg.toFixed(1)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base truncate">{record.role || record.label || 'Unknown Role'}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Mic className="w-3 h-3" /> Interview Result
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {date}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onDelete} className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => setExpanded(!expanded)} className="p-2 rounded-xl text-muted-foreground hover:bg-secondary transition">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {record.summary && (
        <div className="px-5 pb-4 text-sm text-muted-foreground italic border-t border-border pt-4">
          "{record.summary}"
        </div>
      )}

      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-border pt-5">
          {record.scores && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Performance Breakdown</h4>
              {Object.entries(record.scores).map(([key, val]) => (
                <ScoreBar key={key} label={SCORE_LABELS[key] || key} value={val} />
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {record.strengths?.length > 0 && (
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                <h4 className="text-xs font-bold text-green-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Strengths
                </h4>
                <ul className="space-y-2">
                  {record.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-green-500 shrink-0 mt-0.5">•</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {record.improvements?.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" /> To Improve
                </h4>
                <ul className="space-y-2">
                  {record.improvements.map((imp, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-amber-500 shrink-0 mt-0.5">•</span>{imp}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Resume PDF Card ───────────────────────────────────────────────
function ResumePdfCard({ record, onDelete }) {
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileErr, setCompileErr]   = useState('');
  const [previewUrl, setPreviewUrl]   = useState(null);
  const [expanded, setExpanded]       = useState(false);
  
  const date = record.createdAt
    ? new Date(record.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Unknown date';

  const getPdfBlob = async () => {
    if (!record.latexCode) throw new Error('No LaTeX source found.');
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/resume/compile-latex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latex: record.latexCode }),
    });
    if (!res.ok) throw new Error('Compilation failed');
    return await res.blob();
  };

  const downloadPdf = async () => {
    setIsCompiling(true);
    setCompileErr('');
    try {
      const blob = await getPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${record.label || 'resume'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setCompileErr(err.message);
    } finally {
      setIsCompiling(false);
    }
  };

  const viewPdf = async () => {
    setIsCompiling(true);
    setCompileErr('');
    try {
      const blob = await getPdfBlob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      setCompileErr(err.message);
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <>
      <div className="glass-card overflow-hidden transition-all">
        <div className="p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base truncate">{record.label || 'Resume PDF'}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="w-3 h-3" /> Resume (LaTeX)
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {date}
              </span>
              {record.rating && (
                <span className="text-xs font-bold text-green-500 ml-2">ATS: {record.rating.score}/100</span>
              )}
            </div>
            {compileErr && <p className="text-xs text-destructive mt-1">{compileErr}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={viewPdf} disabled={isCompiling}
              className="p-2 rounded-xl text-primary hover:bg-primary/10 transition disabled:opacity-40 flex items-center gap-1.5 text-xs font-semibold px-3"
              title="Preview PDF">
              {isCompiling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              {isCompiling ? 'Loading…' : 'View'}
            </button>
            <button onClick={downloadPdf} disabled={isCompiling}
              className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition disabled:opacity-40 flex items-center gap-1.5 text-xs font-semibold px-3"
              title="Download PDF">
              <Download className="w-4 h-4" />
              Download
            </button>
            {record.rating && (
              <>
                <button onClick={() => {
                  const summaryText = record.textSummary || [
                    `Resume ATS Feedback`,
                    `File: ${record.label || 'Resume PDF'}`,
                    `ATS Score: ${record.rating.score}/100`,
                    '',
                    'STRENGTHS:',
                    ...(record.rating.strengths || []).map(s => `  - ${s}`),
                    '',
                    'AREAS FOR IMPROVEMENT:',
                    ...(record.rating.weaknesses || []).map(w => `  - ${w}`),
                  ].join('\n');
                  const blob = new Blob([summaryText], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `ATS-Feedback.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                  className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition flex items-center gap-1.5 text-xs font-semibold px-3"
                  title="Download ATS Feedback">
                  <Download className="w-4 h-4" /> Feedback
                </button>
                <button onClick={() => setExpanded(!expanded)} 
                  className={`p-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold px-3 transition ${expanded ? 'text-primary bg-primary/10' : 'text-primary hover:bg-primary/10'}`}
                  title="View ATS Feedback">
                  {expanded ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {expanded ? 'Hide' : 'Feedback'}
                </button>
              </>
            )}
            <button onClick={onDelete} className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {expanded && record.rating && (
          <div className="px-5 pb-5 pt-5 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {record.rating.strengths?.length > 0 && (
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                  <h4 className="text-xs font-bold text-green-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Strengths
                  </h4>
                  <ul className="space-y-2">
                    {record.rating.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-green-500 shrink-0 mt-0.5">•</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {record.rating.weaknesses?.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" /> To Improve
                  </h4>
                  <ul className="space-y-2">
                    {record.rating.weaknesses.map((w, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-amber-500 shrink-0 mt-0.5">•</span>{w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-10">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setPreviewUrl(null)} />
          <div className="relative w-full h-full max-w-5xl bg-white rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="bg-void p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-white">{record.label || 'Resume Preview'}</span>
              </div>
              <button onClick={() => setPreviewUrl(null)} className="p-2 rounded-xl hover:bg-white/10 text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe src={previewUrl} className="flex-1 w-full border-none" title="PDF Preview" />
          </div>
        </div>
      )}
    </>
  );
}

// ── Analysis Report Card ──────────────────────────────────────────
function AnalysisCard({ record, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const date = record.createdAt
    ? new Date(record.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Unknown date';
  const score = record.score || 0;
  const scoreColor = score >= 80 ? 'text-green-500' : score >= 60 ? 'text-amber-500' : 'text-red-500';
  const scoreBg    = score >= 80 ? 'bg-green-500/10 border-green-500/20' : score >= 60 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';

  const downloadText = () => {
    const summaryText = record.textSummary || [
        `Resume Analysis Report`,
        `File: ${record.label || 'Unknown'}`,
        `ATS Score: ${score}/100`,
        `Role Match: ${record.roleMatch || 'N/A'}`,
        '',
        'STRENGTHS:',
        ...(record.result?.strengths || []).map(s => `  - ${s}`),
        '',
        'AREAS FOR IMPROVEMENT:',
        ...(record.result?.weaknesses || []).map(w => `  - ${w}`),
        '',
        'AI SUGGESTIONS:',
        ...(record.result?.suggestions || []).map(s => `  - ${s}`),
        '',
        'KEYWORDS FOUND: ' + (record.result?.keywords?.present || []).join(', '),
        'KEYWORDS MISSING: ' + (record.result?.keywords?.missing || []).join(', '),
    ].join('\n');

    const blob = new Blob([summaryText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${record.label || 'analysis'}-report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card overflow-hidden transition-all">
      <div className="p-5 flex items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 ${scoreBg}`}>
          <span className={`text-xl font-black ${scoreColor}`}>{score}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base truncate">{record.label || 'Resume Analysis'}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Target className="w-3 h-3" /> ATS Score: {score}/100
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {date}
            </span>
          </div>
          {record.roleMatch && (
            <p className="text-xs text-muted-foreground mt-1 truncate italic">{record.roleMatch}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={downloadText}
            className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition flex items-center gap-1.5 text-xs font-semibold px-3"
            title="Download Report">
            <Download className="w-4 h-4" /> Download
          </button>
          <button onClick={() => setExpanded(!expanded)} 
            className={`p-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold px-3 transition ${expanded ? 'text-primary bg-primary/10' : 'text-primary hover:bg-primary/10'}`}
            title="View Analysis">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {expanded ? 'Hide' : 'View'}
          </button>
          <button onClick={onDelete} className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && record.result && (
        <div className="px-5 pb-5 space-y-4 border-t border-border pt-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {record.result.strengths?.length > 0 && (
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                <h4 className="text-xs font-bold text-green-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Strengths
                </h4>
                <ul className="space-y-1">
                  {record.result.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-green-500 shrink-0 mt-0.5">•</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {record.result.weaknesses?.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" /> Areas to Improve
                </h4>
                <ul className="space-y-1">
                  {record.result.weaknesses.map((w, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-amber-500 shrink-0 mt-0.5">•</span>{w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {record.result.suggestions?.length > 0 && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
                <Star className="w-3.5 h-3.5" /> AI Suggestions
              </h4>
              <ul className="space-y-1.5">
                {record.result.suggestions.map((s, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary shrink-0 mt-0.5">→</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
export default function SavedData({ user }) {
  const [activeTab, setActiveTab]       = useState('interviews');
  const [interviews, setInterviews]     = useState([]);
  const [resumePdfs, setResumePdfs]     = useState([]);
  const [analyses, setAnalyses]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  const fetchAll = async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError('');
    try {
      const sortByDate = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '');

      // Legacy interview feedback collection
      const feedbackQ    = query(collection(db, 'feedback'),  where('userId', '==', user.uid));
      const feedbackSnap = await getDocs(feedbackQ);
      const feedbackDocs = feedbackSnap.docs
        .map(d => ({ id: d.id, _col: 'feedback', ...d.data() }))
        .sort(sortByDate);

      // savedPdfs collection — resumes, analyses, interview reports
      const savedQ    = query(collection(db, 'savedPdfs'), where('userId', '==', user.uid));
      const savedSnap = await getDocs(savedQ);
      const savedDocs = savedSnap.docs
        .map(d => ({ id: d.id, _col: 'savedPdfs', ...d.data() }))
        .sort(sortByDate);

      const interviewsFromSaved = savedDocs.filter(d => d.type === 'interview');
      setInterviews([...feedbackDocs, ...interviewsFromSaved].sort(sortByDate));
      setResumePdfs(savedDocs.filter(d => d.type === 'resume'));
      setAnalyses(savedDocs.filter(d => d.type === 'analysis'));
    } catch (err) {
      console.error('[savedData fetch]', err);
      setError('Failed to load saved data. ' + (err.message || '') + (err.code ? ` (${err.code})` : ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [user?.uid]);

  const handleDelete = async (record) => {
    try {
      await deleteDoc(doc(db, record._col, record.id));
      if (record._col === 'feedback' || record.type === 'interview') {
        setInterviews(prev => prev.filter(r => r.id !== record.id));
      } else if (record.type === 'resume') {
        setResumePdfs(prev => prev.filter(r => r.id !== record.id));
      } else if (record.type === 'analysis') {
        setAnalyses(prev => prev.filter(r => r.id !== record.id));
      }
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const tabs = [
    { id: 'interviews', label: 'Interview Results', icon: Mic,      count: interviews.length },
    { id: 'resumes',   label: 'Resume PDFs',        icon: FileText,  count: resumePdfs.length },
    { id: 'analyses',  label: 'Analysis Reports',   icon: BarChart2, count: analyses.length  },
  ];

  const totalItems = interviews.length + resumePdfs.length + analyses.length;
  const avgScore = interviews.length > 0
    ? (interviews.reduce((sum, r) => sum + (r.average || 0), 0) / interviews.length).toFixed(1)
    : '—';
  const bestScore = interviews.length > 0
    ? Math.max(...interviews.map(r => r.average || 0)).toFixed(1)
    : '—';

  return (
    <div className="max-w-4xl mx-auto p-8 w-full">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold text-primary flex items-center gap-3">
            <Database className="w-8 h-8" /> Stored Data
          </h1>
          <p className="text-muted-foreground mt-1">Your saved interviews, resumes, and analysis reports.</p>
        </div>
        <button onClick={fetchAll} disabled={loading}
          className="p-2.5 rounded-xl glass-card hover:border-primary/50 transition disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      {totalItems > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Saved',    value: totalItems,         icon: Database   },
            { label: 'Mock Interviews',value: interviews.length,  icon: Mic },
            { label: 'ATS Analyses',   value: analyses.length,    icon: BarChart2  },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="glass-card p-5 text-center">
              <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <div className="text-2xl font-black mb-1">{value}</div>
              <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-colors border-b-2 ${
              activeTab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-black">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-muted-foreground font-bold">Loading your data...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-destructive/10 border-l-4 border-destructive rounded-2xl">
          <p className="font-bold text-destructive">Error</p>
          <p className="text-sm text-destructive mt-1">{error}</p>
        </div>
      ) : (
        <>
          {activeTab === 'interviews' && (
            interviews.length === 0 ? (
              <EmptyState icon={Mic} title="No interview results yet" desc="Complete a mock interview — your performance report will appear here." />
            ) : (
              <div className="space-y-4">
                {interviews.map(record => (
                  <InterviewCard key={record.id} record={record} onDelete={() => handleDelete(record)} />
                ))}
              </div>
            )
          )}

          {activeTab === 'resumes' && (
            resumePdfs.length === 0 ? (
              <EmptyState icon={FileText} title="No resume PDFs saved" desc='Edit your resume in the Resume Editor and click "Save PDF" to store it here.' />
            ) : (
              <div className="space-y-4">
                {resumePdfs.map(record => (
                  <ResumePdfCard key={record.id} record={record} onDelete={() => handleDelete(record)} />
                ))}
              </div>
            )
          )}

          {activeTab === 'analyses' && (
            analyses.length === 0 ? (
              <EmptyState icon={BarChart2} title="No analysis reports saved" desc='Run a resume analysis and click "Save Report" to store the results here.' />
            ) : (
              <div className="space-y-4">
                {analyses.map(record => (
                  <AnalysisCard key={record.id} record={record} onDelete={() => handleDelete(record)} />
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
        <Icon className="w-9 h-9 text-muted-foreground opacity-40" />
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm max-w-sm">{desc}</p>
    </div>
  );
}
