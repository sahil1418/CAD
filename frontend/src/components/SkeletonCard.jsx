import { motion } from 'framer-motion';

const META = {
  structural:    { icon: '🏗️', label: 'Structural',    color: '#818cf8' },
  manufacturing: { icon: '⚙️', label: 'Manufacturing', color: '#a78bfa' },
  compliance:    { icon: '📋', label: 'Compliance',     color: '#22d3ee' },
  intent:        { icon: '🎯', label: 'Intent',         color: '#34d399' },
  cost:          { icon: '💰', label: 'Cost',           color: '#fbbf24' },
};

export default function SkeletonCard({ agentName, isActive }) {
  const m = META[agentName] || { icon: '🤖', label: agentName, color: '#818cf8' };

  return (
    <div className="glass-card p-4 relative overflow-hidden">
      {isActive && (
        <motion.div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ border: `1.5px solid ${m.color}`, opacity: 0.2 }}
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 1.5, repeat: Infinity }} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: `${m.color}12` }}>
            {m.icon}
          </div>
          <div>
            <span className="text-xs font-semibold" style={{ color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
              {m.label}
            </span>
            <span className="text-[0.55rem] ml-1.5" style={{ color: 'var(--color-text-tertiary)' }}>Agent</span>
          </div>
        </div>
        {isActive ? (
          <motion.div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[0.6rem] font-semibold"
            style={{ background: `${m.color}15`, color: m.color }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.2, repeat: Infinity }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
            Analyzing
          </motion.div>
        ) : (
          <div className="skeleton w-14 h-5 rounded-md" />
        )}
      </div>

      {/* Skeleton bars */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="conf-track flex-1">
            {isActive ? (
              <motion.div className="conf-fill conf-fill-default"
                animate={{ width: ['0%', '55%', '25%', '45%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }} />
            ) : <div className="conf-fill" style={{ width: 0 }} />}
          </div>
          <div className="skeleton w-7 h-3 rounded" />
        </div>
        <div className="skeleton w-full h-12" />
        <div className="skeleton w-2/3 h-3" />
      </div>
    </div>
  );
}
