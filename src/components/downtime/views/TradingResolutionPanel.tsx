import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Coins, Plus, Trash2 } from 'lucide-react';
import { useCampaignStore } from '../../../state/campaignStore';
import { selectCurrencyConfig, selectPriceBook } from '../../../state/selectors';
import {
  computeLineTotal,
  computeTradeTotals,
  getMerchantSkill,
  makePriceBookKey,
  resolveHaggle,
} from '../../../utils/trading';
import type { Character, InventoryOwner } from '../../../types/campaign';
import type { InventoryDelta, TaskResults } from '../../../types/downtime';
import type { HaggleResult, TradeLine } from '../../../utils/trading';
import type { TradingTask } from './TradingTaskCard';

export interface TradeOutcome {
  lines: TradeLine[];
  haggle: HaggleResult | null;
  shiftPct: number;
  totals: ReturnType<typeof computeTradeTotals>;
  summary: string;
  dealBroken: boolean;
}

interface TradingResolutionPanelProps {
  task: TradingTask;
  leader: Character;
  onFinalize: (results: TaskResults, outcome: TradeOutcome) => void;
  onCancel: () => void;
}

interface SellOption {
  key: string;
  itemKind: 'material' | 'food' | 'item';
  name: string;
  available: number;
  owner: InventoryOwner;
  ownerLabel: string;
  itemId?: string;
  materialType?: string;
  fallbackPrice: number;
}

const inputClass = 'rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100';

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

