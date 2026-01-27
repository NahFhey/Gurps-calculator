/**
 * CharacterCreationModal
 * Modal for creating new characters with options:
 * - Blank character
 * - From template
 * - Import from file
 */

import { useState, useRef, ChangeEvent } from 'react';
import { UserPlus, FileText, Upload, X } from 'lucide-react';
import {
  createBlankCharacter,
  createCharacterFromTemplate,
  importCharacterJSON,
  CHARACTER_TEMPLATES,
  type CharacterTemplateType,
} from '../../utils/characterManagement';
import { parseCharacterText } from '../../utils/characterImport';
import type { Character } from '../../types/campaign';

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
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        setImportError('Failed to read file');
        return;
      }

      try {
        let character: Character;

        // Try JSON first, then text format
        if (file.name.endsWith('.json')) {
          character = importCharacterJSON(content);
        } else {
          character = parseCharacterText(content);
        }

        onCharacterCreated(character);
        onClose();
      } catch (error) {
        console.error('Import error:', error);
        setImportError(
          error instanceof Error
            ? error.message
            : 'Failed to parse character file. Please check the format.'
        );
      }
    };

    reader.onerror = () => {
      setImportError('Failed to read file');
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div
        className="bg-gray-800 rounded-lg border border-gray-600 w-full max-w-md m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">
            {step === 'choose' && 'Add Character'}
            {step === 'blank' && 'Create Blank Character'}
            {step === 'template' && 'Create from Template'}
            {step === 'import' && 'Import Character'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 p-1"
          >
            <X className="h-5 w-5" />
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
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.gcs,.json"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleFileSelect}
                  className="inline-flex flex-col items-center gap-2 p-8 rounded-lg border-2 border-dashed border-gray-600 hover:border-gray-500 hover:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  <Upload className="h-10 w-10 text-gray-400" />
                  <span className="text-gray-300">Click to select a file</span>
                  <span className="text-xs text-gray-500">
                    Supports .txt (GCS text), .gcs, or .json formats
                  </span>
                </button>
              </div>

              {importError && (
                <div className="p-3 rounded border border-red-500/50 bg-red-500/10 text-red-300 text-sm">
                  {importError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('choose');
                    setImportError(null);
                  }}
                  className="flex-1 px-4 py-2 rounded border border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-700"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
