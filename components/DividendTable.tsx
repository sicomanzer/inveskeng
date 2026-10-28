'use client';

import React, { useMemo, useState } from 'react';
import StockDetailDialog from '@/components/StockDetailDialog';
import { useApp } from '@/context/AppContext';
import {
  DividendStock,
  StockItem,
  formatMarketCapTHB,
} from '@/types/stock';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Droplets, Info } from 'lucide-react';

interface DividendTableProps {
  initialData: DividendStock[];
  sourceAsOf?: string;
  partial?: boolean;
  totalMatches?: number | null;
  loading?: boolean;
}

type SortKey =
  | 'symbol'
  | 'price'
  | 'changePercent'
  | 'dpsLastYear'
  | 'divYield'
  | 'avgYield5y'
  | 'marketCap'
  | 'peRatio'
  | 'sector';

/** DividendStock -> StockItem เพื่อเปิด popup รายละเอียดตัวเดียวกับตารางอื่น */
function toStockItem(d: DividendStock): StockItem {
  return {
    id: String(d.pairId ?? d.symbol),
    symbol: d.symbol,
    name: d.name,
    shortName: d.name,
    link: d.path
      ? `https://www.investing.com${d.path}`
      : `https://www.investing.com/equities/${d.symbol.toLowerCase()}`,
    price: d.price,
    currency: 'THB',
    currencySymbol: '฿',
    fairValue: null,
    fairValueUpside: 0,
    peRatio: d.peRatio ?? null,
    evEbitda: null,
    marketCap: d.marketCap ?? null,
    marketCapFormatted: formatMarketCapTHB(d.marketCap),
    epsGrowth5y: null,
    changeOneDayPercent: d.changePercent ?? 0,
    financialHealth: '',
    flagCode: 'TH',
    flagName: 'Thailand',
    market: 'SET',
    valuationType: 'undervalued',
    dividendOverride: {
      ttm: d.dpsLastYear ?? null,
      prevFY: d.dpsPrevFY ?? null,
      payments: d.divPayments ?? [],
    },
  };
}

