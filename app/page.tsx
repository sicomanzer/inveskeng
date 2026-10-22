'use client';

import React, { useState, useEffect, useCallback } from 'react';
import StockTable from '@/components/StockTable';
import { US_STOCKS, THAI_STOCKS } from '@/data/undervalued-stocks';
import { MarketType, StockItem } from '@/types/stock';
import { useApp } from '@/context/AppContext';
import { 
  Info,
  ChevronDown,
  RefreshCw,
  Clock,
  Layers
} from 'lucide-react';

export default function HomePage() {
  const { t, lang } = useApp();
  const [selectedMarket, setSelectedMarket] = useState<MarketType>('SET');
  const [activeTab, setActiveTab] = useState<string>('undervalued');
  const [stocks, setStocks] = useState<StockItem[]>(
    selectedMarket === 'SET' ? THAI_STOCKS : US_STOCKS
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);

  const isThai = selectedMarket === 'SET';

  // Load latest data from API
  const loadStocks = useCallback(async (market: MarketType) => {
    try {
      const res = await fetch(`/api/stocks?market=${market}&_t=${Date.now()}`, {
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

  // Initial load and on market change
  useEffect(() => {
    loadStocks(selectedMarket);
  }, [selectedMarket, loadStocks]);

  // Auto-sync polling every 15 minutes (900,000 ms)
  useEffect(() => {
    const interval = setInterval(() => {
      loadStocks(selectedMarket);
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [selectedMarket, loadStocks]);

  // Manual Trigger Sync
  const handleTriggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncMessage(lang === 'th' ? 'กำลังดึงข้อมูลสดจาก Investing.com...' : 'Syncing live data from Investing.com...');

    try {
      const res = await fetch(`/api/stocks/sync?market=${selectedMarket}&_t=${Date.now()}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        await loadStocks(selectedMarket);
        setSyncMessage(
          lang === 'th' 
            ? `ซิงค์สำเร็จ! ข้อมูลอัปเดตแล้ว` 
            : `Sync successful! ${data.market} updated`
        );
        setTimeout(() => setSyncMessage(''), 4000);
      } else {
        setSyncMessage(lang === 'th' ? 'การซิงค์ขัดข้อง' : 'Sync error');
        setTimeout(() => setSyncMessage(''), 4000);
      }
    } catch (err) {
      console.error('Manual sync failed:', err);
      setSyncMessage('Error');
      setTimeout(() => setSyncMessage(''), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const pageTitle = isThai ? t('pageTitleThai') : t('pageTitleUS');

  // Screener Tabs matching screenshot
  const screenerTabs = [
    { id: 'undervalued', label: t('tabUndervalued') },
    { id: 'overvalued', label: t('tabOvervalued') },
    { id: '52w_high', label: t('tab52wHigh') },
    { id: '52w_low', label: t('tab52wLow') },
    { id: 'most_active', label: t('tabMostActive') },
    { id: 'top_gainers', label: t('tabTopGainers') },
    { id: 'top_losers', label: t('tabTopLosers') },
  ];

  return (
    <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-6 font-sans">
      {/* Top Header: Title with Info Icon + Live Sync button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl md:text-2xl font-bold text-[#181C21] dark:text-white tracking-tight">
            {pageTitle}
          </h1>
          <button 
            type="button" 
            title="InvestingPro Fair Value Model Overview"
            className="text-[#9CA3AF] hover:text-[#5B616E] dark:hover:text-white transition"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        {/* Live Sync Status & Manual Trigger */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {syncMessage ? (
            <span className="text-xs font-semibold text-[#1256A0] dark:text-[#60A5FA] bg-[#EBF3FC] dark:bg-[#1B2942] px-2 py-0.5 rounded border border-[#C6DCF7] dark:border-[#2C4166] animate-pulse">
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

          <button
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-[#D5DCE5] dark:border-[#2E3646] bg-white dark:bg-[#1B212F] text-[#1256A0] dark:text-[#60A5FA] hover:bg-[#F1F4F8] dark:hover:bg-[#252E3E] disabled:opacity-50 transition shadow-2xs"
            title={t('autoSyncNotice')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#1256A0]' : ''}`} />
            <span>{isSyncing ? t('syncing') : t('syncNow')}</span>
          </button>
        </div>
      </div>

      {/* Country Dropdown Selector (Exact match to screenshot) */}
      <div className="relative mb-4 inline-block">
        <button
          onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
          className="flex items-center justify-between gap-3 w-44 px-3 py-1.5 bg-white dark:bg-[#161B26] border border-[#D5DCE5] dark:border-[#262C3A] rounded shadow-2xs text-xs font-semibold text-[#181C21] dark:text-white hover:border-[#1256A0] transition"
        >
          <div className="flex items-center gap-2">
            <span>{isThai ? '🇹🇭' : '🇺🇸'}</span>
            <span>{isThai ? t('thailandSET') : t('unitedStatesUS')}</span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-[#5B616E] dark:text-[#9CA3AF]" />
        </button>

        {countryDropdownOpen && (
          <div className="absolute left-0 top-full mt-1 w-44 bg-white dark:bg-[#161B26] border border-[#D5DCE5] dark:border-[#262C3A] rounded shadow-md z-40 py-1 text-xs">
            <button
              onClick={() => {
                setSelectedMarket('SET');
                setCountryDropdownOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#F1F4F8] dark:hover:bg-[#202738] text-left transition ${
                isThai ? 'font-bold text-[#1256A0] dark:text-[#60A5FA]' : 'text-[#181C21] dark:text-white'
              }`}
            >
              <span>🇹🇭</span>
              <span>{t('thailandSET')}</span>
            </button>
            <button
              onClick={() => {
                setSelectedMarket('US');
                setCountryDropdownOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#F1F4F8] dark:hover:bg-[#202738] text-left transition ${
                !isThai ? 'font-bold text-[#1256A0] dark:text-[#60A5FA]' : 'text-[#181C21] dark:text-white'
              }`}
            >
              <span>🇺🇸</span>
              <span>{t('unitedStatesUS')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Screener Tabs Bar (Exact match to screenshot) */}
      <div className="flex items-center gap-5 md:gap-7 border-b border-[#E4EAF1] dark:border-[#262C3A] mb-4 text-xs md:text-sm font-semibold overflow-x-auto whitespace-nowrap scrollbar-none">
        {screenerTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 relative transition ${
                isActive
                  ? 'text-[#1256A0] dark:text-[#60A5FA] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#1256A0] dark:after:bg-[#60A5FA]'
                  : 'text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#181C21] dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Table Container - Perfectly Proportioned */}
      <div className="mb-8">
        <StockTable 
          key={`${selectedMarket}-${stocks[0]?.symbol}-${stocks[0]?.price}-${stocks[1]?.symbol}-${stocks[2]?.symbol}-${stocks.length}-${lang}`}
          initialData={stocks} 
          market={selectedMarket} 
        />
      </div>

      {/* REA Grounding Footer Note */}
      <div className="bg-white dark:bg-[#161B26] border border-[#E4EAF1] dark:border-[#262C3A] rounded-lg p-3 md:p-4 text-xs text-[#5B616E] dark:text-[#9CA3AF] shadow-2xs">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#181C21] dark:text-white mb-1">
          <Layers className="w-3.5 h-3.5 text-[#1256A0] dark:text-[#60A5FA]" />
          <span>REA Reverse Engineering Grounding:</span>
        </div>
        <p className="leading-relaxed">
          {lang === 'th' ? (
            <>
              ตารางนี้จำลองโครงสร้าง ขอบเขตคอลัมน์ ระยะห่าง และคำศัพท์เรตติ้งตรงตาม{' '}
              <a
                href="https://th.investing.com/equities/thailand/most-undervalued"
                target="_blank"
                rel="noreferrer"
                className="text-[#1256A0] underline"
              >
                th.investing.com/equities/thailand/most-undervalued
              </a>{' '}
              ทุกประการ ข้อมูลถูก Unmask และอัปเดตแบบเรียลไทม์ผ่าน API ของ Investing.com
            </>
          ) : (
            <>
              This layout directly mirrors{' '}
              <a
                href="https://www.investing.com/equities/thailand/most-undervalued"
                target="_blank"
                rel="noreferrer"
                className="text-[#1256A0] underline"
              >
                investing.com/equities/thailand/most-undervalued
              </a>
              . All column sizes, headers, and rating terms are fitted to the container block.
            </>
          )}
        </p>
      </div>
    </main>
  );
}
