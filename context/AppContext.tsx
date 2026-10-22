'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { formatRatingText } from '@/types/stock';

export type Language = 'th' | 'en';
export type Theme = 'light' | 'dark';

export interface AppContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  t: (key: string) => string;
  formatRating: (val?: string | null) => string;
}

export const translations: Record<Language, Record<string, string>> = {
  th: {
    // Nav & Titles
    markets: 'ตลาด',
    equities: 'ตราสารทุน',
    pageTitleThai: 'หุ้น Undervalued ในประเทศ ไทย',
    pageTitleUS: 'หุ้น Undervalued ในประเทศ สหรัฐอเมริกา',
    pageDescThai:
      "ค้นพบหุ้น Undervalued ชั้นนำในประเทศไทยตามการประมาณการมูลค่ายุติธรรมของ InvestingPro รายการนี้มีการปรับปรุงข้อมูลแบบไดนามิกและอัปเดตตลอดเวลา โดยแสดงราคาปัจจุบัน ขาขึ้น (Upside) และสุขภาพทางการเงิน",
    pageDescUS:
      "ค้นพบหุ้น Undervalued ชั้นนำในสหรัฐอเมริกาตามการประมาณการมูลค่ายุติธรรมของ InvestingPro รายการนี้มีการปรับปรุงข้อมูลแบบไดนามิกและอัปเดตตลอดเวลา",
    // Country Selector
    thailandSET: 'ไทย',
    unitedStatesUS: 'สหรัฐอเมริกา',
    // Screener Tabs (matching user screenshot)
    tabUndervalued: 'หุ้นราคาถูกที่สุด',
    tabOvervalued: 'หุ้นราคาแพงที่สุด',
    tab52wHigh: 'สูงสุดใน 52 สัปดาห์',
    tab52wLow: 'ต่ำสุดใน 52 สัปดาห์',
    tabMostActive: 'เคลื่อนไหวมากสุด',
    tabTopGainers: 'Top Gainers',
    tabTopLosers: 'Top Losers',
    // Table Toolbar
    searchPlaceholder: 'ค้นหาด้วยชื่อย่อหุ้น หรือชื่อบริษัท...',
    all: 'ทั้งหมด',
    great: 'ดีมาก',
    good: 'ดี',
    fair: 'มูลค่าตามจริง',
    showing: 'แสดงทั้งหมด',
    stocks: 'รายการ',
    // Columns - EXACT MATCH TO USER SCREENSHOT
    colName: 'ชื่อ',
    colPrice: 'ราคา',
    colUpside: 'ขาขึ้น (upside)',
    colFairValue: 'มูลค่ายุติธรรม',
    colHealth: 'สุขภาพทางการเงิน',
    colCashFlow: 'เรตติ้งกระแสเงินสด',
    colGrowth: 'เรตติ้งการเติบโต',
    colProfitability: 'เรตติ้งความสามารถในการทำกำไร',
    colAnalyst: 'เรตติ้งของนักวิเคราะห์',
    colPe: 'อัตราส่วน P/E',
    colEvEbitda: 'EV/EBITDA',
    colMarketCap: 'มูลค่าตลาด',
    colEpsGrowth: 'EPS Growth (5 ปี)',
    // Pagination & empty
    rowsPerPage: 'แถวต่อหน้า:',
    page: 'หน้า',
    of: 'จาก',
    noStocksFound: 'ไม่พบข้อมูลหุ้นตามเงื่อนไขการค้นหา',
    // Live Sync
    syncNow: 'ซิงค์ข้อมูลสด',
    syncing: 'กำลังซิงค์...',
    liveSync: 'ระบบซิงค์สดอัตโนมัติ',
    lastSynced: 'อัปเดตล่าสุด:',
    autoSyncNotice: 'อัปเดตอัตโนมัติทุก 15 นาทีตาม Investing.com',
    themeLight: 'โหมดสว่าง',
    themeDark: 'โหมดมืด',
    langToggle: 'English',
  },
  en: {
    // Nav & Titles
    markets: 'Markets',
    equities: 'Equities',
    pageTitleThai: 'Undervalued Stocks Thailand',
    pageTitleUS: 'Undervalued Stocks United States',
    pageDescThai:
      "Discover the top undervalued stocks in Thailand based on InvestingPro's fair value metrics. Our curated list highlights stocks trading below their intrinsic value, presenting potential investment opportunities.",
    pageDescUS:
      "Discover the top undervalued stocks in United States based on InvestingPro's fair value metrics. Our curated list highlights stocks trading below their intrinsic value, presenting potential investment opportunities.",
    // Country Selector
    thailandSET: 'Thailand',
    unitedStatesUS: 'United States',
    // Screener Tabs
    tabUndervalued: 'Most Undervalued',
    tabOvervalued: 'Most Overvalued',
    tab52wHigh: '52 Week High',
    tab52wLow: '52 Week Low',
    tabMostActive: 'Most Active',
    tabTopGainers: 'Top Gainers',
    tabTopLosers: 'Top Losers',
    // Table Toolbar
    searchPlaceholder: 'Search by symbol or company name...',
    all: 'All',
    great: 'Great',
    good: 'Good',
    fair: 'Fair',
    showing: 'Showing',
    stocks: 'stocks',
    // Columns
    colName: 'Name',
    colPrice: 'Price',
    colUpside: 'Upside',
    colFairValue: 'Fair Value',
    colHealth: 'Financial Health',
    colCashFlow: 'Cash Flow Rating',
    colGrowth: 'Growth Rating',
    colProfitability: 'Profitability Rating',
    colAnalyst: 'Analyst Ratings',
    colPe: 'P/E Ratio',
    colEvEbitda: 'EV/EBIDTA',
    colMarketCap: 'Market Cap',
    colEpsGrowth: 'EPS Growth (5y)',
    // Pagination & empty
    rowsPerPage: 'Rows per page:',
    page: 'Page',
    of: 'of',
    noStocksFound: 'No stocks match the filter criteria.',
    // Live Sync
    syncNow: 'Sync Live Data',
    syncing: 'Syncing...',
    liveSync: 'Live Auto-Sync',
    lastSynced: 'Last updated:',
    autoSyncNotice: 'Auto-syncs every 15m with Investing.com',
    themeLight: 'Light Mode',
    themeDark: 'Dark Mode',
    langToggle: 'ไทย',
  },
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('th');
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('rea_theme') as Theme | null;
    const savedLang = localStorage.getItem('rea_lang') as Language | null;

    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      document.documentElement.classList.remove('dark');
    }

    if (savedLang) {
      setLang(savedLang);
    }
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('rea_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const toggleLang = () => {
    const nextLang: Language = lang === 'th' ? 'en' : 'th';
    setLang(nextLang);
    localStorage.setItem('rea_lang', nextLang);
  };

  const t = (key: string): string => {
    return translations[lang][key] || key;
  };

  const formatRating = (val?: string | null): string => {
    return formatRatingText(val, lang === 'th');
  };

  return (
    <AppContext.Provider
      value={{
        lang,
        setLang,
        toggleLang,
        theme,
        setTheme,
        toggleTheme,
        t,
        formatRating,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
