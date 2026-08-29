import { DEFAULT_CURRENCY_CONFIG } from '../../constants';
import type { CampaignState } from '../campaignReducer';
import type { CurrencyConfig, PriceBookEntry } from '../../types/campaign';

export const selectCurrencyConfig = (state: CampaignState): CurrencyConfig =>
  state.entities.currencyConfig ?? DEFAULT_CURRENCY_CONFIG;

export const selectPriceBook = (state: CampaignState): Record<string, PriceBookEntry> =>
  state.entities.priceBook ?? {};
