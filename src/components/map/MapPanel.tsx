/**
 * MapPanel — top-level map component.
 * Entry point for the Map module in the shell.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useCampaignStore } from '../../state/campaignStore';
import type { MapScale, TerrainId, TileId, MarkerModel, LinkModel, TravelMode } from '../../types/map';
import { SCALE_TO_MODES } from '../../constants/map';
import { findRoute, getReachableTiles } from '../../utils/mapRouter';
import { MapGrid } from './views/MapGrid';
import { MapHeader } from './views/MapHeader';
import { MapCreateDialog } from './views/MapCreateDialog';
import { TerrainPalette } from './views/TerrainPalette';
import { MapContextMenu, type ContextMenuState } from './views/MapContextMenu';
import { MarkerEditor } from './views/MarkerEditor';
import { LinkEditor } from './views/LinkEditor';
import { LinksMenu } from './views/LinksMenu';
import { TravelWizard } from './views/TravelWizard';
import { TerrainAssignmentModal } from './views/TerrainAssignmentModal';
import { Map as MapIcon, ExternalLink, Navigation } from 'lucide-react';

/** Interaction mode for the map */
export type MapInteractionMode = 'view' | 'paint' | 'select';

export function MapPanel() {
  const { state, actions } = useCampaignStore();
  const isGmMode = state.ui.gmModeEnabled;
  const maps = state.maps;
  const activeMap = maps.activeMapId ? maps.mapsById[maps.activeMapId] : null;

  // UI state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [interactionMode, setInteractionMode] = useState<MapInteractionMode>('view');
  const [selectedTerrainId, setSelectedTerrainId] = useState<TerrainId | null>(null);
  const [selectedTileIds, setSelectedTileIds] = useState<Set<TileId>>(new Set());
  const [isPainting, setIsPainting] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Marker/Link editor state
  const [markerEditorTileId, setMarkerEditorTileId] = useState<TileId | null>(null);
  const [linkEditorTileId, setLinkEditorTileId] = useState<TileId | null>(null);
  const [showLinksMenu, setShowLinksMenu] = useState(false);

  // Travel wizard state
  const [showTravelWizard, setShowTravelWizard] = useState(false);
  const [travelStep, setTravelStep] = useState<1 | 2 | 3>(1);
  const [travelMode, setTravelMode] = useState<TravelMode | null>(null);
  const [travelRoute, setTravelRoute] = useState<TileId[]>([]);

  // Links on the party's current tile
  const partyTileLinks = useMemo(() => {
    if (!activeMap || !activeMap.partyTileId) return [];
    const tile = activeMap.tilesById[activeMap.partyTileId];
    if (!tile) return [];
    return tile.linkIds
      .map((lid) => activeMap.linksById[lid])
      .filter(Boolean);
  }, [activeMap]);

  // Party character IDs for travel validation
  const partyCharacterIds = useMemo(() => {
    return Object.keys(state.entities.characters);
  }, [state.entities.characters]);

  // Reachable tiles (computed when in travel step 2)
  const reachableTileIds = useMemo(() => {
    if (!showTravelWizard || travelStep < 2 || !travelMode || !activeMap || !activeMap.partyTileId) {
      return undefined;
    }
    const reachable = getReachableTiles(activeMap, activeMap.partyTileId, travelMode, isGmMode);
    return reachable.size > 0 ? reachable : undefined;
  }, [showTravelWizard, travelStep, travelMode, activeMap, isGmMode]);

  // Select map
  const handleSelectMap = useCallback(
    (mapId: string) => actions.mapSetActiveMap(mapId),
    [actions]
  );

  // Create map
  const handleCreateMap = useCallback(
    (params: { name: string; description?: string; scaleMilesPerTile: MapScale; startTerrainId: TerrainId }) => {
      actions.mapCreateMap(params);
      setShowCreateDialog(false);
    },
    [actions]
  );

  // Tile click
  const handleTileClick = useCallback(
    (tileId: TileId, _row: number, _col: number) => {
      if (!activeMap || !maps.activeMapId) return;

      // Travel wizard step 2: click to set destination
      if (showTravelWizard && travelStep === 2 && travelMode && activeMap.partyTileId) {
        if (tileId === activeMap.partyTileId) return; // Can't route to self
        const route = findRoute(activeMap, activeMap.partyTileId, tileId, travelMode, isGmMode);
        if (route.valid) {
          setTravelRoute(route.path);
        }
        return;
      }

      if (interactionMode === 'paint' && selectedTerrainId && isGmMode) {
        actions.mapSetTileTerrain(maps.activeMapId, tileId, selectedTerrainId);
      } else if (interactionMode === 'select') {
        setSelectedTileIds((prev) => {
          const next = new Set(prev);
          if (next.has(tileId)) {
            next.delete(tileId);
          } else {
            next.add(tileId);
          }
          return next;
        });
      }
    },
    [activeMap, maps.activeMapId, interactionMode, selectedTerrainId, isGmMode, actions, showTravelWizard, travelStep, travelMode]
  );

  // Tile mouse down (start painting)
  const handleTileMouseDown = useCallback(
    (tileId: TileId, _row: number, _col: number, e: React.MouseEvent) => {
      if (showTravelWizard) return; // Disable painting during travel
      if (interactionMode === 'paint' && selectedTerrainId && isGmMode && e.button === 0) {
        setIsPainting(true);
        if (maps.activeMapId) {
          actions.mapSetTileTerrain(maps.activeMapId, tileId, selectedTerrainId);
        }
      }
    },
    [interactionMode, selectedTerrainId, isGmMode, maps.activeMapId, actions, showTravelWizard]
  );

  // Tile mouse enter (painting drag)
  const handleTileMouseEnter = useCallback(
    (tileId: TileId, _row: number, _col: number, _e: React.MouseEvent) => {
      if (isPainting && selectedTerrainId && isGmMode && maps.activeMapId) {
        actions.mapSetTileTerrain(maps.activeMapId, tileId, selectedTerrainId);
      }
    },
    [isPainting, selectedTerrainId, isGmMode, maps.activeMapId, actions]
  );

  // Global mouse up (stop painting)
  React.useEffect(() => {
    const handleMouseUp = () => {
      if (isPainting) {
        setIsPainting(false);
      }
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isPainting]);

  // Context menu
  const handleTileContextMenu = useCallback(
    (tileId: TileId, row: number, col: number, e: React.MouseEvent) => {
      e.preventDefault();
      if (!isGmMode) return;
      setContextMenu({ tileId, row, col, x: e.clientX, y: e.clientY });
    },
    [isGmMode]
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Context menu: stamp terrain to selection
  const handleStampSelection = useCallback(() => {
    if (!maps.activeMapId || !selectedTerrainId || selectedTileIds.size === 0) return;
    actions.mapStampTerrain(maps.activeMapId, Array.from(selectedTileIds), selectedTerrainId);
    setSelectedTileIds(new Set());
    setContextMenu(null);
  }, [maps.activeMapId, selectedTerrainId, selectedTileIds, actions]);

  // Select terrain
  const handleSelectTerrain = useCallback((terrainId: TerrainId) => {
    setSelectedTerrainId(terrainId);
  }, []);

  // Add marker
  const handleAddMarker = useCallback((tileId: TileId) => {
    setMarkerEditorTileId(tileId);
  }, []);

  const handleConfirmMarker = useCallback(
    (marker: MarkerModel) => {
      if (!maps.activeMapId) return;
      actions.mapAddMarker(maps.activeMapId, marker);
      setMarkerEditorTileId(null);
    },
    [maps.activeMapId, actions]
  );

  // Add link
  const handleAddLink = useCallback((tileId: TileId) => {
    setLinkEditorTileId(tileId);
  }, []);

  const handleConfirmLink = useCallback(
    (link: LinkModel) => {
      actions.mapAddLink(link);
      setLinkEditorTileId(null);
    },
    [actions]
  );

  // Use link (portal)
  const handleUseLink = useCallback(
    (link: LinkModel) => {
      actions.mapSetActiveMap(link.toMapId);
      actions.mapSetPartyTile(link.toMapId, link.toTileId);
      setShowLinksMenu(false);
    },
    [actions]
  );

  // Travel wizard handlers
  const handleOpenTravel = useCallback(() => {
    if (!activeMap) return;
    const defaultMode = SCALE_TO_MODES[activeMap.scaleMilesPerTile][0];
    setTravelMode(defaultMode);
    setTravelStep(1);
    setTravelRoute([]);
    setShowTravelWizard(true);
  }, [activeMap]);

  const handleCloseTravel = useCallback(() => {
    setShowTravelWizard(false);
    setTravelStep(1);
    setTravelMode(null);
    setTravelRoute([]);
  }, []);

  const handleTravelConfirm = useCallback(() => {
    if (!maps.activeMapId || !travelMode || travelRoute.length < 2) return;
    const destTileId = travelRoute[travelRoute.length - 1];
    actions.mapExecuteTravel({
      mapId: maps.activeMapId,
      routeTileIds: travelRoute,
      destinationTileId: destTileId,
      mode: travelMode,
      gmOverride: isGmMode,
    });
    handleCloseTravel();
  }, [maps.activeMapId, travelMode, travelRoute, isGmMode, actions, handleCloseTravel]);

  // Pending terrain assignment handlers
  const handleFillPendingTerrain = useCallback(
    (terrainId: TerrainId) => {
      if (!maps.activeMapId || !maps.pendingTerrainAssignment) return;
      actions.mapStampTerrain(maps.activeMapId, maps.pendingTerrainAssignment, terrainId);
      actions.mapClearPendingTerrain();
    },
    [maps.activeMapId, maps.pendingTerrainAssignment, actions]
  );

  const handleDismissPendingTerrain = useCallback(() => {
    actions.mapClearPendingTerrain();
  }, [actions]);

  // Empty state
  if (!activeMap) {
    return (
      <div className="flex flex-col h-full">
        <MapHeader
          maps={maps.mapsById}
          activeMapId={maps.activeMapId}
          isGmMode={isGmMode}
          onSelectMap={handleSelectMap}
          onCreateMap={() => setShowCreateDialog(true)}
        />
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4">
          <MapIcon className="w-12 h-12 opacity-30" />
          <p className="text-sm">No maps created yet.</p>
          {isGmMode && (
            <button
              className="px-4 py-2 text-sm font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              onClick={() => setShowCreateDialog(true)}
            >
              Create Your First Map
            </button>
          )}
        </div>
        {showCreateDialog && (
          <MapCreateDialog
            onConfirm={handleCreateMap}
            onCancel={() => setShowCreateDialog(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      <MapHeader
        maps={maps.mapsById}
        activeMapId={maps.activeMapId}
        isGmMode={isGmMode}
        onSelectMap={handleSelectMap}
        onCreateMap={() => setShowCreateDialog(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Terrain palette (GM only, hidden during travel) */}
        {isGmMode && !showTravelWizard && (
          <TerrainPalette
            terrains={Object.values(activeMap.terrainById)}
            selectedTerrainId={selectedTerrainId}
            interactionMode={interactionMode}
            onSelectTerrain={handleSelectTerrain}
            onSetMode={setInteractionMode}
          />
        )}

        {/* Map grid */}
        <MapGrid
          map={activeMap}
          isGmMode={isGmMode}
          selectedTileIds={selectedTileIds.size > 0 ? selectedTileIds : undefined}
          routeTileIds={travelRoute.length > 1 ? travelRoute : undefined}
          reachableTileIds={reachableTileIds}
          onTileClick={handleTileClick}
          onTileContextMenu={handleTileContextMenu}
          onTileMouseDown={handleTileMouseDown}
          onTileMouseEnter={handleTileMouseEnter}
        />

        {/* Travel wizard panel */}
        {showTravelWizard && (
          <TravelWizard
            map={activeMap}
            step={travelStep}
            selectedMode={travelMode}
            routeTileIds={travelRoute}
            isGmMode={isGmMode}
            partyCharacterIds={partyCharacterIds}
            day={state.time.day}
            slot={state.time.slot}
            downtimeState={state.downtime}
            onSetStep={setTravelStep}
            onSetMode={setTravelMode}
            onClearRoute={() => setTravelRoute([])}
            onConfirm={handleTravelConfirm}
            onClose={handleCloseTravel}
          />
        )}
      </div>

      {/* Travel button */}
      {activeMap.partyTileId && !showTravelWizard && (
        <button
          className="absolute bottom-4 left-4 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-sm font-medium text-white shadow-lg transition-colors z-30"
          onClick={handleOpenTravel}
        >
          <Navigation className="w-4 h-4" />
          Travel
        </button>
      )}

      {/* Links button (when party tile has links) */}
      {partyTileLinks.length > 0 && !showTravelWizard && (
        <button
          className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-sm font-medium text-white shadow-lg transition-colors z-30"
          onClick={() => setShowLinksMenu(!showLinksMenu)}
        >
          <ExternalLink className="w-4 h-4" />
          Links ({partyTileLinks.length})
        </button>
      )}

      {/* Links menu */}
      {showLinksMenu && partyTileLinks.length > 0 && (
        <LinksMenu
          links={partyTileLinks}
          maps={maps.mapsById}
          onUseLink={handleUseLink}
          onClose={() => setShowLinksMenu(false)}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <MapContextMenu
          state={contextMenu}
          selectedTileIds={selectedTileIds}
          selectedTerrainId={selectedTerrainId}
          terrains={activeMap.terrainById}
          onStampSelection={handleStampSelection}
          onAddMarker={handleAddMarker}
          onAddLink={handleAddLink}
          onClose={handleCloseContextMenu}
        />
      )}

      {/* Marker editor */}
      {markerEditorTileId && (
        <MarkerEditor
          tileId={markerEditorTileId}
          onConfirm={handleConfirmMarker}
          onCancel={() => setMarkerEditorTileId(null)}
        />
      )}

      {/* Link editor */}
      {linkEditorTileId && maps.activeMapId && (
        <LinkEditor
          fromMapId={maps.activeMapId}
          fromTileId={linkEditorTileId}
          maps={maps.mapsById}
          onConfirm={handleConfirmLink}
          onCancel={() => setLinkEditorTileId(null)}
        />
      )}

      {/* Create dialog */}
      {showCreateDialog && (
        <MapCreateDialog
          onConfirm={handleCreateMap}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}

      {/* Terrain assignment modal (after GM override travel) */}
      {maps.pendingTerrainAssignment && maps.pendingTerrainAssignment.length > 0 && activeMap && (
        <TerrainAssignmentModal
          map={activeMap}
          pendingTileIds={maps.pendingTerrainAssignment}
          onFillAll={handleFillPendingTerrain}
          onDismiss={handleDismissPendingTerrain}
        />
      )}
    </div>
  );
}
