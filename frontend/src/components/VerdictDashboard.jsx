import { motion } from 'framer-motion';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

export default function VerdictDashboard({ results }) {
  const verdict = (results.final_verdict || 'FAIL').toUpperCase();
  const score = results.score || 0;
  const confidence = results.confidence || 0;
  const uncertainty = results.uncertainty || 0;
  const lowConf = results.low_confidence_flag;
  const dissent = results.dissent_detected;
  const dissentDetails = results.dissent_details || [];
  const dissentSummary = results.dissent_summary || '';
  const top3 = results.top_3_issues || [];

  const v = {
    PASS:             { cls: 'bg-emerald-500/10 border-emerald-500/20', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Design Approved', icon: '✓' },
    CONDITIONAL_PASS: { cls: 'bg-amber-500/10 border-amber-500/20',   badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',       label: 'Conditional Pass', icon: '⚠' },
    FAIL:             { cls: 'bg-red-500/10 border-red-500/20',         badge: 'bg-red-500/10 text-red-400 border-red-500/20',             label: 'Design Rejected', icon: '✕' },
  }[verdict] || v?.FAIL || { cls: 'bg-red-500/10 border-red-500/20', badge: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Design Rejected', icon: '✕' };

  return (
    <div className="space-y-4">

      {/* Main verdict */}
      <div className={`rounded-lg border p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${v.cls}`}>
        <div className="flex items-center gap-4">
          {/* Score */}
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 rounded-full bg-surface border border-border flex flex-col items-center justify-center shrink-0">
            <span className="text-xl font-black text-white">{score}</span>
            <span className="text-xs text-muted">/ 100</span>
          </motion.div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-white">{v.label}</h2>
              <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase border ${v.badge}`}>
                {verdict.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-muted">
              Confidence: {(confidence * 100).toFixed(0)}% · Uncertainty: {(uncertainty * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      </div>

      {/* Low confidence */}
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

      {/* Dissent */}
      {dissent && dissentDetails.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/5 border border-red-500/15 text-sm">
          <ShieldAlert size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-400">Agent Dissent Detected</p>
            {dissentSummary && <p className="text-muted mt-0.5">{dissentSummary}</p>}
            {dissentDetails.map((d, i) => <p key={i} className="text-muted mt-0.5">• {d}</p>)}
          </div>
        </div>
      )}

      {/* Top 3 issues */}
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
                    <span className="inline-block mt-1 text-xs text-indigo-400">{issue.source_agent}</span>
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
