/**
 * TravelStep1Mode — travel mode selection (foot/boat/airship).
 */

import type { TravelMode, MapScale } from '../../../types/map';
import { TRAVEL_MODE_DEFINITIONS, SCALE_TO_MODES } from '../../../constants/map';
import { Footprints, Ship, Plane } from 'lucide-react';

const MODE_ICONS: Record<TravelMode, typeof Footprints> = {
  foot: Footprints,
  boat: Ship,
  airship: Plane,
};

interface TravelStep1ModeProps {
  mapScale: MapScale;
  selectedMode: TravelMode | null;
  onSelectMode: (mode: TravelMode) => void;
}

export function TravelStep1Mode({
  mapScale,
  selectedMode,
  onSelectMode,
}: TravelStep1ModeProps) {
  const allowedModes = SCALE_TO_MODES[mapScale];

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Choose a travel mode. Higher-tier modes work on smaller maps too.
      </p>

      <div className="space-y-2">
        {TRAVEL_MODE_DEFINITIONS.map((modeDef) => {
          const isAllowed = allowedModes.includes(modeDef.id);
          const isSelected = selectedMode === modeDef.id;
          const Icon = MODE_ICONS[modeDef.id];
          const minScale = Math.min(...modeDef.allowedScales);

          return (
            <button
              key={modeDef.id}
              disabled={!isAllowed}
              onClick={() => onSelectMode(modeDef.id)}
              className={[
                'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
                isSelected
                  ? 'bg-blue-900/40 border-blue-500 text-white'
                  : isAllowed
                  ? 'bg-gray-700/30 border-gray-600 text-gray-200 hover:bg-gray-600/30'
                  : 'bg-gray-800/30 border-gray-700 text-gray-500 cursor-not-allowed opacity-50',
              ].join(' ')}
            >
              <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium">{modeDef.label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {modeDef.description}
                </div>
                {!isAllowed && (
                  <div className="text-[10px] text-red-400 mt-0.5">
                    Requires ≤{minScale}-mile map
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
