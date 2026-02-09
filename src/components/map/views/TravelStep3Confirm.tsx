/**
 * TravelStep3Confirm — validation checklist and confirm button.
 */

import type { TravelBlocker } from '../../../types/map';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface TravelStep3ConfirmProps {
  blockers: TravelBlocker[];
  isGmMode: boolean;
  hasNullTerrain: boolean;
  onConfirm: () => void;
}

export function TravelStep3Confirm({
  blockers,
  isGmMode,
  hasNullTerrain,
  onConfirm,
}: TravelStep3ConfirmProps) {
  const canConfirm = blockers.length === 0;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Review the validation checklist. All conditions must pass to confirm travel.
      </p>

      {/* Validation checklist */}
      <div className="space-y-1.5">
        {blockers.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-green-300">
            <CheckCircle className="w-4 h-4" />
            All checks passed
          </div>
        ) : (
          blockers.map((blocker, i) => (
            <div key={i} className="bg-gray-900/50 rounded p-2">
              <div className="flex items-start gap-2">
                <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs text-red-300">{blocker.message}</div>
                  {blocker.details && blocker.details.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {blocker.details.map((d, j) => (
                        <li key={j} className="text-[10px] text-gray-400 pl-2">
                          {d}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* GM override warning */}
      {isGmMode && hasNullTerrain && blockers.length === 0 && (
        <div className="flex items-start gap-2 bg-yellow-900/20 border border-yellow-700/50 rounded p-2">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="text-[10px] text-yellow-300">
            Route includes unassigned terrain tiles. You will be prompted to assign
            terrain after travel completes.
          </div>
        </div>
      )}

      {/* Confirm button */}
      <button
        disabled={!canConfirm}
        onClick={onConfirm}
        className={[
          'w-full py-2 rounded-lg text-sm font-medium transition-colors',
          canConfirm
            ? 'bg-green-700 hover:bg-green-600 text-white'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed',
        ].join(' ')}
      >
        Confirm Travel
      </button>
    </div>
  );
}
