import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileCheck, Cpu, ChevronRight, CheckCircle2, X } from 'lucide-react';
import FileUploadComp from './components/FileUpload';
import DesignBrief from './components/DesignBrief';
import AgentCard from './components/AgentCard';
import VerdictDashboard from './components/VerdictDashboard';
import SkeletonCard from './components/SkeletonCard';
import './index.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS = API.replace(/^http/, 'ws');

// ── Toast hook ───────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };
  return { toasts, add };
}

const TOAST_COLORS = {
  success: { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.15)', color: '#34d399' },
  error: { bg: 'rgba(251,113,133,0.08)', border: 'rgba(251,113,133,0.15)', color: '#fb7185' },
  info: { bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.15)', color: '#818cf8' },
};

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [fileName, setFileName] = useState('');
  const [designBrief, setDesignBrief] = useState('');
  const [results, setResults] = useState(null);
  const [agentResults, setAgentResults] = useState([]);
  const [activeAgent, setActiveAgent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [geometrySummary, setGeometrySummary] = useState(null);
  const wsRef = useRef(null);
  const { toasts, add: addToast } = useToast();

  // Step: 0=none, 1=uploaded, 2=analyzing, 3=done
  const step = results ? 3 : loading ? 2 : sessionId ? 1 : 0;

  const handleFileUpload = async (file) => {
    setError(''); setResults(null); setAgentResults([]); setFileName(file.name);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('design_brief', designBrief);
    try {
      const res = await fetch(`${API}/api/upload`, { method: 'POST', body: formData });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Upload failed'); }
      const data = await res.json();
      setSessionId(data.session_id);
      setGeometrySummary(data.geometry_summary);
      addToast('File uploaded successfully', 'success');
    } catch (err) { setError(err.message); addToast(err.message, 'error'); }
  };

  const handleAnalyze = useCallback(() => {
    if (!sessionId) { setError('Upload a CAD file first.'); return; }
    setLoading(true); setError(''); setResults(null); setAgentResults([]); setActiveAgent(null);
    addToast('Starting agent pipeline...', 'info');

    try {
      const ws = new WebSocket(`${WS}/api/ws/analyze/${sessionId}`);
      wsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ design_brief: designBrief }));
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'agent_start') setActiveAgent(msg.agent);
        else if (msg.type === 'agent_result') { setAgentResults(p => [...p, msg.data]); setActiveAgent(null); }
        else if (msg.type === 'consensus') setResults(msg.data);
        else if (msg.type === 'complete') { setLoading(false); addToast('Analysis complete!', 'success'); ws.close(); }
        else if (msg.type === 'error') { setError(msg.message); setLoading(false); ws.close(); }
      };
      ws.onerror = () => { ws.close(); fallbackRest(); };
      ws.onclose = () => { wsRef.current = null; };
    } catch { fallbackRest(); }
  }, [sessionId, designBrief]);

  const fallbackRest = async () => {
    try {
      const url = `${API}/api/analyze?session_id=${sessionId}${designBrief ? `&design_brief=${encodeURIComponent(designBrief)}` : ''}`;
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Analysis failed'); }
      const data = await res.json();
      setResults(data); setAgentResults(data.agents || []);
      addToast('Analysis complete!', 'success');
    } catch (err) { setError(err.message); addToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const agentsToShow = results?.agents || agentResults;
  const AGENT_ORDER = ['structural', 'manufacturing', 'compliance', 'intent', 'cost'];
  const pendingAgents = loading ? AGENT_ORDER.filter(a => !agentResults.find(r => r.agent === a)) : [];

  return (
    <div className="min-h-screen px-4 py-5 md:px-6 lg:px-10 max-w-[1480px] mx-auto">

      {/* ══ HERO HEADER ══════════════════════════════════════ */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-6 pt-2"
      >
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight mb-2"
          style={{
            background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 35%, #22d3ee 70%, #34d399 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            filter: 'drop-shadow(0 0 40px rgba(99,102,241,0.15))',
          }}>
          CAD Design Validator
        </h1>
        <p className="text-xs md:text-sm tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
          AI-powered multi-agent design intelligence
        </p>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-0 mt-5 max-w-xs mx-auto">
          {[
            { n: 1, label: 'Upload', Icon: Upload },
            { n: 2, label: 'Analyze', Icon: Cpu },
            { n: 3, label: 'Results', Icon: CheckCircle2 },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center" style={{ flex: i < 2 ? 1 : undefined }}>
              <div className="flex flex-col items-center gap-1">
                <div className={`step-dot ${step >= s.n ? (step > s.n ? 'done' : 'active') : ''}`}>
                  <s.Icon size={12} />
                </div>
                <span className="text-[0.6rem] tracking-wider uppercase" style={{ color: step >= s.n ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)' }}>{s.label}</span>
              </div>
              {i < 2 && <div className={`step-line mx-2 ${step > s.n ? 'done' : ''}`} />}
            </div>
          ))}
        </div>
      </motion.header>

      {/* ══ MAIN LAYOUT (35/65 split) ════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* ── LEFT PANEL ──────────────────────────────────── */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="lg:col-span-4 xl:col-span-4 space-y-4"
        >
          <FileUploadComp onFileSelect={handleFileUpload} fileName={fileName} geometrySummary={geometrySummary} />
          <DesignBrief value={designBrief} onChange={setDesignBrief} />

          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            className="btn-primary w-full py-3.5 rounded-xl text-sm flex items-center justify-center gap-2.5 cursor-pointer"
            onClick={handleAnalyze}
            disabled={!sessionId || loading}
          >
            {loading ? (<><div className="spinner" /> Analyzing with AI agents...</>) : (<>Analyze Design <ChevronRight size={16} /></>)}
          </motion.button>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl p-3.5 flex gap-2.5 items-start text-xs"
                style={{ background: 'rgba(251,113,133,0.06)', border: '1px solid rgba(251,113,133,0.12)' }}>
                <X size={14} style={{ color: '#fb7185', marginTop: 1, flexShrink: 0 }} />
                <div>
                  <span className="font-semibold" style={{ color: '#fb7185' }}>Error: </span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>

        {/* ── RIGHT PANEL ─────────────────────────────────── */}
        <motion.main
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="lg:col-span-8 xl:col-span-8 space-y-4"
        >
          {/* Verdict */}
          <AnimatePresence>
            {results && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <VerdictDashboard results={results} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Agent Cards */}
          {(agentsToShow.length > 0 || pendingAgents.length > 0) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#818cf8', boxShadow: '0 0 6px #818cf8' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Agent Reports</h3>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
                <AnimatePresence mode="popLayout">
                  {agentsToShow.map((a, i) => (
                    <motion.div key={a.agent} initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * 0.06, type: 'spring', stiffness: 350, damping: 30 }} layout>
                      <AgentCard agent={a} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {pendingAgents.map(n => (
                  <motion.div key={`sk-${n}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <SkeletonCard agentName={n} isActive={activeAgent === n} />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Priority Issues */}
          <AnimatePresence>
            {results?.issues?.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#fb7185', boxShadow: '0 0 6px #fb7185' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Priority Issues · {results.issues.length}</h3>
                </div>
                <div className="space-y-2">
                  {results.issues.slice(0, 6).map((issue, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.04 }}
                      className={`issue-${(issue.severity || 'low').toLowerCase()} rounded-lg p-3 flex gap-2.5 text-xs`}
                      style={{ background: 'var(--color-bg-glass)' }}>
                      <span className={`verdict-${issue.severity === 'HIGH' ? 'fail' : issue.severity === 'MEDIUM' ? 'warn' : 'pass'} px-2 py-0.5 rounded-md text-[0.6rem] font-bold uppercase self-start`}>
                        {issue.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p>{issue.message}</p>
                        {issue.suggestion && <p className="mt-1 italic" style={{ color: 'var(--color-text-tertiary)' }}>💡 {issue.suggestion}</p>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── EMPTY STATE — Rich Landing ─────────────────── */}
          {!loading && !results && agentsToShow.length === 0 && (
            <div className="space-y-4">
              {/* Hero empty */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                className="glass-card p-10 text-center relative overflow-hidden">
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(99,102,241,0.06), transparent 60%)' }} />
                <div className="relative z-10">
                  <div className="text-4xl mb-3">⬡</div>
                  <h3 className="text-lg font-bold mb-1.5">Intelligence Awaits</h3>
                  <p className="text-xs max-w-md mx-auto leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                    Upload a CAD file and describe your design intent. Five specialized AI agents will validate your design with real-time streaming analysis.
                  </p>
                </div>
              </motion.div>

              {/* Agent pipeline preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {[
                  { icon: '🏗️', name: 'Structural', desc: 'Load-bearing & stress analysis', color: '#818cf8' },
                  { icon: '⚙️', name: 'Manufacturing', desc: 'DFM & machinability checks', color: '#a78bfa' },
                  { icon: '📋', name: 'Compliance', desc: 'Standards & regulatory fit', color: '#22d3ee' },
                  { icon: '🎯', name: 'Intent', desc: 'Design-brief alignment', color: '#34d399' },
                  { icon: '💰', name: 'Cost', desc: 'Material & machining cost', color: '#fbbf24' },
                ].map((a, i) => (
                  <motion.div key={a.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.06 }}
                    className="glass-card p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: `${a.color}15` }}>{a.icon}</div>
                    <div>
                      <div className="text-xs font-semibold">{a.name}</div>
                      <div className="text-[0.65rem] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{a.desc}</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* How it works */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
                className="glass-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22d3ee', boxShadow: '0 0 6px #22d3ee' }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>How It Works</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { s: '01', t: 'Upload', d: 'STEP / OBJ / STL file', icon: '📤' },
                    { s: '02', t: 'Analyze', d: 'Real-time agent pipeline', icon: '⚡' },
                    { s: '03', t: 'Verdict', d: 'Consensus PASS / FAIL', icon: '🏆' },
                  ].map(i => (
                    <div key={i.s} className="text-center py-3 rounded-lg" style={{ background: 'var(--color-bg-glass)' }}>
                      <div className="text-xl mb-1.5">{i.icon}</div>
                      <div className="text-[0.55rem] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--color-accent-blue)' }}>Step {i.s}</div>
                      <div className="text-xs font-semibold">{i.t}</div>
                      <div className="text-[0.6rem] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{i.d}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </motion.main>
      </div>

      {/* ══ TOAST NOTIFICATIONS ══════════════════════════════ */}
      <div className="fixed bottom-5 right-5 z-50 space-y-2">
        <AnimatePresence>
          {toasts.map(t => {
            const c = TOAST_COLORS[t.type] || TOAST_COLORS.info;
            return (
              <motion.div key={t.id}
                initial={{ opacity: 0, x: 40, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                className="toast flex items-center gap-2"
                style={{ background: c.bg, borderColor: c.border, color: c.color }}
              >
                <CheckCircle2 size={14} />
                <span>{t.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
