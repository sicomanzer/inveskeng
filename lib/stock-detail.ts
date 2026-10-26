import { StockItem, getCanonicalRating } from '@/types/stock';

/* ------------------------------------------------------------------ *
 * Stock Detail Model — สูตรตามเว็บอ้างอิง (screenshot BBIK) ใช้
 * ข้อมูลจริง 100% จาก thaifin (SET) + yfinance (US)
 *
 * สูตรที่ยืนยันแล้วด้วยการคำนวณย้อนกลับ:
 *  - DDM 2-stage  (D₀, r, g₁, g₂)               → intrinsic value
 *  - DCF-FE       FCFE × [Σ(1+g1)^k/(1+w)^k
 *                 + (1+g1)⁵(1+g₂)/((w−g₂)(1+w)⁵)] − netDebt → ÷ shares
 *  - terminal share = TV มัลติพาย / มัลติพายรวม
 *  - price implies terminal growth g₂ = solve ให้ DCF value = ราคา
 *  - WACC = r×We + costDebt×Wd ; We = mktCap/(mktCap+debt)
 *  - Graham growth = EPS×(8.5+2g)×4.4/AAA-yield
 *  - score = passer × 7  |  MoS = (value−price)/value
 *  ------------------------------------------------------------------ */

export type RuleState = 'PASS' | 'FAIL' | 'WARN' | 'NA';

export interface ScorecardRow {
  labelTh: string;
  labelEn: string;
  value: string;
  state: RuleState;
  /** YoY delta แบบ·33% (ถ้ามีข้อมูลปีก่อนหน้า) */
  delta?: number;
}

export interface ValuationBandChart {
  name: 'P/E' | 'P/BV';
  now: number;
  nowLabel: 'TTM' | 'latest quarter';
  vsMeanSigma: number; // (now − mean)/σ เช่น −0.89
  mean: number;
  sigma: number;
  sigmas: { label: string; value: number }[];
  history: { x: number; v: number }[];
  realHistory: boolean;
}

export interface PeersRow {
  measure: string;
  measureTh: string;
  value: string;
  higherIsBetter: boolean;
  marketPct: number;
  industryPct: number;
}

export interface StatementRow {
  fy: number;
  roe: number | null;
  roa: number | null;
  npm: number | null;
  d_e: number | null;
  eps: number | null;
  bvps: number | null;
  dps: number | null;
}

export interface AnnualChartSpec {
  key: string;
  titleTh: string;
  titleEn: string;
  format: 'baht_m' | 'baht' | 'pct' | 'x';
  series: { x: number; y: number }[];
  real: boolean;
}

export interface DivPayment { date: string; amount: number }

/** investing.com instrument suffix (TACCm, MAGUROm, …) → plain SET ticker.
 *  stock_details_*.json keys use plain tickers (thaifin/yfinance), while the
 *  table symbol keeps the raw investing.com value — lookups must try both. */
export function instrumentSymbolKey(symbol: string): string {
  const last = symbol.slice(-1);
  if (symbol.length >= 4 && /[a-z]/.test(last) && symbol.slice(0, -1) === symbol.slice(0, -1).toUpperCase()) {
    return symbol.slice(0, -1);
  }
  return symbol;
}

export function lookupReal<T>(items: Record<string, T> | null | undefined, symbol: string): T | null {
  if (!items) return null;
  const direct = items[symbol];
  if (direct) return direct;
  return items[instrumentSymbolKey(symbol)] ?? null;
}

export interface RealFinancialData {
  source: string;
  currency: string;
  fiscalYears: number[];
  latestFY: number | null;
  metrics: Partial<{
    roe: number; roa: number; npm: number; gpm: number; de: number;
    peRatio: number; pbv: number; evEbitda: number;
    eps: number; ttmEps: number; ttmNetProfit: number;
    bvps: number; bvpsQ: number;
    dividendYield: number; payout: number; dps: number;
    mktCap: number; netProfit: number; revenue: number;
    opCashflow: number; coverage: number;
    totalDebt: number; equity: number; cash: number;
    cashQ: number; debtQ: number; equityQ: number; assetQ: number;
    liabDeQ: number; shares: number; sharesQ: number;
    close: number; revenueGrowth: number; earningsGrowth: number;
  }>;
  netDebt: number | null;
  netDebtQ: number | null;
  fcfe: number | null;
  dpsTTM: number | null;
  /** คีย์ภายในสำหรับ fallback ของ peers (ไม่มีข้อมูลจริง) */
  _derivedFallback?: Record<string, number>;
  series: Partial<{
    netProfit: (number | null)[];
    revenue: (number | null)[];
    eps: (number | null)[];
    gm: (number | null)[];
    npm: (number | null)[];
    roe: (number | null)[];
    dps: (number | null)[];
    dve: (number | null)[];
    liabDe: (number | null)[];
    bvps: (number | null)[];
    roa: (number | null)[];
    peSeries: (number | null)[];
    pbvSeries: (number | null)[];
    opCashflow: (number | null)[];
    coverage: (number | null)[];
  }>;
  bandWeekly?: { pe?: number[]; pbv?: number[] };
  divPayments?: DivPayment[];
}

export interface SliderDefault {
  key: 'requiredReturn' | 'growthYears15' | 'terminalGrowth' | 'aaaYield';
  value: number;
  labelTh: string; labelEn: string;
  descTh: string; descEn: string;
}

export interface StockDetail {
  symbol: string;
  name: string;
  price: number;
  currencySymbol: string;
  currency: string;
  priceAsOf: string;

  score: number;
  fiscalYearsUsed: number;

  quality: { passCount: number; totalCount: number; naCount: number; rules: ScorecardRow[] };

  sliders: SliderDefault[];

  valuationBase: {
    dividendLatest: number;     // D₀
    cashReceived12m: number;    // เท่ากับ D₀
    costDebtAfterTax: number;
    borrowingRatePreTax: number;
    netDebt: number;            // งบล่าสุด (ไตรมาสถ้ามี)
    fcfeMedian: number;
    fcfePerShare: number;
    sharesOutstanding: number;
    weightEquity: number;
    ttmEps: number;
    grahamNumber: number;
    coverageDisplay: string;    // เช่น "55.4×" หรือ N/A
  };

  bands: ValuationBandChart[];

  peers: {
    industryLabel: string;
    marketNames: number;
    industryNames: number;
    rows: PeersRow[];
  };

  charts: AnnualChartSpec[];
  divPayments: DivPayment[];
  divPaymentsReal: boolean;

  statements: StatementRow[];

  meta: {
    dataSource: 'real' | 'derived';
    realSource?: string;
    latestFY?: number | null;
    /** key สำหรับ component แปล: 'thaifinDyQ' | 'yfTtm' | 'derived' */
    dpsSource: string;
    realArea: {
      scorecard: boolean;
      valuation: boolean;
      bands: boolean;
      peers: boolean;
      charts: boolean;
      statements: boolean;
    };
  };
}

