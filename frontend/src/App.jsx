import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FileUpload from './components/FileUpload';
import DesignBrief from './components/DesignBrief';
import AgentCard from './components/AgentCard';
import VerdictDashboard from './components/VerdictDashboard';
import SkeletonCard from './components/SkeletonCard';
import './index.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_BASE = API_BASE.replace(/^http/, 'ws');

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

  const handleFileUpload = async (file) => {
    setError('');
    setResults(null);
    setAgentResults([]);
    setFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('design_brief', designBrief);

    try {
      const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Upload failed'); }
      const data = await res.json();
      setSessionId(data.session_id);
      setGeometrySummary(data.geometry_summary);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAnalyze = useCallback(() => {
    if (!sessionId) { setError('Upload a CAD file first.'); return; }
    setLoading(true);
    setError('');
    setResults(null);
    setAgentResults([]);
    setActiveAgent(null);

    try {
      const ws = new WebSocket(`${WS_BASE}/api/ws/analyze/${sessionId}`);
      wsRef.current = ws;

      ws.onopen = () => { ws.send(JSON.stringify({ design_brief: designBrief })); };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'agent_start') setActiveAgent(msg.agent);
        else if (msg.type === 'agent_result') { setAgentResults(prev => [...prev, msg.data]); setActiveAgent(null); }
        else if (msg.type === 'consensus') setResults(msg.data);
        else if (msg.type === 'complete') { setLoading(false); ws.close(); }
        else if (msg.type === 'error') { setError(msg.message); setLoading(false); ws.close(); }
      };

      ws.onerror = () => { ws.close(); fallbackRest(); };
      ws.onclose = () => { wsRef.current = null; };
    } catch { fallbackRest(); }
  }, [sessionId, designBrief]);

  const fallbackRest = async () => {
    try {
      const url = `${API_BASE}/api/analyze?session_id=${sessionId}${designBrief ? `&design_brief=${encodeURIComponent(designBrief)}` : ''}`;
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Analysis failed'); }
      const data = await res.json();
      setResults(data);
      setAgentResults(data.agents || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const agentsToShow = results?.agents || agentResults;
  const AGENT_ORDER = ['structural', 'manufacturing', 'compliance', 'intent', 'cost'];
  const pendingAgents = loading ? AGENT_ORDER.filter(a => !agentResults.find(r => r.agent === a)) : [];

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12 max-w-[1440px] mx-auto">

      {/* ── Decorative floating orbs ─────────────────────── */}
      <div className="fixed top-20 left-10 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.3), transparent)' }} />
      <div className="fixed bottom-20 right-10 w-60 h-60 rounded-full opacity-15 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.25), transparent)' }} />

      {/* ── Header ────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="text-center mb-10 relative"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold tracking-widest uppercase mb-5"
          style={{
            background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(99,102,241,0.08))',
            color: 'var(--color-accent-cyan)',
            border: '1px solid rgba(34,211,238,0.15)',
            boxShadow: '0 0 20px rgba(34,211,238,0.06)',
          }}
        >
          ⬡ Multi-Agent Intelligence
        </motion.div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-3"
          style={{
            background: 'linear-gradient(135deg, #818cf8 0%, #a78bfa 30%, #22d3ee 70%, #34d399 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 30px rgba(99,102,241,0.2))',
          }}>
          CAD Design Validator
        </h1>
        <p className="text-sm md:text-base max-w-lg mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
          5 specialized AI agents · consensus intelligence · real-time analysis
        </p>
        {/* Decorative line */}
        <div className="mt-6 mx-auto w-48 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(129,140,248,0.3), transparent)' }} />
      </motion.header>

      {/* ── Main Split Layout ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT: Upload + Brief + Button */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="lg:col-span-4 space-y-5"
        >
          <FileUpload onFileSelect={handleFileUpload} fileName={fileName} geometrySummary={geometrySummary} />
          <DesignBrief value={designBrief} onChange={setDesignBrief} />

          {/* Analyze Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="btn-analyze w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 cursor-pointer"
            style={{ fontFamily: 'Inter, sans-serif' }}
            onClick={handleAnalyze}
            disabled={!sessionId || loading}
          >
            {loading ? (<><div className="spinner" /> Running Agent Pipeline...</>) : (<>🚀 Analyze Design</>)}
          </motion.button>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="warning-box p-4 flex gap-3 items-start text-sm"
                style={{ background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)' }}
              >
                <span className="text-lg">❌</span>
                <div>
                  <div className="font-semibold" style={{ color: 'var(--color-accent-rose)' }}>Error</div>
                  <p className="mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* RIGHT: Results Dashboard */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="lg:col-span-8 space-y-5"
        >
          {/* Verdict Banner */}
          <AnimatePresence>
            {results && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <VerdictDashboard results={results} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Agent Cards */}
          {(agentsToShow.length > 0 || pendingAgents.length > 0) && (
            <div>
              <h3 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent-indigo)', boxShadow: '0 0 8px var(--color-accent-indigo)' }} />
                Agent Reports
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {agentsToShow.map((agent, idx) => (
                    <motion.div key={agent.agent} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: idx * 0.08, type: 'spring', stiffness: 300, damping: 30 }} layout>
                      <AgentCard agent={agent} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {pendingAgents.map((name) => (
                  <motion.div key={`skeleton-${name}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <SkeletonCard agentName={name} isActive={activeAgent === name} />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Priority Issues */}
          <AnimatePresence>
            {results?.issues?.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
                <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent-rose)', boxShadow: '0 0 8px var(--color-accent-rose)' }} />
                  Priority Issues ({results.issues.length})
                </h3>
                <div className="space-y-2">
                  {results.issues.slice(0, 8).map((issue, idx) => (
                    <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + idx * 0.05 }}
                      className={`issue-${(issue.severity || 'low').toLowerCase()} rounded-xl p-3 flex gap-3 text-sm`}
                      style={{ background: 'var(--color-surface-glass)' }}>
                      <span className={`badge-${issue.severity === 'HIGH' ? 'fail' : issue.severity === 'MEDIUM' ? 'warn' : 'pass'} px-2 py-0.5 rounded-lg text-xs font-bold uppercase self-start`}>
                        {issue.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p style={{ color: 'var(--color-text-primary)' }}>{issue.message}</p>
                        {issue.suggestion && <p className="text-xs mt-1 italic" style={{ color: 'var(--color-text-muted)' }}>💡 {issue.suggestion}</p>}
                        {issue.source_agent && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Agent: {issue.source_agent}</p>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          {!loading && !results && agentsToShow.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-16 text-center relative overflow-hidden"
            >
              {/* Background decorative gradient */}
              <div className="absolute inset-0 opacity-30" style={{
                background: 'radial-gradient(circle at 50% 30%, rgba(99,102,241,0.08), transparent 60%)'
              }} />
              <div className="relative z-10">
                <div className="text-6xl mb-5">📐</div>
                <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Ready to Analyze
                </h3>
                <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Upload a CAD file and provide a design brief. The multi-agent pipeline will validate your design with real-time streaming results.
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  {['🏗️ Structural', '⚙️ Mfg', '📋 Compliance', '🎯 Intent', '💰 Cost'].map((label) => (
                    <span key={label} className="px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--color-text-muted)' }}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default App;
