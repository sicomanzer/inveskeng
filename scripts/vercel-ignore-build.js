#!/usr/bin/env node
/*
 * Vercel `ignoreCommand`
 *   exit 0 -> ข้าม build (commit ที่แก้แต่ไฟล์ข้อมูล — เว็บอ่าน JSON สดจาก GitHub ตอน runtime อยู่แล้ว)
 *   exit 1 -> build ตามปกติ (แก้โค้ด/คอนฟิก)
 *
 * เหตุผล: auto-sync commit ข้อมูลทุก ~10 นาที ถ้าปล่อยให้ Vercel build ทุก commit
 * จะเกินโควตา Hobby (100 deployments/วัน) ภายในไม่กี่ชั่วโมง
 */
const { execSync } = require('child_process');

const DATA_ONLY = new RegExp(
  '^(' +
    [
      'thailand_stocks_unmasked',
      'thailand_stocks_overvalued',
      'undervalued_stocks_unmasked',
      'us_stocks_overvalued',
      'stock_details_SET',
      'stock_details_US',
      'dividend_stocks',
      'dividend_dps_cache',
      'sync_status',
      'financial_status',
    ].join('|') +
  ')\\.json$'
);

let files = [];
try {
  const out = execSync('git diff --name-only HEAD^ HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  files = out.split('\n').map((s) => s.trim()).filter(Boolean);
} catch {
  // ไม่มี HEAD^ (shallow clone / commit แรก) -> ปลอดภัยไว้ก่อน: build
  process.exit(1);
}

if (!files.length) process.exit(1);

const codeChanges = files.filter((f) => !DATA_ONLY.test(f));
if (codeChanges.length) {
  console.log('[ignore-build] code/config changed -> build:', codeChanges.join(', '));
  process.exit(1);
}

console.log('[ignore-build] data-only commit -> skip build:', files.join(', '));
process.exit(0);
