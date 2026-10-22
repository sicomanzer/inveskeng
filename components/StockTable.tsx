'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
  SortingState,
} from '@tanstack/react-table';
import { StockItem, MarketType, getRatingColor } from '@/types/stock';
import { useApp } from '@/context/AppContext';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Search, 
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';

interface StockTableProps {
  initialData: StockItem[];
  market: MarketType;
}

export default function StockTable({ initialData, market }: StockTableProps) {
  const { t, lang, formatRating } = useApp();
  const [data, setData] = useState<StockItem[]>(initialData);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [healthFilter, setHealthFilter] = useState<string>('ALL');

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSearch =
        item.symbol.toLowerCase().includes(globalFilter.toLowerCase()) ||
        item.name.toLowerCase().includes(globalFilter.toLowerCase());
      const matchesHealth =
        healthFilter === 'ALL' || item.financialHealth.toUpperCase() === healthFilter.toUpperCase();
      return matchesSearch && matchesHealth;
    });
  }, [data, globalFilter, healthFilter]);

  // Small orange Pro badge
  const proBadge = (
    <span className="inline-flex items-center justify-center w-3 h-3 rounded-[3px] bg-[#F07504] text-[8px] font-black text-white shrink-0 ml-0.5">
      P
    </span>
  );

  const columns = useMemo<ColumnDef<StockItem>[]>(
    () => [
      {
        accessorKey: 'symbol',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6] transition text-xs"
          >
            <span>{t('colName')}</span>
            <span className="text-[10px] text-[#A0A5AF]">▾</span>
          </button>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-2 py-0.5 min-w-[150px] max-w-[210px]">
              <span className="font-bold text-[#181C21] dark:text-[#F3F4F6] text-xs md:text-sm tracking-tight hover:text-[#1256A0] dark:hover:text-[#60A5FA] cursor-pointer">
                {item.symbol}
              </span>
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                title={item.name}
                className="text-xs text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#1256A0] dark:hover:text-[#60A5FA] truncate max-w-[120px] inline-block font-normal transition"
              >
                {item.name}
              </a>
            </div>
          );
        },
      },
      {
        accessorKey: 'price',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6] justify-end w-full text-xs"
          >
            <span>{t('colPrice')}</span>
            <span className="text-[10px] text-[#A0A5AF]">▾</span>
          </button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-normal text-[#232526] dark:text-[#E5E7EB] tabular-nums text-xs md:text-[13px]">
            {row.original.price.toFixed(2)}
          </div>
        ),
      },
      {
        accessorKey: 'fairValueUpside',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex flex-col items-end justify-end font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6] w-full text-xs leading-tight"
          >
            {lang === 'th' ? (
              <>
                <span>ขาขึ้น</span>
                <span className="flex items-center gap-0.5">
                  <span>(upside)</span>
                  {proBadge}
                  <span className="text-[10px] text-[#A0A5AF]">▾</span>
                </span>
              </>
            ) : (
              <>
                <span>Upside</span>
                <span className="flex items-center gap-0.5">
                  {proBadge}
                  <span className="text-[10px] text-[#A0A5AF]">▾</span>
                </span>
              </>
            )}
          </button>
        ),
        cell: ({ row }) => {
          const val = row.original.fairValueUpside;
          return (
            <div className="text-right font-bold text-[#007C32] dark:text-[#00C076] whitespace-nowrap tabular-nums text-xs md:text-[13px]">
              +{val.toFixed(2)}%
            </div>
          );
        },
      },
      {
        accessorKey: 'fairValue',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex flex-col items-end justify-end font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6] w-full text-xs leading-tight"
          >
            {lang === 'th' ? (
              <>
                <span>มูลค่า</span>
                <span className="flex items-center gap-0.5">
                  <span>ยุติธรรม</span>
                  {proBadge}
                  <span className="text-[10px] text-[#A0A5AF]">▾</span>
                </span>
              </>
            ) : (
              <>
                <span>Fair Value</span>
                <span className="flex items-center gap-0.5">
                  {proBadge}
                  <span className="text-[10px] text-[#A0A5AF]">▾</span>
                </span>
              </>
            )}
          </button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-normal text-[#232526] dark:text-[#E5E7EB] tabular-nums text-xs md:text-[13px]">
            {row.original.fairValue ? row.original.fairValue.toFixed(2) : '-'}
          </div>
        ),
      },
      {
        accessorKey: 'financialHealth',
        header: () => (
          <div className="flex flex-col items-start justify-end text-xs font-semibold text-[#5B616E] dark:text-[#9CA3AF] leading-tight">
            {lang === 'th' ? (
              <>
                <span>สุขภาพ</span>
                <span>ทางการ</span>
                <span className="flex items-center gap-0.5">
                  <span>เงิน</span>
                  {proBadge}
                  <span className="text-[10px] text-[#A0A5AF]">▾</span>
                </span>
              </>
            ) : (
              <>
                <span>Financial</span>
                <span className="flex items-center gap-0.5">
                  <span>Health</span>
                  {proBadge}
                  <span className="text-[10px] text-[#A0A5AF]">▾</span>
                </span>
              </>
            )}
          </div>
        ),
        cell: ({ row }) => {
          const formatted = formatRating(row.original.financialHealth);
          return (
            <div className={`text-left whitespace-nowrap text-xs md:text-[13px] ${getRatingColor(formatted)}`}>
              {formatted}
            </div>
          );
        },
      },
      {
        accessorKey: 'financialCashFlowHealth',
        header: () => (
          <div className="flex flex-col items-start justify-end text-xs font-semibold text-[#5B616E] dark:text-[#9CA3AF] leading-tight">
            {lang === 'th' ? (
              <>
                <span>เรตติ้งกระแส</span>
                <span className="flex items-center gap-0.5">
                  <span>เงินสด</span>
                  {proBadge}
                  <span className="text-[10px] text-[#A0A5AF]">▾</span>
                </span>
              </>
            ) : (
              <>
                <span>Cash Flow</span>
                <span className="flex items-center gap-0.5">
                  <span>Rating</span>
                  {proBadge}
                  <span className="text-[10px] text-[#A0A5AF]">▾</span>
                </span>
              </>
            )}
          </div>
        ),
        cell: ({ row }) => {
          const formatted = formatRating(row.original.financialCashFlowHealth);
          return (
            <div className={`text-left whitespace-nowrap text-xs md:text-[13px] ${getRatingColor(formatted)}`}>
              {formatted}
            </div>
          );
        },
      },
      {
        accessorKey: 'financialGrowthHealth',
        header: () => (
          <div className="flex flex-col items-start justify-end text-xs font-semibold text-[#5B616E] dark:text-[#9CA3AF] leading-tight">
            {lang === 'th' ? (
              <>
                <span>เรตติ้งการ</span>
                <span className="flex items-center gap-0.5">
                  <span>เติบโต</span>
                  {proBadge}
                  <span className="text-[10px] text-[#A0A5AF]">▾</span>
                </span>
              </>
            ) : (
              <>
                <span>Growth</span>
                <span className="flex items-center gap-0.5">
                  <span>Rating</span>
                  {proBadge}
                  <span className="text-[10px] text-[#A0A5AF]">▾</span>
                </span>
              </>
            )}
          </div>
        ),
        cell: ({ row }) => {
          const formatted = formatRating(row.original.financialGrowthHealth);
          return (
            <div className={`text-left whitespace-nowrap text-xs md:text-[13px] ${getRatingColor(formatted)}`}>
              {formatted}
            </div>
          );
        },
      },
      {
        accessorKey: 'financialProfitabilityHealth',
        header: () => (
          <div className="flex flex-col items-start justify-end text-xs font-semibold text-[#5B616E] dark:text-[#9CA3AF] leading-tight">
            {lang === 'th' ? (
              <>
                <span>เรตติ้งความ</span>
                <span>สามารถใน</span>
                <span className="flex items-center gap-0.5">
                  <span>การทำกำไร</span>
                  {proBadge}
                  <span className="text-[10px] text-[#A0A5AF]">▾</span>
                </span>
              </>
            ) : (
              <>
                <span>Profitability</span>
                <span className="flex items-center gap-0.5">
                  <span>Rating</span>
                  {proBadge}
                  <span className="text-[10px] text-[#A0A5AF]">▾</span>
                </span>
              </>
            )}
          </div>
        ),
        cell: ({ row }) => {
          const formatted = formatRating(row.original.financialProfitabilityHealth);
          return (
            <div className={`text-left whitespace-nowrap text-xs md:text-[13px] ${getRatingColor(formatted)}`}>
              {formatted}
            </div>
          );
        },
      },
      {
        accessorKey: 'analystRatings',
        header: () => (
          <div className="flex flex-col items-start justify-end text-xs font-semibold text-[#5B616E] dark:text-[#9CA3AF] leading-tight">
            {lang === 'th' ? (
              <>
                <span>เรตติ้งของ</span>
                <span className="flex items-center gap-0.5">
                  <span>นักวิเคราะห์</span>
                  <span className="text-[10px] text-[#A0A5AF]">▾</span>
                </span>
              </>
            ) : (
              <>
                <span>Analyst</span>
                <span className="flex items-center gap-0.5">
                  <span>Ratings</span>
                  <span className="text-[10px] text-[#A0A5AF]">▾</span>
                </span>
              </>
            )}
          </div>
        ),
        cell: ({ row }) => {
          const formatted = formatRating(row.original.analystRatings);
          return (
            <div className={`text-left whitespace-nowrap text-xs md:text-[13px] ${getRatingColor(formatted)}`}>
              {formatted}
            </div>
          );
        },
      },
      {
        accessorKey: 'peRatio',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex flex-col items-end justify-end font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6] w-full text-xs leading-tight"
          >
            {lang === 'th' ? (
              <>
                <span>อัตราส่วน</span>
                <span className="flex items-center gap-0.5">
                  <span>P/E</span>
                  <span className="text-[10px] text-[#A0A5AF]">▾</span>
                </span>
              </>
            ) : (
              <>
                <span>P/E</span>
                <span className="flex items-center gap-0.5">
                  <span>Ratio</span>
                  <span className="text-[10px] text-[#A0A5AF]">▾</span>
                </span>
              </>
            )}
          </button>
        ),
        cell: ({ row }) => {
          const pe = row.original.peRatio;
          return (
            <div className="text-right font-normal text-[#232526] dark:text-[#E5E7EB] tabular-nums text-xs md:text-[13px]">
              {pe !== null && pe !== undefined ? pe.toFixed(2) : ''}
            </div>
          );
        },
      },
      {
        accessorKey: 'evEbitda',
        header: () => (
          <div className="flex flex-col items-end justify-end text-xs font-semibold text-[#5B616E] dark:text-[#9CA3AF] leading-tight w-full">
            <span>EV/EBITDA</span>
          </div>
        ),
        cell: ({ row }) => {
          const ev = row.original.evEbitda;
          return (
            <div className="text-right font-normal text-[#232526] dark:text-[#E5E7EB] tabular-nums text-xs md:text-[13px]">
              {ev !== null && ev !== undefined ? ev.toFixed(2) : ''}
            </div>
          );
        },
      },
      {
        accessorKey: 'marketCap',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex flex-col items-end justify-end font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6] w-full text-xs leading-tight"
          >
            {lang === 'th' ? (
              <span className="flex items-center gap-0.5">
                <span>มูลค่าตลาด</span>
                <span className="text-[10px] text-[#A0A5AF]">▾</span>
              </span>
            ) : (
              <span className="flex items-center gap-0.5">
                <span>Market Cap</span>
                <span className="text-[10px] text-[#A0A5AF]">▾</span>
              </span>
            )}
          </button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-normal text-[#232526] dark:text-[#E5E7EB] whitespace-nowrap tabular-nums text-xs md:text-[13px]">
            {row.original.marketCapFormatted}
          </div>
        ),
      },
      {
        accessorKey: 'epsGrowth5y',
        header: () => (
          <div className="flex flex-col items-end justify-end text-xs font-semibold text-[#5B616E] dark:text-[#9CA3AF] leading-tight w-full">
            {lang === 'th' ? (
              <>
                <span>EPS Growth</span>
                <span>(5 ปี)</span>
              </>
            ) : (
              <>
                <span>EPS Growth</span>
                <span>(5y)</span>
              </>
            )}
          </div>
        ),
        cell: ({ row }) => {
          const val = row.original.epsGrowth5y;
          return (
            <div className="text-right font-normal text-[#232526] dark:text-[#E5E7EB] tabular-nums text-xs md:text-[13px]">
              {val !== null && val !== undefined ? val.toFixed(2) : ''}
            </div>
          );
        },
      },
    ],
    [t, lang, formatRating]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 30,
      },
    },
  });

  return (
    <div className="w-full bg-white dark:bg-[#161B26] border border-[#E4EAF1] dark:border-[#262C3A] rounded-lg overflow-hidden shadow-2xs font-sans transition-colors duration-200">
      {/* Search and Filters Bar */}
      <div className="px-4 py-2.5 border-b border-[#E4EAF1] dark:border-[#262C3A] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white dark:bg-[#161B26]">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-[#8A909D] dark:text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full bg-[#F8F9FA] dark:bg-[#1F2636] border border-[#D5DCE5] dark:border-[#2E3646] rounded pl-8 pr-3 py-1 text-xs text-[#232526] dark:text-[#E5E7EB] placeholder-[#8A909D] focus:outline-none focus:bg-white dark:focus:bg-[#181E2B] focus:border-[#1256A0] transition"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs text-[#5B616E] dark:text-[#9CA3AF]">
          <span>{t('showing')} <strong className="text-[#181C21] dark:text-white font-semibold">{filteredData.length}</strong> {t('stocks')}</span>
        </div>
      </div>

      {/* Main Table Content - Sized to Fit Block */}
      <div className="overflow-x-auto relative">
        <table className="w-full text-left text-xs md:text-[13px] border-collapse bg-white dark:bg-[#161B26]">
          <thead className="bg-[#F8F9FA] dark:bg-[#1B212F] border-b border-[#E4EAF1] dark:border-[#262C3A]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, idx) => {
                  const isFirst = idx === 0;
                  return (
                    <th
                      key={header.id}
                      className={`py-2 px-2.5 align-bottom font-semibold ${
                        isFirst
                          ? 'sticky left-0 bg-[#F8F9FA] dark:bg-[#1B212F] z-20 border-r border-[#E4EAF1] dark:border-[#262C3A] shadow-[2px_0_4px_rgba(0,0,0,0.02)]'
                          : ''
                      }`}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[#F0F2F5] dark:divide-[#222735]">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E2536] transition-colors group"
                >
                  {row.getVisibleCells().map((cell, idx) => {
                    const isFirst = idx === 0;
                    return (
                      <td
                        key={cell.id}
                        className={`py-2.5 px-3 whitespace-nowrap leading-none ${
                          isFirst
                            ? 'sticky left-0 bg-white dark:bg-[#161B26] group-hover:bg-[#F8FAFC] dark:group-hover:bg-[#1E2536] z-10 border-r border-[#E4EAF1] dark:border-[#262C3A] shadow-[2px_0_4px_rgba(0,0,0,0.02)]'
                            : ''
                        }`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-10 text-[#8A909D] dark:text-[#6B7280]"
                >
                  {t('noStocksFound')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="px-4 py-2.5 border-t border-[#E4EAF1] dark:border-[#262C3A] flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#161B26] text-xs text-[#5B616E] dark:text-[#9CA3AF]">
        <div className="flex items-center gap-2">
          <span>{t('rowsPerPage')}</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value));
            }}
            className="bg-[#F8F9FA] dark:bg-[#1F2636] border border-[#D5DCE5] dark:border-[#2E3646] text-[#232526] dark:text-[#E5E7EB] rounded px-2 py-0.5 text-xs focus:outline-none"
          >
            {[10, 15, 20, 30].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
          <span className="ml-2">
            {t('page')} {table.getState().pagination.pageIndex + 1} {t('of')}{' '}
            {table.getPageCount()}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1 rounded border border-[#D5DCE5] dark:border-[#2E3646] bg-white dark:bg-[#1F2636] text-[#232526] dark:text-[#E5E7EB] hover:bg-[#F1F4F8] dark:hover:bg-[#2A3346] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1 rounded border border-[#D5DCE5] dark:border-[#2E3646] bg-white dark:bg-[#1F2636] text-[#232526] dark:text-[#E5E7EB] hover:bg-[#F1F4F8] dark:hover:bg-[#2A3346] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
