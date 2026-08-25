/**
 * useCombatExport — handles combat export/import operations.
 *
 * Extracted from CombatTracker (Phase 11a decomposition).
 * All file I/O, validation, and format handling lives here.
 */

import { useCallback } from 'react';
import { useCombatStore } from './useCombatStore';
import { useToast } from '../components/ui';
import {
  exportCombatLog,
  exportActiveCombat,
  parseImportedCombat,
  exportCombatPlayerView,
  exportCombatGMLocked,
  importCombatWithGMLock,
} from '../utils/combatHelpers';
import {
  validateCombatExport,
  validateCombatImport,
} from '../utils/combatValidation';
import { filterLogForPlayerView } from '../utils/combatLogFilter';
import { ViewMode } from '../utils/combatViewFilter';
import { ensureParticipantConditionVisibility } from '../utils/conditionsEngine';
import type {
  CombatState,
  HistoryState,
  RevealState,
  LogEntry,
} from '../types/combatTracker';
import type { ViewModeType } from '../utils/combatViewFilter';

export interface CombatExportActions {
  handleExportLog: () => void;
  handleExportPlayerView: () => void;
  handleExportGMLocked: () => Promise<void>;
  handleSaveCombat: () => void;
  handleLoadCombat: (onConfirm: () => Promise<boolean>) => void;
}

/**
 * Bring an imported combat save up to the 12a.6 condition-visibility shape.
 * Old exports may carry isStunned/isUnconscious booleans and condition
 * instances without a `revealed` eye state; migrating here keeps the import
 * path in lockstep with hydrate-time migration in campaignStorage.
 */
function migrateImportedCombatState(combatState: CombatState): CombatState {
  if (!Array.isArray(combatState.participants)) return combatState;
  return {
    ...combatState,
    participants: combatState.participants.map((p) =>
      ensureParticipantConditionVisibility(p),
    ),
  };
}

/**
 * Returns export/import handlers for the active combat session.
 * Returns null when no combat is active.
 */
export function useCombatExport(
  viewMode: ViewModeType,
  history?: HistoryState,
): CombatExportActions | null {
  const {
    combatActive,
    saveCombatActive,
    combatReveal,
    saveCombatReveal,
  } = useCombatStore();
  const { error: showError } = useToast();

  const combat = combatActive;
  const reveal = combatReveal as RevealState | null;
  // Use provided history or a minimal empty object for export compatibility
  const hist = history ?? ({ version: 1, actions: [], cursor: 0, checkpoints: [], checkpointEvery: 25, maxActions: 500, maxCheckpoints: 30 } as unknown as HistoryState);

  const handleExportLog = useCallback(() => {
    if (!combat) return;
    const combatLog = combat.log || [];
    const displayLog =
      viewMode === ViewMode.PLAYER && reveal
        ? (filterLogForPlayerView(combatLog, reveal, combat) as LogEntry[])
        : combatLog;

    const text = exportCombatLog(displayLog, {
      name: combat.name,
      date: combat.startTime,
    });

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `combat-log-${combat.name}-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }, [combat, reveal, viewMode]);

  const handleExportPlayerView = useCallback(() => {
    if (!combat) return;
    if (!reveal) {
      showError('Reveal state not initialized. Cannot export player view.');
      return;
    }

    const json = exportCombatPlayerView(combat, reveal, hist);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `combat-player-view-${combat.name}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [combat, reveal, hist]);

  const handleExportGMLocked = useCallback(async () => {
    if (!combat) return;
    if (!reveal) {
      showError('Reveal state not initialized. Cannot export GM locked combat.');
      return;
    }

    const password = window.prompt(
      'Enter GM password to encrypt combat data:\n\n' +
        'This password will be required to unlock the full combat state.\n' +
        'Players can view the filtered version without the password.',
    );

    if (!password) return;

    try {
      const json = await exportCombatGMLocked(combat, reveal, hist, password);

      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `combat-gm-locked-${combat.name}-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showError(`Export failed: ${(error as Error).message}`);
    }
  }, [combat, reveal, hist]);

  const handleSaveCombat = useCallback(() => {
    if (!combat) return;
    const validation = validateCombatExport(combat, hist) as {
      valid: boolean;
      errors: string[];
    };
    if (!validation.valid) {
      showError(`Cannot export: ${validation.errors.join(', ')}`);
      return;
    }

    const json = exportActiveCombat(combat, hist);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `combat-save-${combat.name}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [combat, hist]);

  const handleLoadCombat = useCallback(
    (onConfirm: () => Promise<boolean>) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
          const jsonString = event.target?.result as string;

          // Try Phase 5 import first
          let parsed = (await importCombatWithGMLock(jsonString)) as {
            valid: boolean;
            isLocked?: boolean;
            error?: string;
            data?: {
              combatState: CombatState;
              history?: HistoryState;
              revealState?: RevealState;
            };
          };

          // Fallback to legacy import if Phase 5 fails
          if (!parsed.valid && !parsed.isLocked) {
            parsed = parseImportedCombat(jsonString) as typeof parsed;
            if (parsed.valid && parsed.data) {
              const validation = validateCombatImport(parsed.data) as {
                valid: boolean;
                errors: string[];
                combatState: CombatState;
                historyState: HistoryState;
              };
              if (!validation.valid) {
                showError(
                  `Validation error: ${validation.errors.join(', ')}`,
                );
                return;
              }

              const confirmed = await onConfirm();
              if (!confirmed) return;

              saveCombatActive(migrateImportedCombatState(validation.combatState));
              return;
            }
          }

          if (!parsed.valid && !parsed.isLocked) {
            showError(`Import error: ${parsed.error}`);
            return;
          }

          // Handle GM-locked import
          if (parsed.isLocked) {
            const password = window.prompt(
              'This combat is GM-locked. Enter password to unlock full state.\n\n' +
                '(Cancel to load player view only)',
            );

            if (password) {
              const unlocked = (await importCombatWithGMLock(
                jsonString,
                password,
              )) as typeof parsed;

              if (!unlocked.valid) {
                showError(
                  `Failed to unlock: ${unlocked.error}. Loading player view instead.`,
                );
              } else if (unlocked.data) {
                const confirmed = await onConfirm();
                if (!confirmed) return;

                saveCombatActive(migrateImportedCombatState(unlocked.data.combatState));
                saveCombatReveal(unlocked.data.revealState || null);
                return;
              }
            }

            // Load player view (locked or failed unlock)
            const confirmed = await onConfirm();
            if (!confirmed) return;

            if (parsed.data) {
              saveCombatActive(migrateImportedCombatState(parsed.data.combatState));
              saveCombatReveal(parsed.data.revealState || null);
            }
            return;
          }

          // Phase 5 format, not locked
          const confirmed = await onConfirm();
          if (!confirmed) return;

          if (parsed.data) {
            saveCombatActive(migrateImportedCombatState(parsed.data.combatState));
            saveCombatReveal(parsed.data.revealState || null);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    },
    [saveCombatActive, saveCombatReveal],
  );

  if (!combat) return null;

  return {
    handleExportLog,
    handleExportPlayerView,
    handleExportGMLocked,
    handleSaveCombat,
    handleLoadCombat,
  };
}
