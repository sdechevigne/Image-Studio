import { ProcessOptions } from '../types';
import { removeBackground } from '@imgly/background-removal';

const createImage = (blob: Blob): Promise<ImageBitmap> => {
  return createImageBitmap(blob);
};

self.onmessage = async (e: MessageEvent) => {
  const { id, blob, options, type } = e.data;

  try {
    if (type === 'remove-bg') {
      // AI Background Removal
      // Note: This fetches WASM assets from CDN by default.
      const resultBlob = await removeBackground(blob, {
        progress: (key, current, total) => {
           // Optional: Report loading progress
        }
      });
      
      self.postMessage({
        id,
        success: true,
        blob: resultBlob,
        width: 0, // Will be recalculated by main thread or next step
        height: 0
      });
      return;
    }

    // Standard Processing (Resize, Format, Crop)
    const img = await createImage(blob);
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

    if (!ctx) throw new Error('Could not get canvas context');

    // Determine Dimensions
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

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const userOffsetX = options.offset?.x || 0;
    const userOffsetY = options.offset?.y || 0;

    // Draw Logic
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

    const resultBlob = await canvas.convertToBlob({
      type: options.format,
      quality: options.quality
    });

    self.postMessage({
      id,
      success: true,
      blob: resultBlob,
      width: targetWidth,
      height: targetHeight
    });

  } catch (err: any) {
    self.postMessage({
      id,
      success: false,
      error: err.message
    });
  }
};
