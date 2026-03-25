import { motion } from 'framer-motion';

export default function VerdictDashboard({ results }) {
  const verdict = (results.final_verdict || 'FAIL').toUpperCase();
  const score = results.score || 0;
  const confidence = results.confidence || 0;
  const uncertainty = results.uncertainty || 0;
  const lowConfidence = results.low_confidence_flag || false;
  const dissent = results.dissent_detected || false;
  const dissentDetails = results.dissent_details || [];
  const dissentSummary = results.dissent_summary || '';
  const top3 = results.top_3_issues || [];

  const cfg = {
    PASS: { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', icon: '✅', label: 'Design Approved', color: 'var(--color-accent-emerald)' },
    CONDITIONAL_PASS: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', icon: '⚠️', label: 'Conditional Pass', color: 'var(--color-accent-amber)' },
    FAIL: { bg: 'rgba(251,113,133,0.08)', border: 'rgba(251,113,133,0.2)', icon: '❌', label: 'Design Rejected', color: 'var(--color-accent-rose)' },
  };
  const c = cfg[verdict] || cfg.FAIL;

  return (
    <div className="space-y-4">
      {/* Main Banner */}
      <div className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ background: c.bg, border: `1px solid ${c.border}` }}>
        <div className="flex items-center gap-4">
          <span className="text-4xl">{c.icon}</span>
          <div>
            <h2 className="text-xl font-bold">{c.label}</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              Confidence: {(confidence * 100).toFixed(0)}% · Uncertainty: {(uncertainty * 100).toFixed(0)}%
            </p>
          </div>
        </div>
        <div className="text-right">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
            className="score-ring"
            style={{ background: `conic-gradient(${c.color} ${score * 3.6}deg, rgba(255,255,255,0.04) 0deg)` }}
          >
            <div className="w-[80px] h-[80px] rounded-full flex flex-col items-center justify-center"
              style={{ background: 'var(--color-surface-primary)' }}>
              <span className="text-2xl font-black" style={{ color: c.color }}>{score}</span>
              <span className="text-[0.55rem] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Score</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Low Confidence Warning */}
      {lowConfidence && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4 flex gap-3 items-start text-sm"
          style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}
        >
          <span className="text-lg">⚡</span>
          <div>
            <h4 className="font-semibold text-sm" style={{ color: 'var(--color-accent-amber)' }}>
              Low Confidence Decision
            </h4>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              High uncertainty ({(uncertainty * 100).toFixed(0)}%) detected.
              {dissent ? ' Agents have conflicting assessments.' : ' Consider reviewing flagged issues carefully.'}
            </p>
          </div>
        </motion.div>
      )}

      {/* Dissent Warning */}
      {dissent && dissentDetails.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl p-4 flex gap-3 items-start text-sm"
          style={{ background: 'rgba(251,113,133,0.06)', border: '1px solid rgba(251,113,133,0.15)' }}
        >
          <span className="text-lg">🔥</span>
          <div>
            <h4 className="font-semibold text-sm" style={{ color: 'var(--color-accent-rose)' }}>
              Agent Dissent Detected
            </h4>
            {dissentSummary && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{dissentSummary}</p>
            )}
            {dissentDetails.map((d, i) => (
              <p key={i} className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>• {d}</p>
            ))}
          </div>
        </motion.div>
      )}

      {/* Top 3 Issues Quick View */}
      {top3.length > 0 && (
        <div className="glass-card p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
            ⚡ Top Critical Issues
          </h4>
          <div className="space-y-2">
            {top3.map((issue, i) => (
              <div key={i} className={`issue-${(issue.severity || 'low').toLowerCase()} rounded-lg p-3 flex gap-2.5 text-xs`}
                style={{ background: 'var(--color-surface-glass)' }}>
                <span className="font-bold shrink-0" style={{
                  color: issue.severity === 'HIGH' ? 'var(--color-accent-rose)' : issue.severity === 'MEDIUM' ? 'var(--color-accent-amber)' : 'var(--color-accent-cyan)'
                }}>
                  #{i + 1}
                </span>
                <div>
                  <p style={{ color: 'var(--color-text-primary)' }}>{issue.message}</p>
                  {issue.source_agent && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[0.6rem]"
                      style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--color-accent-indigo)' }}>
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
