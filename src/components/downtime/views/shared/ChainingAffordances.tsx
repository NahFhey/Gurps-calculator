import type { JSX } from 'react';
import { useCampaignStore } from '../../../../state/campaignStore';
import type { TaskResults } from '../../../../types/downtime';

interface ChainingAffordancesProps {
  results: TaskResults;
}

export function ChainingAffordances({ results }: ChainingAffordancesProps): JSX.Element | null {
  const { actions } = useCampaignStore();
  const inventoryChanges = results.inventoryChanges ?? [];
  const foodChanges = inventoryChanges.filter(
    change => change.kind === 'food' && change.quantity > 0
  );
  const materialChanges = inventoryChanges.filter(
    change => change.kind === 'material' && change.quantity > 0
  );

  if (!results.success || (foodChanges.length === 0 && materialChanges.length === 0)) {
    return null;
  }

  const buttonClass = 'px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-fg-bright rounded text-xs font-medium transition-colors';

  return (
    <div className="mt-2 flex flex-wrap gap-2" data-testid="chaining-affordances">
      {foodChanges.length > 0 && (
        <button
          type="button"
          className={buttonClass}
          data-testid="chain-cook"
          onClick={() => actions.setPendingIntent({
            kind: 'cook',
            foodIds: foodChanges.map(change => change.itemId),
          })}
        >
          Cook with these
        </button>
      )}
      {materialChanges.length > 0 && (
        <>
          <button
            type="button"
            className={buttonClass}
            data-testid="chain-craft"
            onClick={() => actions.setPendingIntent({ kind: 'craft' })}
          >
            Craft with these
          </button>
          <button
            type="button"
            className={buttonClass}
            data-testid="chain-promote"
            onClick={() => {
              actions.setPendingIntent({
                kind: 'promote',
                sourceNames: materialChanges.map(change => change.itemName),
              });
              actions.setActiveModule('manager');
            }}
          >
            Send to lab
          </button>
        </>
      )}
    </div>
  );
}
