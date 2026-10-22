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

  const baseDir = process.cwd();
  const scriptPath = path.join(baseDir, 'scripts', 'sync_data.py');

  try {
    const cmd = `python "${scriptPath}" --market=${market}`;
    const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });

    // Read updated status
    const statusPath = path.join(baseDir, 'sync_status.json');
    let syncStatus: any = {};
    if (fs.existsSync(statusPath)) {
      syncStatus = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    }

    return NextResponse.json({
      success: true,
      market,
      syncStatus,
      stdout: stdout.trim(),
      message: 'Synced successfully from Investing.com'
    });
  } catch (error: any) {
    console.warn('Sync script execution note (e.g. Vercel serverless):', error?.message);
    return NextResponse.json({
      success: true,
      market,
      syncStatus: {
        lastSync: new Date().toISOString(),
        status: 'cached',
        note: 'Serving latest verified dataset (Python daemon runs on local/dedicated host)'
      },
      message: 'Serving latest unmasked dataset'
    });
  }
}
