/**
 * MapHeader — Map name, scale badge, map selector dropdown, and action buttons.
 */

import { useState } from 'react';
import type { MapModel, MapId } from '../../../types/map';
import type { WeatherTable } from '../../../types/location';
import { DEFAULT_SIGHT_RANGE_TILES, MAP_SCALES } from '../../../constants/map';
import { Plus, Map as MapIcon, ChevronDown, Navigation, MapPinned, Settings, Image as ImageIcon } from 'lucide-react';

interface MapHeaderProps {
  maps: Record<MapId, MapModel>;
  activeMapId: MapId | null;
  isGmMode: boolean;
  onSelectMap: (mapId: MapId) => void;
  onCreateMap: () => void;
  mapsWithPresence?: Set<MapId>;
  groups?: Array<{
    id: string;
    name: string;
    memberCount: number;
    vehicleName: string | null;
    onThisMap: boolean;
  }>;
  activeGroupId?: string | null;
  onSelectGroup?: (id: string) => void;
  /** Whether the active map has a party tile placed */
  hasPartyOnMap?: boolean;
  /** Whether the travel wizard is currently open */
  showTravelWizard?: boolean;
  /** Called when GM clicks Travel */
  onTravel?: () => void;
  placementTargets?: Array<{ kind: 'group' | 'vehicle'; id: string; name: string; unplaced: boolean }>;
  placingName?: string | null;
  onSelectPlacement?: (kind: 'group' | 'vehicle', id: string) => void;
  onCancelPlacement?: () => void;
  onUpdateMapSettings?: (
    changes: Partial<Pick<MapModel, 'visionMode' | 'sightRangeTiles' | 'climate' | 'weatherTableId'>>
  ) => void;
  climateLabels?: Record<string, string>;
  weatherTables?: WeatherTable[];
  /** Called when GM clicks the Images button (opens the image layers dialog) */
  onOpenImages?: () => void;
}

export function MapHeader({
  maps,
  activeMapId,
  isGmMode,
  onSelectMap,
  onCreateMap,
  mapsWithPresence,
  groups = [],
  activeGroupId = null,
  onSelectGroup,
  hasPartyOnMap,
  showTravelWizard,
  onTravel,
  placementTargets = [],
  placingName,
  onSelectPlacement,
  onCancelPlacement,
  onUpdateMapSettings,
  climateLabels = {},
  weatherTables = [],
  onOpenImages,
}: MapHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [placementOpen, setPlacementOpen] = useState(false);
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
                      {mapsWithPresence?.has(m.id) && (
                        <span className="w-2 h-2 rounded-full bg-green-400" title="Group or vehicle is here" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Active travel group selector */}
      <select
        aria-label="Active travel group"
        value={activeGroupId ?? ''}
        onChange={(event) => onSelectGroup?.(event.target.value)}
        className="max-w-64 rounded border border-gray-600 bg-gray-700/50 px-2 py-1.5 text-sm text-gray-200"
      >
        {groups.length === 0 && <option value="">No travel groups</option>}
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.onThisMap ? '' : '◆ '}{group.name} ({group.memberCount}){group.vehicleName ? ` — aboard ${group.vehicleName}` : ''}
          </option>
        ))}
      </select>

      {/* Placement banner */}
      {placingName && (
        <div className="flex items-center gap-2 px-3 py-1 rounded bg-amber-700/60 border border-amber-500/40 text-xs text-amber-200">
          <MapPinned className="w-3.5 h-3.5" />
          Click any tile to place {placingName}
          <button
            className="ml-1 px-1.5 py-0.5 rounded bg-amber-600/50 hover:bg-amber-500/50 text-amber-100 transition-colors"
            onClick={onCancelPlacement}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex-1" />

      {/* Travel / Move to Map button */}
      {activeMap && !showTravelWizard && !placingName && (
        <>
        {hasPartyOnMap && (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 text-sm font-medium text-white transition-colors"
            onClick={onTravel}
          >
            <Navigation className="w-3.5 h-3.5" />
            Travel
          </button>
        )}
        {isGmMode && (
          <div className="relative">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-sm font-medium text-white transition-colors"
              onClick={() => setPlacementOpen((open) => !open)}
            >
              <MapPinned className="w-3.5 h-3.5" />
              Move to Map
            </button>
            {placementOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded border border-gray-600 bg-gray-800 py-1 shadow-xl">
                {placementTargets.map((target) => (
                  <button
                    key={`${target.kind}:${target.id}`}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-700"
                    onClick={() => {
                      onSelectPlacement?.(target.kind, target.id);
                      setPlacementOpen(false);
                    }}
                  >
                    <span className="flex-1 truncate">{target.name}</span>
                    <span className="text-[10px] uppercase text-gray-500">{target.unplaced ? 'unplaced' : target.kind}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        </>
      )}

      {/* Image layers (GM only) */}
      {isGmMode && activeMap && onOpenImages && (
        <button
          type="button"
          aria-label="Map images"
          title="Map images (under/overlays)"
          onClick={onOpenImages}
          className="rounded p-2 text-gray-300 hover:bg-gray-700/70 hover:text-white"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
      )}

      {/* Map settings popover (GM only) */}
      {isGmMode && activeMap && (
        <div className="relative">
          <button
            type="button"
            aria-label="Map settings"
            title="Map settings"
            onClick={() => setSettingsOpen((open) => !open)}
            className="rounded p-2 text-gray-300 hover:bg-gray-700/70 hover:text-white"
          >
            <Settings className="h-4 w-4" />
          </button>
          {settingsOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setSettingsOpen(false)} />
              <div className="absolute right-0 top-full z-30 mt-1 w-64 space-y-3 rounded-lg border border-gray-600 bg-gray-800 p-3 shadow-xl">
                <div>
                  <label htmlFor="map-climate-setting" className="mb-1 block text-xs font-medium text-gray-300">
                    Climate
                  </label>
                  <select
                    id="map-climate-setting"
                    value={activeMap.climate}
                    onChange={(event) => onUpdateMapSettings?.({ climate: event.target.value })}
                    className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-200"
                  >
                    {Object.entries(climateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="map-weather-table" className="mb-1 block text-xs font-medium text-gray-300">
                    Weather table
                  </label>
                  <select
                    id="map-weather-table"
                    value={activeMap.weatherTableId ?? ''}
                    onChange={(event) => onUpdateMapSettings?.({ weatherTableId: event.target.value || null })}
                    className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-200"
                  >
                    <option value="">Climate default</option>
                    {weatherTables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="map-vision-mode" className="mb-1 block text-xs font-medium text-gray-300">
                    Vision
                  </label>
                  <select
                    id="map-vision-mode"
                    value={activeMap.visionMode ?? 'lineOfSight'}
                    onChange={(event) => onUpdateMapSettings?.({
                      visionMode: event.target.value === 'open' ? 'open' : 'lineOfSight',
                    })}
                    className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-200"
                  >
                    <option value="lineOfSight">Line of sight</option>
                    <option value="open">Open</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="map-sight-range" className="mb-1 block text-xs font-medium text-gray-300">
                    Sight range
                  </label>
                  <input
                    id="map-sight-range"
                    type="number"
                    min={1}
                    max={30}
                    step={1}
                    value={activeMap.sightRangeTiles ?? DEFAULT_SIGHT_RANGE_TILES}
                    onChange={(event) => onUpdateMapSettings?.({ sightRangeTiles: event.target.valueAsNumber })}
                    className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-200"
                  />
                </div>
              </div>
            </>
          )}
        </div>
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
