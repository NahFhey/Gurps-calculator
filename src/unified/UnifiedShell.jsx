import React, { useMemo } from 'react';
import { InventoryTab } from '../components/InventoryTab';
import { ManagerTab } from '../components/ManagerTab';
import { RulesTab } from '../components/RulesTab';
import { ChangelogTab } from '../components/ChangelogTab';
import { CombatTab } from '../components/CombatTab';
import { PartyToolContainer } from '../components/party-tool/PartyToolContainer';
import {
  useCampaignCharacters,
  useCampaignStore,
  useLegacyAppState,
  useSelectedCharacter,
  useSelectedCharacterId
} from '../state/campaignStore';

export function UnifiedShell({ modules }) {
  const legacyAppState = useLegacyAppState();
  const characters = useCampaignCharacters();
  const availableModules = useMemo(() => {
    if (modules?.length) {
      return modules;
    }
    return [
      { id: 'inventory', label: 'Inventory', content: <InventoryTab /> },
      { id: 'activities', label: 'Activities', content: <PartyToolContainer /> },
      {
        id: 'manager',
        label: 'Manager',
        content: <ManagerTab {...(legacyAppState.managerTabProps || {})} />
      },
      { id: 'rules', label: 'Rules', content: <RulesTab /> },
      { id: 'changelog', label: 'Changelog', content: <ChangelogTab /> },
      { id: 'combat', label: 'Combat', content: <CombatTab /> }
    ];
  }, [legacyAppState.managerTabProps, modules]);
  const { state, actions } = useCampaignStore();
  const activeModuleId = state.ui.activeModule || availableModules[0]?.id;
  const activeModule = availableModules.find((moduleItem) => moduleItem.id === activeModuleId);
  const selectedCharacterId = useSelectedCharacterId();
  const selectedCharacter = useSelectedCharacter();
  const sortedCharacters = useMemo(
    () => [...characters].sort((a, b) => a.name.localeCompare(b.name)),
    [characters]
  );
  const selectedSkills = selectedCharacter?.work?.skills
    ? Object.entries(selectedCharacter.work.skills)
    : [];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-lg font-semibold">Unified Shell</div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
            <div data-testid="time-display">
              Day {state.time.day} · Slot {state.time.slot + 1} ({state.time.slotLabels[state.time.slot]})
            </div>
            {state.ui.debugMode && (
              <div className="rounded border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs text-amber-100">
                Debug mode
              </div>
            )}
            {state.ui.gmModeEnabled && (
              <>
                <button
                  type="button"
                  onClick={actions.toggleDebug}
                  className="rounded border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100 hover:border-amber-300"
                >
                  {state.ui.debugMode ? 'Disable Debug' : 'Enable Debug'}
                </button>
                <button
                  type="button"
                  onClick={actions.advanceTime}
                  className="rounded border border-blue-500 bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-100 hover:border-blue-300"
                  data-testid="advance-time"
                >
                  Advance Time
                </button>
              </>
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

      <div className="flex-1 grid grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)_160px] gap-4 p-6">
        <section className="rounded border border-gray-700 bg-gray-800/60 p-4">
          <h2 className="text-sm uppercase tracking-wide text-gray-400">Party Column</h2>
          <div className="mt-3 space-y-2">
            {sortedCharacters.map((character) => {
              const isSelected = character.id === selectedCharacterId;
              return (
                <div
                  key={character.id}
                  role="button"
                  tabIndex={0}
                  data-testid={`party-character-${character.id}`}
                  data-selected={isSelected}
                  onClick={() => actions.selectCharacter(character.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      actions.selectCharacter(character.id);
                    }
                  }}
                  className={`rounded border p-3 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 bg-gray-900'
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
                      onClick={(event) => {
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
                      onClick={(event) => {
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
                      onClick={(event) => {
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
          </div>
        </section>

        <section className="rounded border border-gray-700 bg-gray-800/60 p-4">
          <h2 className="text-sm uppercase tracking-wide text-gray-400">Character Pane</h2>
          <div className="mt-2 text-gray-200" data-testid="character-pane">
            {selectedCharacter ? (
              <div data-testid="character-summary">
                <div className="text-base font-semibold text-gray-100" data-testid="character-name">
                  {selectedCharacter.name}
                </div>
                <div className="mt-2 text-sm text-gray-300" data-testid="character-skills">
                  <div className="text-xs uppercase tracking-wide text-gray-400">Skills</div>
                  <ul className="mt-2 space-y-1">
                    {selectedSkills.map(([skillName, skillValue]) => (
                      <li key={skillName} className="flex justify-between text-sm">
                        <span className="text-gray-200">{skillName}</span>
                        <span className="text-gray-400">{skillValue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div data-testid="party-summary">
                <div className="text-base font-semibold text-gray-100">Party Summary</div>
                <div className="mt-2 text-sm text-gray-300">Day: —</div>
                <div className="text-sm text-gray-300">Slot: —</div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded border border-gray-700 bg-gray-800/60 p-4">
          <h2 className="text-sm uppercase tracking-wide text-gray-400">Module Pane</h2>
          <p className="mt-2 text-gray-200">
            Active Module: {activeModule?.label || 'None'}
          </p>
          <div className="mt-4">{activeModule?.content}</div>
        </section>

        <aside className="rounded border border-gray-700 bg-gray-800/60 p-4">
          <h2 className="text-sm uppercase tracking-wide text-gray-400">Rail</h2>
          <div className="mt-3 flex flex-col gap-2">
            {availableModules.map((moduleItem) => (
                <button
                  key={moduleItem.id}
                  type="button"
                  data-testid={`rail-module-${moduleItem.id}`}
                  onClick={() => actions.setActiveModule(moduleItem.id)}
                  className={`rounded border px-3 py-2 text-sm ${
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

      <div className="grid grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)_160px] gap-4 px-6 pb-6">
        <div className="col-start-2 col-span-2 flex justify-center">
          <button
            type="button"
            className="rounded border border-gray-500 bg-gray-800 px-6 py-2 text-sm font-semibold text-gray-100 hover:border-gray-300"
          >
            Import
          </button>
        </div>
        <div className="col-start-4 rounded border border-gray-700 bg-gray-800/60 p-4 text-gray-200">
          Combat Tile Placeholder
        </div>
      </div>
    </div>
  );
}
