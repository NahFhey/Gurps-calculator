import { useMemo, useRef, useCallback, useState, ReactNode, KeyboardEvent, MouseEvent, ChangeEvent } from 'react';
import { ChevronLeft, ChevronRight, Plus, MoreVertical } from 'lucide-react';
import { InventoryTab } from '../components/InventoryTab';
import { ManagerTab } from '../components/ManagerTab';
import { RulesTab } from '../components/RulesTab';
import { ChangelogTab } from '../components/ChangelogTab';
import { CombatTab } from '../components/CombatTab';
import { DowntimePanel } from '../components/downtime';
import { CharacterSheet } from '../components/character-sheet';
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
      {
        id: 'manager',
        label: 'Manager',
        content: <ManagerTab />
      },
      { id: 'rules', label: 'Rules', content: <RulesTab /> },
      { id: 'changelog', label: 'Changelog', content: <ChangelogTab /> },
      { id: 'combat', label: 'Combat', content: <CombatTab /> }
    ];
  }, [modules, state.time?.day, state.time?.slot]);
  const activeModuleId = state.ui.activeModule || availableModules[0]?.id;
  const activeModule = availableModules.find((moduleItem) => moduleItem.id === activeModuleId);
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
  const isCenterExpanded = layoutState.centerPanel === 'expanded';
  const isRightExpanded = layoutState.rightPanel === 'expanded';

  // Character panel should hide when no character is selected or party is collapsed
  const shouldHideCharacterPanel = !selectedCharacterId || isPartyCollapsed;

  const gridCols = useMemo(() => {
    if (isPartyCollapsed) {
      // Party collapsed - character panel always hidden, give space to right panel
      return 'grid-cols-[48px_0px_minmax(0,1fr)_160px]';
    }
    if (shouldHideCharacterPanel) {
      // No character selected - hide center, expand right
      return 'grid-cols-[220px_0px_minmax(0,1fr)_160px]';
    }
    if (isCenterExpanded) return 'grid-cols-[220px_minmax(0,2fr)_0px_160px]';
    if (isRightExpanded) return 'grid-cols-[220px_0px_minmax(0,2fr)_160px]';
    return 'grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)_160px]';
  }, [isPartyCollapsed, isCenterExpanded, isRightExpanded, shouldHideCharacterPanel]);

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
      <div className={`flex-1 grid ${gridCols} gap-4 p-6 transition-all duration-300`}>
        {/* Party Column - Collapsible */}
        <section
          className={`rounded border border-gray-700 bg-gray-800/60 overflow-hidden transition-all duration-300 ${
            isPartyCollapsed ? 'p-2' : 'p-4'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
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
                // Get HP/FP from gcsData if available
                const hpDisplay = character.gcsData
                  ? `${character.gcsData.pools.HP.current}/${character.gcsData.pools.HP.max}`
                  : '—';
                const fpDisplay = character.gcsData
                  ? `${character.gcsData.pools.FP.current}/${character.gcsData.pools.FP.max}`
                  : '—';

                // Get downtime status for this character
                const downtimeSummary = characterSummaries.get(character.id);

                // Determine highlight class based on downtime status
                const downtimeHighlightClass = downtimeSummary?.isAssigned
                  ? 'border-l-4 border-l-green-500'
                  : downtimeSummary?.fatigueStatus === 'exhausted'
                  ? 'border-l-4 border-l-red-500'
                  : downtimeSummary?.fatigueStatus === 'tired'
                  ? 'border-l-4 border-l-yellow-500'
                  : '';

                return (
                  <div
                    key={character.id}
                    role="button"
                    tabIndex={0}
                    data-testid={`party-character-${character.id}`}
                    data-selected={isSelected}
                    data-fatigue={downtimeSummary?.fatigueStatus}
                    data-assigned={downtimeSummary?.isAssigned}
                    onClick={() => actions.selectCharacter(isSelected ? null : character.id)}
                    onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        actions.selectCharacter(isSelected ? null : character.id);
                      }
                    }}
                    className={`rounded border p-3 cursor-pointer transition-colors ${downtimeHighlightClass} ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-100 truncate">{character.name}</span>
                          {downtimeSummary && <CharacterStatusBadge summary={downtimeSummary} />}
                        </div>
                        <div className="text-xs text-gray-400">
                          HP {hpDisplay} / FP {fpDisplay}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleContextMenu(e, character)}
                        className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 flex-shrink-0"
                        title="Character options"
                        data-testid={`character-menu-${character.id}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:border-gray-300"
                        onClick={(event: MouseEvent<HTMLButtonElement>) => {
                          event.stopPropagation();
                          actions.selectCharacter(character.id);
                          actions.setActiveModule('downtime');
                          actions.setActivitiesSubview('skills');
                        }}
                      >
                        Skills
                      </button>
                      <button
                        type="button"
                        className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:border-gray-300"
                        onClick={(event: MouseEvent<HTMLButtonElement>) => {
                          event.stopPropagation();
                          actions.selectCharacter(character.id);
                          actions.setActiveModule('downtime');
                          actions.setActivitiesSubview('equipment');
                        }}
                      >
                        Equipment
                      </button>
                      <button
                        type="button"
                        className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:border-gray-300"
                        onClick={(event: MouseEvent<HTMLButtonElement>) => {
                          event.stopPropagation();
                          actions.selectCharacter(character.id);
                          actions.setActiveModule('inventory');
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
                return (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() => actions.selectCharacter(isSelected ? null : character.id)}
                    className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center ${
                      isSelected
                        ? 'border border-blue-500 bg-blue-500/20 text-blue-200'
                        : 'border border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500'
                    }`}
                    title={character.name}
                  >
                    {initials}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Center Panel - Character Sheet (always in DOM to maintain grid structure) */}
        <section
          className={`overflow-hidden transition-all duration-300 ${
            shouldHideCharacterPanel || isRightExpanded
              ? 'invisible'
              : 'rounded border border-gray-700 bg-gray-800/60'
          }`}
        >
          <div className="h-full" data-testid="character-pane">
            {selectedCharacter && <CharacterSheet character={selectedCharacter} />}
          </div>
        </section>

        {/* Right Panel - Module Pane */}
        <section
          className={`rounded border border-gray-700 bg-gray-800/60 p-4 overflow-hidden transition-all duration-300 ${
            isCenterExpanded ? 'hidden' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm uppercase tracking-wide text-gray-400">
              {activeModule?.label || 'Module Pane'}
            </h2>
          </div>
          <div className="mt-4">{activeModule?.content}</div>
        </section>

        {/* Rail - Module Navigation */}
        <aside className="rounded border border-gray-700 bg-gray-800/60 p-4">
          <h2 className="text-sm uppercase tracking-wide text-gray-400">Rail</h2>
          <div className="mt-3 flex flex-col gap-2">
            {availableModules.map((moduleItem) => (
              <button
                key={moduleItem.id}
                type="button"
                data-testid={`rail-module-${moduleItem.id}`}
                onClick={() => actions.setActiveModule(moduleItem.id)}
                className={`rounded border px-3 py-2 text-sm transition-colors ${
                  activeModuleId === moduleItem.id
                    ? 'border-blue-500 bg-blue-500/20 text-blue-200'
                    : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-500'
                }`}
              >
                {moduleItem.label}
              </button>
            ))}
          </div>
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
