export default function DesignBrief({ value, onChange }) {
  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(34,211,238,0.12)' }}>📝</span>
        Design Brief
      </h3>
      <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        Describe design intent:
        <span className="ml-1" style={{ color: 'var(--color-accent-cyan)' }}>lightweight · compact · strong · smooth · precise</span>
      </p>
      <textarea
        className="w-full h-28 rounded-xl p-4 text-sm resize-none"
        placeholder="e.g. A lightweight, compact bracket for aerospace. Must be strong and CNC-machinable. Target cost under $200."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        id="design-brief-input"
        style={{ fontFamily: 'Inter, sans-serif' }}
      />
      <div className="text-right mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {value.length} characters
      </div>
    </div>
  );
}
