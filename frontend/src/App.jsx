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

    // Try WebSocket first, fall back to REST
    try {
      const ws = new WebSocket(`${WS_BASE}/api/ws/analyze/${sessionId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ design_brief: designBrief }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === 'agent_start') {
          setActiveAgent(msg.agent);
        } else if (msg.type === 'agent_result') {
          setAgentResults(prev => [...prev, msg.data]);
          setActiveAgent(null);
        } else if (msg.type === 'consensus') {
          setResults(msg.data);
        } else if (msg.type === 'complete') {
          setLoading(false);
          ws.close();
        } else if (msg.type === 'error') {
          setError(msg.message);
          setLoading(false);
          ws.close();
        }
      };

      ws.onerror = () => {
        // Fallback to REST
        ws.close();
        fallbackRest();
      };

      ws.onclose = () => {
        wsRef.current = null;
      };
    } catch {
      fallbackRest();
    }
  }, [sessionId, designBrief]);

  const fallbackRest = async () => {
    try {
      const url = `${API_BASE}/api/analyze?session_id=${sessionId}${designBrief ? `&design_brief=${encodeURIComponent(designBrief)}` : ''}`;
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Analysis failed'); }
      const data = await res.json();
      setResults(data);
      setAgentResults(data.agents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const agentsToShow = results?.agents || agentResults;
  const AGENT_ORDER = ['structural', 'manufacturing', 'compliance', 'intent', 'cost'];
  const pendingAgents = loading
    ? AGENT_ORDER.filter(a => !agentResults.find(r => r.agent === a))
    : [];

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 lg:px-12 max-w-[1440px] mx-auto">
      {/* ── Header ────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium tracking-wide uppercase mb-4"
          style={{ background: 'rgba(34,211,238,0.08)', color: 'var(--color-accent-cyan)', border: '1px solid rgba(34,211,238,0.15)' }}>
          ⬡ Multi-Agent Intelligence
        </div>
        <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent leading-tight mb-2">
          CAD Design Validator
        </h1>
        <p className="text-sm md:text-base" style={{ color: 'var(--color-text-secondary)' }}>
          5 specialized AI agents · consensus intelligence · real-time analysis
        </p>
      </motion.header>

      {/* ── Main Split Layout ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT: Upload + Brief */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-4 space-y-5"
        >
          <FileUpload onFileSelect={handleFileUpload} fileName={fileName} geometrySummary={geometrySummary} />
          <DesignBrief value={designBrief} onChange={setDesignBrief} />

          {/* Analyze Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-analyze w-full py-4 rounded-xl text-white font-semibold text-base flex items-center justify-center gap-3 border-0 cursor-pointer"
            style={{ fontFamily: 'Inter, sans-serif' }}
            onClick={handleAnalyze}
            disabled={!sessionId || loading}
          >
            {loading ? (<><div className="spinner" /> Running Pipeline...</>) : (<>🚀 Analyze Design</>)}
          </motion.button>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl p-4 flex gap-3 items-start text-sm"
                style={{ background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)' }}
              >
                <span>❌</span>
                <div>
                  <div className="font-semibold" style={{ color: 'var(--color-accent-rose)' }}>Error</div>
                  <p style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* RIGHT: Results Dashboard */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-8 space-y-5"
        >
          {/* Verdict Banner */}
          <AnimatePresence>
            {results && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <VerdictDashboard results={results} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Agent Cards */}
          {(agentsToShow.length > 0 || pendingAgents.length > 0) && (
            <div>
              <h3 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                🤖 Agent Reports
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {agentsToShow.map((agent, idx) => (
                    <motion.div
                      key={agent.agent}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: idx * 0.08, type: 'spring', stiffness: 300, damping: 30 }}
                      layout
                    >
                      <AgentCard agent={agent} />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Skeleton loaders for pending agents */}
                {pendingAgents.map((name) => (
                  <motion.div
                    key={`skeleton-${name}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <SkeletonCard agentName={name} isActive={activeAgent === name} />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Priority Issues */}
          <AnimatePresence>
            {results?.issues?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card p-6"
              >
                <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                  🔥 Priority Issues ({results.issues.length})
                </h3>
                <div className="space-y-2">
                  {results.issues.slice(0, 8).map((issue, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + idx * 0.05 }}
                      className={`issue-${(issue.severity || 'low').toLowerCase()} rounded-lg p-3 flex gap-3 text-sm`}
                      style={{ background: 'var(--color-surface-glass)' }}
                    >
                      <span className={`badge-${(issue.severity || 'low').toLowerCase() === 'high' ? 'fail' : (issue.severity || 'low').toLowerCase() === 'medium' ? 'warn' : 'pass'} px-2 py-0.5 rounded-md text-xs font-bold uppercase self-start`}>
                        {issue.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p style={{ color: 'var(--color-text-primary)' }}>{issue.message}</p>
                        {issue.suggestion && (
                          <p className="text-xs mt-1 italic" style={{ color: 'var(--color-text-muted)' }}>💡 {issue.suggestion}</p>
                        )}
                        {issue.source_agent && (
                          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Agent: {issue.source_agent}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          {!loading && !results && agentsToShow.length === 0 && (
            <div className="glass-card p-12 text-center">
              <div className="text-5xl mb-4">📐</div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Ready to Analyze
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Upload a CAD file and enter a design brief to get started.
                The agent pipeline will validate your design in real-time.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default App;
