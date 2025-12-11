import React, { useState, useRef, useEffect } from 'react';

interface CompareSliderProps {
  original: string;
  modified: string;
  width: number;
  height: number;
}

export const CompareSlider: React.FC<CompareSliderProps> = ({ original, modified, width, height }) => {
  const [position, setPosition] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => setIsResizing(true);
  
  useEffect(() => {
    const handleMouseUp = () => setIsResizing(false);
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      setPosition((x / rect.width) * 100);
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isResizing]);

  // Touch support
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
  };

  return (
    <div 
      ref={containerRef}
      className="relative select-none overflow-hidden shadow-2xl border border-slate-800"
      style={{ 
        width: '100%', 
        height: '100%', 
        cursor: 'ew-resize',
        maxWidth: '100%',
        maxHeight: '100%',
        aspectRatio: `${width} / ${height}`
      }}
      onTouchMove={handleTouchMove}
    >
      {/* Background (Modified) */}
      <img 
        src={modified} 
        alt="Modified" 
        className="absolute inset-0 w-full h-full object-contain bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==')] bg-repeat"
        draggable={false}
      />

      {/* Foreground (Original) - Clipped */}
      <div 
        className="absolute inset-0 overflow-hidden bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==')] bg-repeat"
        style={{ width: `${position}%`, borderRight: '1px solid white' }}
      >
        <img 
          src={original} 
          alt="Original" 
          className="absolute top-0 left-0 h-full max-w-none object-contain"
          style={{ width: containerRef.current ? containerRef.current.clientWidth : '100%' }}
          draggable={false}
        />
      </div>

      {/* Slider Handle */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-20 flex items-center justify-center shadow-xl"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        onMouseDown={handleMouseDown}
      >
        <div className="w-8 h-8 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-lg border border-slate-200">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform="rotate(180)"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>
      
      {/* Labels */}
      <div className="absolute top-4 left-4 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm pointer-events-none">Original</div>
      <div className="absolute top-4 right-4 bg-blue-600/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm pointer-events-none">Modified</div>
    </div>
  );
};
