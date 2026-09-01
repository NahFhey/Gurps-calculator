import { useMemo } from 'react';
import { Weight, Shield, AlertTriangle } from 'lucide-react';
import type { Equipment, PrimaryAttributes, SecondaryAttributes, EncumbranceLevel } from '../../types/characterSheet';
import { calculateCharacterEncumbrance, calculateLocationDR } from '../../utils/encumbrance';

interface EncumbranceSectionProps {
  attributes: PrimaryAttributes;
  secondaryAttributes: SecondaryAttributes;
  equipment: Equipment[];
}

const LEVEL_COLORS: Record<EncumbranceLevel, string> = {
  0: 'text-success-400',
  1: 'text-yellow-400',
  2: 'text-orange-400',
  3: 'text-danger-400',
  4: 'text-danger-600',
};

const LEVEL_BG_COLORS: Record<EncumbranceLevel, string> = {
  0: 'bg-success-900/30',
  1: 'bg-yellow-900/30',
  2: 'bg-orange-900/30',
  3: 'bg-danger-900/30',
  4: 'bg-danger-900/50',
};

const LEVEL_BAR_COLORS: Record<EncumbranceLevel, string> = {
  0: 'bg-success-500',
  1: 'bg-yellow-500',
  2: 'bg-orange-500',
  3: 'bg-danger-500',
  4: 'bg-danger-700',
};

export function EncumbranceSection({ attributes, secondaryAttributes, equipment }: EncumbranceSectionProps) {
  const encumbrance = useMemo(
    () => calculateCharacterEncumbrance(attributes, secondaryAttributes, equipment),
    [attributes, secondaryAttributes, equipment]
  );

  const locationDR = useMemo(
    () => calculateLocationDR(equipment),
    [equipment]
  );

  // Calculate bar fill percentage (relative to X-Heavy threshold)
  const maxThreshold = encumbrance.thresholds[4].maxWeight;
  const fillPct = maxThreshold > 0
    ? Math.min(100, (encumbrance.carriedWeight / maxThreshold) * 100)
    : 0;

  const baseMove = secondaryAttributes.basicMove.value;
  const baseDodge = Math.floor(secondaryAttributes.basicSpeed.value) + 3;

  return (
    <div className="bg-surface-1 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Weight size={20} className="text-warning-400" />
        <h3 className="text-lg font-semibold text-fg-bright">Encumbrance</h3>
      </div>

      {/* Main stats row */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <div className="text-center">
          <div className="text-xs text-fg-muted">Basic Lift</div>
          <div className="text-lg font-bold text-fg-bright">{encumbrance.basicLift} lb</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-fg-muted">Carried</div>
          <div className={`text-lg font-bold ${LEVEL_COLORS[encumbrance.level]}`}>
            {encumbrance.carriedWeight} lb
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-fg-muted">Move</div>
          <div className={`text-lg font-bold ${encumbrance.level > 0 ? LEVEL_COLORS[encumbrance.level] : 'text-fg-bright'}`}>
            {encumbrance.adjustedMove}
            {encumbrance.level > 0 && (
              <span className="text-xs text-fg-faint ml-1">({baseMove})</span>
            )}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-fg-muted">Dodge</div>
          <div className={`text-lg font-bold ${encumbrance.level > 0 ? LEVEL_COLORS[encumbrance.level] : 'text-fg-bright'}`}>
            {encumbrance.adjustedDodge}
            {encumbrance.level > 0 && (
              <span className="text-xs text-fg-faint ml-1">({baseDodge})</span>
            )}
          </div>
        </div>
      </div>

      {/* Encumbrance level indicator */}
      <div className={`rounded-md px-3 py-2 mb-3 ${LEVEL_BG_COLORS[encumbrance.level]}`}>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-sm font-medium ${LEVEL_COLORS[encumbrance.level]}`}>
            {encumbrance.level > 0 && <AlertTriangle size={14} className="inline mr-1" />}
            {encumbrance.thresholds[encumbrance.level].label} Encumbrance
          </span>
          <span className="text-xs text-fg-muted">
            {encumbrance.carriedWeight} / {encumbrance.thresholds[encumbrance.level].maxWeight} lb
          </span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-surface-2 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${LEVEL_BAR_COLORS[encumbrance.level]}`}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>

      {/* Threshold table */}
      <div className="text-xs text-fg-muted mb-3">
        <div className="flex gap-1">
          {encumbrance.thresholds.map((t) => (
            <div
              key={t.level}
              className={`flex-1 text-center rounded px-1 py-0.5 ${
                t.level === encumbrance.level ? LEVEL_BG_COLORS[t.level] + ' ' + LEVEL_COLORS[t.level] : ''
              }`}
            >
              <div className="font-medium">{t.label}</div>
              <div>≤{t.maxWeight}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-Location DR */}
      {locationDR.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-2">
            <Shield size={14} className="text-accent-400" />
            <h4 className="text-sm font-medium text-fg-secondary">Armor by Location</h4>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {locationDR.map((loc) => (
              <div key={loc.location} className="flex justify-between">
                <span className="text-fg-muted capitalize">{loc.location}</span>
                <span className="text-accent-300 font-medium">DR {loc.dr}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
