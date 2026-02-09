/**
 * MapHeader — Map name, scale badge, map selector dropdown, and action buttons.
 */

import { useState } from 'react';
import type { MapModel, MapId } from '../../../types/map';
import { MAP_SCALES } from '../../../constants/map';
import { Plus, Map as MapIcon, ChevronDown, Navigation, MapPinned } from 'lucide-react';

interface MapHeaderProps {
  maps: Record<MapId, MapModel>;
  activeMapId: MapId | null;
  isGmMode: boolean;
  onSelectMap: (mapId: MapId) => void;
  onCreateMap: () => void;
  /** Whether the active map has a party tile placed */
  hasPartyOnMap?: boolean;
  /** Whether the travel wizard is currently open */
  showTravelWizard?: boolean;
  /** Called when GM clicks Travel */
  onTravel?: () => void;
  /** Called when GM clicks Move to Map (enters placement mode) */
  onPlaceParty?: () => void;
  /** Whether the user is currently in party-placement mode */
  isPlacingParty?: boolean;
  /** Called to cancel party-placement mode */
  onCancelPlaceParty?: () => void;
}

export function MapHeader({
  maps,
  activeMapId,
  isGmMode,
  onSelectMap,
  onCreateMap,
  hasPartyOnMap,
  showTravelWizard,
  onTravel,
  onPlaceParty,
  isPlacingParty,
  onCancelPlaceParty,
}: MapHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const activeMap = activeMapId ? maps[activeMapId] : null;
  const mapList = Object.values(maps);

  const scaleLabel = activeMap
    ? MAP_SCALES.find((s) => s.value === activeMap.scaleMilesPerTile)?.label ?? ''
    : '';

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-800/50 border-b border-gray-700/50">
      <MapIcon className="w-4 h-4 text-gray-400" />

      {/* Map selector */}
      <div className="relative">
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-gray-700/50 hover:bg-gray-600/50 text-sm font-medium text-gray-200 transition-colors"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <span>{activeMap?.name ?? 'No Map Selected'}</span>
          {scaleLabel && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-gray-600 text-gray-300">
              {scaleLabel}
            </span>
          )}
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>

        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setDropdownOpen(false)}
            />
            <div className="absolute top-full left-0 mt-1 z-30 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-xl">
              {mapList.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-400">
                  No maps created yet
                </div>
              ) : (
                mapList.map((m) => {
                  const scale = MAP_SCALES.find((s) => s.value === m.scaleMilesPerTile);
                  return (
                    <button
                      key={m.id}
                      className={[
                        'w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-700/50 transition-colors',
                        m.id === activeMapId ? 'bg-blue-900/30 text-blue-200' : 'text-gray-300',
                      ].join(' ')}
                      onClick={() => {
                        onSelectMap(m.id);
                        setDropdownOpen(false);
                      }}
                    >
                      <span className="flex-1 truncate">{m.name}</span>
                      {scale && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-gray-600 text-gray-400">
                          {scale.label}
                        </span>
                      )}
                      {m.partyTileId && (
                        <span className="w-2 h-2 rounded-full bg-green-400" title="Party is here" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Placing-party banner */}
      {isPlacingParty && (
        <div className="flex items-center gap-2 px-3 py-1 rounded bg-amber-700/60 border border-amber-500/40 text-xs text-amber-200">
          <MapPinned className="w-3.5 h-3.5" />
          Click any tile to place the party
          <button
            className="ml-1 px-1.5 py-0.5 rounded bg-amber-600/50 hover:bg-amber-500/50 text-amber-100 transition-colors"
            onClick={onCancelPlaceParty}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex-1" />

      {/* Travel / Move to Map button */}
      {activeMap && !showTravelWizard && !isPlacingParty && (
        hasPartyOnMap ? (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 text-sm font-medium text-white transition-colors"
            onClick={onTravel}
          >
            <Navigation className="w-3.5 h-3.5" />
            Travel
          </button>
        ) : isGmMode ? (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-sm font-medium text-white transition-colors"
            onClick={onPlaceParty}
          >
            <MapPinned className="w-3.5 h-3.5" />
            Move to Map
          </button>
        ) : null
      )}

      {/* Create map button (GM only) */}
      {isGmMode && (
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-colors"
          onClick={onCreateMap}
        >
          <Plus className="w-3.5 h-3.5" />
          New Map
        </button>
      )}
    </div>
  );
}
