import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/stock-details?market=SET|US&symbol=BBIK
 *
 * ข้อมูลจริงจาก scripts/fetch_financials.py (thaifin / yfinance) เก็บใน
 * stock_details_SET.json / stock_details_US.json
 * - ส่ง symbol เดียว: return { symbol, real: <data> } (หรือ real: null ถ้าไม่มี)
 * - ไม่ส่ง symbol:    return { items: <ทั้งตลาด>, total }
 *
 * Local file ก่อนเสมอ; ถ้าไม่มี (เช่น Vercel) ลอง GitHub raw fallback
 * เหมือน /api/stocks
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

  // 2. GitHub raw fallback (Vercel, or missing local file)
  if (!record) {
    try {
      const rawUrl = `https://raw.githubusercontent.com/sicomanzer/inveskeng/main/${fileName}?_t=${Date.now()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const ghRes = await fetch(rawUrl, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      clearTimeout(timeoutId);
      if (ghRes.ok) {
        const parsed = await ghRes.json();
        if (parsed && typeof parsed === 'object') record = parsed;
      }
    } catch {
      // network error / timeout — fall through
    }
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