export default function DividendTable({
  initialData,
  sourceAsOf,
  partial,
  totalMatches,
  loading,
}: DividendTableProps) {
  const { t, lang } = useApp();
  const isThai = lang === 'th';
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('marketCap');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [detailSymbol, setDetailSymbol] = useState<string>('');
  const [detailOpen, setDetailOpen] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? initialData.filter(
          (d) =>
            d.symbol.toLowerCase().includes(q) ||
            (d.name || '').toLowerCase().includes(q) ||
            (d.sector || '').toLowerCase().includes(q),
        )
      : initialData.slice();

    const val = (d: DividendStock): number | string => {
      switch (sortKey) {
        case 'symbol':
          return d.symbol;
        case 'sector':
          return d.sector || '';
        case 'price':
          return d.price ?? 0;
        case 'changePercent':
          return d.changePercent ?? -999;
        case 'dpsLastYear':
          return d.dpsLastYear ?? -1;
        case 'divYield':
          return d.divYield ?? -1;
        case 'avgYield5y':
          return d.avgYield5y ?? -1;
        case 'marketCap':
          return d.marketCap ?? 0;
        case 'peRatio':
          return d.peRatio ?? Number.MAX_SAFE_INTEGER;
      }
    };

    return filtered.sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      let cmp: number;
      if (typeof av === 'string' || typeof bv === 'string') {
        cmp = String(av).localeCompare(String(bv));
      } else {
        cmp = av === bv ? 0 : av > bv ? 1 : -1;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [initialData, search, sortKey, sortDir]);

  const peers = useMemo(() => initialData.map(toStockItem), [initialData]);
  const selectedStock = useMemo(
    () => peers.find((s) => s.symbol === detailSymbol) || null,
    [peers, detailSymbol],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'symbol' || key === 'sector' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#1256A0] dark:text-[#60A5FA]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#1256A0] dark:text-[#60A5FA]" />
    );
  };

  const fmtPct = (v: number | null | undefined, plus = false) => {
    if (v === null || v === undefined || !isFinite(v)) return '-';
    return `${plus && v > 0 ? '+' : ''}${v.toFixed(2)}%`;
  };

  const asOfLabel = sourceAsOf
    ? new Date(sourceAsOf).toLocaleString(isThai ? 'th-TH' : 'en-US', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="w-full bg-white dark:bg-[#161B26] border border-[#E4EAF1] dark:border-[#262C3A] rounded-lg overflow-hidden shadow-2xs font-sans transition-colors duration-200">
      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-[#E4EAF1] dark:border-[#262C3A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#161B26]">
        <div className="flex items-center gap-2 max-w-full sm:max-w-[240px] shrink-0">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-[#8A909D] dark:text-[#6B7280] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full bg-[#F8F9FA] dark:bg-[#1F2636] border border-[#D5DCE5] dark:border-[#2E3646] rounded pl-7.5 pr-2.5 py-1 text-xs text-[#232526] dark:text-[#E5E7EB] placeholder-[#8A909D] focus:outline-none focus:bg-white dark:focus:bg-[#181E2B] focus:border-[#1256A0] transition"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#5B616E] dark:text-[#9CA3AF]">
          <span className="inline-flex items-center gap-1 text-[#007C32] dark:text-[#00C076] bg-[#EBF6EE] dark:bg-[#132A1E] px-2 py-0.5 rounded-full border border-[#C6E7CE] dark:border-[#1E4D33] font-semibold">
            <Droplets className="w-3 h-3" />
            {isThai ? 'ปันผล > 5% · เฉลี่ย 5 ปี > 5%' : 'Yield > 5% · 5Y avg > 5%'}
          </span>
          {typeof totalMatches === 'number' && (
            <span>
              {isThai ? 'ผ่านเงื่อนไขทั้งหมด' : 'Total matches'}{' '}
              <strong className="text-[#181C21] dark:text-white">{totalMatches}</strong>{' '}
              {isThai ? 'ตัว' : ''}
            </span>
          )}
          {asOfLabel && (
            <span className="inline-flex items-center gap-1">
              <Info className="w-3 h-3" />
              {t('lastSynced')} {asOfLabel}
              {partial ? (isThai ? ' (ข้อมูลบางส่วน)' : ' (partial)') : ''}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto relative">
        <table className="w-full text-left text-xs md:text-[13px] border-collapse bg-white dark:bg-[#161B26]">
          <thead className="bg-[#F8F9FA] dark:bg-[#1B212F] border-b border-[#E4EAF1] dark:border-[#262C3A]">
            <tr>
              <th className="py-2 px-2.5 sticky left-0 bg-[#F8F9FA] dark:bg-[#1B212F] z-20 border-r border-[#E4EAF1] dark:border-[#262C3A] shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                <button
                  onClick={() => toggleSort('symbol')}
                  className="flex items-center gap-1 font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6]"
                >
                  {t('colName')}
                  <SortIcon column="symbol" />
                </button>
              </th>
              <th className="py-2 px-2.5 text-right">
                <button
                  onClick={() => toggleSort('price')}
                  className="ml-auto flex items-center gap-1 font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6]"
                >
                  {t('colPrice')}
                  <SortIcon column="price" />
                </button>
              </th>
              <th className="py-2 px-2.5 text-right">
                <button
                  onClick={() => toggleSort('changePercent')}
                  className="ml-auto flex items-center gap-1 font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6]"
                >
                  {t('colChange')}
                  <SortIcon column="changePercent" />
                </button>
              </th>
              <th className="py-2 px-2.5 text-right">
                <button
                  onClick={() => toggleSort('dpsLastYear')}
                  className="ml-auto flex items-center gap-1 font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6]"
                >
                  {t('colDps')}
                  <SortIcon column="dpsLastYear" />
                </button>
              </th>
              <th className="py-2 px-2.5 text-right">
                <button
                  onClick={() => toggleSort('divYield')}
                  className="ml-auto flex items-center gap-1 font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6]"
                >
                  {t('colDivYield')}
                  <SortIcon column="divYield" />
                </button>
              </th>
              <th className="py-2 px-2.5 text-right">
                <button
                  onClick={() => toggleSort('avgYield5y')}
                  className="ml-auto flex items-center gap-1 font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6]"
                >
                  {t('colAvgYield5y')}
                  <SortIcon column="avgYield5y" />
                </button>
              </th>
              <th className="py-2 px-2.5 text-right">
                <button
                  onClick={() => toggleSort('marketCap')}
                  className="ml-auto flex items-center gap-1 font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6]"
                >
                  {t('colMarketCap')}
                  <SortIcon column="marketCap" />
                </button>
              </th>
              <th className="py-2 px-2.5 text-right">
                <button
                  onClick={() => toggleSort('peRatio')}
                  className="ml-auto flex items-center gap-1 font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6]"
                >
                  {t('colPe')}
                  <SortIcon column="peRatio" />
                </button>
              </th>
              <th className="py-2 px-2.5">
                <button
                  onClick={() => toggleSort('sector')}
                  className="flex items-center gap-1 font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6]"
                >
                  {t('colSector')}
                  <SortIcon column="sector" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F2F5] dark:divide-[#222735]">
            {rows.length > 0 ? (
              rows.map((d) => (
                <tr
                  key={d.symbol}
                  className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E2536] transition-colors group"
                >
                  <td className="py-2.5 px-3 whitespace-nowrap leading-none sticky left-0 bg-white dark:bg-[#161B26] group-hover:bg-[#F8FAFC] dark:group-hover:bg-[#1E2536] z-10 border-r border-[#E4EAF1] dark:border-[#262C3A] shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => {
                          setDetailSymbol(d.symbol);
                          setDetailOpen(true);
                        }}
                        className="text-left font-bold text-[#1256A0] dark:text-[#60A5FA] hover:underline cursor-pointer w-fit"
                      >
                        {d.symbol}
                      </button>
                      <span className="text-[11px] text-[#5B616E] dark:text-[#9CA3AF] max-w-[220px] truncate">
                        {d.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-[#232526] dark:text-[#E5E7EB]">
                    ฿{Number(d.price).toFixed(2)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-semibold ${
                      (d.changePercent ?? 0) > 0
                        ? 'text-[#007C32] dark:text-[#00C076]'
                        : (d.changePercent ?? 0) < 0
                          ? 'text-[#D92D20] dark:text-[#F87171]'
                          : 'text-[#5B616E] dark:text-[#9CA3AF]'
                    }`}
                  >
                    {fmtPct(d.changePercent, true)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-[#232526] dark:text-[#E5E7EB]">
                    {d.dpsLastYear ? `฿${Number(d.dpsLastYear).toFixed(2)}` : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <span
                      className={`inline-flex items-center justify-end px-1.5 py-0.5 rounded font-bold tabular-nums ${
                        (d.divYield ?? 0) >= 5
                          ? 'bg-[#EBF6EE] dark:bg-[#132A1E] text-[#007C32] dark:text-[#00C076]'
                          : 'text-[#232526] dark:text-[#E5E7EB]'
                      }`}
                    >
                      {fmtPct(d.divYield)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-[#232526] dark:text-[#E5E7EB]">
                    {fmtPct(d.avgYield5y)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-[#232526] dark:text-[#E5E7EB]">
                    ฿{formatMarketCapTHB(d.marketCap)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-[#232526] dark:text-[#E5E7EB]">
                    {d.peRatio !== null && d.peRatio !== undefined ? d.peRatio.toFixed(2) : '-'}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-[#5B616E] dark:text-[#9CA3AF]">
                    {d.sector || '-'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="text-center py-10 text-[#8A909D] dark:text-[#6B7280]">
                  {loading
                    ? (isThai ? 'กำลังโหลดข้อมูลหุ้นปันผล...' : 'Loading dividend stocks...')
                    : t('noStocksFound')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[#E4EAF1] dark:border-[#262C3A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 bg-white dark:bg-[#161B26] text-[11px] text-[#5B616E] dark:text-[#9CA3AF]">
        <span>
          {t('showing')}{' '}
          <strong className="text-[#181C21] dark:text-white font-semibold">{rows.length}</strong>{' '}
          {t('stocks')}
        </span>
        <span>
          {lang === 'th'
            ? 'ผลตอบแทนปันผลคำนวณจากเงินปันผลจริง 12 เดือนย้อนหลัง (ตามวัน ex-date) ÷ ราคาล่าสุด · เฉลี่ย 5 ปี = DPS ปี ÷ ราคาปิดสิ้นปี (คำนวณจาก yfinance อาจต่างจาก Investing.com เล็กน้อย)'
            : 'Yield = trailing 12-month dividends (by ex-date) ÷ latest price · 5Y avg = annual DPS ÷ year-end close (computed from yfinance; may differ slightly from Investing.com)'}
        </span>
      </div>

      <StockDetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        stock={selectedStock}
        peers={peers}
      />
    </div>
  );
}
