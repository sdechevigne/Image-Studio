import React, { useState } from 'react';
import { StoredImage, ProcessOptions, OutputFormat } from '../types';
import { processImage } from '../services/processor';
import { SUPPORTED_FORMATS } from '../constants';

interface BatchEditorProps {
  images: StoredImage[];
  onClose: () => void;
  dirHandle: FileSystemDirectoryHandle | null;
}

export const BatchEditor: React.FC<BatchEditorProps> = ({ images, onClose, dirHandle }) => {
  const [options, setOptions] = useState<ProcessOptions>({
    width: undefined,
    height: undefined,
    quality: 0.9,
    format: 'image/jpeg',
    fit: 'cover',
    mask: 'none',
    rotation: 0,
    crop: undefined
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: images.length });

  const handleProcessAll = async () => {
    if (!confirm(`Process and save ${images.length} images?`)) return;

    setIsProcessing(true);
    setProgress({ current: 0, total: images.length });

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      try {
        const { blob } = await processImage(img.blob, options);
        
        let ext = 'jpg';
        if (options.format === 'image/png') ext = 'png';
        if (options.format === 'image/webp') ext = 'webp';
        if (options.format === 'image/avif') ext = 'avif';
        
        const baseName = img.name.substring(0, img.name.lastIndexOf('.')) || img.name;
        const filename = `${baseName}-processed.${ext}`;

        if (dirHandle) {
           const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
           const writable = await fileHandle.createWritable();
           await writable.write(blob);
           await writable.close();
        } else {
           const link = document.createElement('a');
           link.href = URL.createObjectURL(blob);
           link.download = filename;
           document.body.appendChild(link);
           link.click();
           document.body.removeChild(link);
           await new Promise(r => setTimeout(r, 200));
        }

      } catch (e) {
        console.error(`Failed to process ${img.name}`, e);
      }
      setProgress(p => ({ ...p, current: i + 1 }));
    }

    setIsProcessing(false);
    onClose();
  };

  const updateOption = (key: keyof ProcessOptions, value: any) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex h-full bg-slate-900">
      {/* Sidebar Controls */}
      <div className="w-80 bg-slate-950 border-r border-slate-800 overflow-y-auto flex flex-col z-10 shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2">
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h2 className="font-semibold text-slate-200">Batch Edit ({images.length})</h2>
        </div>

        <div className="p-4 space-y-6">
          <p className="text-xs text-slate-400">Settings applied to all selected images.</p>

           {/* Dimensions */}
           <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase">Dimensions</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-slate-500 mb-1 block">Width</span>
                <input 
                  type="number" 
                  value={options.width || ''}
                  onChange={(e) => updateOption('width', Number(e.target.value) || undefined)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="Original"
                />
              </div>
              <div>
                <span className="text-xs text-slate-500 mb-1 block">Height</span>
                <input 
                  type="number" 
                  value={options.height || ''}
                  onChange={(e) => updateOption('height', Number(e.target.value) || undefined)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="Original"
                />
              </div>
            </div>
            <div className="flex gap-2 text-xs">
              {['cover', 'contain', 'fill'].map(mode => (
                <button
                  key={mode}
                  onClick={() => updateOption('fit', mode)}
                  className={`flex-1 py-1 rounded border transition-colors ${options.fit === mode ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Format & Quality */}
          <div className="space-y-2">
             <label className="text-xs font-semibold text-slate-500 uppercase">Output Format</label>
             <select 
              value={options.format}
              onChange={(e) => updateOption('format', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
             >
               {Object.entries(SUPPORTED_FORMATS).map(([mime, label]) => (
                 <option key={mime} value={mime}>{label}</option>
               ))}
             </select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-xs font-semibold text-slate-500 uppercase">Quality</label>
              <span className="text-xs text-slate-400">{Math.round(options.quality * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="1" 
              step="0.05"
              value={options.quality}
              onChange={(e) => updateOption('quality', parseFloat(e.target.value))}
              className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

        </div>

        <div className="p-4 mt-auto border-t border-slate-800">
           <button 
             onClick={handleProcessAll}
             disabled={isProcessing}
             className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-lg font-medium shadow-lg shadow-blue-500/20"
           >
             {isProcessing ? `Processing ${progress.current}/${progress.total}` : 'Process All Images'}
           </button>
           {dirHandle ? (
              <p className="text-[10px] text-green-400 mt-2 text-center flex items-center justify-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Saving to selected folder
              </p>
           ) : (
             <p className="text-[10px] text-amber-400 mt-2 text-center">Images will download individually</p>
           )}
        </div>
      </div>

      {/* Grid Preview */}
      <div className="flex-1 bg-slate-900 p-8 overflow-y-auto">
         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 opacity-50 pointer-events-none grayscale">
           {images.map(img => (
             <div key={img.id} className="aspect-square rounded-lg overflow-hidden border border-slate-800 relative">
               <img src={URL.createObjectURL(img.blob)} className="w-full h-full object-cover" />
             </div>
           ))}
         </div>
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <div className="bg-slate-950/80 backdrop-blur p-6 rounded-xl border border-slate-700 text-center max-w-md">
             <h3 className="text-xl font-bold text-white mb-2">Batch Mode</h3>
             <p className="text-slate-400 mb-4">You are about to process {images.length} images.</p>
             <p className="text-sm text-slate-500">Previews are disabled in batch mode for performance. Settings on the left will apply to all selected images.</p>
           </div>
         </div>
      </div>
    </div>
  );
};