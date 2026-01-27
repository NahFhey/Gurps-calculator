import { useMemo } from 'react';
import { Building2 } from 'lucide-react';
import { useCampaignStore } from '../../../state/campaignStore';
import { denormalizeObject } from '../../../state/campaignUtils';
import type { Facility } from '../../../types/campaign';

/**
 * FacilitiesView - Displays facilities and their activity modifiers
 *
 * Part of Phase 3: Activities Panel Simplification
 * Migrated from PartyToolApp.jsx GM Workshop tab
 */

function formatNumber(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  return value > 0 ? `+${abs}` : `-${abs}`;
}

export function FacilitiesView() {
  const { state } = useCampaignStore();

  const facilities = useMemo(() =>
    denormalizeObject(state.entities.facilities) as Facility[],
    [state.entities.facilities]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-semibold text-slate-200">
          <Building2 className="h-5 w-5" /> Facilities
        </div>
        <span className="text-sm text-gray-400">{facilities.length} facilities</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {facilities.map((facility) => (
          <div
            key={facility.id}
            className={`rounded-lg border bg-slate-800/60 p-4 ${
              facility.conditionId === 'Broken'
                ? 'border-rose-500/60'
                : 'border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-white">{facility.name}</div>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  facility.conditionId === 'Broken'
                    ? 'bg-rose-500/20 text-rose-300'
                    : facility.conditionId === 'Good'
                    ? 'bg-green-500/20 text-green-300'
                    : 'bg-yellow-500/20 text-yellow-300'
                }`}
              >
                {facility.conditionId}
              </span>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {Object.entries(facility.activityCategories || {}).map(([category, modifiers]) => (
                <div
                  key={category}
                  className="flex items-center justify-between rounded bg-slate-900/50 px-3 py-2"
                >
                  <span className="capitalize text-slate-300">{category}</span>
                  <div className="flex gap-3 text-xs">
                    {modifiers.skillBonus !== undefined && modifiers.skillBonus !== 0 && (
                      <span className={modifiers.skillBonus > 0 ? 'text-green-400' : 'text-red-400'}>
                        Skill {formatNumber(modifiers.skillBonus)}
                      </span>
                    )}
                    {modifiers.qualityModifier !== undefined && modifiers.qualityModifier !== 0 && (
                      <span className={modifiers.qualityModifier > 0 ? 'text-green-400' : 'text-red-400'}>
                        Quality {formatNumber(modifiers.qualityModifier)}
                      </span>
                    )}
                    {modifiers.riskModifier !== undefined && modifiers.riskModifier !== 0 && (
                      <span className={modifiers.riskModifier < 0 ? 'text-green-400' : 'text-red-400'}>
                        Risk {formatNumber(modifiers.riskModifier)}
                      </span>
                    )}
                    {modifiers.timeBonus !== undefined && modifiers.timeBonus !== 0 && (
                      <span className={modifiers.timeBonus > 0 ? 'text-green-400' : 'text-red-400'}>
                        Time {formatNumber(modifiers.timeBonus)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {Object.keys(facility.activityCategories || {}).length === 0 && (
                <div className="text-xs text-slate-500">No activity modifiers</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {facilities.length === 0 && (
        <div className="text-center text-slate-400 py-8">
          No facilities defined.
        </div>
      )}
    </div>
  );
}
