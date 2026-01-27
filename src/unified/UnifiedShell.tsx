import { useMemo, useRef, useCallback, ReactNode, KeyboardEvent, MouseEvent, ChangeEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { InventoryTab } from '../components/InventoryTab';
import { ManagerTab } from '../components/ManagerTab';
import { RulesTab } from '../components/RulesTab';
import { ChangelogTab } from '../components/ChangelogTab';
import { CombatTab } from '../components/CombatTab';
import { PartyToolContainer } from '../components/party-tool/PartyToolContainer';
import { CharacterSheet } from '../components/character-sheet';
import { parseCharacterText } from '../utils/characterImport';
import { WeatherWidget, TimeDisplay, TimeControls } from '../components/header';
import { CombatTile } from '../components/combat/CombatTile';
import { PanelLayoutProvider, usePanelLayout } from '../contexts/PanelLayoutContext';
import {
  useCampaignCharacters,
  useCampaignStore,
  useLegacyAppState,
  useSelectedCharacter,
  useSelectedCharacterId
} from '../state/campaignStore';
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
  const legacyAppState = useLegacyAppState();
  const characters = useCampaignCharacters();
  const { state: layoutState, actions: layoutActions } = usePanelLayout();

  const availableModules = useMemo<ModuleDefinition[]>(() => {
    if (modules?.length) {
      return modules;
    }
    return [
      { id: 'inventory', label: 'Inventory', content: <InventoryTab /> },
      { id: 'activities', label: 'Activities', content: <PartyToolContainer /> },
      {
        id: 'manager',
        label: 'Manager',
        content: <ManagerTab {...((legacyAppState as { managerTabProps?: Record<string, unknown> }).managerTabProps || {})} />
      },
      { id: 'rules', label: 'Rules', content: <RulesTab /> },
      { id: 'changelog', label: 'Changelog', content: <ChangelogTab /> },
      { id: 'combat', label: 'Combat', content: <CombatTab /> }
    ];
  }, [legacyAppState, modules]);
  const { state, actions } = useCampaignStore();
  const activeModuleId = state.ui.activeModule || availableModules[0]?.id;
  const activeModule = availableModules.find((moduleItem) => moduleItem.id === activeModuleId);
  const selectedCharacterId = useSelectedCharacterId();
  const selectedCharacter = useSelectedCharacter();
  const sortedCharacters = useMemo(
    () => [...characters].sort((a, b) => a.name.localeCompare(b.name)),
    [characters]
  );

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

  // Compute grid columns based on panel states
  const isPartyCollapsed = layoutState.partyColumn === 'collapsed';
  const isCenterExpanded = layoutState.centerPanel === 'expanded';
  const isRightExpanded = layoutState.rightPanel === 'expanded';

  const gridCols = useMemo(() => {
    if (isPartyCollapsed) {
      if (isCenterExpanded) return 'grid-cols-[48px_minmax(0,2fr)_0px_160px]';
      if (isRightExpanded) return 'grid-cols-[48px_0px_minmax(0,2fr)_160px]';
      return 'grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)_160px]';
    }
    if (isCenterExpanded) return 'grid-cols-[220px_minmax(0,2fr)_0px_160px]';
    if (isRightExpanded) return 'grid-cols-[220px_0px_minmax(0,2fr)_160px]';
    return 'grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)_160px]';
  }, [isPartyCollapsed, isCenterExpanded, isRightExpanded]);

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
                return (
                  <div
                    key={character.id}
                    role="button"
                    tabIndex={0}
                    data-testid={`party-character-${character.id}`}
                    data-selected={isSelected}
                    onClick={() => actions.selectCharacter(character.id)}
                    onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        actions.selectCharacter(character.id);
                      }
                    }}
                    className={`rounded border p-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-100">{character.name}</div>
                        <div className="text-xs text-gray-400">HP/FP —</div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:border-gray-300"
                        onClick={(event: MouseEvent<HTMLButtonElement>) => {
                          event.stopPropagation();
                          actions.selectCharacter(character.id);
                          actions.setActiveModule('activities');
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
                          actions.setActiveModule('activities');
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

              {/* Import Character Button in Party Column */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.gcs"
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
                  Import Character
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
                    onClick={() => actions.selectCharacter(character.id)}
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

        {/* Center Panel - Character Sheet */}
        <section
          className={`rounded border border-gray-700 bg-gray-800/60 overflow-hidden transition-all duration-300 ${
            isRightExpanded ? 'hidden' : ''
          }`}
        >
          <div className="h-full" data-testid="character-pane">
            {selectedCharacter ? (
              <CharacterSheet character={selectedCharacter} />
            ) : (
              <div className="p-4" data-testid="party-summary">
                <h2 className="text-sm uppercase tracking-wide text-gray-400">Character Sheet</h2>
                <div className="mt-4 text-center text-gray-500">
                  <p>Select a character from the Party Column to view their sheet.</p>
                </div>
              </div>
            )}
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
