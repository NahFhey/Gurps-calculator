/**
 * MapPanel — top-level map component.
 * Entry point for the Map module in the shell.
 */

import { useState, useCallback, useMemo } from 'react';
import { useCampaignStore } from '../../state/campaignStore';
import type { MapScale, StructureLayer, StructureLayerId, TerrainId, TerrainModel, TileId, MarkerModel, LinkModel } from '../../types/map';
import type { Id } from '../../types/campaign';
import { CLIMATE_LABELS, type ClimateType } from '../../types/location';
import { MAX_ELEVATION } from '../../constants/map';
import { findRoute, getReachableTiles } from '../../utils/mapRouter';
import { computeVisibleTiles } from '../../utils/lineOfSight';
import { Map3DView } from './views/Map3DView';
import type { TilePointerEvent } from './three/MapScene';
import { MapHeader } from './views/MapHeader';
import { MapCreateDialog } from './views/MapCreateDialog';
import { TerrainPalette } from './views/TerrainPalette';
import { TerrainEditor } from './views/TerrainEditor';
import { MapContextMenu, type ContextMenuState } from './views/MapContextMenu';
import { MarkerEditor } from './views/MarkerEditor';
import { LinkEditor } from './views/LinkEditor';
import { LinksMenu } from './views/LinksMenu';
import { TravelWizard } from './views/TravelWizard';
import { TerrainAssignmentModal } from './views/TerrainAssignmentModal';
import { ElevationDialog } from './views/ElevationDialog';
import { ImageLayersDialog } from './views/ImageLayersDialog';
import { Map as MapIcon, ExternalLink } from 'lucide-react';
import {
  selectActiveTravelGroup,
  selectGroupPosition,
  selectGroupsOnMap,
  selectVehiclesOnMap,
} from '../../state/selectors';
import { groupsOnMap, vehiclesOnMap } from '../../utils/partyPosition';
import { resolveGroupPosition } from '../../utils/partyPosition';
import { buildMapTokens } from '../../utils/mapTokens';
import {
  applyCompositionActions,
  buildCompositionActions,
  getCoLocatedVehicles,
  getCompositionGroups,
  mapSourceGroupsByMember,
} from '../../utils/travelComposition';
import type { PartyColumn } from './views/TravelStep1Party';

/** Interaction mode for the map */
export type MapInteractionMode = 'view' | 'paint' | 'select';

