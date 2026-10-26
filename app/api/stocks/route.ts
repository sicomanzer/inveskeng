import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { MarketType, StockItem } from '@/types/stock';
import { THAI_STOCKS, US_STOCKS } from '@/data/undervalued-stocks';
import { THAI_OVERVALUED_STOCKS, US_OVERVALUED_STOCKS } from '@/data/overvalued-stocks';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const GH_REPO = 'sicomanzer/inveskeng';

/** Fresh file fetch: Contents API (with PAT) first — raw.githubusercontent
 *  CDN can serve a stale copy of the same URL for minutes even with a
 *  cache-buster. raw fallback keeps the route working without a PAT. */
async function ghFileJson(fileName: string): Promise<unknown | null> {
  const pat = process.env.GITHUB_PAT;
  if (pat) {
    try {
      const apiRes = await fetch(
        `https://api.github.com/repos/${GH_REPO}/contents/${fileName}?ref=main&_t=${Date.now()}`,
        {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${pat}`,
            Accept: 'application/vnd.github.raw',
            'Cache-Control': 'no-cache',
          },
        },
      );
      if (apiRes.ok) return await apiRes.json();
    } catch {}
  }
  try {
    const rawUrl = `https://raw.githubusercontent.com/${GH_REPO}/main/${fileName}?_t=${Date.now()}`;
    const res = await fetch(rawUrl, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

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
  const isVercel = process.env.VERCEL === '1';

  // 1. If running locally, ALWAYS read the local filesystem first (where Python scrapers save live data)
  if (!isVercel) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          items = parsed;
        }
      }
    } catch (err: any) {
      console.error('Failed to read local stock file:', err);
    }
  }

  // 2. On Vercel (or locally if local file not found), fetch freshly committed data from GitHub
  if (!items || items.length === 0) {
    // one retry round-trip: cold Lambda + slow raw responses used to make this
    // fail every time and silently serve build-time data
    for (let attempt = 0; attempt < 3 && (!items || items.length === 0); attempt++) {
      const parsed = await ghFileJson(fileName);
      if (Array.isArray(parsed) && parsed.length > 0) {
        items = parsed as StockItem[];
      }
    }
  }

  // 3. Fall back to local file system if not yet read
  if (!items || items.length === 0) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        items = JSON.parse(content);
      }
    } catch (err: any) {}
  }

  // 4. Fall back to bundled dataset if filesystem read returned empty
  if (!items || items.length === 0) {
    items = fallback;
  }

  // Read sync metadata
  const statusPath = path.join(baseDir, 'sync_status.json');
  if (!isVercel && fs.existsSync(statusPath)) {
    try {
      syncStatus = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    } catch (err) {}
  }

  if (!syncStatus || !syncStatus.lastSync || isVercel) {
    try {
      const parsed = await ghFileJson('sync_status.json');
      if (parsed) syncStatus = parsed;
      if (!syncStatus.lastSync) {
        syncStatus = { lastSync: new Date().toISOString(), status: 'idle' };
      }
    } catch (e) {
      if (fs.existsSync(statusPath)) {
        try {
          syncStatus = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
        } catch (err) {}
      }
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
