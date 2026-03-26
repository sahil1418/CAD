import { useRef, useState } from 'react';
import { Upload, FileCheck } from 'lucide-react';

export default function FileUpload({ onFileSelect, fileName, geo }) {
  const ref = useRef(null);
  const [over, setOver] = useState(false);

  return (
    <div>
      <label className="text-sm font-semibold text-muted-light flex items-center gap-2 mb-3">
        <Upload size={14} /> Upload CAD File
      </label>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${over ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-border hover:border-border-hover'}`}
        onClick={() => ref.current?.click()}
        onDrop={(e) => { e.preventDefault(); setOver(false); e.dataTransfer.files[0] && onFileSelect(e.dataTransfer.files[0]); }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
      >
        <input ref={ref} type="file" accept=".obj,.stp,.step,.stl" className="hidden"
          onChange={(e) => e.target.files[0] && onFileSelect(e.target.files[0])} />

        {fileName ? (
          <div className="flex items-center justify-center gap-3">
            <FileCheck size={20} className="text-emerald-400" />
            <div className="text-left">
              <p className="text-sm font-semibold text-emerald-400">{fileName}</p>
              <p className="text-xs text-muted">Click to replace</p>
            </div>
          </div>
        ) : (
          <>
            <Upload size={24} className="mx-auto mb-2 text-muted" />
            <p className="text-sm text-muted-light">Drop a file or click to browse</p>
            <p className="text-xs text-muted mt-1">.OBJ · .STP · .STEP · .STL</p>
          </>
        )}
      </div>

      {/* Geometry summary */}
      {geo && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { l: 'Vertices', v: geo.num_vertices || 0 },
            { l: 'Faces', v: geo.num_faces || 0 },
            { l: 'Format', v: geo.format || '—' },
            { l: 'Complexity', v: typeof geo.complexity_score === 'number' ? geo.complexity_score.toFixed(1) : '—' },
          ].map(s => (
            <div key={s.l} className="text-center py-2 rounded-md bg-surface-raised border border-border">
              <p className="text-xs font-semibold text-amber-400">{s.v}</p>
              <p className="text-xs text-muted">{s.l}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