export function TradingResolutionPanel({ task, leader, onFinalize, onCancel }: TradingResolutionPanelProps) {
  const { state } = useCampaignStore();
  const currencyConfig = selectCurrencyConfig(state);
  const priceBook = selectPriceBook(state);
  const primaryCurrency = currencyConfig.currencies.find((currency) => currency.key === currencyConfig.primaryKey)
    ?? currencyConfig.currencies[0]
    ?? { key: currencyConfig.primaryKey, name: currencyConfig.primaryKey };
  const partyInventory = Object.values(state.entities.inventories).find((inventory) => inventory.ownerType === 'party');
  const balance = partyInventory?.currency[primaryCurrency.key] ?? 0;
  const merchantSkill = getMerchantSkill(leader);
  const nextId = useRef(0);
  const createLineId = () => `trade-line-${++nextId.current}`;
  const [lines, setLines] = useState<TradeLine[]>([]);
  const [sellKey, setSellKey] = useState('');
  const [sellQuantity, setSellQuantity] = useState(1);
  const [sellPrice, setSellPrice] = useState(0);
  const [buyKind, setBuyKind] = useState<'material' | 'food' | 'item'>('material');
  const [buyName, setBuyName] = useState('');
  const [buyType, setBuyType] = useState('');
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [buyPrice, setBuyPrice] = useState(0);
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [haggle, setHaggle] = useState<HaggleResult | null>(null);

  const sellOptions = useMemo<SellOption[]>(() => {
    const options: SellOption[] = [];
    for (const material of partyInventory?.materials ?? []) {
      options.push({
        key: `material:${material.id}`,
        itemKind: 'material',
        name: material.name,
        available: material.quantity,
        owner: 'party',
        ownerLabel: 'Party Stash',
        materialType: material.type,
        fallbackPrice: 0,
      });
    }
    for (const food of partyInventory?.food ?? []) {
      options.push({
        key: `food:${food.id}`,
        itemKind: 'food',
        name: food.name,
        available: food.quantity,
        owner: 'party',
        ownerLabel: 'Party Stash',
        materialType: food.type ?? food.types?.join(',') ?? '',
        fallbackPrice: 0,
      });
    }
    for (const inventory of Object.values(state.entities.inventories)) {
      const owner: InventoryOwner = inventory.ownerType === 'party' ? 'party' : inventory.ownerId ?? 'party';
      const characterName = inventory.ownerId ? state.entities.characters[inventory.ownerId]?.name : undefined;
      const ownerLabel = inventory.ownerType === 'party' ? 'Party Stash' : `${characterName ?? inventory.ownerId ?? 'Character'}'s Pack`;
      for (const item of inventory.items) {
        options.push({
          key: `item:${item.id}`,
          itemKind: 'item',
          name: item.name ?? 'Unnamed item',
          available: item.quantity ?? 0,
          owner,
          ownerLabel,
          itemId: item.id,
          fallbackPrice: item.value ?? 0,
        });
      }
    }
    return options.filter((option) => option.available > 0);
  }, [partyInventory, state.entities.characters, state.entities.inventories]);

  const optionMatchesLine = (option: SellOption, line: TradeLine): boolean => {
    if (line.kind !== 'sell' || line.itemKind !== option.itemKind) return false;
    if (option.itemKind === 'item') return line.itemId === option.itemId;
    return line.name === option.name && line.materialType === option.materialType;
  };
  const availableSellOptions = sellOptions.map((option) => ({
    ...option,
    available: option.available - lines
      .filter((line) => optionMatchesLine(option, line))
      .reduce((total, line) => total + line.quantity, 0),
  })).filter((option) => option.available > 0 || option.key === sellKey);
  const selectedSell = availableSellOptions.find((option) => option.key === sellKey);
  const shiftPct = haggle?.shiftPct ?? 0;
  const totals = useMemo(() => computeTradeTotals(lines, shiftPct), [lines, shiftPct]);
  const insufficientFunds = balance + totals.net < 0;
  const locked = haggle?.dealBroken ?? false;

  const selectSellOption = (key: string) => {
    setSellKey(key);
    const option = sellOptions.find((candidate) => candidate.key === key);
    if (!option) return;
    setSellQuantity(Math.min(1, option.available));
    setSellPrice(priceBook[makePriceBookKey(option.itemKind, option.name)]?.price ?? option.fallbackPrice);
  };

  const addSellLine = () => {
    if (!selectedSell) return;
    setLines((current) => [...current, {
      id: createLineId(),
      kind: 'sell',
      itemKind: selectedSell.itemKind,
      name: selectedSell.name,
      quantity: Math.max(1, Math.min(selectedSell.available, sellQuantity)),
      unitPrice: sellPrice,
      itemId: selectedSell.itemId,
      owner: selectedSell.owner,
      materialType: selectedSell.materialType,
    }]);
    setSellKey('');
    setSellQuantity(1);
    setSellPrice(0);
  };

  const updateBuyName = (name: string) => {
    setBuyName(name);
    const learned = priceBook[makePriceBookKey(buyKind, name)];
    if (learned) setBuyPrice(learned.price);
  };

  const updateBuyKind = (kind: 'material' | 'food' | 'item') => {
    setBuyKind(kind);
    const learned = priceBook[makePriceBookKey(kind, buyName)];
    if (learned) setBuyPrice(learned.price);
  };

  const addBuyLine = () => {
    if (!buyName.trim() || buyQuantity <= 0) return;
    setLines((current) => [...current, {
      id: createLineId(),
      kind: 'buy',
      itemKind: buyKind,
      name: buyName.trim(),
      quantity: Math.max(1, buyQuantity),
      unitPrice: buyPrice,
      materialType: buyKind === 'material' ? buyType.trim() : undefined,
    }]);
    setBuyName('');
    setBuyType('');
    setBuyQuantity(1);
    setBuyPrice(0);
  };

  const addAdjustLine = () => {
    if (!adjustNote.trim() || adjustAmount === 0) return;
    setLines((current) => [...current, {
      id: createLineId(),
      kind: 'adjust',
      name: adjustNote.trim(),
      quantity: 1,
      unitPrice: adjustAmount,
    }]);
    setAdjustNote('');
    setAdjustAmount(0);
  };

  const updateLine = (id: string, changes: Partial<TradeLine>) => {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...changes } : line));
  };

  const updateSellQuantity = (line: TradeLine, requestedQuantity: number) => {
    const source = sellOptions.find((option) => optionMatchesLine(option, line));
    if (!source) {
      updateLine(line.id, { quantity: Math.max(1, requestedQuantity) });
      return;
    }
    const reservedByOtherLines = lines
      .filter((candidate) => candidate.id !== line.id && optionMatchesLine(source, candidate))
      .reduce((total, candidate) => total + candidate.quantity, 0);
    updateLine(line.id, {
      quantity: Math.max(1, Math.min(source.available - reservedByOtherLines, requestedQuantity)),
    });
  };

  const buildSummary = (): string => {
    const parts = lines.map((line) => {
      const total = computeLineTotal(line, shiftPct);
      if (line.kind === 'adjust') return `${line.name} ${formatSigned(total)} ${primaryCurrency.key}`;
      return `${line.kind === 'sell' ? 'sold' : 'bought'} ${line.quantity}x ${line.name} for ${total} ${primaryCurrency.key}`;
    });
    if (haggle) {
      parts.push(
        `haggled ${formatSigned(haggle.shiftPct)}% `
        + `(leader ${haggle.leaderRoll.total} vs ${haggle.leaderRoll.target}, `
        + `opponent ${haggle.opponentRoll.total} vs ${haggle.opponentRoll.target})`
      );
    }
    parts.push(`net ${formatSigned(totals.net)} ${primaryCurrency.key}`);
    return parts.join(', ');
  };

  const handleApply = () => {
    if (locked) {
      const summary = 'The merchant refuses to deal.';
      onFinalize(
        { success: false, message: summary, inventoryChanges: [] },
        { lines, haggle, shiftPct, totals, summary, dealBroken: true }
      );
      return;
    }
    if (lines.length === 0 || insufficientFunds) return;
    const summary = buildSummary();
    const inventoryChanges: InventoryDelta[] = lines.flatMap((line) => {
      if (line.kind === 'adjust' || !line.itemKind) return [];
      return [{
        itemId: line.itemId ?? makePriceBookKey(line.itemKind, line.name),
        itemName: line.name,
        quantity: line.kind === 'sell' ? -line.quantity : line.quantity,
        ...(line.itemKind === 'material' || line.itemKind === 'food' ? { kind: line.itemKind } : {}),
      }];
    });
    onFinalize(
      { success: true, message: summary, inventoryChanges },
      { lines, haggle, shiftPct, totals, summary, dealBroken: false }
    );
  };

  return (
    <div className="rounded-lg border border-amber-500/50 bg-gray-800 p-4" data-testid="trading-resolution-panel">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 font-semibold text-gray-100"><Coins className="h-5 w-5 text-amber-400" /> Trade with {task.activityData.merchantName}</h4>
        <p className="rounded bg-gray-900 px-3 py-1.5 text-sm text-gray-200" data-testid="party-funds">
          Party funds: <span className="font-semibold text-amber-300">{balance} {primaryCurrency.name}</span>
        </p>
      </header>

      {locked && (
        <div className="mb-4 flex items-center gap-2 rounded border border-red-600/60 bg-red-900/30 p-3 text-sm text-red-200" role="alert">
          <AlertTriangle className="h-4 w-4" /> The merchant refuses to deal.
        </div>
      )}

      <fieldset disabled={locked} className="space-y-5 disabled:opacity-50">
        <section>
          <h5 className="mb-2 font-medium text-gray-200">Sell</h5>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_5rem_7rem_auto]">
            <select value={sellKey} onChange={(event) => selectSellOption(event.target.value)} data-testid="sell-picker" aria-label="Sell item" className={inputClass}>
              <option value="">Choose party goods...</option>
              {availableSellOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.name} — {option.ownerLabel} ({option.available})</option>
              ))}
            </select>
            <input type="number" min={1} max={selectedSell?.available} value={sellQuantity} onChange={(event) => setSellQuantity(Number(event.target.value))} aria-label="Sell quantity" data-testid="sell-quantity-input" className={inputClass} />
            <input type="number" min={0} value={sellPrice} onChange={(event) => setSellPrice(Number(event.target.value))} aria-label="Sell unit price" data-testid="sell-unit-price-input" className={inputClass} />
            <button type="button" onClick={addSellLine} disabled={!selectedSell} data-testid="add-sell-line-button" className="rounded bg-amber-700 px-3 py-1.5 text-sm text-white disabled:bg-gray-700"><Plus className="inline h-4 w-4" /> Add</button>
          </div>
        </section>

        <section>
          <h5 className="mb-2 font-medium text-gray-200">Buy</h5>
          <div className="grid gap-2 sm:grid-cols-6">
            <select value={buyKind} onChange={(event) => updateBuyKind(event.target.value as 'material' | 'food' | 'item')} aria-label="Buy kind" data-testid="buy-kind-select" className={inputClass}>
              <option value="material">Material</option><option value="food">Food</option><option value="item">Item</option>
            </select>
            <input value={buyName} onChange={(event) => updateBuyName(event.target.value)} placeholder="Name" aria-label="Buy name" data-testid="buy-name-input" className={`${inputClass} sm:col-span-2`} />
            {buyKind === 'material' && <input value={buyType} onChange={(event) => setBuyType(event.target.value)} placeholder="Type" aria-label="Buy material type" data-testid="buy-type-input" className={inputClass} />}
            <input type="number" min={1} value={buyQuantity} onChange={(event) => setBuyQuantity(Number(event.target.value))} aria-label="Buy quantity" data-testid="buy-quantity-input" className={inputClass} />
            <input type="number" min={0} value={buyPrice} onChange={(event) => setBuyPrice(Number(event.target.value))} aria-label="Buy unit price" data-testid="buy-unit-price-input" className={inputClass} />
            <button type="button" onClick={addBuyLine} disabled={!buyName.trim()} data-testid="add-buy-line-button" className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white disabled:bg-gray-700"><Plus className="inline h-4 w-4" /> Add</button>
          </div>
        </section>

        <section>
          <h5 className="mb-2 font-medium text-gray-200">Adjust</h5>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_8rem_auto]">
            <input value={adjustNote} onChange={(event) => setAdjustNote(event.target.value)} placeholder="Note or reason" aria-label="Adjustment note" data-testid="adjust-note-input" className={inputClass} />
            <input type="number" value={adjustAmount} onChange={(event) => setAdjustAmount(Number(event.target.value))} aria-label="Signed adjustment amount" data-testid="adjust-amount-input" className={inputClass} />
            <button type="button" onClick={addAdjustLine} disabled={!adjustNote.trim() || adjustAmount === 0} data-testid="add-adjust-line-button" className="rounded bg-gray-600 px-3 py-1.5 text-sm text-white disabled:bg-gray-700"><Plus className="inline h-4 w-4" /> Add</button>
          </div>
        </section>

        {lines.length > 0 && (
          <section className="space-y-2" data-testid="trade-lines">
            {lines.map((line) => (
              <div key={line.id} className="grid items-center gap-2 rounded bg-gray-900/60 p-2 text-sm sm:grid-cols-[5rem_minmax(0,1fr)_5rem_7rem_6rem_auto]">
                <span className={line.kind === 'sell' ? 'text-green-300' : line.kind === 'buy' ? 'text-blue-300' : 'text-gray-300'}>{line.kind}</span>
                <span className="text-gray-100">{line.name}</span>
                <input type="number" min={1} value={line.quantity} disabled={line.kind === 'adjust'} onChange={(event) => line.kind === 'sell' ? updateSellQuantity(line, Number(event.target.value)) : updateLine(line.id, { quantity: Math.max(1, Number(event.target.value)) })} aria-label={`${line.name} quantity`} className={inputClass} />
                <input type="number" min={line.kind === 'adjust' ? undefined : 0} value={line.unitPrice} onChange={(event) => updateLine(line.id, { unitPrice: Number(event.target.value) })} aria-label={`${line.name} unit price`} className={inputClass} />
                <span className="text-right text-gray-200">{computeLineTotal(line, shiftPct)} {primaryCurrency.key}</span>
                <button type="button" onClick={() => setLines((current) => current.filter((candidate) => candidate.id !== line.id))} aria-label={`Remove ${line.name}`} className="text-red-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </section>
        )}

        <section className="rounded border border-gray-700 bg-gray-900/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-300">Merchant-{merchantSkill.level} vs Merchant-{task.activityData.opposingSkill}</p>
            <button type="button" onClick={() => setHaggle(resolveHaggle(merchantSkill.level, task.activityData.opposingSkill))} disabled={Boolean(haggle)} data-testid="roll-haggle-button" className="rounded bg-purple-700 px-3 py-1.5 text-sm text-white disabled:bg-gray-700">Roll Haggle</button>
          </div>
          {haggle && (
            <div className="mt-2 text-sm text-purple-200" data-testid="haggle-result">
              Leader {haggle.leaderRoll.total} vs {haggle.leaderRoll.target}; opponent {haggle.opponentRoll.total} vs {haggle.opponentRoll.target}. Shift {formatSigned(haggle.shiftPct)}%.
            </div>
          )}
        </section>
      </fieldset>

      <footer className="mt-5 rounded bg-gray-900 p-3">
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-300 sm:grid-cols-5" data-testid="trade-totals">
          <span>Proceeds: {totals.proceeds}</span><span>Costs: {totals.costs}</span><span>Adjustments: {formatSigned(totals.adjustNet)}</span><span>Net: {formatSigned(totals.net)}</span><span>Balance: {balance + totals.net}</span>
        </div>
        {insufficientFunds && !locked && <p className="mt-2 text-sm text-red-300" role="alert">Insufficient funds for this trade.</p>}
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={handleApply} disabled={!locked && (lines.length === 0 || insufficientFunds)} data-testid="apply-trade-button" className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500">Apply</button>
          <button type="button" onClick={onCancel} className="rounded border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">Cancel</button>
        </div>
      </footer>
    </div>
  );
}