/* ---------------- generic helpers ---------------- */

export function round(n: number, d = 2): number {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}

/** deterministic hash — ใช้เฉพาะ fallback ที่ประมาณการ */
function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function jitter(seed: string, salt = 0): number {
  return (((hash32(`${seed}#${salt}`) % 65536) / 65536) * 2) - 1;
}

type RatingLevel = 'EXCELLENT' | 'GREAT' | 'GOOD' | 'FAIR' | 'WEAK' | 'NONE';

function levelOf(canonical: string): RatingLevel {
  if (canonical === 'EXCELLENT') return 'EXCELLENT';
  if (canonical === 'GREAT') return 'GREAT';
  if (canonical === 'GOOD') return 'GOOD';
  if (canonical === 'FAIR') return 'FAIR';
  if (canonical === 'WEAK') return 'WEAK';
  return 'NONE';
}

interface BaseMetrics {
  health: RatingLevel;
  roe: number; roa: number; npm: number; gpm: number;
  dE: number;
  dividendYield: number;
  payout: number;
  peRatio: number;
  pbv: number;
  eps: number;
  ttmEps: number;
  bvps: number;
  dps: number;
  sharesOutstanding: number;
  mktCap: number;
  netDebt: number;
  fcfeMedian: number; fcfePerShare: number;
  weightEquity: number;
  costDebtAfterTax: number;
  borrowingRatePreTax: number;
  coverage: number | null;
  totalDebt: number;
}

/* ---------------- derived-model fallback (ไม่มีข้อมูลจริง) ---------------- */

const ROE_MAP: Record<RatingLevel, number> = { EXCELLENT: 18.7, GREAT: 16.0, GOOD: 13.5, FAIR: 9.0, WEAK: 4.5, NONE: 8.0 };
const NPM_MAP: Record<RatingLevel, number> = { EXCELLENT: 11.0, GREAT: 9.0, GOOD: 6.0, FAIR: 4.5, WEAK: 2.0, NONE: 5.0 };
const ROA_MAP: Record<RatingLevel, number> = { EXCELLENT: 8.0, GREAT: 6.5, GOOD: 5.0, FAIR: 3.5, WEAK: 1.5, NONE: 4.0 };
const DE_MAP: Record<RatingLevel, number> = { EXCELLENT: 0.44, GREAT: 0.75, GOOD: 1.05, FAIR: 1.45, WEAK: 2.20, NONE: 1.20 };
const YIELD_MAP: Record<RatingLevel, number> = { EXCELLENT: 6.2, GREAT: 5.4, GOOD: 3.8, FAIR: 2.4, WEAK: 1.0, NONE: 3.0 };
const PAYOUT_MAP: Record<RatingLevel, number> = { EXCELLENT: 58, GREAT: 55, GOOD: 48, FAIR: 38, WEAK: 20, NONE: 42 };

/** ตั้งจุดกู้ยืมก่อนภาษีจากอัตราตลาด (จาไม่มีดอกเบี้ยจ่ายจริง — SET ไม่มีข้อมูลใน thaifin) */
const BORROWING_PRE_TAX: Record<string, number> = { SET: 0.065, US: 0.055 };
const TAX_RATE: Record<string, number> = { SET: 0.20, US: 0.21 };

function buildDerivedMetrics(stock: StockItem): BaseMetrics {
  const health = levelOf(getCanonicalRating(stock.financialHealth));
  const roe = Math.max(1, ROE_MAP[health] + jitter(stock.symbol, 41) * 1.5);
  const npm = Math.max(0.5, NPM_MAP[health] + jitter(stock.symbol, 42) * 1.2);
  const roa = Math.max(0.4, ROA_MAP[health] + jitter(stock.symbol, 43) * 0.9);
  const dE = Math.max(0.05, DE_MAP[health] + jitter(stock.symbol, 44) * 0.15);
  const dividendYield = Math.max(0, YIELD_MAP[health] + jitter(stock.symbol, 45) * 1.0);
  const payout = Math.max(0, Math.min(95, PAYOUT_MAP[health] + jitter(stock.symbol, 46) * 8));
  const peRatio = stock.peRatio != null && stock.peRatio > 0 ? stock.peRatio : (stock.evEbitda ? stock.evEbitda * 1.3 : 10);
  const pbv = (peRatio * roe) / 100;
  const eps = stock.price / Math.max(0.1, peRatio);
  const bvps = eps / Math.max(0.01, roe / 100);
  const dps = eps * (payout / 100) || dividendYield * stock.price / 100;
  const mktCap = stock.marketCap ?? 1e9;
  const sharesOutstanding = mktCap / Math.max(0.01, stock.price);
  const equityTotal = sharesOutstanding * bvps;
  const debtTotal = equityTotal * dE;
  const netDebt = debtTotal * 0.85;
  const borrowingRatePreTax = BORROWING_PRE_TAX[stock.market] ?? 0.06;
  const costDebtAfterTax = borrowingRatePreTax * (1 - (TAX_RATE[stock.market] ?? 0.2)) * 100;
  const weightEquity = (equityTotal + debtTotal) > 0 ? equityTotal / (equityTotal + debtTotal) : 0.85;
  return {
    health, roe, roa, npm, gpm: npm * 1.8, dE, dividendYield, payout,
    peRatio, pbv, eps, ttmEps: eps, bvps, dps,
    sharesOutstanding, mktCap, netDebt,
    fcfeMedian: sharesOutstanding * eps, fcfePerShare: eps,
    weightEquity, costDebtAfterTax, borrowingRatePreTax, coverage: null,
    totalDebt: debtTotal,
  };
}

/* ---------------- real metrics ---------------- */

