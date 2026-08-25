import { useCallback, useMemo, useState } from 'react';
import { useCampaignStore } from '../../state/campaignStore';
import { denormalizeObject, normalizeArray } from '../../state/campaignUtils';
import type { Character, Inventory, ToolTemplate } from '../../types/campaign';
import { inventoryLog } from '../../utils/activityLogger';
import { toNumberOr } from '../../utils/helpers';
import { getCharacterPackLabel, getInventoryLabel } from './labels';
import type {
  DeleteConfirm,
  Food,
  FoodType,
  InventoryView,
  Material,
  MaterialType,
  TransferState,
} from './types';
import { InventoryOverviewView } from './views/InventoryOverviewView';
import { PartyStashView } from './views/PartyStashView';

/**
 * InventoryTab owns inventory state and store integration, then routes data and
 * callbacks into the pure inventory views.
 */
export function InventoryTab() {
  const { state, actions } = useCampaignStore();

  const materials = useMemo(() =>
    denormalizeObject(state.entities.materials) as Material[],
    [state.entities.materials]
  );
  const foods = useMemo(() =>
    denormalizeObject(state.entities.foods) as Food[],
    [state.entities.foods]
  );
  const inventories = useMemo(() =>
    Object.values(state.entities.inventories) as Inventory[],
    [state.entities.inventories]
  );

  const foodTypes = state.entities.foodTypes as Array<string | FoodType>;
  const materialTypes = state.entities.materialTypes as unknown as MaterialType[];
  const gmMode = state.ui.gmModeEnabled;
  const characters = state.entities.characters as Record<string, Character>;
  const toolTemplates = state.entities.toolTemplates as Record<string, ToolTemplate>;

  const saveMaterials = useCallback((materialsArray: Material[]) => {
    actions.setMaterials(normalizeArray(materialsArray));
  }, [actions]);

  const saveFoods = useCallback((foodsArray: Food[]) => {
    actions.setFoods(normalizeArray(foodsArray));
  }, [actions]);

  const [view, setView] = useState<InventoryView>('materials');
  const [showAddMat, setShowAddMat] = useState(false);
  const [showAddFood, setShowAddFood] = useState(false);
  const [useExistingMat, setUseExistingMat] = useState(false);
  const [useExistingFood, setUseExistingFood] = useState(false);
  const [selectedExistingMatId, setSelectedExistingMatId] = useState('');
  const [selectedExistingFoodId, setSelectedExistingFoodId] = useState('');
  const [newMatName, setNewMatName] = useState('');
  const [newMatQty, setNewMatQty] = useState('');
  const [newMatType, setNewMatType] = useState('');
  const [newFoodName, setNewFoodName] = useState('');
  const [newFoodQty, setNewFoodQty] = useState('');
  const [newFoodTypes, setNewFoodTypes] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [transferState, setTransferState] = useState<TransferState | null>(null);

  function addMat() {
    if (useExistingMat) {
      if (!selectedExistingMatId || !newMatQty) {
        alert('Select existing material and enter quantity');
        return;
      }
      saveMaterials(materials.map(material =>
        material.id === selectedExistingMatId
          ? { ...material, quantity: material.quantity + Math.max(0, toNumberOr(newMatQty, 0)) }
          : material
      ));
      setUseExistingMat(false);
      setSelectedExistingMatId('');
      setNewMatQty('');
      setShowAddMat(false);
      return;
    }

    if (!newMatName.trim() || !newMatQty || !newMatType) {
      alert('Fill all fields including material type');
      return;
    }

    const existing = materials.find(material =>
      material.name === newMatName.trim() && material.type === newMatType
    );
    if (existing) {
      saveMaterials(materials.map(material =>
        material.id === existing.id
          ? { ...material, quantity: material.quantity + Math.max(0, toNumberOr(newMatQty, 0)) }
          : material
      ));
    } else {
      saveMaterials([...materials, {
        id: crypto.randomUUID(),
        name: newMatName.trim(),
        quantity: Math.max(0, toNumberOr(newMatQty, 0)),
        type: newMatType,
      }]);
    }

    setNewMatName('');
    setNewMatQty('');
    setNewMatType('');
    setShowAddMat(false);
  }

  function addFood() {
    if (useExistingFood) {
      if (!selectedExistingFoodId || !newFoodQty) {
        alert('Select existing food and enter quantity');
        return;
      }
      saveFoods(foods.map(food =>
        food.id === selectedExistingFoodId
          ? { ...food, quantity: food.quantity + Math.max(0, toNumberOr(newFoodQty, 0)) }
          : food
      ));
      setUseExistingFood(false);
      setSelectedExistingFoodId('');
      setNewFoodQty('');
      setShowAddFood(false);
      return;
    }

    if (!newFoodName.trim() || !newFoodQty || newFoodTypes.length === 0) {
      alert('Fill all fields and add at least one type');
      return;
    }

    const sortedNewTypes = [...newFoodTypes].sort().join(',');
    const existing = foods.find(food => {
      const sortedExistingTypes = [...(food.types || [])].sort().join(',');
      return food.name === newFoodName.trim() && sortedExistingTypes === sortedNewTypes;
    });

    if (existing) {
      saveFoods(foods.map(food =>
        food.id === existing.id
          ? { ...food, quantity: food.quantity + Math.max(0, toNumberOr(newFoodQty, 0)) }
          : food
      ));
    } else {
      saveFoods([...foods, {
        id: crypto.randomUUID(),
        name: newFoodName.trim(),
        quantity: Math.max(0, toNumberOr(newFoodQty, 0)),
        types: [...newFoodTypes],
      }]);
    }

    setNewFoodName('');
    setNewFoodQty('');
    setNewFoodTypes([]);
    setShowAddFood(false);
  }

  const handleTransfer = useCallback(() => {
    if (!transferState || !transferState.targetInventoryId) {
      alert('Select a destination inventory');
      return;
    }

    const sourceInv = inventories.find(inventory => inventory.id === transferState.sourceInventoryId);
    const targetInv = inventories.find(inventory => inventory.id === transferState.targetInventoryId);

    if (!sourceInv || !targetInv) {
      alert('Invalid source or target inventory');
      return;
    }

    const retaggedItemId = transferState.type === 'item' ? transferState.itemId : undefined;
    if (retaggedItemId && targetInv.ownerType === 'character' && targetInv.ownerId) {
      const item = sourceInv.items.find(sourceItem => sourceItem.id === retaggedItemId);
      if (!item) {
        alert('Item not found in source inventory');
        return;
      }
      actions.retagItem(retaggedItemId, targetInv.ownerId);
      actions.addLogEntry(inventoryLog.itemTransferred(
        item.name ?? 'Unknown',
        getInventoryLabel(sourceInv, characters),
        getInventoryLabel(targetInv, characters),
        item.quantity
      ));
      setTransferState(null);
      return;
    }

    const updatedSource = { ...sourceInv };
    const updatedTarget = { ...targetInv };

    if (transferState.type === 'item' && transferState.itemId) {
      const itemIndex = updatedSource.items.findIndex(item => item.id === transferState.itemId);
      if (itemIndex === -1) {
        alert('Item not found in source inventory');
        return;
      }
      const [item] = updatedSource.items.splice(itemIndex, 1);
      updatedTarget.items = [...updatedTarget.items, item];
    } else if (transferState.type === 'tool' && transferState.toolId) {
      const toolIndex = updatedSource.tools.findIndex(tool => tool.toolId === transferState.toolId);
      if (toolIndex === -1) {
        alert('Tool not found in source inventory');
        return;
      }
      const [tool] = updatedSource.tools.splice(toolIndex, 1);
      updatedTarget.tools = [...updatedTarget.tools, tool];
    } else if (transferState.type === 'currency' && transferState.currencyKey) {
      const amount = parseInt(transferState.amount || '0', 10);
      if (amount <= 0) {
        alert('Enter a valid amount');
        return;
      }
      const available = updatedSource.currency[transferState.currencyKey] || 0;
      if (amount > available) {
        alert(`Not enough ${transferState.currencyKey}. Available: ${available}`);
        return;
      }
      updatedSource.currency = {
        ...updatedSource.currency,
        [transferState.currencyKey]: available - amount,
      };
      updatedTarget.currency = {
        ...updatedTarget.currency,
        [transferState.currencyKey]: (updatedTarget.currency[transferState.currencyKey] || 0) + amount,
      };
    }

    actions.updateInventory(updatedSource.id, {
      items: updatedSource.items,
      tools: updatedSource.tools,
      currency: updatedSource.currency,
    });
    actions.updateInventory(updatedTarget.id, {
      items: updatedTarget.items,
      tools: updatedTarget.tools,
      currency: updatedTarget.currency,
    });

    const sourceLabel = getInventoryLabel(sourceInv, characters);
    const targetLabel = getInventoryLabel(targetInv, characters);
    if (transferState.type === 'item' && transferState.itemId) {
      const item = sourceInv.items.find(sourceItem => sourceItem.id === transferState.itemId);
      actions.addLogEntry(inventoryLog.itemTransferred(
        item?.name || 'Unknown',
        sourceLabel,
        targetLabel,
        item?.quantity
      ));
    } else if (transferState.type === 'tool' && transferState.toolId) {
      const tool = sourceInv.tools.find(sourceTool => sourceTool.toolId === transferState.toolId);
      const template = toolTemplates[tool?.templateId || ''];
      actions.addLogEntry(inventoryLog.itemTransferred(
        template?.name || 'Unknown Tool',
        sourceLabel,
        targetLabel
      ));
    } else if (transferState.type === 'currency' && transferState.currencyKey) {
      const amount = parseInt(transferState.amount || '0', 10);
      actions.addLogEntry(inventoryLog.currencyTransferred(
        amount,
        transferState.currencyKey,
        sourceLabel,
        targetLabel
      ));
    }

    setTransferState(null);
  }, [actions, characters, inventories, toolTemplates, transferState]);

  const handleGiveItem = useCallback((inventoryId: string, itemId: string, characterId: string) => {
    const sourceInventory = inventories.find(inventory => inventory.id === inventoryId);
    const item = sourceInventory?.items.find(sourceItem => sourceItem.id === itemId);
    const character = characters[characterId];
    if (!sourceInventory || !item || !character) return;

    actions.retagItem(itemId, characterId);
    actions.addLogEntry(inventoryLog.itemTransferred(
      item.name ?? 'Unknown',
      getInventoryLabel(sourceInventory, characters),
      getCharacterPackLabel(character),
      item.quantity
    ));
  }, [actions, characters, inventories]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setView('materials')} className={`px-4 py-2 rounded ${view === 'materials' ? 'bg-blue-600' : 'bg-gray-700'}`}>Raw Materials</button>
        <button onClick={() => setView('foods')} className={`px-4 py-2 rounded ${view === 'foods' ? 'bg-blue-600' : 'bg-gray-700'}`}>Food Supplies</button>
        <button onClick={() => setView('stash')} className={`px-4 py-2 rounded ${view === 'stash' ? 'bg-blue-600' : 'bg-gray-700'}`}>Party Stash</button>
      </div>

      {view !== 'stash' && (
        <InventoryOverviewView
          view={view}
          materials={materials}
          foods={foods}
          foodTypes={foodTypes}
          materialTypes={materialTypes}
          gmMode={gmMode}
          showAddMat={showAddMat}
          setShowAddMat={setShowAddMat}
          showAddFood={showAddFood}
          setShowAddFood={setShowAddFood}
          useExistingMat={useExistingMat}
          setUseExistingMat={setUseExistingMat}
          useExistingFood={useExistingFood}
          setUseExistingFood={setUseExistingFood}
          selectedExistingMatId={selectedExistingMatId}
          setSelectedExistingMatId={setSelectedExistingMatId}
          selectedExistingFoodId={selectedExistingFoodId}
          setSelectedExistingFoodId={setSelectedExistingFoodId}
          newMatName={newMatName}
          setNewMatName={setNewMatName}
          newMatQty={newMatQty}
          setNewMatQty={setNewMatQty}
          newMatType={newMatType}
          setNewMatType={setNewMatType}
          newFoodName={newFoodName}
          setNewFoodName={setNewFoodName}
          newFoodQty={newFoodQty}
          setNewFoodQty={setNewFoodQty}
          newFoodTypes={newFoodTypes}
          setNewFoodTypes={setNewFoodTypes}
          expanded={expanded}
          setExpanded={setExpanded}
          deleteConfirm={deleteConfirm}
          setDeleteConfirm={setDeleteConfirm}
          onAddMaterial={addMat}
          onAddFood={addFood}
          onSaveMaterials={saveMaterials}
          onSaveFoods={saveFoods}
        />
      )}

      {view === 'stash' && (
        <PartyStashView
          inventories={inventories}
          characters={characters}
          toolTemplates={toolTemplates}
          transferState={transferState}
          onTransferStateChange={setTransferState}
          onConfirmTransfer={handleTransfer}
          onGiveItem={handleGiveItem}
        />
      )}
    </div>
  );
}
