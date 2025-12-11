import React, { useState, useEffect, useRef } from 'react';
import { StoredImage, ProcessOptions, OutputFormat, Preset, CropRect } from '../types';
import { processImage, formatBytes } from '../services/processor';
import { SUPPORTED_FORMATS, PRESETS } from '../constants';

interface EditorProps {
  image: StoredImage;
  onClose: () => void;
  dirHandle: FileSystemDirectoryHandle | null;
}

export const Editor: React.FC<EditorProps> = ({ image, onClose, dirHandle }) => {
  // Initial State Factory
  const getInitialOptions = (): ProcessOptions => ({
    width: image.width,
    height: image.height,
    quality: 0.9,
    format: image.type as OutputFormat,
    fit: 'cover',
    mask: 'none',
    rotation: 0,
    crop: undefined,
    offset: { x: 0, y: 0 }
  });

  // State
  const [options, setOptions] = useState<ProcessOptions>(getInitialOptions());
  
  // History
  const [history, setHistory] = useState<ProcessOptions[]>([getInitialOptions()]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outName, setOutName] = useState(image.name.substring(0, image.name.lastIndexOf('.')) || image.name);
  const [isSaving, setIsSaving] = useState(false);

  // Viewport
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  
  // Tools
  const [dragMode, setDragMode] = useState<'view' | 'image'>('view');
  
  // Crop Tool State
  const [isCropping, setIsCropping] = useState(false);
  const [cropSelection, setCropSelection] = useState<CropRect | null>(null);
  
  const dragStart = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // --- History Management ---

  const pushHistory = (newOptions: ProcessOptions) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newOptions);
    // Limit history size to 20
    if (newHistory.length > 20) newHistory.shift();
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setOptions(newOptions);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setOptions(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setOptions(next);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all changes to original image?')) {
      const initial = getInitialOptions();
      pushHistory(initial);
      setTransform({ x: 0, y: 0, scale: 1 });
      setCropSelection(null);
      setDragMode('view');
    }
  };

  // Debounce processing
  useEffect(() => {
    // Use a very short debounce when dragging the image content to allow near real-time updates
    const isInteractive = isDragging && dragMode === 'image';
    const delay = isInteractive ? 10 : 300;

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
    }, delay);

    return () => clearTimeout(timer);
  }, [image, options, isDragging, dragMode]);

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Key Bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  const handleDownload = async () => {
    if (!previewBlob) return;
    
    // Determine extension
    let ext = 'jpg';
    if (options.format === 'image/png') ext = 'png';
    if (options.format === 'image/webp') ext = 'webp';
    if (options.format === 'image/avif') ext = 'avif';
    const filename = `${outName}.${ext}`;

    setIsSaving(true);
    try {
      if (dirHandle) {
         try {
           const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
           const writable = await fileHandle.createWritable();
           await writable.write(previewBlob);
           await writable.close();
         } catch (e) {
           console.error("File save error, checking permissions", e);
           alert("Could not save to folder. Permissions might be needed or folder moved. Downloading instead.");
           triggerDownload(previewUrl, filename);
         }
      } else {
        triggerDownload(previewUrl, filename);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const triggerDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const applyPreset = (preset: Preset) => {
    const newOptions = { ...options, ...preset.options };
    pushHistory(newOptions);
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  const handleSmartRename = () => {
    const base = image.name.substring(0, image.name.lastIndexOf('.')) || image.name;
    const w = options.width || 'auto';
    const h = options.height || 'auto';
    const q = Math.round(options.quality * 100);
    setOutName(`${base}-${w}x${h}-q${q}`);
  };

  const updateOption = (key: keyof ProcessOptions, value: any) => {
    const newOptions = { ...options, [key]: value };
    setOptions(newOptions);
  };
  
  const commitOptionChange = () => {
    if (JSON.stringify(history[historyIndex]) !== JSON.stringify(options)) {
      pushHistory(options);
    }
  };

  // --- Interaction Handlers ---

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const scaleAmount = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.1, transform.scale + scaleAmount), 5);
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDragging(true);

    if (isCropping) {
      dragStart.current = { x, y }; 
      setCropSelection({ x, y, width: 0, height: 0 }); 
    } else if (dragMode === 'image') {
      dragStart.current = { x: e.clientX, y: e.clientY };
      startOffset.current = options.offset || { x: 0, y: 0 };
    } else {
      dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();

    if (isCropping) {
       if (!containerRef.current) return;
       const rect = containerRef.current.getBoundingClientRect();
       const currentX = e.clientX - rect.left;
       const currentY = e.clientY - rect.top;
       
       const startX = dragStart.current.x;
       const startY = dragStart.current.y;

       setCropSelection({
         x: Math.min(startX, currentX),
         y: Math.min(startY, currentY),
         width: Math.abs(currentX - startX),
         height: Math.abs(currentY - startY)
       });
    } else if (dragMode === 'image') {
      // Calculate delta in viewport pixels
      const dx = (e.clientX - dragStart.current.x);
      const dy = (e.clientY - dragStart.current.y);
      
      // Convert to canvas pixels (divided by zoom scale)
      const canvasDx = dx / transform.scale;
      const canvasDy = dy / transform.scale;

      setOptions(prev => ({
        ...prev,
        offset: {
          x: startOffset.current.x + canvasDx,
          y: startOffset.current.y + canvasDy
        }
      }));

    } else {
      // Panning Viewport
      setTransform(prev => ({
        ...prev,
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      }));
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      if (isCropping && cropSelection && cropSelection.width > 5) {
        // Crop Logic
        const imgX = (cropSelection.x - transform.x) / transform.scale;
        const imgY = (cropSelection.y - transform.y) / transform.scale;
        const imgW = cropSelection.width / transform.scale;
        const imgH = cropSelection.height / transform.scale;

        const finalCrop: CropRect = {
          x: Math.max(0, Math.floor(imgX)),
          y: Math.max(0, Math.floor(imgY)),
          width: Math.min(image.width - imgX, Math.floor(imgW)),
          height: Math.min(image.height - imgY, Math.floor(imgH))
        };

        if (finalCrop.width > 0 && finalCrop.height > 0) {
          const newOptions = { ...options, crop: finalCrop, width: finalCrop.width, height: finalCrop.height };
          pushHistory(newOptions);
          setIsCropping(false);
          setCropSelection(null);
        }
      } else if (dragMode === 'image') {
         // Commit the move to history
         commitOptionChange();
      }
    }
    
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
          
          <div className="ml-auto flex gap-1">
             <button onClick={handleUndo} disabled={historyIndex === 0} className="p-2 text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800 rounded" title="Undo">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
             </button>
             <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="p-2 text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800 rounded" title="Redo">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" transform="scale(-1, 1)"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
             </button>
             <button onClick={handleReset} className="p-2 text-red-400 hover:text-red-300 hover:bg-slate-800 rounded" title="Reset Image">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
             </button>
          </div>
        </div>

        <div className="p-4 space-y-6">
          
          <div className="space-y-2">
             <label className="text-xs font-semibold text-slate-500 uppercase flex justify-between">
               Filename
               <button onClick={handleSmartRename} className="text-blue-400 hover:text-blue-300 text-[10px] uppercase font-bold tracking-wider">Smart Rename</button>
             </label>
             <div className="flex gap-2">
               <input type="text" value={outName} onChange={(e) => setOutName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
             </div>
          </div>
          
          <div>
            <button 
              onClick={() => {
                if(isCropping) { setIsCropping(false); setCropSelection(null); }
                else { setIsCropping(true); setDragMode('view'); }
              }}
              className={`w-full py-2 flex items-center justify-center gap-2 rounded-lg border transition-colors ${
                isCropping 
                ? 'bg-blue-600 border-blue-600 text-white' 
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>
              {isCropping ? 'Cancel Crop' : 'Crop Selection'}
            </button>
            {isCropping && <p className="text-[10px] text-blue-400 mt-1 text-center">Draw rectangle to crop.</p>}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase">Dimensions</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-slate-500 mb-1 block">Width</span>
                <input type="number" value={options.width || ''} onChange={(e) => updateOption('width', Number(e.target.value) || undefined)} onBlur={commitOptionChange} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" placeholder="Auto" />
              </div>
              <div>
                <span className="text-xs text-slate-500 mb-1 block">Height</span>
                <input type="number" value={options.height || ''} onChange={(e) => updateOption('height', Number(e.target.value) || undefined)} onBlur={commitOptionChange} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" placeholder="Auto" />
              </div>
            </div>
            <div className="flex gap-2 text-xs">
              {['cover', 'contain', 'fill'].map(mode => (
                <button key={mode} onClick={() => { updateOption('fit', mode); commitOptionChange(); }} className={`flex-1 py-1 rounded border transition-colors ${options.fit === mode ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>{mode}</button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
             <label className="text-xs font-semibold text-slate-500 uppercase">Format</label>
             <select value={options.format} onChange={(e) => { updateOption('format', e.target.value); commitOptionChange(); }} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500">
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
            <input type="range" min="0.1" max="1" step="0.05" value={options.quality} onChange={(e) => updateOption('quality', parseFloat(e.target.value))} onMouseUp={commitOptionChange} className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
          </div>

          <div className="space-y-2">
             <label className="text-xs font-semibold text-slate-500 uppercase">Shape Mask</label>
             <div className="flex gap-2">
               {['none', 'circle', 'square'].map(m => (
                 <button key={m} onClick={() => { updateOption('mask', m); commitOptionChange(); }} className={`px-3 py-1 text-xs rounded border capitalize transition-colors ${options.mask === m ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>{m}</button>
               ))}
             </div>
          </div>
          
          <hr className="border-slate-800" />
          
           <div className="space-y-2">
             <label className="text-xs font-semibold text-slate-500 uppercase">Dev Presets</label>
             <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {PRESETS.map(preset => (
                  <button key={preset.id} onClick={() => applyPreset(preset)} className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors text-slate-300 whitespace-nowrap" title={preset.category}>{preset.label}</button>
                ))}
             </div>
          </div>

        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 flex flex-col bg-slate-900 relative overflow-hidden">
        
        {/* View Controls Overlay */}
        <div className="absolute top-4 right-4 z-20 flex gap-2 bg-slate-950/80 backdrop-blur rounded-lg p-1 border border-slate-700 shadow-lg items-center">
           {/* Tool Toggle */}
           <div className="flex bg-slate-800 rounded mr-2 p-0.5">
             <button 
               onClick={() => { setDragMode('view'); setIsCropping(false); }} 
               className={`p-1.5 rounded ${dragMode === 'view' && !isCropping ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
               title="Pan View (Hand)"
             >
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
             </button>
             <button 
               onClick={() => { setDragMode('image'); setIsCropping(false); }} 
               className={`p-1.5 rounded ${dragMode === 'image' && !isCropping ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
               title="Move Image (V)"
             >
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 9l-3 3 3 3"/><path d="M9 5l3-3 3 3"/><path d="M19 9l3 3-3 3"/><path d="M15 19l-3 3-3-3"/><path d="M2 12h20"/><path d="M12 2v20"/></svg>
             </button>
           </div>
           
           <div className="h-6 w-px bg-slate-700 mx-1"></div>

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
          className={`flex-1 flex items-center justify-center p-0 overflow-hidden relative ${
            isCropping ? 'cursor-crosshair' : (dragMode === 'image' ? (isDragging ? 'cursor-grabbing' : 'cursor-move') : (isDragging ? 'cursor-grabbing' : 'cursor-grab'))
          }`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          
          {/* Checkerboard background */}
          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none"
             style={{
               backgroundImage: `linear-gradient(45deg, #334155 25%, transparent 25%), linear-gradient(-45deg, #334155 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #334155 75%), linear-gradient(-45deg, transparent 75%, #334155 75%)`,
               backgroundSize: '20px 20px',
               backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
             }}
          />

          {/* Container for the image */}
          <div 
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
            className="relative z-10 origin-center will-change-transform"
          >
             {isCropping ? (
                <img 
                  src={URL.createObjectURL(image.blob)}
                  alt="Original for Cropping"
                  draggable={false}
                  className="max-w-none shadow-2xl border border-blue-500/50 select-none opacity-80"
                />
             ) : (
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  draggable={false}
                  className="max-w-none shadow-2xl border border-slate-800 select-none"
                />
             )}
          </div>
          
          {/* Crop Overlay */}
          {isCropping && cropSelection && (
             <div 
               className="absolute z-30 border-2 border-blue-400 bg-blue-500/10 pointer-events-none"
               style={{
                 left: cropSelection.x,
                 top: cropSelection.y,
                 width: cropSelection.width,
                 height: cropSelection.height
               }}
             >
                <div className="absolute -top-2 -left-2 w-2 h-2 bg-blue-500"></div>
                <div className="absolute -top-2 -right-2 w-2 h-2 bg-blue-500"></div>
                <div className="absolute -bottom-2 -left-2 w-2 h-2 bg-blue-500"></div>
                <div className="absolute -bottom-2 -right-2 w-2 h-2 bg-blue-500"></div>
             </div>
          )}

          {isProcessing && !isDragging && (
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
              <span className="text-blue-400 font-medium">
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
            disabled={!previewBlob || isCropping || isSaving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
          >
            {isSaving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/50 border-t-white"></div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            )}
            {isSaving ? 'Saving...' : (dirHandle ? 'Save to Folder' : 'Download')}
          </button>
        </div>
      </div>
    </div>
  );
};