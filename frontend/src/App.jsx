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
  error:   { bg: 'rgba(251,113,133,0.08)', border: 'rgba(251,113,133,0.15)', color: '#fb7185' },
  info:    { bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.15)', color: '#818cf8' },
};

const AGENTS_META = [
  { key: 'structural',    icon: '🏗️', name: 'Structural',     desc: 'Analyzes load-bearing capacity, stress distribution, wall thickness and deformation risks' },
  { key: 'manufacturing', icon: '⚙️', name: 'Manufacturing',  desc: 'Checks machinability, tolerance feasibility, DFM rules and process compatibility' },
  { key: 'compliance',    icon: '📋', name: 'Compliance',      desc: 'Validates against industry standards, safety codes and regulatory requirements' },
  { key: 'intent',        icon: '🎯', name: 'Intent',          desc: 'Ensures the design matches the stated brief — purpose, context and constraints' },
  { key: 'cost',          icon: '💰', name: 'Cost',            desc: 'Estimates material, machining and total fabrication cost with difficulty scoring' },
];

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
  const hasResults = agentsToShow.length > 0 || pendingAgents.length > 0 || results;

  return (
    <div className="flex flex-col min-h-screen">

      {/* ══ HEADER BAR ═══════════════════════════════════════ */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="shrink-0 px-4 md:px-8 pt-5 pb-4 text-center"
      >
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight mb-1"
          style={{
            background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 35%, #22d3ee 70%, #34d399 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            filter: 'drop-shadow(0 0 30px rgba(99,102,241,0.12))',
          }}>
          CAD Design Validator
        </h1>
        <p className="text-[0.7rem] tracking-wide mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
          AI-powered multi-agent design intelligence
        </p>

        {/* Step indicator — compact */}
        <div className="flex items-center justify-center gap-0 max-w-[220px] mx-auto">
          {[
            { n: 1, label: 'Upload', Icon: Upload },
            { n: 2, label: 'Analyze', Icon: Cpu },
            { n: 3, label: 'Results', Icon: CheckCircle2 },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center" style={{ flex: i < 2 ? 1 : undefined }}>
              <div className="flex flex-col items-center gap-0.5">
                <div className={`step-dot ${step >= s.n ? (step > s.n ? 'done' : 'active') : ''}`}>
                  <s.Icon size={11} />
                </div>
                <span className="text-[0.5rem] tracking-wider uppercase" style={{ color: step >= s.n ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)' }}>{s.label}</span>
              </div>
              {i < 2 && <div className={`step-line mx-1.5 ${step > s.n ? 'done' : ''}`} />}
            </div>
          ))}
        </div>
      </motion.header>

      {/* ══ MAIN CONTENT — fills remaining viewport ══════════ */}
      <div className="flex-1 px-4 md:px-8 pb-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

        {/* ── LEFT PANEL (input controls) ─────────────────── */}
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 }}
          className="lg:col-span-5 xl:col-span-4 space-y-4 lg:sticky lg:top-6"
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
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-xl p-3 flex gap-2 items-start text-xs"
                style={{ background: 'rgba(251,113,133,0.06)', border: '1px solid rgba(251,113,133,0.12)' }}>
                <X size={13} style={{ color: '#fb7185', marginTop: 1, flexShrink: 0 }} />
                <span style={{ color: 'var(--color-text-secondary)' }}>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>

        {/* ── RIGHT PANEL (results / landing) ─────────────── */}
        <motion.main
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-7 xl:col-span-8"
        >
          {hasResults ? (
            <div className="space-y-4">
              {/* Verdict */}
              <AnimatePresence>
                {results && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                    <VerdictDashboard results={results} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Agent cards grid */}
              {(agentsToShow.length > 0 || pendingAgents.length > 0) && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#818cf8', boxShadow: '0 0 6px #818cf8' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Agent Reports</span>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    <AnimatePresence mode="popLayout">
                      {agentsToShow.map((a, i) => (
                        <motion.div key={a.agent} initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 350, damping: 30 }} layout>
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
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#fb7185', boxShadow: '0 0 6px #fb7185' }} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Priority Issues · {results.issues.length}</span>
                    </div>
                    <div className="space-y-2">
                      {results.issues.slice(0, 6).map((issue, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                          className={`issue-${(issue.severity || 'low').toLowerCase()} rounded-lg p-2.5 flex gap-2 text-xs`}
                          style={{ background: 'var(--color-bg-glass)' }}>
                          <span className={`verdict-${issue.severity === 'HIGH' ? 'fail' : issue.severity === 'MEDIUM' ? 'warn' : 'pass'} px-1.5 py-0.5 rounded text-[0.6rem] font-bold uppercase self-start`}>
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
            </div>
          ) : (
            /* ══ LANDING STATE — fills the space ═════════════ */
            <div className="space-y-4">
              {/* Agent cards — full descriptions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AGENTS_META.map((a, i) => (
                  <motion.div key={a.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}
                    className="glass-card p-5 flex gap-4 items-start">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.08)' }}>
                      {a.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold mb-1">{a.name} Agent</div>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{a.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* How it works — horizontal */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22d3ee', boxShadow: '0 0 6px #22d3ee' }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>How It Works</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { s: '01', t: 'Upload', d: 'Drop a STEP, OBJ, or STL file and describe your design intent in the brief', icon: '📤', color: '#818cf8' },
                    { s: '02', t: 'Analyze', d: 'Five AI agents run sequentially — each streaming results back to you in real-time', icon: '⚡', color: '#22d3ee' },
                    { s: '03', t: 'Verdict', d: 'A weighted consensus engine combines all agent outputs into a final PASS or FAIL', icon: '🏆', color: '#34d399' },
                  ].map(item => (
                    <div key={item.s} className="text-center py-5 px-4 rounded-xl" style={{ background: 'var(--color-bg-glass)' }}>
                      <div className="text-2xl mb-2">{item.icon}</div>
                      <div className="text-[0.55rem] font-bold uppercase tracking-widest mb-1" style={{ color: item.color }}>Step {item.s}</div>
                      <div className="text-sm font-semibold mb-1.5">{item.t}</div>
                      <p className="text-[0.65rem] leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>{item.d}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* System stats */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
                className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#a78bfa', boxShadow: '0 0 6px #a78bfa' }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>System Capabilities</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { icon: '🤖', val: '5 Agents', desc: 'Specialized AI validators' },
                    { icon: '⚡', val: 'WebSocket', desc: 'Real-time streaming' },
                    { icon: '📊', val: 'Weighted', desc: 'Consensus scoring' },
                    { icon: '💡', val: 'Explainable', desc: 'Issue reasoning + zones' },
                  ].map(s => (
                    <div key={s.val} className="text-center py-4 px-3 rounded-xl" style={{ background: 'var(--color-bg-glass)' }}>
                      <div className="text-xl mb-1.5">{s.icon}</div>
                      <div className="text-xs font-bold mb-0.5" style={{ color: '#818cf8' }}>{s.val}</div>
                      <div className="text-[0.6rem]" style={{ color: 'var(--color-text-tertiary)' }}>{s.desc}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </motion.main>
      </div>

      {/* ══ TOASTS ═══════════════════════════════════════════ */}
      <div className="fixed bottom-5 right-5 z-50 space-y-2">
        <AnimatePresence>
          {toasts.map(t => {
            const c = TOAST_COLORS[t.type] || TOAST_COLORS.info;
            return (
              <motion.div key={t.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
                className="toast flex items-center gap-2" style={{ background: c.bg, borderColor: c.border, color: c.color }}>
                <CheckCircle2 size={14} /><span>{t.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