function median3(vals: number[]): number | null {
  if (!vals.length) return null;
  const s = [...vals].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function buildRealMetrics(stock: StockItem, real: RealFinancialData): BaseMetrics {
  const M = real.metrics as Record<string, number | undefined>;
  const S = real.series as Record<string, (number | null)[]>;
  const health = levelOf(getCanonicalRating(stock.financialHealth));

  const roe = M.roe ?? ROE_MAP[health];
  const roa = M.roa ?? roe * 0.75;
  const npm = M.npm ?? NPM_MAP[health];
  const gpm = M.gpm ?? npm * 1.8;
  const dE = M.liabDeQ ?? M.de ?? DE_MAP[health];
  const dividendYield = M.dividendYield ?? 0;

  // D0: TTM ปันผลล่าสุด (dy ไตรมาสล่าสุด × ราคา) หรือ dps ที่มี
  const dps = real.dpsTTM ?? M.dps ?? ((dividendYield > 0 && stock.price) ? dividendYield * stock.price / 100 : 0);
  // yield และ payout แบบ TTM (ตรงแนวอ้างอิง: dy ล่าสุด, D0/TTM-EPS)
  const yieldTTM = (dps > 0 && stock.price > 0) ? dps / stock.price * 100 : dividendYield;

  const mktCap = M.mktCap ?? stock.marketCap ?? 1e9;

  let shares = M.shares ?? M.sharesQ ?? null;
  if (!shares || shares <= 0) shares = M.ttmNetProfit && M.ttmEps && M.ttmEps > 0 ? M.ttmNetProfit / M.ttmEps : null;
  if (!shares || shares <= 0) shares = M.mktCap && stock.price ? M.mktCap / stock.price : null;
  if (!shares || shares <= 0) shares = mktCap / Math.max(0.01, stock.price);
  const sharesOutstanding = shares;

  // P/E แบบ TTM (ราคา / TTM EPS) — อ้างอิงแสดง TTM P/E
  const ttmEps = M.ttmEps ?? M.eps ?? null;
  const peRatio = (ttmEps && ttmEps > 0 && stock.price > 0)
    ? stock.price / ttmEps
    : (M.peRatio ?? (stock.peRatio && stock.peRatio > 0 ? stock.peRatio : 10));
  const eps = ttmEps ?? (stock.price / Math.max(0.1, peRatio));

  // P/BV ไตรมาสล่าสุด = ราคา×จำนวนหุ้น ÷ equityQ (ตรงแนวอ้างอิง "now (latest quarter)")
  const equityQ = M.equityQ ?? null;
  const pbv = (equityQ && equityQ > 0 && stock.price > 0)
    ? (stock.price * sharesOutstanding) / equityQ
    : (M.pbv ?? (peRatio * roe) / 100);
  const bvps = M.bvpsQ ?? M.bvps ?? (eps / Math.max(0.01, roe / 100));

  // net debt บัญชีล่าสุด (ไตรมาสก่อน, ถ้ามี) — สูตรอ้างอิงใช้งบล่าสุด
  const netDebt = (real.netDebtQ ?? real.netDebt ?? (M.debtQ ?? M.totalDebt ?? 0) - (M.cashQ ?? M.cash ?? 0));
  const totalDebt = M.debtQ ?? M.totalDebt ?? 0;

  // FCFE: SET = median OCF 3 ปีล่าสุด, US = FreeCashFlow
  let fcfeMedian = real.fcfe ?? null;
  if (fcfeMedian == null) {
    const ocf = (S.opCashflow ?? []).filter((v): v is number => v != null);
    fcfeMedian = median3(ocf.slice(-3));
  }
  if (fcfeMedian == null) fcfeMedian = M.opCashflow ?? (sharesOutstanding * (ttmEps ?? 0));

  const borrowingRatePreTax = BORROWING_PRE_TAX[stock.market] ?? 0.06;
  const costDebtAfterTax = borrowingRatePreTax * (1 - (TAX_RATE[stock.market] ?? 0.2)) * 100;

  const weightEquity = (mktCap + Math.max(0, totalDebt)) > 0
    ? mktCap / (mktCap + Math.max(0, totalDebt))
    : 0.9;

  const coverage = M.coverage ?? null;

  return {
    health, roe, roa, npm, gpm, dE, dividendYield: yieldTTM,
    payout: (dps && ttmEps != null && ttmEps > 0 ? (dps / ttmEps) * 100 : M.payout) as unknown as number,
    peRatio, pbv, eps, ttmEps: ttmEps ?? 0, bvps, dps,
    sharesOutstanding, mktCap, netDebt,
    fcfeMedian, fcfePerShare: fcfeMedian / sharesOutstanding,
    weightEquity, costDebtAfterTax, borrowingRatePreTax, coverage, totalDebt,
  };
}

/* ---------------- quality scorecard (18 กฎ) — คิดจากงบจริงรายปี ---------------- */

function countTrue(arr: (number | null)[], back: number, test: (v: number) => boolean): { n: number; total: number } {
  const last = (arr.filter((v) => v != null) as number[]).slice(-back);
  return { n: last.filter(test).length, total: last.length };
}

function yoyDelta(arr: (number | null)[]): number | null {
  const nums = (arr.filter((v) => v != null) as number[]).slice(-2);
  if (nums.length < 2 || !nums[0]) return null;
  return ((nums[1] - nums[0]) / Math.abs(nums[0])) * 100;
}

function buildScorecard(stock: StockItem, real: RealFinancialData, m: BaseMetrics): ScorecardRow[] {
  const S = (real.series ?? {}) as Record<string, (number | null)[]>;
  const health = levelOf(getCanonicalRating(stock.financialHealth));

  const P = (v: string, delta?: number, th?: string, en?: string): ScorecardRow => ({ labelTh: th ?? '', labelEn: en ?? '', value: v, state: 'PASS', delta });
  const F = (v: string, delta?: number, th?: string, en?: string): ScorecardRow => ({ labelTh: th ?? '', labelEn: en ?? '', value: v, state: 'FAIL', delta });
  const W = (v: string, delta?: number, th?: string, en?: string): ScorecardRow => ({ labelTh: th ?? '', labelEn: en ?? '', value: v, state: 'WARN', delta });
  const NA = (v: string, th?: string, en?: string): ScorecardRow => ({ labelTh: th ?? '', labelEn: en ?? '', value: v, state: 'NA' });

  const roeYoY = yoyDelta(S.roe ?? []);

  // 1. ROE สูงกว่า 15%
  const r1 = m.roe;
  const rule1 = {
    th: 'ROE สูงกว่า 15%', en: 'ROE above 15%',
  };
  const rule2 = { th: 'ROE เกิน 15% ต่อปี', en: 'ROE above 15% year after year' };
  const roe4 = countTrue(S.roe ?? [], 4, (v) => v >= 15);
  const roeStreak = roe4.total >= 4 ? roe4.n : null;

  const rule3 = { th: 'ผลตอบแทนต่อสินทรัพย์ 7%', en: 'Return on assets at 7%' };
  const rule4 = { th: 'Net margin สูงกว่า 10%', en: 'Net margin above 10%' };
  const npms = (S.npm ?? []).filter((v): v is number => v != null);
  const marginTrend = npms.length >= 2 ? npms[npms.length - 1] : null;
  const marginPrev = npms.length >= 2 ? npms[npms.length - 2] : null;
  const marginDelta = marginPrev ? ((marginTrend! - marginPrev) / Math.abs(marginPrev)) * 100 : null;

  const rule5 = { th: 'มาร์จิ้นนิ่งหรือพุ่งขึ้น', en: 'Margin holding or widening' };
  const prof5 = countTrue(S.netProfit ?? [], 5, (v) => v > 0);
  const rule6 = { th: 'มีกำไรทุกปี 5 ปี', en: 'Profitability every year for 5 years' };

  const epss = (S.eps ?? []).filter((v): v is number => v != null);
  let epsCagr: number | null = null;
  if (epss.length >= 3) {
    const a = epss[epss.length - 3], b = epss[epss.length - 1];
    if (a > 0 && b > 0) epsCagr = (Math.pow(b / a, 1 / 2) - 1) * 100;
  } else if (epss.length >= 2 && epss[epss.length - 2] > 0) {
    epsCagr = ((epss[epss.length - 1] - epss[epss.length - 2]) / epss[epss.length - 2]) * 100;
  }
  const rule7 = { th: 'EPS เติบโตเฉลี่ย 10% ต่อปี', en: 'EPS growing 10% a year' };

  const revs = (S.revenue ?? []).filter((v): v is number => v != null);
  let revCagr: number | null = null;
  if (revs.length >= 3) {
    const a = revs[revs.length - 3], b = revs[revs.length - 1];
    if (a > 0 && b > 0) revCagr = (Math.pow(b / a, 1 / 2) - 1) * 100;
  }
  const rule8 = { th: 'รายได้เติบโตเฉลี่ย 5% ต่อปี', en: 'Revenue growing 5% a year' };

  const profAll = (S.netProfit ?? []).filter((v): v is number => v != null);
  const profOf10 = countTrue(S.netProfit ?? [], 10, (v) => v > 0);
  const rule9 = { th: 'กำไร 8 ใน 10 ปีล่าสุด', en: 'Profitable in 8 of the last 10 years' };

  const rule10 = { th: 'หนี้สินรวม/ส่วนผู้ถือหุ้น ต่ำกว่า 1.0', en: 'Total debt to equity below 1.0' };

  const covSeries = (S.coverage ?? [m.coverage]).filter((v): v is number => v != null);
  const covLast = covSeries.length ? covSeries[covSeries.length - 1] : m.coverage;
  const rule11 = { th: 'ดอกเบี้ยจ่ายถูกปกคลุม 5 เท่า', en: 'Interest covered 5x' };

  const ocf3 = countTrue(S.opCashflow ?? [], 3, (v) => v > 0);
  const rule12 = { th: 'กระแสเงินสดจากการดำเนินงานเป็นบวก', en: 'Operating cash flow positive' };

  // cash beats profit: OCF ≥ NP ใน 3 ปีล่าสุด
  const ocf = S.opCashflow ?? [], nps = S.netProfit ?? [];
  const n3 = Math.min(3, Math.min(ocf.filter((v) => v != null).length, nps.filter((v) => v != null).length));
  let cashBeats: { n: number; total: number } | null = null;
  if (n3 >= 2) {
    const oc = (ocf.filter((v): v is number => v != null)).slice(-n3);
    const np = (nps.filter((v): v is number => v != null)).slice(-n3);
    cashBeats = { n: oc.filter((v, i) => v >= np[i]).length, total: n3 };
  }
  const rule13 = { th: 'เงินสดบัญชีสูงกว่ากำไรตามงบ', en: 'Cash beats reported profit' };

  // FCF positive: US ใช้ FCF จริงแยกปี (เสนอผ่าน ocf เพราะ SET ไม่มี capex)
  const ocf5 = countTrue(S.opCashflow ?? [], 5, (v) => v > 0);
  const rule14 = { th: 'Free cash flow เป็นบวก', en: 'Free cash flow positive' };

  const rule15 = { th: 'ผลตอบแทนปันผล 5% ขึ้นไป', en: 'Yield at 5% or more' };
  const payoutV = m.payout;
  const rule16 = { th: 'ปันผล 40-70% ต่อกำไร', en: 'Payout between 40% and 70%' };
  const rule17 = { th: 'ปันผลไม่เกิน 80%', en: 'Payout at 80% or less' };

  const dps5 = countTrue(S.dps ?? [], 5, (v) => v > 0);
  const rule18 = { th: 'ปันผลทุกปี 5 ปีล่าสุด', en: 'Dividend every year for 5 years' };

  const dEVal = m.dE;
  const yieldV = m.dividendYield;

  const one = (cond: boolean | null, warnIf: ((x: number) => boolean) | null, val: string,
               delta: number | null | undefined, rule: { th: string; en: string },
               failVal?: string): ScorecardRow => {
    if (cond === null) return NA(failVal ?? val, rule.th, rule.en);
    if (cond) return P(val, delta ?? undefined, rule.th, rule.en);
    if (warnIf && warnIf(0)) return W(val, delta ?? undefined, rule.th, rule.en);
    return F(failVal ?? val, delta ?? undefined, rule.th, rule.en);
  };

  const pct = (x: number) => `${round(x, 1)}%`;
  const yoy = (d: number | null) => (d != null && Number.isFinite(d) ? d : undefined);

  return [
    // 1 ROE > 15%
    one(m.roe >= 15, m.roe >= 12 ? () => true : null, pct(r1), yoy(roeYoY), rule1),
    // 2 ROE 15% ไล่ปี
    roeStreak === null
      ? NA(`N/A`, rule2.th, rule2.en)
      : one(roe4.n >= roe4.total, null, `${roe4.n}/${roe4.total}`, undefined, rule2),
    // 3 ROA ≥ 7%
    m.roa == null ? NA('N/A', rule3.th, rule3.en)
      : one(m.roa >= 7, null, pct(m.roa), yoy(yoyDelta(S.roa ?? [])), rule3),
    // 4 NPM > 10%
    m.npm == null ? NA('N/A', rule4.th, rule4.en)
      : one(m.npm >= 10, m.npm >= 5 ? () => true : null, pct(m.npm), yoy(marginDelta), rule4),
    // 5 margin widening — NA ถ้างบไม่พอ (ต้อง ≥2 ปีที่มี npm)
    marginTrend == null || marginPrev == null
      ? NA('N/A', rule5.th, rule5.en)
      : one(marginTrend >= marginPrev * 0.95, () => true, pct(marginTrend), yoy(marginDelta), rule5),
    // 6 กำไรทุกปี 5 ปี (งบไม่ครบ 5 ปี → NA)
    prof5.total < 5 ? NA(`${prof5.n}/5`, rule6.th, rule6.en)
      : one(prof5.n === 5, prof5.n >= 4 ? () => true : null, `${prof5.n}/5`, undefined, rule6),
    // 7 EPS CAGR 10%
    epsCagr == null ? NA('N/A', rule7.th, rule7.en)
      : one(epsCagr >= 10, epsCagr >= 5 ? () => true : null, pct(epsCagr), undefined, rule7),
    // 8 Revenue CAGR 5%
    revCagr == null ? NA('N/A', rule8.th, rule8.en)
      : one(revCagr >= 5, revCagr >= 2 ? () => true : null, pct(revCagr), undefined, rule8),
    // 9 กำไร 8 ใน 10 ปี (ได้ข้อมูล <10 ปี → NA)
    profAll.length < 10 ? NA(`${profOf10.n}/${profAll.length}`, rule9.th, rule9.en)
      : one(profOf10.n >= 8, profOf10.n >= 6 ? () => true : null, `${profOf10.n}/10`, undefined, rule9),
    // 10 D/E ≤ 1.0
    dEVal == null ? NA('N/A', rule10.th, rule10.en)
      : one(dEVal < 1.0, dEVal < 1.5 ? () => true : null, `${round(dEVal, 2)}`, undefined, rule10),
    // 11 interest coverage — SET ไม่มีดอกเบี้ยใน thaifin → N/A
    covLast == null || covLast <= 0 ? NA(health ? 'N/A' : 'N/A', rule11.th, rule11.en)
      : one(covLast >= 5, covLast >= 3 ? () => true : null, `${round(covLast, 1)}×`, yoyDelta(S.coverage ?? []), rule11),
    // 12 OCF บวก (งบ <3 ปี → NA)
    ocf3.total < 3 ? NA(`${ocf3.n}/${ocf3.total}`, rule12.th, rule12.en)
      : one(ocf3.n === 3, null, `${ocf3.n}/${ocf3.total}`, undefined, rule12),
    // 13 cash beats profit
    cashBeats === null ? NA('N/A', rule13.th, rule13.en)
      : one(cashBeats.n >= cashBeats.total - 1, null, `${cashBeats.n}/${cashBeats.total}`, undefined, rule13),
    // 14 FCF บวก
    ocf5.total < 5 ? NA(`${ocf5.n}/${ocf5.total}`, rule14.th, rule14.en)
      : one(ocf5.n >= 4, null, `${ocf5.n}/${ocf5.total}`, undefined, rule14),
    // 15 yield ≥ 5%
    yieldV == null ? NA('N/A', rule15.th, rule15.en)
      : one(yieldV >= 5, yieldV >= 3 ? () => true : null, pct(yieldV), undefined, rule15),
    // 16 payout 40-70%
    payoutV == null || !Number.isFinite(payoutV) ? NA('N/A', rule16.th, rule16.en)
      : one(payoutV >= 40 && payoutV <= 70, null, pct(payoutV), undefined, rule16),
    // 17 payout ≤ 80%
    payoutV == null || !Number.isFinite(payoutV) ? NA('N/A', rule17.th, rule17.en)
      : one(payoutV <= 80, null, pct(payoutV), undefined, rule17),
    // 18 ปันผลทุกปี 5 ปี
    dps5.total < 5 ? NA(`${dps5.n}/5`, rule18.th, rule18.en)
      : one(dps5.n === 5, null, `${dps5.n}/5`, undefined, rule18),
  ];
}

/* ---------------- valuation sliders + descs ---------------- */

function sliderDefaults(stock: StockItem): SliderDefault[] {
  const isSet = stock.market === 'SET';
  return [
    {
      key: 'requiredReturn', value: 9.0,
      labelTh: 'ผลตอบแทนที่ต้องการ', labelEn: 'Return you require',
      descTh: isSet
        ? 'CAPM เริ่มต้นหุ้นขนาดใหญ่ในตลาด SET ราว 9% — ปรับขึ้นถ้าต้องการมาร์จิ้นความปลอดภัยมากขึ้น'
        : 'CAPM เริ่มต้นหุ้นใหญ่ตลาดสหรัฐราว 9.0% — ปรับขึ้นถ้าต้องการมาร์จิ้นความปลอดภัยมากขึ้น',
      descEn: isSet
        ? 'CAPM puts a SET large cap near 9%; raise it to demand more.'
        : 'CAPM puts a US large cap near 9%; raise it to demand more.',
    },
    {
      key: 'growthYears15', value: 5.0,
      labelTh: 'การเติบโต 5 ปีแรก', labelEn: 'Growth for first 5 years',
      descTh: 'เริ่มต้นที่ 5% — หลังจากนี้ถ้าเกิน ~8% คือการพยากรณ์ ไม่ใช่การให้มูลค่า',
      descEn: '5% by default; past about 8% is a forecast, not a valuation.',
    },
    {
      key: 'terminalGrowth', value: 3.0,
      labelTh: 'การเติบโตตลอดกาลหลังปีที่ 5', labelEn: 'Terminal growth after year 5',
      descTh: isSet
        ? 'เติบโตหลังปีที่ 5: ตัวยึดธรรมดาคือ GDP ระยะยาวของไทย'
        : 'Growth after year 5: US long-run GDP is the usual anchor.',
      descEn: isSet
        ? 'Long-run growth after year 5: Thai long-run GDP is the usual anchor.'
        : 'Long-run growth after year 5: US long-run GDP is the usual anchor.',
    },
    {
      key: 'aaaYield', value: isSet ? 2.06 : 4.0,
      labelTh: 'บอนด์ AAA อ้างอิง (Graham)', labelEn: 'AAA bond yield (Graham)',
      descTh: isSet
        ? 'อัตราผลตอบแทนบอนด์องค์กร AAA 5 ปี ThaiBMA: 2.06% ณ Q3/2026 (ประกาศ 2026-10-07) — ลองเลื่อนดูความไวค่า'
        : 'US AAA corporate yield proxy ~4% — move it to test the sensitivity.',
      descEn: isSet
        ? 'ThaiBMA AAA 5-year corporate bond yield: 2.06% at Q3/2026 (press release 2026-10-07). Move it to test the sensitivity.'
        : 'US AAA corporate yield proxy ~4%. Move it to test the sensitivity.',
    },
  ];
}

/* ---------------- historical band (σ-style เหมืองอ้างอิง) ---------------- */

/** Band source: dense weekly series when the real pipeline provides it
 *  (~4y of weekly points like the reference), else the annual/quarterly one. */
function realBandSeries(real: RealFinancialData | null, kind: 'pe' | 'pbv'): (number | null)[] | undefined {
  const w = real?.bandWeekly;
  const arr = kind === 'pe' ? w?.pe : w?.pbv;
  if (arr && arr.length >= 100) return arr;
  if (kind === 'pe') return real?.series?.peSeries;
  return real?.series?.pbvSeries;
}

function bandFromRealSeries(name: 'P/E' | 'P/BV', realSeries: (number | null)[] | undefined, current: number, nowLabel: 'TTM' | 'latest quarter'): ValuationBandChart {
  const vals = (realSeries ?? []).filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  if (vals.length < 3 || !(current > 0)) {
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : current;
    return {
      name, now: round(current, 2), nowLabel,
      vsMeanSigma: 0, mean: round(mean, 3), sigma: 0,
      sigmas: [], history: [], realHistory: false,
    };
  }
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  const sigma = Math.max(0.05, Math.sqrt(variance));
  const m3 = mean + 3 * sigma, m2 = mean + 2 * sigma, m1 = mean + sigma;
  const n1 = mean - sigma, n2 = mean - 2 * sigma;
  return {
    name,
    now: round(current, 2),
    nowLabel,
    vsMeanSigma: round((current - mean) / sigma, 2),
    mean: round(mean, 3),
    sigma: round(sigma, 3),
    sigmas: [
      { label: '+2σ', value: m2 > 0 ? round(m2, 2) : 0 },
      { label: '+1σ', value: m1 > 0 ? round(m1, 2) : 0 },
      { label: 'mean', value: mean > 0 ? round(mean, 2) : 0 },
      { label: '-1σ', value: n1 > 0 ? round(n1, 2) : 0 },
      { label: '-2σ', value: n2 > 0 ? round(n2, 2) : 0 },
    ],
    history: (realSeries ?? []).map((v, i) => ({ x: i, v: v == null ? mean : v })),
    realHistory: true,
  };
}

/* ---------------- peers percentile ---------------- */

function percentileAmong(values: (number | null)[], mine: number | null, higherIsBetter: boolean): number {
  if (mine === null || mine === undefined) return 0;
  const nums = values.filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
  if (nums.length < 2) return 50;
  const better = nums.filter((v) => (higherIsBetter ? v > mine : v < mine)).length;
  return round((better / (nums.length - 1)) * 100, 0);
}

export interface PeersBundle {
  peers: StockItem[];
  realBySymbol?: Record<string, RealFinancialData>;
}

export function buildPeers(stock: StockItem, m: BaseMetrics, bundle: PeersBundle): StockDetail['peers'] {
  const { peers, realBySymbol } = bundle;

  const metricOf = (s: StockItem, field: 'roe' | 'peRatio' | 'dividendYield' | 'dE'): number | null => {
    const real = lookupReal(realBySymbol, s.symbol);
    if (real?.metrics) {
      const map = { roe: 'roe', peRatio: 'peRatio', dividendYield: 'dividendYield', dE: 'liabDeQ' } as const;
      const v = real.metrics[map[field]];
      if (v != null && Number.isFinite(v)) return v;
    }
    if (real?._derivedFallback) return (real._derivedFallback as Record<string, number>)[field] ?? null;
    const dm = buildDerivedMetrics(s);
    return (dm as unknown as Record<string, number>)[field] ?? null;
  };

  const peerRoe = peers.map((s) => metricOf(s, 'roe'));
  const peerPe = peers.map((s) => metricOf(s, 'peRatio'));
  const peerYield = peers.map((s) => metricOf(s, 'dividendYield'));
  const peerDe = peers.map((s) => metricOf(s, 'dE'));

  const rows: PeersRow[] = [
    { measure: 'ROE', measureTh: 'ROE', value: `${round(m.roe, 1)}%`, higherIsBetter: true,
      marketPct: percentileAmong(peerRoe, m.roe, true),
      industryPct: percentileAmong(peerRoe, m.roe, true) },
    { measure: 'P/E', measureTh: 'P/E', value: `${round(m.peRatio, 1)}`, higherIsBetter: false,
      marketPct: percentileAmong(peerPe, m.peRatio, false),
      industryPct: percentileAmong(peerPe, m.peRatio, false) },
    { measure: 'Yield', measureTh: 'ผลตอบแทน', value: `${round(m.dividendYield, 1)}%`, higherIsBetter: true,
      marketPct: percentileAmong(peerYield, m.dividendYield, true),
      industryPct: percentileAmong(peerYield, m.dividendYield, true) },
    { measure: 'D/E', measureTh: 'D/E', value: `${round(m.dE, 2)}`, higherIsBetter: false,
      marketPct: percentileAmong(peerDe, m.dE, false),
      industryPct: percentileAmong(peerDe, m.dE, false) },
  ];

  return {
    industryLabel: stock.market === 'SET' ? 'SET SCREEN' : 'US SCREEN',
    marketNames: peers.length,
    industryNames: peers.length,
    rows,
  };
}

/* ---------------- charts & statements ---------------- */

function buildRealChartsAndStatements(real: RealFinancialData, stock: StockItem): { charts: AnnualChartSpec[]; statements: StatementRow[] } {
  const years = real.fiscalYears ?? [];
  const s = real.series as Record<string, (number | null)[]>;
  const pick = (k: string): (number | null)[] => s[k] ?? [];

  const scaleIfNeeded = (arr: (number | null)[]): (number | null)[] => {
    const maxAbs = Math.max(0, ...arr.filter((v): v is number => v != null).map((v) => Math.abs(v)));
    if (maxAbs > 5e6) return arr.map((v) => (v == null ? null : v / 1e6));
    return arr;
  };

  const toPoints = (arr: (number | null)[]): { x: number; y: number }[] =>
    years.map((fy, i) => ({ x: fy, y: (arr[i] == null ? 0 : (arr[i] as number)) }));

  // DPS chart: ปีจ่ายจริงที่ thuได้ + append TTM ปัจจุบัน (dy×ราคาล่าสุด)
  const dpsPts = toPoints(pick('dps'));
  const dpsTTM = real.dpsTTM;
  const dpsPoints = dpsTTM && dpsTTM > 0 ? [...dpsPts, { x: (years[years.length - 1] ?? new Date().getFullYear() - 1) + 1, y: round(dpsTTM, 2) }] : dpsPts;

  const deSeries = (real.series.liabDe?.some((v) => v != null) ? real.series.liabDe : real.series.dve) ?? [];

  const charts: AnnualChartSpec[] = [
    { key: 'net-profit', titleTh: 'กำไรสุทธิ', titleEn: 'Net profit', format: 'baht_m', series: toPoints(scaleIfNeeded(pick('netProfit'))), real: true },
    { key: 'revenue', titleTh: 'รายได้', titleEn: 'Revenue', format: 'baht_m', series: toPoints(scaleIfNeeded(pick('revenue'))), real: true },
    { key: 'eps', titleTh: 'กำไรต่อหุ้น', titleEn: 'EPS', format: 'baht', series: toPoints(pick('eps')), real: true },
    { key: 'gross-margin', titleTh: 'มาร์จิ้นขั้นต้น', titleEn: 'Gross margin', format: 'pct', series: toPoints(pick('gm')), real: true },
    { key: 'npm', titleTh: 'มาร์จิ้นสุทธิ', titleEn: 'Net margin', format: 'pct', series: toPoints(pick('npm')), real: true },
    { key: 'roe', titleTh: 'ROE (ผลตอบแทนต่อส่วนผู้ถือหุ้น)', titleEn: 'ROE', format: 'pct', series: toPoints(pick('roe')), real: true },
    { key: 'dps', titleTh: 'ปันผลต่อหุ้น', titleEn: 'DPS', format: 'baht', series: dpsPoints, real: true },
    { key: 'de', titleTh: 'หนี้สิน / ส่วนผู้ถือหุ้น', titleEn: 'Liabilities / equity', format: 'x', series: toPoints(deSeries), real: true },
  ];

  const statements: StatementRow[] = [];
  for (let i = Math.max(0, years.length - 5); i < years.length; i++) {
    const fy = years[i];
    statements.push({
      fy,
      roe: pick('roe')[i] ?? null,
      roa: pick('roa')[i] ?? null,
      npm: pick('npm')[i] ?? null,
      d_e: deSeries[i] ?? null,
      eps: pick('eps')[i] ?? null,
      bvps: pick('bvps')[i] ?? null,
      dps: pick('dps')[i] ?? null,
    });
  }
  return { charts, statements };
}

function buildDerivedChartsAndStatements(stock: StockItem, m: BaseMetrics): { charts: AnnualChartSpec[]; statements: StatementRow[] } {
  const years: number[] = [];
  const thisYear = new Date().getFullYear();
  for (let i = 9; i >= 0; i--) years.push(thisYear - i);

  const g = 0.06;
  const arrs = { netProfit: [], revenue: [], eps: [], gm: [], npm: [], roe: [], dps: [], dve: [], bvps: [], roa: [] } as Record<string, (number | null)[]>;
  for (let i = 0; i < 10; i++) {
    const back = 9 - i;
    const noise = 1 + jitter(stock.symbol, 200 + i) * 0.22;
    const growthBack = Math.pow(1 + g, -back);
    const eps_i = round(m.eps * growthBack * noise, 2);
    const npm_i = round(m.npm * (0.65 + 0.35 * (i / 9)) * (1 + jitter(stock.symbol, 400 + i) * 0.15), 2);
    arrs.eps.push(eps_i);
    arrs.gm.push(round(m.gpm * (0.7 + 0.3 * (i / 9)), 2));
    arrs.npm.push(npm_i);
    arrs.roe.push(round(m.roe * (0.6 + 0.4 * (i / 9)), 2));
    arrs.roa.push(round(m.roa * (0.6 + 0.4 * (i / 9)), 2));
    arrs.bvps.push(round(m.bvps * Math.pow(0.94, -back), 2));
    arrs.netProfit.push(round((eps_i * m.sharesOutstanding) / 1e6, 0));
    arrs.revenue.push(round(npm_i > 0.4 ? (eps_i * m.sharesOutstanding) / (npm_i / 100) / 1e6 : eps_i * m.sharesOutstanding / 1e6 * 20, 0));
    arrs.dps.push(round(eps_i * 0.35, 2));
    arrs.dve.push(round(m.dE * (0.55 + 0.45 * (i / 9)), 3));
  }

  const toPoints = (arr: (number | null)[]): { x: number; y: number }[] => years.map((fy, i) => ({ x: fy, y: (arr[i] ?? 0) as number }));
  const charts: AnnualChartSpec[] = [
    { key: 'net-profit', titleTh: 'กำไรสุทธิ', titleEn: 'Net profit', format: 'baht_m', series: toPoints(arrs.netProfit), real: false },
    { key: 'revenue', titleTh: 'รายได้', titleEn: 'Revenue', format: 'baht_m', series: toPoints(arrs.revenue), real: false },
    { key: 'eps', titleTh: 'กำไรต่อหุ้น', titleEn: 'EPS', format: 'baht', series: toPoints(arrs.eps), real: false },
    { key: 'gross-margin', titleTh: 'มาร์จิ้นขั้นต้น', titleEn: 'Gross margin', format: 'pct', series: toPoints(arrs.gm), real: false },
    { key: 'npm', titleTh: 'มาร์จิ้นสุทธิ', titleEn: 'Net margin', format: 'pct', series: toPoints(arrs.npm), real: false },
    { key: 'roe', titleTh: 'ROE (ผลตอบแทนต่อส่วนผู้ถือหุ้น)', titleEn: 'ROE', format: 'pct', series: toPoints(arrs.roe), real: false },
    { key: 'dps', titleTh: 'ปันผลต่อหุ้น', titleEn: 'DPS', format: 'baht', series: toPoints(arrs.dps), real: false },
    { key: 'de', titleTh: 'หนี้สิน / ส่วนผู้ถือหุ้น', titleEn: 'Liabilities / equity', format: 'x', series: toPoints(arrs.dve), real: false },
  ];

  const statements: StatementRow[] = [];
  for (let i = Math.max(0, years.length - 5); i < years.length; i++) {
    statements.push({
      fy: years[i],
      roe: arrs.roe[i], roa: arrs.roa[i], npm: arrs.npm[i],
      d_e: arrs.dve[i], eps: arrs.eps[i], bvps: arrs.bvps[i], dps: arrs.dps[i],
    });
  }
  return { charts, statements };
}

/* ---------------- main entry ---------------- */

export function deriveStockDetail(
  stock: StockItem,
  peers?: StockItem[],
  opts?: { real?: RealFinancialData | null; peersReal?: Record<string, RealFinancialData>; currencySymbol?: string },
): StockDetail {
  const real = opts?.real ?? null;
  const currencySymbol = stock.currencySymbol || '$';
  const useReal = !!(real && real.metrics && Object.keys(real.metrics).length > 0);

  const m = useReal && real
    ? buildRealMetrics(stock, real)
    : buildDerivedMetrics(stock);

  /* quality scorecard — score = passer × 7 */
  const rules = buildScorecard(stock, real ?? ({ _derivedFallback: m as unknown as Record<string, number> } as unknown as RealFinancialData), m);
  const passCount = rules.filter((r) => r.state === 'PASS').length;
  const naCount = rules.filter((r) => r.state === 'NA').length;
  const score = Math.round(passCount * 7);

  /* charts & statements */
  const built = useReal && real
    ? buildRealChartsAndStatements(real, stock)
    : buildDerivedChartsAndStatements(stock, m);

  /* bands — P/E เป็น TTM, P/BV เป็นไตรมาสล่าสุด (ตามอ้างอิง) */
  const bandPE = useReal && real
    ? bandFromRealSeries('P/E', realBandSeries(real, 'pe'), m.peRatio, 'TTM')
    : bandFromRealSeries('P/E', undefined, m.peRatio, 'TTM');
  const bandPBV = useReal && real
    ? bandFromRealSeries('P/BV', realBandSeries(real, 'pbv'), m.pbv, 'latest quarter')
    : bandFromRealSeries('P/BV', undefined, m.pbv, 'latest quarter');

  /* peers */
  const peersSection = useReal
    ? buildPeers(stock, m, { peers: peers && peers.length ? peers : [stock], realBySymbol: opts?.peersReal })
    : buildPeers(stock, m, { peers: peers && peers.length ? peers : [stock] });

  const priceAsOf = stock.lastUpdateTime ? stock.lastUpdateTime.slice(0, 10) : new Date().toISOString().slice(0, 10);

  const isSet = stock.market === 'SET';
  const coverageDisplay = m.coverage != null && m.coverage > 0 ? `${round(m.coverage, 1)}×` : 'N/A';

  // key สำหรับแปลใน component (ไม่ฝังข้อความภาษาหนึ่งเดียว)
  const dpsSourceKey = useReal ? (isSet ? 'thaifinDyQ' : 'yfTtm') : 'derived';

  return {
    symbol: stock.symbol,
    name: stock.name,
    price: stock.price,
    currencySymbol,
    currency: stock.currency,
    priceAsOf,
    score,
    fiscalYearsUsed: useReal && real ? (real.fiscalYears?.length ?? 0) : 0,
    quality: { passCount, totalCount: 18, naCount, rules },
    sliders: sliderDefaults(stock),
    valuationBase: {
      dividendLatest: round(m.dps, 4),
      cashReceived12m: round(m.dps, 4),
      costDebtAfterTax: round(m.costDebtAfterTax, 2),
      borrowingRatePreTax: round(m.borrowingRatePreTax * 100, 2),
      netDebt: round(m.netDebt, 0),
      fcfeMedian: round(m.fcfeMedian, 0),
      fcfePerShare: round(m.fcfePerShare, 4),
      sharesOutstanding: round(m.sharesOutstanding, 0),
      weightEquity: round(m.weightEquity, 3),
      ttmEps: round(m.ttmEps, 4),
      grahamNumber: round(Math.sqrt(Math.max(0, 22.5 * Math.max(0.05, m.eps) * Math.max(0.05, m.bvps))), 2),
      coverageDisplay,
    },
    bands: [bandPE, bandPBV],
    peers: peersSection,
    charts: built.charts,
    divPayments: real?.divPayments ?? [],
    divPaymentsReal: useReal && !!real?.divPayments?.length,
    statements: built.statements,
    meta: {
      dataSource: useReal ? 'real' : 'derived',
      realSource: useReal && real ? real.source : undefined,
      latestFY: useReal && real ? real.latestFY : null,
      dpsSource: dpsSourceKey,
      realArea: {
        scorecard: useReal,
        valuation: useReal,
        bands: !!(useReal && real?.series?.peSeries && (real.series.peSeries?.filter((v) => v != null).length ?? 0) >= 3),
        peers: useReal,
        charts: useReal,
        statements: useReal,
      },
    },
  };
}

/* ---------------- valuation math ตามสูตรอ้างอิง ---------------- */

/** DDM สองระยะ: intrinsic = Σ D(1+g1)^k/(1+r)^k + D(1+g1)⁵(1+g₂)/((r−g₂)(1+r)⁵) */
export function computeDDM(D0: number, r: number, g1: number, g2: number): number {
  if (r <= g2) return 0;
  const dr = r / 100, ga = g1 / 100, gb = g2 / 100;
  let v = 0;
  for (let k = 1; k <= 5; k++) v += (D0 * Math.pow(1 + ga, k)) / Math.pow(1 + dr, k);
  v += (D0 * Math.pow(1 + ga, 5) * (1 + gb)) / ((dr - gb) * Math.pow(1 + dr, 5));
  return v;
}

/** DCF-FE มัลติพาย (ต่อ 1 บาท FCFE): ส่วน PV 3 ปีแรกถึง 5 และ TV */
export function dcfMultipliers(wacc: number, g1: number, g2: number): { pvMult: number; termMult: number; totalMult: number } | null {
  const w = wacc / 100, ga = g1 / 100, gb = g2 / 100;
  if (w <= gb || w <= 0) return null;
  let pv = 0;
  for (let k = 1; k <= 5; k++) pv += Math.pow(1 + ga, k) / Math.pow(1 + w, k);
  const term = Math.pow(1 + ga, 5) * (1 + gb) / ((w - gb) * Math.pow(1 + w, 5));
  return { pvMult: pv, termMult: term, totalMult: pv + term };
}

/** DCF per share: (FCFE×mult − netDebt) ÷ shares, terminal share = termMult/totalMult */
export function computeDCFValue(
  fcfeMedian: number, wacc: number, g1: number, g2: number, netDebt: number, shares: number,
): { perShare: number; terminalShare: number; equityValue: number } | null {
  if (!shares || shares <= 0 || !fcfeMedian || !Number.isFinite(fcfeMedian)) return null;
  const mult = dcfMultipliers(wacc, g1, g2);
  if (!mult) return null;
  const equityValue = fcfeMedian * mult.totalMult - netDebt;
  return {
    perShare: equityValue / shares,
    terminalShare: round((mult.termMult / mult.totalMult) * 100, 0),
    equityValue,
  };
}

/** ราคาหุ้นบอก terminal growth แค่ไหน: solve g₂ ที่ DCF value = price (bisection) */
export function solvePriceImpliedG2(
  fcfeMedian: number, wacc: number, g1: number, netDebt: number, shares: number, price: number,
): number | null {
  if (!price || price <= 0 || !fcfeMedian || !shares) return null;
  const f = (g2: number): number | null => {
    const v = computeDCFValue(fcfeMedian, wacc, g1, g2, netDebt, shares);
    return v ? v.perShare - price : null;
  };
  let lo = -30, hi = Math.min(wacc, 30) - 0.01;
  let fLo = f(lo), fHi = f(hi);
  if (fLo == null || fHi == null || fLo * fHi > 0) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (fm == null) return null;
    if (Math.abs(fm) < 1e-9 || hi - lo < 1e-8) return mid;
    if ((fLo as number) * fm < 0) {
      hi = mid; fHi = fm;
    } else {
      lo = mid; fLo = fm;
    }
  }
  return (lo + hi) / 2;
}

