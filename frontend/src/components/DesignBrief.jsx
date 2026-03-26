import { Pencil } from 'lucide-react';

const CHIPS = ['lightweight', 'compact', 'strong', 'aerospace', 'CNC', 'smooth', 'precise', 'low-cost', 'heat-resistant'];
const MAX = 300;

export default function DesignBrief({ value, onChange }) {
  const toggle = (word) => {
    if (value.toLowerCase().includes(word.toLowerCase())) {
      onChange(value.replace(new RegExp(`\\b${word}\\b[,;\\s]*`, 'gi'), '').trim());
    } else {
      onChange(value ? `${value}, ${word}` : word);
    }
  };

  return (
    <div>
      <label className="text-sm font-semibold text-muted-light flex items-center gap-2 mb-3">
        <Pencil size={14} /> Design Brief
      </label>

      {/* Keyword chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {CHIPS.map(w => (
          <button key={w} type="button" onClick={() => toggle(w)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer transition-colors
              ${value.toLowerCase().includes(w)
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                : 'bg-transparent border-border text-muted hover:border-border-hover hover:text-muted-light'}`}>
            {w}
          </button>
        ))}
      </div>

      <textarea
        className="w-full h-28 rounded-lg p-3 text-sm bg-surface-raised border border-border text-gray-200
          placeholder:text-muted focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 resize-none"
        placeholder="e.g. A lightweight, compact bracket for aerospace. Must be strong and CNC-machinable. Target cost under $200."
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX))}
      />

      {/* Character counter */}
      <div className="flex items-center gap-3 mt-2">
        <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.min((value.length / MAX) * 100, 100)}%` }} />
        </div>
        <span className="text-xs text-muted tabular-nums">{value.length}/{MAX}</span>
      </div>
    </div>
  );
}
