import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { MarketType, StockItem } from '@/types/stock';
import { THAI_STOCKS, US_STOCKS } from '@/data/undervalued-stocks';
import { THAI_OVERVALUED_STOCKS, US_OVERVALUED_STOCKS } from '@/data/overvalued-stocks';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawMarket = searchParams.get('market')?.toUpperCase() || 'SET';
  const market = (rawMarket === 'US' ? 'US' : 'SET') as MarketType;

  const rawTab = (searchParams.get('tab') || searchParams.get('type') || 'undervalued').toLowerCase();
  const tab = rawTab === 'overvalued' ? 'overvalued' : 'undervalued';

  let fileName = '';
  let fallback: StockItem[] = [];

  if (market === 'SET') {
    if (tab === 'overvalued') {
      fileName = 'thailand_stocks_overvalued.json';
      fallback = THAI_OVERVALUED_STOCKS;
    } else {
      fileName = 'thailand_stocks_unmasked.json';
      fallback = THAI_STOCKS;
    }
  } else {
    if (tab === 'overvalued') {
      fileName = 'us_stocks_overvalued.json';
      fallback = US_OVERVALUED_STOCKS;
    } else {
      fileName = 'undervalued_stocks_unmasked.json';
      fallback = US_STOCKS;
    }
  }

  const baseDir = process.cwd();
  const filePath = path.join(baseDir, fileName);

  let items: StockItem[] = [];
  let syncStatus: any = { lastSync: new Date().toISOString(), status: 'idle' };

  // 1. Try fetching freshest committed data directly from GitHub raw content
  try {
    const rawUrl = `https://raw.githubusercontent.com/sicomanzer/inveskeng/main/${fileName}?_t=${Date.now()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const ghRes = await fetch(rawUrl, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    clearTimeout(timeoutId);

    if (ghRes.ok) {
      const ghItems = await ghRes.json();
      if (Array.isArray(ghItems) && ghItems.length > 0) {
        items = ghItems;
      }
    }
  } catch (ghErr) {
    // Network timeout or error fetching from GitHub raw, fall back to local file
  }

  // 2. Fall back to local file system if GitHub raw was empty or unreachable
  if (!items || items.length === 0) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        items = JSON.parse(content);
      }
    } catch (err: any) {
      console.error('Failed to read local stock file:', err);
    }
  }

  // 3. Fall back to bundled dataset if filesystem read returned empty
  if (!items || items.length === 0) {
    items = fallback;
  }

  // Read sync metadata (try GitHub raw first, then local)
  try {
    const statusUrl = `https://raw.githubusercontent.com/sicomanzer/inveskeng/main/sync_status.json?_t=${Date.now()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const statusRes = await fetch(statusUrl, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    clearTimeout(timeoutId);
    if (statusRes.ok) {
      syncStatus = await statusRes.json();
    }
  } catch (e) {
    // Fall back to local sync_status.json
    const statusPath = path.join(baseDir, 'sync_status.json');
    if (fs.existsSync(statusPath)) {
      try {
        syncStatus = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
      } catch (err) {}
    }
  }

  return NextResponse.json(
    {
      items,
      total: items.length,
      market,
      tab,
      syncStatus,
      timestamp: new Date().toISOString()
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    }
  );
}
