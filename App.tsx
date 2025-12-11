import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Library } from './components/Library';
import { Editor } from './components/Editor';
import { BatchEditor } from './components/BatchEditor';
import { StoredImage } from './types';
import * as DB from './services/db';

const App: React.FC = () => {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [batchImageIds, setBatchImageIds] = useState<string[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  
  // File System Handle
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);

  // Load images & settings on mount
  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    try {
      const imgs = await DB.getAllImages();
      setImages(imgs);
      const handle = await DB.getDirectoryHandle();
      if (handle) setDirHandle(handle);
    } catch (e) {
      console.error("Failed to load library", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setIsLoading(true);
    const newImages: StoredImage[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      try {
        const img = await createImageBitmap(file);
        
        const stored: StoredImage = {
          id: uuidv4(),
          name: file.name,
          blob: file,
          type: file.type,
          width: img.width,
          height: img.height,
          createdAt: Date.now(),
          lastModified: Date.now()
        };
        
        await DB.saveImageToDB(stored);
        newImages.push(stored);
      } catch (err) {
        console.error("Error processing file", file.name, err);
      }
    }

    await loadLibrary();
    // If only one uploaded, open it immediately
    if (newImages.length === 1 && !activeImageId && !batchImageIds) {
      setActiveImageId(newImages[0].id);
    }
    
    setIsLoading(false);
  };

  const handleDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} images? This cannot be undone.`)) return;
    
    for (const id of ids) {
      await DB.deleteImageFromDB(id);
    }
    setSelectedIds(new Set());
    if (activeImageId && ids.includes(activeImageId)) setActiveImageId(null);
    await loadLibrary();
  };

  const handleSelect = (id: string, multi: boolean) => {
    if (!multi) {
      setSelectedIds(new Set([id]));
      return;
    }
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };
  
  const handleSetOutputFolder = async () => {
    try {
      // @ts-ignore - File System Access API types might be missing in older envs
      const handle = await window.showDirectoryPicker();
      if (handle) {
        setDirHandle(handle);
        await DB.saveDirectoryHandle(handle);
      }
    } catch (e) {
      console.error("Error selecting folder", e);
    }
  };

  const activeImage = images.find(i => i.id === activeImageId);
  const batchImages = batchImageIds ? images.filter(i => batchImageIds.includes(i.id)) : [];

  if (isLoading && images.length === 0) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p>Loading Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-200">
      
      {/* Header */}
      <header className="h-14 border-b border-slate-800 flex items-center px-6 bg-slate-950 shrink-0 shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setActiveImageId(null); setBatchImageIds(null); }}>
           <div className="text-blue-500">
             <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
               <line x1="16" x2="22" y1="5" y2="5" />
               <line x1="19" x2="19" y1="2" y2="8" />
               <circle cx="9" cy="9" r="2" />
               <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
             </svg>
           </div>
           <h1 className="font-bold tracking-tight text-xl text-white">Image Studio</h1>
        </div>
        
        <div className="ml-auto flex items-center gap-4">
           {/* Directory Picker */}
           <button 
             onClick={handleSetOutputFolder}
             className={`text-xs flex items-center gap-2 px-3 py-1.5 rounded border transition-colors ${dirHandle ? 'border-green-800 bg-green-900/20 text-green-400 hover:bg-green-900/30' : 'border-slate-700 hover:bg-slate-800 text-slate-400'}`}
             title={dirHandle ? `Saved to: ${dirHandle.name}` : "Set persistent download folder"}
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
             {dirHandle ? dirHandle.name : 'Set Output Folder'}
           </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {batchImageIds && batchImages.length > 0 ? (
          <BatchEditor 
             images={batchImages}
             onClose={() => setBatchImageIds(null)}
             dirHandle={dirHandle}
          />
        ) : activeImageId && activeImage ? (
          <Editor 
            image={activeImage} 
            onClose={() => setActiveImageId(null)}
            dirHandle={dirHandle}
          />
        ) : (
          <Library 
            images={images}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onOpen={(img) => setActiveImageId(img.id)}
            onUpload={handleUpload}
            onBatchEdit={(ids) => setBatchImageIds(ids)}
          />
        )}
      </main>
    </div>
  );
};

export default App;