import React, { useState, useEffect, useRef } from 'react';
import { StoredImage, ProcessOptions, OutputFormat, Preset } from '../types';
import { processImage, formatBytes } from '../services/processor';
import { SUPPORTED_FORMATS, PRESETS } from '../constants';

interface EditorProps {
  image: StoredImage;
  onClose: () => void;
}

export const Editor: React.FC<EditorProps> = ({ image, onClose }) => {
  // Processing State
  const [options, setOptions] = useState<ProcessOptions>({
    width: image.width,
    height: image.height,
    quality: 0.9,
    format: image.type as OutputFormat,
    fit: 'cover',
    mask: 'none',
    rotation: 0
  });

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outName, setOutName] = useState(image.name.substring(0, image.name.lastIndexOf('.')) || image.name);

  // Viewport State for Pan/Zoom
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce processing
  useEffect(() => {
    const timer = setTimeout(async () => {
      setIsProcessing(true);
      try {
        const res = await processImage(image.blob, options);
        setPreviewUrl(res.url);
        setPreviewBlob(res.blob);
      } catch (err) {
        console.error(err);
      } finally {
        setIsProcessing(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [image, options]);

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleDownload = () => {
    if (!previewBlob) return;
    const link = document.createElement('a');
    link.href = previewUrl;
    
    // Determine extension
    let ext = 'jpg';
    if (options.format === 'image/png') ext = 'png';
    if (options.format === 'image/webp') ext = 'webp';
    if (options.format === 'image/avif') ext = 'avif';
    
    link.download = `${outName}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const applyPreset = (preset: Preset) => {
    setOptions(prev => ({ ...prev, ...preset.options }));
    // Reset view on preset change to see the whole image
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  const handleSmartRename = () => {
    const base = image.name.substring(0, image.name.lastIndexOf('.')) || image.name;
    const w = options.width || 'auto';
    const h = options.height || 'auto';
    const q = Math.round(options.quality * 100);
    setOutName(`${base}-${w}x${h}-q${q}`);
  };

  // --- Pan & Zoom Handlers ---

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const scaleAmount = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.1, transform.scale + scaleAmount), 5);
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => setTransform({ x: 0, y: 0, scale: 1 });

  return (
    <div className="flex h-full bg-slate-900">
      {/* Sidebar Controls */}
      <div className="w-80 bg-slate-950 border-r border-slate-800 overflow-y-auto flex flex-col z-10 shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2">
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h2 className="font-semibold text-slate-200">Editor</h2>
        </div>

        <div className="p-4 space-y-6">
          
          {/* Output Name */}
          <div className="space-y-2">
             <label className="text-xs font-semibold text-slate-500 uppercase flex justify-between">
               Filename
               <button 
                onClick={handleSmartRename}
                className="text-indigo-400 hover:text-indigo-300 text-[10px] uppercase font-bold tracking-wider"
                title="Auto-rename: name-widthxheight-quality"
               >
                 Smart Rename
               </button>
             </label>
             <div className="flex gap-2">
               <input 
                type="text" 
                value={outName}
                onChange={(e) => setOutName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
               />
             </div>
          </div>

          {/* Dimensions */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase">Dimensions</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-slate-500 mb-1 block">Width</span>
                <input 
                  type="number" 
                  value={options.width || ''}
                  onChange={(e) => setOptions({...options, width: Number(e.target.value) || undefined})}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  placeholder="Auto"
                />
              </div>
              <div>
                <span className="text-xs text-slate-500 mb-1 block">Height</span>
                <input 
                  type="number" 
                  value={options.height || ''}
                  onChange={(e) => setOptions({...options, height: Number(e.target.value) || undefined})}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  placeholder="Auto"
                />
              </div>
            </div>
            <div className="flex gap-2 text-xs">
              {['cover', 'contain', 'fill'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setOptions({...options, fit: mode as any})}
                  className={`flex-1 py-1 rounded border transition-colors ${options.fit === mode ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Format & Quality */}
          <div className="space-y-2">
             <label className="text-xs font-semibold text-slate-500 uppercase">Format</label>
             <select 
              value={options.format}
              onChange={(e) => setOptions({...options, format: e.target.value as OutputFormat})}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
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
              onChange={(e) => setOptions({...options, quality: parseFloat(e.target.value)})}
              className="w-full accent-indigo-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Mask */}
          <div className="space-y-2">
             <label className="text-xs font-semibold text-slate-500 uppercase">Shape Mask</label>
             <div className="flex gap-2">
               {['none', 'circle', 'square'].map(m => (
                 <button 
                  key={m}
                  onClick={() => setOptions({...options, mask: m as any})}
                  className={`px-3 py-1 text-xs rounded border capitalize transition-colors ${options.mask === m ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                 >
                   {m}
                 </button>
               ))}
             </div>
          </div>
          
          <hr className="border-slate-800" />
          
           {/* Presets */}
           <div className="space-y-2">
             <label className="text-xs font-semibold text-slate-500 uppercase">Dev Presets</label>
             <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors text-slate-300 whitespace-nowrap"
                    title={preset.category}
                  >
                    {preset.label}
                  </button>
                ))}
             </div>
          </div>

        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 flex flex-col bg-slate-900 relative overflow-hidden">
        
        {/* View Controls Overlay */}
        <div className="absolute top-4 right-4 z-20 flex gap-2 bg-slate-950/80 backdrop-blur rounded-lg p-1 border border-slate-700 shadow-lg">
           <button onClick={() => setTransform(t => ({...t, scale: t.scale + 0.1}))} className="p-2 hover:bg-white/10 rounded text-white" title="Zoom In">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
           </button>
           <button onClick={() => setTransform(t => ({...t, scale: Math.max(0.1, t.scale - 0.1)}))} className="p-2 hover:bg-white/10 rounded text-white" title="Zoom Out">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
           </button>
           <button onClick={resetView} className="p-2 hover:bg-white/10 rounded text-white" title="Reset View">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
           </button>
        </div>

        <div 
          ref={containerRef}
          className={`flex-1 flex items-center justify-center p-0 overflow-hidden relative cursor-${isDragging ? 'grabbing' : 'grab'}`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          
          {/* Checkerboard background for transparency - Static */}
          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none"
             style={{
               backgroundImage: `linear-gradient(45deg, #334155 25%, transparent 25%), linear-gradient(-45deg, #334155 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #334155 75%), linear-gradient(-45deg, transparent 75%, #334155 75%)`,
               backgroundSize: '20px 20px',
               backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
             }}
          />

          {previewUrl && (
            <div 
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
              className="relative z-10 origin-center will-change-transform"
            >
              <img 
                src={previewUrl} 
                alt="Preview" 
                draggable={false}
                className="max-w-none shadow-2xl border border-slate-800 select-none"
                style={{
                  borderRadius: options.mask === 'circle' ? '50%' : '0'
                }}
              />
            </div>
          )}
          
          {isProcessing && (
            <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                <span className="text-white font-medium text-sm shadow-black drop-shadow-md">Processing...</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Bar Info & Action */}
        <div className="h-16 bg-slate-950 border-t border-slate-800 flex items-center justify-between px-6 z-20 shrink-0">
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-slate-500 block text-xs">Original</span>
              <span className="text-slate-300">{formatBytes(image.blob.size)} &bull; {image.width}x{image.height}</span>
            </div>
            <div className="h-8 w-px bg-slate-800"></div>
            <div>
              <span className="text-slate-500 block text-xs">Output</span>
              <span className="text-indigo-400 font-medium">
                {previewBlob ? formatBytes(previewBlob.size) : '...'} &bull; {options.width || 'Auto'}x{options.height || 'Auto'}
              </span>
            </div>
             <div className="h-8 w-px bg-slate-800"></div>
             <div>
              <span className="text-slate-500 block text-xs">Zoom</span>
              <span className="text-slate-300">{Math.round(transform.scale * 100)}%</span>
            </div>
          </div>

          <button 
            onClick={handleDownload}
            disabled={!previewBlob}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </button>
        </div>
      </div>
    </div>
  );
};