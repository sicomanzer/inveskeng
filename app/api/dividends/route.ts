import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { DividendPayload } from '@/types/stock';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
// GitHub Contents API บน cold start อาจช้า — เผื่อเวลาให้พอ
export const maxDuration = 30;

const GH_REPO = 'sicomanzer/inveskeng';
const FILE_NAME = 'dividend_stocks.json';

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

export async function GET() {
  const baseDir = process.cwd();
  const filePath = path.join(baseDir, FILE_NAME);
  const isVercel = process.env.VERCEL === '1';

  let payload: DividendPayload | null = null;

  // 1. local filesystem first when running locally (Python writes it here)
  if (!isVercel) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) payload = parsed;
      }
    } catch (err) {
      console.error('Failed to read local dividend file:', err);
    }
  }

  // 2. on Vercel (or local miss) read the freshly committed JSON from GitHub
  for (let attempt = 0; attempt < 3 && !payload; attempt++) {
    const parsed = await ghFileJson(FILE_NAME);
    const p = parsed as DividendPayload | null;
    if (p && Array.isArray(p.items) && p.items.length > 0) payload = p;
  }

  // 3. last resort: local file even on Vercel (build-time copy)
  if (!payload) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (parsed && Array.isArray(parsed.items)) payload = parsed;
      }
    } catch {}
  }

  if (!payload) {
    return NextResponse.json(
      { items: [], total: 0, error: 'dividend dataset unavailable' },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'CDN-Cache-Control': 'no-store',
          'Vercel-CDN-Cache-Control': 'no-store',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    );
  }

  return NextResponse.json(
    {
      ...payload,
      total: payload.items.length,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
        Pragma: 'no-cache',
        Expires: '0',
      },
    },
  );
}
