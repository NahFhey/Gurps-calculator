import { Skull, X } from 'lucide-react';
import { getConditionIcon } from '../../constants/conditions';
import { compactCharacterStatus } from '../../utils/injuryPersistence';
import { getLocationByKey } from '../../utils/hitLocations';
import type { Character, CharacterStatus } from '../../types/campaign';

interface CharacterStatusEditorProps {
  character: Character;
  onUpdate: (status: CharacterStatus | undefined) => void;
  onClose: () => void;
}

export function CharacterStatusEditor({
  character,
  onUpdate,
  onClose,
}: CharacterStatusEditorProps) {
  const status = character.status;
  const conditions = status?.conditions ?? [];
  const crippled = status?.crippled ?? [];

  const writeStatus = (next: CharacterStatus): void => {
    onUpdate(compactCharacterStatus(next));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="character-status-title"
      data-testid="character-status-editor"
      onClick={onClose}
    >
      <div
        className="m-4 w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="character-status-title" className="text-lg font-semibold text-gray-100">Status</h2>
            <p className="text-sm text-gray-400">{character.name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-200" aria-label="Close status editor">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Conditions</h3>
            {conditions.length === 0 ? (
              <p className="text-sm text-gray-500">No persistent conditions.</p>
            ) : (
              <div className="space-y-1">
                {conditions.map((condition) => (
                  <div key={condition.instanceId} className="flex items-center justify-between rounded bg-gray-900/70 px-3 py-2 text-sm">
                    <span>{getConditionIcon(condition.conditionId)} {condition.label}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${condition.label}`}
                      data-testid={`remove-condition-${condition.instanceId}`}
                      onClick={() => writeStatus({
                        ...status,
                        conditions: conditions.filter(item => item.instanceId !== condition.instanceId),
                      })}
                      className="text-gray-400 hover:text-red-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Crippled limbs</h3>
            {crippled.length === 0 ? (
              <p className="text-sm text-gray-500">No crippled limbs.</p>
            ) : (
              <div className="space-y-1">
                {crippled.map((locationKey) => {
                  const label = getLocationByKey(
                    character.hitLocationProfileId ?? 'humanoid',
                    locationKey
                  )?.label ?? locationKey;
                  return (
                    <div key={locationKey} className="flex items-center justify-between rounded bg-gray-900/70 px-3 py-2 text-sm">
                      <span>🦴 {label}</span>
                      <button
                        type="button"
                        aria-label={`Remove crippled ${label}`}
                        data-testid={`remove-crippled-${locationKey}`}
                        onClick={() => writeStatus({
                          ...status,
                          crippled: crippled.filter(item => item !== locationKey),
                        })}
                        className="text-gray-400 hover:text-red-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <button
            type="button"
            data-testid="toggle-dead-status"
            onClick={() => writeStatus({ ...status, dead: status?.dead === true ? undefined : true })}
            className={`flex w-full items-center justify-center gap-2 rounded px-3 py-2 text-sm font-medium ${
              status?.dead
                ? 'bg-green-700 text-white hover:bg-green-600'
                : 'bg-red-800 text-red-100 hover:bg-red-700'
            }`}
          >
            <Skull className="h-4 w-4" />
            {status?.dead ? 'Mark alive' : 'Mark dead'}
          </button>
        </div>
      </div>
    </div>
  );
}
