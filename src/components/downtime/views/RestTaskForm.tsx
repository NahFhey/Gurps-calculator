import { useMemo, useState } from 'react';
import { Bed, X } from 'lucide-react';
import type { Character } from '../../../types/campaign';
import type { DowntimeState, RestData } from '../../../types/downtime';
import type { CreateTaskPayload } from '../../../state/downtime/downtimeActions';
import type { ValidationResult } from '../../../state/downtime/downtimeErrors';
import { selectAvailableCharacterIdsForSlot } from '../../../state/downtime/downtimeSelectors';
import { getPhysicianLevel } from '../../../utils/recovery';
import { useOptionalDowntimeContext } from '../DowntimeContext';
import { ValidationError } from './shared/ValidationError';

interface RestTaskFormProps {
  characters: Character[];
  state: DowntimeState;
  currentDayKey: number;
  currentSlot: number;
  onSubmit: (data: { leaderId: string; helperIds: string[]; activityData: RestData }) => void;
  onSubmitBatch?: (payloads: CreateTaskPayload[]) => ValidationResult[];
  onCancel: () => void;
}

export function RestTaskForm({
  characters,
  state,
  currentDayKey,
  currentSlot,
  onSubmit,
  onSubmitBatch,
  onCancel,
}: RestTaskFormProps) {
  const downtimeContext = useOptionalDowntimeContext();
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [leaderId, setLeaderId] = useState('');
  const [batchLeaderIds, setBatchLeaderIds] = useState<string[]>([]);
  const [restType, setRestType] = useState<RestData['restType']>('sleep');
  const [recoveryBonus, setRecoveryBonus] = useState(0);
  const [healerId, setHealerId] = useState('');
  const [batchErrors, setBatchErrors] = useState<Record<string, ValidationResult>>({});

  const availableCharacters = useMemo(() => {
    const availableIds = selectAvailableCharacterIdsForSlot(
      state,
      currentDayKey,
      currentSlot,
      characters.map((character) => character.id)
    );
    return characters.filter((character) => availableIds.includes(character.id));
  }, [characters, currentDayKey, currentSlot, state]);

  const physicians = useMemo(
    () => characters.filter((character) =>
      getPhysicianLevel(character) > 0 && (isBatchMode || character.id !== leaderId)
    ),
    [characters, isBatchMode, leaderId]
  );

  const handleSubmit = () => {
    const activityData: RestData = {
      type: 'rest',
      restType,
      recoveryBonus,
      healerId: healerId && healerId !== leaderId ? healerId : null,
    };

    if (!isBatchMode) {
      if (!leaderId) return;
      onSubmit({ leaderId, helperIds: [], activityData });
      return;
    }

    if (batchLeaderIds.length === 0) return;
    const payloads: CreateTaskPayload[] = batchLeaderIds.map((batchLeaderId) => ({
      activityType: 'rest',
      dayKey: currentDayKey,
      slot: currentSlot,
      leaderId: batchLeaderId,
      helperIds: [],
      activityData: {
        ...activityData,
        healerId: batchLeaderId === healerId ? null : activityData.healerId,
      },
    }));
    const results = onSubmitBatch?.(payloads)
      ?? downtimeContext?.createDowntimeTasksBatch(payloads)
      ?? payloads.map(() => ({ valid: false, message: 'Batch submission is unavailable' }));
    const nextErrors: Record<string, ValidationResult> = {};
    results.forEach((result, index) => {
      const rowId = batchLeaderIds[index];
      if (!result.valid && rowId) nextErrors[rowId] = result;
    });
    setBatchErrors(nextErrors);
    if (results.every((result) => result.valid)) onCancel();
  };

  const isValid = isBatchMode ? batchLeaderIds.length > 0 : Boolean(leaderId);

  return (
    <div className="rest-task-form rounded-lg border border-gray-700 bg-gray-800/60 p-4" data-testid="rest-task-form">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-medium text-gray-100">
          <Bed className="h-4 w-4 text-indigo-400" />
          New Rest Task
        </h3>
        <button type="button" onClick={onCancel} aria-label="Close form" className="text-gray-400 hover:text-gray-200">
          <X className="h-5 w-5" />
        </button>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={isBatchMode}
          onChange={(event) => {
            setIsBatchMode(event.target.checked);
            setBatchErrors({});
          }}
          data-testid="batch-assign-toggle"
          className="rounded border-gray-600 bg-gray-900 text-indigo-600 focus:ring-indigo-500"
        />
        Batch assign
      </label>

      {!isBatchMode ? (
        <div className="mb-3">
          <label htmlFor="rest-leader-select" className="mb-1 block text-sm font-medium text-gray-300">Leader</label>
          <select
            id="rest-leader-select"
            value={leaderId}
            onChange={(event) => setLeaderId(event.target.value)}
            data-testid="leader-select"
            className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          >
            <option value="">Select a leader...</option>
            {availableCharacters.map((character) => (
              <option key={character.id} value={character.id}>{character.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mb-3">
          <label htmlFor="rest-batch-leaders" className="mb-1 block text-sm font-medium text-gray-300">Leaders</label>
          <select
            id="rest-batch-leaders"
            multiple
            value={batchLeaderIds}
            onChange={(event) => {
              setBatchLeaderIds(Array.from(event.currentTarget.selectedOptions, (option) => option.value));
              setBatchErrors({});
            }}
            data-testid="batch-leader-select"
            className="min-h-24 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          >
            {availableCharacters.map((character) => (
              <option key={character.id} value={character.id}>{character.name}</option>
            ))}
          </select>
          <div className="mt-3 space-y-2">
            {batchLeaderIds.map((characterId) => {
              const character = characters.find((candidate) => candidate.id === characterId);
              const error = batchErrors[characterId];
              return (
                <div key={characterId} className="rounded border border-gray-700 bg-gray-900/40 p-3" data-testid={`batch-row-${characterId}`}>
                  <p className="text-sm font-medium text-gray-200">{character?.name ?? characterId}</p>
                  {error && (
                    <ValidationError
                      code={error.code ?? 'UNKNOWN_ERROR'}
                      message={error.message ?? 'Validation failed'}
                      meta={error.meta}
                      className="mt-2"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-3">
        <label htmlFor="rest-type-select" className="mb-1 block text-sm font-medium text-gray-300">Rest type</label>
        <select
          id="rest-type-select"
          value={restType}
          onChange={(event) => setRestType(event.target.value as RestData['restType'])}
          className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        >
          <option value="sleep">Sleep</option>
          <option value="light_rest">Light rest</option>
          <option value="meditation">Meditation</option>
        </select>
      </div>

      <div className="mb-3">
        <label htmlFor="healer-select" className="mb-1 block text-sm font-medium text-gray-300">Healer</label>
        {physicians.length > 0 ? (
          <select
            id="healer-select"
            value={physicians.some((physician) => physician.id === healerId) ? healerId : ''}
            onChange={(event) => setHealerId(event.target.value)}
            data-testid="healer-select"
            className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          >
            <option value="">No healer</option>
            {physicians.map((physician) => (
              <option key={physician.id} value={physician.id}>
                {physician.name} (Physician-{getPhysicianLevel(physician)})
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-gray-500">No physician in party</p>
        )}
      </div>

      <div className="mb-4">
        <label htmlFor="recovery-bonus" className="mb-1 block text-sm font-medium text-gray-300">Recovery bonus</label>
        <input
          id="recovery-bonus"
          type="number"
          value={recoveryBonus}
          onChange={(event) => setRecoveryBonus(Number(event.target.value))}
          className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid}
          data-testid="submit-button"
          className={`rounded px-4 py-2 text-sm font-medium ${
            isValid ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'cursor-not-allowed bg-gray-700 text-gray-500'
          }`}
        >
          Create {isBatchMode ? 'Tasks' : 'Task'}
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
          Cancel
        </button>
      </div>
    </div>
  );
}
