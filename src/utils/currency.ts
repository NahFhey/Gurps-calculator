import type { CurrencyConfig } from '../types/campaign';

export function getPrimaryCurrencyUnit(config?: CurrencyConfig): string {
  if (!config) return 'cp';
  return config.currencies.find(currency => currency.key === config.primaryKey)?.key ?? 'cp';
}
