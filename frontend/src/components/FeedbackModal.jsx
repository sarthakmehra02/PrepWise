import { useState } from 'react';
import { X, TrendingUp, AlertCircle, Star, CheckCircle2, ChevronUp, Loader2, Save } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

// Score label + colour mapping
const SCORE_META = {
  technicalAccuracy:    { label: 'Technical Accuracy',   color: 'blue'   },
  problemSolving:       { label: 'Problem Solving',       color: 'violet' },
  communicationClarity: { label: 'Communication Clarity', color: 'emerald'},
  depthOfKnowledge:     { label: 'Depth of Knowledge',   color: 'amber'  },
  confidence:           { label: 'Confidence',            color: 'pink'   },
};

const COLOR_CLASSES = {
  blue:    { bar: 'bg-blue-500',    text: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-400/30'   },
  violet:  { bar: 'bg-violet-500',  text: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-400/30' },
  emerald: { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-400/30'},
  amber:   { bar: 'bg-amber-500',   text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-400/30'  },
  pink:    { bar: 'bg-pink-500',    text: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-400/30'   },
};

function ScoreBar({ scoreKey, value }) {
  const meta   = SCORE_META[scoreKey] || { label: scoreKey, color: 'blue' };
  const colors = COLOR_CLASSES[meta.color];
  const pct    = (value / 10) * 100;
  const grade  = value >= 8 ? 'Excellent' : value >= 6 ? 'Good' : value >= 4 ? 'Fair' : 'Needs Work';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{meta.label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${colors.bg} ${colors.text} border ${colors.border}`}>
            {grade}
          </span>
          <span className={`font-black text-base ${colors.text}`}>{value}<span className="text-muted-foreground text-xs font-normal">/10</span></span>
        </div>
      </div>
      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function AverageCircle({ average }) {
  const color = average >= 8 ? '#22c55e' : average >= 6 ? '#f59e0b' : average >= 4 ? '#f97316' : '#ef4444';
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (average / 10) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-secondary" />
          <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={circ} strokeDashoffset={dashOffset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-black" style={{ color }}>{average}</span>
          <span className="text-xs text-muted-foreground font-semibold">/ 10</span>
        </div>
      </div>
      <p className="text-sm font-bold" style={{ color }}>
        {average >= 8 ? '🏆 Excellent Performance' : average >= 6 ? '👍 Good Performance' : average >= 4 ? '📈 Needs Improvement' : '💪 Keep Practising'}
      </p>
    </div>
  );
}

export function FeedbackModal({ feedback, role, onClose }) {
  const [activeTab, setActiveTab] = useState('scores');
  const [isSaving, setIsSaving]   = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');

  const saveToFirebase = async () => {
    const user = auth.currentUser;
    if (!user) { setSaveMsg('Log in to save.'); return; }
    setIsSaving(true);
    setSaveMsg('Saving…');
    const startTime = Date.now();
    try {
      console.log('[saveInterview] Starting save...');
      
      // Optimistic update
      setSaveMsg('✓ Saved!');
      
      await addDoc(collection(db, 'savedPdfs'), {
        userId: user.uid,
        type: 'interview',
        label: role || 'Interview Report',
        average: feedback.average,
        scores: feedback.scores,
        strengths: feedback.strengths,
        improvements: feedback.improvements,
        summary: feedback.summary,
        createdAt: new Date().toISOString(),
      });
      console.log(`[saveInterview] Success in ${Date.now() - startTime}ms`);
    } catch (err) {
      console.error('[saveInterview] Firestore error:', err);
      setSaveMsg('Save failed: ' + err.message);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMsg(''), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="text-2xl font-black">Interview Performance</h2>
            {role && <p className="text-muted-foreground text-sm mt-0.5">{role}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Average Score */}
        <div className="px-7 py-6 border-b border-border shrink-0">
          <AverageCircle average={feedback.average} />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {[
            { id: 'scores',       label: 'Scores' },
            { id: 'strengths',    label: 'Strengths' },
            { id: 'improvements', label: 'To Improve' },
            { id: 'summary',     label: 'Summary' },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-3 text-sm font-bold transition-colors ${
                activeTab === t.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-7 py-6">
          {activeTab === 'scores' && (
            <div className="space-y-5">
              {Object.entries(feedback.scores).map(([key, val]) => (
                <ScoreBar key={key} scoreKey={key} value={val} />
              ))}
              <p className="text-xs text-muted-foreground text-center pt-2">
                Average: <strong className="text-foreground">{feedback.average}/10</strong>
              </p>
            </div>
          )}

          {activeTab === 'strengths' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-emerald-400">What You Did Well</h3>
              </div>
              {(feedback.strengths || []).map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-400/20">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed">{s}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'improvements' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-amber-400">Areas to Work On</h3>
              </div>
              {(feedback.improvements || []).map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-400/20">
                  <ChevronUp className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed">{s}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-primary">Overall Assessment</h3>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90 bg-secondary/50 p-5 rounded-2xl border border-border">
                {feedback.summary}
              </p>
              <div className="grid grid-cols-3 gap-3 pt-2">
                {Object.entries(feedback.scores).map(([key, val]) => {
                  const meta   = SCORE_META[key] || { label: key, color: 'blue' };
                  const colors = COLOR_CLASSES[meta.color];
                  return (
                    <div key={key} className={`p-3 rounded-xl border text-center ${colors.bg} ${colors.border}`}>
                      <div className={`text-2xl font-black ${colors.text}`}>{val}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{meta.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-border shrink-0 flex items-center gap-3">
          {saveMsg && <span className={`text-xs font-bold px-3 py-1 rounded-lg flex-1 ${saveMsg.startsWith('✓') ? 'text-green-500 bg-green-500/10' : 'text-destructive bg-destructive/10'}`}>{saveMsg}</span>}
          {!saveMsg && <div className="flex-1" />}
          <button onClick={saveToFirebase} disabled={isSaving}
            className="px-4 py-2.5 rounded-xl border border-primary/40 hover:bg-primary/10 transition disabled:opacity-40 flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--accent-blue)' }}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Report
          </button>
          <button onClick={onClose}
            className="bg-primary text-primary-foreground py-2.5 px-6 rounded-xl font-bold hover:opacity-90 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Grading In-Progress Overlay ──────────────────────────────────
export function GradingOverlay() {
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm gap-4">
      <Loader2 className="w-12 h-12 text-primary animate-spin" />
      <p className="text-lg font-bold">Analysing your performance…</p>
      <p className="text-sm text-muted-foreground">Prep Wise is reviewing your interview</p>
    </div>
  );
}
