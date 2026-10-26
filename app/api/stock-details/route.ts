import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const GH_REPO = 'sicomanzer/inveskeng';

/**
 * Fresh file fetch from the repo. raw.githubusercontent serves CDN-cached
 * content (same URL, stale for minutes even with a cache-buster query), so
 * prefer the Contents API when a PAT is configured — it is always fresh.
 */
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
      if (apiRes.ok) {
        const parsed = await apiRes.json();
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // fall through to raw
    }
  }
  try {
    const rawUrl = `https://raw.githubusercontent.com/${GH_REPO}/main/${fileName}?_t=${Date.now()}`;
    const res = await fetch(rawUrl, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
    if (res.ok) {
      const parsed = await res.json();
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return null;
}

/**
 * GET /api/stock-details?market=SET|US&symbol=BBIK
 *
 * ข้อมูลจริงจาก scripts/fetch_financials.py (thaifin / yfinance) เก็บใน
 * stock_details_SET.json / stock_details_US.json
 * - ส่ง symbol เดียว: return { symbol, real: <data> } (หรือ real: null ถ้าไม่มี)
 * - ไม่ส่ง symbol:    return { items: <ทั้งตลาด>, total }
 *
 * API-first (always fresh) -> GitHub raw fallback (CDN may cache a few minutes)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawMarket = searchParams.get('market')?.toUpperCase() || 'SET';
  const market = rawMarket === 'US' ? 'US' : 'SET';
  const symbol = searchParams.get('symbol')?.trim().toUpperCase() || '';

  const fileName = market === 'US' ? 'stock_details_US.json' : 'stock_details_SET.json';
  const baseDir = process.cwd();
  const filePath = path.join(baseDir, fileName);
  const isVercel = process.env.VERCEL === '1';

  let record: Record<string, unknown> | null = null;

  // 1. Local filesystem first (Python fetcher writes here)
  if (!isVercel) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (parsed && typeof parsed === 'object') record = parsed;
      }
    } catch (err) {
      console.error('Failed to read local stock-details file:', err);
    }
  }

  // 2. GitHub (Contents API with PAT, raw fallback) — for Vercel or missing local file
  if (!record) {
    const parsed = await ghFileJson(fileName);
    if (parsed) record = parsed as Record<string, unknown>;
  }

  // 3. Last resort: local file again (in case of odd env detection)
  if (!record) {
    try {
      if (fs.existsSync(filePath)) {
        record = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch {}
  }

  const noStoreHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Vercel-CDN-Cache-Control': 'no-store',
    Pragma: 'no-cache',
    Expires: '0',
  };

  if (symbol) {
    const real = record ? (record as Record<string, unknown>)[symbol] ?? null : null;
    return NextResponse.json(
      { symbol, market, real, timestamp: new Date().toISOString() },
      {
        status: 200,
        headers: noStoreHeaders,
      },
    );
  }

  const items = (record ?? {}) as Record<string, unknown>;
  return NextResponse.json(
    {
      market,
      items,
      total: Object.keys(items).length,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: noStoreHeaders,
    },
  );
}
