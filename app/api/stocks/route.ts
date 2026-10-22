import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { MarketType, StockItem } from '@/types/stock';
import { THAI_STOCKS, US_STOCKS } from '@/data/undervalued-stocks';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawMarket = searchParams.get('market')?.toUpperCase() || 'SET';
  const market = (rawMarket === 'US' ? 'US' : 'SET') as MarketType;

  const baseDir = process.cwd();
  const filePath = path.join(
    baseDir,
    market === 'SET' ? 'thailand_stocks_unmasked.json' : 'undervalued_stocks_unmasked.json'
  );

  let items: StockItem[] = [];
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      items = JSON.parse(content);
    }
  } catch (err: any) {
    console.error('Failed to read stock file:', err);
  }

  // Fallback to bundled dataset if filesystem is empty or on serverless Vercel
  if (!items || items.length === 0) {
    items = market === 'SET' ? THAI_STOCKS : US_STOCKS;
  }

  // Read sync metadata
  let syncStatus = { lastSync: new Date().toISOString(), status: 'idle' };
  const statusPath = path.join(baseDir, 'sync_status.json');
  try {
    if (fs.existsSync(statusPath)) {
      syncStatus = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    }
  } catch (err) {
    // Ignore error
  }

  return NextResponse.json({
    items,
    total: items.length,
    market,
    syncStatus,
    timestamp: new Date().toISOString()
  });
}