/** alias ให้ชื่อบรรยายนิ่งกว่า */
export const resolvePriceImpliedG2 = solvePriceImpliedG2;

/** Graham growth value: EPS×(8.5+2g)×4.4÷AAA-yield (ต่างจากของเดิม: คูณ 4.4/ยีลด์) */
export function computeGrahamGrowthWithYield(EPS: number, growthPct: number, aaaYield: number): number {
  if (!aaaYield || aaaYield <= 0) return 0;
  return round(EPS * (8.5 + 2 * growthPct) * 4.4 / aaaYield, 2);
}

/** Graham growth V = EPS×(8.5+2g) — เก็บไว้เพื่อ compat */
export function computeGrahamGrowth(EPS: number, growthPct: number): number {
  return round(EPS * (8.5 + 2 * growthPct), 2);
}

/** WACC ตาม r ที่ผู้ใช้เลือก: r×We + costDebt×(1−We) */
export function waccFor(requiredReturn: number, weightEquity: number, costDebtAfterTax: number): number {
  return round(requiredReturn * weightEquity + costDebtAfterTax * (1 - weightEquity), 2);
}

/** margin of safety % = (value − price)/value */
export function marginOfSafety(value: number, price: number): number {
  if (!value || !Number.isFinite(value)) return 0;
  return round(((value - price) / value) * 100, 1);
}

/** มัลติพายแบบเก่า (compat) */
export function computeDCFPerShare(fcfePerShare: number, wacc: number, g1: number, g2: number, netDebtPerShare: number): number {
  if (wacc <= g2) return 0;
  const w = wacc / 100, ga = g1 / 100, gb = g2 / 100;
  let eq = 0;
  for (let k = 1; k <= 5; k++) eq += (fcfePerShare * Math.pow(1 + ga, k)) / Math.pow(1 + w, k);
  eq += (fcfePerShare * Math.pow(1 + ga, 5) * (1 + gb)) / ((w - gb) * Math.pow(1 + w, 5));
  eq = eq - netDebtPerShare;
  return Math.max(0, eq);
}
