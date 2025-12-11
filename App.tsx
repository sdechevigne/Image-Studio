import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Library } from './components/Library';
import { Editor } from './components/Editor';
import { StoredImage } from './types';
import * as DB from './services/db';

const App: React.FC = () => {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Load images on mount
  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    try {
      const imgs = await DB.getAllImages();
      setImages(imgs);
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
    if (newImages.length === 1 && !activeImageId) {
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

  const activeImage = images.find(i => i.id === activeImageId);

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
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveImageId(null)}>
           <div className="w-6 h-6 bg-indigo-500 rounded-md flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-indigo-500/50">DS</div>
           <h1 className="font-bold tracking-tight">DevImage Studio</h1>
        </div>
        <div className="ml-auto text-xs text-slate-500 hidden sm:block">
          Persistent Storage &bull; PWA Ready
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {activeImageId && activeImage ? (
          <Editor 
            image={activeImage} 
            onClose={() => setActiveImageId(null)} 
          />
        ) : (
          <Library 
            images={images}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onOpen={(img) => setActiveImageId(img.id)}
            onUpload={handleUpload}
          />
        )}
      </main>
    </div>
  );
};

export default App;