import { motion } from 'framer-motion';
import { AlertTriangle, ShieldAlert, Wrench, Download } from 'lucide-react';

const LABELS = {
  structural: 'Structural', manufacturing: 'Manufacturing',
  compliance: 'Compliance', intent: 'Intent', cost: 'Cost',
};

const MAX_SCORES = { structural: 30, manufacturing: 25, compliance: 20, intent: 15, cost: 10 };

function Badge({ verdict }) {
  const v = (verdict || '').toUpperCase();
  const cls = v === 'PASS' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : v === 'FAIL' ? 'bg-red-500/10 text-red-400 border-red-500/20'
    : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase border ${cls}`}>{v.replace('_', ' ')}</span>;
}

export default function VerdictDashboard({ results, sessionId, apiUrl }) {
  const verdict = (results.final_verdict || 'FAIL').toUpperCase();
  const score = results.score || 0;
  const confidence = results.confidence || 0;
  const uncertainty = results.uncertainty || 0;
  const lowConf = results.low_confidence_flag;
  const dissent = results.dissent_detected;
  const dissentDetails = results.dissent_details || [];
  const dissentSummary = results.dissent_summary || '';
  const top3 = results.top_3_issues || [];
  const breakdown = results.score_breakdown || {};
  const worstAgent = results.worst_agent || '';
  const explanation = results.verdict_explanation || '';
  const fixes = results.recommended_fixes || [];

  const v = {
    PASS:             { cls: 'bg-emerald-500/10 border-emerald-500/20', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Design Approved' },
    CONDITIONAL_PASS: { cls: 'bg-amber-500/10 border-amber-500/20',    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',      label: 'Conditional Pass' },
    FAIL:             { cls: 'bg-red-500/10 border-red-500/20',         badge: 'bg-red-500/10 text-red-400 border-red-500/20',             label: 'Design Rejected' },
  }[verdict] || { cls: 'bg-red-500/10 border-red-500/20', badge: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Design Rejected' };

  /* Extract passing & failing agents for dissent viz */
  const agents = results.agents || [];
  const passingAgents = agents.filter(a => a.verdict === 'PASS').map(a => a.agent);
  const failingAgents = agents.filter(a => a.verdict === 'FAIL').map(a => a.agent);

  return (
    <div className="space-y-4">

      {/* ── Main verdict ──────────────────────────────── */}
      <div className={`rounded-lg border p-5 ${v.cls}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="w-16 h-16 rounded-full bg-surface border border-border flex flex-col items-center justify-center shrink-0">
              <span className="text-xl font-black text-white">{score}</span>
              <span className="text-xs text-muted">/ 100</span>
            </motion.div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-white">{v.label}</h2>
                <Badge verdict={verdict} />
              </div>
              <p className="text-sm text-muted">
                Confidence: {(confidence * 100).toFixed(0)}% · Uncertainty: {(uncertainty * 100).toFixed(0)}%
              </p>
            </div>
          </div>
          {/* Download button */}
          {sessionId && apiUrl && (
            <button
              onClick={() => window.open(`${apiUrl}/api/report/${sessionId}`, '_blank')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold
                bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer shrink-0"
            >
              <Download size={16} /> Download Report
            </button>
          )}
        </div>

        {/* Verdict explanation */}
        {explanation && (
          <p className="mt-3 text-sm text-muted-light border-t border-border pt-3">{explanation}</p>
        )}
      </div>

      {/* ── Score Breakdown ────────────────────────────── */}
      {Object.keys(breakdown).length > 0 && (
        <div className="rounded-lg bg-surface-raised border border-border p-4">
          <h3 className="text-sm font-semibold text-muted-light mb-3">Score Breakdown</h3>
          <div className="space-y-2.5">
            {Object.entries(breakdown).map(([agent, val]) => {
              const max = MAX_SCORES[agent] || 10;
              const pct = Math.min((val / max) * 100, 100);
              const isWorst = agent === worstAgent;
              const barColor = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
              return (
                <div key={agent} className={`flex items-center gap-3 ${isWorst ? 'px-2 py-1.5 -mx-2 rounded-md bg-red-500/5 border border-red-500/10' : ''}`}>
                  <span className={`text-sm w-28 shrink-0 ${isWorst ? 'font-semibold text-red-400' : 'text-muted-light'}`}>
                    {LABELS[agent] || agent} {isWorst && '⚠'}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                    <motion.div className={`h-full rounded-full ${barColor}`}
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.1 }} />
                  </div>
                  <span className="text-xs font-semibold text-muted-light w-14 text-right tabular-nums">{val}/{max}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Low confidence alert ───────────────────────── */}
      {lowConf && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/5 border border-amber-500/15 text-sm">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-400">Low Confidence Decision</p>
            <p className="text-muted mt-0.5">
              Uncertainty is high ({(uncertainty * 100).toFixed(0)}%).
              {dissent ? ' Agents have conflicting assessments.' : ' Review flagged issues carefully.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Dissent viz ────────────────────────────────── */}
      {dissent && passingAgents.length > 0 && failingAgents.length > 0 && (
        <div className="rounded-lg bg-red-500/5 border border-red-500/15 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={16} className="text-red-400" />
            <h3 className="text-sm font-semibold text-red-400">Agent Dissent</h3>
          </div>
          {dissentSummary && <p className="text-sm text-muted mb-3">{dissentSummary}</p>}

          {/* Visual conflict: PASS vs FAIL badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {passingAgents.map(a => (
              <span key={a} className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {LABELS[a] || a} ✓
              </span>
            ))}
            <span className="text-sm font-bold text-muted mx-1">vs</span>
            {failingAgents.map(a => (
              <span key={a} className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                {LABELS[a] || a} ✕
              </span>
            ))}
          </div>

          {dissentDetails.length > 0 && (
            <div className="mt-2.5 border-t border-red-500/10 pt-2.5 space-y-1">
              {dissentDetails.map((d, i) => <p key={i} className="text-sm text-muted">• {d}</p>)}
            </div>
          )}
        </div>
      )}

      {/* ── Top 3 issues ──────────────────────────────── */}
      {top3.length > 0 && (
        <div className="rounded-lg bg-surface-raised border border-border p-4">
          <h3 className="text-sm font-semibold text-muted-light mb-3">Top Critical Issues</h3>
          <div className="space-y-2">
            {top3.map((issue, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-md bg-surface-overlay text-sm border-l-2
                ${i === 0 ? 'border-l-red-500' : i === 1 ? 'border-l-amber-500' : 'border-l-cyan-500'}`}>
                <span className="text-xs font-bold text-muted w-5 text-center">#{i + 1}</span>
                <div>
                  <p className="text-gray-200">{issue.message}</p>
                  {issue.source_agent && (
                    <span className="inline-block mt-1 text-xs text-indigo-400">{LABELS[issue.source_agent] || issue.source_agent}</span>
                  )}
                  {issue.priority_score && (
                    <span className="inline-block ml-2 mt-1 text-xs text-muted">priority: {issue.priority_score}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recommended fixes ─────────────────────────── */}
      {fixes.length > 0 && (
        <div className="rounded-lg bg-surface-raised border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wrench size={14} className="text-indigo-400" />
            <h3 className="text-sm font-semibold text-muted-light">Recommended Fixes</h3>
          </div>
          <ul className="space-y-1.5">
            {fixes.map((fix, i) => (
              <li key={i} className="text-sm text-muted flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5">→</span> {fix}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
