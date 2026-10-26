'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { StockItem } from '@/types/stock';
import {
  deriveStockDetail,
  computeDDM,
  computeDCFValue,
  computeGrahamGrowthWithYield,
  marginOfSafety,
  resolvePriceImpliedG2,
  waccFor,
  StockDetail,
  RealFinancialData,
  DivPayment,
  round,
} from '@/lib/stock-detail';
import {
  Check,
  X as XIcon,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  ListFilter,
  Table2,
  Minus,
} from 'lucide-react';

interface StockDetailDialogProps {
  stock: StockItem | null;
  peers: StockItem[];
  open: boolean;
  onClose: () => void;
}

/* ---------- small chart helpers (inline SVG / CSS bars) ---------- */

function SparkLine({ data, color = '#4F79D6' }: { data: { x?: number; i?: number; v: number }[]; color?: string }) {
  const w = 220, h = 72;
  if (!data.length) return null;
  const vals = data.map((d) => d.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pts = data.map((d, idx) => {
    const x = (idx / Math.max(1, data.length - 1)) * (w - 8) + 4;
    const y = h - 6 - ((d.v - min) / range) * (h - 18);
    return [x, y];
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[72px]" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function SigmaBandChart({ data, sigmas, color = '#4F79D6' }: { data: { x?: number; i?: number; v: number }[]; sigmas: { label: string; value: number }[]; color?: string }) {
  const w = 220, h = 72;
  if (!data.length) return null;
  // Only levels that actually exist (multiples can't be negative)
  const levels = sigmas.filter((s) => s.value > 0 && Number.isFinite(s.value));
  const vals = [...data.map((d) => d.v), ...levels.map((s) => s.value)];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const yOf = (v: number) => h - 6 - ((v - min) / range) * (h - 18);
  const pts = data.map((d, idx) => {
    const x = (idx / Math.max(1, data.length - 1)) * (w - 8) + 4;
    return [x, yOf(d.v)];
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const levelColor = (label: string) =>
    label === 'mean' ? '#9AA4B2' : label.startsWith('+') ? '#F0447A' : '#12B76A';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[72px]" preserveAspectRatio="none">
      {levels.map((s) => {
        const y = yOf(s.value);
        const c = levelColor(s.label);
        const isMean = s.label === 'mean';
        return (
          <g key={s.label}>
            <line
              x1={2} x2={w - 2} y1={y} y2={y}
              stroke={c}
              strokeWidth="1"
              strokeDasharray={isMean ? undefined : '5 4'}
              opacity={0.75}
            />
            <text
              x={w - 3} y={Math.max(6.5, y - 1.8)}
              textAnchor="end" fontSize="6.5" fontWeight="600" fill={c}
            >
              {s.label}
            </text>
          </g>
        );
      })}
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MiniBars({ series, color = '#22C1A4', dashedLinePct }: { series: { x: number; y: number }[]; color?: string; dashedLinePct?: number | null }) {
  if (!series.length) return null;
  const max = Math.max(...series.map((s) => s.y), 0.00001);
  const min = Math.min(...series.map((s) => s.y), 0);
  const zeros = max === 0;
  const absMax = Math.max(Math.abs(max), Math.abs(min)) || 1;
  const lineH = dashedLinePct != null && max > 0 && dashedLinePct < max
    ? Math.max(2, (dashedLinePct / absMax) * 68)
    : null;
  return (
    <div className="relative flex items-end gap-[3px] w-full h-[78px]">
      {series.map((s, idx) => {
        const h = Math.max(2, (Math.abs(s.y) / absMax) * 68);
        const isNeg = s.y < 0;
        return (
          <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full" title={`${s.x}: ${s.y}`}>
            <div
              className="w-full rounded-t-[2px] transition-all"
              style={{ height: `${h}px`, background: isNeg ? '#D92D20' : zeros ? '#DDD' : color, opacity: 0.85 }}
            />
          </div>
        );
      })}
      {lineH != null && (
        <div
          className="absolute left-0 right-0 border-t border-dashed border-[#5B616E] dark:border-[#9CA3AF] pointer-events-none"
          style={{ bottom: `${lineH}px`, opacity: 0.75 }}
        />
      )}
    </div>
  );
}

/* DPS "by year, quarters stacked" — แท่งรายปี ซ้อนเป็นไตรมาส (วางเหมือนงานอ้างอิง:
   Q1 ส้ม / Q2 น้ำเงิน / Q3 เขียว / Q4 ม่วง, label รวมต่อปี, ปีล่าสุดยกเลิกจองบางส่วน) */
function DivPaymentsBars({ payments, currencySymbol }: { payments: DivPayment[]; currencySymbol: string }) {
  const list = payments.filter((p) => p.amount > 0 && Number(p.date.slice(0, 4)) >= new Date().getFullYear() - 10);
  if (!list.length) return null;

  // group: year -> { q1..q4 sums }
  const byYear: Record<string, [number, number, number, number]> = {};
  for (const p of list) {
    const y = p.date.slice(0, 4);
    const m = Number(p.date.slice(5, 7));
    const q = m <= 3 ? 0 : m <= 6 ? 1 : m <= 9 ? 2 : 3;
    if (!byYear[y]) byYear[y] = [0, 0, 0, 0];
    byYear[y][q] += p.amount;
  }
  const years = Object.keys(byYear).sort();
  const Q_COLORS = ['#F0A704', '#2E6BE6', '#22C1A4', '#7A5CF0'];
  const maxYear = Math.max(...years.map((y) => (byYear[y] as unknown as number[]).reduce((a, b) => a + b, 0))) || 1;

  return (
    <div>
      <div className="flex items-end gap-[3px] w-full h-[104px]" style={{ borderBottom: '1px solid rgba(128,136,150,0.35)' }}>
        {years.map((y) => {
          const qs = byYear[y];
          const total = qs[0] + qs[1] + qs[2] + qs[3];
          return (
            <div key={y} className="flex-1 flex flex-col justify-end items-center min-w-[3px]">
              <span className="text-[7px] md:text-[8px] leading-tight text-[#5B616E] dark:text-[#9CA3AF] tabular-nums mb-0.5">
                {total ? total.toFixed(2) : ''}
              </span>
              <div className="w-full flex flex-col justify-end" style={{ minHeight: 0 }}>
                {[3, 2, 1, 0].map((qi) => qs[qi] > 0 ? (
                  <div
                    key={qi}
                    title={`${y} Q${qi + 1}: ${currencySymbol}${qs[qi].toFixed(4)}`}
                    style={{ height: `${Math.max(2, (qs[qi] / maxYear) * 88)}px`, background: Q_COLORS[qi], opacity: 0.88 }}
                  />
                ) : null)}
              </div>
              <span className={`text-[7.5px] md:text-[8.5px] leading-tight mt-0.5 tabular-nums ${y === years[years.length - 1] ? 'text-[#1256A0] dark:text-[#60A5FA] font-bold' : 'text-[#5B616E] dark:text-[#9CA3AF]'}`}>
                {y}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
        {[1, 2, 3, 4].map((qn) => (
          <span key={qn} className="inline-flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-[2px]" style={{ background: Q_COLORS[qn - 1], opacity: 0.88 }} />
            <span className="text-[8px] md:text-[9px] text-[#5B616E] dark:text-[#9CA3AF]">Q{qn}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- scorecard icon ---------- */

function RuleIcon({ state }: { state: 'PASS' | 'FAIL' | 'WARN' | 'NA' }) {
  if (state === 'PASS') {
    return <span className="inline-flex w-3.5 h-3.5 rounded-full bg-[#007C32] items-center justify-center shrink-0">
      <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />
    </span>;
  }
  if (state === 'WARN') {
    return <span className="inline-flex w-3.5 h-3.5 shrink-0 items-center justify-center">
      <AlertTriangle className="w-3 h-3 text-[#F07504]" fill="#F07504" stroke="none" />
    </span>;
  }
  if (state === 'NA') {
    return <span className="inline-flex w-3.5 h-3.5 rounded-sm bg-[#E7E9ED] dark:bg-[#333B4E] items-center justify-center shrink-0" title="N/A — insufficient fiscal history">
      <Minus className="w-2.5 h-2.5 text-[#5B616E] dark:text-[#9CA3AF]" strokeWidth={3} />
    </span>;
  }
  return <span className="inline-flex w-3.5 h-3.5 rounded-[3px] bg-[#D92D20] items-center justify-center shrink-0">
    <XIcon className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />
  </span>;
}

/* ---------- section header ---------- */

function SectionHeading({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-[11px] md:text-xs font-extrabold uppercase tracking-wider text-[#181C21] dark:text-[#F3F4F6] mb-2.5">
      {children}
    </h2>
  );
}

/* ---------- real/derived data pill ---------- */

function RealPill({ real, source, fy, th, loading }: { real: boolean; source?: string; fy?: number | null; th: boolean; loading?: boolean }) {
  if (loading) {
    return <span className="text-[9px] font-semibold text-[#A0A5AF] dark:text-[#6B7280]">{th ? 'กำลังโหลดข้อมูลจริง…' : 'loading real data…'}</span>;
  }
  if (real) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#EBF6EE] text-[#007C32] dark:bg-[#132A1E] dark:text-[#00C076] whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-[#007C32] dark:bg-[#00C076]" />
        {th ? 'ข้อมูลจริง' : 'real data'}
        {source ? ` · ${source}` : ''}
        {fy ? ` FY${fy}` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFF4E5] text-[#B25E09] dark:bg-[#2E2415] dark:text-[#F5B04C] whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-[#F07504]" />
      {th ? 'โมเดลประมาณการ' : 'derived model'}
    </span>
  );
}

/* ---------- Slider row ---------- */

function SliderRow({
  label, desc, value, min, max, step, onChange, unit = ''
}: {
  label: string;
  desc?: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] font-semibold text-[#232526] dark:text-[#E5E7EB]">{label}</span>
        <span className="text-[11px] font-bold text-[#232526] dark:text-[#E5E7EB] tabular-nums">
          {value.toFixed(2)}{unit}
        </span>
      </div>
      {desc && <div className="text-[10px] text-[#5B616E] dark:text-[#9CA3AF] leading-snug mb-1.5">{desc}</div>}
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#4F79D6] h-1.5 rounded appearance-none bg-[#E4EAF1] dark:bg-[#2E3646] cursor-pointer focus:outline-none"
      />
    </div>
  );
}

/* ---------- Major-side result card row ---------- */

function ResultRow({
  label, sub, value, marker, sub2, value2, marker2, currency,
}: {
  label: string;
  sub?: string;
  value: string;
  marker?: number;
  sub2?: string;
  value2?: string;
  marker2?: number;
  currency?: string;
}) {
  return (
    <div className="py-2 border-t border-[#F0F2F5] dark:border-[#222735] first:border-t-0">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-[#181C21] dark:text-[#F3F4F6] leading-tight">{label}</div>
          {sub && <div className="text-[10px] text-[#5B616E] dark:text-[#9CA3AF] leading-tight mt-0.5">{sub}</div>}
        </div>
        <div className="text-right shrink-0">
          <span className="text-sm font-extrabold text-[#181C21] dark:text-white tabular-nums whitespace-nowrap">{value}</span>
          {currency && <span className="text-[10px] font-semibold text-[#5B616E] dark:text-[#9CA3AF] ml-0.5">{currency}</span>}
          {marker != null && (
            <span className={`text-[11px] font-bold tabular-nums ml-1.5 ${marker >= 0 ? 'text-[#007C32] dark:text-[#00C076]' : 'text-[#D92D20] dark:text-[#F87171]'}`}>
              {marker}%
            </span>
          )}
        </div>
      </div>
      {sub2 && value2 && (
        <div className="flex items-baseline justify-between gap-2 mt-1.5 pl-0.5">
          <span className="text-[10px] text-[#5B616E] dark:text-[#9CA3AF]">{sub2}</span>
          <span className="text-[11px] font-bold tabular-nums text-[#232526] dark:text-[#E5E7EB]">
            {value2}
          </span>
          {marker2 != null && (
            <span className={`text-[10px] font-bold tabular-nums ${marker2 >= 0 ? 'text-[#007C32] dark:text-[#00C076]' : 'text-[#D92D20] dark:text-[#F87171]'}`}>
              {marker2}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Main Dialog ---------- */

export default function StockDetailDialog({ stock, peers, open, onClose }: StockDetailDialogProps) {
  const { t, lang } = useApp();
  const [r, setR] = useState(9.0);
  const [g1, setG1] = useState(5.0);
  const [g2, setG2] = useState(3.0);
  const [aaaYield, setAaaYield] = useState(2.06);
  const [addedToBoard, setAddedToBoard] = useState(false);
  const [realData, setRealData] = useState<RealFinancialData | null>(null);
  const [peersReal, setPeersReal] = useState<Record<string, RealFinancialData> | null>(null);
  const [realLoading, setRealLoading] = useState(false);

  /* store slider defaults per stock so Reset works */
  const [defaults, setDefaults] = useState({ r: 9.0, g1: 5.0, g2: 3.0, aaa: 2.06 });

  /* reset controls เมื่อเปลี่ยนหุ้น */
  useEffect(() => {
    if (open && stock) {
      const d = deriveStockDetail(stock, peers);
      const dv = {
        r: d.sliders[0].value,
        g1: d.sliders[1].value,
        g2: d.sliders[2].value,
        aaa: d.sliders[3].value,
      };
      setDefaults(dv);
      setR(dv.r);
      setG1(dv.g1);
      setG2(dv.g2);
      setAaaYield(dv.aaa);
      setAddedToBoard(false);
    }
  }, [open, stock?.symbol, peers]);

  /* โหลดข้อมูลจริงของทั้งตลาดครั้งเดียวเมื่อเปิด dialog (thaifin / yfinance) */
  useEffect(() => {
    if (!open || !stock) return;
    let cancelled = false;
    const market = stock.market === 'US' ? 'US' : 'SET';
    setRealData(null);
    setPeersReal(null);
    setRealLoading(true);
    fetch(`/api/stock-details?market=${market}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const items = data?.items && typeof data.items === 'object' ? data.items as Record<string, RealFinancialData> : null;
        setPeersReal(items);
        const mine: RealFinancialData | null = items ? items[stock.symbol] ?? null : null;
        setRealData(mine && mine.metrics && Object.keys(mine.metrics).length > 0 ? mine : null);
      })
      .catch(() => {
        if (!cancelled) {
          setRealData(null);
          setPeersReal(null);
        }
      })
      .finally(() => {
        if (!cancelled) setRealLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, stock?.symbol]);

  /* ESC key close */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const detail: StockDetail | null = useMemo(() => {
    if (!stock || !open) return null;
    return deriveStockDetail(stock, peers, {
      real: realData,
      peersReal: peersReal ?? undefined,
      currencySymbol: stock.currencySymbol,
    });
  }, [stock, peers, open, realData, peersReal]);

  /* คำนวณ live จาก slider — WACC ผูกกับ r, DCF ผูกกับ g1/g2 */
  const val = useMemo(() => {
    if (!detail || !stock) return null;
    const base = detail.valuationBase;
    const D0 = base.dividendLatest;
    const wacc = waccFor(r, base.weightEquity, base.costDebtAfterTax);
    const ddmValue = computeDDM(D0, r, g1, g2);
    const dcf = computeDCFValue(base.fcfeMedian, wacc, g1, g2, base.netDebt, base.sharesOutstanding);
    const impliedG2 = resolvePriceImpliedG2(base.fcfeMedian, wacc, g1, base.netDebt, base.sharesOutstanding, stock.price);
    const grahamGrowth = computeGrahamGrowthWithYield(base.ttmEps, g1, aaaYield);
    return {
      wacc,
      ddmValue: round(ddmValue, 2),
      ddmMargin: marginOfSafety(ddmValue, stock.price),
      dcfPerShare: dcf ? round(dcf.perShare, 2) : null,
      dcfMargin: dcf ? marginOfSafety(dcf.perShare, stock.price) : null,
      terminalShare: dcf ? dcf.terminalShare : null,
      impliedG2: impliedG2 != null ? round(impliedG2, 2) : null,
      grahamGrowth,
      grahamGrowthMargin: marginOfSafety(grahamGrowth, stock.price),
    };
  }, [detail, stock, r, g1, g2, aaaYield]);

  if (!stock || !open || !detail || !val) return null;

  const th = lang === 'th';
  const sym = detail.currencySymbol;
  const cur = detail.currency;
  const fmtBathM = (n: number) => (Math.abs(n) >= 1000 ? `${round(n / 1000, 1)} ${cur}bn` : `${round(n, 1)} ${cur}m`);
  const fmtBaht = (n: number) => `${sym}${n.toFixed(2)}`;
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;
  const fmtX = (n: number) => `${n.toFixed(2)}`;
  const fmtNum = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1e9) return `${round(n / 1e9, 2)}${sym}bn`;
    if (abs >= 1e6) return `${round(n / 1e6, 1)}${sym}m`;
    if (abs >= 1e3) return `${round(n / 1e3, 1)}${sym}k`;
    return `${round(n, 0)}${sym}`;
  };
  const fx = (v: number | null | undefined, digits: number, suffix = '') =>
    v == null || !Number.isFinite(v) ? '-' : `${v.toFixed(digits)}${suffix}`;

  const area = detail.meta.realArea;
  const realSource = detail.meta.realSource;
  const base = detail.valuationBase;
  const ratingRows = detail.quality.rules;

  const [dR, dG1, dG2, dAaa] = [defaults.r, defaults.g1, defaults.g2, defaults.aaa];

  /* ===== ป้ายตีความสรุป (ภาษาพูด) — ราคา vs มูลค่าโมเดล + ตำแหน่งแถบ σ ===== */
  /* หลัก: มูลค่าที่เหมาะสม (DDM) ของหน้านี้ — ถ้าไม่มีฐานปันผลค่อยใช้ DCF */
  const useDdmForVerdict = base.dividendLatest > 0;
  const vFv = useDdmForVerdict ? val.ddmValue : val.dcfPerShare;
  const vMargin: number | null = useDdmForVerdict ? val.ddmMargin : val.dcfMargin;
  const peBand = detail.bands.find((b) => b.name === 'P/E') || detail.bands[0];
  const vSigma: number | null = peBand && peBand.realHistory ? peBand.vsMeanSigma : null;
  const verdictGauge = (vFv != null && Number.isFinite(vFv) && vFv > 0) ? 'model' : 'none';
  const verdictPct = vMargin ?? 0;
  const verdictTone: 'good' | 'warn' | 'neutral' =
    verdictGauge === 'none'
      ? 'neutral'
      : verdictPct >= 5 ? 'good' : verdictPct <= -5 ? 'warn' : 'neutral';
  const verdictMain = (() => {
    const pv = `${sym}${detail.price.toFixed(2)}`;
    if (verdictGauge === 'model') {
      const fv = `${sym}${vFv!.toFixed(2)}`;
      const lbl = useDdmForVerdict
        ? (th ? 'มูลค่าที่เหมาะสม (DDM)' : 'intrinsic value (DDM)')
        : (th ? 'มูลค่าจากกระแสเงินสด (DCF)' : 'FCFE value (DCF)');
      if (verdictPct >= 5) {
        return th
          ? `ราคา ${pv} ต่ำกว่า${lbl} ${fv} อยู่ ${verdictPct.toFixed(1)}% — ผู้ซื้อได้ "ส่วนลด" ${verdictPct.toFixed(1)}% เทียบกับตัวเลขโมเดล`
          : `Price ${pv} is ${verdictPct.toFixed(1)}% below ${lbl} ${fv} — a "discount" versus the model number.`;
      }
      if (verdictPct <= -5) {
        return th
          ? `ราคา ${pv} สูงกว่า${lbl} ${fv} อยู่ ${Math.abs(verdictPct).toFixed(1)}% — กำลังจ่ายแพงกว่าที่โมเดลเห็น`
          : `Price ${pv} is ${Math.abs(verdictPct).toFixed(1)}% above ${lbl} ${fv} — paying above the model view.`;
      }
      return th
        ? `ราคา ${pv} ใกล้เคียง${lbl} ${fv} — ราคาตลาดสะท้อนค่าประเมินของโมเดลอยู่แล้ว`
        : `Price ${pv} is close to ${lbl} ${fv} — the market already reflects the estimate.`;
    }
    return th
      ? `${t('colPrice')} ${pv} — ไม่มีฐานปันผล/กระแสเงินสดพอให้ตีมูลค่าด้วยโมเดล ใช้แถบ σ ด้านล่างเป็นตัวชี้วัดหลัก`
      : `Price ${pv} — no dividend/FCF base to run the models; the σ bands below are the main gauge.`;
  })();
  const verdictBand = vSigma == null ? null : {
    th: vSigma <= -1 ? 'ต่ำกว่า −1σ (โซนถูกที่สุดตามประวัติ)'
      : vSigma <= -0.3 ? 'ต่ำกว่าค่าเฉลี่ยเล็กน้อย'
      : vSigma <= 0.3 ? 'ราว ๆ ค่าเฉลี่ยหลายปีล่าสุด'
      : vSigma <= 1 ? 'สูงกว่าค่าเฉลี่ยเล็กน้อย'
      : 'สูงกว่า +1σ (โซนแพงที่สุดตามประวัติ)',
    en: vSigma <= -1 ? 'below −1σ (cheapest zone by history)'
      : vSigma <= -0.3 ? 'slightly below the multi-year mean'
      : vSigma <= 0.3 ? 'around the multi-year mean'
      : vSigma <= 1 ? 'slightly above the mean'
      : 'above +1σ (most expensive zone by history)',
  };
  const verdictToneCls = {
    good: 'bg-[#EBF6EE] border-[#C6E7CE] dark:bg-[#132A1E] dark:border-[#1E4D33]',
    warn: 'bg-[#FCEBEC] border-[#F3C4C7] dark:bg-[#2A1417] dark:border-[#4D2025]',
    neutral: 'bg-[#F1F4F8] border-[#D5DCE5] dark:bg-[#1B212F] dark:border-[#2E3646]',
  }[verdictTone];
  const verdictToneTx = {
    good: 'text-[#007C32] dark:text-[#00C076]',
    warn: 'text-[#D33F49] dark:text-[#F87C85]',
    neutral: 'text-[#232526] dark:text-[#E5E7EB]',
  }[verdictTone];

  /* desc ของแต่ละ slider ตามแหล่ง (Thai / US) */
  const sliderDescs = [
    { th: detail.sliders[0].descTh, en: detail.sliders[0].descEn },
    { th: detail.sliders[1].descTh, en: detail.sliders[1].descEn },
    { th: detail.sliders[2].descTh, en: detail.sliders[2].descEn },
    { th: detail.sliders[3].descTh, en: detail.sliders[3].descEn },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end items-end"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px] animate-in fade-in"
        style={{ animation: 'fadeIn .2s ease-out forwards' }}
      />

      {/* Drawer */}
      <aside
        className="relative z-10 w-full max-w-[980px] h-full bg-white dark:bg-[#161B26] border-l border-[#E4EAF1] dark:border-[#262C3A] flex flex-col shadow-2xl"
        style={{ animation: 'slideInFromRight .25s ease-out forwards' }}
      >
        {/* Top bar */}
        <div className="px-5 pt-4 pb-3 border-b border-[#E4EAF1] dark:border-[#262C3A] shrink-0">
          <div className="flex items-start justify-between gap-3">
            <button
              onClick={onClose}
              className="text-[11px] font-semibold text-[#1256A0] dark:text-[#60A5FA] hover:text-[#0E4178] dark:hover:text-[#93C5FD] flex items-center gap-1 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
              {th ? 'กลับไปหน้าผลลัพธ์' : 'Back to results'}
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setAddedToBoard((v) => !v)}
                disabled={addedToBoard}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded border transition cursor-pointer ${
                  addedToBoard
                    ? 'bg-[#EBF6EE] text-[#007C32] border-[#C6E7CE] dark:bg-[#132A1E] dark:text-[#00C076] dark:border-[#1E4D33]'
                    : 'bg-white dark:bg-[#1B212F] text-[#1256A0] dark:text-[#60A5FA] border-[#D5DCE5] dark:border-[#2E3646] hover:bg-[#F1F4F8] dark:hover:bg-[#252E3E]'
                }`}
              >
                {addedToBoard
                  ? (th ? 'เพิ่มแล้ว' : 'Added')
                  : (th ? 'เพิ่มไปยังบอร์ด' : 'Add to board')}
              </button>
              <button
                onClick={onClose}
                aria-label={th ? 'ปิด' : 'Close'}
                className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-[#F1F4F8] dark:hover:bg-[#252E3E] text-[#5B616E] dark:text-[#9CA3AF] cursor-pointer transition"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="mt-1.5 text-[11px] font-bold text-[#181C21] dark:text-[#F3F4F6]">
            {th ? 'ตัวคัดหุ้น - มูลค่าที่เหมาะสม' : 'Value screener'}
          </p>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 text-[#232526] dark:text-[#E5E7EB]">
          {/* Symbol header */}
          <div className="flex items-start gap-2 mb-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#181C21] dark:text-white">
              {detail.symbol}
            </h1>
            <span className="inline-flex items-center justify-center min-w-8 h-6 px-1.5 mt-0.5 rounded bg-[#007C32] text-white text-xs font-extrabold">
              {detail.score}
            </span>
          </div>
          <p className="text-xs text-[#5B616E] dark:text-[#9CA3AF] mb-3">
            {detail.name} · {sym} · {t('colPrice')} {fmtBaht(detail.price)} · {th ? 'ราคาข้อมูลล่าสุด' : 'price as of'} {detail.priceAsOf}
          </p>

          {/* ===== ป้ายตีความสรุป (ภาษาพูด) ===== */}
          <div className={`mb-5 rounded-md border px-3.5 py-2.5 ${verdictToneCls}`}>
            <p className={`text-xs font-bold leading-relaxed ${verdictToneTx}`}>
              {verdictMain}
            </p>
            {verdictBand && (
              <p className="text-[11px] mt-0.5 text-[#5B616E] dark:text-[#9CA3AF]">
                {th ? `ตามแถบมูลค่า: ${verdictBand.th}` : `By valuation band: ${verdictBand.en}`}
                {vSigma != null ? ` (${vSigma >= 0 ? '+' : ''}${vSigma}σ)` : ''}
              </p>
            )}
            <p className="text-[10px] mt-1 text-[#5B616E] dark:text-[#9CA3AF]">
              {th
                ? 'ตัวเลขคำนวณจากงบย้อนหลัง — ไม่ใช่คำทำนายราคาในอนาคต ใช้เป็นจุดตั้งต้น ก่อนซื้อจริงดูข่าว แผนกลยุทธ์ และงบประมาณการประกอบเสมอ'
                : 'Backward-looking numbers, not a price forecast. Use as a starting point; always check news and forward guidance before buying.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-x-6">
            {/* ===== LEFT COLUMN: scorecard ===== */}
            <div className="min-w-0">
              {/* ========== 1. QUALITY SCORECARD ========== */}
              <section className="mb-7">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Sparkles className="w-3.5 h-3.5 text-[#1256A0] dark:text-[#60A5FA]" />
                  <SectionHeading>{th ? 'ตารางคุณภาพ' : 'QUALITY SCORECARD'}</SectionHeading>
                  <RealPill real={area.scorecard} source={realSource} fy={detail.meta.latestFY} th={th} loading={realLoading} />
                </div>
                <p className="text-[10px] text-[#5B616E] dark:text-[#9CA3AF] mb-2.5">
                  {th
                    ? `${detail.quality.passCount} จาก ${detail.quality.totalCount} กฎผ่าน${detail.quality.naCount ? ` · ${detail.quality.naCount} กฎ N/A` : ''} — ${detail.fiscalYearsUsed} ปีงบล่าสุด`
                    : `${detail.quality.passCount} of ${detail.quality.totalCount} rules pass${detail.quality.naCount ? ` · ${detail.quality.naCount} N/A` : ''} — ${detail.fiscalYearsUsed} fiscal years`}
                </p>
                <ul className="divide-y divide-[#F0F2F5] dark:divide-[#222735] border-t border-b border-[#F0F2F5] dark:border-[#222735]">
                  {ratingRows.map((rule, idx) => (
                    <li key={idx} className="flex items-center gap-2 py-1.5">
                      <RuleIcon state={rule.state} />
                      <span className={`flex-1 text-xs leading-tight ${rule.state === 'NA' ? 'text-[#A0A5AF] dark:text-[#6B7280]' : 'text-[#232526] dark:text-[#E5E7EB]'}`}>
                        {th ? rule.labelTh : rule.labelEn}
                      </span>
                      {rule.delta != null && Number.isFinite(rule.delta) && (
                        <span className={`text-[9px] font-bold tabular-nums shrink-0 ${rule.delta >= 0 ? 'text-[#007C32] dark:text-[#00C076]' : 'text-[#D92D20] dark:text-[#F87171]'}`}>
                          {rule.delta >= 0 ? '+' : ''}{round(rule.delta, 0)}%
                        </span>
                      )}
                      <span
                        className={`text-[11px] font-bold tabular-nums shrink-0 whitespace-nowrap ${
                          rule.state === 'NA'
                            ? 'text-[#A0A5AF] dark:text-[#6B7280]'
                            : rule.state === 'PASS'
                            ? 'text-[#007C32] dark:text-[#00C076]'
                            : rule.state === 'WARN'
                            ? 'text-[#F07504]'
                            : 'text-[#D92D20] dark:text-[#F87171]'
                        }`}
                      >
                        {rule.value}
                      </span>
                      <span
                        className={`text-[9px] font-bold tracking-wider shrink-0 w-8 text-right ${
                          rule.state === 'NA'
                            ? 'text-[#A0A5AF] dark:text-[#6B7280]'
                            : rule.state === 'PASS'
                            ? 'text-[#007C32] dark:text-[#00C076]'
                            : rule.state === 'WARN'
                            ? 'text-[#F07504]'
                            : 'text-[#D92D20] dark:text-[#F87171]'
                        }`}
                      >
                        {rule.state}
                      </span>
                    </li>
                  ))}
                </ul>
                {detail.meta.dataSource === 'real' && (
                  <p className="mt-2 text-[9px] text-[#A0A5AF] dark:text-[#6B7280] leading-snug">
                    {th
                      ? 'กฎข้างบนประเมินจากงบรายปีของแหล่งข้อมูลจริง — กฎที่งบไม่พอ (เช่น ต้องการ 10 ปี) จะแสดง N/A · ตัวเลขสีเขียวหลังกฎ = การเปลี่ยนแปลง YoY'
                      : 'Rules are checked against annual statements from the real data source — rules needing more history show N/A. Green/red percentages are YoY changes.'}
                  </p>
                )}
              </section>

              {/* ========== 3. VALUATION BANDS (ซ้ายล่าง) ========== */}
              <section className="mb-7">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Sparkles className="w-3.5 h-3.5 text-[#1256A0] dark:text-[#60A5FA]" />
                  <SectionHeading>{th ? 'แถบการประเมินมูลค่า' : 'VALUATION BANDS'}</SectionHeading>
                  <RealPill real={area.bands} source={realSource} fy={detail.meta.latestFY} th={th} loading={realLoading} />
                </div>

                <div className="space-y-4">
                  {detail.bands.map((band) => {
                    const bandColor = band.name === 'P/E' ? '#4F79D6' : '#0070C4';
                    const hasBand = band.realHistory && band.sigmas.length > 0;
                    return (
                      <div key={band.name}>
                        <div className="flex items-baseline justify-between mb-1 flex-wrap gap-1">
                          <span className="text-[11px] font-bold text-[#181C21] dark:text-[#F3F4F6]">
                            {th ? `${band.name} ตอนนี้ (${band.nowLabel === 'TTM' ? 'TTM' : 'ไตรมาสล่าสุด'})` : `${band.name} now (${band.nowLabel})`}
                          </span>
                          <span className="text-[10px] text-[#5B616E] dark:text-[#9CA3AF] tabular-nums">
                            {band.now}
                            {hasBand && ` · ${th ? 'vs mean' : 'vs mean'} ${band.vsMeanSigma >= 0 ? '+' : ''}${band.vsMeanSigma}σ`}
                          </span>
                        </div>
                        {hasBand ? (
                          <>
                            <SigmaBandChart data={band.history} sigmas={band.sigmas} color={bandColor} />
                            <div className="mt-1.5 space-y-0.5">
                              {band.sigmas.map((s) => (
                                <div key={s.label} className="flex items-center justify-between gap-2">
                                  <span className={`text-[10px] font-bold tabular-nums ${s.label === 'mean' ? 'text-[#1256A0] dark:text-[#60A5FA]' : 'text-[#5B616E] dark:text-[#9CA3AF]'}`}>
                                    {s.label}
                                  </span>
                                  <span className={`text-[10px] tabular-nums ${s.label === 'mean' ? 'text-[#1256A0] dark:text-[#60A5FA] font-bold' : 'text-[#232526] dark:text-[#E5E7EB]'}`}>
                                    {s.value > 0 ? s.value.toFixed(2) : '—'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="text-[10px] text-[#5B616E] dark:text-[#9CA3AF] italic">
                            {th ? 'ยังไม่มีประวัติ multiple จริงเพียงพอ' : 'No sufficient real multiple history yet.'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* ===== RIGHT COLUMN ===== */}
            <div className="min-w-0">
              {/* ========== 2. VALUATION 2 columns: sliders | results ========== */}
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <ListFilter className="w-3.5 h-3.5 text-[#1256A0] dark:text-[#60A5FA]" />
                  <SectionHeading>{th ? 'การประเมินมูลค่า' : 'VALUATION'}</SectionHeading>
                  <RealPill real={area.valuation} source={realSource} fy={detail.meta.latestFY} th={th} loading={realLoading} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                  {/* Sliders (ซ้าย) */}
                  <div>
                    <div className="space-y-3.5">
                      <SliderRow
                        label={(th ? 'ผลตอบแทนที่ต้องการ (r)' : 'Return you require (r)')}
                        desc={sliderDescs[0][th ? 'th' : 'en']}
                        value={r} min={3} max={20} step={0.25} unit="%" onChange={setR}
                      />
                      <SliderRow
                        label={(th ? 'การเติบโต 5 ปีแรก (g1)' : 'Growth for first 5 years (g1)')}
                        desc={sliderDescs[1][th ? 'th' : 'en']}
                        value={g1} min={-5} max={20} step={0.25} unit="%" onChange={setG1}
                      />
                      <SliderRow
                        label={(th ? 'เติบโตตลอดกาล (g2)' : 'Terminal growth (g2)')}
                        desc={sliderDescs[2][th ? 'th' : 'en']}
                        value={g2} min={-2} max={12} step={0.25} unit="%" onChange={setG2}
                      />
                      <SliderRow
                        label={(th ? 'อัตราผลตอบแทนบอนด์ AAA (Graham)' : 'AAA bond yield (Graham)')}
                        desc={sliderDescs[3][th ? 'th' : 'en']}
                        value={aaaYield} min={0} max={10} step={0.05} unit="%" onChange={setAaaYield}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-3.5">
                      <button
                        onClick={() => { setG1(5); setG2(5); }}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded border border-[#D5DCE5] dark:border-[#2E3646] bg-[#F1F4F8] dark:bg-[#1B212F] text-[#232526] dark:text-[#E5E7EB] hover:bg-[#E4EAF1] dark:hover:bg-[#252E3E] cursor-pointer transition"
                      >
                        {th ? 'แบบ 5% นิ่ง' : 'Flat 5% scenario'}
                      </button>
                      <button
                        onClick={() => { setR(dR); setG1(dG1); setG2(dG2); setAaaYield(dAaa); }}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded border border-[#D5DCE5] dark:border-[#2E3646] bg-[#F1F4F8] dark:bg-[#1B212F] text-[#232526] dark:text-[#E5E7EB] hover:bg-[#E4EAF1] dark:hover:bg-[#252E3E] cursor-pointer transition"
                      >
                        {th ? 'ค่าเริ่มต้น' : 'Reset'}
                      </button>
                    </div>
                  </div>

                  {/* Results (ขวา) */}
                  <div className="md:border-l md:border-[#F0F2F5] md:dark:border-[#222735] md:pl-5">
                    <ResultRow
                      label={th ? 'มูลค่าที่เหมาะสม (DDM)' : 'Intrinsic value (DDM)'}
                      sub={th ? 'โมเดลปันผลสองชั้น จาก D0 ที่เห็นด้านล่าง' : 'Two-stage dividend model on the D0 below'}
                      value={fmtBaht(val.ddmValue)}
                      marker={val.ddmMargin}
                    />
                    <ResultRow
                      label={th ? 'Graham number' : 'Graham number (cross-check)'}
                      sub={th ? '√(22.5 × EPS × BVPS)' : 'sqrt(22.5 × EPS × BVPS)'}
                      value={fmtBaht(base.grahamNumber)}
                      marker={marginOfSafety(base.grahamNumber, stock.price)}
                    />
                    <ResultRow
                      label={th ? 'มูลค่า DCF ต่อหุ้น' : 'DCF per share'}
                      sub={th ? 'FCFE สองชั้น − หนี้สุทธิ ÷ จำนวนหุ้น' : 'Two-stage FCFE − net debt ÷ shares'}
                      value={val.dcfPerShare != null ? fmtBaht(val.dcfPerShare) : '—'}
                      marker={val.dcfMargin != null ? val.dcfMargin : undefined}
                      currency={cur}
                    />
                    <div className="py-2 border-t border-[#F0F2F5] dark:border-[#222735] grid grid-cols-2 gap-x-4 gap-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-[#5B616E] dark:text-[#9CA3AF]">{th ? 'ปันผล (D0)' : 'Dividend (D0)'}</span>
                        <span className="text-[11px] font-bold tabular-nums">{fmtBaht(base.dividendLatest)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-[#5B616E] dark:text-[#9CA3AF]">{th ? 'เงินสดส่งคืน 12 ด.' : 'Cash received, 12m'}</span>
                        <span className="text-[11px] font-bold tabular-nums">{fmtBaht(base.cashReceived12m)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 col-span-2">
                        <span className="text-[10px] text-[#5B616E] dark:text-[#9CA3AF]">
                          {detail.meta.dpsSource === 'thaifinDyQ'
                            ? (th ? 'เจาะจาก dy ไตรมาสล่าสุด × ราคาปัจจุบัน (thaifin)' : 'Derived from latest-quarter yield × price (thaifin)')
                            : detail.meta.dpsSource === 'yfTtm'
                            ? (th ? 'ปันผล TTM จาก yfinance' : 'TTM div payments (yfinance)')
                            : (th ? 'โมเดลประมาณการ' : 'Derived model')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CROSS-CHECKS strip */}
                <div className="mt-4 rounded-lg border border-[#E4EAF1] dark:border-[#262C3A] bg-[#F8FAFC] dark:bg-[#1A2130] px-3.5 py-3">
                  <p className="text-[9px] font-extrabold tracking-widest uppercase text-[#5B616E] dark:text-[#9CA3AF] mb-2">
                    {th ? 'ตรวจสอบไขว้กัน' : 'Cross-checks'}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 text-[10px]">
                    <CrossItem label="DCF / share" value={val.dcfPerShare != null ? fmtBaht(val.dcfPerShare) : '—'} textColor={!!(val.dcfPerShare && val.dcfPerShare > stock.price)} />
                    <CrossItem label={th ? 'มาร์จิ้นความปลอดภัย DCF' : 'DCF margin of safety'}
                      value={val.dcfMargin != null ? `${val.dcfMargin}%` : '—'} color={val.dcfMargin} />
                    <CrossItem label="WACC" value={`${val.wacc.toFixed(2)}%`} />
                    <CrossItem label={th ? 'ต้นทุนส่วนของผู้ถือหุ้น' : 'Cost of equity'} value={`${r.toFixed(2)}%`} />
                    <CrossItem label={th ? 'ต้นทุนหนี้ (หลังภาษี)' : 'Cost of debt, after tax'} value={`${base.costDebtAfterTax.toFixed(2)}%`} />
                    <CrossItem label={th ? 'หนี้สุทธิ' : 'Net debt'} value={fmtNum(base.netDebt)} textColor={base.netDebt < 0} />
                    <CrossItem label={th ? 'FCFE มัธยฐาน 3 ปี' : 'FCFE, median of 3'} value={fmtNum(base.fcfeMedian)} />
                    <CrossItem label={th ? 'TV ต่อมูลค่ารวม' : 'Terminal share of the estimate'} value={val.terminalShare != null ? `${val.terminalShare}%` : '—'} />
                    <CrossItem
                      label={th ? 'ราคาบอก g2 ต่อเนื่อง' : 'Price implies terminal growth'}
                      value={val.impliedG2 != null ? `${val.impliedG2 >= 0 ? '+' : ''}${val.impliedG2}%` : '—'}
                    />
                    <CrossItem label={th ? 'Graham growth' : 'Graham growth'} value={fmtBaht(val.grahamGrowth)}
                      color={val.grahamGrowthMargin} />
                    <CrossItem label={th ? 'มาร์จิ้นความปลอดภัย Graham' : 'Graham margin of safety'}
                      value={`${val.grahamGrowthMargin}%`} color={val.grahamGrowthMargin} />
                    <CrossItem label={th ? 'ยีลด์ AAA' : 'AAA yield'} value={`${aaaYield.toFixed(2)}%`} />
                    <div className="col-span-2 sm:col-span-3 lg:col-span-4 text-[9px] text-[#A0A5AF] dark:text-[#6B7280] leading-snug">
                      {th
                        ? (stock.market === 'SET'
                          ? 'ต้นทุนหนี้ประมาณจากอัตรากู้ยืมองค์กรไทยก่อนภาษี ' + base.borrowingRatePreTax.toFixed(2) + '%' + ' × (1−0.20) — thaifin ไม่เปิดดอกเบี้ยจ่ายรายปี จึงใช้ชุดตัวเลขนี้เทียบไขว้กัน · ยีลด์ AAA: ThaiBMA AAA 5 ปี Q3/2026 = 2.06%'
                          : 'ต้นทุนหนี้ประมาณจากอัตรากู้ยืมองค์กรสหรัฐก่อนภาษี ' + base.borrowingRatePreTax.toFixed(2) + '%' + ' × (1−0.21) · ยีลด์ AAA US corporate ประมาณ 4.0%')
                        : (stock.market === 'SET'
                          ? 'Cost of debt proxies the Thai corporate borrowing rate: ' + base.borrowingRatePreTax.toFixed(2) + '% pre-tax × (1−0.20). thaifin does not expose annual interest paid. AAA yield: ThaiBMA AAA 5-year = 2.06% at Q3/2026.'
                          : 'Cost of debt proxies the US corporate borrowing rate: ' + base.borrowingRatePreTax.toFixed(2) + '% pre-tax × (1−0.21). AAA yield: US corporate proxy ~4%.')}
                    </div>
                  </div>
                </div>
              </section>

              {/* ========== 5. ANNUAL STATEMENT CHARTS ========== */}
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Sparkles className="w-3.5 h-3.5 text-[#1256A0] dark:text-[#60A5FA]" />
                  <SectionHeading>{th ? 'กราฟงบรายปี' : 'ANNUAL STATEMENT CHARTS'}</SectionHeading>
                  <RealPill real={area.charts} source={realSource} fy={detail.meta.latestFY} th={th} loading={realLoading} />
                </div>
                <p className="text-[10px] text-[#5B616E] dark:text-[#9CA3AF] mb-3.5 leading-relaxed">
                  {area.charts
                    ? (th
                      ? `หนึ่งแท่งต่อปีงบ ย้อนหลัง ${detail.fiscalYearsUsed} ปี จากงบจริง — เส้นประบนกราฟ ROE = 15% · กราฟปันผลแยกแท่งเป็นไตรมาสจากรอบจ่ายจริง (สี = ไตรมาสจ่าย)`
                      : `One bar per fiscal year, ${detail.fiscalYearsUsed} real fiscal years. The ROE chart shows a dashed 15% guide line · DPS chart is stacked by payment quarter (colours = quarter paid).`)
                    : (th ? 'หนึ่งแท่งต่อปีงบ 10 ปี (โมเดลประมาณการ)' : 'One bar per fiscal year, ten years (derived model).')}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  {detail.charts.map((ch) => {
                    const colors: Record<string, string> = {
                      'net-profit': '#D33F49',
                      'revenue': '#2E6BE6',
                      'eps': '#22C1A4',
                      'gross-margin': '#22B573',
                      'npm': '#D33F49',
                      'roe': '#0FA6A6',
                      'dps': '#4F79D6',
                      'de': '#F07504',
                    };
                    const latest = ch.series[ch.series.length - 1];
                    const color = colors[ch.key] ?? '#4F79D6';
                    const fmt =
                      ch.format === 'baht_m' ? fmtBathM
                      : ch.format === 'baht' ? fmtBaht
                      : ch.format === 'pct' ? fmtPct
                      : fmtX;

                    const isDpsUs = ch.key === 'dps' && detail.divPaymentsReal;
                    const shown = isDpsUs ? undefined : ch.series;
                    const dpsLabel = isDpsUs && detail.divPayments.length
                      ? `${sym}${detail.divPayments[detail.divPayments.length - 1].amount} @ ${detail.divPayments[detail.divPayments.length - 1].date}`
                      : latest ? fmt(latest.y) : '-';

                    return (
                      <div key={ch.key}>
                        <div className="flex items-baseline justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-[#181C21] dark:text-[#F3F4F6]">
                            {th ? ch.titleTh : ch.titleEn}{isDpsUs ? (th ? ' (ต่อรอบจ่าย)' : ' (by payment)') : ''}
                          </span>
                          <span className="text-[10px] text-[#5B616E] dark:text-[#9CA3AF] tabular-nums">
                            {dpsLabel}
                          </span>
                        </div>
                        {isDpsUs
                          ? <DivPaymentsBars payments={detail.divPayments} currencySymbol={sym} />
                          : <MiniBars
                              series={shown ?? []}
                              color={color}
                              dashedLinePct={ch.key === 'roe' ? 15 : null}
                            />}
                        <div className="flex justify-between mt-1">
                          <span className="text-[9px] text-[#A0A5AF] tabular-nums">{(!isDpsUs && ch.series[0]?.x) || (isDpsUs && detail.divPayments.length ? detail.divPayments[0].date.slice(0, 4) : '')}</span>
                          <span className="text-[9px] text-[#A0A5AF] tabular-nums">{(!isDpsUs && latest?.x) || (isDpsUs && detail.divPayments.length ? detail.divPayments[detail.divPayments.length - 1].date.slice(0, 10) : '')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>

          {/* ========== 4. AGAINST THE PEERS (เต็มความกว้าง) ========== */}
          <section className="mb-7">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Sparkles className="w-3.5 h-3.5 text-[#1256A0] dark:text-[#60A5FA]" />
              <SectionHeading>{th ? 'เทียบกับเพื่อนร่วมตลาด' : 'AGAINST THE PEERS'}</SectionHeading>
              <RealPill real={area.peers} source={realSource} fy={detail.meta.latestFY} th={th} loading={realLoading} />
            </div>
            <p className="text-[10px] text-[#5B616E] dark:text-[#9CA3AF] mb-3 leading-relaxed">
              {th
                ? 'เปอร์เซ็นไทล์ของแต่ละค่าเทียบกับหุ้นที่ถูกคัดในหน้าจอนี้'
                : 'The percentile of each measure against the names screened in this table'}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full max-w-2xl text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E4EAF1] dark:border-[#262C3A] text-[10px]">
                    <th className="py-1.5 pr-3 font-bold text-[#181C21] dark:text-[#F3F4F6]">{th ? 'ค่า' : 'MEASURE'}</th>
                    <th className="py-1.5 px-2 font-bold text-[#181C21] dark:text-[#F3F4F6] text-right">{th ? 'หุ้นนี้' : 'VALUE'}</th>
                    <th className="py-1.5 pl-2 font-bold text-[#1256A0] dark:text-[#60A5FA] text-right whitespace-nowrap">
                      {detail.peers.marketNames} {th ? 'ชื่อที่ถูกคัด' : 'names screened'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2F5] dark:divide-[#222735]">
                  {detail.peers.rows.map((r2, idx) => (
                    <tr key={idx}>
                      <td className="py-2 pr-3 text-[#232526] dark:text-[#E5E7EB] whitespace-nowrap">
                        {th ? r2.measureTh : r2.measure}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-[#181C21] dark:text-[#F3F4F6] tabular-nums whitespace-nowrap">
                        {r2.value}
                      </td>
                      <td className="py-2 pl-2 text-right text-[11px] text-[#5B616E] dark:text-[#9CA3AF] tabular-nums whitespace-nowrap">
                        {r2.higherIsBetter ? (th ? 'สูงกว่า' : 'better than') : (th ? 'ต่ำกว่า' : 'below')} {r2.marketPct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ========== 6. STATEMENTS TABLE (เต็มความกว้าง) ========== */}
          <section className="mb-3">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Table2 className="w-3.5 h-3.5 text-[#1256A0] dark:text-[#60A5FA]" />
              <SectionHeading>{th ? 'งบการเงิน' : 'STATEMENTS'}</SectionHeading>
              <RealPill real={area.statements} source={realSource} fy={detail.meta.latestFY} th={th} loading={realLoading} />
            </div>
            <p className="text-[10px] text-[#5B616E] dark:text-[#9CA3AF] mb-2.5">
              {th
                ? `ห้าปีงบล่าสุด (จาก ${detail.fiscalYearsUsed} ปีที่มีข้อมูล) — D/E = หนี้สินรวม ÷ ส่วนผู้ถือหุ้น`
                : `The five most recent fiscal years (${detail.fiscalYearsUsed} years of data) — D/E = total liabilities ÷ equity`}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-[11px] border-collapse tabular-nums">
                <thead className="text-[10px] text-[#5B616E] dark:text-[#9CA3AF]">
                  <tr className="border-b border-[#E4EAF1] dark:border-[#262C3A]">
                    <th className="py-1.5 pr-2 text-left font-bold">FY</th>
                    <th className="py-1.5 px-2 font-bold">ROE</th>
                    <th className="py-1.5 px-2 font-bold">ROA</th>
                    <th className="py-1.5 px-2 font-bold">NPM</th>
                    <th className="py-1.5 px-2 font-bold">D/E</th>
                    <th className="py-1.5 px-2 font-bold">EPS</th>
                    <th className="py-1.5 px-2 font-bold">BVPS</th>
                    <th className="py-1.5 pl-2 font-bold">DPS {th ? 'ที่จ่าย' : 'PAID'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2F5] dark:divide-[#222735]">
                  {detail.statements.map((row) => (
                    <tr key={row.fy} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E2536] transition-colors">
                      <td className="py-2 pr-2 text-left font-bold text-[#181C21] dark:text-[#F3F4F6]">{row.fy}</td>
                      <td className="py-2 px-2 text-[#232526] dark:text-[#E5E7EB]">{fx(row.roe, 1, '%')}</td>
                      <td className="py-2 px-2 text-[#232526] dark:text-[#E5E7EB]">{fx(row.roa, 1, '%')}</td>
                      <td className="py-2 px-2 text-[#232526] dark:text-[#E5E7EB]">{fx(row.npm, 1, '%')}</td>
                      <td className="py-2 px-2 text-[#232526] dark:text-[#E5E7EB]">{fx(row.d_e, 2)}</td>
                      <td className="py-2 px-2 text-[#232526] dark:text-[#E5E7EB]">{fx(row.eps, 2)}</td>
                      <td className="py-2 px-2 text-[#232526] dark:text-[#E5E7EB]">{fx(row.bvps, 2)}</td>
                      <td className="py-2 pl-2 text-[#232526] dark:text-[#E5E7EB]">{fx(row.dps, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Data-source disclaimer */}
          <p className="mt-4 mb-2 text-[9px] leading-snug text-[#A0A5AF] dark:text-[#6B7280] max-w-3xl">
            {detail.meta.dataSource === 'real'
              ? (th
                ? `หน้าต่างนี้ใช้ข้อมูลจริง 100% จาก ${realSource === 'thaifin' ? 'thaifin (ฐานข้อมูลงบการเงินบริษัทจดทะเบียนไทย)' : 'yfinance (Yahoo Finance)'} — งบรายปี, TTM, ปันผล, หนี้สุทธิและกราฟดึงจากแหล่งนั้น ส่วน DDM / DCF / Graham / WACC เป็นสูตรที่คำนวณจากค่าจริงตามที่คุณปรับผ่าน slider ในบางกฎ (เช่น กฎที่ต้องการประวัติ 10 ปี) จะแสดง N/A แทนการประมาณขึ้นเอง`
                : `Real data source: ${realSource === 'thaifin' ? 'thaifin (Thai listed company filings)' : 'yfinance (Yahoo Finance)'}. Annual statements, TTM figures, dividends, net debt and charts come from that source; DDM / DCF / Graham / WACC are formulas evaluated on those real inputs via the sliders. Rules lacking enough history show N/A instead of being estimated.`)
              : (th
                ? 'หน้าต่างนี้สร้างจากโมเดลประมาณการของระบบ Inveskeng — ยังไม่มีข้อมูลจริงสำหรับหุ้นนี้ (ลอง sync ข้อมูลอีกครั้ง)'
                : 'This drawer is generated by the Inveskeng derived model — real fundamentals were not available for this ticker.')}
          </p>
        </div>

        {/* Bottom close button */}
        <div className="px-5 py-3 border-t border-[#E4EAF1] dark:border-[#262C3A] shrink-0 flex justify-end bg-white dark:bg-[#161B26]">
          <button
            onClick={onClose}
            className="text-xs font-semibold px-3.5 py-1.5 rounded border border-[#D5DCE5] dark:border-[#2E3646] bg-white dark:bg-[#1B212F] text-[#232526] dark:text-[#E5E7EB] hover:bg-[#F1F4F8] dark:hover:bg-[#252E3E] cursor-pointer transition"
          >
            {th ? 'ปิด' : 'Close'}
          </button>
        </div>
      </aside>

      <style>{`
        @keyframes slideInFromRight { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

/* ---------- CROSS-CHECKS cell ---------- */

function CrossItem({
  label, value, color, textColor,
}: {
  label: string;
  value: string;
  /** ถ้าเป็น % MoS → สีตามเครื่องหมาย */
  color?: number | null;
  /** จริงเมื่อค่าดี (ตัวหนังสือเขียว) เช่น มูลค่า > ราคา, หนี้สุทธิติดลบ */
  textColor?: boolean;
}) {
  let valueClass = 'text-[#181C21] dark:text-[#F3F4F6]';
  if (textColor) valueClass = 'text-[#007C32] dark:text-[#00C076]';
  if (color != null) valueClass = color >= 0 ? 'text-[#007C32] dark:text-[#00C076]' : 'text-[#D92D20] dark:text-[#F87171]';
  return (
    <div className="flex items-baseline justify-between gap-1.5 min-w-0">
      <span className="text-[#5B616E] dark:text-[#9CA3AF] truncate shrink-0">{label}</span>
      <span className={`font-bold tabular-nums whitespace-nowrap ${valueClass}`}>{value}</span>
    </div>
  );
}
