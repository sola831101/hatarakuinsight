/**
 * データ収集スクリプト
 * 実行: npx tsx scripts/collect-data.ts
 *
 * 収集先:
 * - e-Stat API (厚生労働省・総務省統計)
 * - doda転職求人倍率 (スクレイピング)
 * - RESAS API
 */

import fs from 'node:fs';
import path from 'node:path';

const RAW_DIR = path.join(process.cwd(), 'data/raw');
const PROCESSED_DIR = path.join(process.cwd(), 'data/processed');

// ========================================
// e-Stat API: 労働力調査
// ========================================
async function fetchEstatLaborForce(): Promise<void> {
  const ESTAT_APP_ID = process.env.ESTAT_APP_ID;
  if (!ESTAT_APP_ID) {
    console.warn('[e-Stat] ESTAT_APP_IDが未設定です。.envに追加してください。');
    return;
  }

  try {
    // 労働力調査の統計表ID (例: 0003059499)
    const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${ESTAT_APP_ID}&statsDataId=0003059499&metaGetFlg=N&cntGetFlg=N&limit=100`;
    const res = await fetch(url);
    const data = await res.json();

    const outPath = path.join(RAW_DIR, `labor-force-${dateStr()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
    console.log(`[e-Stat] 労働力調査データを保存: ${outPath}`);

    // 整形データに変換
    await processEstatData(data, 'labor-force');
  } catch (err) {
    console.error('[e-Stat] データ取得エラー:', err);
  }
}

// ========================================
// doda 転職求人倍率 (HTMLスクレイピング)
// ========================================
async function fetchDodaJobRatio(): Promise<void> {
  try {
    const url = 'https://doda.jp/guide/kyujin_bairitsu/';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; hatarakuinsight-bot/1.0)' },
    });
    const html = await res.text();

    // 最新月の倍率を正規表現で抽出 (ページ構造に依存するため要メンテ)
    const match = html.match(/転職求人倍率[^0-9]*([0-9]+\.[0-9]+)倍/);
    const ratio = match ? parseFloat(match[1]) : null;

    const data = {
      fetchedAt: new Date().toISOString(),
      source: 'doda転職求人倍率',
      url,
      latestRatio: ratio,
    };

    const outPath = path.join(RAW_DIR, `doda-ratio-${dateStr()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
    console.log(`[doda] 転職求人倍率: ${ratio}倍 → 保存: ${outPath}`);
  } catch (err) {
    console.error('[doda] スクレイピングエラー:', err);
  }
}

// ========================================
// 整形・サマリー生成
// ========================================
async function processEstatData(raw: any, type: string): Promise<void> {
  // 実際のAPIレスポンス構造に合わせて実装
  const summary = {
    type,
    processedAt: new Date().toISOString(),
    raw: raw?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE?.slice(0, 20) ?? [],
  };
  const outPath = path.join(PROCESSED_DIR, `${type}-${dateStr()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
}

// ========================================
// ニュース収集サマリー (後でトピック選定に使う)
// ========================================
async function generateDailySummary(): Promise<void> {
  const allRaw = fs.readdirSync(RAW_DIR)
    .filter(f => f.includes(dateStr()))
    .map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(RAW_DIR, f), 'utf-8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const summary = {
    date: dateStr(),
    collectedAt: new Date().toISOString(),
    sources: allRaw.length,
    files: fs.readdirSync(RAW_DIR).filter(f => f.includes(dateStr())),
  };

  const outPath = path.join(PROCESSED_DIR, `daily-summary-${dateStr()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`[Summary] 日次サマリー生成: ${outPath}`);
}

// ========================================
// ユーティリティ
// ========================================
function dateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function ensureDirs(): void {
  [RAW_DIR, PROCESSED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

// ========================================
// メイン実行
// ========================================
async function main(): Promise<void> {
  console.log(`\n=== データ収集開始: ${new Date().toLocaleString('ja-JP')} ===\n`);
  ensureDirs();

  await Promise.allSettled([
    fetchEstatLaborForce(),
    fetchDodaJobRatio(),
  ]);

  await generateDailySummary();

  console.log('\n=== データ収集完了 ===\n');
}

main().catch(console.error);
