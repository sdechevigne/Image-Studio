import React, { useState, useCallback } from 'react';
import { StoredImage } from '../types';
import { formatBytes } from '../services/processor';

interface LibraryProps {
  images: StoredImage[];
  selectedIds: Set<string>;
  onSelect: (id: string, multi: boolean) => void;
  onDelete: (ids: string[]) => void;
  onOpen: (image: StoredImage) => void;
  onUpload: (files: FileList | null) => void;
}

export const Library: React.FC<LibraryProps> = ({ images, selectedIds, onSelect, onDelete, onOpen, onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleCardClick = (e: React.MouseEvent, img: StoredImage) => {
    if (e.metaKey || e.ctrlKey) {
      onSelect(img.id, true);
    } else {
      onOpen(img);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
    }
  }, [onUpload]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpload(e.target.files);
  };

  return (
    <div 
      className={`flex-1 p-6 overflow-y-auto h-full relative transition-colors ${isDragging ? 'bg-slate-800' : 'bg-slate-900'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-indigo-500/20 pointer-events-none border-4 border-indigo-500 border-dashed m-4 rounded-xl">
          <p className="text-2xl font-bold text-indigo-200">Drop images here</p>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Library ({images.length})</h2>
        <div className="flex gap-3">
          {selectedIds.size > 0 && (
            <button 
              onClick={() => onDelete(Array.from(selectedIds))}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Delete ({selectedIds.size})
            </button>
          )}
          <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer transition-colors flex items-center gap-2 shadow-lg shadow-indigo-900/50">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>Add Images</span>
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleInputChange} />
          </label>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 select-none">
          <svg className="w-16 h-16 mb-4 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-lg mb-2 font-medium text-slate-400">Drag & Drop images here</p>
          <p className="text-sm">or click the Add Images button above</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {images.map((img) => (
            <div 
              key={img.id}
              onClick={(e) => handleCardClick(e, img)}
              className={`group relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                selectedIds.has(img.id) ? 'border-indigo-500 shadow-lg shadow-indigo-500/20 scale-95' : 'border-slate-800 hover:border-slate-600 hover:scale-[1.02]'
              }`}
            >
              <img 
                src={URL.createObjectURL(img.blob)} 
                alt={img.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8 opacity-100 transition-opacity">
                <p className="text-sm font-medium text-white truncate">{img.name}</p>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>{img.width}x{img.height}</span>
                  <span>{formatBytes(img.blob.size)}</span>
                </div>
              </div>
              
              {/* Selection Checkbox Overlay */}
              <div 
                className={`absolute top-2 right-2 w-6 h-6 rounded-full border border-white/50 flex items-center justify-center transition-colors ${selectedIds.has(img.id) ? 'bg-indigo-500 border-indigo-500' : 'bg-black/40 hover:bg-black/60'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(img.id, true);
                }}
              >
                {selectedIds.has(img.id) && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};