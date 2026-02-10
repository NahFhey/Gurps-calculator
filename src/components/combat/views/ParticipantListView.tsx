import { useState, memo, ChangeEvent, KeyboardEvent } from 'react';
import { calculateHPStatus } from '../../../utils/combatHelpers';
import { getActiveEffects } from '../../../utils/effectsEngine';
import { getActiveConditions } from '../../../utils/conditionsEngine';
import ConditionBadge from '../ConditionBadge';
import type {
  ParticipantListViewProps,
  ParticipantCardProps,
  Participant,
  HPValue,
  FPValue,
  MPValue,
  ConditionInstance
} from '../../../types/combatTracker';

/**
 * ParticipantListView - List of combat participants
 *
 * Displays all participants with their current status.
 * Each participant is rendered as a ParticipantCard with
 * editable resources (HP, FP, MP).
 */
function ParticipantListViewBase({
  participants,
  currentActorInstanceId,
  viewMode,
  onUpdateResource,
  selectedParticipantId,
  onSelectParticipant,
}: ParticipantListViewProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Participants</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {participants.map(p => (
          <ParticipantCard
            key={p.instanceId}
            participant={p}
            viewMode={viewMode}
            isCurrent={p.instanceId === currentActorInstanceId}
            onUpdateResource={onUpdateResource}
            isSelected={p.instanceId === selectedParticipantId}
            onClick={() => onSelectParticipant?.(
              p.instanceId === selectedParticipantId ? null : p.instanceId
            )}
          />
        ))}
      </div>
    </div>
  );
}

export const ParticipantListView = memo(ParticipantListViewBase);

// ============================================================================
// ParticipantCard Component
// ============================================================================

/**
 * Participant Card Component - Phase 5 compatible
 * Shows participant status with editable resources
 * Handles both truth state (GM View) and filtered state (Player View)
 * Memoized to prevent re-renders when sibling participants change
 */
