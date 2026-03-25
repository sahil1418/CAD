import { useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function FileUpload({ onFileSelect, fileName, geometrySummary }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) onFileSelect(e.dataTransfer.files[0]); };

  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(99,102,241,0.12)' }}>📁</span>
        Upload CAD File
      </h3>
      <div
        className={`upload-zone p-10 text-center ${dragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => inputRef.current?.click()}
        id="upload-zone"
      >
        <input ref={inputRef} type="file" accept=".obj,.stp,.step,.stl" onChange={(e) => e.target.files[0] && onFileSelect(e.target.files[0])} className="hidden" id="cad-file-upload" />
        {fileName ? (
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>✅</div>
            <div className="text-left">
              <div className="font-semibold text-sm" style={{ color: 'var(--color-accent-emerald)' }}>{fileName}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Click to replace</div>
            </div>
          </motion.div>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(34,211,238,0.08))', border: '1px solid rgba(99,102,241,0.1)' }}>
              📐
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Drop your CAD file here</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>or click to browse · .OBJ · .STP · .STEP · .STL</p>
          </>
        )}
      </div>

      {geometrySummary && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-2 mt-4">
          {[
            { key: 'num_vertices', label: 'Vertices', icon: '◇' },
            { key: 'num_faces', label: 'Faces', icon: '△' },
            { key: 'format', label: 'Format', icon: '◎' },
            { key: 'complexity_score', label: 'Complexity', icon: '◈' },
          ].map(({ key, label, icon }) => (
            <div key={key} className="stat-bubble text-center py-3 px-3">
              <div className="text-sm font-bold" style={{ color: 'var(--color-accent-amber)' }}>
                {icon} {key === 'complexity_score' ? (geometrySummary[key] || 0).toFixed(2) : geometrySummary[key] || 0}
              </div>
              <div className="text-[0.6rem] uppercase tracking-widest mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
