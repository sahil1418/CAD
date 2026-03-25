import { Pencil } from 'lucide-react';

const KEYWORDS = ['lightweight', 'compact', 'strong', 'aerospace', 'CNC', 'smooth', 'precise', 'low-cost', 'heat-resistant'];
const MAX_CHARS = 300;

export default function DesignBrief({ value, onChange }) {
  const pct = Math.min((value.length / MAX_CHARS) * 100, 100);

  const toggleChip = (word) => {
    if (value.toLowerCase().includes(word.toLowerCase())) {
      onChange(value.replace(new RegExp(`\\b${word}\\b[,;\\s]*`, 'gi'), '').trim());
    } else {
      onChange(value ? `${value}, ${word}` : word);
    }
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(34,211,238,0.1)' }}>
          <Pencil size={12} style={{ color: '#22d3ee' }} />
        </div>
        <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--color-text-secondary)' }}>Design Brief</span>
      </div>

      {/* Keyword chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {KEYWORDS.map(w => (
          <button
            key={w}
            className={`chip ${value.toLowerCase().includes(w.toLowerCase()) ? 'active' : ''}`}
            onClick={() => toggleChip(w)}
            type="button"
          >
            {w}
          </button>
        ))}
      </div>

      <textarea
        className="w-full h-24 rounded-xl p-3.5 text-xs resize-none"
        placeholder="e.g. A lightweight, compact bracket for aerospace. Must be strong and CNC-machinable. Target cost under $200."
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
        id="design-brief-input"
      />

      {/* Character counter + progress */}
      <div className="flex items-center gap-3 mt-2">
        <div className="char-progress flex-1">
          <div className="char-progress-fill" style={{ width: `${pct}%`, background: pct > 90 ? '#fb7185' : undefined }} />
        </div>
        <span className="text-[0.6rem] tabular-nums" style={{ color: pct > 90 ? '#fb7185' : 'var(--color-text-tertiary)' }}>
          {value.length}/{MAX_CHARS}
        </span>
      </div>
    </div>
  );
}
