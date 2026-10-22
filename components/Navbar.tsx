'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import { Sun, Moon, Globe, Check, Sparkles } from 'lucide-react';

export default function Navbar() {
  const { lang, setLang, toggleLang, theme, toggleTheme, t } = useApp();

  return (
    <header className="w-full bg-white dark:bg-[#161B26] border-b border-[#E4EAF1] dark:border-[#262C3A] sticky top-0 z-30 transition-colors duration-200">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base md:text-lg tracking-tight text-[#181C21] dark:text-white flex items-center gap-1.5">
              <span className="bg-[#1256A0] text-white px-2 py-0.5 rounded text-xs tracking-wider uppercase font-black">
                REA
              </span>
              <span>Investing.com</span>
            </span>
            <span className="hidden sm:inline-block text-[11px] font-semibold text-[#007C32] dark:text-[#00C076] bg-[#EBF6EE] dark:bg-[#132A1E] px-2 py-0.5 rounded-full border border-[#C6E7CE] dark:border-[#1E4D33]">
              Pro Valuation
            </span>
          </div>
        </div>

        {/* Right side controls: Language switcher + Theme toggle */}
        <div className="flex items-center gap-2.5">
          {/* Language Switcher */}
          <div className="flex items-center bg-[#F1F4F8] dark:bg-[#1B212F] p-0.5 rounded-lg border border-[#E4EAF1] dark:border-[#2E3646] text-xs">
            <button
              onClick={() => setLang('th')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                lang === 'th'
                  ? 'bg-white dark:bg-[#2A3346] text-[#1256A0] dark:text-[#60A5FA] shadow-xs font-bold'
                  : 'text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#181C21] dark:hover:text-white'
              }`}
              title="ภาษาไทย"
            >
              <span>🇹🇭</span>
              <span className="hidden sm:inline">ไทย</span>
            </button>
            <button
              onClick={() => setLang('en')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                lang === 'en'
                  ? 'bg-white dark:bg-[#2A3346] text-[#1256A0] dark:text-[#60A5FA] shadow-xs font-bold'
                  : 'text-[#5B616E] dark:text-[#9CA3AF] hover:text-[#181C21] dark:hover:text-white'
              }`}
              title="English"
            >
              <span>🇬🇧</span>
              <span className="hidden sm:inline">EN</span>
            </button>
          </div>

          {/* Theme Toggle Icon Button (Sun / Moon) */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#E4EAF1] dark:border-[#2E3646] bg-white dark:bg-[#1B212F] text-[#5B616E] dark:text-[#F3F4F6] hover:bg-[#F1F4F8] dark:hover:bg-[#2A3346] hover:text-[#181C21] transition shadow-xs"
            title={theme === 'dark' ? t('themeLight') : t('themeDark')}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-[#FBBF24] transition-transform duration-300 rotate-0 hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-[#1256A0] transition-transform duration-300 rotate-0 hover:-rotate-12" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
