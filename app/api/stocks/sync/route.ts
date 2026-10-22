import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handleSync(request);
}

export async function GET(request: Request) {
  return handleSync(request);
}

async function handleSync(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawMarket = searchParams.get('market')?.toUpperCase() || 'ALL';
  const market = rawMarket === 'US' ? 'US' : rawMarket === 'SET' ? 'SET' : 'ALL';

  const isVercel = process.env.VERCEL === '1';
  const githubPat = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;

  // 1. If running on Vercel with GitHub PAT configured, trigger GitHub Action cloud sync
  if (isVercel && githubPat) {
    try {
      const ghRes = await fetch(
        'https://api.github.com/repos/sicomanzer/inveskeng/actions/workflows/auto-sync.yml/dispatches',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${githubPat}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'inveskeng-sync-trigger',
          },
          body: JSON.stringify({ ref: 'main' }),
        }
      );

      if (ghRes.ok || ghRes.status === 204) {
        return NextResponse.json({
          success: true,
          mode: 'github-action-dispatched',
          market,
          message: 'สั่งรัน GitHub Action ซิงค์ข้อมูลสดบน Cloud เรียบร้อยแล้ว (จะอัปเดตใน 1-2 นาที)',
          syncStatus: {
            lastSync: new Date().toISOString(),
            status: 'dispatching',
          },
        });
      } else {
        const errorText = await ghRes.text();
        console.error('GitHub Actions dispatch error:', ghRes.status, errorText);
      }
    } catch (dispatchErr: any) {
      console.error('Failed to dispatch GitHub Action:', dispatchErr);
    }
  }

  // 2. If running locally with Python available, execute local sync script
  const baseDir = process.cwd();
  const scriptPath = path.join(baseDir, 'scripts', 'sync_data.py');

  try {
    const cmd = `python "${scriptPath}" --market=${market}`;
    const { stdout } = await execAsync(cmd, { timeout: 35000 });

    const statusPath = path.join(baseDir, 'sync_status.json');
    let syncStatus: any = {};
    if (fs.existsSync(statusPath)) {
      syncStatus = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    }

    return NextResponse.json({
      success: true,
      mode: 'local-python',
      market,
      syncStatus,
      stdout: stdout.trim(),
      message: 'ซิงค์ข้อมูลสดจาก Investing.com สำเร็จ',
    });
  } catch (error: any) {
    // 3. Vercel serverless without PAT
    return NextResponse.json({
      success: false,
      mode: 'vercel-serverless-limitation',
      market,
      syncStatus: {
        lastSync: new Date().toISOString(),
        status: 'schedule-active',
      },
      message:
        'Vercel ทำงานในโหมด Serverless ไม่สามารถรัน Python ได้โดยตรง ระบบจะดึงข้อมูลอัตโนมัติผ่าน GitHub Actions ทุก 30 นาที หรือเพิ่ม GITHUB_PAT เพื่อให้ปุ่มนี้สั่ง Cloud Action ได้ทันที',
    });
  }
}
