import { useRef, useState } from 'react';
import { motion } from 'framer-motion';

const STAT_LABELS = { num_vertices: 'Vertices', num_faces: 'Faces', format: 'Format', complexity_score: 'Complexity' };

export default function FileUpload({ onFileSelect, fileName, geometrySummary }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) onFileSelect(e.dataTransfer.files[0]); };
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
        📁 Upload CAD File
      </h3>
      <div
        className={`upload-zone p-8 text-center ${dragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onClick={() => inputRef.current?.click()}
        id="upload-zone"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".obj,.stp,.step,.stl"
          onChange={(e) => e.target.files[0] && onFileSelect(e.target.files[0])}
          className="hidden"
          id="cad-file-upload"
        />
        {fileName ? (
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex items-center justify-center gap-3">
            <span className="text-3xl">✅</span>
            <div className="text-left">
              <div className="font-semibold text-sm" style={{ color: 'var(--color-accent-emerald)' }}>{fileName}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Click to replace</div>
            </div>
          </motion.div>
        ) : (
          <>
            <div className="text-4xl mb-3">📐</div>
            <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Drop your CAD file here or click to browse</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>.OBJ · .STP · .STEP · .STL</p>
          </>
        )}
      </div>

      {geometrySummary && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-2 mt-4">
          {Object.entries(STAT_LABELS).map(([key, label]) => (
            <div key={key} className="text-center py-2 px-3 rounded-lg" style={{ background: 'var(--color-surface-glass)' }}>
              <div className="text-sm font-bold" style={{ color: 'var(--color-accent-amber)' }}>
                {key === 'complexity_score' ? (geometrySummary[key] || 0).toFixed(2) : geometrySummary[key] || 0}
              </div>
              <div className="text-[0.65rem] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
