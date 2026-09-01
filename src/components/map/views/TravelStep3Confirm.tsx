/**
 * TravelStep3Confirm — validation checklist and confirm button.
 */

import type { Character, Id } from '../../../types/campaign';
import type { MapModel, TileId, TravelBlocker, TravelMode } from '../../../types/map';
import type { Vehicle, VehicleTypeDef } from '../../../types/party';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { getNavigationSkill } from '../../../utils/navigation';
import { getRouteStats } from '../../../utils/mapTravelValidation';
import { getWorstGroupEncumbranceLevel } from '../../../utils/encumbrance';

interface TravelStep3ConfirmProps {
  blockers: TravelBlocker[];
  isGmMode: boolean;
  hasNullTerrain: boolean;
  map: MapModel;
  routeTileIds: TileId[];
  mode: TravelMode;
  characters: Character[];
  vehicle: Vehicle | null;
  vehicleType: VehicleTypeDef | null;
  weatherTravelModifier: number;
  slotsPerDay: number;
  nightSlotIndices?: number[];
  navigatorId: Id | null;
  gmNavigationSkill: number;
  forcedMarch: boolean;
  onNavigatorChange: (id: Id | null) => void;
  onGmNavigationSkillChange: (skill: number) => void;
  onForcedMarchChange: (forced: boolean) => void;
  onConfirm: () => void;
}

export function TravelStep3Confirm({
  blockers,
  isGmMode,
  hasNullTerrain,
  map,
  routeTileIds,
  mode,
  characters,
  vehicle,
  vehicleType,
  weatherTravelModifier,
  slotsPerDay,
  nightSlotIndices,
  navigatorId,
  gmNavigationSkill,
  forcedMarch,
  onNavigatorChange,
  onGmNavigationSkillChange,
  onForcedMarchChange,
  onConfirm,
}: TravelStep3ConfirmProps) {
  const canConfirm = blockers.length === 0;
  const stats = getRouteStats(map, routeTileIds, mode, {
    weatherTravelModifier,
    vehicle,
    vehicleType,
    worstEncumbranceLevel: vehicle ? null : getWorstGroupEncumbranceLevel(characters).level,
    slotsPerDay,
    nightSlotIndices,
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Review the validation checklist. All conditions must pass to confirm travel.
      </p>

      {/* Validation checklist */}
      <div className="space-y-1.5">
        {blockers.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-green-300">
            <CheckCircle className="w-4 h-4" />
            All checks passed
          </div>
        ) : (
          blockers.map((blocker, i) => (
            <div key={i} className="bg-gray-900/50 rounded p-2">
              <div className="flex items-start gap-2">
                <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs text-red-300">{blocker.message}</div>
                  {blocker.details && blocker.details.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {blocker.details.map((d, j) => (
                        <li key={j} className="text-[10px] text-gray-400 pl-2">
                          {d}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2 rounded bg-gray-900/50 p-2">
        <label className="block text-[10px] text-gray-400">
          Navigator
          <select
            className="mt-1 w-full rounded bg-gray-800 px-2 py-1 text-xs text-gray-100"
            value={navigatorId ?? ''}
            onChange={(event) => onNavigatorChange(event.target.value || null)}
          >
            <option value="">GM-set skill</option>
            {characters.map((character) => {
              const skill = getNavigationSkill(character, mode);
              return (
                <option key={character.id} value={character.id}>
                  {character.name} — {skill.level}{skill.isDefault ? ' (default)' : ''}
                </option>
              );
            })}
          </select>
        </label>
        {navigatorId === null && (
          <label className="block text-[10px] text-gray-400">
            GM Navigation skill
            <input
              type="number"
              value={gmNavigationSkill}
              onChange={(event) => onGmNavigationSkillChange(Number(event.target.value) || 0)}
              className="mt-1 w-full rounded bg-gray-800 px-2 py-1 text-xs text-gray-100"
            />
          </label>
        )}
        {isGmMode && (
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={forcedMarch}
              onChange={(event) => onForcedMarchChange(event.target.checked)}
            />
            Forced march
          </label>
        )}
        <div className="text-[10px] text-gray-400">
          {stats.totalMiles.toFixed(0)} mi — ~{stats.estimatedMovingSlots} slots (~{stats.estimatedDays} days)
        </div>
      </div>

      {/* GM override warning */}
      {isGmMode && hasNullTerrain && blockers.length === 0 && (
        <div className="flex items-start gap-2 bg-yellow-900/20 border border-yellow-700/50 rounded p-2">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="text-[10px] text-yellow-300">
            Route includes unassigned terrain tiles. You will be prompted to assign
            terrain after travel completes.
          </div>
        </div>
      )}

      {/* Confirm button */}
      <button
        disabled={!canConfirm}
        onClick={onConfirm}
        className={[
          'w-full py-2 rounded-lg text-sm font-medium transition-colors',
          canConfirm
            ? 'bg-green-700 hover:bg-green-600 text-white'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed',
        ].join(' ')}
      >
        Begin Journey
      </button>
    </div>
  );
}
