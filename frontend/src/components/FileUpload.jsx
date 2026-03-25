import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileCheck, File } from 'lucide-react';

export default function FileUpload({ onFileSelect, fileName, geometrySummary }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) onFileSelect(e.dataTransfer.files[0]); };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-3.5">
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
          <Upload size={12} style={{ color: '#818cf8' }} />
        </div>
        <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--color-text-secondary)' }}>Upload CAD File</span>
      </div>

      <div
        className={`upload-zone p-8 text-center ${dragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => inputRef.current?.click()}
        id="upload-zone"
      >
        <input ref={inputRef} type="file" accept=".obj,.stp,.step,.stl" onChange={(e) => e.target.files[0] && onFileSelect(e.target.files[0])} className="hidden" id="cad-file-upload" />

        {fileName ? (
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex items-center justify-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)' }}>
              <FileCheck size={20} style={{ color: '#34d399' }} />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold" style={{ color: '#34d399' }}>{fileName}</div>
              <div className="text-[0.65rem] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Click to replace</div>
            </div>
          </motion.div>
        ) : (
          <>
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.08)' }}>
              <File size={22} style={{ color: 'var(--color-text-tertiary)' }} />
            </div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Drop a file or click to browse</p>
            <p className="text-[0.6rem]" style={{ color: 'var(--color-text-tertiary)' }}>.OBJ · .STP · .STEP · .STL</p>
          </>
        )}
      </div>

      {/* Geometry stats */}
      {geometrySummary && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-1.5 mt-3">
          {[
            { k: 'num_vertices', l: 'Verts' },
            { k: 'num_faces', l: 'Faces' },
            { k: 'format', l: 'Type' },
            { k: 'complexity_score', l: 'Complex.' },
          ].map(({ k, l }) => (
            <div key={k} className="text-center py-2 rounded-lg" style={{ background: 'var(--color-bg-glass)' }}>
              <div className="text-[0.65rem] font-bold" style={{ color: '#fbbf24' }}>
                {k === 'complexity_score' ? (geometrySummary[k] || 0).toFixed(1) : geometrySummary[k] || 0}
              </div>
              <div className="text-[0.5rem] uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{l}</div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
