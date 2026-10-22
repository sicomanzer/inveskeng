import { StockItem, MarketType } from '@/types/stock';
import rawUsStocks from '../undervalued_stocks_unmasked.json';
import rawThaiStocks from '../thailand_stocks_unmasked.json';

export const US_STOCKS: StockItem[] = rawUsStocks as StockItem[];
export const THAI_STOCKS: StockItem[] = rawThaiStocks as StockItem[];
export const ALL_STOCKS: StockItem[] = [...US_STOCKS, ...THAI_STOCKS];

export function getStocksByMarket(market: MarketType): StockItem[] {
  return market === 'SET' ? THAI_STOCKS : US_STOCKS;
}
