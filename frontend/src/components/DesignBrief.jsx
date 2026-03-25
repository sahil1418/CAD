export default function DesignBrief({ value, onChange }) {
  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
        📝 Design Brief
      </h3>
      <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
        Describe intent with keywords: <em className="not-italic" style={{ color: 'var(--color-accent-cyan)' }}>lightweight · compact · strong · smooth · precise</em>
      </p>
      <textarea
        className="w-full h-28 rounded-xl p-3.5 text-sm resize-none border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        style={{
          background: 'var(--color-surface-glass)',
          border: '1px solid var(--color-border-subtle)',
          color: 'var(--color-text-primary)',
          fontFamily: 'Inter, sans-serif',
        }}
        placeholder="e.g. A lightweight, compact bracket for aerospace. Must be strong and CNC-machinable. Target cost under $200."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        id="design-brief-input"
      />
      <div className="text-right mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {value.length} chars
      </div>
    </div>
  );
}
