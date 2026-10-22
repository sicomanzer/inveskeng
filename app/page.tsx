'use client';

import React, { useState, useEffect, useCallback } from 'react';
import StockTable from '@/components/StockTable';
import { US_STOCKS, THAI_STOCKS } from '@/data/undervalued-stocks';
import { THAI_OVERVALUED_STOCKS, US_OVERVALUED_STOCKS } from '@/data/overvalued-stocks';
import { MarketType, StockItem } from '@/types/stock';
import { useApp } from '@/context/AppContext';
import { 
  Flame, 
  Database, 
  Layers, 
  Cpu, 
  BadgePercent,
  ChevronRight,
  RefreshCw,
  Clock,
  TrendingDown
} from 'lucide-react';

export default function HomePage() {
  const { t, lang } = useApp();
  const [selectedMarket, setSelectedMarket] = useState<MarketType>('SET');
  const [activeTab, setActiveTab] = useState<'undervalued' | 'overvalued'>('undervalued');
  
  const [stocks, setStocks] = useState<StockItem[]>(
    selectedMarket === 'SET' ? THAI_STOCKS : US_STOCKS
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [tabCounts, setTabCounts] = useState<{ undervalued: number; overvalued: number }>({
    undervalued: 30,
    overvalued: selectedMarket === 'SET' ? 23 : 30
  });

  const isThai = selectedMarket === 'SET';

  // Load latest data from API
  const loadStocks = useCallback(async (market: MarketType, tab: 'undervalued' | 'overvalued') => {
    try {
      const res = await fetch(`/api/stocks?market=${market}&tab=${tab}&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.items && json.items.length > 0) {
          setStocks(json.items);
          setTabCounts(prev => ({
            ...prev,
            [tab]: json.items.length
          }));
        }
        if (json.syncStatus?.lastSync) {
          const d = new Date(json.syncStatus.lastSync);
          setLastSyncTime(
            d.toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
        }
      }
    } catch (err) {
      console.error('Failed to load stocks:', err);
    }
  }, [lang]);

  // Initial load and on market/tab change
  useEffect(() => {
    loadStocks(selectedMarket, activeTab);
  }, [selectedMarket, activeTab, loadStocks]);

  // Auto-sync polling every 15 minutes (900,000 ms)
  useEffect(() => {
    const interval = setInterval(() => {
      loadStocks(selectedMarket, activeTab);
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [selectedMarket, activeTab, loadStocks]);

  // Tab switch handler
  const handleTabChange = (newTab: 'undervalued' | 'overvalued') => {
    setActiveTab(newTab);
    if (newTab === 'overvalued') {
      const fallback = selectedMarket === 'SET' ? THAI_OVERVALUED_STOCKS : US_OVERVALUED_STOCKS;
      setStocks(fallback);
    } else {
      const fallback = selectedMarket === 'SET' ? THAI_STOCKS : US_STOCKS;
      setStocks(fallback);
    }
  };

  // Market switch handler
  const handleMarketChange = (newMarket: MarketType) => {
    setSelectedMarket(newMarket);
    if (activeTab === 'overvalued') {
      const fallback = newMarket === 'SET' ? THAI_OVERVALUED_STOCKS : US_OVERVALUED_STOCKS;
      setStocks(fallback);
      setTabCounts(prev => ({ ...prev, overvalued: newMarket === 'SET' ? 23 : 30 }));
    } else {
      const fallback = newMarket === 'SET' ? THAI_STOCKS : US_STOCKS;
      setStocks(fallback);
    }
  };

  // Manual Trigger Sync
  const handleTriggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncMessage(lang === 'th' ? 'กำลังส่งคำสั่งซิงค์ข้อมูลสด...' : 'Triggering live sync...');

    try {
      const res = await fetch(`/api/stocks/sync?market=${selectedMarket}&_t=${Date.now()}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        await loadStocks(selectedMarket, activeTab);
        setSyncMessage(data.message || (lang === 'th' ? 'ซิงค์สำเร็จ!' : 'Sync successful!'));
        setTimeout(() => setSyncMessage(''), 5000);
      } else {
        setSyncMessage(data.message || (lang === 'th' ? 'การซิงค์ขัดข้อง' : 'Sync error, please retry'));
        setTimeout(() => setSyncMessage(''), 6000);
      }
    } catch (err) {
      console.error('Manual sync failed:', err);
      setSyncMessage(lang === 'th' ? 'ไม่สามารถเชื่อมต่อได้' : 'Connection error');
      setTimeout(() => setSyncMessage(''), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Compute summary stats
  const avgUpside = (
    stocks.reduce((acc, s) => acc + s.fairValueUpside, 0) / (stocks.length || 1)
  ).toFixed(1);

  const topPick = stocks.length > 0
    ? stocks[0]
    : { symbol: '-', fairValueUpside: 0, name: '-' };

  const totalMarketCap = isThai
    ? `${(stocks.reduce((acc, s) => acc + (s.marketCap || 0), 0) / 1e9).toFixed(2)}B`
    : `${(stocks.reduce((acc, s) => acc + (s.marketCap || 0), 0) / 1e12).toFixed(2)}T`;

  const pageTitle = activeTab === 'overvalued'
    ? (isThai ? t('pageTitleThaiOvervalued') : t('pageTitleUSOvervalued'))
    : (isThai ? t('pageTitleThai') : t('pageTitleUS'));

  const pageSubtitle = activeTab === 'overvalued'
    ? (isThai ? t('pageDescThaiOvervalued') : t('pageDescUSOvervalued'))
    : (isThai ? t('pageDescThai') : t('pageDescUS'));

  const isOvervalued = activeTab === 'overvalued';

  return (
    <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 font-sans">
      {/* Top Status & Breadcrumbs Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-xs text-[#5B616E] dark:text-[#9CA3AF]">
          <span className="hover:text-[#1256A0] dark:hover:text-[#60A5FA] cursor-pointer">
            {t('markets')}
          </span>
          <ChevronRight className="w-3 h-3 text-[#A0A5AF] dark:text-[#6B7280]" />
          <span className="hover:text-[#1256A0] dark:hover:text-[#60A5FA] cursor-pointer">
            {t('equities')}
          </span>
          <ChevronRight className="w-3 h-3 text-[#A0A5AF] dark:text-[#6B7280]" />
          <span className="text-[#181C21] dark:text-[#F3F4F6] font-medium">
            {pageTitle}
          </span>
        </nav>

        {/* Live Sync Status Indicator & Manual Button */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {syncMessage ? (
            <span className="text-xs font-semibold text-[#1256A0] dark:text-[#60A5FA] bg-[#EBF3FC] dark:bg-[#1B2942] px-2.5 py-1 rounded border border-[#C6DCF7] dark:border-[#2C4166] animate-pulse">
              {syncMessage}
            </span>
          ) : (
            <div className="flex items-center gap-2 text-xs text-[#5B616E] dark:text-[#9CA3AF]">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#007C32] dark:text-[#00C076] bg-[#EBF6EE] dark:bg-[#132A1E] px-2 py-0.5 rounded-full border border-[#C6E7CE] dark:border-[#1E4D33]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#007C32] dark:bg-[#00C076] animate-ping" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#007C32] dark:bg-[#00C076]" />
                {t('liveSync')}
              </span>
              {lastSyncTime && (
                <span className="hidden md:flex items-center gap-1 text-[11px]">
                  <Clock className="w-3 h-3 text-[#A0A5AF] dark:text-[#6B7280]" />
                  <span>{t('lastSynced')} {lastSyncTime}</span>
                </span>
              )}
            </div>
          )}

          {/* Sync Now Button */}
          <button
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md border border-[#D5DCE5] dark:border-[#2E3646] bg-white dark:bg-[#1B212F] text-[#1256A0] dark:text-[#60A5FA] hover:bg-[#F1F4F8] dark:hover:bg-[#252E3E] disabled:opacity-50 transition shadow-xs cursor-pointer"
            title={t('autoSyncNotice')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#1256A0]' : ''}`} />
            <span>{isSyncing ? t('syncing') : t('syncNow')}</span>
          </button>
        </div>
      </div>

      {/* Main Title & Market Selector */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-3">
        <div>
          <h1 className="text-2xl md:text-[28px] font-bold text-[#181C21] dark:text-white tracking-tight">
            {pageTitle}
          </h1>
          <p className="mt-1 text-xs md:text-sm text-[#5B616E] dark:text-[#9CA3AF] max-w-3xl leading-relaxed">
            {pageSubtitle}
          </p>
        </div>

        {/* Market Switcher */}
        <div className="flex items-center gap-1.5 self-start md:self-auto bg-white dark:bg-[#161B26] p-1 rounded-lg border border-[#D5DCE5] dark:border-[#262C3A] shadow-xs">
          <button
            onClick={() => handleMarketChange('SET')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition cursor-pointer ${
              isThai 
                ? 'bg-[#1256A0] text-white shadow-xs font-bold' 
                : 'text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#181C21] dark:hover:text-white'
            }`}
          >
            <span>{t('thailandSET')}</span>
          </button>
          <button
            onClick={() => handleMarketChange('US')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition cursor-pointer ${
              !isThai 
                ? 'bg-[#1256A0] text-white shadow-xs font-bold' 
                : 'text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#181C21] dark:hover:text-white'
            }`}
          >
            <span>{t('unitedStatesUS')}</span>
          </button>
        </div>
      </div>

      {/* Screener Tabs matching Investing.com */}
      <div className="flex items-center gap-8 border-b border-[#E4EAF1] dark:border-[#262C3A] mt-2 mb-5 text-sm transition-colors duration-200">
        <button
          onClick={() => handleTabChange('undervalued')}
          className={`pb-2.5 relative transition font-semibold flex items-center gap-2 cursor-pointer ${
            activeTab === 'undervalued'
              ? 'text-[#181C21] dark:text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#1256A0] dark:after:bg-[#3B82F6]'
              : 'text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#181C21] dark:hover:text-white'
          }`}
        >
          <span>{t('undervalued')}</span>
          <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-[#EBF3FC] dark:bg-[#1E2D4A] text-[#1256A0] dark:text-[#60A5FA] font-bold">
            {tabCounts.undervalued}
          </span>
        </button>
        <button
          onClick={() => handleTabChange('overvalued')}
          className={`pb-2.5 relative transition font-semibold flex items-center gap-2 cursor-pointer ${
            activeTab === 'overvalued'
              ? 'text-[#181C21] dark:text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#1256A0] dark:after:bg-[#3B82F6]'
              : 'text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#181C21] dark:hover:text-white'
          }`}
        >
          <span>{t('overvalued')}</span>
          <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
            activeTab === 'overvalued'
              ? 'bg-[#FEE4E2] dark:bg-[#3E1F24] text-[#D92D20] dark:text-[#F87171]'
              : 'bg-[#F3F4F6] dark:bg-[#202636] text-[#6B7280] dark:text-[#9CA3AF]'
          }`}>
            {tabCounts.overvalued}
          </span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {/* Card 1: Top Pick */}
        <div className="bg-white dark:bg-[#161B26] border border-[#E4EAF1] dark:border-[#262C3A] rounded-lg p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-200">
          <div className="text-[11px] font-semibold text-[#5B616E] dark:text-[#9CA3AF] mb-1 flex items-center justify-between">
            <span>{isOvervalued ? t('topOvervalued') : t('topUndervalued')}</span>
            {isOvervalued ? (
              <TrendingDown className="w-3.5 h-3.5 text-[#D92D20] dark:text-[#F87171]" />
            ) : (
              <Flame className="w-3.5 h-3.5 text-[#F07504]" />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-[#181C21] dark:text-white">{topPick.symbol}</span>
            <span className={`font-bold text-sm ${
              isOvervalued ? 'text-[#D92D20] dark:text-[#F87171]' : 'text-[#007C32] dark:text-[#00C076]'
            }`}>
              {isOvervalued ? `${topPick.fairValueUpside}%` : `+${topPick.fairValueUpside}%`}
            </span>
          </div>
          <div className="text-[11px] text-[#5B616E] dark:text-[#9CA3AF] truncate mt-0.5">
            {topPick.name}
          </div>
        </div>

        {/* Card 2: Avg Upside / Downside */}
        <div className="bg-white dark:bg-[#161B26] border border-[#E4EAF1] dark:border-[#262C3A] rounded-lg p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-200">
          <div className="text-[11px] font-semibold text-[#5B616E] dark:text-[#9CA3AF] mb-1 flex items-center justify-between">
            <span>{isOvervalued ? t('avgDownside') : t('avgUpside')}</span>
            <BadgePercent className={`w-3.5 h-3.5 ${isOvervalued ? 'text-[#D92D20] dark:text-[#F87171]' : 'text-[#007C32] dark:text-[#00C076]'}`} />
          </div>
          <div className={`text-xl font-bold ${isOvervalued ? 'text-[#D92D20] dark:text-[#F87171]' : 'text-[#007C32] dark:text-[#00C076]'}`}>
            {isOvervalued ? `${avgUpside}%` : `+${avgUpside}%`}
          </div>
          <div className="text-[11px] text-[#5B616E] dark:text-[#9CA3AF] mt-0.5">
            {isOvervalued ? t('acrossRanked') : t('across30')}
          </div>
        </div>

        {/* Card 3: Total Market Cap */}
        <div className="bg-white dark:bg-[#161B26] border border-[#E4EAF1] dark:border-[#262C3A] rounded-lg p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-200">
          <div className="text-[11px] font-semibold text-[#5B616E] dark:text-[#9CA3AF] mb-1 flex items-center justify-between">
            <span>{t('totalMarketCap')}</span>
            <Database className="w-3.5 h-3.5 text-[#1256A0] dark:text-[#60A5FA]" />
          </div>
          <div className="text-xl font-bold text-[#181C21] dark:text-white">{totalMarketCap}</div>
          <div className="text-[11px] text-[#5B616E] dark:text-[#9CA3AF] mt-0.5">
            {t('totalAnalyzedSize')}
          </div>
        </div>

        {/* Card 4: Valuation Engine */}
        <div className="bg-white dark:bg-[#161B26] border border-[#E4EAF1] dark:border-[#262C3A] rounded-lg p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-200">
          <div className="text-[11px] font-semibold text-[#5B616E] dark:text-[#9CA3AF] mb-1 flex items-center justify-between">
            <span>{t('valuationEngine')}</span>
            <Cpu className="w-3.5 h-3.5 text-[#6B46C1] dark:text-[#A78BFA]" />
          </div>
          <div className="text-sm font-bold text-[#181C21] dark:text-white truncate">
            {t('finboxModels')}
          </div>
          <div className="text-[11px] text-[#5B616E] dark:text-[#9CA3AF] mt-0.5">
            {t('dcfMultiples')}
          </div>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="mb-10">
        <StockTable 
          key={`${selectedMarket}-${activeTab}-${stocks[0]?.symbol}-${stocks[0]?.price}-${stocks.length}-${lang}`}
          initialData={stocks} 
          market={selectedMarket} 
          valuationType={activeTab}
        />
      </div>

      {/* REA Technical Architecture Box */}
      <div className="bg-white dark:bg-[#161B26] border border-[#E4EAF1] dark:border-[#262C3A] rounded-lg p-4 md:p-5 text-xs text-[#5B616E] dark:text-[#9CA3AF] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-200">
        <div className="flex items-center gap-2 text-xs font-bold text-[#181C21] dark:text-white mb-2">
          <Layers className="w-4 h-4 text-[#1256A0] dark:text-[#60A5FA]" />
          <span>REA Reverse Engineering Grounding:</span>
        </div>
        <p className="leading-relaxed mb-2.5">
          {lang === 'th' ? (
            <>
              โครงสร้างตารางนี้ได้รับการออกแบบและจำลองข้อมูลโดยตรงจาก{' '}
              <a
                href={isOvervalued ? "https://th.investing.com/equities/thailand/most-overvalued" : "https://th.investing.com/equities/thailand/most-undervalued"}
                target="_blank"
                rel="noreferrer"
                className="text-[#1256A0] underline"
              >
                {isOvervalued ? "th.investing.com/equities/thailand/most-overvalued" : "th.investing.com/equities/thailand/most-undervalued"}
              </a>{' '}
              โดยคอลัมน์ ({isOvervalued ? 'ขาลง' : 'ขาขึ้น'} / Fair Value) และคำศัพท์เรตติ้ง (ดีเยี่ยม, ดีมาก, ดี, มูลค่าตามจริง, แย่, ซื้อทันที, ซื้อ, ถือหุ้นไว้) ถูกถอดแบบตรงตามภาพต้นฉบับ 100%
            </>
          ) : (
            <>
              This table styling, cell spacing, typography (<code className="text-[#1256A0] font-mono">Inter</code>), and column contracts directly mirror{' '}
              <a
                href={isOvervalued ? "https://www.investing.com/equities/thailand/most-overvalued" : "https://www.investing.com/equities/thailand/most-undervalued"}
                target="_blank"
                rel="noreferrer"
                className="text-[#1256A0] underline"
              >
                {isOvervalued ? "investing.com/equities/thailand/most-overvalued" : "investing.com/equities/thailand/most-undervalued"}
              </a>
              . All labels, table columns, ratings, and number formats are 100% matched to the original source.
            </>
          )}
        </p>
      </div>
    </main>
  );
}
