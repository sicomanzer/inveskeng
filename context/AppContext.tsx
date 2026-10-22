'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

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
  en: {
    // Nav
    markets: 'Markets',
    equities: 'Equities',
    pageTitleThai: 'Most Undervalued Stocks in Thailand',
    pageTitleUS: 'Most Undervalued US Stocks',
    pageDescThai:
      'An overview of the most undervalued equities in Thailand, including latest price, financial health, analyst ratings and more based on InvestingPro Fair Value valuation models.',
    pageDescUS:
      'An overview of the most undervalued equities in the United States, including latest price, financial health, analyst ratings and more.',
    // Market Selector
    thailandSET: '🇹🇭 Thailand (SET)',
    unitedStatesUS: '🇺🇸 United States (US)',
    // Tabs
    undervalued: 'Undervalued',
    overvalued: 'Overvalued',
    // KPI Cards
    topUndervalued: 'TOP UNDERVALUED',
    avgUpside: 'AVG FAIR VALUE UPSIDE',
    totalMarketCap: 'TOTAL MARKET CAP',
    valuationEngine: 'VALUATION ENGINE',
    across30: 'Across 30 analyzed securities',
    totalAnalyzedSize: 'Total analyzed market size',
    finboxModels: 'Finbox 14 Models',
    dcfMultiples: 'DCF, Multiples, P/E & EV',
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
    // REA Note
    reaTitle: 'REA Reverse Engineering Grounding:',
    reaDesc:
      'This table styling, cell spacing, typography (Inter), and column contracts directly mirror investing.com/equities/thailand/most-undervalued. The data is unmasked using pair ID correlation with endpoints.investing.com/pd-instruments/v1/instruments.',
    // Theme & Lang
    themeLight: 'Light Mode',
    themeDark: 'Dark Mode',
    langToggle: 'ไทย',
    // Live Sync
    syncNow: 'Sync Live Data',
    syncing: 'Syncing...',
    liveSync: 'Live Auto-Sync',
    lastSynced: 'Last updated:',
    autoSyncNotice: 'Auto-syncs every 15m with Investing.com',
  },
  th: {
    // Nav
    markets: 'ตลาดการเงิน',
    equities: 'ตราสารทุน (หุ้น)',
    pageTitleThai: 'หุ้นไทยที่มีมูลค่าต่ำกว่าราคาประเมินมากที่สุด (Undervalued)',
    pageTitleUS: 'หุ้นสหรัฐฯ ที่มีมูลค่าต่ำกว่าราคาประเมินมากที่สุด (Undervalued)',
    pageDescThai:
      'ภาพรวมของหุ้นในประเทศไทยที่มีราคาตลาดต่ำกว่ามูลค่าแท้จริง (Undervalued) พร้อมราคาล่าสุด สุขภาพทางการเงิน ความเห็นนักวิเคราะห์ และโมเดลคำนวณมูลค่าแท้จริง InvestingPro Fair Value',
    pageDescUS:
      'ภาพรวมของหุ้นในตลาดสหรัฐอเมริกาที่มีราคาต่ำกว่ามูลค่าแท้จริง พร้อมข้อมูลราคา สุขภาพทางการเงิน และการประเมินจากนักวิเคราะห์',
    // Market Selector
    thailandSET: '🇹🇭 ตลาดหุ้นไทย (SET)',
    unitedStatesUS: '🇺🇸 สหรัฐอเมริกา (US)',
    // Tabs
    undervalued: 'ต่ำกว่ามูลค่า (Undervalued)',
    overvalued: 'สูงกว่ามูลค่า (Overvalued)',
    // KPI Cards
    topUndervalued: 'หุ้นที่ UNDERVALUED สูงสุด',
    avgUpside: 'UPSIDE เฉลี่ยจาก FAIR VALUE',
    totalMarketCap: 'มูลค่าหลักทรัพย์รวมที่วิเคราะห์',
    valuationEngine: 'โมเดลประเมินมูลค่า',
    across30: 'จากหุ้นที่วิเคราะห์ทั้งหมด 30 บริษัท',
    totalAnalyzedSize: 'ขนาดมาร์เก็ตแคปรวมในกลุ่ม',
    finboxModels: 'Finbox 14 แบบจำลอง',
    dcfMultiples: 'DCF, Multiples, P/E & EV',
    // Table Toolbar
    searchPlaceholder: 'ค้นหาด้วยชื่อย่อหุ้น หรือชื่อบริษัท...',
    all: 'ทั้งหมด',
    great: 'ยอดเยี่ยม (Great)',
    good: 'ดี (Good)',
    fair: 'ปานกลาง (Fair)',
    showing: 'แสดงทั้งหมด',
    stocks: 'บริษัท',
    // Columns
    colName: 'ชื่อหุ้น',
    colPrice: 'ราคาล่าสุด',
    colUpside: 'ส่วนต่างราคา (Upside)',
    colFairValue: 'มูลค่าแท้จริง (Fair Value)',
    colHealth: 'สุขภาพทางการเงิน',
    colCashFlow: 'เรตติ้งกระแสเงินสด',
    colGrowth: 'เรตติ้งการเติบโต',
    colProfitability: 'เรตติ้งการทำกำไร',
    colAnalyst: 'มุมมองนักวิเคราะห์',
    colPe: 'อัตราส่วน P/E',
    colEvEbitda: 'EV/EBITDA',
    colMarketCap: 'มาร์เก็ตแคป',
    colEpsGrowth: 'เติบโต EPS (5 ปี)',
    // Pagination & empty
    rowsPerPage: 'แถวต่อหน้า:',
    page: 'หน้า',
    of: 'จาก',
    noStocksFound: 'ไม่พบข้อมูลหุ้นตามเงื่อนไขการค้นหา',
    // REA Note
    reaTitle: 'โครงสร้างทางเทคนิคจากการทำ Reverse Engineering ด้วย REA:',
    reaDesc:
      'โครงสร้างตาราง ระยะห่างคอลัมน์ ฟอนต์มาตรฐาน (Inter) และสคีมาข้อมูล จำลองตรงตาม investing.com/equities/thailand/most-undervalued ทุกประการ โดยปลดล็อกข้อมูลจริงที่ถูกบัง (Masked Data) ผ่านการจับคู่ Pair ID กับ endpoints.investing.com/pd-instruments/v1/instruments',
    // Theme & Lang
    themeLight: 'โหมดสว่าง',
    themeDark: 'โหมดมืด',
    langToggle: 'English',
    // Live Sync
    syncNow: 'ซิงค์ข้อมูลสด',
    syncing: 'กำลังซิงค์...',
    liveSync: 'ระบบซิงค์สดอัตโนมัติ',
    lastSynced: 'อัปเดตล่าสุด:',
    autoSyncNotice: 'อัปเดตอัตโนมัติทุก 15 นาทีตาม Investing.com',
  },
};

const ratingTranslationsTh: Record<string, string> = {
  EXCELLENT: 'ยอดเยี่ยมมาก',
  GREAT: 'ยอดเยี่ยม',
  GOOD: 'ดี',
  FAIR: 'ปานกลาง',
  POOR: 'แย่',
  WEAK: 'อ่อนแอ',
  STRONG_BUY: 'ซื้อทันที',
  BUY: 'ซื้อ',
  NEUTRAL: 'ปานกลาง',
  HOLD: 'ถือ',
  SELL: 'ขาย',
  STRONG_SELL: 'ขายทันที',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('th');
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load persisted preferences
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
      // Default to light
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
    if (!val) return '-';
    const upper = val.toUpperCase();
    if (lang === 'th') {
      return ratingTranslationsTh[upper] || val;
    }
    switch (upper) {
      case 'EXCELLENT':
        return 'Excellent';
      case 'GREAT':
        return 'Great';
      case 'GOOD':
        return 'Good';
      case 'FAIR':
        return 'Fair';
      case 'POOR':
        return 'Poor';
      case 'WEAK':
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
