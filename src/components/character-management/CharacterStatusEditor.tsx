import { Skull, X } from 'lucide-react';
import { getConditionIcon } from '../../constants/conditions';
import { compactCharacterStatus } from '../../utils/injuryPersistence';
import { getLocationByKey } from '../../utils/hitLocations';
import type { Character, CharacterStatus } from '../../types/campaign';
import { Modal } from '../ui/Modal';

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
    <Modal
      isOpen
      onClose={onClose}
      title={<span className="block">Status <span className="block text-sm font-normal text-fg-muted">{character.name}</span></span>}
      size="md"
      bodyClassName="p-5"
    >
        <div className="space-y-4" data-testid="character-status-editor">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Conditions</h3>
            {conditions.length === 0 ? (
              <p className="text-sm text-fg-faint">No persistent conditions.</p>
            ) : (
              <div className="space-y-1">
                {conditions.map((condition) => (
                  <div key={condition.instanceId} className="flex items-center justify-between rounded bg-surface-0/70 px-3 py-2 text-sm">
                    <span>{getConditionIcon(condition.conditionId)} {condition.label}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${condition.label}`}
                      data-testid={`remove-condition-${condition.instanceId}`}
                      onClick={() => writeStatus({
                        ...status,
                        conditions: conditions.filter(item => item.instanceId !== condition.instanceId),
                      })}
                      className="text-fg-muted hover:text-danger-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Crippled limbs</h3>
            {crippled.length === 0 ? (
              <p className="text-sm text-fg-faint">No crippled limbs.</p>
            ) : (
              <div className="space-y-1">
                {crippled.map((locationKey) => {
                  const label = getLocationByKey(
                    character.hitLocationProfileId ?? 'humanoid',
                    locationKey
                  )?.label ?? locationKey;
                  return (
                    <div key={locationKey} className="flex items-center justify-between rounded bg-surface-0/70 px-3 py-2 text-sm">
                      <span>🦴 {label}</span>
                      <button
                        type="button"
                        aria-label={`Remove crippled ${label}`}
                        data-testid={`remove-crippled-${locationKey}`}
                        onClick={() => writeStatus({
                          ...status,
                          crippled: crippled.filter(item => item !== locationKey),
                        })}
                        className="text-fg-muted hover:text-danger-300"
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
                ? 'bg-success-700 text-white hover:bg-success-600'
                : 'bg-danger-800 text-danger-100 hover:bg-danger-700'
            }`}
          >
            <Skull className="h-4 w-4" />
            {status?.dead ? 'Mark alive' : 'Mark dead'}
          </button>
        </div>
    </Modal>
  );
}
