import { toNumberOr } from '../../../utils/helpers';
import type { AlchemySettingsViewProps } from '../../../types/views';

/**
 * AlchemySettingsView - Configure alchemy system defaults
 *
 * Allows customization of:
 * - Default lab rating (LR)
 * - Work block duration
 * - Auto-save recipes toggle
 * - Show obvious physical roles toggle
 */
export function AlchemySettingsView({ alchemySettings, saveAlchemySettings }: AlchemySettingsViewProps) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Alchemy Settings</h2>
      <p className="text-sm text-fg-muted mb-6">
        Configure default settings for alchemy batches. These can be overridden per batch.
      </p>

      <div className="bg-surface-2 p-6 rounded-lg space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm font-semibold mb-2">Default Lab Rating (LR)</label>
          <p className="text-xs text-fg-muted mb-3">
            Lab equipment quality reduces Work Requirement (WR). Recommended range: 0 to 4
          </p>
          <input
            type="number"
            min="0"
            max="4"
            value={alchemySettings.defaultLabRating}
            onChange={(e) => {
              const clamped = Math.max(0, Math.min(4, toNumberOr(e.target.value, 0)));
              saveAlchemySettings({
                ...alchemySettings,
                defaultLabRating: clamped
              });
            }}
            className="w-full bg-surface-3 px-4 py-2 rounded text-lg"
            placeholder="0"
          />
          <p className="text-xs text-fg-faint mt-2">
            Current: LR {alchemySettings.defaultLabRating} (reduces WR by {alchemySettings.defaultLabRating})
          </p>
        </div>

        <div className="border-t border-edge-strong pt-6">
          <label className="block text-sm font-semibold mb-2">Work Block Duration (minutes)</label>
          <p className="text-xs text-fg-muted mb-3">
            Standard time unit for alchemy work. Progress is tracked in work blocks.
          </p>
          <input
            type="number"
            min="1"
            value={alchemySettings.workBlockMinutes}
            onChange={(e) => {
              saveAlchemySettings({
                ...alchemySettings,
                workBlockMinutes: Math.max(1, toNumberOr(e.target.value, 120))
              });
            }}
            className="w-full bg-surface-3 px-4 py-2 rounded text-lg"
            placeholder="120"
          />
          <p className="text-xs text-fg-faint mt-2">
            Current: {alchemySettings.workBlockMinutes} minutes ({(alchemySettings.workBlockMinutes / 60).toFixed(1)} hours)
          </p>
        </div>

        <div className="border-t border-edge-strong pt-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={alchemySettings.autoSaveRecipes || false}
              onChange={(e) => {
                saveAlchemySettings({
                  ...alchemySettings,
                  autoSaveRecipes: e.target.checked
                });
              }}
              className="w-5 h-5"
            />
            <div>
              <div className="text-sm font-semibold">Auto-Save Recipes on Batch Completion</div>
              <p className="text-xs text-fg-muted">
                Automatically save successful batches as new recipes without prompting
              </p>
            </div>
          </label>
        </div>

        <div className="border-t border-edge-strong pt-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={alchemySettings.showObviousRoles !== false}
              onChange={(e) => {
                saveAlchemySettings({
                  ...alchemySettings,
                  showObviousRoles: e.target.checked
                });
              }}
              className="w-5 h-5"
            />
            <div>
              <div className="text-sm font-semibold">Show Obvious Physical Roles</div>
              <p className="text-xs text-fg-muted">
                Allow physical roles (Solvent, Binder, Tool) to be known from mundane inspection even when reagent is unidentified
              </p>
            </div>
          </label>
        </div>

        <div className="bg-surface-1 p-4 rounded text-sm">
          <div className="font-semibold mb-2">Notes:</div>
          <ul className="list-disc list-inside space-y-1 text-fg-secondary">
            <li>Lab Rating (LR) reduces WR directly: LR 4 reduces WR by 4</li>
            <li>Higher lab rating = easier brewing, fewer work blocks needed</li>
            <li>Work blocks can be customized for different campaign pacing</li>
            <li>Auto-save creates a recipe copy when a batch completes successfully</li>
            <li>Reagent identification requires Analysis (consumes 1U per attempt)</li>
            <li>Physical roles setting allows Solvent/Binder/Tool to be visible even when unidentified</li>
            <li>These are defaults; you can override them per batch</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
