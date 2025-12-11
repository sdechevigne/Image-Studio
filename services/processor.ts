import { ProcessOptions } from '../types';
import Worker from './image.worker?worker';

// Singleton worker instance
const worker = new Worker();
const pendingPromises = new Map<string, { resolve: Function; reject: Function }>();

worker.onmessage = (e: MessageEvent) => {
  const { id, success, blob, width, height, error } = e.data;
  const pending = pendingPromises.get(id);
  
  if (pending) {
    if (success) {
      pending.resolve({ blob, width, height, url: URL.createObjectURL(blob) });
    } else {
      pending.reject(new Error(error));
    }
    pendingPromises.delete(id);
  }
};

export const processImage = (
  blob: Blob,
  options: ProcessOptions
): Promise<{ blob: Blob; width: number; height: number; url: string }> => {
  const id = crypto.randomUUID();
  
  return new Promise((resolve, reject) => {
    pendingPromises.set(id, { resolve, reject });
    worker.postMessage({ id, blob, options, type: 'process' });
  });
};

export const removeBackgroundAI = (blob: Blob): Promise<Blob> => {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pendingPromises.set(id, { 
      resolve: (res: any) => resolve(res.blob), 
      reject 
    });
    worker.postMessage({ id, blob, options: {}, type: 'remove-bg' });
  });
};

export const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};