import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ICONS = { structural: '🏗️', manufacturing: '⚙️', compliance: '📋', intent: '🎯', cost: '💰' };
const LABELS = { structural: 'Structural', manufacturing: 'Manufacturing', compliance: 'Compliance', intent: 'Intent', cost: 'Cost' };
const COLORS = {
  structural: 'rgba(99,102,241,0.15)',
  manufacturing: 'rgba(139,92,246,0.15)',
  compliance: 'rgba(34,211,238,0.15)',
  intent: 'rgba(52,211,153,0.15)',
  cost: 'rgba(251,191,36,0.15)',
};

function getBadgeClass(verdict) {
  const v = (verdict || '').toUpperCase();
  if (v === 'PASS') return 'badge-pass';
  if (v === 'FAIL') return 'badge-fail';
  return 'badge-warn';
}

export default function AgentCard({ agent }) {
  const [expanded, setExpanded] = useState(false);
  const name = agent.agent || 'unknown';
  const verdict = (agent.verdict || 'WARN').toUpperCase();
  const confidence = agent.confidence || 0;
  const issues = agent.issues || [];
  const reasoning = agent.reasoning || '';
  const costBreakdown = agent.cost_breakdown || null;

  return (
    <div className="glass-card p-5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-base" style={{ background: COLORS[name] || 'rgba(255,255,255,0.06)' }}>
            {ICONS[name] || '🤖'}
          </div>
          <span className="text-sm font-semibold">{LABELS[name] || name} Agent</span>
        </div>
        <span className={`${getBadgeClass(verdict)} px-3 py-1 rounded-full text-[0.7rem] font-bold uppercase tracking-wider`}>
          {verdict}
        </span>
      </div>

      {/* Confidence Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
          <span>Confidence</span>
          <span className="font-semibold">{(confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="conf-track">
          <motion.div
            className="conf-fill"
            initial={{ width: 0 }}
            animate={{ width: `${confidence * 100}%` }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      {/* Reasoning */}
      {reasoning && (
        <div className="text-xs leading-relaxed p-3 rounded-lg mb-3"
          style={{ background: 'var(--color-surface-glass)', borderLeft: '3px solid var(--color-accent-indigo)', color: 'var(--color-text-secondary)' }}>
          {reasoning}
        </div>
      )}

      {/* Cost Breakdown */}
      {costBreakdown && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: 'Total', value: `$${costBreakdown.total}` },
            { label: 'Material', value: `$${costBreakdown.material}` },
            { label: 'Machining', value: `$${costBreakdown.machining}` },
            { label: 'Difficulty', value: `${costBreakdown.difficulty_score}/10` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center py-2 rounded-lg" style={{ background: 'var(--color-surface-glass)' }}>
              <div className="text-xs font-bold" style={{ color: 'var(--color-accent-amber)' }}>{value}</div>
              <div className="text-[0.6rem] uppercase" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Issues count + expand hint */}
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {issues.length > 0 ? (
          <span>{issues.length} issue{issues.length > 1 ? 's' : ''} found</span>
        ) : (
          <span className="flex items-center gap-1.5" style={{ color: 'var(--color-accent-emerald)' }}>✅ No issues</span>
        )}
        {issues.length > 0 && (
          <span className="transition-transform duration-200" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
        )}
      </div>

      {/* Expandable Issues */}
      <AnimatePresence>
        {expanded && issues.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              {issues.map((issue, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`issue-${(issue.severity || 'low').toLowerCase()} rounded-lg p-3 text-xs`}
                  style={{ background: 'var(--color-surface-glass)' }}
                >
                  <div className="flex gap-2 items-start">
                    <span className={`${getBadgeClass(issue.severity === 'HIGH' ? 'FAIL' : issue.severity === 'MEDIUM' ? 'WARN' : 'PASS')} px-1.5 py-0.5 rounded text-[0.6rem] font-bold uppercase shrink-0`}>
                      {issue.severity}
                    </span>
                    <div className="min-w-0">
                      <p style={{ color: 'var(--color-text-primary)' }}>{issue.message}</p>
                      {/* Explainability: Why this was flagged */}
                      {issue.contributing_feature && (
                        <p className="mt-1" style={{ color: 'var(--color-accent-cyan)' }}>
                          🔍 Feature: {issue.contributing_feature}
                        </p>
                      )}
                      {issue.reason && issue.reason !== issue.message && (
                        <p className="mt-1 italic" style={{ color: 'var(--color-text-muted)' }}>
                          💡 Why: {issue.reason}
                        </p>
                      )}
                      {issue.suggestion && (
                        <p className="mt-1 italic" style={{ color: 'var(--color-text-muted)' }}>
                          🛠️ Fix: {issue.suggestion}
                        </p>
                      )}
                      {/* Location / zone mapping */}
                      {issue.location && issue.location !== 'global' && (
                        <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[0.6rem]"
                          style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--color-accent-indigo)' }}>
                          📍 {issue.location}
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
