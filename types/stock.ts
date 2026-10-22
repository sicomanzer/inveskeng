export type FinancialHealthRating = 'EXCELLENT' | 'GREAT' | 'GOOD' | 'FAIR' | 'POOR' | 'WEAK';
export type AnalystRating = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'HOLD' | 'SELL' | 'STRONG_SELL' | 'BULLISH' | 'BEARISH';
export type MarketType = 'SET' | 'US' | 'ALL';

export interface StockItem {
  id: string; // Instrument/Pair ID
  symbol: string; // Ticker Symbol (e.g. BBIK, TOA, LULU)
  name: string; // Full Company Name
  shortName: string;
  link: string; // Link on Investing.com
  price: number; // Current Market Price
  currency: 'USD' | 'THB';
  currencySymbol: '$' | '฿';
  fairValue: number | null; // InvestingPro Fair Value Model Target
  fairValueUpside: number; // Upside %
  peRatio: number | null; // P/E Ratio
  evEbitda: number | null; // EV/EBITDA
  marketCap: number | null; // Market Cap
  marketCapFormatted: string; // e.g. "3.56B" or "$11.06B"
  epsGrowth5y: number | null; // 5-Year EPS Growth Rate
  changeOneDayPercent: number; // 1-Day Price Change %
  financialHealth: string; // Overall Financial Health
  financialCashFlowHealth?: string; // Cash Flow Rating
  financialGrowthHealth?: string; // Growth Rating
  financialProfitabilityHealth?: string; // Profitability Rating
  analystRatings?: string; // Analyst Recommendation
  flagCode: string; // 'TH' or 'US'
  flagName: string;
  market: MarketType;
  valuationType?: 'undervalued' | 'overvalued';
  lastUpdateTime?: string;
  locked?: boolean;
}

export function formatRatingText(val?: string | null, isThai: boolean = false): string {
  if (!val || val === '-' || val === '' || val === 'null' || val === 'undefined') return '-';
  const clean = val.trim();
  const normalized = clean.toUpperCase().replace(/[\s_-]+/g, '_');

  if (isThai) {
    switch (normalized) {
      case 'EXCELLENT':
        return 'ดีเยี่ยม';
      case 'GREAT':
        return 'ดีมาก';
      case 'GOOD':
      case 'OUTPERFORM':
        return 'ดี';
      case 'FAIR':
        return 'มูลค่าตามจริง';
      case 'POOR':
      case 'WEAK':
      case 'UNDERPERFORM':
        return 'แย่';
      case 'STRONG_BUY':
        return 'ซื้อทันที';
      case 'BUY':
        return 'ซื้อ';
      case 'NEUTRAL':
      case 'HOLD':
        return 'ถือหุ้นไว้';
      case 'SELL':
        return 'ขาย';
      case 'STRONG_SELL':
        return 'ขายทันที';
      case 'ดีเยี่ยม':
      case 'ดีมาก':
      case 'ดี':
      case 'มูลค่าตามจริง':
      case 'แย่':
      case 'ซื้อทันที':
      case 'ซื้อ':
      case 'ถือหุ้นไว้':
      case 'ขาย':
      case 'ขายทันที':
        return clean;
      default:
        return val;
    }
  }

  // English
  switch (normalized) {
    case 'EXCELLENT':
      return 'Excellent';
    case 'GREAT':
      return 'Great';
    case 'GOOD':
    case 'OUTPERFORM':
      return 'Good';
    case 'FAIR':
      return 'Fair';
    case 'POOR':
    case 'WEAK':
    case 'UNDERPERFORM':
      return 'Weak';
    case 'STRONG_BUY':
      return 'Strong Buy';
    case 'BUY':
      return 'Buy';
    case 'NEUTRAL':
      return 'Neutral';
    case 'HOLD':
      return 'Hold';
    case 'SELL':
      return 'Sell';
    case 'STRONG_SELL':
      return 'Strong Sell';
    default:
      return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
  }
}

export function getRatingColor(val?: string | null): string {
  if (!val || val === '-') return 'text-[#5B616E] dark:text-[#9CA3AF]';
  const text = val.trim();
  switch (text) {
    case 'EXCELLENT':
    case 'GREAT':
    case 'Excellent':
    case 'Great':
    case 'Strong Buy':
    case 'Buy':
    case 'ดีเยี่ยม':
    case 'ดีมาก':
    case 'ซื้อทันที':
    case 'ซื้อ':
      return 'text-[#007C32] dark:text-[#00C076] font-semibold';
    case 'GOOD':
    case 'Good':
    case 'ดี':
      return 'text-[#A38E00] dark:text-[#FBBF24] font-semibold';
    case 'FAIR':
    case 'Fair':
    case 'Neutral':
    case 'Hold':
    case 'มูลค่าตามจริง':
    case 'ถือหุ้นไว้':
      return 'text-[#232526] dark:text-[#E5E7EB] font-medium';
    case 'WEAK':
    case 'POOR':
    case 'Weak':
    case 'Poor':
    case 'Sell':
    case 'Strong Sell':
    case 'แย่':
    case 'อ่อนแอ':
    case 'ขาย':
    case 'ขายทันที':
      return 'text-[#D92D20] dark:text-[#F87171] font-semibold';
    default:
      return 'text-[#5B616E] dark:text-[#9CA3AF]';
  }
}
