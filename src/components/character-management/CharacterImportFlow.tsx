import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import { useCampaignStore } from '../../state/campaignStore';
import type { Character } from '../../types/campaign';
import { diffCharacters } from '../../utils/characterDiff';
import { parsePartyText, splitPartyTextBlocks } from '../../utils/characterImport';
import {
  getCharacterTextSections,
  getNonEmptyCharacterTextSections,
  validateCharacterText,
} from '../../utils/characterImportValidation';
import type {
  CharacterTextSection,
  ImportValidationResult,
} from '../../utils/characterImportValidation';
import { buildCharacterImportUpdate } from '../../utils/characterImportUpdate';
import { importCharactersJSON } from '../../utils/characterManagement';
import { CharacterBatchPreview } from './CharacterBatchPreview';
import { CharacterDiffPreview } from './CharacterDiffPreview';

type ImportStage = 'select' | 'single-new' | 'single-match' | 'update-preview' | 'batch';

interface PendingImport {
  key: string;
  character: Character;
  existing?: Character;
  source: 'text' | 'json';
  presentSections?: ReadonlySet<CharacterTextSection>;
  nonEmptySections?: ReadonlySet<CharacterTextSection>;
}

interface CharacterImportFlowProps {
  onBack: () => void;
  onComplete: () => void;
}

