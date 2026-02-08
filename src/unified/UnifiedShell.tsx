import { useMemo, useRef, useCallback, useState, useEffect, ReactNode, KeyboardEvent, MouseEvent, ChangeEvent } from 'react';
import { ChevronLeft, ChevronRight, Plus, MoreVertical } from 'lucide-react';
import { InventoryTab } from '../components/InventoryTab';
import { ManagerTab } from '../components/ManagerTab';
import { RulesTab } from '../components/RulesTab';
import { ChangelogTab } from '../components/ChangelogTab';
import { DowntimePanel } from '../components/downtime';
import { CharacterSheet } from '../components/character-sheet';
import {
  CharacterSkillsPanel,
  CharacterEquipmentPanel,
  CharacterInventoryPanel,
} from '../components/character-panels';
import {
  CharacterCreationModal,
  CharacterContextMenu,
  type CharacterContextMenuAction,
} from '../components/character-management';
import { CharacterStatusBadge } from '../components/downtime/views/CharacterStatusBadge';
import { duplicateCharacter, downloadCharacterJSON } from '../utils/characterManagement';
import { parseCharacterText } from '../utils/characterImport';
import { WeatherWidget, TimeDisplay, TimeControls } from '../components/header';
import { CombatTile } from '../components/combat/CombatTile';
import { CombatTab } from '../components/CombatTab';
import { PanelLayoutProvider, usePanelLayout } from '../contexts/PanelLayoutContext';
import {
  useCampaignCharacters,
  useCampaignStore,
  useSelectedCharacter,
  useSelectedCharacterId
} from '../state/campaignStore';
import { useAllCharacterSlotSummaries } from '../hooks/useCharacterSlotSummary';
import type { Character } from '../types/campaign';

interface ModuleDefinition {
  id: string;
  label: string;
  content: ReactNode;
}

interface UnifiedShellProps {
  modules?: ModuleDefinition[];
}

/**
 * Inner component that uses PanelLayoutContext
 */
