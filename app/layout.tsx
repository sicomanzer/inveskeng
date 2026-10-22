import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppProvider } from '@/context/AppContext';
import Navbar from '@/components/Navbar';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Most Undervalued Stocks in Thailand | Investing.com Clone',
  description: 'Most Undervalued Equities in Thailand with Fair Value model calculations, financial health ratings and analyst consensus.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={inter.variable} suppressHydrationWarning>
      <body className={`${inter.className} bg-[#F8F9FA] dark:bg-[#0E1118] text-[#232526] dark:text-[#E5E7EB] min-h-screen antialiased selection:bg-[#1256A0] selection:text-white transition-colors duration-200`}>
        <AppProvider>
          <Navbar />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
