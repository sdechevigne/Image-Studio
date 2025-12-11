import { removeBackground } from '@imgly/background-removal';
import * as jpeg from '@jsquash/jpeg';
import * as png from '@jsquash/png';
import * as webp from '@jsquash/webp';
import * as avif from '@jsquash/avif';

const createImage = (blob: Blob): Promise<ImageBitmap> => {
  return createImageBitmap(blob);
};

self.onmessage = async (e: MessageEvent) => {
  const { id, blob, options, type } = e.data;

  try {
    if (type === 'remove-bg') {
      const resultBlob = await removeBackground(blob, {
        progress: () => {
           // Optional progress handling
        }
      });
      
      self.postMessage({
        id,
        success: true,
        blob: resultBlob,
        width: 0, 
        height: 0
      });
      return;
    }

    // 1. Prepare Canvas & Context
    const img = await createImage(blob);
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

    if (!ctx) throw new Error('Could not get canvas context');

    // 2. Calculate Dimensions
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

    // 3. Draw Image with Settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

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

    // 4. WASM Encoding using @jsquash
    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    let resultBlob: Blob;

    // Quality mapping: 0-1 to specific encoder scales
    // JPEG/WebP/AVIF usually 0-100 or 0-1 in libraries, let's normalize to what jsquash expects (mostly 0-1 or options object)
    
    switch (options.format) {
      case 'image/jpeg': {
        // jsquash/jpeg expects { quality: number (0-100) }
        const buffer = await jpeg.encode(imageData, { quality: options.quality * 100 });
        resultBlob = new Blob([buffer], { type: 'image/jpeg' });
        break;
      }
      case 'image/png': {
        // jsquash/png usually optimizes automatically, options available for speed vs compression
        const buffer = await png.encode(imageData);
        resultBlob = new Blob([buffer], { type: 'image/png' });
        break;
      }
      case 'image/webp': {
        // jsquash/webp expects { quality: number (0-1) }
        const buffer = await webp.encode(imageData, { quality: options.quality });
        resultBlob = new Blob([buffer], { type: 'image/webp' });
        break;
      }
      case 'image/avif': {
        // jsquash/avif expects { quality: number (0-63 usually, but wrapper might handle 0-100 or 0-1). 
        // Checking docs: standard is usually QP or quality. jsquash normalize this.
        // Assuming 0-100 based on common usage in squoosh libs
        const buffer = await avif.encode(imageData, { quality: options.quality * 100 });
        resultBlob = new Blob([buffer], { type: 'image/avif' });
        break;
      }
      default:
        // Fallback to canvas native if unknown
        resultBlob = await canvas.convertToBlob({
          type: options.format,
          quality: options.quality
        });
    }

    self.postMessage({
      id,
      success: true,
      blob: resultBlob,
      width: targetWidth,
      height: targetHeight
    });

  } catch (err: any) {
    console.error(err);
    self.postMessage({
      id,
      success: false,
      error: err.message || 'Worker processing failed'
    });
  }
};