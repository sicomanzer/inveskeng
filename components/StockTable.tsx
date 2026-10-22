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
  ChevronRight,
} from 'lucide-react';

interface StockTableProps {
  initialData: StockItem[];
  market: MarketType;
}

export default function StockTable({ initialData, market }: StockTableProps) {
  const { lang } = useApp();
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

  const columns = useMemo<ColumnDef<StockItem>[]>(
    () => [
      {
        accessorKey: 'symbol',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6] transition text-xs"
          >
            Name
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-[#1256A0] dark:text-[#60A5FA]" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3 text-[#1256A0] dark:text-[#60A5FA]" />
            ) : (
              <ArrowUpDown className="w-3 h-3 text-[#A0A5AF] dark:text-[#6B7280] opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-2 py-0.5 min-w-[170px] max-w-[220px]">
              <span className="font-bold text-[#181C21] dark:text-[#F3F4F6] text-sm tracking-tight hover:text-[#1256A0] dark:hover:text-[#60A5FA] cursor-pointer">
                {item.symbol}
              </span>
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                title={item.name}
                className="text-xs text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#1256A0] dark:hover:text-[#60A5FA] truncate max-w-[130px] inline-block font-normal transition"
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
            Price
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-[#1256A0] dark:text-[#60A5FA]" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3 text-[#1256A0] dark:text-[#60A5FA]" />
            ) : (
              <ArrowUpDown className="w-3 h-3 text-[#A0A5AF] dark:text-[#6B7280] opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-normal text-[#232526] dark:text-[#E5E7EB] tabular-nums">
            {row.original.price.toFixed(2)}
          </div>
        ),
      },
      {
        accessorKey: 'fairValueUpside',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6] justify-end w-full text-xs whitespace-nowrap"
          >
            Upside
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-[#1256A0] dark:text-[#60A5FA]" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3 text-[#1256A0] dark:text-[#60A5FA]" />
            ) : (
              <ArrowUpDown className="w-3 h-3 text-[#A0A5AF] dark:text-[#6B7280] opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const val = row.original.fairValueUpside;
          return (
            <div className="text-right font-bold text-[#007C32] dark:text-[#00C076] whitespace-nowrap tabular-nums">
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
            className="flex items-center gap-1 font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6] justify-end w-full text-xs whitespace-nowrap"
          >
            Fair Value
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-[#1256A0] dark:text-[#60A5FA]" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3 text-[#1256A0] dark:text-[#60A5FA]" />
            ) : (
              <ArrowUpDown className="w-3 h-3 text-[#A0A5AF] dark:text-[#6B7280] opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-normal text-[#232526] dark:text-[#E5E7EB] tabular-nums">
            {row.original.fairValue ? row.original.fairValue.toFixed(2) : '-'}
          </div>
        ),
      },
      {
        accessorKey: 'financialHealth',
        header: () => (
          <div className="text-left whitespace-nowrap text-xs font-semibold text-[#5B616E] dark:text-[#9CA3AF]">
            Financial Health
          </div>
        ),
        cell: ({ row }) => {
          const text = row.original.financialHealth || '-';
          return (
            <div className={`text-left whitespace-nowrap ${getRatingColor(text)}`}>
              {text}
            </div>
          );
        },
      },
      {
        accessorKey: 'financialCashFlowHealth',
        header: () => (
          <div className="text-left whitespace-nowrap text-xs font-semibold text-[#5B616E] dark:text-[#9CA3AF]">
            Cash Flow Rating
          </div>
        ),
        cell: ({ row }) => {
          const text = row.original.financialCashFlowHealth || '-';
          return (
            <div className={`text-left whitespace-nowrap ${getRatingColor(text)}`}>
              {text}
            </div>
          );
        },
      },
      {
        accessorKey: 'financialGrowthHealth',
        header: () => (
          <div className="text-left whitespace-nowrap text-xs font-semibold text-[#5B616E] dark:text-[#9CA3AF]">
            Growth Rating
          </div>
        ),
        cell: ({ row }) => {
          const text = row.original.financialGrowthHealth || '-';
          return (
            <div className={`text-left whitespace-nowrap ${getRatingColor(text)}`}>
              {text}
            </div>
          );
        },
      },
      {
        accessorKey: 'financialProfitabilityHealth',
        header: () => (
          <div className="text-left whitespace-nowrap text-xs font-semibold text-[#5B616E] dark:text-[#9CA3AF]">
            Profitability Rating
          </div>
        ),
        cell: ({ row }) => {
          const text = row.original.financialProfitabilityHealth || '-';
          return (
            <div className={`text-left whitespace-nowrap ${getRatingColor(text)}`}>
              {text}
            </div>
          );
        },
      },
      {
        accessorKey: 'analystRatings',
        header: () => (
          <div className="text-left whitespace-nowrap text-xs font-semibold text-[#5B616E] dark:text-[#9CA3AF]">
            Analyst Ratings
          </div>
        ),
        cell: ({ row }) => {
          const text = row.original.analystRatings || '-';
          return (
            <div className={`text-left whitespace-nowrap ${getRatingColor(text)}`}>
              {text}
            </div>
          );
        },
      },
      {
        accessorKey: 'peRatio',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6] justify-end w-full text-xs whitespace-nowrap"
          >
            P/E Ratio
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-[#1256A0] dark:text-[#60A5FA]" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3 text-[#1256A0] dark:text-[#60A5FA]" />
            ) : (
              <ArrowUpDown className="w-3 h-3 text-[#A0A5AF] dark:text-[#6B7280] opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const pe = row.original.peRatio;
          return (
            <div className="text-right font-normal text-[#232526] dark:text-[#E5E7EB] tabular-nums">
              {pe !== null && pe !== undefined ? pe.toFixed(2) : ''}
            </div>
          );
        },
      },
      {
        accessorKey: 'evEbitda',
        header: () => (
          <div className="text-right whitespace-nowrap text-xs font-semibold text-[#5B616E] dark:text-[#9CA3AF]">
            EV/EBIDTA
          </div>
        ),
        cell: ({ row }) => {
          const ev = row.original.evEbitda;
          return (
            <div className="text-right font-normal text-[#232526] dark:text-[#E5E7EB] tabular-nums">
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
            className="flex items-center gap-1 font-semibold text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#232526] dark:hover:text-[#F3F4F6] justify-end w-full text-xs whitespace-nowrap"
          >
            Market Cap
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-[#1256A0] dark:text-[#60A5FA]" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3 text-[#1256A0] dark:text-[#60A5FA]" />
            ) : (
              <ArrowUpDown className="w-3 h-3 text-[#A0A5AF] dark:text-[#6B7280] opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-normal text-[#232526] dark:text-[#E5E7EB] whitespace-nowrap tabular-nums">
            {row.original.marketCapFormatted}
          </div>
        ),
      },
      {
        accessorKey: 'epsGrowth5y',
        header: () => (
          <div className="text-right whitespace-nowrap text-xs font-semibold text-[#5B616E] dark:text-[#9CA3AF]">
            EPS Growth (5y)
          </div>
        ),
        cell: ({ row }) => {
          const val = row.original.epsGrowth5y;
          return (
            <div className="text-right font-normal text-[#232526] dark:text-[#E5E7EB] tabular-nums">
              {val !== null && val !== undefined ? val.toFixed(2) : ''}
            </div>
          );
        },
      },
    ],
    []
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
    <div className="w-full bg-white dark:bg-[#161B26] border border-[#E4EAF1] dark:border-[#262C3A] rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)] font-sans transition-colors duration-200">
      {/* Control Toolbar */}
      <div className="px-5 py-3.5 border-b border-[#E4EAF1] dark:border-[#262C3A] flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-[#161B26] transition-colors duration-200">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-80">
            <Search className="w-4 h-4 text-[#8A909D] dark:text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search by symbol or company name..."
              className="w-full bg-[#F8F9FA] dark:bg-[#1F2636] border border-[#D5DCE5] dark:border-[#2E3646] rounded-md pl-9 pr-3.5 py-1.5 text-xs text-[#232526] dark:text-[#E5E7EB] placeholder-[#8A909D] dark:placeholder-[#6B7280] focus:outline-none focus:bg-white dark:focus:bg-[#181E2B] focus:border-[#1256A0] dark:focus:border-[#3B82F6] transition"
            />
          </div>

          {/* Health Filter Chips */}
          <div className="flex items-center gap-1 bg-[#F1F4F8] dark:bg-[#121620] p-1 rounded-md border border-[#E4EAF1] dark:border-[#262C3A] text-xs">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'GREAT', label: 'Great' },
              { id: 'GOOD', label: 'Good' },
              { id: 'FAIR', label: 'Fair' },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => setHealthFilter(chip.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition ${
                  healthFilter === chip.id
                    ? 'bg-white dark:bg-[#2A3346] text-[#1256A0] dark:text-[#60A5FA] shadow-xs font-bold'
                    : 'text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#181C21] dark:hover:text-[#F3F4F6]'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3 text-xs text-[#5B616E] dark:text-[#9CA3AF]">
          <span className="font-normal">
            Showing <strong className="text-[#181C21] dark:text-[#F3F4F6] font-semibold">{filteredData.length}</strong> stocks
          </span>
        </div>
      </div>

      {/* Table Layout */}
      <div className="overflow-x-auto relative">
        <table className="w-full text-left text-xs md:text-[13px] border-collapse bg-white dark:bg-[#161B26]">
          <thead className="bg-[#F8F9FA] dark:bg-[#1B212F] border-b border-[#E4EAF1] dark:border-[#262C3A] transition-colors duration-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, idx) => {
                  const isFirst = idx === 0;
                  const isPriceOrUpsideOrFv = idx >= 1 && idx <= 3;
                  return (
                    <th
                      key={header.id}
                      className={`py-2.5 whitespace-nowrap font-semibold ${
                        isFirst
                          ? 'sticky left-0 bg-[#F8F9FA] dark:bg-[#1B212F] z-20 px-4 border-r border-[#E4EAF1] dark:border-[#262C3A] shadow-[2px_0_4px_rgba(0,0,0,0.03)] dark:shadow-[2px_0_4px_rgba(0,0,0,0.25)]'
                          : isPriceOrUpsideOrFv
                          ? 'px-4'
                          : 'px-5'
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
          <tbody className="divide-y divide-[#F0F2F5] dark:divide-[#222735] transition-colors duration-200">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-[#F8FAFC] dark:hover:bg-[#1F2636] transition-colors group"
                >
                  {row.getVisibleCells().map((cell, idx) => {
                    const isFirst = idx === 0;
                    const isPriceOrUpsideOrFv = idx >= 1 && idx <= 3;
                    return (
                      <td
                        key={cell.id}
                        className={`py-3 whitespace-nowrap leading-none ${
                          isFirst
                            ? 'sticky left-0 bg-white dark:bg-[#161B26] group-hover:bg-[#F8FAFC] dark:group-hover:bg-[#1F2636] z-10 px-4 border-r border-[#E4EAF1] dark:border-[#262C3A] shadow-[2px_0_4px_rgba(0,0,0,0.03)] dark:shadow-[2px_0_4px_rgba(0,0,0,0.25)]'
                            : isPriceOrUpsideOrFv
                            ? 'px-4'
                            : 'px-5'
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
                  No stocks match the filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="px-5 py-3 border-t border-[#E4EAF1] dark:border-[#262C3A] flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#161B26] text-xs text-[#5B616E] dark:text-[#9CA3AF] transition-colors duration-200">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value));
            }}
            className="bg-[#F8F9FA] dark:bg-[#1F2636] border border-[#D5DCE5] dark:border-[#2E3646] text-[#232526] dark:text-[#E5E7EB] rounded px-2 py-1 text-xs focus:outline-none"
          >
            {[10, 15, 20, 30].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
          <span className="ml-2">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded border border-[#D5DCE5] dark:border-[#2E3646] bg-white dark:bg-[#1F2636] text-[#232526] dark:text-[#E5E7EB] hover:bg-[#F1F4F8] dark:hover:bg-[#2A3346] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded border border-[#D5DCE5] dark:border-[#2E3646] bg-white dark:bg-[#1F2636] text-[#232526] dark:text-[#E5E7EB] hover:bg-[#F1F4F8] dark:hover:bg-[#2A3346] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
