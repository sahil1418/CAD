const META = {
  structural:    { icon: '🏗️', label: 'Structural' },
  manufacturing: { icon: '⚙️', label: 'Manufacturing' },
  compliance:    { icon: '📋', label: 'Compliance' },
  intent:        { icon: '🎯', label: 'Intent' },
  cost:          { icon: '💰', label: 'Cost' },
};

export default function SkeletonCard({ name, isActive }) {
  const m = META[name] || { icon: '🤖', label: name };

  return (
    <div className="rounded-lg bg-surface-raised border border-border p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{m.icon}</span>
          <span className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-muted'}`}>{m.label}</span>
        </div>
        {isActive ? (
          <span className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium text-indigo-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Analyzing
          </span>
        ) : (
          <div className="w-16 h-6 rounded-md bg-surface-overlay animate-pulse" />
        )}
      </div>

      {/* Skeleton bars */}
      <div className="space-y-2.5">
        <div className="h-1.5 rounded-full bg-surface-overlay animate-pulse" />
        <div className="h-12 rounded-md bg-surface-overlay animate-pulse" />
        <div className="h-4 w-2/3 rounded-md bg-surface-overlay animate-pulse" />
      </div>
    </div>
  );
}
