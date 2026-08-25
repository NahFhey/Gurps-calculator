/**
 * CharacterCreationModal
 * Modal for creating new characters with options:
 * - Blank character
 * - From template
 * - Import from file
 */

import { useEffect, useState } from 'react';
import { UserPlus, FileText, Upload, X } from 'lucide-react';
import {
  createBlankCharacter,
  createCharacterFromTemplate,
  CHARACTER_TEMPLATES,
  type CharacterTemplateType,
} from '../../utils/characterManagement';
import type { Character } from '../../types/campaign';
import { CharacterImportFlow } from './CharacterImportFlow';

type CreationStep = 'choose' | 'blank' | 'template' | 'import';

interface CharacterCreationModalProps {
  onClose: () => void;
  onCharacterCreated: (character: Character) => void;
}

export function CharacterCreationModal({
  onClose,
  onCharacterCreated,
}: CharacterCreationModalProps) {
  const [step, setStep] = useState<CreationStep>('choose');
  const [characterName, setCharacterName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<CharacterTemplateType | null>(null);

  const titleId = 'character-creation-modal-title';

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCreateBlank = () => {
    const name = characterName.trim() || 'New Character';
    const character = createBlankCharacter(name);
    onCharacterCreated(character);
    onClose();
  };

  const handleCreateFromTemplate = () => {
    if (!selectedTemplate) return;
    const character = createCharacterFromTemplate(selectedTemplate);
    if (characterName.trim()) {
      character.name = characterName.trim();
    }
    onCharacterCreated(character);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-gray-800 rounded-lg border border-gray-600 w-full m-4 ${
          step === 'import' ? 'max-w-3xl' : 'max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 id={titleId} className="text-lg font-semibold text-gray-100">
            {step === 'choose' && 'Add Character'}
            {step === 'blank' && 'Create Blank Character'}
            {step === 'template' && 'Create from Template'}
            {step === 'import' && 'Import Character'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-200 p-1"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'choose' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setStep('blank')}
                className="w-full flex items-center gap-4 p-4 rounded border border-gray-600 bg-gray-700/50 hover:border-gray-500 hover:bg-gray-700 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                  <UserPlus className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold text-gray-100">Blank Character</div>
                  <div className="text-sm text-gray-400">Start with default attributes</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStep('template')}
                className="w-full flex items-center gap-4 p-4 rounded border border-gray-600 bg-gray-700/50 hover:border-gray-500 hover:bg-gray-700 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-green-500/20 text-green-400">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold text-gray-100">From Template</div>
                  <div className="text-sm text-gray-400">Choose a character archetype</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStep('import')}
                className="w-full flex items-center gap-4 p-4 rounded border border-gray-600 bg-gray-700/50 hover:border-gray-500 hover:bg-gray-700 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold text-gray-100">Import Character</div>
                  <div className="text-sm text-gray-400">Load from GCS text or JSON file</div>
                </div>
              </button>
            </div>
          )}

          {step === 'blank' && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="character-name"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Character Name
                </label>
                <input
                  id="character-name"
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Enter character name"
                  className="w-full px-3 py-2 rounded border border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('choose')}
                  className="flex-1 px-4 py-2 rounded border border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-700"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCreateBlank}
                  className="flex-1 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 font-semibold"
                >
                  Create
                </button>
              </div>
            </div>
          )}

          {step === 'template' && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="template-name"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Character Name (optional)
                </label>
                <input
                  id="template-name"
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Leave blank to use template name"
                  className="w-full px-3 py-2 rounded border border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Template
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {CHARACTER_TEMPLATES.map((template) => (
                    <button
                      key={template.type}
                      type="button"
                      onClick={() => setSelectedTemplate(template.type)}
                      className={`w-full p-3 rounded border text-left transition-colors ${
                        selectedTemplate === template.type
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-100">{template.name}</span>
                        <span className="text-xs text-gray-400">{template.pointValue} pts</span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">{template.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('choose')}
                  className="flex-1 px-4 py-2 rounded border border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-700"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCreateFromTemplate}
                  disabled={!selectedTemplate}
                  className="flex-1 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          )}

          {step === 'import' && (
            <CharacterImportFlow onBack={() => setStep('choose')} onComplete={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}