function ParticipantCardBase({ participant, isCurrent, onUpdateResource, viewMode, isSelected, onClick }: ParticipantCardProps) {
  const [editing, setEditing] = useState<string | null>(null); // 'HP', 'FP', or 'MP'
  const [editValue, setEditValue] = useState('');

  // Phase 5: Extract values based on data structure (truth vs filtered)
  const getHPValues = (): { mode: string; current?: number; max?: number; band?: string; bandText?: string } => {
    if (participant.hp && typeof participant.hp === 'object') {
      // Filtered state
      return {
        mode: (participant.hp as HPValue).mode,
        current: (participant.hp as HPValue).current,
        max: (participant.hp as HPValue).max,
        band: (participant.hp as HPValue).band,
        bandText: (participant.hp as HPValue).bandText
      };
    }
    // Truth state (backward compat)
    return {
      mode: 'exact',
      current: participant.currentHP,
      max: (participant.hp as number) || participant.maxHP
    };
  };

  const getFPValues = (): { mode: string; current?: number; max?: number } => {
    if (participant.fp && typeof participant.fp === 'object') {
      return {
        mode: (participant.fp as FPValue).mode,
        current: (participant.fp as FPValue).current,
        max: (participant.fp as FPValue).max
      };
    }
    return {
      mode: 'exact',
      current: participant.currentFP,
      max: (participant.fp as number) || participant.maxFP
    };
  };

  const getMPValues = (): { mode: string; current?: number; max?: number } => {
    if (participant.mp && typeof participant.mp === 'object') {
      return {
        mode: (participant.mp as MPValue).mode,
        current: (participant.mp as MPValue).current,
        max: (participant.mp as MPValue).max
      };
    }
    return {
      mode: 'exact',
      current: participant.currentMP,
      max: (participant.mp as number) || participant.maxMP
    };
  };

  const hp = getHPValues();
  const fp = getFPValues();
  const mp = getMPValues();

  const hpStatus = hp.mode === 'exact'
    ? calculateHPStatus(hp.current, hp.max)
    : (hp.band || 'unknown');

  const getHPStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'injured': return 'text-yellow-400';
      case 'critical': return 'text-orange-400';
      case 'dead': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const startEdit = (resource: string) => {
    // Only allow editing if we have exact values (not hidden/unknown)
    let currentValue: number | undefined;
    if (resource === 'HP' && hp.mode === 'exact') {
      currentValue = hp.current;
    } else if (resource === 'FP' && fp.mode === 'exact') {
      currentValue = fp.current;
    } else if (resource === 'MP' && mp.mode === 'exact') {
      currentValue = mp.current;
    } else {
      return; // Can't edit hidden/unknown values
    }

    setEditing(resource);
    setEditValue(currentValue?.toString() || '0');
  };

  const saveEdit = () => {
    if (editing) {
      const newValue = parseInt(editValue) || 0;
      onUpdateResource(participant.instanceId, editing, newValue);
      setEditing(null);
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  return (
    <div
      className={`bg-gray-800 rounded p-3 ${isCurrent ? 'border-2 border-blue-500' : ''} ${isSelected ? 'ring-2 ring-white' : ''}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-semibold">{participant.name}</h4>
          <p className="text-xs text-gray-400">{participant.category}</p>
        </div>
        <span className={`text-xs font-semibold ${getHPStatusColor(hpStatus)}`}>
          {hpStatus.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        {/* HP */}
        <div>
          <div className="text-xs text-gray-400">HP</div>
          {hp.mode === 'unknown' ? (
            <div className="text-gray-500 italic">Unknown</div>
          ) : hp.mode === 'band' ? (
            <div className="text-yellow-400">{hp.bandText}</div>
          ) : editing === 'HP' ? (
            <input
              type="number"
              value={editValue}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyPress={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              className="w-full px-1 py-0.5 bg-gray-600 rounded text-sm"
              autoFocus
            />
          ) : (
            <div
              onClick={() => startEdit('HP')}
              className="cursor-pointer hover:bg-gray-700 px-1 rounded"
            >
              {hp.current}/{hp.max}
            </div>
          )}
        </div>

        {/* FP */}
        <div>
          <div className="text-xs text-gray-400">FP</div>
          {fp.mode === 'unknown' ? (
            <div className="text-gray-500 italic">Unknown</div>
          ) : editing === 'FP' ? (
            <input
              type="number"
              value={editValue}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyPress={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              className="w-full px-1 py-0.5 bg-gray-600 rounded text-sm"
              autoFocus
            />
          ) : (
            <div
              onClick={() => startEdit('FP')}
              className="cursor-pointer hover:bg-gray-700 px-1 rounded"
            >
              {fp.current}/{fp.max}
            </div>
          )}
        </div>

        {/* MP */}
        {(mp.max || 0) > 0 && (
          <div>
            <div className="text-xs text-gray-400">MP</div>
            {mp.mode === 'unknown' ? (
              <div className="text-gray-500 italic">Unknown</div>
            ) : editing === 'MP' ? (
              <input
                type="number"
                value={editValue}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyPress={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') saveEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
                className="w-full px-1 py-0.5 bg-gray-600 rounded text-sm"
                autoFocus
              />
            ) : (
              <div
                onClick={() => startEdit('MP')}
                className="cursor-pointer hover:bg-gray-700 px-1 rounded"
              >
                {mp.current}/{mp.max}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phase 4: Status Effects */}
      {(() => {
        const effects = getActiveEffects(participant) as string[];
        if (effects.length === 0) return null;
        return (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Effects:</div>
            <div className="flex flex-wrap gap-1">
              {effects.map((effect, index) => (
                <span
                  key={index}
                  className="text-xs px-2 py-0.5 bg-red-900/50 text-red-300 rounded"
                >
                  {effect}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Phase 6: Conditions */}
      {(() => {
        const conditions = getActiveConditions(participant) as ConditionInstance[];
        if (conditions.length === 0) return null;
        return (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Conditions:</div>
            <div className="flex flex-wrap gap-1">
              {conditions.map(condition => (
                <ConditionBadge
                  key={condition.instanceId}
                  condition={condition}
                  currentRound={participant.currentRound || 0}
                  showDuration={true}
                />
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/**
 * Custom comparison for ParticipantCard memoization
 * Prevents re-renders when participant data hasn't meaningfully changed
 */
const areParticipantPropsEqual = (prevProps: ParticipantCardProps, nextProps: ParticipantCardProps): boolean => {
  const prev = prevProps.participant;
  const next = nextProps.participant;

  return (
    prev.instanceId === next.instanceId &&
    prev.name === next.name &&
    prev.category === next.category &&
    prev.currentHP === next.currentHP &&
    prev.hp === next.hp &&
    (typeof prev.hp === 'object' && typeof next.hp === 'object'
      ? (prev.hp as HPValue).current === (next.hp as HPValue).current && (prev.hp as HPValue).max === (next.hp as HPValue).max
      : true) &&
    prev.currentFP === next.currentFP &&
    prev.currentMP === next.currentMP &&
    prevProps.isCurrent === nextProps.isCurrent &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.onUpdateResource === nextProps.onUpdateResource &&
    prevProps.isSelected === nextProps.isSelected
  );
};

const ParticipantCard = memo(ParticipantCardBase, areParticipantPropsEqual);
