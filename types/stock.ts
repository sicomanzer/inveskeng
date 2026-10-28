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
  /** ปันผลจริงจากหน้า "หุ้นปันผล" (yfinance) — ใช้แทนค่าประมาณใน popup
   *  เมื่อหุ้นตัวนั้นไม่มีข้อมูลงบจริงใน stock_details_*.json */
  dividendOverride?: {
    ttm: number | null;
    prevFY: number | null;
    payments: { date: string; amount: number }[];
  };
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
    case 'ดีเยี่ยม':
      return 'Excellent';
    case 'ดีมาก':
      return 'Great';
    case 'ดี':
      return 'Good';
    case 'มูลค่าตามจริง':
      return 'Fair';
    case 'แย่':
      return 'Weak';
    case 'ซื้อทันที':
      return 'Strong Buy';
    case 'ซื้อ':
      return 'Buy';
    case 'ถือหุ้นไว้':
      return 'Neutral';
    case 'ขาย':
      return 'Sell';
    case 'ขายทันที':
      return 'Strong Sell';
    default:
      return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
  }
}

export function getCanonicalRating(val?: string | null): string {
  if (!val || val === '-' || val === '' || val === 'null' || val === 'undefined') return '';
  const clean = val.trim();
  const normalized = clean.toUpperCase().replace(/[\s_-]+/g, '_');

  switch (normalized) {
    case 'EXCELLENT':
    case 'ดีเยี่ยม':
      return 'EXCELLENT';
    case 'GREAT':
    case 'ดีมาก':
      return 'GREAT';
    case 'GOOD':
    case 'OUTPERFORM':
    case 'ดี':
      return 'GOOD';
    case 'FAIR':
    case 'มูลค่าตามจริง':
    case 'ปานกลาง':
      return 'FAIR';
    case 'POOR':
    case 'WEAK':
    case 'UNDERPERFORM':
    case 'แย่':
    case 'อ่อนแอ':
      return 'WEAK';
    case 'STRONG_BUY':
    case 'ซื้อทันที':
      return 'STRONG_BUY';
    case 'BUY':
    case 'ซื้อ':
      return 'BUY';
    case 'NEUTRAL':
    case 'HOLD':
    case 'ถือหุ้นไว้':
      return 'NEUTRAL';
    case 'SELL':
    case 'ขาย':
      return 'SELL';
    case 'STRONG_SELL':
    case 'ขายทันที':
      return 'STRONG_SELL';
    default:
      return normalized;
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

/* ---------- Dividend screener ("หุ้นปันผล") ----------
 * ตรงกับหน้า Investing.com /stock-screener (บันทึกเงื่อนไขไว้ใน ssid)
 * div_yield > 5% AND div_yield_avg_5y > 5%, ตลาดไทย, เรียงตาม market cap
 */
export interface DividendStock {
  symbol: string;
  name: string;
  pairId?: number | null;
  path?: string;
  sector?: string;
  industry?: string;
  currency: 'THB';
  price: number;
  changePercent: number | null;
  divYield: number | null;
  avgYield5y: number | null;
  dpsLastYear?: number | null;
  dpsPrevFY?: number | null;
  divPayments?: { date: string; amount: number }[];
  dpsByYear?: Record<string, number>;
  yieldYearsUsed?: string[];
  marketCap?: number | null;
  peRatio?: number | null;
  pegRatio?: number | null;
  sourcePrice?: number | null;
  sourceChangePercent?: number | null;
  dividendsAsOf?: string | null;
}

export interface DividendCriteria {
  market: string;
  divYieldMin: number;
  avgYield5yMin: number;
  limit: number;
  sort: string;
  primaryOnly: boolean;
}

export interface DividendPayload {
  asOf: string;
  sourceAsOf: string;
  partial: boolean;
  criteria: DividendCriteria;
  totalMatches: number | null;
  sourceUrl: string;
  items: DividendStock[];
}

export function formatMarketCapTHB(n?: number | null): string {
  if (n === null || n === undefined || !isFinite(n)) return '-';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toFixed(0);
}
