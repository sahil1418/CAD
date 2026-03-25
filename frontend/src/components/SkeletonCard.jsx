import { motion } from 'framer-motion';

const ICONS = { structural: '🏗️', manufacturing: '⚙️', compliance: '📋', intent: '🎯', cost: '💰' };
const LABELS = { structural: 'Structural', manufacturing: 'Manufacturing', compliance: 'Compliance', intent: 'Intent', cost: 'Cost' };

export default function SkeletonCard({ agentName, isActive }) {
  return (
    <div className="glass-card p-5 relative overflow-hidden">
      {/* Active pulse indicator */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{ border: '2px solid var(--color-accent-indigo)', opacity: 0.3 }}
          animate={{ opacity: [0.15, 0.4, 0.15] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-base"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            {ICONS[agentName] || '🤖'}
          </div>
          <span className="text-sm font-semibold" style={{ color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
            {LABELS[agentName] || agentName} Agent
          </span>
        </div>
        {isActive ? (
          <motion.div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.7rem] font-medium"
            style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--color-accent-indigo)' }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-accent-indigo)' }} />
            Analyzing...
          </motion.div>
        ) : (
          <div className="skeleton w-16 h-6 rounded-full" />
        )}
      </div>

      {/* Skeleton content */}
      <div className="space-y-2.5">
        <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
          <span>Confidence</span>
          <div className="skeleton w-8 h-3 rounded" />
        </div>
        <div className="conf-track">
          {isActive ? (
            <motion.div
              className="conf-fill"
              animate={{ width: ['0%', '60%', '30%', '50%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : (
            <div className="conf-fill" style={{ width: '0%' }} />
          )}
        </div>
        <div className="skeleton w-full h-16 mt-2" />
        <div className="skeleton w-3/4 h-4" />
      </div>
    </div>
  );
}
