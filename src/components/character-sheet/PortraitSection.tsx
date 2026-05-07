import { useRef, useCallback } from 'react';
import { Camera, Trash2, User } from 'lucide-react';
import type { CharacterImages } from '../../types/characterSheet';

interface PortraitSectionProps {
  images: CharacterImages | undefined;
  editMode: boolean;
  onImagesChange: (images: CharacterImages) => void;
}

/** Maximum image size in bytes (500KB — stored as base64 in campaign state) */
const MAX_IMAGE_SIZE = 500 * 1024;
/** Target dimensions for portraits */
const PORTRAIT_MAX_DIM = 256;
/** Target dimensions for tokens */
const TOKEN_MAX_DIM = 64;

/**
 * Resize an image file to a max dimension and return a base64 data URL.
 */
function resizeImage(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          } else {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function PortraitSection({ images, editMode, onImagesChange }: PortraitSectionProps) {
  const portraitInputRef = useRef<HTMLInputElement>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(async (
    file: File,
    type: 'portrait' | 'token'
  ) => {
    if (file.size > MAX_IMAGE_SIZE * 4) {
      // Very large files — warn but still try to resize
      console.warn('Image file very large, resizing...');
    }

    try {
      const maxDim = type === 'portrait' ? PORTRAIT_MAX_DIM : TOKEN_MAX_DIM;
      const dataUrl = await resizeImage(file, maxDim);
      onImagesChange({
        ...images,
        [type]: dataUrl,
      });
    } catch (err) {
      console.error('Failed to process image:', err);
    }
  }, [images, onImagesChange]);

  const handleClear = useCallback((type: 'portrait' | 'token') => {
    const updated = { ...images };
    if (type === 'portrait') {
      updated.portrait = undefined;
    } else {
      updated.token = undefined;
    }
    onImagesChange(updated);
  }, [images, onImagesChange]);

  const portrait = images?.portrait;
  const token = images?.token;

  return (
    <div className="flex items-start gap-4">
      {/* Portrait */}
      <div className="flex flex-col items-center gap-1">
        <div className="relative group">
          {portrait ? (
            <img
              src={portrait}
              alt="Character portrait"
              className="w-20 h-20 rounded-lg object-cover border-2 border-gray-600"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-gray-700 border-2 border-gray-600 flex items-center justify-center">
              <User size={32} className="text-gray-500" />
            </div>
          )}
          {editMode && (
            <div className="absolute inset-0 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <button
                onClick={() => portraitInputRef.current?.click()}
                className="p-1 bg-gray-700 rounded hover:bg-gray-600"
                title="Upload portrait"
              >
                <Camera size={14} />
              </button>
              {portrait && (
                <button
                  onClick={() => handleClear('portrait')}
                  className="p-1 bg-gray-700 rounded hover:bg-red-600"
                  title="Remove portrait"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>
        <span className="text-[0.6rem] text-gray-500">Portrait</span>
        <input
          ref={portraitInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageUpload(file, 'portrait');
            e.target.value = '';
          }}
        />
      </div>

      {/* Token */}
      <div className="flex flex-col items-center gap-1">
        <div className="relative group">
          {token ? (
            <img
              src={token}
              alt="Combat token"
              className="w-12 h-12 rounded-full object-cover border-2 border-gray-600"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center">
              <User size={20} className="text-gray-500" />
            </div>
          )}
          {editMode && (
            <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <button
                onClick={() => tokenInputRef.current?.click()}
                className="p-1 bg-gray-700 rounded hover:bg-gray-600"
                title="Upload token"
              >
                <Camera size={12} />
              </button>
              {token && (
                <button
                  onClick={() => handleClear('token')}
                  className="p-1 bg-gray-700 rounded hover:bg-red-600"
                  title="Remove token"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )}
        </div>
        <span className="text-[0.6rem] text-gray-500">Token</span>
        <input
          ref={tokenInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageUpload(file, 'token');
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
