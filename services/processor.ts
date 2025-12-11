import { ProcessOptions, OutputFormat } from '../types';

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

  let targetWidth = options.width || img.width;
  let targetHeight = options.height || img.height;

  // Aspect ratio calculations if one dimension is missing
  if (options.width && !options.height) {
    targetHeight = Math.round((img.height / img.width) * options.width);
  } else if (!options.width && options.height) {
    targetWidth = Math.round((img.width / img.height) * options.height);
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // Smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Rotation
  if (options.rotation) {
    // Handling rotation logic implies canvas resizing, skipping complex rotation for basic resize focus
    // Simple 90deg increments would require swapping w/h
  }

  // Draw Logic
  if (options.fit === 'fill') {
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  } else if (options.fit === 'cover') {
    const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
    const x = (targetWidth / 2) - (img.width / 2) * scale;
    const y = (targetHeight / 2) - (img.height / 2) * scale;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
  } else if (options.fit === 'contain') {
    const scale = Math.min(targetWidth / img.width, targetHeight / img.height);
    const x = (targetWidth / 2) - (img.width / 2) * scale;
    const y = (targetHeight / 2) - (img.height / 2) * scale;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
  }

  // Masking
  if (options.mask === 'circle') {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(targetWidth / 2, targetHeight / 2, Math.min(targetWidth, targetHeight) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  } else if (options.mask === 'square') {
     // Already square if resized, but strictly implies cropping to shortest side?
     // Assuming fit=cover handled dimensions, mask square just ensures no overflow if we had transparency
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