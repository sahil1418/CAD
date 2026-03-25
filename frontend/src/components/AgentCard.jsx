import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, AlertTriangle, Lightbulb, MapPin, Search } from 'lucide-react';

const META = {
  structural:    { icon: '🏗️', label: 'Structural',     color: '#818cf8' },
  manufacturing: { icon: '⚙️', label: 'Manufacturing',  color: '#a78bfa' },
  compliance:    { icon: '📋', label: 'Compliance',      color: '#22d3ee' },
  intent:        { icon: '🎯', label: 'Intent',          color: '#34d399' },
  cost:          { icon: '💰', label: 'Cost',            color: '#fbbf24' },
};

function verdictClass(v) {
  const u = (v || '').toUpperCase();
  return u === 'PASS' ? 'verdict-pass' : u === 'FAIL' ? 'verdict-fail' : 'verdict-warn';
}

function confColor(c) {
  if (c >= 0.8) return 'conf-fill-green';
  if (c >= 0.5) return 'conf-fill-amber';
  if (c > 0) return 'conf-fill-rose';
  return 'conf-fill-default';
}

export default function AgentCard({ agent }) {
  const [open, setOpen] = useState(false);
  const name = agent.agent || 'unknown';
  const m = META[name] || { icon: '🤖', label: name, color: '#818cf8' };
  const verdict = (agent.verdict || 'WARN').toUpperCase();
  const confidence = agent.confidence || 0;
  const issues = agent.issues || [];
  const reasoning = agent.reasoning || '';
  const cost = agent.cost_breakdown || null;

  return (
    <div className="glass-card p-4 cursor-pointer select-none" onClick={() => issues.length > 0 && setOpen(!open)}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: `${m.color}12` }}>
            {m.icon}
          </div>
          <div>
            <span className="text-xs font-semibold">{m.label}</span>
            <span className="text-[0.55rem] ml-1.5" style={{ color: 'var(--color-text-tertiary)' }}>Agent</span>
          </div>
        </div>
        <span className={`${verdictClass(verdict)} px-2.5 py-1 rounded-md text-[0.6rem] font-bold uppercase tracking-wider`}>
          {verdict}
        </span>
      </div>

      {/* Confidence */}
      <div className="flex items-center gap-3 mb-2.5">
        <div className="conf-track flex-1">
          <motion.div className={`conf-fill ${confColor(confidence)}`} initial={{ width: 0 }} animate={{ width: `${confidence * 100}%` }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
        </div>
        <span className="text-[0.65rem] font-semibold tabular-nums w-9 text-right" style={{ color: m.color }}>{(confidence * 100).toFixed(0)}%</span>
      </div>

      {/* Reasoning snippet */}
      {reasoning && (
        <p className="text-[0.65rem] leading-relaxed p-2.5 rounded-lg mb-2.5 line-clamp-2"
          style={{ background: 'var(--color-bg-glass)', color: 'var(--color-text-secondary)', borderLeft: `2px solid ${m.color}25` }}>
          {reasoning}
        </p>
      )}

      {/* Cost breakdown */}
      {cost && (
        <div className="grid grid-cols-4 gap-1.5 mb-2.5">
          {[
            { l: 'Total', v: `$${cost.total}` },
            { l: 'Material', v: `$${cost.material}` },
            { l: 'Machine', v: `$${cost.machining}` },
            { l: 'Difficulty', v: `${cost.difficulty_score}/10` },
          ].map(x => (
            <div key={x.l} className="text-center py-1.5 rounded-md" style={{ background: 'var(--color-bg-glass)' }}>
              <div className="text-[0.6rem] font-bold" style={{ color: '#fbbf24' }}>{x.v}</div>
              <div className="text-[0.45rem] uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>{x.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Expand bar */}
      <div className="flex items-center justify-between text-[0.65rem]" style={{ color: 'var(--color-text-tertiary)' }}>
        {issues.length > 0 ? (
          <span className="flex items-center gap-1">
            <AlertTriangle size={10} /> {issues.length} issue{issues.length > 1 ? 's' : ''}
          </span>
        ) : (
          <span style={{ color: '#34d399' }}>✓ No issues</span>
        )}
        {issues.length > 0 && (
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} />
          </motion.div>
        )}
      </div>

      {/* Expandable issues */}
      <AnimatePresence>
        {open && issues.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="mt-2.5 space-y-1.5 pt-2.5" style={{ borderTop: '1px solid var(--color-border-default)' }}>
              {issues.map((issue, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className={`issue-${(issue.severity || 'low').toLowerCase()} rounded-lg p-2.5 text-[0.65rem]`} style={{ background: 'var(--color-bg-glass)' }}>
                  <div className="flex items-start gap-1.5">
                    <span className={`${verdictClass(issue.severity === 'HIGH' ? 'FAIL' : issue.severity === 'MEDIUM' ? 'WARN' : 'PASS')} px-1.5 py-0.5 rounded text-[0.5rem] font-bold uppercase shrink-0`}>
                      {issue.severity}
                    </span>
                    <div className="min-w-0">
                      <p>{issue.message}</p>
                      {issue.contributing_feature && (
                        <p className="mt-1 flex items-center gap-1" style={{ color: '#22d3ee' }}>
                          <Search size={9} /> {issue.contributing_feature}
                        </p>
                      )}
                      {issue.reason && issue.reason !== issue.message && (
                        <p className="mt-1 flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                          <Lightbulb size={9} /> {issue.reason}
                        </p>
                      )}
                      {issue.suggestion && (
                        <p className="mt-1 italic" style={{ color: 'var(--color-text-tertiary)' }}>🛠 {issue.suggestion}</p>
                      )}
                      {issue.location && issue.location !== 'global' && (
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[0.5rem]"
                          style={{ background: 'rgba(99,102,241,0.06)', color: '#818cf8' }}>
                          <MapPin size={8} /> {issue.location}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
