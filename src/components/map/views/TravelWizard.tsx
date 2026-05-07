/**
 * TravelWizard — 3-step travel planning panel.
 *
 * Step 1: Select travel mode
 * Step 2: Select route (click destination on map)
 * Step 3: Validate and confirm
 */

import { useCallback, useEffect, useId, useMemo } from 'react';
import type { TileId, TravelMode, MapModel } from '../../../types/map';
import type { TravelBlocker } from '../../../types/map';
import type { DowntimeState } from '../../../types/downtime';
import { validateTravelRoute } from '../../../utils/mapTravelValidation';
import { useWeatherModifiers } from '../../../hooks/useWeatherModifiers';
import { TravelStep1Mode } from './TravelStep1Mode';
import { TravelStep2Route } from './TravelStep2Route';
import { TravelStep3Confirm } from './TravelStep3Confirm';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface TravelWizardProps {
  map: MapModel;
  step: 1 | 2 | 3;
  selectedMode: TravelMode | null;
  routeTileIds: TileId[];
  isGmMode: boolean;
  partyCharacterIds: string[];
  day: number;
  slot: number;
  downtimeState: DowntimeState;
  onSetStep: (step: 1 | 2 | 3) => void;
  onSetMode: (mode: TravelMode) => void;
  onClearRoute: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

const STEP_LABELS = ['Mode', 'Route', 'Confirm'] as const;

export function TravelWizard({
  map,
  step,
  selectedMode,
  routeTileIds,
  isGmMode,
  partyCharacterIds,
  day,
  slot,
  downtimeState,
  onSetStep,
  onSetMode,
  onClearRoute,
  onConfirm,
  onClose,
}: TravelWizardProps) {
  const { skillBonus: weatherTravelMod } = useWeatherModifiers('travel');
  const titleId = useId();

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
    return validateTravelRoute(
      map,
      routeTileIds,
      selectedMode,
      partyCharacterIds,
      day,
      slot,
      downtimeState,
      isGmMode,
      weatherTravelMod
    );
  }, [map, routeTileIds, selectedMode, partyCharacterIds, day, slot, downtimeState, isGmMode, weatherTravelMod]);

  // Check if route has null terrain tiles
  const hasNullTerrain = useMemo(() => {
    return routeTileIds.some((tid) => {
      const tile = map.tilesById[tid];
      return tile && tile.terrainId === null;
    });
  }, [map, routeTileIds]);

  // Auto-select mode based on map scale
  const handleModeSelect = useCallback(
    (mode: TravelMode) => {
      onSetMode(mode);
      onSetStep(2);
    },
    [onSetMode, onSetStep]
  );

  const canGoNext = step === 1 ? selectedMode !== null : step === 2 ? routeTileIds.length > 1 : false;
  const canGoBack = step > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="w-56 bg-gray-800/95 border-l border-gray-700/50 flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50">
        <span id={titleId} className="text-xs font-semibold text-gray-200">Travel</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close travel wizard"
          className="p-0.5 rounded hover:bg-gray-700"
        >
          <X className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex px-3 py-2 border-b border-gray-700/50 gap-1">
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
                  ? 'bg-blue-600 text-white'
                  : isComplete
                  ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                  : 'bg-gray-700/30 text-gray-500',
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
          <TravelStep1Mode
            mapScale={map.scaleMilesPerTile}
            selectedMode={selectedMode}
            onSelectMode={handleModeSelect}
          />
        )}
        {step === 2 && selectedMode && (
          <TravelStep2Route
            map={map}
            mode={selectedMode}
            routeTileIds={routeTileIds}
            startTileId={map.partyTileId}
            onClearRoute={onClearRoute}
            weatherTravelModifier={weatherTravelMod}
          />
        )}
        {step === 3 && selectedMode && (
          <TravelStep3Confirm
            blockers={blockers}
            isGmMode={isGmMode}
            hasNullTerrain={hasNullTerrain}
            onConfirm={onConfirm}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-2 px-3 py-2 border-t border-gray-700/50">
        {canGoBack && (
          <button
            type="button"
            onClick={() => onSetStep((step - 1) as 1 | 2 | 3)}
            aria-label="Back to previous step"
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs text-gray-300 bg-gray-700/50 hover:bg-gray-600/50 transition-colors"
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
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed',
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
