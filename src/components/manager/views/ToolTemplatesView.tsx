import { useMemo } from 'react';
import { Hammer } from 'lucide-react';
import { useCampaignStore } from '../../../state/campaignStore';
import { denormalizeObject } from '../../../state/campaignUtils';
import type { ToolTemplate } from '../../../types/campaign';

/**
 * ToolTemplatesView - Displays tool templates and their activity modifiers
 *
 * Part of Phase 3: Activities Panel Simplification
 * Migrated from PartyToolApp.jsx GM Workshop tab
 */

function formatNumber(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  return value > 0 ? `+${abs}` : `-${abs}`;
}

export function ToolTemplatesView() {
  const { state } = useCampaignStore();

  const toolTemplates = useMemo(() =>
    denormalizeObject(state.entities.toolTemplates) as ToolTemplate[],
    [state.entities.toolTemplates]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-semibold text-fg-primary">
          <Hammer className="h-5 w-5" /> Tool Templates
        </div>
        <span className="text-sm text-fg-muted">{toolTemplates.length} templates</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {toolTemplates.map((template) => (
          <div
            key={template.templateId}
            className="rounded-lg border border-edge bg-surface-1/60 p-4"
          >
            <div className="font-semibold text-white">{template.name}</div>
            <div className="mt-3 space-y-2 text-sm">
              {Object.entries(template.activityCategories || {}).map(([category, modifiers]) => (
                <div
                  key={category}
                  className="flex items-center justify-between rounded bg-surface-0/50 px-3 py-2"
                >
                  <span className="capitalize text-fg-secondary">{category}</span>
                  <div className="flex gap-3 text-xs">
                    {modifiers.skillBonus !== undefined && modifiers.skillBonus !== 0 && (
                      <span className={modifiers.skillBonus > 0 ? 'text-success-400' : 'text-danger-400'}>
                        Skill {formatNumber(modifiers.skillBonus)}
                      </span>
                    )}
                    {modifiers.timeBonus !== undefined && modifiers.timeBonus !== 0 && (
                      <span className={modifiers.timeBonus > 0 ? 'text-success-400' : 'text-danger-400'}>
                        Time {formatNumber(modifiers.timeBonus)}
                      </span>
                    )}
                    {modifiers.qualityModifier !== undefined && modifiers.qualityModifier !== 0 && (
                      <span className={modifiers.qualityModifier > 0 ? 'text-success-400' : 'text-danger-400'}>
                        Quality {formatNumber(modifiers.qualityModifier)}
                      </span>
                    )}
                    {modifiers.yieldFlat !== undefined && modifiers.yieldFlat !== 0 && (
                      <span className={modifiers.yieldFlat > 0 ? 'text-success-400' : 'text-danger-400'}>
                        Yield {formatNumber(modifiers.yieldFlat)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {Object.keys(template.activityCategories || {}).length === 0 && (
                <div className="text-xs text-fg-faint">No activity modifiers</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {toolTemplates.length === 0 && (
        <div className="text-center text-fg-muted py-8">
          No tool templates defined.
        </div>
      )}
    </div>
  );
}
