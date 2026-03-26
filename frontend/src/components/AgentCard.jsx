import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MapPin } from 'lucide-react';

const META = {
  structural:    { icon: '🏗️', label: 'Structural' },
  manufacturing: { icon: '⚙️', label: 'Manufacturing' },
  compliance:    { icon: '📋', label: 'Compliance' },
  intent:        { icon: '🎯', label: 'Intent' },
  cost:          { icon: '💰', label: 'Cost' },
};

function Badge({ verdict }) {
  const v = (verdict || '').toUpperCase();
  const cls = v === 'PASS' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : v === 'FAIL' ? 'bg-red-500/10 text-red-400 border-red-500/20'
    : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase border ${cls}`}>{v}</span>;
}

export default function AgentCard({ agent }) {
  const [open, setOpen] = useState(false);
  const name = agent.agent || 'unknown';
  const m = META[name] || { icon: '🤖', label: name };
  const confidence = agent.confidence || 0;
  const issues = agent.issues || [];
  const cost = agent.cost_breakdown;

  const barColor = confidence >= 0.8 ? 'bg-emerald-500' : confidence >= 0.5 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="rounded-lg bg-surface-raised border border-border p-4 transition-colors hover:border-border-hover">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{m.icon}</span>
          <span className="text-sm font-semibold text-white">{m.label}</span>
        </div>
        <Badge verdict={agent.verdict} />
      </div>

      {/* Confidence bar */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
          <motion.div className={`h-full rounded-full ${barColor}`}
            initial={{ width: 0 }} animate={{ width: `${confidence * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }} />
        </div>
        <span className="text-xs font-semibold text-muted-light w-10 text-right">{(confidence * 100).toFixed(0)}%</span>
      </div>

      {/* Reasoning */}
      {agent.reasoning && (
        <p className="text-sm text-muted leading-relaxed mb-3 line-clamp-2">{agent.reasoning}</p>
      )}

      {/* Cost breakdown */}
      {cost && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { l: 'Total', v: `$${cost.total}` },
            { l: 'Material', v: `$${cost.material}` },
            { l: 'Machining', v: `$${cost.machining}` },
            { l: 'Difficulty', v: `${cost.difficulty_score}/10` },
          ].map(x => (
            <div key={x.l} className="text-center py-1.5 rounded-md bg-surface-overlay border border-border">
              <p className="text-xs font-semibold text-amber-400">{x.v}</p>
              <p className="text-xs text-muted">{x.l}</p>
            </div>
          ))}
        </div>
      )}

      {/* Expand toggle */}
      {issues.length > 0 && (
        <button onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between text-sm text-muted hover:text-muted-light transition-colors cursor-pointer">
          <span>{issues.length} issue{issues.length !== 1 && 's'}</span>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={16} />
          </motion.div>
        </button>
      )}
      {issues.length === 0 && <p className="text-sm text-emerald-400">✓ No issues</p>}

      {/* Issues list */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              {issues.map((issue, i) => (
                <div key={i} className={`p-3 rounded-md bg-surface-overlay text-sm border-l-2
                  ${issue.severity === 'HIGH' ? 'border-l-red-500' : issue.severity === 'MEDIUM' ? 'border-l-amber-500' : 'border-l-cyan-500'}`}>
                  <div className="flex items-start gap-2">
                    <Badge verdict={issue.severity === 'HIGH' ? 'FAIL' : issue.severity === 'MEDIUM' ? 'WARN' : 'PASS'} />
                    <div>
                      <p className="text-gray-200">{issue.message}</p>
                      {issue.contributing_feature && (
                        <p className="mt-1 text-sm text-cyan-400">🔍 {issue.contributing_feature}</p>
                      )}
                      {issue.reason && issue.reason !== issue.message && (
                        <p className="mt-1 text-sm text-muted">💡 {issue.reason}</p>
                      )}
                      {issue.suggestion && (
                        <p className="mt-1 text-sm text-muted italic">🛠 {issue.suggestion}</p>
                      )}
                      {issue.location && issue.location !== 'global' && (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-xs text-indigo-400">
                          <MapPin size={10} /> {issue.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
