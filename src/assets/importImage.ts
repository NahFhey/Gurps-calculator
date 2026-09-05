import type { AssetId } from '../types/map';
import { getAssetStore } from './assetStore';

/** Cap decode/texture cost; encoded pixels live in the asset store. */
const IMAGE_MAX_DIM = 2048;

export function importImage(file: File): Promise<{ assetId: AssetId; mime: string; aspect: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > IMAGE_MAX_DIM || height > IMAGE_MAX_DIM) {
          const scale = IMAGE_MAX_DIM / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Failed to encode image')); return; }
          void blob.arrayBuffer().then(async (buffer) => {
            const mime = blob.type || 'image/jpeg';
            const assetId = await getAssetStore().put(new Uint8Array(buffer), mime);
            resolve({ assetId, mime, aspect: height / width });
          }).catch(reject);
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

