/**
 * SaveDesignModal - Prompt to save a completed design phase as a reusable template.
 */

import { useEffect, useId, useState } from 'react';
import type { Craft } from '../../types/campaign';

interface SaveDesignModalProps {
  craft: Craft;
  onSave: (name: string) => void;
  onSkip: () => void;
}

export function SaveDesignModal({ craft, onSave, onSkip }: SaveDesignModalProps) {
  const [designName, setDesignName] = useState('');
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onSkip]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="bg-gray-800 p-6 rounded-lg max-w-md border-2 border-purple-500"
      >
        <h3 id={titleId} className="text-xl font-bold mb-4 text-purple-400">Save Design?</h3>
        <p id={descriptionId} className="mb-4 text-gray-300">
          Design phase complete! Would you like to save this as a reusable craft design?
        </p>
        <div className="mb-4">
          <label htmlFor={inputId} className="block text-sm mb-2">Design Name</label>
          <input
            id={inputId}
            type="text"
            value={designName}
            onChange={(e) => setDesignName(e.target.value)}
            placeholder={`${craft.currentQuality} ${craft.template}`}
            aria-label="Design Name"
            className="w-full bg-gray-600 px-3 py-2 rounded"
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip saving design"
            className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => {
              const name = designName.trim() || `${craft.currentQuality} ${craft.template}`;
              onSave(name);
            }}
            aria-label="Save design"
            className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700"
          >
            Save Design
          </button>
        </div>
      </div>
    </div>
  );
}
