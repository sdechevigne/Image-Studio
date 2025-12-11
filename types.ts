export interface StoredImage {
  id: string;
  name: string;
  blob: Blob;
  type: string;
  width: number;
  height: number;
  createdAt: number;
  lastModified: number;
}

export type OutputFormat = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/avif';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProcessOptions {
  width?: number;
  height?: number;
  quality: number; // 0 to 1
  format: OutputFormat;
  fit: 'cover' | 'contain' | 'fill';
  mask: 'none' | 'circle' | 'square';
  rotation: number;
  crop?: CropRect;
  offset?: { x: number; y: number };
}

export interface Preset {
  id: string;
  label: string;
  category: 'social' | 'icon' | 'format' | 'dev';
  options: Partial<ProcessOptions>;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}