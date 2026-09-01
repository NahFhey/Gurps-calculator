/**
 * SaveDesignModal - Prompt to save a completed design phase as a reusable template.
 */

import { useId, useState } from 'react';
import type { Craft } from '../../types/campaign';
import { Modal } from '../ui/Modal';

interface SaveDesignModalProps {
  craft: Craft;
  onSave: (name: string) => void;
  onSkip: () => void;
}

export function SaveDesignModal({ craft, onSave, onSkip }: SaveDesignModalProps) {
  const [designName, setDesignName] = useState('');
  const descriptionId = useId();
  const inputId = useId();

  return (
    <Modal
      isOpen
      onClose={onSkip}
      title={<span className="text-purple-400">Save Design?</span>}
      ariaDescribedby={descriptionId}
      size="md"
      closeOnBackdrop={false}
      className="border-2 border-purple-500"
      footer={(
        <>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip saving design"
            className="px-4 py-2 bg-surface-3 rounded hover:bg-surface-4"
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
        </>
      )}
    >
        <p id={descriptionId} className="mb-4 text-fg-secondary">
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
            className="w-full bg-surface-3 px-3 py-2 rounded"
          />
        </div>
    </Modal>
  );
}
