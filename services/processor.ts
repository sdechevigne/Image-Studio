import { ProcessOptions } from '../types';
import { removeBackground } from '@imgly/background-removal';
import * as jpeg from '@jsquash/jpeg';
import * as png from '@jsquash/png';
import * as webp from '@jsquash/webp';
import * as avif from '@jsquash/avif';

export const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const removeBackgroundAI = async (blob: Blob): Promise<Blob> => {
  // Executes on main thread, blocking UI only during heavy sync ops, 
  // but mostly async (WASM).
  return await removeBackground(blob, {
    progress: (key, current, total) => {
       // Optional: could dispatch progress event
    }
  });
};

export const processImage = async (
  blob: Blob,
  options: ProcessOptions
): Promise<{ blob: Blob; width: number; height: number; url: string }> => {
  
  // 1. Prepare Image
  const img = await createImageBitmap(blob);
  
  // 2. Prepare Canvas
  // Use OffscreenCanvas if available for better performance/separation, fallback to element
  let canvas: OffscreenCanvas | HTMLCanvasElement;
  let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;

  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(1, 1);
    ctx = canvas.getContext('2d');
  } else {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
  }

  if (!ctx) throw new Error('Could not get canvas context');

  // 3. Calculate Dimensions
  const srcX = options.crop ? options.crop.x : 0;
  const srcY = options.crop ? options.crop.y : 0;
  const srcW = options.crop ? options.crop.width : img.width;
  const srcH = options.crop ? options.crop.height : img.height;

  let targetWidth = options.width || srcW;
  let targetHeight = options.height || srcH;

  if (options.width && !options.height) {
    targetHeight = Math.round((srcH / srcW) * options.width);
  } else if (!options.width && options.height) {
    targetWidth = Math.round((srcW / srcH) * options.height);
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // 4. Draw Image with Settings
  // Type assertion handles both Offscreen and Standard contexts
  (ctx as CanvasRenderingContext2D).imageSmoothingEnabled = true;
  (ctx as CanvasRenderingContext2D).imageSmoothingQuality = 'high';

  const userOffsetX = options.offset?.x || 0;
  const userOffsetY = options.offset?.y || 0;

  // Fill / Cover / Contain Logic
  if (options.fit === 'fill') {
    ctx.drawImage(img, srcX, srcY, srcW, srcH, userOffsetX, userOffsetY, targetWidth, targetHeight);
  } else if (options.fit === 'cover') {
    const srcAspect = srcW / srcH;
    const dstAspect = targetWidth / targetHeight;
    let renderW = targetWidth;
    let renderH = targetHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (srcAspect > dstAspect) {
      renderW = targetHeight * srcAspect;
      offsetX = (targetWidth - renderW) / 2;
    } else {
      renderH = targetWidth / srcAspect;
      offsetY = (targetHeight - renderH) / 2;
    }
    ctx.drawImage(img, srcX, srcY, srcW, srcH, offsetX + userOffsetX, offsetY + userOffsetY, renderW, renderH);
  } else if (options.fit === 'contain') {
    const scale = Math.min(targetWidth / srcW, targetHeight / srcH);
    const renderW = srcW * scale;
    const renderH = srcH * scale;
    const x = (targetWidth - renderW) / 2;
    const y = (targetHeight - renderH) / 2;
    ctx.drawImage(img, srcX, srcY, srcW, srcH, x + userOffsetX, y + userOffsetY, renderW, renderH);
  }

  // Masking
  if (options.mask === 'circle') {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(targetWidth / 2, targetHeight / 2, Math.min(targetWidth, targetHeight) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  } else if (options.mask === 'square') {
    const size = Math.min(targetWidth, targetHeight);
    const x = (targetWidth - size) / 2;
    const y = (targetHeight - size) / 2;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // 5. WASM Encoding using @jsquash
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  let resultBlob: Blob;

  // Encoding
  switch (options.format) {
    case 'image/jpeg': {
      const buffer = await jpeg.encode(imageData, { quality: options.quality * 100 });
      resultBlob = new Blob([buffer], { type: 'image/jpeg' });
      break;
    }
    case 'image/png': {
      const buffer = await png.encode(imageData);
      resultBlob = new Blob([buffer], { type: 'image/png' });
      break;
    }
    case 'image/webp': {
      const buffer = await webp.encode(imageData, { quality: options.quality });
      resultBlob = new Blob([buffer], { type: 'image/webp' });
      break;
    }
    case 'image/avif': {
      const buffer = await avif.encode(imageData, { quality: options.quality * 100 });
      resultBlob = new Blob([buffer], { type: 'image/avif' });
      break;
    }
    default:
       // Fallback for types not handled by jsquash (should not happen given types)
       if (canvas instanceof HTMLCanvasElement) {
          resultBlob = await new Promise<Blob>((resolve, reject) => {
             canvas.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error('Canvas conversion failed'));
             }, options.format, options.quality);
          });
       } else {
          resultBlob = await (canvas as OffscreenCanvas).convertToBlob({
             type: options.format,
             quality: options.quality
          });
       }
  }

  return {
    blob: resultBlob,
    width: targetWidth,
    height: targetHeight,
    url: URL.createObjectURL(resultBlob)
  };
};