function UnifiedShellInner({ modules }: UnifiedShellProps) {
  const characters = useCampaignCharacters();
  const { state: layoutState, actions: layoutActions } = usePanelLayout();

  const { state, actions } = useCampaignStore();

  const availableModules = useMemo<ModuleDefinition[]>(() => {
    if (modules?.length) {
      return modules;
    }
    return [
      { id: 'inventory', label: 'Inventory', content: <InventoryTab /> },
      {
        id: 'downtime',
        label: 'Downtime',
        content: (
          <DowntimePanel
            currentDayKey={state.time?.day ?? 1}
            currentSlot={state.time?.slot ?? 0}
          />
        ),
      },
      { id: 'combat', label: 'Combat', content: <CombatTab /> },
      {
        id: 'manager',
        label: 'Manager',
        content: <ManagerTab />
      },
      { id: 'rules', label: 'Rules', content: <RulesTab /> },
      { id: 'changelog', label: 'Changelog', content: <ChangelogTab /> },
    ];
  }, [modules, state.time?.day, state.time?.slot]);
  const activeModuleId = state.ui.activeModule;
  const activeModule = activeModuleId ? availableModules.find((moduleItem) => moduleItem.id === activeModuleId) : null;
  const selectedCharacterId = useSelectedCharacterId();
  const selectedCharacter = useSelectedCharacter();
  const characterPanelView = state.ui.characterPanelView;
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
            alert('Failed to parse character file. Please check the format.');
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
          break;
        case 'edit':
          actions.selectCharacter(action.characterId);
          // TODO: In future, could open edit mode on character sheet
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
  }, [isPartyCollapsed, isCenterExpanded, isRightExpanded, shouldHideCharacterPanel, isRailCollapsed, shouldHideModulePane]);

  // Clear active module when rail collapses (except for combat, which has its own tile)
  useEffect(() => {
    if (isRailCollapsed && activeModuleId !== 'combat') {
      actions.setActiveModule('');
    }
  }, [isRailCollapsed, activeModuleId, actions]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Header - Redesigned with Weather, Time Display, and Time Controls */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Weather Widget */}
          <div className="flex items-center gap-4">
            <WeatherWidget compact />
          </div>

          {/* Center: Time Display and Controls */}
          <div className="flex items-center gap-3">
            <TimeDisplay />
            {state.ui.gmModeEnabled && <TimeControls compact />}
          </div>

          {/* Right: Debug controls and blocking errors */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300">
            {state.ui.debugMode && (
              <div className="rounded border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs text-amber-100">
                Debug mode
              </div>
            )}
            {state.ui.gmModeEnabled && (
              <button
                type="button"
                onClick={actions.toggleDebug}
                className="rounded border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100 hover:border-amber-300"
              >
                {state.ui.debugMode ? 'Disable Debug' : 'Enable Debug'}
              </button>
            )}
            {state.ui.blockingError && (
              <div
                className="rounded border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
                data-testid="blocking-error"
              >
                <div className="font-semibold">{state.ui.blockingError.reason}</div>
                <ul className="mt-1 list-disc pl-4">
                  {state.ui.blockingError.suggestedFixes.map((fix) => (
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
        className="flex-1 grid gap-4 p-6 transition-all duration-300"
        style={{ gridTemplateColumns }}
      >
        {/* Party Column - Collapsible */}
        <section
          className={`rounded border border-gray-700 bg-gray-800/60 overflow-hidden transition-all duration-300 ${
            isPartyCollapsed ? 'p-2 min-w-[56px]' : 'p-4'
          }`}
        >
          <div className={`flex items-center mb-2 ${isPartyCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!isPartyCollapsed && (
              <h2 className="text-sm uppercase tracking-wide text-gray-400">Party</h2>
            )}
            <button
              type="button"
              onClick={layoutActions.togglePartyColumn}
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
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
                // Green = available for the current time slot, Red = unavailable (has task)
                const isUnavailable = !!downtimeSummary?.isAssigned;
                const downtimeHighlightClass = isUnavailable
                  ? 'border-2 border-red-500'
                  : 'border-2 border-green-500';

                // Fatigue background tint (layered alongside availability border)
                const fatigueBgClass =
                  downtimeSummary?.fatigueStatus === 'exhausted' ? 'bg-red-900/20' :
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
                        ? 'bg-blue-500/10'
                        : (fatigueBgClass || 'bg-gray-900')
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold truncate ${isUnavailable ? 'text-gray-400' : 'text-gray-100'}`}>{character.name}</span>
                          {downtimeSummary && <CharacterStatusBadge summary={downtimeSummary} />}
                        </div>
                        <div className="text-xs text-gray-400">
                          {hpDisplay} / {fpDisplay}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          if (isUnavailable) { e.stopPropagation(); return; }
                          handleContextMenu(e, character);
                        }}
                        disabled={isUnavailable}
                        className={`p-1 rounded flex-shrink-0 ${isUnavailable ? 'text-gray-600 cursor-not-allowed' : 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'}`}
                        title={isUnavailable ? 'Character unavailable this time slot' : 'Character options'}
                        data-testid={`character-menu-${character.id}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isUnavailable}
                        className={`rounded border px-2 py-1 text-xs ${isUnavailable ? 'border-gray-700 text-gray-500 cursor-not-allowed' : 'border-gray-600 text-gray-200 hover:border-gray-300'}`}
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
                        className={`rounded border px-2 py-1 text-xs ${isUnavailable ? 'border-gray-700 text-gray-500 cursor-not-allowed' : 'border-gray-600 text-gray-200 hover:border-gray-300'}`}
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
                        className={`rounded border px-2 py-1 text-xs ${isUnavailable ? 'border-gray-700 text-gray-500 cursor-not-allowed' : 'border-gray-600 text-gray-200 hover:border-gray-300'}`}
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
              <div className="mt-4 pt-4 border-t border-gray-700 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowCreationModal(true)}
                  className="w-full flex items-center justify-center gap-2 rounded border border-blue-500 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/20"
                  data-testid="add-character-button"
                >
                  <Plus className="h-4 w-4" />
                  Add Character
                </button>
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
                  className="w-full rounded border border-gray-500 bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-100 hover:border-gray-300"
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
                        ? 'border-2 border-red-500 bg-gray-900 text-gray-500 opacity-50 cursor-not-allowed'
                        : isSelected
                          ? 'border-2 border-blue-500 bg-blue-500/20 text-blue-200'
                          : 'border-2 border-green-500 bg-gray-900 text-gray-300 hover:border-green-400'
                    }`}
                    title={collapsedUnavailable ? `${character.name} (unavailable)` : character.name}
                  >
                    {initials}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Left Scroll Edge 1 - decorative line (inner, next to party) */}
        <div className="flex items-center justify-center py-3">
          <div className="w-full h-[calc(100%-1.5rem)] rounded bg-gray-700/40" />
        </div>

        {/* Left Scroll Gap - dark space between lines */}
        <div />

        {/* Left Scroll Edge 2 - decorative line (outer, next to content) */}
        <div className="flex items-center justify-center py-3">
          <div className="w-full h-[calc(100%-1.5rem)] rounded bg-gray-700/40" />
        </div>

        {/* Center Panel - Character Sheet/Skills/Equipment/Inventory (always in DOM to maintain grid structure) */}
        <section
          className={`overflow-hidden transition-all duration-300 ${
            shouldHideCharacterPanel || isRightExpanded
              ? 'invisible'
              : 'rounded border border-gray-700 bg-gray-800/60'
          }`}
        >
          <div className="h-full" data-testid="character-pane">
            {selectedCharacter && characterPanelView === 'sheet' && (
              <CharacterSheet character={selectedCharacter} />
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

        {/* Right Panel - Module Pane */}
        <section
          className={`overflow-hidden transition-all duration-300 ${
            isCenterExpanded || shouldHideModulePane
              ? 'invisible'
              : 'rounded border border-gray-700 bg-gray-800/60 p-4'
          }`}
        >
          {activeModule && (
            <>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm uppercase tracking-wide text-gray-400">
                  {activeModule.label}
                </h2>
              </div>
              <div className="mt-4">{activeModule.content}</div>
            </>
          )}
        </section>

        {/* Right Scroll Edge 1 - decorative line (outer, next to content) */}
        <div className="flex items-center justify-center py-3">
          <div className="w-full h-[calc(100%-1.5rem)] rounded bg-gray-700/40" />
        </div>

        {/* Right Scroll Gap - dark space between lines */}
        <div />

        {/* Right Scroll Edge 2 - decorative line (inner, next to rail) */}
        <div className="flex items-center justify-center py-3">
          <div className="w-full h-[calc(100%-1.5rem)] rounded bg-gray-700/40" />
        </div>

        {/* Rail - Module Navigation */}
        <aside
          className={`rounded border border-gray-700 bg-gray-800/60 overflow-hidden transition-all duration-300 ${
            isRailCollapsed ? 'p-2 min-w-[56px]' : 'p-4'
          }`}
        >
          {/* Header with toggle button - matching Party collapsed structure */}
          <div className={`flex items-center mb-2 ${isRailCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!isRailCollapsed && (
              <h2 className="text-sm uppercase tracking-wide text-gray-400">Rail</h2>
            )}
            <button
              type="button"
              onClick={layoutActions.toggleRailColumn}
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
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
                    onClick={() => actions.setActiveModule(isSelected ? '' : moduleItem.id)}
                    title={moduleItem.label}
                    className={`rounded border transition-colors px-3 py-2 w-full text-sm ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/20 text-blue-200'
                        : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-500'
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
                    onClick={() => actions.setActiveModule(isSelected ? '' : moduleItem.id)}
                    title={moduleItem.label}
                    className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center ${
                      isSelected
                        ? 'border border-blue-500 bg-blue-500/20 text-blue-200'
                        : 'border border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {moduleItem.label.charAt(0)}
                  </button>
                );
              })}
            </div>
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
            className="bg-gray-800 rounded-lg border border-gray-600 max-w-4xl max-h-[90vh] overflow-auto m-4"
            onClick={(e) => e.stopPropagation()}
          >
            {layoutState.modalTitle && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold">{layoutState.modalTitle}</h2>
                <button
                  type="button"
                  onClick={layoutActions.closeModal}
                  className="text-gray-400 hover:text-gray-200"
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
        />
      )}

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
            className="bg-gray-800 rounded-lg border border-gray-600 w-full max-w-md m-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Delete Character</h2>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete <strong>{deleteConfirm.characterName}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded border border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-500 font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
