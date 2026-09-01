/**
 * TravelWizard — 3-step travel planning panel.
 *
 * Step 1: Compose traveling party and choose conveyance
 * Step 2: Select route (click destination on map)
 * Step 3: Validate and confirm
 */

import { useEffect, useMemo } from 'react';
import type { TileId, TravelMode, MapModel } from '../../../types/map';
import type { TravelBlocker } from '../../../types/map';
import type { DowntimeState } from '../../../types/downtime';
import type { Character, Id } from '../../../types/campaign';
import type { TravelGroup, Vehicle, VehicleTypeDef } from '../../../types/party';
import { validateTravelRoute } from '../../../utils/mapTravelValidation';
import { useWeatherModifiers } from '../../../hooks/useWeatherModifiers';
import { TravelStep1Party, type PartyColumn, type TravelPartySource, type TravelVehicleOption } from './TravelStep1Party';
import { TravelStep2Route } from './TravelStep2Route';
import { TravelStep3Confirm } from './TravelStep3Confirm';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { buildStagedGroup } from '../../../utils/travelComposition';
import { SCALE_TO_MODES } from '../../../constants/map';
import type { ProvisionEstimate } from '../../../utils/provisioning';

interface TravelWizardProps {
  map: MapModel;
  step: 1 | 2 | 3;
  selectedMode: TravelMode | null;
  routeTileIds: TileId[];
  isGmMode: boolean;
  group: TravelGroup;
  characters: Record<Id, Character>;
  sources: TravelPartySource[];
  travelingMemberIds: Id[];
  selectedVehicleId: Id | null;
  availableVehicles: TravelVehicleOption[];
  vehicle: Vehicle | null;
  vehicleType: VehicleTypeDef | null;
  startTileId: TileId | null;
  day: number;
  slot: number;
  downtimeState: DowntimeState;
  slotsPerDay: number;
  nightSlotIndices?: number[];
  navigatorId: Id | null;
  gmNavigationSkill: number;
  forcedMarch: boolean;
  provisioning: ProvisionEstimate;
  onSetStep: (step: 1 | 2 | 3) => void;
  onMoveChip: (memberId: Id, to: PartyColumn) => void;
  onSelectVehicle: (vehicleId: Id | null) => void;
  onClearRoute: () => void;
  onNavigatorChange: (id: Id | null) => void;
  onGmNavigationSkillChange: (skill: number) => void;
  onForcedMarchChange: (forced: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
}

const STEP_LABELS = ['Party', 'Route', 'Confirm'] as const;

export function TravelWizard({
  map,
  step,
  selectedMode,
  routeTileIds,
  isGmMode,
  group,
  characters,
  sources,
  travelingMemberIds,
  selectedVehicleId,
  availableVehicles,
  vehicle,
  vehicleType,
  startTileId,
  day,
  slot,
  downtimeState,
  slotsPerDay,
  nightSlotIndices,
  navigatorId,
  gmNavigationSkill,
  forcedMarch,
  provisioning,
  onSetStep,
  onMoveChip,
  onSelectVehicle,
  onClearRoute,
  onNavigatorChange,
  onGmNavigationSkillChange,
  onForcedMarchChange,
  onConfirm,
  onClose,
}: TravelWizardProps) {
  const { skillBonus: weatherTravelMod } = useWeatherModifiers('travel');
  const travelingGroup = useMemo(
    () => buildStagedGroup(group, { travelingMemberIds, vehicleId: selectedVehicleId }),
    [group, selectedVehicleId, travelingMemberIds]
  );

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Compute blockers for step 3
  const blockers: TravelBlocker[] = useMemo(() => {
    if (!selectedMode || routeTileIds.length < 2) return [];
    return validateTravelRoute({
      map,
      routeTileIds,
      mode: selectedMode,
      group: travelingGroup,
      characters,
      vehicle,
      vehicleType,
      day,
      slot,
      downtimeState,
      isGmMode,
      weatherTravelModifier: weatherTravelMod,
    });
  }, [map, routeTileIds, selectedMode, travelingGroup, characters, vehicle, vehicleType, day, slot, downtimeState, isGmMode, weatherTravelMod]);

  // Check if route has null terrain tiles
  const hasNullTerrain = useMemo(() => {
    return routeTileIds.some((tid) => {
      const tile = map.tilesById[tid];
      return tile && tile.terrainId === null;
    });
  }, [map, routeTileIds]);

  const modeAllowed = selectedMode !== null && SCALE_TO_MODES[map.scaleMilesPerTile].includes(selectedMode);
  const canGoNext = step === 1
    ? modeAllowed && travelingMemberIds.length > 0
    : step === 2 ? routeTileIds.length > 1 : false;
  const canGoBack = step > 1;

  return (
    <div
      role="region"
      aria-label="Travel"
      className="w-56 bg-surface-1/95 border-l border-edge/50 flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-edge/50">
        <span className="text-xs font-semibold text-fg-primary">Travel</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close travel wizard"
          className="p-0.5 rounded hover:bg-surface-2"
        >
          <X className="w-3.5 h-3.5 text-fg-muted" aria-hidden="true" />
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex px-3 py-2 border-b border-edge/50 gap-1">
        {STEP_LABELS.map((label, i) => {
          const stepNum = (i + 1) as 1 | 2 | 3;
          const isActive = step === stepNum;
          const isComplete = step > stepNum;
          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                if (stepNum < step) onSetStep(stepNum);
              }}
              disabled={stepNum > step}
              aria-label={`Step ${stepNum}: ${label}${isActive ? ' (current)' : isComplete ? ' (complete)' : ''}`}
              aria-current={isActive ? 'step' : undefined}
              className={[
                'flex-1 py-1 rounded text-[10px] font-medium transition-colors',
                isActive
                  ? 'bg-accent-600 text-white'
                  : isComplete
                  ? 'bg-surface-3 text-fg-primary hover:bg-surface-4'
                  : 'bg-surface-2/30 text-fg-faint',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {step === 1 && (
          <TravelStep1Party
            mapScale={map.scaleMilesPerTile}
            sources={sources}
            travelingMemberIds={travelingMemberIds}
            selectedVehicleId={selectedVehicleId}
            vehicles={availableVehicles}
            onMoveChip={onMoveChip}
            onSelectVehicle={onSelectVehicle}
          />
        )}
        {step === 2 && selectedMode && (
          <TravelStep2Route
            map={map}
            mode={selectedMode}
            routeTileIds={routeTileIds}
            startTileId={startTileId}
            onClearRoute={onClearRoute}
            weatherTravelModifier={weatherTravelMod}
            vehicle={vehicle}
            vehicleType={vehicleType}
          />
        )}
        {step === 3 && selectedMode && (
          <TravelStep3Confirm
            blockers={blockers}
            isGmMode={isGmMode}
            hasNullTerrain={hasNullTerrain}
            map={map}
            routeTileIds={routeTileIds}
            mode={selectedMode}
            characters={travelingMemberIds.flatMap((id) => characters[id] ? [characters[id]] : [])}
            vehicle={vehicle}
            vehicleType={vehicleType}
            weatherTravelModifier={weatherTravelMod}
            slotsPerDay={slotsPerDay}
            nightSlotIndices={nightSlotIndices}
            navigatorId={navigatorId}
            gmNavigationSkill={gmNavigationSkill}
            forcedMarch={forcedMarch}
            provisioning={provisioning}
            onNavigatorChange={onNavigatorChange}
            onGmNavigationSkillChange={onGmNavigationSkillChange}
            onForcedMarchChange={onForcedMarchChange}
            onConfirm={onConfirm}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-2 px-3 py-2 border-t border-edge/50">
        {canGoBack && (
          <button
            type="button"
            onClick={() => onSetStep((step - 1) as 1 | 2 | 3)}
            aria-label="Back to previous step"
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs text-fg-secondary bg-surface-2/50 hover:bg-surface-3/50 transition-colors"
          >
            <ChevronLeft className="w-3 h-3" aria-hidden="true" />
            Back
          </button>
        )}
        {step < 3 && (
          <button
            type="button"
            disabled={!canGoNext}
            onClick={() => onSetStep((step + 1) as 1 | 2 | 3)}
            aria-label="Next step"
            className={[
              'flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs transition-colors',
              canGoNext
                ? 'bg-accent-600 hover:bg-accent-500 text-white'
                : 'bg-surface-2 text-fg-faint cursor-not-allowed',
            ].join(' ')}
          >
            Next
            <ChevronRight className="w-3 h-3" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
