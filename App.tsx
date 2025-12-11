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
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p>Loading Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-200">
      
      {/* Header */}
      <header className="h-14 border-b border-slate-800 flex items-center px-6 bg-slate-950 shrink-0">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setActiveImageId(null); setBatchImageIds(null); }}>
           <div className="w-6 h-6 bg-indigo-500 rounded-md flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-indigo-500/50">DS</div>
           <h1 className="font-bold tracking-tight">DevImage Studio</h1>
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