export function CharacterImportFlow({ onBack, onComplete }: CharacterImportFlowProps) {
  const { state, actions } = useCampaignStore();
  const characters = Object.values(state.entities.characters);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<ImportStage>('select');
  const [pending, setPending] = useState<PendingImport[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [validation, setValidation] = useState<ImportValidationResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const resetImport = () => {
    setStage('select');
    setPending([]);
    setSelectedKeys(new Set());
    setValidation(null);
    setImportError(null);
  };

  const matchExisting = (character: Character): Character | undefined => {
    const normalizedName = character.name.trim().toLocaleLowerCase();
    return characters.find((candidate) => candidate.name.trim().toLocaleLowerCase() === normalizedName);
  };

  const prepareItems = (
    imported: Character[],
    source: 'text' | 'json',
    sectionSets: Array<ReadonlySet<CharacterTextSection> | undefined> = [],
    nonEmptySectionSets: Array<ReadonlySet<CharacterTextSection> | undefined> = []
  ) => {
    const items = imported.map((character, index): PendingImport => ({
      key: character.id,
      character,
      existing: matchExisting(character),
      source,
      presentSections: sectionSets[index],
      nonEmptySections: nonEmptySectionSets[index],
    }));
    setPending(items);
    setSelectedKeys(new Set(items.map((item) => item.key)));

    if (items.length > 1) setStage('batch');
    else if (items[0]?.existing) setStage('single-match');
    else setStage('single-new');
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setValidation(null);
    setPending([]);

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const content = loadEvent.target?.result;
      if (typeof content !== 'string') {
        setImportError('Failed to read file');
        return;
      }

      try {
        if (file.name.toLocaleLowerCase().endsWith('.json')) {
          prepareItems(importCharactersJSON(content), 'json');
          return;
        }

        const result = validateCharacterText(content);
        setValidation(result);
        if (!result.ok) {
          setStage('select');
          return;
        }

        const blocks = splitPartyTextBlocks(content);
        const sectionSets = blocks.map(getCharacterTextSections);
        const nonEmptySectionSets = blocks.map(getNonEmptyCharacterTextSections);
        prepareItems(parsePartyText(content), 'text', sectionSets, nonEmptySectionSets);
      } catch (error) {
        console.error('Import error:', error);
        setImportError(
          error instanceof Error
            ? error.message
            : 'Failed to parse character file. Please check the format.'
        );
        setStage('select');
      }
    };
    reader.onerror = () => setImportError('Failed to read file');
    reader.readAsText(file);
    event.target.value = '';
  };

  const addPendingCharacter = (item: PendingImport) => {
    actions.addCharacter(item.character);
    actions.selectCharacter(item.character.id);
    onComplete();
  };

  const updatePendingCharacter = (item: PendingImport) => {
    if (!item.existing) return;
    const changes = buildCharacterImportUpdate(item.existing, item.character, {
      source: item.source,
      presentSections: item.presentSections,
      nonEmptySections: item.nonEmptySections,
    });
    actions.updateCharacter(item.existing.id, changes);
    actions.selectCharacter(item.existing.id);
    onComplete();
  };

  const importSelected = () => {
    for (const item of pending) {
      if (!selectedKeys.has(item.key)) continue;
      if (item.existing) {
        const changes = buildCharacterImportUpdate(item.existing, item.character, {
          source: item.source,
          presentSections: item.presentSections,
          nonEmptySections: item.nonEmptySections,
        });
        actions.updateCharacter(item.existing.id, changes);
      } else {
        actions.addCharacter(item.character);
      }
    }
    onComplete();
  };

  const singleItem = pending[0];
  const singleExisting = singleItem?.existing;
  const updateChanges = singleItem && singleExisting
    ? buildCharacterImportUpdate(singleExisting, singleItem.character, {
        source: singleItem.source,
        presentSections: singleItem.presentSections,
        nonEmptySections: singleItem.nonEmptySections,
      })
    : undefined;
  const updateCandidate = singleExisting && updateChanges
    ? { ...singleExisting, ...updateChanges }
    : undefined;
  const updateDiff = singleExisting && updateCandidate
    ? diffCharacters(singleExisting, updateCandidate)
    : undefined;

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.gcs,.json"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Character import file"
      />

      {stage === 'select' && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-600 p-8 transition-colors hover:border-indigo-400 hover:bg-slate-700/50"
          >
            <Upload className="h-10 w-10 text-slate-400" />
            <span className="text-slate-300">Click to select a file</span>
            <span className="text-xs text-slate-500">Supports .txt (GCS text), .gcs, or .json formats</span>
          </button>
        </div>
      )}

      {validation && validation.errors.length > 0 && (
        <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
          <div className="mb-1 font-semibold">Import blocked</div>
          <ul className="list-disc space-y-1 pl-5">
            {validation.errors.map((issue, index) => (
              <li key={`${issue.line ?? 'general'}-${index}`}>
                {issue.line ? `Line ${issue.line}: ` : ''}{issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {validation && validation.warnings.length > 0 && (
        <details className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          <summary className="cursor-pointer font-medium">
            Warnings ({validation.warnings.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-200">
            {validation.warnings.map((issue, index) => (
              <li key={`${issue.section ?? issue.line ?? 'warning'}-${index}`}>
                {issue.line ? `Line ${issue.line}: ` : ''}{issue.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      {importError && (
        <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300" role="alert">
          {importError}
        </div>
      )}

      {stage === 'single-new' && singleItem && (
        <div className="space-y-4">
          <div className="rounded border border-slate-600 bg-slate-800/60 p-4">
            <div className="font-semibold text-slate-100">{singleItem.character.name}</div>
            <div className="text-sm text-slate-400">{singleItem.character.gcsData?.totalPoints ?? 0} points · new character</div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={resetImport} className="flex-1 rounded border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-700">
              Cancel
            </button>
            <button type="button" onClick={() => addPendingCharacter(singleItem)} className="flex-1 rounded bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500">
              Import character
            </button>
          </div>
        </div>
      )}

      {stage === 'single-match' && singleItem && singleExisting && (
        <div className="space-y-4">
          <div className="rounded border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
            A character named <span className="font-semibold">{singleExisting.name}</span> already exists.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => addPendingCharacter(singleItem)} className="rounded border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-700">
              Create as new
            </button>
            <button type="button" onClick={() => setStage('update-preview')} className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500">
              Update existing
            </button>
          </div>
          <button type="button" onClick={resetImport} className="w-full text-sm text-slate-400 hover:text-slate-200">Cancel</button>
        </div>
      )}

      {stage === 'update-preview' && singleItem && singleExisting && updateDiff && (
        <div className="space-y-4">
          <div className="max-h-[55vh] overflow-y-auto rounded border border-slate-600 bg-slate-900/40 p-4">
            <CharacterDiffPreview diff={updateDiff} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setStage('single-match')} className="flex-1 rounded border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-700">Cancel</button>
            <button type="button" onClick={() => updatePendingCharacter(singleItem)} className="flex-1 rounded bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500">Confirm update</button>
          </div>
        </div>
      )}

      {stage === 'batch' && (
        <CharacterBatchPreview
          rows={pending.map((item) => ({
            key: item.key,
            character: item.character,
            existing: item.existing,
            selected: selectedKeys.has(item.key),
          }))}
          onToggle={(key) => setSelectedKeys((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
          })}
          onImport={importSelected}
          onCancel={resetImport}
        />
      )}

      {stage === 'select' && (
        <button
          type="button"
          onClick={onBack}
          className="w-full rounded border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-700"
        >
          Back
        </button>
      )}
    </div>
  );
}
