import { ProcessOptions } from '../types';

const createImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
};

export const processImage = async (
  blob: Blob,
  options: ProcessOptions
): Promise<{ blob: Blob; width: number; height: number; url: string }> => {
  const imgUrl = URL.createObjectURL(blob);
  const img = await createImage(imgUrl);
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Could not get canvas context');

  // Determine Source Dimensions (Crop or Full Image)
  const srcX = options.crop ? options.crop.x : 0;
  const srcY = options.crop ? options.crop.y : 0;
  const srcW = options.crop ? options.crop.width : img.width;
  const srcH = options.crop ? options.crop.height : img.height;

  // Determine Target Dimensions
  let targetWidth = options.width || srcW;
  let targetHeight = options.height || srcH;

  // Aspect ratio calculations if one dimension is missing
  if (options.width && !options.height) {
    targetHeight = Math.round((srcH / srcW) * options.width);
  } else if (!options.width && options.height) {
    targetWidth = Math.round((srcW / srcH) * options.height);
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // Smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // User Offset
  const userOffsetX = options.offset?.x || 0;
  const userOffsetY = options.offset?.y || 0;

  // Draw Logic
  if (options.fit === 'fill') {
    ctx.drawImage(img, srcX, srcY, srcW, srcH, userOffsetX, userOffsetY, targetWidth, targetHeight);
  } else if (options.fit === 'cover') {
    // Calculate aspect ratios
    const srcAspect = srcW / srcH;
    const dstAspect = targetWidth / targetHeight;
    
    let renderW = targetWidth;
    let renderH = targetHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (srcAspect > dstAspect) {
      // Source is wider than dest, so we crop width (zoom in)
      renderW = targetHeight * srcAspect;
      offsetX = (targetWidth - renderW) / 2;
    } else {
      // Source is taller than dest, so we crop height
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
    // If width != height, square mask limits to the smallest dimension centered
    const size = Math.min(targetWidth, targetHeight);
    const x = (targetWidth - size) / 2;
    const y = (targetHeight - size) / 2;
    
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // Export
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (resultBlob) => {
        if (!resultBlob) return reject('Conversion failed');
        resolve({
          blob: resultBlob,
          width: targetWidth,
          height: targetHeight,
          url: URL.createObjectURL(resultBlob)
        });
        URL.revokeObjectURL(imgUrl);
      },
      options.format,
      options.quality
    );
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