import { lazy, Suspense, useMemo, useRef, useCallback, useState, useEffect, ReactNode, KeyboardEvent, MouseEvent, ChangeEvent } from 'react';
import { ChevronLeft, ChevronRight, Plus, MoreVertical, Coins, Undo2, Redo2 } from 'lucide-react';
import {
  CharacterSkillsPanel,
  CharacterEquipmentPanel,
  CharacterInventoryPanel,
} from '../components/character-panels';
import {
  CharacterCreationModal,
  CharacterContextMenu,
  AwardPointsModal,
  PointSpendModal,
  CharacterCompareModal,
  CharacterStatusEditor,
  type CharacterContextMenuAction,
} from '../components/character-management';
import { CharacterStatusBadge } from '../components/downtime/views/CharacterStatusBadge';
import { createCharacterTemplateSnapshot, duplicateCharacter, downloadCharacterJSON, downloadCharacterText } from '../utils/characterManagement';
import { characterLog } from '../utils/activityLogger';
import { parseCharacterText } from '../utils/characterImport';
import { WeatherWidget, MealBuffWidget, TimeDisplay, TimeControls } from '../components/header';
import { CombatTile } from '../components/combat/CombatTile';
import { CombatContextProvider } from '../components/combat/CombatContext';
import { TabErrorBoundary } from '../components/ui/TabErrorBoundary';
import { ThemeDevToggle } from '../components/ui/ThemeDevToggle';
import { PanelLayoutProvider, usePanelLayout } from '../contexts/PanelLayoutContext';
import {
  useCampaignActions,
  useCampaignCharacters,
  useCampaignHistory,
  useCampaignSelector,
  useSelectedCharacter,
  useSelectedCharacterId
} from '../state/campaignStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { KeyboardShortcutsModal } from '../components/ui/KeyboardShortcutsModal';
import type { CampaignState } from '../state/campaignReducer';
import { useAllCharacterSlotSummaries } from '../hooks/useCharacterSlotSummary';
import { isCharacterIncapacitated } from '../state/downtime/downtimeSelectors';
import type { Character } from '../types/campaign';

const InventoryTab = lazy(() =>
  import('../components/InventoryTab').then((module) => ({ default: module.InventoryTab })),
);
const ManagerTab = lazy(() =>
  import('../components/ManagerTab').then((module) => ({ default: module.ManagerTab })),
);
const RulesTab = lazy(() =>
  import('../components/RulesTab').then((module) => ({ default: module.RulesTab })),
);
const ChangelogTab = lazy(() =>
  import('../components/ChangelogTab').then((module) => ({ default: module.ChangelogTab })),
);
const DowntimePanel = lazy(() =>
  import('../components/downtime').then((module) => ({ default: module.DowntimePanel })),
);
const CharacterSheet = lazy(() =>
  import('../components/character-sheet').then((module) => ({ default: module.CharacterSheet })),
);
const CombatTab = lazy(() =>
  import('../components/CombatTab').then((module) => ({ default: module.CombatTab })),
);
const MapPanel = lazy(() =>
  import('../components/map').then((module) => ({ default: module.MapPanel })),
);
const CombatParticipantsSidebar = lazy(() =>
  import('../components/combat/CombatParticipantsSidebar').then((module) => ({
    default: module.CombatParticipantsSidebar,
  })),
);
const CombatManeuverRail = lazy(() =>
  import('../components/combat/CombatManeuverRail').then((module) => ({
    default: module.CombatManeuverRail,
  })),
);
const CombatMainArea = lazy(() =>
  import('../components/combat/CombatMainArea').then((module) => ({ default: module.CombatMainArea })),
);

function LazyLoadFallback() {
  return (
    <div className="flex h-full min-h-32 items-center justify-center rounded bg-surface-0/60 text-sm text-fg-muted">
      Loading…
    </div>
  );
}

function LazyContent({ tabName, children }: { tabName: string; children: ReactNode }) {
  return (
    <TabErrorBoundary tabName={tabName}>
      <Suspense fallback={<LazyLoadFallback />}>{children}</Suspense>
    </TabErrorBoundary>
  );
}

interface ModuleDefinition {
  id: string;
  label: string;
  content: ReactNode;
}

interface UnifiedShellProps {
  modules?: ModuleDefinition[];
}

