/**
 * TravelStep2Route — route selection and stats display.
 *
 * The user clicks a destination tile on the map. The router computes
 * the shortest path and displays stats. This component shows the
 * route info sidebar; actual tile clicking is handled by MapPanel.
 */

import type { TileId, TravelMode, MapModel } from '../../../types/map';
import { getRouteStats } from '../../../utils/mapTravelValidation';
import { findTileGridPos } from '../../../utils/mapUtils';
import { MapPin, Ruler, Route } from 'lucide-react';

interface TravelStep2RouteProps {
  map: MapModel;
  mode: TravelMode;
  routeTileIds: TileId[];
  startTileId: TileId | null;
  onClearRoute: () => void;
  weatherTravelModifier?: number;
}

export function TravelStep2Route({
  map,
  mode,
  routeTileIds,
  startTileId,
  onClearRoute,
  weatherTravelModifier = 0,
}: TravelStep2RouteProps) {
  const hasRoute = routeTileIds.length > 1;
  const stats = hasRoute ? getRouteStats(map, routeTileIds, mode, weatherTravelModifier) : null;

  const startPos = startTileId ? findTileGridPos(map, startTileId) : null;
  const destTileId = hasRoute ? routeTileIds[routeTileIds.length - 1] : null;
  const destPos = destTileId ? findTileGridPos(map, destTileId) : null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Click a destination tile on the map to auto-compute a route.
      </p>

      {/* Start/End info */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="w-3.5 h-3.5 text-green-400" />
          <span className="text-gray-300">
            Start: {startPos ? `(${startPos.row}, ${startPos.col})` : 'None'}
          </span>
        </div>
        {destPos && (
          <div className="flex items-center gap-2 text-xs">
            <MapPin className="w-3.5 h-3.5 text-red-400" />
            <span className="text-gray-300">
              Dest: ({destPos.row}, {destPos.col})
            </span>
          </div>
        )}
      </div>

      {/* Route stats */}
      {stats && (
        <div className="bg-gray-900/50 rounded-lg p-2.5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-200">
            <Route className="w-3.5 h-3.5" />
            Route Summary
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="text-[10px] text-gray-400">
              Tiles: <span className="text-gray-200">{stats.tileCount}</span>
            </div>
            <div className="text-[10px] text-gray-400">
              <Ruler className="w-2.5 h-2.5 inline mr-0.5" />
              <span className={stats.withinBudget ? 'text-green-300' : 'text-red-300'}>
                {(stats.totalMiles ?? 0).toFixed(0)} / {Math.round(stats.budgetMiles)} mi
              </span>
            </div>
          </div>

          {/* Terrain breakdown */}
          {stats.terrainBreakdown.length > 0 && (
            <div className="space-y-0.5">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Terrain</div>
              {stats.terrainBreakdown.map((t) => (
                <div key={t.name} className="flex justify-between text-[10px]">
                  <span className="text-gray-300">{t.name}</span>
                  <span className="text-gray-500">{t.count}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={onClearRoute}
            className="w-full text-[10px] text-gray-400 hover:text-gray-200 py-1 transition-colors"
          >
            Clear Route
          </button>
        </div>
      )}

      {!hasRoute && (
        <div className="text-center py-4 text-xs text-gray-500">
          No route selected. Click a tile on the map.
        </div>
      )}
    </div>
  );
}
