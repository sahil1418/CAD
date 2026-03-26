import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Cpu, CheckCircle2, ChevronRight, X } from 'lucide-react';
import FileUpload from './components/FileUpload';
import DesignBrief from './components/DesignBrief';
import AgentCard from './components/AgentCard';
import VerdictDashboard from './components/VerdictDashboard';
import SkeletonCard from './components/SkeletonCard';
import './index.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS = API.replace(/^http/, 'ws');

/* ── Toast hook ──────────────────────────────────────────── */
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = (msg, variant = 'default') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, variant }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  };
  return { toasts, add };
}

/* ═══════════════════════════════════════════════════════════ */
export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [fileName, setFileName] = useState('');
  const [brief, setBrief] = useState('');
  const [results, setResults] = useState(null);
  const [agentResults, setAgentResults] = useState([]);
  const [activeAgent, setActiveAgent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [geo, setGeo] = useState(null);
  const wsRef = useRef(null);
  const toast = useToast();

  const step = results ? 3 : loading ? 2 : sessionId ? 1 : 0;

  /* ── Upload ────────────────────────────────────────────── */
  const onUpload = async (file) => {
    setError(''); setResults(null); setAgentResults([]); setFileName(file.name);
    const fd = new FormData();
    fd.append('file', file); fd.append('design_brief', brief);
    try {
      const r = await fetch(`${API}/api/upload`, { method: 'POST', body: fd });
      if (!r.ok) throw new Error((await r.json()).detail || 'Upload failed');
      const d = await r.json();
      setSessionId(d.session_id); setGeo(d.geometry_summary);
      toast.add('File uploaded', 'success');
    } catch (e) { setError(e.message); toast.add(e.message, 'error'); }
  };

  /* ── Analyze (WS → REST fallback) ──────────────────────── */
  const onAnalyze = useCallback(() => {
    if (!sessionId) return;
    setLoading(true); setError(''); setResults(null); setAgentResults([]); setActiveAgent(null);
    toast.add('Pipeline started…');

    const runRest = async () => {
      try {
        const q = `${API}/api/analyze?session_id=${sessionId}${brief ? `&design_brief=${encodeURIComponent(brief)}` : ''}`;
        const r = await fetch(q, { method: 'POST' });
        if (!r.ok) throw new Error((await r.json()).detail || 'Analysis failed');
        const d = await r.json(); setResults(d); setAgentResults(d.agents || []);
        toast.add('Analysis complete', 'success');
      } catch (e) { setError(e.message); toast.add(e.message, 'error'); }
      finally { setLoading(false); }
    };

    try {
      const ws = new WebSocket(`${WS}/api/ws/analyze/${sessionId}`);
      wsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ design_brief: brief }));
      ws.onmessage = ({ data }) => {
        const m = JSON.parse(data);
        if (m.type === 'agent_start') setActiveAgent(m.agent);
        else if (m.type === 'agent_result') { setAgentResults(p => [...p, m.data]); setActiveAgent(null); }
        else if (m.type === 'consensus') setResults(m.data);
        else if (m.type === 'complete') { setLoading(false); toast.add('Analysis complete', 'success'); ws.close(); }
        else if (m.type === 'error') { setError(m.message); setLoading(false); ws.close(); }
      };
      ws.onerror = () => { ws.close(); runRest(); };
      ws.onclose = () => { wsRef.current = null; };
    } catch { runRest(); }
  }, [sessionId, brief]);

  const agents = results?.agents || agentResults;
  const ORDER = ['structural', 'manufacturing', 'compliance', 'intent', 'cost'];
  const pending = loading ? ORDER.filter(a => !agentResults.find(r => r.agent === a)) : [];
  const hasOutput = agents.length > 0 || pending.length > 0 || !!results;

  /* ═══════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Header ─────────────────────────────────────── */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">CAD Design Validator</h1>
          <p className="text-sm text-muted">Multi-agent design intelligence</p>
        </div>

        {/* Step indicator */}
        <div className="hidden sm:flex items-center gap-1 text-sm">
          {[
            { n: 1, label: 'Upload', Icon: Upload },
            { n: 2, label: 'Analyze', Icon: Cpu },
            { n: 3, label: 'Results', Icon: CheckCircle2 },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-1">
              {i > 0 && <div className={`w-6 h-px mx-1 ${step > i ? 'bg-emerald-500' : 'bg-border'}`} />}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border
                ${step > s.n ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : step === s.n ? 'bg-accent/10 border-accent/30 text-indigo-400'
                  : 'border-border text-muted'}`}>
                <s.Icon size={12} />
              </div>
              <span className={`text-xs ${step >= s.n ? 'text-muted-light' : 'text-muted'}`}>{s.label}</span>
            </div>
          ))}
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12">

        {/* LEFT — inputs */}
        <aside className="lg:col-span-4 xl:col-span-4 border-r border-border p-6 space-y-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
          <FileUpload onFileSelect={onUpload} fileName={fileName} geo={geo} />
          <DesignBrief value={brief} onChange={setBrief} />

          <button
            onClick={onAnalyze}
            disabled={!sessionId || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold text-white
              bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed
              transition-colors cursor-pointer"
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Analyzing…</>
            ) : (
              <>Analyze Design <ChevronRight size={16} /></>
            )}
          </button>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex gap-2 items-start p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                <X size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        {/* RIGHT — results / landing */}
        <main className="lg:col-span-8 xl:col-span-8 p-6 space-y-6 overflow-y-auto">
          {hasOutput ? (
            <>
              <AnimatePresence>
                {results && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <VerdictDashboard results={results} />
                  </motion.div>
                )}
              </AnimatePresence>

              {(agents.length > 0 || pending.length > 0) && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-light mb-4">Agent Reports</h2>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <AnimatePresence mode="popLayout">
                      {agents.map((a, i) => (
                        <motion.div key={a.agent} layout
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}>
                          <AgentCard agent={a} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {pending.map(n => <SkeletonCard key={n} name={n} isActive={activeAgent === n} />)}
                  </div>
                </section>
              )}

              <AnimatePresence>
                {results?.issues?.length > 0 && (
                  <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 className="text-sm font-semibold text-muted-light mb-3">All Issues</h2>
                    <div className="space-y-2">
                      {results.issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-surface-raised border border-border text-sm">
                          <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-semibold uppercase
                            ${issue.severity === 'HIGH' ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : issue.severity === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}`}>
                            {issue.severity}
                          </span>
                          <div>
                            <p className="text-gray-200">{issue.message}</p>
                            {issue.suggestion && <p className="mt-1 text-sm text-muted">💡 {issue.suggestion}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>
            </>
          ) : (
            /* ── Landing ──────────────────────────────────── */
            <div className="space-y-6">
              <div className="text-center py-10 border border-border rounded-xl bg-surface-raised">
                <p className="text-3xl mb-3">⬡</p>
                <h2 className="text-xl font-bold text-white mb-2">Intelligence Awaits</h2>
                <p className="text-sm text-muted max-w-md mx-auto">
                  Upload a CAD file and describe your design intent. Five AI agents will validate it in real-time.
                </p>
              </div>

              <section>
                <h3 className="text-sm font-semibold text-muted-light mb-3">Agent Pipeline</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {[
                    { icon: '🏗️', name: 'Structural',     desc: 'Stress, load-bearing & deformation analysis' },
                    { icon: '⚙️', name: 'Manufacturing',  desc: 'DFM checks, tolerance & machinability' },
                    { icon: '📋', name: 'Compliance',      desc: 'Regulatory standards & safety codes' },
                    { icon: '🎯', name: 'Intent',          desc: 'Design-brief alignment & purpose validation' },
                    { icon: '💰', name: 'Cost',            desc: 'Material, machining & total cost estimation' },
                  ].map(a => (
                    <div key={a.name} className="flex items-start gap-3 p-4 rounded-lg bg-surface-raised border border-border">
                      <span className="text-xl">{a.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-white">{a.name}</p>
                        <p className="text-sm text-muted mt-0.5">{a.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-muted-light mb-3">How It Works</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { n: '1', title: 'Upload',  desc: 'STEP / OBJ / STL file + design brief' },
                    { n: '2', title: 'Analyze', desc: 'Agents stream results in real-time via WebSocket' },
                    { n: '3', title: 'Verdict', desc: 'Weighted consensus produces PASS / FAIL' },
                  ].map(s => (
                    <div key={s.n} className="p-4 rounded-lg bg-surface-raised border border-border text-center">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-bold flex items-center justify-center mx-auto mb-3">{s.n}</div>
                      <p className="text-sm font-semibold text-white">{s.title}</p>
                      <p className="text-sm text-muted mt-1">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-muted-light mb-3">Capabilities</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { v: '5 Agents', d: 'Specialized AI' },
                    { v: 'WebSocket', d: 'Real-time stream' },
                    { v: 'Weighted', d: 'Consensus scoring' },
                    { v: 'Explainable', d: 'Issue reasoning' },
                  ].map(s => (
                    <div key={s.v} className="p-4 rounded-lg bg-surface-raised border border-border text-center">
                      <p className="text-sm font-bold text-indigo-400">{s.v}</p>
                      <p className="text-xs text-muted mt-0.5">{s.d}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* ── Toasts ─────────────────────────────────────── */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        <AnimatePresence>
          {toast.toasts.map(t => (
            <motion.div key={t.id}
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium border shadow-lg
                ${t.variant === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : t.variant === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : 'bg-surface-overlay border-border text-muted-light'}`}>
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