// Slice selectors (Phase 15b): the shell subscribes to exactly what it renders,
// so unrelated dispatches (logs, combat rolls, inventory moves) no longer
// re-render the whole chrome.
const selectTimeDay = (state: CampaignState) => state.time?.day ?? 1;
const selectTimeSlot = (state: CampaignState) => state.time?.slot ?? 0;
const selectActiveModuleId = (state: CampaignState) => state.ui.activeModule;
const selectCharacterPanelView = (state: CampaignState) => state.ui.characterPanelView;
const selectGmModeEnabled = (state: CampaignState) => state.ui.gmModeEnabled;
const selectDebugMode = (state: CampaignState) => state.ui.debugMode;
const selectBlockingError = (state: CampaignState) => state.ui.blockingError;
const selectIsCombatActive = (state: CampaignState) => !!state.combat.activeSession;
const selectCombatMapId = (state: CampaignState) => state.combat.activeSession?.mapId ?? null;
const selectCharactersById = (state: CampaignState) => state.entities.characters;
const selectCharacterTemplates = (state: CampaignState) => state.entities.characterTemplates;

/**
 * Inner component that uses PanelLayoutContext
 */
function UnifiedShellInner({ modules }: UnifiedShellProps) {
  const characters = useCampaignCharacters();
  const { state: layoutState, actions: layoutActions } = usePanelLayout();

  const actions = useCampaignActions();
  const timeDay = useCampaignSelector(selectTimeDay);
  const timeSlot = useCampaignSelector(selectTimeSlot);
  const activeModuleId = useCampaignSelector(selectActiveModuleId);
  const characterPanelView = useCampaignSelector(selectCharacterPanelView);
  const gmModeEnabled = useCampaignSelector(selectGmModeEnabled);
  const debugMode = useCampaignSelector(selectDebugMode);
  const blockingError = useCampaignSelector(selectBlockingError);
  const isCombatActive = useCampaignSelector(selectIsCombatActive);
  const combatMapId = useCampaignSelector(selectCombatMapId);
  const charactersById = useCampaignSelector(selectCharactersById);
  const characterTemplates = useCampaignSelector(selectCharacterTemplates);
  const { canUndo, canRedo, undo, redo } = useCampaignHistory();

  // Keyboard shortcuts + help overlay (Phase 15c)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const toggleShortcutsHelp = useCallback(() => setShowShortcutsHelp((visible) => !visible), []);
  useKeyboardShortcuts({ onToggleHelp: toggleShortcutsHelp });

  const availableModules = useMemo<ModuleDefinition[]>(() => {
    if (modules?.length) {
      return modules;
    }
    return [
      { id: 'inventory', label: 'Inventory', content: <LazyContent tabName="Inventory"><InventoryTab /></LazyContent> },
      {
        id: 'downtime',
        label: 'Downtime',
        content: (
          <LazyContent tabName="Downtime">
            <DowntimePanel
              currentDayKey={timeDay}
              currentSlot={timeSlot}
            />
          </LazyContent>
        ),
      },
      { id: 'combat', label: 'Combat', content: <LazyContent tabName="Combat"><CombatTab /></LazyContent> },
      { id: 'map', label: 'Map', content: <LazyContent tabName="Map"><MapPanel /></LazyContent> },
      {
        id: 'manager',
        label: 'Manager',
        content: <LazyContent tabName="Manager"><ManagerTab /></LazyContent>
      },
      { id: 'rules', label: 'Rules', content: <LazyContent tabName="Rules"><RulesTab /></LazyContent> },
      { id: 'changelog', label: 'Changelog', content: <LazyContent tabName="Changelog"><ChangelogTab /></LazyContent> },
    ];
  }, [modules, timeDay, timeSlot]);
  const activeModule = activeModuleId ? availableModules.find((moduleItem) => moduleItem.id === activeModuleId) : null;
  const selectedCharacterId = useSelectedCharacterId();
  const selectedCharacter = useSelectedCharacter();
  const sortedCharacters = useMemo(
    () => [...characters].sort((a, b) => a.name.localeCompare(b.name)),
    [characters]
  );

  // Get character IDs for downtime status lookup
  const characterIds = useMemo(
    () => sortedCharacters.map((c) => c.id),
    [sortedCharacters]
  );

  // Get downtime status summaries for all characters
  const characterSummaries = useAllCharacterSlotSummaries(characterIds);

  // Character creation modal state
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [showAwardPointsModal, setShowAwardPointsModal] = useState(false);
  const [spendPointsCharacterId, setSpendPointsCharacterId] = useState<string | null>(null);
  const [compareCharacterId, setCompareCharacterId] = useState<string | null>(null);
  const [editRequestToken, setEditRequestToken] = useState(0);
  const [statusCharacterId, setStatusCharacterId] = useState<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    characterId: string;
    characterName: string;
    position: { x: number; y: number };
  } | null>(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    characterId: string;
    characterName: string;
  } | null>(null);

  // File import handling
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Reject files over 50MB
      const MAX_FILE_SIZE = 50 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        alert('File is too large. Maximum import size is 50MB.');
        event.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          try {
            const character = parseCharacterText(text);
            actions.addCharacter(character);
            actions.selectCharacter(character.id);
          } catch (error) {
            console.error('Failed to parse character file:', error);
            const message = error instanceof Error ? error.message : 'Unknown format';
            alert(`Failed to parse character file: ${message}`);
          }
        }
      };
      reader.readAsText(file);

      // Reset the input so the same file can be imported again
      event.target.value = '';
    },
    [actions]
  );

  // Handle character creation
  const handleCharacterCreated = useCallback(
    (character: Character) => {
      actions.addCharacter(character);
      actions.selectCharacter(character.id);
    },
    [actions]
  );

  // Handle context menu open
  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLButtonElement>, character: Character) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        characterId: character.id,
        characterName: character.name,
        position: { x: event.clientX, y: event.clientY },
      });
    },
    []
  );

  // Handle context menu actions
  const handleContextMenuAction = useCallback(
    (action: CharacterContextMenuAction) => {
      const character = characters.find((c) => c.id === action.characterId);
      if (!character) return;

      switch (action.type) {
        case 'view':
          actions.selectCharacter(action.characterId);
          actions.setCharacterPanelView('sheet');
          break;
        case 'edit':
          actions.selectCharacter(action.characterId);
          actions.setCharacterPanelView('sheet');
          setEditRequestToken((current) => current + 1);
          break;
        case 'status':
          setStatusCharacterId(action.characterId);
          break;
        case 'spendPoints':
          actions.selectCharacter(action.characterId);
          actions.setCharacterPanelView('sheet');
          setSpendPointsCharacterId(action.characterId);
          break;
        case 'saveTemplate': {
          const name = window.prompt('Template name', character.name)?.trim();
          if (!name) break;
          const description = window.prompt('Template description', `Build based on ${character.name}`)?.trim() ?? '';
          actions.upsertCharacterTemplate(createCharacterTemplateSnapshot(character, name, description));
          break;
        }
        case 'compare':
          setCompareCharacterId(action.characterId);
          break;
        case 'duplicate': {
          const duplicated = duplicateCharacter(character);
          actions.addCharacter(duplicated);
          actions.selectCharacter(duplicated.id);
          break;
        }
        case 'export':
          downloadCharacterJSON(character);
          break;
        case 'exportText':
          downloadCharacterText(character);
          break;
        case 'delete':
          setDeleteConfirm({
            characterId: action.characterId,
            characterName: character.name,
          });
          break;
      }
    },
    [actions, characters]
  );

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(() => {
    if (deleteConfirm) {
      // If deleting the selected character, clear selection
      if (selectedCharacterId === deleteConfirm.characterId) {
        actions.selectCharacter(null);
      }
      actions.removeCharacter(deleteConfirm.characterId);
      setDeleteConfirm(null);
    }
  }, [actions, deleteConfirm, selectedCharacterId]);

  // Compute grid columns based on panel states
  const isPartyCollapsed = layoutState.partyColumn === 'collapsed';
  const isRailCollapsed = layoutState.railColumn === 'collapsed';
  const isCenterExpanded = layoutState.centerPanel === 'expanded';
  const isRightExpanded = layoutState.rightPanel === 'expanded';

  // Combat layout: when combat is active WITH a linked map, take over the whole shell
  const combatHasMap = !!combatMapId;
  const combatLayoutActive = isCombatActive && combatHasMap;

  // Character panel should hide when no character is selected or party is collapsed
  const shouldHideCharacterPanel = !selectedCharacterId || isPartyCollapsed;

  // Module pane should hide when no module is selected or rail is collapsed
  // Exception: Combat module can be shown even when rail is collapsed (accessed via CombatTile)
  const shouldHideModulePane = !activeModule || (isRailCollapsed && activeModuleId !== 'combat');

  const gridTemplateColumns = useMemo(() => {
    const collapsedWidth = '56px'; // Same width for both collapsed rails (w-8 button + p-2 padding + border)
    const railWidth = isRailCollapsed ? collapsedWidth : '160px';
    const partyWidth = isPartyCollapsed ? collapsedWidth : '220px';
    const modulePaneWidth = shouldHideModulePane ? '0px' : 'minmax(0, 1fr)';
    // Scroll edge decorative columns - 4px wide lines with 8px dark gap between
    const scrollEdge = '4px';
    const scrollGap = '8px';

    // Combat map layout: party(220) | edges | 0px center | big map area | edges | rail(160)
    if (combatLayoutActive) {
      return `220px ${scrollEdge} ${scrollGap} ${scrollEdge} 0px minmax(0, 1fr) ${scrollEdge} ${scrollGap} ${scrollEdge} 160px`;
    }

    if (isPartyCollapsed) {
      // Party collapsed - character panel always hidden, give space to right panel
      // Grid: party | scrollL1 | gapL | scrollL2 | center | modulepane | scrollR1 | gapR | scrollR2 | rail
      return `${partyWidth} ${scrollEdge} ${scrollGap} ${scrollEdge} 0px ${modulePaneWidth} ${scrollEdge} ${scrollGap} ${scrollEdge} ${railWidth}`;
    }
    if (shouldHideCharacterPanel) {
      // No character selected - hide center, expand right
      return `${partyWidth} ${scrollEdge} ${scrollGap} ${scrollEdge} 0px ${modulePaneWidth} ${scrollEdge} ${scrollGap} ${scrollEdge} ${railWidth}`;
    }
    if (isCenterExpanded) return `${partyWidth} ${scrollEdge} ${scrollGap} ${scrollEdge} minmax(0, 2fr) 0px ${scrollEdge} ${scrollGap} ${scrollEdge} ${railWidth}`;
    if (isRightExpanded) return `${partyWidth} ${scrollEdge} ${scrollGap} ${scrollEdge} 0px minmax(0, 2fr) ${scrollEdge} ${scrollGap} ${scrollEdge} ${railWidth}`;
    return `${partyWidth} ${scrollEdge} ${scrollGap} ${scrollEdge} minmax(0, 1fr) ${modulePaneWidth} ${scrollEdge} ${scrollGap} ${scrollEdge} ${railWidth}`;
  }, [isPartyCollapsed, isCenterExpanded, isRightExpanded, shouldHideCharacterPanel, isRailCollapsed, shouldHideModulePane, combatLayoutActive]);

  // Clear active module when rail collapses (except for combat, which has its own tile)
  useEffect(() => {
    if (isRailCollapsed && activeModuleId !== 'combat') {
      actions.setActiveModule('');
    }
  }, [isRailCollapsed, activeModuleId, actions]);

  const shellContent = (
    <div className="min-h-screen bg-surface-0 text-fg-bright flex flex-col">
      {/* Header - Redesigned with Weather, Time Display, and Time Controls */}
      <header className="bg-surface-1 border-b border-edge px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Weather Widget */}
          <div className="flex items-center gap-4">
            <WeatherWidget compact />
            <MealBuffWidget compact />
          </div>

          {/* Center: Time Display and Controls */}
          <div className="flex items-center gap-3">
            <TimeDisplay />
            {gmModeEnabled && <TimeControls compact />}
            <div className="flex items-center gap-1" data-testid="undo-redo-controls">
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                className="rounded border border-edge-strong bg-surface-2/50 p-1.5 text-fg-secondary hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
                data-testid="undo-button"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                className="rounded border border-edge-strong bg-surface-2/50 p-1.5 text-fg-secondary hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                title="Redo (Ctrl+Shift+Z)"
                aria-label="Redo"
                data-testid="redo-button"
              >
                <Redo2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Right: Debug controls and blocking errors */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-fg-secondary">
            {import.meta.env.DEV && <ThemeDevToggle />}
            {debugMode && (
              <div className="rounded border border-warning-500/50 bg-warning-500/10 px-2 py-1 text-xs text-warning-100">
                Debug mode
              </div>
            )}
            {gmModeEnabled && (
              <button
                type="button"
                onClick={actions.toggleDebug}
                className="rounded border border-warning-500/60 bg-warning-500/10 px-3 py-1 text-xs font-semibold text-warning-100 hover:border-warning-300"
              >
                {debugMode ? 'Disable Debug' : 'Enable Debug'}
              </button>
            )}
            {blockingError && (
              <div
                className="rounded border border-warning-500/60 bg-warning-500/10 px-3 py-2 text-xs text-warning-100"
                data-testid="blocking-error"
              >
                <div className="font-semibold">{blockingError.reason}</div>
                <ul className="mt-1 list-disc pl-4">
                  {blockingError.suggestedFixes.map((fix) => (
                    <li key={fix}>{fix}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <div
        className="flex-1 min-h-0 grid gap-4 p-6 transition-all duration-300"
        style={{ gridTemplateColumns, gridTemplateRows: '1fr' }}
      >
        {/* Party Column - Collapsible (swapped to Participants during combat) */}
        <section
          className={`rounded border border-edge bg-surface-1/60 overflow-hidden transition-all duration-300 ${
            combatLayoutActive ? 'p-3' : isPartyCollapsed ? 'p-2 min-w-[56px]' : 'p-4'
          }`}
        >
          {combatLayoutActive ? (
            <LazyContent tabName="Combat Participants">
              <CombatParticipantsSidebar />
            </LazyContent>
          ) : (
            <>

          <div className={`flex items-center mb-2 ${isPartyCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!isPartyCollapsed && (
              <h2 className="text-sm uppercase tracking-wide text-fg-muted">Party</h2>
            )}
            <button
              type="button"
              onClick={layoutActions.togglePartyColumn}
              className="p-1 rounded hover:bg-surface-2 text-fg-muted hover:text-fg-primary"
              title={isPartyCollapsed ? 'Expand party column' : 'Collapse party column'}
            >
              {isPartyCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {!isPartyCollapsed && (
            <div className="space-y-2">
              {sortedCharacters.map((character: Character) => {
                const isSelected = character.id === selectedCharacterId;
                // Get HP/FP from gcsData, using defaults if not available
                const hp = character.gcsData?.pools.HP ?? { current: 10, max: 10 };
                const fp = character.gcsData?.pools.FP ?? { current: 10, max: 10 };
                const hpDisplay = `${hp.current} HP`;
                const fpDisplay = `${fp.current} FP`;

                // Get downtime status for this character
                const downtimeSummary = characterSummaries.get(character.id);

                // Determine highlight class based on downtime availability
                // Green = available; Red = assigned in this slot or incapacitated.
                const isUnavailable = !!downtimeSummary?.isAssigned || isCharacterIncapacitated(character);
                const downtimeHighlightClass = isUnavailable
                  ? 'border-2 border-danger-500'
                  : 'border-2 border-success-500';

                // Fatigue background tint (layered alongside availability border)
                const fatigueBgClass =
                  downtimeSummary?.fatigueStatus === 'exhausted' ? 'bg-danger-900/20' :
                  downtimeSummary?.fatigueStatus === 'tired' ? 'bg-yellow-900/20' :
                  '';

                return (
                  <div
                    key={character.id}
                    role="button"
                    tabIndex={isUnavailable ? -1 : 0}
                    aria-disabled={isUnavailable}
                    data-testid={`party-character-${character.id}`}
                    data-selected={isSelected}
                    data-fatigue={downtimeSummary?.fatigueStatus}
                    data-assigned={downtimeSummary?.isAssigned}
                    onClick={() => {
                      if (isUnavailable) return;
                      actions.selectCharacter(isSelected ? null : character.id);
                    }}
                    onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                      if (isUnavailable) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        actions.selectCharacter(isSelected ? null : character.id);
                      }
                    }}
                    className={`rounded p-3 transition-colors ${downtimeHighlightClass} ${
                      isUnavailable
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer'
                    } ${
                      isSelected && !isUnavailable
                        ? 'bg-accent-500/10'
                        : (fatigueBgClass || 'bg-surface-0')
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold truncate ${isUnavailable ? 'text-fg-muted' : 'text-fg-bright'}`}>{character.name}</span>
                          {downtimeSummary && <CharacterStatusBadge summary={downtimeSummary} status={character.status} />}
                        </div>
                        <div className="text-xs text-fg-muted">
                          {hpDisplay} / {fpDisplay}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e, character);
                        }}
                        className="p-1 rounded flex-shrink-0 hover:bg-surface-2 text-fg-muted hover:text-fg-primary"
                        title="Character options"
                        data-testid={`character-menu-${character.id}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isUnavailable}
                        className={`rounded border px-2 py-1 text-xs ${isUnavailable ? 'border-edge text-fg-faint cursor-not-allowed' : 'border-edge-strong text-fg-primary hover:border-edge-bright'}`}
                        onClick={(event: MouseEvent<HTMLButtonElement>) => {
                          event.stopPropagation();
                          if (isUnavailable) return;
                          actions.selectCharacter(character.id);
                          actions.setCharacterPanelView('skills');
                        }}
                      >
                        Skills
                      </button>
                      <button
                        type="button"
                        disabled={isUnavailable}
                        className={`rounded border px-2 py-1 text-xs ${isUnavailable ? 'border-edge text-fg-faint cursor-not-allowed' : 'border-edge-strong text-fg-primary hover:border-edge-bright'}`}
                        onClick={(event: MouseEvent<HTMLButtonElement>) => {
                          event.stopPropagation();
                          if (isUnavailable) return;
                          actions.selectCharacter(character.id);
                          actions.setCharacterPanelView('equipment');
                        }}
                      >
                        Equipment
                      </button>
                      <button
                        type="button"
                        disabled={isUnavailable}
                        className={`rounded border px-2 py-1 text-xs ${isUnavailable ? 'border-edge text-fg-faint cursor-not-allowed' : 'border-edge-strong text-fg-primary hover:border-edge-bright'}`}
                        onClick={(event: MouseEvent<HTMLButtonElement>) => {
                          event.stopPropagation();
                          if (isUnavailable) return;
                          actions.selectCharacter(character.id);
                          actions.setCharacterPanelView('inventory');
                        }}
                      >
                        Inventory
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Add Character and Import Buttons */}
              <div className="mt-4 border-t border-edge pt-4 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreationModal(true)}
                  className="flex items-center justify-center gap-1 rounded border border-accent-500 bg-accent-500/10 px-2 py-2 text-xs font-semibold text-accent-200 hover:bg-accent-500/20"
                  data-testid="add-character-button"
                >
                  <Plus className="h-4 w-4" />
                  Add Character
                </button>
                <button
                  type="button"
                  onClick={() => setShowAwardPointsModal(true)}
                  className="flex items-center justify-center gap-1 rounded border border-emerald-500 bg-emerald-500/10 px-2 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
                  data-testid="award-points-button"
                >
                  <Coins className="h-4 w-4" />
                  Award Points
                </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.gcs,.json"
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="character-import-input"
                />
                <button
                  type="button"
                  onClick={handleImportClick}
                  className="w-full rounded border border-edge-bright bg-surface-1 px-4 py-2 text-sm font-semibold text-fg-bright hover:border-edge-bright"
                  data-testid="character-import-button"
                >
                  Quick Import
                </button>
              </div>
            </div>
          )}

          {/* Collapsed state - show character initials */}
          {isPartyCollapsed && (
            <div className="flex flex-col gap-1">
              {sortedCharacters.map((character: Character) => {
                const isSelected = character.id === selectedCharacterId;
                const initials = character.name.split(' ').map(n => n[0]).join('').slice(0, 2);
                const collapsedSummary = characterSummaries.get(character.id);
                const collapsedUnavailable = !!collapsedSummary?.isAssigned;
                return (
                  <button
                    key={character.id}
                    type="button"
                    disabled={collapsedUnavailable}
                    onClick={() => {
                      if (collapsedUnavailable) return;
                      actions.selectCharacter(isSelected ? null : character.id);
                    }}
                    className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center ${
                      collapsedUnavailable
                        ? 'border-2 border-danger-500 bg-surface-0 text-fg-faint opacity-50 cursor-not-allowed'
                        : isSelected
                          ? 'border-2 border-accent-500 bg-accent-500/20 text-accent-200'
                          : 'border-2 border-success-500 bg-surface-0 text-fg-secondary hover:border-success-400'
                    }`}
                    title={collapsedUnavailable ? `${character.name} (unavailable)` : character.name}
                  >
                    {initials}
                  </button>
                );
              })}
            </div>
          )}
            </>
          )}
        </section>

        {/* Left Scroll Edge 1 - decorative line (inner, next to party) */}
        <div className="flex items-center justify-center py-3">
          <div className="w-full h-[calc(100%-1.5rem)] rounded bg-surface-2/40" />
        </div>

        {/* Left Scroll Gap - dark space between lines */}
        <div />

        {/* Left Scroll Edge 2 - decorative line (outer, next to content) */}
        <div className="flex items-center justify-center py-3">
          <div className="w-full h-[calc(100%-1.5rem)] rounded bg-surface-2/40" />
        </div>

        {/* Center Panel - Character Sheet/Skills/Equipment/Inventory (always in DOM to maintain grid structure) */}
        <section
          className={`overflow-hidden transition-all duration-300 ${
            shouldHideCharacterPanel || isRightExpanded
              ? 'invisible'
              : 'rounded border border-edge bg-surface-1/60'
          }`}
        >
          <div className="h-full" data-testid="character-pane">
            {selectedCharacter && characterPanelView === 'sheet' && (
              <LazyContent tabName="Character Sheet">
                <CharacterSheet
                  character={selectedCharacter}
                  editRequestToken={editRequestToken}
                  onSpendPoints={() => setSpendPointsCharacterId(selectedCharacter.id)}
                />
              </LazyContent>
            )}
            {selectedCharacter && characterPanelView === 'skills' && (
              <CharacterSkillsPanel character={selectedCharacter} />
            )}
            {selectedCharacter && characterPanelView === 'equipment' && (
              <CharacterEquipmentPanel character={selectedCharacter} />
            )}
            {selectedCharacter && characterPanelView === 'inventory' && (
              <CharacterInventoryPanel character={selectedCharacter} />
            )}
          </div>
        </section>

        {/* Right Panel - Module Pane (or Combat Map when combatLayoutActive) */}
        <section
          className={`overflow-hidden flex flex-col transition-all duration-300 ${
            combatLayoutActive
              ? 'rounded border border-edge bg-surface-1/60'
              : isCenterExpanded || shouldHideModulePane
                ? 'invisible'
                : 'rounded border border-edge bg-surface-1/60 p-4'
          }`}
        >
          {combatLayoutActive ? (
            <LazyContent tabName="Combat Map">
              <CombatMainArea />
            </LazyContent>
          ) : (
            activeModule && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm uppercase tracking-wide text-fg-muted">
                    {activeModule.label}
                  </h2>
                </div>
                <div className="mt-4 flex-1 min-h-0 overflow-y-auto">{activeModule.content}</div>
              </>
            )
          )}
        </section>

        {/* Right Scroll Edge 1 - decorative line (outer, next to content) */}
        <div className="flex items-center justify-center py-3">
          <div className="w-full h-[calc(100%-1.5rem)] rounded bg-surface-2/40" />
        </div>

        {/* Right Scroll Gap - dark space between lines */}
        <div />

        {/* Right Scroll Edge 2 - decorative line (inner, next to rail) */}
        <div className="flex items-center justify-center py-3">
          <div className="w-full h-[calc(100%-1.5rem)] rounded bg-surface-2/40" />
        </div>

        {/* Rail - Module Navigation (or Maneuvers during combat) */}
        <aside
          className={`rounded border border-edge bg-surface-1/60 overflow-hidden transition-all duration-300 ${
            combatLayoutActive ? 'p-3' : isRailCollapsed ? 'p-2 min-w-[56px]' : 'p-4'
          }`}
        >
          {combatLayoutActive ? (
            <LazyContent tabName="Combat Maneuvers">
              <CombatManeuverRail />
            </LazyContent>
          ) : (
            <>
          {/* Header with toggle button - matching Party collapsed structure */}
          <div className={`flex items-center mb-2 ${isRailCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!isRailCollapsed && (
              <h2 className="text-sm uppercase tracking-wide text-fg-muted">Rail</h2>
            )}
            <button
              type="button"
              onClick={layoutActions.toggleRailColumn}
              className="p-1 rounded hover:bg-surface-2 text-fg-muted hover:text-fg-primary"
              title={isRailCollapsed ? 'Expand rail' : 'Collapse rail'}
            >
              {isRailCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {/* Module buttons - expanded view */}
          {/* Note: 'combat' is excluded from rail - it has a dedicated CombatTile at the bottom */}
          {!isRailCollapsed && (
            <div className="space-y-2">
              {availableModules.filter(m => m.id !== 'combat').map((moduleItem) => {
                const isSelected = activeModuleId === moduleItem.id;
                return (
                  <button
                    key={moduleItem.id}
                    type="button"
                    data-testid={`rail-module-${moduleItem.id}`}
                    onClick={() => actions.setActiveModule(moduleItem.id)}
                    title={moduleItem.label}
                    className={`rounded border transition-colors px-3 py-2 w-full text-sm ${
                      isSelected
                        ? 'border-accent-500 bg-accent-500/20 text-accent-200'
                        : 'border-edge bg-surface-0 text-fg-primary hover:border-edge-bright'
                    }`}
                  >
                    {moduleItem.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Module buttons - collapsed view (matching Party collapsed style exactly) */}
          {/* Note: 'combat' is excluded from rail - it has a dedicated CombatTile at the bottom */}
          {isRailCollapsed && (
            <div className="flex flex-col gap-1">
              {availableModules.filter(m => m.id !== 'combat').map((moduleItem) => {
                const isSelected = activeModuleId === moduleItem.id;
                return (
                  <button
                    key={moduleItem.id}
                    type="button"
                    data-testid={`rail-module-${moduleItem.id}`}
                    onClick={() => actions.setActiveModule(moduleItem.id)}
                    title={moduleItem.label}
                    className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center ${
                      isSelected
                        ? 'border border-accent-500 bg-accent-500/20 text-accent-200'
                        : 'border border-edge bg-surface-0 text-fg-secondary hover:border-edge-bright'
                    }`}
                  >
                    {moduleItem.label.charAt(0)}
                  </button>
                );
              })}
            </div>
          )}
            </>
          )}
        </aside>
      </div>

      {/* Footer - Combat Tile */}
      <div className="px-6 pb-6">
        <CombatTile />
      </div>

      {/* Modal Overlay */}
      {layoutState.modalContent && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={layoutActions.closeModal}
        >
          <div
            className="bg-surface-1 rounded-lg border border-edge-strong max-w-4xl max-h-[90vh] overflow-auto m-4"
            onClick={(e) => e.stopPropagation()}
          >
            {layoutState.modalTitle && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
                <h2 className="text-lg font-semibold">{layoutState.modalTitle}</h2>
                <button
                  type="button"
                  onClick={layoutActions.closeModal}
                  className="text-fg-muted hover:text-fg-primary"
                >
                  ×
                </button>
              </div>
            )}
            <div className="p-6">
              {layoutState.modalContent}
            </div>
          </div>
        </div>
      )}

      {/* Character Creation Modal */}
      {showCreationModal && (
        <CharacterCreationModal
          onClose={() => setShowCreationModal(false)}
          onCharacterCreated={handleCharacterCreated}
          templates={Object.values(characterTemplates ?? {})}
          onNpcsGenerated={(names, templateName) => actions.addLogEntry(characterLog.npcGenerated(names, templateName))}
        />
      )}

      {showAwardPointsModal && (
        <AwardPointsModal characters={sortedCharacters} onClose={() => setShowAwardPointsModal(false)} />
      )}

      {spendPointsCharacterId && charactersById[spendPointsCharacterId] && (
        <PointSpendModal
          character={charactersById[spendPointsCharacterId]}
          campaignDay={timeDay}
          onClose={() => setSpendPointsCharacterId(null)}
        />
      )}

      {compareCharacterId && charactersById[compareCharacterId] && (
        <CharacterCompareModal character={charactersById[compareCharacterId]} characters={sortedCharacters} onClose={() => setCompareCharacterId(null)} />
      )}

      {statusCharacterId && charactersById[statusCharacterId] && (
        <CharacterStatusEditor
          character={charactersById[statusCharacterId]}
          onUpdate={(status) => actions.updateCharacter(statusCharacterId, { status })}
          onClose={() => setStatusCharacterId(null)}
        />
      )}

      {/* Keyboard shortcuts help (Phase 15c) */}
      {showShortcutsHelp && <KeyboardShortcutsModal onClose={() => setShowShortcutsHelp(false)} />}

      {/* Character Context Menu */}
      {contextMenu && (
        <CharacterContextMenu
          characterId={contextMenu.characterId}
          characterName={contextMenu.characterName}
          position={contextMenu.position}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div
            className="bg-surface-1 rounded-lg border border-edge-strong w-full max-w-md m-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-fg-bright mb-4">Delete Character</h2>
            <p className="text-fg-secondary mb-6">
              Are you sure you want to delete <strong>{deleteConfirm.characterName}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded border border-edge-strong text-fg-secondary hover:border-edge-bright hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded bg-danger-600 text-white hover:bg-danger-500 font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Wrap in CombatContextProvider when combat is active (with or without map)
  if (isCombatActive) {
    return <CombatContextProvider>{shellContent}</CombatContextProvider>;
  }

  return shellContent;
}

/**
 * UnifiedShell - Main application shell with panel layout support
 * Wraps the inner component with PanelLayoutProvider
 */
export function UnifiedShell({ modules }: UnifiedShellProps) {
  return (
    <PanelLayoutProvider>
      <UnifiedShellInner modules={modules} />
    </PanelLayoutProvider>
  );
}