export function MapPanel() {
  const { state, actions } = useCampaignStore();
  const isGmMode = state.ui.gmModeEnabled;
  const maps = state.maps;
  const activeMap = maps.activeMapId ? maps.mapsById[maps.activeMapId] : null;
  const activeGroup = selectActiveTravelGroup(state);
  const activeGroupPosition = activeGroup ? selectGroupPosition(state, activeGroup.id) : null;
  const activeGroupTile = activeMap && activeGroupPosition?.mapId === activeMap.id
    ? activeGroupPosition.tileId
    : null;
  const climateLabels = useMemo(() => {
    const labels: Record<string, string> = { ...CLIMATE_LABELS };
    for (const custom of state.locations.customClimates ?? []) labels[custom.key] = custom.label;
    return labels;
  }, [state.locations.customClimates]);
  // UI state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [interactionMode, setInteractionMode] = useState<MapInteractionMode>('view');
  const [selectedTerrainId, setSelectedTerrainId] = useState<TerrainId | null>(null);
  /** Elevation to paint with; null = terrain default (leave overrides alone). */
  const [paintElevation, setPaintElevation] = useState<number | null>(null);
  const [selectedTileIds, setSelectedTileIds] = useState<Set<TileId>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [elevationDialogTileIds, setElevationDialogTileIds] = useState<TileId[] | null>(null);

  // Structure layer painting state (null = paint the ground grid)
  const [activeStructureLayerId, setActiveStructureLayerId] = useState<StructureLayerId | null>(null);
  const [structureEraseMode, setStructureEraseMode] = useState(false);

  // Image layers dialog
  const [showImageLayers, setShowImageLayers] = useState(false);

  // Marker/Link editor state
  const [markerEditorTileId, setMarkerEditorTileId] = useState<TileId | null>(null);
  const [linkEditorTileId, setLinkEditorTileId] = useState<TileId | null>(null);
  const [showLinksMenu, setShowLinksMenu] = useState(false);

  // Terrain editor state
  const [showTerrainEditor, setShowTerrainEditor] = useState(false);

  const [placing, setPlacing] = useState<
    { kind: 'group'; id: Id } | { kind: 'vehicle'; id: Id } | null
  >(null);

  // The structure layer painting currently targets (guards against stale ids after map switch/delete)
  const activeStructureLayer = useMemo(
    () => activeMap?.structureLayers?.find((l) => l.id === activeStructureLayerId) ?? null,
    [activeMap, activeStructureLayerId]
  );

  // Travel wizard state
  const [showTravelWizard, setShowTravelWizard] = useState(false);
  const [travelStep, setTravelStep] = useState<1 | 2 | 3>(1);
  const [travelRoute, setTravelRoute] = useState<TileId[]>([]);
  const [stagedTravelingMemberIds, setStagedTravelingMemberIds] = useState<Id[]>([]);
  const [stagedVehicleId, setStagedVehicleId] = useState<Id | null>(null);

  const compositionGroups = useMemo(
    () => activeGroup ? getCompositionGroups(state, activeGroup) : [],
    [activeGroup, state.entities.travelGroups, state.entities.vehicles]
  );
  const compositionSources = useMemo(
    () => compositionGroups.map((group) => ({
      group,
      members: group.memberIds
        .map((memberId) => state.entities.characters[memberId])
        .filter((character) => character !== undefined),
    })),
    [compositionGroups, state.entities.characters]
  );
  const availableTravelVehicles = useMemo(
    () => activeGroup
      ? getCoLocatedVehicles(state, activeGroup).flatMap((vehicle) => {
          const type = state.entities.vehicleTypes?.[vehicle.typeId];
          return type ? [{ vehicle, type }] : [];
        })
      : [],
    [activeGroup, state.entities.vehicles, state.entities.vehicleTypes]
  );
  const stagedVehicle = stagedVehicleId
    ? state.entities.vehicles?.[stagedVehicleId] ?? null
    : null;
  const stagedVehicleType = stagedVehicle
    ? state.entities.vehicleTypes?.[stagedVehicle.typeId] ?? null
    : null;
  const travelMode = stagedVehicleType?.mode ?? 'foot';

  // Links on the party's current tile
  const partyTileLinks = useMemo(() => {
    if (!activeMap || !activeGroupTile) return [];
    const tile = activeMap.tilesById[activeGroupTile];
    if (!tile) return [];
    return tile.linkIds
      .map((lid) => activeMap.linksById[lid])
      .filter(Boolean);
  }, [activeMap, activeGroupTile]);

  // Reachable tiles (computed when in travel step 2)
  const reachableTileIds = useMemo(() => {
    if (!showTravelWizard || travelStep < 2 || !activeMap || !activeGroupTile) {
      return undefined;
    }
    const reachable = getReachableTiles(activeMap, activeGroupTile, travelMode, isGmMode);
    return reachable.size > 0 ? reachable : undefined;
  }, [showTravelWizard, travelStep, travelMode, activeMap, activeGroupTile, isGmMode]);

  const visibleTileIds = useMemo(() => {
    if (!activeMap || isGmMode || activeMap.visionMode === 'open') return undefined;
    const observers = new Set<TileId>([
      ...selectGroupsOnMap(state, activeMap.id).map(({ tileId }) => tileId),
      ...selectVehiclesOnMap(state, activeMap.id).map(({ tileId }) => tileId),
    ]);
    return computeVisibleTiles(activeMap, [...observers]);
  }, [activeMap, isGmMode, state]);

  const occupantsByTile = useMemo(() => {
    if (!activeMap) return new Map<TileId, string[]>();
    const occupants = new Map<TileId, string[]>();
    const add = (tileId: TileId, name: string) => {
      occupants.set(tileId, [...(occupants.get(tileId) ?? []), name]);
    };
    for (const { group, tileId } of selectGroupsOnMap(state, activeMap.id)) add(tileId, group.name);
    for (const { vehicle, tileId } of selectVehiclesOnMap(state, activeMap.id)) add(tileId, vehicle.name);
    return occupants;
  }, [activeMap, state]);

  const tokens = useMemo(
    () => activeMap
      ? buildMapTokens(state, activeMap.id, activeGroup?.id ?? null)
      : [],
    [
      activeMap,
      activeGroup?.id,
      state.entities.travelGroups,
      state.entities.vehicles,
      state.entities.vehicleTypes,
      state.entities.characters,
    ]
  );

  const headerGroups = useMemo(() => Object.values(state.entities.travelGroups ?? {}).map((group) => {
    const position = resolveGroupPosition(state, group);
    const vehicleName = group.vehicleId
      ? state.entities.vehicles?.[group.vehicleId]?.name ?? null
      : null;
    return {
      id: group.id,
      name: group.name,
      memberCount: group.memberIds.length,
      vehicleName,
      onThisMap: position?.mapId === activeMap?.id,
    };
  }), [activeMap?.id, state.entities.travelGroups, state.entities.vehicles]);

  const placementTargets = useMemo(() => {
    const vehicleTargets = Object.values(state.entities.vehicles ?? {})
      .sort((a, b) => Number(Boolean(a.position)) - Number(Boolean(b.position)) || a.name.localeCompare(b.name))
      .map((vehicle) => ({
        kind: 'vehicle' as const,
        id: vehicle.id,
        name: vehicle.name,
        unplaced: vehicle.position === null,
      }));
    return activeGroup
      ? [{
          kind: 'group' as const,
          id: activeGroup.id,
          name: activeGroup.name,
          unplaced: activeGroupPosition === null,
        }, ...vehicleTargets]
      : vehicleTargets;
  }, [activeGroup, activeGroupPosition, state.entities.vehicles]);

  const placingName = placing
    ? placing.kind === 'group'
      ? state.entities.travelGroups?.[placing.id]?.name ?? 'group'
      : state.entities.vehicles?.[placing.id]?.name ?? 'vehicle'
    : null;

  const mapsWithPresence = useMemo(() => {
    const present = new Set<string>();
    for (const mapId of Object.keys(maps.mapsById)) {
      if (groupsOnMap(state, mapId).length > 0 || vehiclesOnMap(state, mapId).length > 0) {
        present.add(mapId);
      }
    }
    return present;
  }, [maps.mapsById, state]);

  // Select map
  const handleSelectMap = useCallback(
    (mapId: string) => actions.mapSetActiveMap(mapId),
    [actions]
  );

  const handleSelectGroup = useCallback((groupId: Id) => {
    actions.partySetActiveGroup(groupId);
    setPlacing(null);
    setShowTravelWizard(false);
    setTravelStep(1);
    setTravelRoute([]);
    setStagedTravelingMemberIds([]);
    setStagedVehicleId(null);
  }, [actions]);

  // Create map
  const handleCreateMap = useCallback(
    (params: { name: string; description?: string; scaleMilesPerTile: MapScale; startTerrainId: TerrainId; climate: ClimateType }) => {
      actions.mapCreateMap(params);
      setShowCreateDialog(false);
    },
    [actions]
  );

  // Tile click
  const handleTileClick = useCallback(
    (tileId: TileId, _row: number, _col: number) => {
      if (!activeMap || !maps.activeMapId) return;

      if (placing) {
        if (placing.kind === 'group') actions.partyPlaceGroup(placing.id, maps.activeMapId, tileId);
        else actions.partyPlaceVehicle(placing.id, maps.activeMapId, tileId);
        actions.mapRevealTiles(maps.activeMapId, [tileId]);
        setPlacing(null);
        return;
      }

      // Travel wizard step 2: click to set destination
      if (showTravelWizard && travelStep === 2 && activeGroupTile) {
        if (tileId === activeGroupTile) return; // Can't route to self
        const route = findRoute(activeMap, activeGroupTile, tileId, travelMode, isGmMode);
        if (route.valid) {
          setTravelRoute(route.path);
        }
        return;
      }

      if (interactionMode === 'paint' && isGmMode && activeStructureLayer && (structureEraseMode || selectedTerrainId)) {
        actions.mapSetStructureCells(
          maps.activeMapId,
          activeStructureLayer.id,
          [tileId],
          structureEraseMode ? null : selectedTerrainId
        );
      } else if (interactionMode === 'paint' && selectedTerrainId && isGmMode) {
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
    [activeMap, activeGroupTile, maps.activeMapId, interactionMode, selectedTerrainId, isGmMode, actions, showTravelWizard, travelStep, travelMode, placing, activeStructureLayer, structureEraseMode]
  );

  const paintTile = useCallback(
    (tileId: TileId) => {
      if (!maps.activeMapId) return;
      if (activeStructureLayer) {
        if (!structureEraseMode && !selectedTerrainId) return;
        actions.mapSetStructureCells(
          maps.activeMapId,
          activeStructureLayer.id,
          [tileId],
          structureEraseMode ? null : selectedTerrainId
        );
      } else if (selectedTerrainId) {
        actions.mapSetTileTerrain(maps.activeMapId, tileId, selectedTerrainId, paintElevation ?? undefined);
      }
    },
    [maps.activeMapId, activeStructureLayer, structureEraseMode, selectedTerrainId, actions, paintElevation]
  );

  const handleTilePaintStart = useCallback(
    (tileId: TileId) => {
      if (showTravelWizard) return; // Disable painting during travel
      if (interactionMode === 'paint' && isGmMode) paintTile(tileId);
    },
    [interactionMode, isGmMode, showTravelWizard, paintTile]
  );

  const handleTilePaintEnter = useCallback(
    (tileId: TileId) => {
      if (!showTravelWizard && isGmMode) paintTile(tileId);
    },
    [showTravelWizard, isGmMode, paintTile]
  );

  // Context menu
  const handleTileContextMenu = useCallback(
    (tileId: TileId, row: number, col: number, e: TilePointerEvent) => {
      e.preventDefault();
      if (!isGmMode) return;
      setContextMenu({ tileId, row, col, x: e.clientX, y: e.clientY });
    },
    [isGmMode]
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleConfirmElevation = useCallback((elevation: number | null) => {
    if (maps.activeMapId && elevationDialogTileIds) {
      actions.mapSetTileElevation(maps.activeMapId, elevationDialogTileIds, elevation);
    }
    setElevationDialogTileIds(null);
  }, [actions, elevationDialogTileIds, maps.activeMapId]);

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

  // Add custom terrain
  const handleAddCustomTerrain = useCallback(
    (terrain: TerrainModel) => {
      if (!maps.activeMapId) return;
      actions.mapAddTerrain(maps.activeMapId, terrain);
      setSelectedTerrainId(terrain.id);
      setShowTerrainEditor(false);
    },
    [maps.activeMapId, actions]
  );

  // Structure layers
  const handleAddStructureLayer = useCallback(() => {
    if (!maps.activeMapId || !activeMap) return;
    const layers = activeMap.structureLayers ?? [];
    const nextBase = layers.length > 0
      ? Math.max(...layers.map((l) => l.baseElevation + l.heightLevels))
      : 1;
    const layer: StructureLayer = {
      id: `struct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: `Level ${layers.length + 1}`,
      baseElevation: Math.min(nextBase, MAX_ELEVATION),
      heightLevels: 1,
      cells: {},
      visible: true,
    };
    actions.mapAddStructureLayer(maps.activeMapId, layer);
    setActiveStructureLayerId(layer.id);
  }, [maps.activeMapId, activeMap, actions]);

  const handleUpdateStructureLayer = useCallback(
    (layerId: StructureLayerId, changes: Partial<Omit<StructureLayer, 'id' | 'cells'>>) => {
      if (maps.activeMapId) actions.mapUpdateStructureLayer(maps.activeMapId, layerId, changes);
    },
    [maps.activeMapId, actions]
  );

  const handleRemoveStructureLayer = useCallback(
    (layerId: StructureLayerId) => {
      if (maps.activeMapId) actions.mapRemoveStructureLayer(maps.activeMapId, layerId);
      setActiveStructureLayerId((current) => (current === layerId ? null : current));
    },
    [maps.activeMapId, actions]
  );

  const handleSelectStructureLayer = useCallback((layerId: StructureLayerId | null) => {
    setActiveStructureLayerId(layerId);
    if (layerId === null) setStructureEraseMode(false);
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
      if (!activeGroup) return;
      actions.mapSetActiveMap(link.toMapId);
      if (activeGroup.vehicleId) {
        actions.partyPlaceVehicle(activeGroup.vehicleId, link.toMapId, link.toTileId);
      } else {
        actions.partyPlaceGroup(activeGroup.id, link.toMapId, link.toTileId);
      }
      setShowLinksMenu(false);
    },
    [actions, activeGroup]
  );

  // Travel wizard handlers
  const handleOpenTravel = useCallback(() => {
    if (!activeMap || !activeGroup) return;
    setStagedTravelingMemberIds([...activeGroup.memberIds]);
    setStagedVehicleId(activeGroup.vehicleId);
    setTravelStep(1);
    setTravelRoute([]);
    setShowTravelWizard(true);
  }, [activeMap, activeGroup]);

  const handleCloseTravel = useCallback(() => {
    setShowTravelWizard(false);
    setTravelStep(1);
    setTravelRoute([]);
    setStagedTravelingMemberIds([]);
    setStagedVehicleId(null);
  }, []);

  const handleMoveTravelChip = useCallback((memberId: Id, to: PartyColumn) => {
    setStagedTravelingMemberIds((current) => {
      const contains = current.includes(memberId);
      if (to === 'traveling') return contains ? current : [...current, memberId];
      return contains ? current.filter((id) => id !== memberId) : current;
    });
  }, []);

  const handleSelectTravelVehicle = useCallback((vehicleId: Id | null) => {
    setStagedVehicleId(vehicleId);
    setTravelRoute([]);
  }, []);

  const handleTravelConfirm = useCallback(() => {
    if (!maps.activeMapId || !activeGroup || travelRoute.length < 2 || stagedTravelingMemberIds.length === 0) return;
    const sourceGroups = mapSourceGroupsByMember(compositionGroups);
    const compositionActions = buildCompositionActions(
      activeGroup,
      { travelingMemberIds: stagedTravelingMemberIds, vehicleId: stagedVehicleId },
      sourceGroups
    );
    applyCompositionActions(compositionActions, actions);
    const destTileId = travelRoute[travelRoute.length - 1];
    actions.mapExecuteTravel({
      mapId: maps.activeMapId,
      routeTileIds: travelRoute,
      destinationTileId: destTileId,
      mode: travelMode,
      gmOverride: isGmMode,
      groupId: activeGroup.id,
    });
    handleCloseTravel();
  }, [maps.activeMapId, activeGroup, travelMode, travelRoute, stagedTravelingMemberIds, stagedVehicleId, compositionGroups, isGmMode, actions, handleCloseTravel]);

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
          hasPartyOnMap={false}
          mapsWithPresence={mapsWithPresence}
          showTravelWizard={false}
          groups={headerGroups}
          activeGroupId={activeGroup?.id ?? null}
          onSelectGroup={handleSelectGroup}
          climateLabels={climateLabels}
          weatherTables={Object.values(state.locations.weatherTables)}
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
            climateLabels={climateLabels}
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
        hasPartyOnMap={!!activeGroupTile}
        mapsWithPresence={mapsWithPresence}
        groups={headerGroups}
        activeGroupId={activeGroup?.id ?? null}
        onSelectGroup={handleSelectGroup}
        showTravelWizard={showTravelWizard}
        onTravel={handleOpenTravel}
        placementTargets={placementTargets}
        placingName={placingName}
        onSelectPlacement={(kind, id) => setPlacing({ kind, id })}
        onCancelPlacement={() => setPlacing(null)}
        onUpdateMapSettings={(changes) => actions.mapUpdateMap(activeMap.id, changes)}
        climateLabels={climateLabels}
        weatherTables={Object.values(state.locations.weatherTables)}
        onOpenImages={() => setShowImageLayers(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Terrain palette (GM only, hidden during travel) */}
        {isGmMode && !showTravelWizard && (
          <TerrainPalette
            terrains={Object.values(activeMap.terrainById)}
            selectedTerrainId={selectedTerrainId}
            interactionMode={interactionMode}
            paintElevation={paintElevation}
            onSetPaintElevation={setPaintElevation}
            onSelectTerrain={handleSelectTerrain}
            onSetMode={setInteractionMode}
            onAddTerrain={() => setShowTerrainEditor(true)}
            structureLayers={activeMap.structureLayers ?? []}
            activeStructureLayerId={activeStructureLayer?.id ?? null}
            structureEraseMode={structureEraseMode}
            onSelectStructureLayer={handleSelectStructureLayer}
            onAddStructureLayer={handleAddStructureLayer}
            onUpdateStructureLayer={handleUpdateStructureLayer}
            onRemoveStructureLayer={handleRemoveStructureLayer}
            onSetStructureEraseMode={setStructureEraseMode}
          />
        )}

        {/* Three-dimensional map scene */}
        <Map3DView
          map={activeMap}
          isGmMode={isGmMode}
          visionMode={activeMap.visionMode}
          selectedTileIds={selectedTileIds.size > 0 ? selectedTileIds : undefined}
          routeTileIds={travelRoute.length > 1 ? travelRoute : undefined}
          reachableTileIds={reachableTileIds}
          visibleTileIds={visibleTileIds}
          paintModeActive={
            interactionMode === 'paint' && isGmMode && !showTravelWizard
            && (!!selectedTerrainId || (!!activeStructureLayer && structureEraseMode))
          }
          placingToken={placing !== null}
          focusTileId={activeGroupTile}
          tokens={tokens}
          occupantsByTile={occupantsByTile}
          onTileClick={handleTileClick}
          onTileContextMenu={handleTileContextMenu}
          onTilePaintStart={handleTilePaintStart}
          onTilePaintEnter={handleTilePaintEnter}
        />

        {/* Travel wizard panel */}
        {showTravelWizard && activeGroup && (
          <TravelWizard
            map={activeMap}
            step={travelStep}
            selectedMode={travelMode}
            routeTileIds={travelRoute}
            isGmMode={isGmMode}
            group={activeGroup}
            characters={state.entities.characters}
            sources={compositionSources}
            travelingMemberIds={stagedTravelingMemberIds}
            selectedVehicleId={stagedVehicleId}
            availableVehicles={availableTravelVehicles}
            vehicle={stagedVehicle}
            vehicleType={stagedVehicleType}
            startTileId={activeGroupTile}
            day={state.time.day}
            slot={state.time.slot}
            downtimeState={state.downtime}
            onSetStep={setTravelStep}
            onMoveChip={handleMoveTravelChip}
            onSelectVehicle={handleSelectTravelVehicle}
            onClearRoute={() => setTravelRoute([])}
            onConfirm={handleTravelConfirm}
            onClose={handleCloseTravel}
          />
        )}
      </div>

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
          onSetElevation={setElevationDialogTileIds}
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
          climateLabels={climateLabels}
        />
      )}

      {/* Terrain editor dialog */}
      {showTerrainEditor && (
        <TerrainEditor
          onConfirm={handleAddCustomTerrain}
          onCancel={() => setShowTerrainEditor(false)}
        />
      )}

      {/* Image layers dialog (GM only) */}
      {showImageLayers && isGmMode && maps.activeMapId && (
        <ImageLayersDialog
          map={activeMap}
          onAddLayer={(layer) => actions.mapAddImageLayer(activeMap.id, layer)}
          onUpdateLayer={(layerId, changes) => actions.mapUpdateImageLayer(activeMap.id, layerId, changes)}
          onRemoveLayer={(layerId) => actions.mapRemoveImageLayer(activeMap.id, layerId)}
          onClose={() => setShowImageLayers(false)}
        />
      )}

      {elevationDialogTileIds && (
        <ElevationDialog
          tileCount={elevationDialogTileIds.length}
          onConfirm={handleConfirmElevation}
          onCancel={() => setElevationDialogTileIds(null)}
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
