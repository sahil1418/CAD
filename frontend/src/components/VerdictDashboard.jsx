import { motion } from 'framer-motion';
import { AlertTriangle, ShieldAlert, TrendingUp } from 'lucide-react';

export default function VerdictDashboard({ results }) {
  const verdict = (results.final_verdict || 'FAIL').toUpperCase();
  const score = results.score || 0;
  const confidence = results.confidence || 0;
  const uncertainty = results.uncertainty || 0;
  const lowConf = results.low_confidence_flag || false;
  const dissent = results.dissent_detected || false;
  const dissentDetails = results.dissent_details || [];
  const dissentSummary = results.dissent_summary || '';
  const top3 = results.top_3_issues || [];

  const cfg = {
    PASS:             { bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.15)', color: '#34d399', label: 'Design Approved', icon: '✓' },
    CONDITIONAL_PASS: { bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'Conditional Pass', icon: '⚠' },
    FAIL:             { bg: 'rgba(251,113,133,0.06)', border: 'rgba(251,113,133,0.15)', color: '#fb7185', label: 'Design Rejected', icon: '✕' },
  };
  const c = cfg[verdict] || cfg.FAIL;

  return (
    <div className="space-y-3.5">
      {/* ── Main Verdict Banner ──────────────────────────── */}
      <div className="glass-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ borderColor: c.border }}>
        <div className="flex items-center gap-4">
          {/* Score ring */}
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.15 }}
            className="score-ring shrink-0"
            style={{ background: `conic-gradient(${c.color} ${score * 3.6}deg, rgba(255,255,255,0.03) 0deg)` }}
          >
            <div className="w-[82px] h-[82px] rounded-full flex flex-col items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
              <span className="text-2xl font-black tabular-nums" style={{ color: c.color }}>{score}</span>
              <span className="text-[0.45rem] uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>Score</span>
            </div>
          </motion.div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-bold">{c.label}</span>
              <span className={`verdict-${verdict === 'PASS' ? 'pass' : verdict === 'FAIL' ? 'fail' : 'warn'} px-2 py-0.5 rounded-md text-[0.55rem] font-bold uppercase`}>
                {verdict.replace('_', ' ')}
              </span>
            </div>
            <div className="flex gap-4 text-[0.65rem]" style={{ color: 'var(--color-text-tertiary)' }}>
              <span className="flex items-center gap-1"><TrendingUp size={10} /> Confidence: {(confidence * 100).toFixed(0)}%</span>
              <span>Uncertainty: {(uncertainty * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Low Confidence Alert ──────────────────────────── */}
      {lowConf && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-3.5 flex items-start gap-2.5 text-xs"
          style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.1)' }}>
          <AlertTriangle size={14} style={{ color: '#fbbf24', marginTop: 1, flexShrink: 0 }} />
          <div>
            <span className="font-semibold" style={{ color: '#fbbf24' }}>Low Confidence — </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Uncertainty is {(uncertainty * 100).toFixed(0)}%. {dissent ? 'Agents have conflicting assessments.' : 'Review flagged issues carefully.'}
            </span>
          </div>
        </motion.div>
      )}

      {/* ── Dissent Alert ─────────────────────────────────── */}
      {dissent && dissentDetails.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-xl p-3.5 flex items-start gap-2.5 text-xs"
          style={{ background: 'rgba(251,113,133,0.04)', border: '1px solid rgba(251,113,133,0.1)' }}>
          <ShieldAlert size={14} style={{ color: '#fb7185', marginTop: 1, flexShrink: 0 }} />
          <div>
            <span className="font-semibold" style={{ color: '#fb7185' }}>Agent Dissent — </span>
            {dissentSummary && <span style={{ color: 'var(--color-text-secondary)' }}>{dissentSummary} </span>}
            {dissentDetails.map((d, i) => (
              <span key={i} className="block mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>• {d}</span>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Top 3 Critical Issues ─────────────────────────── */}
      {top3.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#fb7185', boxShadow: '0 0 6px #fb7185' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Top Critical Issues</span>
          </div>
          <div className="space-y-1.5">
            {top3.map((issue, i) => (
              <div key={i} className={`issue-${(issue.severity || 'low').toLowerCase()} rounded-lg p-2.5 flex items-start gap-2 text-[0.65rem]`} style={{ background: 'var(--color-bg-glass)' }}>
                <span className="font-black shrink-0 w-5 text-center" style={{ color: i === 0 ? '#fb7185' : i === 1 ? '#fbbf24' : '#22d3ee' }}>
                  #{i + 1}
                </span>
                <div className="min-w-0">
                  <p>{issue.message}</p>
                  {issue.source_agent && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[0.5rem]" style={{ background: 'rgba(99,102,241,0.06)', color: '#818cf8' }}>
                      {issue.source_agent}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
