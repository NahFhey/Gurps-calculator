import { useCampaignStore } from '../../../state/campaignStore';
import { selectCharacterInventory } from '../../../state/selectors/inventorySelectors';
import { useCombatStore } from '../../../hooks/useCombatStore';
import { inventoryLog } from '../../../utils/activityLogger';
import { createItemLogEntry } from '../../../utils/combatHelpers';
import type { CombatState, ConsumptionEntry, Participant } from '../../../types/combatTracker';
import type { ItemInstance } from '../../../types/campaign';

interface ActionPanelItemsWorkflowProps {
  currentActor: Participant;
  currentRound: number;
  currentTurn: number;
  onClose: () => void;
}

/** Inventory-backed item usage for the active combat participant. */
export default function ActionPanelItemsWorkflow({
  currentActor,
  currentRound,
  currentTurn,
  onClose,
}: ActionPanelItemsWorkflowProps) {
  const { state, actions } = useCampaignStore();
  const { saveCombatActive } = useCombatStore();
  const activeSession = state.combat.activeSession as unknown as CombatState | null;
  const characterId = currentActor.partyCharacterId;
  const characterInventory = characterId
    ? selectCharacterInventory(state, characterId)
    : undefined;
  const consumptions = activeSession?.consumptions ?? [];

  const handleUse = (item: ItemInstance) => {
    const itemName = item.name ?? 'Unnamed item';
    const quantityBefore = item.quantity ?? 0;

    if (activeSession) {
      const logEntry = createItemLogEntry({
        round: currentRound,
        turn: currentTurn,
        actorInstanceId: currentActor.instanceId,
        actorName: currentActor.name,
        item: {
          itemId: item.id,
          itemName,
          qtyBefore: quantityBefore,
          qtyAfter: Math.max(0, quantityBefore - 1),
        },
        text: `${currentActor.name} uses ${itemName}`,
      });
      saveCombatActive({
        ...activeSession,
        log: [...activeSession.log, logEntry],
      });
    }

    actions.consumeItem(item.id, 1, {
      participantId: currentActor.instanceId,
      participantName: currentActor.name,
      round: currentRound,
    });
    actions.addLogEntry(
      inventoryLog.itemConsumed(
        itemName,
        (characterId && state.entities.characters[characterId]?.name) || currentActor.name,
        characterId ? { characterIds: [characterId] } : undefined,
      ),
    );
  };

  const handleRevert = (entry: ConsumptionEntry) => {
    actions.revertItemConsumption(entry.id);
    actions.addLogEntry(
      inventoryLog.itemConsumptionReverted(
        entry.itemSnapshot.name ?? 'Unnamed item',
        state.entities.characters[entry.characterId]?.name ?? entry.participantName,
        { characterIds: [entry.characterId] },
      ),
    );
  };

  return (
    <div className="border-t border-gray-700 pt-4">
      <h4 className="text-lg font-semibold mb-3">Use Item</h4>

      {!characterId ? (
        <p className="text-gray-400 text-sm mb-4">
          No linked inventory — library combatants don't carry items.
        </p>
      ) : !characterInventory || characterInventory.items.length === 0 ? (
        <p className="text-gray-500 text-sm italic mb-4">No items.</p>
      ) : (
        <ul className="space-y-1 mb-4">
          {characterInventory.items.map((item) => {
            const itemName = item.name ?? 'Unnamed item';
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-gray-700/50"
              >
                <span className="text-gray-200">
                  {itemName}
                  <span className="text-gray-400 ml-2">x{item.quantity ?? 0}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleUse(item)}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-500 rounded text-sm font-medium"
                  aria-label={`Use ${itemName}`}
                >
                  Use
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-gray-700 pt-3 mb-4">
        <h5 className="text-sm font-semibold text-gray-300 mb-2">Used this encounter</h5>
        {consumptions.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No items used.</p>
        ) : (
          <ul className="space-y-1">
            {consumptions.map((entry) => {
              const itemName = entry.itemSnapshot.name ?? 'Unnamed item';
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-gray-700/30"
                >
                  <span className="text-sm text-gray-300">
                    {itemName} x{entry.quantity} · {entry.participantName} · Round {entry.round}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRevert(entry)}
                    className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs"
                    aria-label={`Undo use of ${itemName}`}
                  >
                    undo use
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        onClick={onClose}
        className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
        aria-label="Close items panel"
      >
        Close
      </button>
    </div>
  );
}
