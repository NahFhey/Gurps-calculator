/**
 * CharacterCreationModal
 * Modal for creating new characters with options:
 * - Blank character
 * - From template
 * - Import from file
 */

import { useState } from 'react';
import { UserPlus, FileText, Upload, Dices, RefreshCw } from 'lucide-react';
import {
  createBlankCharacter,
  createCharacterFromTemplateEntity,
} from '../../utils/characterManagement';
import { CHARACTER_TEMPLATE_SEEDS } from '../../constants/characterTemplateSeeds';
import { generateNpc, generateNpcName, type NpcVariance } from '../../utils/npcGenerator';
import type { Character, CharacterTemplateEntity } from '../../types/campaign';
import { CharacterImportFlow } from './CharacterImportFlow';
import { Modal } from '../ui/Modal';

type CreationStep = 'choose' | 'blank' | 'template' | 'npc' | 'import';

interface CharacterCreationModalProps {
  onClose: () => void;
  onCharacterCreated: (character: Character) => void;
  templates?: CharacterTemplateEntity[];
  onNpcsGenerated?: (names: string[], templateName: string) => void;
}

export function CharacterCreationModal({
  onClose,
  onCharacterCreated,
  templates = CHARACTER_TEMPLATE_SEEDS,
  onNpcsGenerated,
}: CharacterCreationModalProps) {
  const [step, setStep] = useState<CreationStep>('choose');
  const [characterName, setCharacterName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [npcCount, setNpcCount] = useState(1);
  const [npcVariance, setNpcVariance] = useState<NpcVariance>('light');
  const [npcPreview, setNpcPreview] = useState<Character[]>([]);

  const title = step === 'choose' ? 'Add Character'
    : step === 'blank' ? 'Create Blank Character'
    : step === 'template' ? 'Create from Template'
    : step === 'npc' ? 'Generate NPCs'
    : 'Import Character';

  const handleCreateBlank = () => {
    const name = characterName.trim() || 'New Character';
    const character = createBlankCharacter(name);
    onCharacterCreated(character);
    onClose();
  };

  const handleCreateFromTemplate = () => {
    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
    if (!selectedTemplate) return;
    const character = createCharacterFromTemplateEntity(
      selectedTemplate,
      characterName.trim() || `New ${selectedTemplate.name}`
    );
    onCharacterCreated(character);
    onClose();
  };

  const handleGenerateNpcs = () => {
    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
    if (!selectedTemplate) return;
    setNpcPreview(Array.from({ length: npcCount }, () => generateNpc(selectedTemplate, npcVariance, Math.random)));
  };

  const handleAddNpcs = () => {
    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
    if (!selectedTemplate || npcPreview.length === 0) return;
    npcPreview.forEach(onCharacterCreated);
    onNpcsGenerated?.(npcPreview.map((npc) => npc.name), selectedTemplate.name);
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
      size={step === 'import' || step === 'template' || step === 'npc' ? 'xl' : 'md'}
      closeOnBackdrop={false}
      className="border-edge-strong"
    >
          {step === 'choose' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setStep('blank')}
                className="w-full flex items-center gap-4 p-4 rounded border border-edge-strong bg-surface-2/50 hover:border-edge-bright hover:bg-surface-2 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-accent-500/20 text-accent-400">
                  <UserPlus className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold text-fg-bright">Blank Character</div>
                  <div className="text-sm text-fg-muted">Start with default attributes</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStep('npc')}
                className="w-full flex items-center gap-4 p-4 rounded border border-edge-strong bg-surface-2/50 hover:border-edge-bright hover:bg-surface-2 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-warning-500/20 text-warning-400"><Dices className="h-6 w-6" /></div>
                <div><div className="font-semibold text-fg-bright">Generate NPC</div><div className="text-sm text-fg-muted">Create one or more varied non-player characters</div></div>
              </button>

              <button
                type="button"
                onClick={() => setStep('template')}
                className="w-full flex items-center gap-4 p-4 rounded border border-edge-strong bg-surface-2/50 hover:border-edge-bright hover:bg-surface-2 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-success-500/20 text-success-400">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold text-fg-bright">From Template</div>
                  <div className="text-sm text-fg-muted">Choose a character archetype</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStep('import')}
                className="w-full flex items-center gap-4 p-4 rounded border border-edge-strong bg-surface-2/50 hover:border-edge-bright hover:bg-surface-2 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold text-fg-bright">Import Character</div>
                  <div className="text-sm text-fg-muted">Load from GCS text or JSON file</div>
                </div>
              </button>
            </div>
          )}

          {step === 'blank' && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="character-name"
                  className="block text-sm font-medium text-fg-secondary mb-2"
                >
                  Character Name
                </label>
                <input
                  id="character-name"
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Enter character name"
                  className="w-full px-3 py-2 rounded border border-edge-strong bg-surface-2 text-fg-bright placeholder-fg-faint focus:border-accent-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('choose')}
                  className="flex-1 px-4 py-2 rounded border border-edge-strong text-fg-secondary hover:border-edge-bright hover:bg-surface-2"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCreateBlank}
                  className="flex-1 px-4 py-2 rounded bg-accent-600 text-white hover:bg-accent-500 font-semibold"
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
                  className="block text-sm font-medium text-fg-secondary mb-2"
                >
                  Character Name (optional)
                </label>
                <input
                  id="template-name"
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Leave blank to use template name"
                  className="w-full px-3 py-2 rounded border border-edge-strong bg-surface-2 text-fg-bright placeholder-fg-faint focus:border-accent-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-2">
                  Select Template
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={`w-full p-3 rounded border text-left transition-colors ${
                        selectedTemplateId === template.id
                          ? 'border-accent-500 bg-accent-500/10'
                          : 'border-edge-strong bg-surface-2/50 hover:border-edge-bright'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-fg-bright">{template.name}</span>
                        <span className="text-xs text-fg-muted">{template.gcsData.totalPoints} pts</span>
                      </div>
                      <div className="text-sm text-fg-muted mt-1">{template.description}</div>
                    </button>
                  ))}
                  </div>
                  {(() => {
                    const template = templates.find((entry) => entry.id === selectedTemplateId);
                    if (!template) return <div className="rounded border border-dashed border-edge-strong p-4 text-sm text-fg-faint">Select a template to preview its build.</div>;
                    const data = template.gcsData;
                    return (
                      <div data-testid="template-preview" className="rounded border border-edge-strong bg-surface-0/60 p-4 text-sm text-fg-secondary">
                        <div className="font-semibold text-fg-bright">{template.name} · {data.totalPoints} pts</div>
                        <div className="mt-2">ST {data.attributes.ST} · DX {data.attributes.DX} · IQ {data.attributes.IQ} · HT {data.attributes.HT}</div>
                        <div className="mt-3 font-medium text-fg-primary">Skills</div>
                        <div>{data.skills.map((skill) => `${skill.name} ${skill.level}`).join(', ')}</div>
                        <div className="mt-3 font-medium text-fg-primary">Traits</div>
                        <div>{[...data.advantages, ...data.disadvantages].map((trait) => `${trait.name} (${trait.points})`).join(', ')}</div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('choose')}
                  className="flex-1 px-4 py-2 rounded border border-edge-strong text-fg-secondary hover:border-edge-bright hover:bg-surface-2"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCreateFromTemplate}
                  disabled={!selectedTemplateId}
                  className="flex-1 px-4 py-2 rounded bg-accent-600 text-white hover:bg-accent-500 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          )}

          {step === 'npc' && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm text-fg-secondary">Template
                  <select aria-label="NPC template" value={selectedTemplateId ?? ''} onChange={(event) => { setSelectedTemplateId(event.target.value || null); setNpcPreview([]); }} className="mt-1 w-full rounded border border-edge-strong bg-surface-2 px-3 py-2">
                    <option value="">Select template</option>
                    {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                  </select>
                </label>
                <label className="text-sm text-fg-secondary">Count
                  <input aria-label="NPC count" type="number" min={1} max={5} value={npcCount} onChange={(event) => { setNpcCount(Math.max(1, Math.min(5, Number(event.target.value) || 1))); setNpcPreview([]); }} className="mt-1 w-full rounded border border-edge-strong bg-surface-2 px-3 py-2" />
                </label>
                <label className="text-sm text-fg-secondary">Variance
                  <select aria-label="NPC variance" value={npcVariance} onChange={(event) => { setNpcVariance(event.target.value as NpcVariance); setNpcPreview([]); }} className="mt-1 w-full rounded border border-edge-strong bg-surface-2 px-3 py-2">
                    <option value="none">None</option><option value="light">Light</option><option value="heavy">Heavy</option>
                  </select>
                </label>
              </div>
              <button type="button" onClick={handleGenerateNpcs} disabled={!selectedTemplateId} className="rounded bg-warning-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Generate</button>
              {npcPreview.length > 0 && (
                <div data-testid="npc-preview-list" className="space-y-2">
                  {npcPreview.map((npc, index) => (
                    <div key={npc.id} className="flex flex-wrap items-center gap-3 rounded border border-edge-strong bg-surface-0/60 p-3">
                      <input aria-label={`NPC ${index + 1} name`} value={npc.name} onChange={(event) => setNpcPreview((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, name: event.target.value } : entry))} className="min-w-48 flex-1 rounded border border-edge-strong bg-surface-2 px-2 py-1" />
                      <button data-testid="reroll-name-button" type="button" aria-label={`Reroll ${npc.name}`} onClick={() => setNpcPreview((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, name: generateNpcName(Math.random) } : entry))} className="rounded p-2 text-warning-400 hover:bg-surface-2"><RefreshCw className="h-4 w-4" /></button>
                      <span className="text-xs text-fg-muted">ST {npc.gcsData?.attributes.ST} · DX {npc.gcsData?.attributes.DX} · IQ {npc.gcsData?.attributes.IQ} · HT {npc.gcsData?.attributes.HT} · {npc.gcsData?.totalPoints} pts</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setStep('choose'); setNpcPreview([]); }} className="flex-1 rounded border border-edge-strong px-4 py-2 text-fg-secondary">Back</button>
                <button type="button" onClick={handleAddNpcs} disabled={npcPreview.length === 0} className="flex-1 rounded bg-accent-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Add {npcPreview.length || npcCount} character{(npcPreview.length || npcCount) === 1 ? '' : 's'}</button>
              </div>
            </div>
          )}

          {step === 'import' && (
            <CharacterImportFlow onBack={() => setStep('choose')} onComplete={onClose} />
          )}
    </Modal>
  );
}
