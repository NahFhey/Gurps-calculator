/**
 * TravelBlockerList — displays blocking diagnostics for travel validation.
 */

import type { TravelBlocker } from '../../../types/map';
import { XCircle } from 'lucide-react';

interface TravelBlockerListProps {
  blockers: TravelBlocker[];
}

export function TravelBlockerList({ blockers }: TravelBlockerListProps) {
  if (blockers.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {blockers.map((blocker, i) => (
        <div key={i} className="bg-red-900/20 border border-red-700/30 rounded p-2">
          <div className="flex items-start gap-2">
            <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-red-300">{blocker.message}</div>
              {blocker.details && blocker.details.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {blocker.details.map((detail, j) => (
                    <li key={j} className="text-[10px] text-gray-400 pl-2">
                      {detail}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
