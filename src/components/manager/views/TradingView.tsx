import { useState } from 'react';
import { Coins, Plus, Trash2 } from 'lucide-react';
import { useCampaignStore } from '../../../state/campaignStore';
import { selectCurrencyConfig, selectPriceBook } from '../../../state/selectors';

function slugCurrencyKey(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function TradingView() {
  const { state, actions } = useCampaignStore();
  const config = selectCurrencyConfig(state);
  const priceBook = selectPriceBook(state);
  const [newCurrencyName, setNewCurrencyName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const renameCurrency = (key: string, name: string) => {
    actions.setCurrencyConfig({
      ...config,
      currencies: config.currencies.map((currency) => currency.key === key ? { ...currency, name } : currency),
    });
  };

  const addCurrency = () => {
    const key = slugCurrencyKey(newCurrencyName);
    if (!key) {
      setNotice('Enter a currency name.');
      return;
    }
    if (config.currencies.some((currency) => currency.key === key)) {
      setNotice(`Currency key "${key}" is already in use.`);
      return;
    }
    actions.setCurrencyConfig({
      currencies: [...config.currencies, { key, name: newCurrencyName.trim() }],
      primaryKey: config.primaryKey || key,
    });
    setNewCurrencyName('');
    setNotice(null);
  };

  const deleteCurrency = (key: string) => {
    if (key === config.primaryKey) {
      setNotice('The primary currency cannot be deleted. Select another primary currency first.');
      return;
    }
    actions.setCurrencyConfig({ ...config, currencies: config.currencies.filter((currency) => currency.key !== key) });
    setNotice(null);
  };

  return (
    <div className="space-y-8" data-testid="manager-trading-view">
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-100"><Coins className="h-5 w-5 text-amber-400" /> Currencies</h2>
        {notice && <p className="mb-3 rounded border border-amber-600/50 bg-amber-900/30 p-2 text-sm text-amber-200" role="status">{notice}</p>}
        <div className="overflow-x-auto rounded border border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-800 text-gray-300"><tr><th className="p-2">Primary</th><th className="p-2">Key</th><th className="p-2">Name</th><th className="p-2">Actions</th></tr></thead>
            <tbody>
              {config.currencies.map((currency) => {
                const isPrimary = currency.key === config.primaryKey;
                return (
                  <tr key={currency.key} className="border-t border-gray-700 bg-gray-900/40">
                    <td className="p-2"><input type="radio" name="primary-currency" checked={isPrimary} onChange={() => actions.setCurrencyConfig({ ...config, primaryKey: currency.key })} aria-label={`Set ${currency.name} primary`} /></td>
                    <td className="p-2 font-mono text-gray-400">{currency.key}</td>
                    <td className="p-2"><input value={currency.name} onChange={(event) => renameCurrency(currency.key, event.target.value)} aria-label={`Rename ${currency.key}`} className="w-full rounded border border-gray-600 bg-gray-950 px-2 py-1 text-gray-100" /></td>
                    <td className="p-2"><button type="button" onClick={() => deleteCurrency(currency.key)} disabled={isPrimary} title={isPrimary ? 'Primary currency cannot be deleted' : 'Delete currency'} aria-label={`Delete ${currency.name}`} className="text-red-400 disabled:cursor-not-allowed disabled:text-gray-600"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-2">
          <input value={newCurrencyName} onChange={(event) => setNewCurrencyName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addCurrency(); }} placeholder="New currency name" aria-label="New currency name" className="rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100" />
          <button type="button" onClick={addCurrency} className="rounded bg-amber-600 px-3 py-2 text-sm text-white hover:bg-amber-700"><Plus className="mr-1 inline h-4 w-4" /> Add currency</button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-100">Price book</h2>
        {Object.keys(priceBook).length === 0 ? (
          <p className="rounded border border-dashed border-gray-700 p-5 text-center text-sm text-gray-400">Prices are learned as you trade</p>
        ) : (
          <div className="overflow-x-auto rounded border border-gray-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-800 text-gray-300"><tr><th className="p-2">Name</th><th className="p-2">Kind</th><th className="p-2">Price</th><th className="p-2">Updated</th><th className="p-2">Actions</th></tr></thead>
              <tbody>
                {Object.values(priceBook).sort((left, right) => left.name.localeCompare(right.name)).map((entry) => (
                  <tr key={entry.key} className="border-t border-gray-700 bg-gray-900/40">
                    <td className="p-2 text-gray-100">{entry.name}</td><td className="p-2 capitalize text-gray-400">{entry.kind}</td>
                    <td className="p-2"><input type="number" min={0} value={entry.price} onChange={(event) => actions.setPriceBookEntry({ ...entry, price: Number(event.target.value), updatedAt: Date.now() })} aria-label={`Price for ${entry.name}`} className="w-24 rounded border border-gray-600 bg-gray-950 px-2 py-1 text-gray-100" /></td>
                    <td className="p-2 text-gray-400">{new Date(entry.updatedAt).toLocaleString()}</td>
                    <td className="p-2"><button type="button" onClick={() => actions.removePriceBookEntry(entry.key)} aria-label={`Delete ${entry.name} price`} className="text-red-400"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
