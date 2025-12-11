import React, { useState, useEffect, useRef } from 'react';
import { StoredImage, ProcessOptions, OutputFormat, CropRect } from '../types';
import { processImage, formatBytes, removeBackgroundAI } from '../services/processor';
import { SUPPORTED_FORMATS, PRESETS } from '../constants';
import { CompareSlider } from './CompareSlider';

interface EditorProps {
  image: StoredImage;
  onClose: () => void;
  dirHandle: FileSystemDirectoryHandle | null;
}

export const Editor: React.FC<EditorProps> = ({ image, onClose, dirHandle }) => {
  // Initial State
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

  const [options, setOptions] = useState<ProcessOptions>(getInitialOptions());
  const [history, setHistory] = useState<{op: ProcessOptions, desc: string}[]>([{op: getInitialOptions(), desc: 'Original'}]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [originalUrl] = useState<string>(URL.createObjectURL(image.blob));
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('Processing...');
  
  // Renaming Pattern
  const [namePattern, setNamePattern] = useState('{name}');
  const [finalName, setFinalName] = useState(image.name);

  // Compare View
  const [viewMode, setViewMode] = useState<'single' | 'compare'>('single');

  // Viewport
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'view' | 'image'>('view');
  
  // Crop
  const [isCropping, setIsCropping] = useState(false);
  const [cropSelection, setCropSelection] = useState<CropRect | null>(null);
  
  const dragStart = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // --- History ---
  const pushHistory = (newOptions: ProcessOptions, description: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ op: newOptions, desc: description });
    if (newHistory.length > 20) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setOptions(newOptions);
  };

  const jumpToHistory = (index: number) => {
    setHistoryIndex(index);
    setOptions(history[index].op);
  };

  // --- Processing ---
  useEffect(() => {
    const isInteractive = isDragging && dragMode === 'image';
    const delay = isInteractive ? 10 : 300;

    const timer = setTimeout(async () => {
      setIsProcessing(true);
      setProcessingMsg(isInteractive ? '' : 'Processing...');
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

  // Dynamic Naming Logic
  useEffect(() => {
    const ext = SUPPORTED_FORMATS[options.format].toLowerCase();
    const baseName = image.name.substring(0, image.name.lastIndexOf('.')) || image.name;
    const date = new Date().toISOString().split('T')[0];
    
    let processed = namePattern
      .replace('{name}', baseName)
      .replace('{width}', (options.width || image.width).toString())
      .replace('{height}', (options.height || image.height).toString())
      .replace('{date}', date)
      .replace('{q}', Math.round(options.quality * 100).toString());

    setFinalName(`${processed}.${ext === 'jpeg' ? 'jpg' : ext}`);
  }, [namePattern, options, image]);

  const handleRemoveBackground = async () => {
    setIsProcessing(true);
    setProcessingMsg('Removing Background (AI)... This may take a moment.');
    try {
      // For this to work in PWA, we assume we want to "Process" the image 
      // but strictly speaking, background removal returns a new Blob that becomes the new "source".
      // To simplify for this editor, we just warn it might fail if assets aren't in /public
      const newBlob = await removeBackgroundAI(image.blob);
      
      // Update logic to use this new blob as "Source" is complex in this architecture 
      // without changing the `image` prop. 
      // workaround: We treat it as a heavy filter on the current image.
      // ACTUALLY: The clean way is to trigger a download or replace current view.
      // Let's replace preview for now, but to persist we'd need to update the `image` ref.
      
      // For this demo, let's just save it as a new file immediately or download it
      const url = URL.createObjectURL(newBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${image.name}-nobg.png`;
      link.click();
      alert("Background removed! Image downloaded as PNG.");
      
    } catch (e) {
      alert("Background removal failed. Ensure assets are available or check console.");
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShare = async () => {
    // Check if navigator.share exists and is a function before using it
    if (!previewBlob || typeof navigator.share !== 'function') return;
    const file = new File([previewBlob], finalName, { type: options.format });
    try {
      await navigator.share({
        files: [file],
        title: 'Processed Image',
        text: 'Edited with Image Studio'
      });
    } catch (e) {
      console.log('Share cancelled');
    }
  };

  // --- Input Change Wrappers ---
  const updateOption = (key: keyof ProcessOptions, value: any) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };
  
  const commitOptionChange = (desc: string) => {
    if (JSON.stringify(history[historyIndex].op) !== JSON.stringify(options)) {
      pushHistory(options, desc);
    }
  };

  // --- Stats Calculation ---
  const getStats = () => {
    if (!previewBlob) return null;
    const diff = previewBlob.size - image.blob.size;
    const pct = Math.round((diff / image.blob.size) * 100);
    const color = diff <= 0 ? 'text-green-400' : 'text-red-400';
    return { diff, pct, color };
  };

  const stats = getStats();

  // --- Render ---

  // Mouse handlers same as before (omitted for brevity, assume they exist or use previous implementation)
  // Re-implementing simplified interaction handlers for context
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    if(viewMode === 'compare') return;
    const scaleAmount = -e.deltaY * 0.001;
    setTransform(prev => ({ ...prev, scale: Math.min(Math.max(0.1, prev.scale + scaleAmount), 5) }));
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if(viewMode === 'compare') return;
    if (!containerRef.current) return;
    setIsDragging(true);
    if (isCropping) {
        // ... crop logic setup
        const rect = containerRef.current.getBoundingClientRect();
        dragStart.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        setCropSelection({ x: dragStart.current.x, y: dragStart.current.y, width:0, height: 0 });
    } else if (dragMode === 'image') {
        dragStart.current = { x: e.clientX, y: e.clientY };
        startOffset.current = options.offset || { x: 0, y: 0 };
    } else {
        dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if(!isDragging) return;
      if (dragMode === 'view' && !isCropping) {
          setTransform(p => ({...p, x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y}));
      } else if (dragMode === 'image' && !isCropping) {
           const dx = (e.clientX - dragStart.current.x) / transform.scale;
           const dy = (e.clientY - dragStart.current.y) / transform.scale;
           setOptions(p => ({...p, offset: { x: startOffset.current.x + dx, y: startOffset.current.y + dy }}));
      } else if (isCropping && containerRef.current) {
         // simplified crop draw
         const rect = containerRef.current.getBoundingClientRect();
         const curX = e.clientX - rect.left;
         const curY = e.clientY - rect.top;
         setCropSelection({
             x: Math.min(dragStart.current.x, curX),
             y: Math.min(dragStart.current.y, curY),
             width: Math.abs(curX - dragStart.current.x),
             height: Math.abs(curY - dragStart.current.y)
         });
      }
  };

  const handleMouseUp = () => {
      if(isDragging && isCropping && cropSelection && cropSelection.width > 10) {
          // Apply Crop logic mapping screen coords to image coords
          const imgX = (cropSelection.x - transform.x) / transform.scale;
          const imgY = (cropSelection.y - transform.y) / transform.scale;
          const imgW = cropSelection.width / transform.scale;
          const imgH = cropSelection.height / transform.scale;
          const newCrop = {
              x: Math.max(0, Math.floor(imgX)),
              y: Math.max(0, Math.floor(imgY)),
              width: Math.min(image.width - imgX, Math.floor(imgW)),
              height: Math.min(image.height - imgY, Math.floor(imgH))
          };
          updateOption('crop', newCrop);
          updateOption('width', newCrop.width);
          updateOption('height', newCrop.height);
          pushHistory({...options, crop: newCrop, width: newCrop.width, height: newCrop.height}, 'Crop');
          setIsCropping(false);
          setCropSelection(null);
      } else if (isDragging && dragMode === 'image') {
          commitOptionChange('Move Image');
      }
      setIsDragging(false);
  };

  const handleDownload = async () => {
    if (!previewBlob) return;
    try {
      if (dirHandle) {
         const fileHandle = await dirHandle.getFileHandle(finalName, { create: true });
         const writable = await fileHandle.createWritable();
         await writable.write(previewBlob);
         await writable.close();
      } else {
        const link = document.createElement('a');
        link.href = previewUrl;
        link.download = finalName;
        link.click();
      }
    } catch(e) { console.error(e); }
  };


  return (
    <div className="flex h-full bg-slate-900">
      {/* Sidebar */}
      <div className="w-80 bg-slate-950 border-r border-slate-800 flex flex-col z-20 shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2">
            <button onClick={onClose} className="text-slate-400 hover:text-white"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg></button>
            <h2 className="font-semibold text-slate-200">Editor</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            {/* History List */}
            <div className="bg-slate-900 rounded-lg p-3 border border-slate-800 max-h-40 overflow-y-auto">
                <p className="text-xs text-slate-500 mb-2 font-bold uppercase">History</p>
                <div className="space-y-1">
                    {history.map((h, i) => (
                        <div key={i} 
                             onClick={() => jumpToHistory(i)}
                             className={`text-xs px-2 py-1 rounded cursor-pointer flex justify-between ${i === historyIndex ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                            <span>{h.desc}</span>
                            {i === 0 && <span className="opacity-50">Start</span>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Naming */}
            <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase">Rename Pattern</label>
                <input type="text" value={namePattern} onChange={e => setNamePattern(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs" />
                <p className="text-[10px] text-slate-500">Tokens: {'{name}, {width}, {height}, {date}, {q}'}</p>
                <p className="text-xs text-blue-400 truncate">{finalName}</p>
            </div>

            {/* AI Tools */}
            <div className="space-y-2">
                 <label className="text-xs font-semibold text-slate-500 uppercase">AI Tools</label>
                 <button onClick={handleRemoveBackground} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg flex items-center justify-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 21a4 4 0 0 1-4-4V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v12a4 4 0 0 1-4 4zm0 0h12a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 0 1 2.828 0l2.829 2.829a2 2 0 0 1 0 2.828l-8.486 8.485M7 17h.01"/></svg>
                    Remove Background
                 </button>
            </div>

            <hr className="border-slate-800"/>

            {/* Basic Controls (Dimensions, Quality) */}
            <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Dimensions</label>
                    <div className="flex gap-2">
                        <input type="number" placeholder="W" value={options.width || ''} onChange={e => updateOption('width', Number(e.target.value))} onBlur={() => commitOptionChange('Resize')} className="w-1/2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                        <input type="number" placeholder="H" value={options.height || ''} onChange={e => updateOption('height', Number(e.target.value))} onBlur={() => commitOptionChange('Resize')} className="w-1/2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <div className="flex justify-between">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Quality</label>
                        <span className="text-xs text-slate-400">{Math.round(options.quality * 100)}%</span>
                    </div>
                    <input type="range" min="0.1" max="1" step="0.05" value={options.quality} onChange={e => updateOption('quality', parseFloat(e.target.value))} onMouseUp={() => commitOptionChange('Quality')} className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Format</label>
                    <select value={options.format} onChange={e => { updateOption('format', e.target.value); commitOptionChange('Format Change'); }} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs">
                        {Object.entries(SUPPORTED_FORMATS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                 </div>
            </div>
            
            <hr className="border-slate-800"/>

            {/* Presets */}
            <div className="flex flex-wrap gap-2">
                {PRESETS.slice(0, 6).map(p => (
                    <button key={p.id} onClick={() => { setOptions({...options, ...p.options}); pushHistory({...options, ...p.options}, `Preset: ${p.label}`); }} className="text-[10px] bg-slate-800 border border-slate-700 px-2 py-1 rounded text-slate-300 hover:text-white">
                        {p.label}
                    </button>
                ))}
            </div>

        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-900">
         {/* Top Toolbar */}
         <div className="h-12 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-950/50 backdrop-blur z-20">
             <div className="flex bg-slate-800 rounded p-1 gap-1">
                 <button onClick={() => setViewMode('single')} className={`px-3 py-1 text-xs rounded ${viewMode === 'single' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>Editor</button>
                 <button onClick={() => setViewMode('compare')} className={`px-3 py-1 text-xs rounded ${viewMode === 'compare' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>Compare</button>
             </div>

             <div className="flex gap-2">
                 <button onClick={() => { setIsCropping(!isCropping); setDragMode('view'); }} className={`p-2 rounded ${isCropping ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`} title="Crop">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>
                 </button>
                 <button onClick={() => { setDragMode('image'); setIsCropping(false); }} className={`p-2 rounded ${dragMode === 'image' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`} title="Move Image">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 9l-3 3 3 3"/><path d="M9 5l3-3 3 3"/><path d="M19 9l3 3-3 3"/><path d="M15 19l-3 3-3-3"/><path d="M2 12h20"/><path d="M12 2v20"/></svg>
                 </button>
                 <button onClick={() => setTransform(t => ({...t, scale: 1, x:0, y:0}))} className="p-2 text-slate-400 hover:bg-slate-800 rounded" title="Reset View">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                 </button>
             </div>
         </div>

         {/* Canvas Area */}
         <div 
            ref={containerRef}
            className="flex-1 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing bg-slate-900"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
         >
            {/* Checkerboard */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: `linear-gradient(45deg, #334155 25%, transparent 25%), linear-gradient(-45deg, #334155 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #334155 75%), linear-gradient(-45deg, transparent 75%, #334155 75%)`, backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }} />
            
            <div style={{ transform: viewMode === 'compare' ? 'none' : `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, width: viewMode === 'compare' ? '80%' : 'auto', height: viewMode === 'compare' ? '80%' : 'auto' }} className="relative z-10 transition-transform duration-75">
                {viewMode === 'compare' ? (
                    <CompareSlider original={originalUrl} modified={previewUrl} width={image.width} height={image.height} />
                ) : (
                    <>
                    <img src={previewUrl} className="max-w-none shadow-2xl border border-slate-800" draggable={false} />
                    {isCropping && cropSelection && (
                        <div className="absolute border-2 border-blue-500 bg-blue-500/20" style={{ left: cropSelection.x - transform.x, top: cropSelection.y - transform.y, width: cropSelection.width, height: cropSelection.height }}></div>
                    )}
                    </>
                )}
            </div>

            {isProcessing && (
                <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
                        <span className="text-white font-medium text-sm">{processingMsg}</span>
                    </div>
                </div>
            )}
         </div>

         {/* Bottom Bar */}
         <div className="h-16 bg-slate-950 border-t border-slate-800 flex items-center justify-between px-6 z-20">
            <div className="flex gap-6 text-sm">
                <div>
                    <span className="text-slate-500 block text-xs">Original</span>
                    <span className="text-slate-300">{formatBytes(image.blob.size)}</span>
                </div>
                <div className="h-8 w-px bg-slate-800"></div>
                <div>
                    <span className="text-slate-500 block text-xs">Result</span>
                    <span className="text-white font-medium">{previewBlob ? formatBytes(previewBlob.size) : '...'}</span>
                    {stats && <span className={`ml-2 text-xs font-bold ${stats.color}`}>{stats.diff > 0 ? '+' : ''}{stats.pct}%</span>}
                </div>
            </div>

            <div className="flex gap-3">
                {typeof navigator.share === 'function' && (
                    <button onClick={handleShare} className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                        Share
                    </button>
                )}
                <button onClick={handleDownload} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-blue-500/20 flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    {dirHandle ? 'Save' : 'Download'}
                </button>
            </div>
         </div>
      </div>
    </div>
  );
};