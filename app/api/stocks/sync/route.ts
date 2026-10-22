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
    console.error('Sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sync data',
        market
      },
      { status: 500 }
    );
  }
}
